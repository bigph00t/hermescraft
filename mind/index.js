// index.js -- Event-driven Mind loop: chat/skill/idle -> think() -> dispatch()

import { readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { queryLLM, clearConversation } from './llm.js'
import { buildSystemPrompt, buildUserMessage, getBuildContextForPrompt, buildDesignPrompt } from './prompt.js'
import { dispatch } from './registry.js'
import { getMemoryForPrompt, addWorldKnowledge, recordDeath, writeSessionEntry } from './memory.js'
import { trackPlayer, getPlayersForPrompt, getPartnerLastChat, savePlayers } from './social.js'
import { getLocationsForPrompt, saveLocation, setHome, getHome } from './locations.js'
// Direct getters and build function from body/ — pragmatic boundary crossing: mind/index.js
// is the wiring layer (like start.js) that orchestrates LLM calls + body skill execution.
import { getActiveBuild, listBlueprints, build } from '../body/skills/build.js'
import { requestInterrupt } from '../body/interrupt.js'
import { validateBlueprint } from '../body/blueprints/validate.js'
import { recordBuild, getBuildHistoryForPrompt } from './build-history.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
// BLUEPRINTS_DIR mirrors the path in body/skills/build.js — co-located with blueprint JSONs
const BLUEPRINTS_DIR = join(__dirname, '..', 'body', 'blueprints')

// ── Module-level Guard State ──

let lastActionTime = Date.now()
let skillRunning = false
let thinkingInFlight = false
let idleCheckTimer = null
let _config = null
let _pendingChat = null  // queued chat that arrived during think()

// ── Async Chat Response (bypasses skill queue) ──

// respondToChat fires immediately when someone talks, even during active skills.
// It makes its own LLM call with a focused "someone just said X, respond" prompt.
// If the LLM response contains a !command, it interrupts the running skill and queues it.
let _chatResponseInFlight = false

async function respondToChat(bot, sender, message) {
  // Don't stack chat responses — latest message wins
  if (_chatResponseInFlight) {
    _pendingChat = { trigger: 'chat', sender, message }
    return
  }
  _chatResponseInFlight = true

  try {
    const systemPrompt = buildSystemPrompt(bot, {
      soul: _config?.soulContent,
      memory: getMemoryForPrompt(),
      players: getPlayersForPrompt(bot),
      locations: getLocationsForPrompt(bot.entity?.position),
    })

    const stateText = buildUserMessage(bot, 'chat', { sender, message })
    console.log('[mind] responding to chat from', sender)

    const result = await queryLLM(systemPrompt, stateText)

    if (result.reasoning) {
      console.log('[mind] chat reasoning:', result.reasoning.slice(0, 150))
    }

    // If LLM wants to chat back, send it immediately
    if (result.command === 'chat') {
      const msg = result.args?.message || ''
      if (msg) {
        bot.chat(msg)
        console.log('[mind] chat reply sent:', msg.slice(0, 80))
      }
    }
    // If LLM produced an action command, interrupt current skill and queue it
    else if (result.command && result.command !== 'idle') {
      console.log('[mind] chat triggered command:', result.command, result.args)
      if (skillRunning) {
        requestInterrupt(bot)
        console.log('[mind] interrupted running skill for chat command')
      }
      _pendingChat = { trigger: 'chat', sender, message, forceCommand: result }
    }
    // No command — LLM just reasoned without acting. If there's reasoning that
    // looks like a response, send it as chat (the LLM often "says" things in
    // reasoning without using !chat)
    else if (!result.command && result.reasoning) {
      // Extract any conversational text from reasoning (first sentence-like chunk)
      const lines = result.reasoning.split('\n').filter(l => l.trim())
      const conversational = lines.find(l =>
        !l.startsWith('I ') && !l.startsWith('My ') && !l.startsWith('Let me') &&
        !l.includes('inventory') && !l.includes('should') && l.length < 100
      )
      // Don't auto-extract — too risky. Just log that no response was sent.
      console.log('[mind] no !chat in response — LLM reasoned but didn\'t reply')
    }
  } catch (err) {
    console.error('[mind] chat response error:', err.message)
  } finally {
    _chatResponseInFlight = false
  }
}

// ── Core Think Function ──

// think(bot, context) — the central decision function.
// NOT exported — called internally by event listeners only.
//
// Guards:
//   - thinkingInFlight: prevents concurrent LLM queries (two chat messages arriving
//     before the first query resolves would otherwise queue two parallel calls)
//   - skillRunning: set around dispatch() to block idle triggers from re-entering
//     while a skill is executing
//
// NO ARTIFICIAL DELAYS: this function fires immediately when called. No cooldowns,
// no rate limits, no turn caps. If the LLM responds in 0.5s, the next think() fires
// on the next triggering event — immediately.
async function think(bot, context) {
  // If we're busy and a chat arrives, queue it so we respond after current cycle
  if (thinkingInFlight) {
    if (context.trigger === 'chat') {
      _pendingChat = context
    }
    return
  }
  thinkingInFlight = true

  try {
    const activeBuild = getActiveBuild()
    const blueprintCatalog = listBlueprints()
    const buildContext = getBuildContextForPrompt(activeBuild, blueprintCatalog)

    const systemPrompt = buildSystemPrompt(bot, {
      soul: _config?.soulContent,
      memory: getMemoryForPrompt(),
      players: getPlayersForPrompt(bot),
      locations: getLocationsForPrompt(bot.entity?.position),
      buildContext,
      buildHistory: getBuildHistoryForPrompt(),
    })

    // Inject partner's last chat into user message if available
    const partnerChat = _config?.partnerName ? getPartnerLastChat(_config.partnerName) : null
    const userMessage = buildUserMessage(bot, context.trigger, { ...context, partnerChat })

    console.log('[mind] thinking...', context.trigger)

    const result = await queryLLM(systemPrompt, userMessage)

    if (result.reasoning) {
      console.log('[mind] reasoning:', result.reasoning.slice(0, 200))
    }

    // No command produced — LLM chose to narrate without acting. Treat as idle.
    if (result.command === null) {
      console.log('[mind] no command in response, treating as idle')
      lastActionTime = Date.now()
      return
    }

    // Explicit idle command — the LLM decided to wait.
    if (result.command === 'idle') {
      console.log('[mind] idle command received')
      lastActionTime = Date.now()
      return
    }

    // !sethome — mark current position as home base
    if (result.command === 'sethome') {
      const pos = bot.entity.position
      setHome(Math.round(pos.x), Math.round(pos.y), Math.round(pos.z))
      bot.homeLocation = { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) }
      console.log('[mind] home set at', Math.round(pos.x), Math.round(pos.y), Math.round(pos.z))
      lastActionTime = Date.now()
      return
    }

    // !design — generate a blueprint from natural language and auto-build it.
    // Handled here (before dispatch) because it requires a separate LLM call and
    // special result recording. The registry entry is only a fallback/help-text stub.
    if (result.command === 'design') {
      const description = result.args.description || ''
      if (!description) {
        console.log('[mind] !design missing description')
        lastActionTime = Date.now()
        return
      }
      console.log('[mind] designing:', description)
      skillRunning = true
      const designResult = await designAndBuild(bot, description)
      skillRunning = false
      console.log('[mind] design result:', designResult.success ? 'OK' : designResult.reason)
      lastActionTime = Date.now()

      // Record successful designs + builds in world knowledge, locations, and build history
      if (designResult.success) {
        const pos = bot.entity.position
        addWorldKnowledge(`Designed and built "${description}" at ${Math.round(pos.x)},${Math.round(pos.y)},${Math.round(pos.z)}`)
        saveLocation(`custom_build`, Math.round(pos.x), Math.round(pos.y), Math.round(pos.z), 'build')
        recordBuild({
          name: description,
          origin: { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) },
          dimensions: { x: 0, y: 0, z: 0 },
          blockCount: designResult.placed || designResult.total || 0,
          builder: bot.username,
        })
      }

      setTimeout(() => think(bot, { trigger: 'skill_complete', skillName: 'design', skillResult: designResult }), 0)
      return
    }

    // Dispatch a real command to the body
    console.log('[mind] dispatching:', result.command, result.args)
    skillRunning = true
    const skillResult = await dispatch(bot, result.command, result.args)
    skillRunning = false

    console.log('[mind] skill result:', result.command, skillResult.success ? 'OK' : skillResult.reason)
    lastActionTime = Date.now()

    // Record build completion to world knowledge, locations, and build history for cross-session recall (BUILD-03)
    if (result.command === 'build' && skillResult.success) {
      const bpName = result.args.blueprint || result.args.blueprintName || result.args.name
      const bx = result.args.x
      const by = result.args.y
      const bz = result.args.z
      addWorldKnowledge(`Built ${bpName} at ${bx},${by},${bz}. Consider expanding or adding nearby.`)
      saveLocation(`${bpName}_site`, parseInt(bx), parseInt(by), parseInt(bz), 'build')
      recordBuild({
        name: bpName,
        origin: { x: parseInt(bx), y: parseInt(by), z: parseInt(bz) },
        dimensions: { x: 0, y: 0, z: 0 },
        blockCount: skillResult.placed || skillResult.total || 0,
        builder: bot.username,
      })
    }

    // Schedule skill_complete think on the next event loop tick so:
    //   a) finally block runs and clears thinkingInFlight first
    //   b) the idle timer can catch gaps if this setTimeout doesn't fire
    setTimeout(() => think(bot, { trigger: 'skill_complete', skillName: result.command, skillResult }), 0)

  } catch (err) {
    console.error('[mind] think error:', err.message)
    skillRunning = false
  } finally {
    thinkingInFlight = false
    // Ensure skillRunning is cleared if dispatch threw before explicit reset
    if (skillRunning) skillRunning = false
    // Replay queued chat that arrived while we were busy
    if (_pendingChat) {
      const queued = _pendingChat
      _pendingChat = null
      setTimeout(() => think(bot, queued), 0)
    }
  }
}

// ── Design + Build Pipeline ──

// designAndBuild(bot, description) — orchestrates the full !design pipeline:
//   1. Select 3 reference blueprints from BLUEPRINTS_DIR (excluding _generated.json)
//   2. Build a dedicated design system prompt with those references
//   3. Make a SEPARATE LLM call with the design prompt (not the normal game prompt)
//   4. Extract JSON from the LLM response (strip <think> tags, then parse)
//   5. Validate with validateBlueprint()
//   6. Write to _generated.json for build() to load by name
//   7. Auto-execute build() at the bot's current position
//
// Returns the build result { success, ... } or { success: false, reason } on failure.
export async function designAndBuild(bot, description) {
  // ── 1. Select 3 reference blueprints ──
  let refs = []
  try {
    const files = readdirSync(BLUEPRINTS_DIR)
      .filter(f => f.endsWith('.json') && f !== '_generated.json')
    // Shuffle and take up to 3
    const shuffled = files.sort(() => Math.random() - 0.5).slice(0, 3)
    for (const f of shuffled) {
      try {
        const raw = readFileSync(join(BLUEPRINTS_DIR, f), 'utf-8')
        const bp = JSON.parse(raw)
        refs.push({ name: bp.name || f.replace('.json', ''), json: JSON.stringify(bp, null, 2) })
      } catch {
        // Skip unreadable blueprints silently
      }
    }
  } catch (err) {
    console.log('[mind] designAndBuild: could not read blueprints dir:', err.message)
  }

  // ── 2. Build the design prompt ──
  const designPrompt = buildDesignPrompt(description, refs)

  // ── 3. Dedicated LLM call with design prompt ──
  // This call uses the design prompt as the system prompt, replacing the normal game prompt
  // for this one exchange. The conversation history will include it (acceptable trade-off —
  // the exchange provides context about what was designed).
  let result
  try {
    result = await queryLLM(designPrompt, 'Generate the blueprint now.')
  } catch (err) {
    return { success: false, reason: `LLM call failed: ${err.message}` }
  }

  // ── 4. Extract JSON from response ──
  // LLM should produce pure JSON. Strip <think> blocks first, then parse.
  const stripped = (result.raw || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()

  let jsonString = null

  // First try: direct parse of stripped text
  try {
    JSON.parse(stripped)
    jsonString = stripped
  } catch {
    // Second try: regex extract the outermost {...} object
    const match = stripped.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        JSON.parse(match[0])
        jsonString = match[0]
      } catch {
        jsonString = null
      }
    }
  }

  if (!jsonString) {
    return { success: false, reason: 'LLM did not produce valid JSON' }
  }

  // ── 5. Validate ──
  const validation = validateBlueprint(jsonString)
  if (!validation.valid) {
    return { success: false, reason: 'Blueprint validation failed: ' + validation.errors.join('; ') }
  }

  // ── 6. Write to _generated.json ──
  const generatedPath = join(BLUEPRINTS_DIR, '_generated.json')
  try {
    writeFileSync(generatedPath, jsonString)
  } catch (err) {
    return { success: false, reason: `Failed to write generated blueprint: ${err.message}` }
  }

  // ── 7. Auto-execute build at bot's current position ──
  const pos = bot.entity.position
  const originX = Math.round(pos.x)
  const originY = Math.round(pos.y)
  const originZ = Math.round(pos.z)

  const buildResult = await build(bot, '_generated', originX, originY, originZ)
  return buildResult
}

// ── Exported Init Function ──

// Getter for body/modes.js — reads skillRunning without crossing the mind/body boundary.
// body/ never imports mind/ directly; start.js passes this function as a callback.
export function isSkillRunning() {
  return skillRunning
}

// initMind(bot, config) — registers event listeners on the bot and starts the idle timer.
// Call once after createBot() resolves. config carries SOUL content, partner name, data dir.
export async function initMind(bot, config) {
  _config = config || null

  // ── Trigger 1: Chat received ──
  // Fire think() when a player sends a chat message.
  // Filters:
  //   - Messages with no sender (system/server messages) are ignored
  //   - The bot's own messages echoed back are filtered by username match
  bot.on('messagestr', (msgStr, position, jsonMsg, sender) => {
    if (!sender) return

    // Resolve sender UUID to username — bot.players is keyed by USERNAME, not UUID.
    // The 'sender' parameter in messagestr is a UUID string (MC 1.16+),
    // so we must search bot.players for the entry whose .uuid matches.
    let username = null
    for (const [pName, pData] of Object.entries(bot.players || {})) {
      if (pData.uuid === sender) {
        username = pName
        break
      }
    }
    if (!username) {
      // Fallback: sender might be a username on some server implementations
      username = bot.players?.[sender]?.username || sender.toString().slice(0, 16)
    }

    // Filter bot's own messages echoed back
    if (username === bot.username) return

    console.log('[mind] chat from', username, ':', msgStr)

    // Track player interaction for social module
    trackPlayer(username, { type: 'chat', detail: msgStr })

    // Chat responses are ASYNC from the skill queue — they fire immediately
    // even if a skill is running. This is a separate LLM call just for responding.
    // If the response contains a !command, we interrupt the running skill and dispatch it.
    respondToChat(bot, username, msgStr)
  })

  // ── Trigger 2: Skill complete ──
  // Handled via setTimeout(0) inside think() after dispatch() returns (above).
  // No separate event listener needed.

  // ── Trigger 3: Idle timeout ──
  // Polls every 500ms. Fires think() if the bot has been idle for 2+ seconds.
  // The 500ms interval is ONLY a sentinel — it does NOT cap LLM call frequency.
  // If the LLM and skills complete in under 2s, this never fires (skill_complete does).
  idleCheckTimer = setInterval(() => {
    if (skillRunning || thinkingInFlight) return
    const idleMs = Date.now() - lastActionTime
    if (idleMs >= 2000) {
      think(bot, { trigger: 'idle', idleMs })
    }
  }, 500)

  // ── Death handler ──
  // Reset conversation history and idle timer on death.
  // Wipes context so the bot doesn't resume with stale pre-death decisions.
  bot.on('death', () => {
    console.log('[mind] bot died — clearing conversation')
    clearConversation()
    recordDeath('Died in the world')
    lastActionTime = Date.now()
  })

  console.log('[mind] initialized — listening for chat, skill complete, idle')
}
