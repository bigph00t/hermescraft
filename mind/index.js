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
import { retrieveKnowledge } from './knowledgeStore.js'
import { getBrainStateForPrompt, getBrainHooks } from './backgroundBrain.js'
import { captureAndAnalyze, buildVisionForPrompt } from './vision.js'
import { getMinimapSummary, renderCompositeViewSync } from './minimap.js'
import { scanArea } from '../body/skills/scan.js'
import { logEvent, queryRecent, queryNearby } from './memoryDB.js'
import { planBuild, auditMaterials, getBuildPlanForPrompt, getActivePlan, buildExpectedBlockMap, saveBuildPlan, claimBuildSection } from './buildPlanner.js'
import { broadcastActivity, getPartnerActivityForPrompt } from './coordination.js'
import { createProject, getProject, listProjects, recordPlacement,
         getRemaining, getMissingMaterials, joinProject, completeProject,
         getLedgerForPrompt, surveyBuildSite } from './buildLedger.js'

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
let _lastFailure = null  // { command, args } from previous failed dispatch — consumed by next think()
let _lastDeath = null    // death message string — consumed by next think() for recovery RAG
let _repeatTracker = { key: null, count: 0 }  // detects same action failing repeatedly
const MAX_REPEAT_FAILURES = 3  // after this many identical failures, force a different action
// Success repetition tracker — catches navigate-to-same-coords and other successful-but-pointless loops
const _successRepeatHistory = []  // ring buffer of last N action keys (including successes)
const MAX_SUCCESS_REPEATS = 8    // after this many identical successful actions, nudge LLM to reconsider
const SUCCESS_HISTORY_SIZE = 12  // how many recent actions to track
// Chat message dedup — prevents the LLM from generating the same chat text repeatedly
const _recentSentMessages = []   // ring buffer of last N outgoing chat message texts
const CHAT_DEDUP_WINDOW = 8      // how many recent messages to check for duplication
let _lastVisionResult = null  // consume-once VLM description — cleared after injection into prompt
let _postBuildScan = null     // consume-once post-build scan result
let _pendingDesignNotification = null  // consume-once: set by background design worker when blueprint is ready
let _designWorkerRunning = false       // guard against concurrent design workers
let _thinkTickCount = 0       // counts think() calls — used for tiered vision (every Nth tick gets an image)
const VISION_TICK_INTERVAL = 1  // include composite render EVERY tick — agents always see the world
const _chatCountByPartner = new Map()  // COO-02 (Phase 24): per-partner chat loop prevention
let _lastChatSender = null              // tracks who triggered the current chat response
let _lastChatTimestamp = 0               // timestamp of last outgoing chat — used for anti-spam cooldown
const CHAT_COOLDOWN_MS = 8000           // 8s between chat responses — forces game actions between messages
let _chatResponseCount = 0              // consecutive chat responses without a game action

// Two-agent setup: no proximity filter, no @name tagging required.
// Every message from the other agent triggers a response.

// ── Async Chat Response (bypasses skill queue) ──

// respondToChat fires immediately when someone talks, even during active skills.
// It makes its own LLM call with a focused "someone just said X, respond" prompt.
// If the LLM response contains a !command, it interrupts the running skill and queues it.
let _chatResponseInFlight = false

async function respondToChat(bot, sender, message) {
  // Don't stack chat responses — drop if busy
  if (_chatResponseInFlight) return
  // Anti-spam cooldown — don't respond too fast (prevents ping-pong loops)
  if (Date.now() - _lastChatTimestamp < CHAT_COOLDOWN_MS) {
    console.log('[mind] chat cooldown — waiting before responding')
    return
  }
  // After 2 consecutive chat responses without a game action, stop responding to chat
  // This forces the agent to actually DO something instead of endlessly discussing
  if (_chatResponseCount >= 2) {
    console.log('[mind] chat limit — do a game action before responding again')
    return
  }
  _chatResponseInFlight = true
  _lastChatSender = sender  // Track who we're chatting with for per-partner counter

  try {
    // ── !wiki command (RAG-07) ──
    // Handle !wiki before normal chat processing — retrieve knowledge and synthesize answer
    if (message.trim().startsWith('!wiki')) {
      const query = message.trim().slice(5).trim()
      if (!query) {
        bot.chat('Ask me anything about Minecraft!')
        return  // finally block will clear _chatResponseInFlight
      }
      try {
        const chunks = await retrieveKnowledge(query, 5)  // top-5 for wiki per user decision
        if (chunks.length === 0) {
          bot.chat("Hmm, I'm not sure about that one.")
          return
        }
        const ragContext = formatRagContext(chunks)
        const wikiPrompt = buildSystemPrompt(bot, {
          soul: _config?.soulContent,
          memory: getMemoryForPrompt(),
          players: getPlayersForPrompt(bot),
          locations: getLocationsForPrompt(bot.entity?.position),
          ragContext,
          partnerNames: _config?.partnerNames || [],
        })
        const wikiMessage = buildUserMessage(bot, 'chat', {
          sender,
          message: `${sender} asked: ${query} — answer their question naturally using what you know. Be helpful and specific.`,
        })
        console.log('[mind] !wiki query:', query, `(${chunks.length} chunks)`)
        const wikiResult = await queryLLM(wikiPrompt, wikiMessage, { isolated: true })
        if (wikiResult.command === 'chat' && wikiResult.args?.message) {
          bot.chat(wikiResult.args.message)
        } else if (wikiResult.reasoning) {
          // LLM put the answer in reasoning but not in a !chat — extract first useful line
          bot.chat(wikiResult.reasoning.split('\n').find(l => l.trim().length > 10) || "I know about that but couldn't form an answer.")
        } else {
          bot.chat("I know about that but couldn't form an answer.")
        }
      } catch (err) {
        console.error('[mind] !wiki error:', err.message)
        bot.chat("Sorry, I couldn't look that up right now.")
      }
      return  // Don't fall through to normal chat handling
    }

    const systemPrompt = buildSystemPrompt(bot, {
      soul: _config?.soulContent,
      memory: getMemoryForPrompt(),
      players: getPlayersForPrompt(bot),
      locations: getLocationsForPrompt(bot.entity?.position),
      partnerNames: _config?.partnerNames || [],
    })

    const stateText = buildUserMessage(bot, 'chat', { sender, message })
    console.log('[mind] responding to chat from', sender)

    const result = await queryLLM(systemPrompt, stateText)

    if (result.reasoning) {
      console.log('[mind] chat reasoning:', result.reasoning.slice(0, 150))
    }

    // If LLM wants to chat back, send it immediately (with dedup)
    if (result.command === 'chat') {
      const msg = result.args?.message || ''
      if (msg) {
        const normMsg = msg.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
        const isDupe = _recentSentMessages.some(prev => {
          if (normMsg === prev) return true
          const words = new Set(normMsg.split(/\s+/))
          const prevWords = prev.split(/\s+/)
          const overlap = prevWords.filter(w => words.has(w)).length
          return prevWords.length > 2 && overlap / prevWords.length > 0.8
        })
        if (isDupe) {
          console.log('[mind] suppressed duplicate chat reply:', msg.slice(0, 60))
        } else {
          bot.chat(msg)
          _recentSentMessages.push(normMsg)
          if (_recentSentMessages.length > CHAT_DEDUP_WINDOW) _recentSentMessages.shift()
          _lastChatTimestamp = Date.now()  // cooldown timer instead of hard block
          _chatResponseCount++  // track consecutive chats
          console.log('[mind] chat reply sent (' + _chatResponseCount + '/2):', msg.slice(0, 80))
        }
      }
    }
    // If LLM produced a non-chat game action, dispatch it — the agent should act on chat context
    // But only if no skill is already running (prevent concurrent mineflayer operations)
    else if (result.command && result.command !== 'idle') {
      if (skillRunning || thinkingInFlight) {
        console.log('[mind] chat triggered action:', result.command, '— deferred (skill/think active)')
      } else {
        console.log('[mind] chat triggered action:', result.command, '— dispatching')
        try {
          skillRunning = true
          const actionResult = await dispatch(bot, result.command, result.args)
          skillRunning = false
          console.log('[mind] chat-triggered action result:', result.command, actionResult.success ? 'OK' : actionResult.reason)
          lastActionTime = Date.now()
        } catch (err) {
          skillRunning = false
          console.error('[mind] chat-triggered action error:', err.message)
        }
      }
    }
    else if (!result.command) {
      console.log('[mind] chat response: no command produced')
    }
  } catch (err) {
    console.error('[mind] chat response error:', err.message)
  } finally {
    _chatResponseInFlight = false
  }
}

// ── RAG Helpers (internal) ──

// formatRagContext — format retrieved chunks into a prompt section.
// Returns null if no results. Each chunk labeled with [source] attribution.
// Budget: max 2,000 tokens (~8,000 chars) per user decision.
function formatRagContext(results) {
  if (!results || results.length === 0) return null
  const lines = ['## RELEVANT KNOWLEDGE']
  for (const { chunk } of results) {
    lines.push(`[${chunk.source}] ${chunk.text}`)
    lines.push('')  // blank line between chunks
  }
  const text = lines.join('\n')
  // Enforce 2,000 token budget (~8,000 chars at 4 chars/token)
  if (text.length > 8000) return text.slice(0, 8000)
  return text
}

// deriveRagQuery — construct a RAG query from bot state and trigger context.
// Inspects health, hunger, time, position, surroundings, inventory, and recent activity
// to generate the most relevant query. Returns null only when truly nothing is relevant.
function deriveRagQuery(bot, context) {
  // ── Priority 1: Urgent survival state (always overrides other context) ──
  const health = bot.health || 20
  const food = bot.food || 20
  const time = bot.time?.timeOfDay || 0
  const pos = bot.entity?.position
  const y = pos?.y || 64

  // Low health — inject danger avoidance and recovery
  if (health <= 10) return 'danger health low healing food escape safety'

  // Low food — inject eating and food gathering
  if (food <= 10) return 'food hunger eating cooking starvation survival'

  // Night approaching or active — inject shelter and mob safety
  if (time >= 11500 && time <= 13500) return 'night shelter safety bed torches mob spawning'
  if (time >= 13500 && time <= 23000) return 'night survival mobs combat shelter darkness'

  // Deep underground — inject mining safety
  if (y < 0) return 'mining safety lava deep underground danger water bucket'
  if (y < 40 && y > 0) return 'mining ore depths tools cave safety torches'

  // ── Priority 2: Skill-specific context ──
  if (context.trigger === 'skill_complete' && context.skillName) {
    const skill = context.skillName
    const result = context.skillResult
    const target = result?.item || result?.args?.item || ''

    // Mining — include safety + tool equipping
    if (skill === 'mine') return `mine ${target} equip pickaxe tool tier safety lava never dig straight down`
    // Building — include placement rules
    if (skill === 'build' || skill === 'design') return `build place blocks placement distance materials ${target}`
    // Navigation — include movement and traversal
    if (skill === 'navigate') return `navigate movement traversal getting around terrain`
    // Gathering — include what's nearby and alternatives
    if (skill === 'gather') return `gather ${target} finding nearby biome location`
    // Crafting — include recipe chain
    if (skill === 'craft') return `craft ${target} recipe ingredients`
    // Combat — include mob-specific tactics
    if (skill === 'combat') return `combat fighting mobs damage armor weapons tactics`
    // Harvest — include crop maturity and replanting
    if (skill === 'harvest') return 'harvest mature crops wheat carrot potato replant farm bone meal'
    // Hunt — include mob drops and combat
    if (skill === 'hunt') return 'hunt hostile mobs drops bones string gunpowder ender pearl combat'
    // Explore — include biomes and structures
    if (skill === 'explore') return 'exploration biomes village temple discoveries waypoints navigation'
    // Breed — include animal farming
    if (skill === 'breed') return 'breed animals farming cows sheep pigs chickens food pen'
    // Farm — include soil preparation
    if (skill === 'farm') return 'farm hoe farmland water seeds planting crops'

    if (target) return `${skill} ${target}`
    return skill
  }

  // ── Priority 3: Inventory-based activity inference ──
  const items = bot.inventory.items().map(i => i.name)
  if (items.some(n => n.includes('_ore') || n === 'raw_iron' || n === 'raw_gold' || n === 'raw_copper')) {
    return 'smelting raw ore furnace ingots progression'
  }
  if (items.some(n => n.includes('planks') || n.includes('log'))) {
    return 'crafting tools wooden planks sticks early game progression'
  }
  if (items.length === 0) {
    return 'early game start first day punch tree wood tools survival'
  }

  // ── Priority 4: Chat trigger — inject cooperation and social rules ──
  if (context.trigger === 'chat') return 'cooperation coordination sharing resources building together'

  // ── Priority 5: General idle — inject creative/exploration ideas ──
  return 'what to do next objectives building exploration creative ideas settlement'
}

// deriveFailureQuery — precise query for a failed skill to retrieve recovery info.
function deriveFailureQuery(command, args) {
  if (command === 'craft') return `how to craft ${args?.item || 'item'} recipe ingredients`
  if (command === 'mine') return `mine ${args?.item || 'ore'} pickaxe tier required tool`
  if (command === 'smelt') return `smelt ${args?.item || 'item'} furnace fuel blast smoker`
  if (command === 'navigate') return 'stuck getting out of hole pillar up escape movement'
  if (command === 'gather') return `gather ${args?.item || 'block'} finding nearby location`
  if (command === 'build') return `build place blocks placement distance ${args?.description || 'structure'}`
  if (command === 'farm') return 'farm hoe farmland water seeds'
  if (command === 'harvest') return 'harvest mature crops age growth replant seeds'
  if (command === 'hunt') return 'hunt find hostile mobs spawn location combat'
  if (command === 'explore') return 'exploration navigation terrain biome village'
  return `${command} ${Object.values(args || {}).join(' ')}`
}

// ── Memory Retrieval (Phase 18 — MEM-02) ──

// deriveMemoryQuery — determine whether to use spatial (nearby) or temporal (recent) retrieval.
// When the bot has a known position, nearby experiences are more relevant than pure recency.
function deriveMemoryQuery(bot) {
  const pos = bot?.entity?.position
  if (pos) {
    return { mode: 'nearby', x: Math.round(pos.x), z: Math.round(pos.z) }
  }
  return { mode: 'recent', limit: 12 }
}

// retrieveMemoryContext — synchronous (better-sqlite3) — no await needed.
// Falls back to queryRecent when queryNearby returns no results at current position.
function retrieveMemoryContext(query) {
  const name = _config?.name
  if (!name) return null
  let events
  if (query.mode === 'nearby') {
    events = queryNearby(name, query.x, query.z, 50, 8)
    if (events.length === 0) events = queryRecent(name, 12)
  } else {
    events = queryRecent(name, query.limit || 12)
  }
  return formatMemoryContext(events)
}

// formatMemoryContext — formats event rows into a "Past Experiences" prompt section.
// Caps at ~1,000 tokens = 4,000 chars, independent of the RAG knowledge budget.
function formatMemoryContext(events) {
  if (!events || events.length === 0) return null
  const lines = ['## Past Experiences']
  for (const ev of events) {
    const mins = Math.round((Date.now() - ev.ts) / 60000)
    const loc = ev.x != null ? ` at ${ev.x},${ev.z}` : ''
    lines.push(`[${mins}m ago${loc}] ${ev.description}`)
  }
  const text = lines.join('\n')
  // Cap at ~1,000 tokens = 4,000 chars (independent of knowledge RAG budget)
  return text.length > 4000 ? text.slice(0, 4000) : text
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

    // ── RAG context injection (RAG-08, RAG-09) ──
    // Death > Failure > Context-aware — priority order for RAG query
    // Save death flag BEFORE consuming _lastDeath — vision check needs it later
    const hadDeath = !!_lastDeath
    let ragQuery = null
    if (_lastDeath) {
      // After death: inject recovery knowledge. Lava deaths = items burned.
      const deathStr = _lastDeath.toLowerCase()
      if (deathStr.includes('lava') || deathStr.includes('fire') || deathStr.includes('burned')) {
        ragQuery = 'died lava fire items destroyed burned gone do not recover start over'
      } else if (deathStr.includes('fell') || deathStr.includes('fall')) {
        ragQuery = 'died fall damage water bucket safety never dig straight down'
      } else {
        ragQuery = 'died death recovery respawn items despawn start over early game'
      }
      _lastDeath = null
    } else if (_lastFailure) {
      ragQuery = deriveFailureQuery(_lastFailure.command, _lastFailure.args)
      _lastFailure = null  // consume the failure
    } else {
      ragQuery = deriveRagQuery(bot, context)
    }

    // Phase 18 — MEM-02: derive memory query before async RAG retrieval
    const memQuery = deriveMemoryQuery(bot)

    let ragContext = null
    let memoryContext = null
    if (ragQuery) {
      try {
        const topK = 3  // top-3 for all context queries per user decision
        // Memory retrieval is synchronous — safe to call alongside async RAG
        memoryContext = retrieveMemoryContext(memQuery)
        const chunks = await retrieveKnowledge(ragQuery, topK)
        ragContext = formatRagContext(chunks)
        if (ragContext) {
          console.log('[mind] RAG injected:', ragQuery, `(${chunks.length} chunks)`)
        }
        if (memoryContext) {
          console.log('[mind] memory injected:', memQuery.mode)
        }
      } catch (err) {
        console.log('[mind] RAG retrieval failed (non-fatal):', err.message)
      }
    } else {
      // Even without RAG query, still inject memory context
      try {
        memoryContext = retrieveMemoryContext(memQuery)
        if (memoryContext) {
          console.log('[mind] memory injected:', memQuery.mode)
        }
      } catch { /* non-fatal */ }
    }

    // Background brain state — plan, insights, hazards from background cycle (Phase 15)
    const brainState = getBrainStateForPrompt()

    const systemPrompt = buildSystemPrompt(bot, {
      soul: _config?.soulContent,
      memory: getMemoryForPrompt(),
      players: getPlayersForPrompt(bot),
      locations: getLocationsForPrompt(bot.entity?.position),
      buildContext,
      buildHistory: getBuildHistoryForPrompt(),
      buildPlanContext: getBuildPlanForPrompt(),
      ragContext,
      memoryContext,
      brainState,
      visionContext: _lastVisionResult ? buildVisionForPrompt(_lastVisionResult) : null,
      minimapContext: getMinimapSummary(bot, 32),
      postBuildScan: _postBuildScan,
      partnerActivity: getPartnerActivityForPrompt(),
      partnerNames: _config?.partnerNames || [],
      buildLedger: getLedgerForPrompt(),
    })
    // Consume-once: clear vision and post-build scan results after injection (like _lastDeath pattern)
    _lastVisionResult = null
    _postBuildScan = null

    // Inject partner's last chat into user message if available
    const partnerChat = _config?.partnerName ? getPartnerLastChat(_config.partnerName) : null
    // COO-02 (Phase 24): per-partner chat limit warning — check current sender's count
    const senderCount = _lastChatSender
      ? (_chatCountByPartner.get(_lastChatSender) || 0)
      : 0
    // Check for async design status
    let designNotification = null
    const designInProgress = _designWorkerRunning
    if (_pendingDesignNotification) {
      designNotification = _pendingDesignNotification
      _pendingDesignNotification = null  // consume once
    }
    const userMessage = buildUserMessage(bot, context.trigger, { ...context, partnerChat, chatLimitWarning: senderCount >= 3 ? senderCount : null, designNotification, designInProgress })

    // ── Tiered Vision: render composite image for spatial actions + every Nth tick ──
    // Qwen3.5 is natively multimodal — every think() call can include an image.
    // Image is included when:
    //   1. Agent is building (active build plan or just completed build/design/plan)
    //   2. Agent is navigating, exploring, fighting, or farming (spatial actions)
    //   3. Every VISION_TICK_INTERVAL ticks as baseline visual awareness
    //   4. After death (need to assess new surroundings)
    //   5. Chat trigger is skipped (vision is wasteful for pure chat responses)
    _thinkTickCount++
    let tickImage = null
    const isSpatialTrigger = context.trigger === 'skill_complete' && [
      'navigate', 'explore', 'combat', 'hunt', 'build', 'design', 'plan',
      'farm', 'harvest', 'mine', 'gather', 'scan', 'see',
    ].includes(context.skillName)
    const hasActiveBuild = !!getActiveBuild() || !!getActivePlan()
    const isBaselineTick = (_thinkTickCount % VISION_TICK_INTERVAL) === 0
    const isAfterDeath = hadDeath  // saved before _lastDeath was consumed for RAG query
    const isChatTrigger = context.trigger === 'chat'

    if (!isChatTrigger && (isSpatialTrigger || hasActiveBuild || isBaselineTick || isAfterDeath)) {
      try {
        tickImage = renderCompositeViewSync(bot, _config?.dataDir || '')
      } catch { /* vision render failure is non-fatal */ }
    }

    console.log('[mind] thinking...', context.trigger, tickImage ? '(+image)' : '(text-only)')

    const result = await queryLLM(systemPrompt, userMessage, tickImage)

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

    // !builds — list all active build projects from the shared ledger
    if (result.command === 'builds') {
      const projects = listProjects()
      const summary = projects.length === 0
        ? 'No build projects yet. Use !design to start one.'
        : projects.map(p => {
            const pct = p.totalBlocks > 0 ? Math.round(100 * p.placedCount / p.totalBlocks) : 0
            return `${p.name} (id:${p.id}) at ${p.origin.x},${p.origin.y},${p.origin.z} — ${p.status} ${pct}% (${p.builders.join('+')})`
          }).join('\n')
      setTimeout(() => think(bot, { trigger: 'skill_complete', skillName: 'builds',
        skillResult: { success: true, reason: summary } }), 0)
      lastActionTime = Date.now()
      return
    }

    // !survey — manual terrain scan at current position
    if (result.command === 'survey') {
      const width = parseInt(result.args?.width) || 16
      const depth = parseInt(result.args?.depth) || 16
      const pos = bot.entity.position
      const survey = surveyBuildSite(bot, Math.round(pos.x), Math.round(pos.z), width, depth)
      setTimeout(() => think(bot, { trigger: 'skill_complete', skillName: 'survey',
        skillResult: { success: true, reason: survey.summary } }), 0)
      lastActionTime = Date.now()
      return
    }

    // !build id:X — resume/contribute to a specific ledger project
    if (result.command === 'build' && result.args?.id) {
      const projectId = result.args.id
      const project = getProject(projectId)
      if (!project) {
        setTimeout(() => think(bot, { trigger: 'skill_complete', skillName: 'build',
          skillResult: { success: false, reason: `Project ${projectId} not found` } }), 0)
        lastActionTime = Date.now()
        return
      }
      joinProject(projectId, bot.username)
      console.log('[mind] resuming ledger project:', projectId, project.name)
      skillRunning = true
      broadcastActivity('build', { id: projectId, name: project.name }, 'running')
      const buildResult = await build(bot, '_generated', project.origin.x, project.origin.y, project.origin.z,
        null, {
          skipOnMissing: true,
          maxBlocks: 5,  // place 5 blocks then return — agent can think/chat between batches
          onBlockPlaced: (x, y, z, block) => recordPlacement(projectId, x, y, z, block, bot.username),
          getPlacedBlocks: () => new Set(Object.keys(getProject(projectId)?.placedBlocks || {})),
        })
      skillRunning = false
      const remaining = getRemaining(projectId)
      if (remaining.length === 0) completeProject(projectId)
      if (buildResult.success) {
        recordBuild({
          name: project.name, origin: project.origin,
          dimensions: project.blueprint?.size || { x: 0, y: 0, z: 0 },
          blockCount: buildResult.placed || 0, builder: bot.username, projectId,
        })
      }
      setTimeout(() => think(bot, { trigger: 'skill_complete', skillName: 'build', skillResult: buildResult }), 0)
      lastActionTime = Date.now()
      return
    }

    // !design — queue async blueprint generation, return immediately so agent keeps playing.
    // The heavy LLM call runs in the background. Agent gets notified when blueprint is ready.
    if (result.command === 'design') {
      const description = result.args.description || ''
      if (!description) {
        console.log('[mind] !design missing description')
        lastActionTime = Date.now()
        return
      }
      // Capture position NOW (agent might move while design is generating)
      const pos = bot.entity.position
      const designOrigin = { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) }

      console.log('[mind] design queued:', description, 'at', designOrigin.x, designOrigin.y, designOrigin.z)

      // Fire and forget — runs in background, doesn't block the agent
      runDesignWorker(bot, description, designOrigin)

      // Return immediately so agent can keep playing
      lastActionTime = Date.now()
      setTimeout(() => think(bot, { trigger: 'skill_complete', skillName: 'design',
        skillResult: { success: true, reason: `Design queued: "${description}". I'll keep working while the blueprint generates. I'll be notified when it's ready.` } }), 0)
      return
    }

    // !plan — create a multi-section build plan for large structures (BLD-01, BLD-02)
    // Handled here (before dispatch) because it requires multiple LLM calls and
    // special plan management. The registry entry is only a fallback/help-text stub.
    if (result.command === 'plan') {
      const description = result.args.description || ''
      if (!description) {
        console.log('[mind] !plan missing description')
        lastActionTime = Date.now()
        return
      }
      console.log('[mind] planning build:', description)
      skillRunning = true
      const pos = bot.entity.position
      // Wrap queryLLM to use isolated mode + larger token budget for blueprint generation
      const isolatedQueryLLM = (sysPrompt, userMsg) => queryLLM(sysPrompt, userMsg, { maxTokens: 2048, isolated: true })
      const planResult = await planBuild(
        description, isolatedQueryLLM, buildDesignPrompt, validateBlueprint,
        { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) }
      )
      skillRunning = false
      console.log('[mind] plan result:', planResult.success ? `OK — ${planResult.sections} sections, ${planResult.totalBlocks} blocks` : planResult.reason)
      lastActionTime = Date.now()

      if (planResult.success) {
        // Run material audit immediately (BLD-03)
        const plan = getActivePlan()
        if (plan) {
          const inventory = bot.inventory.items().map(i => ({ name: i.name, count: i.count }))
          auditMaterials(inventory, plan)
          saveBuildPlan(plan)
          console.log('[mind] material audit:', plan.materialAudit?.ready ? 'ready to build' : 'missing materials')
        }
        addWorldKnowledge(`Planned "${description}" at ${Math.round(pos.x)},${Math.round(pos.y)},${Math.round(pos.z)} — multi-section build plan created`)
        logEvent(bot, 'build', `plan: ${description}`, { command: 'plan', success: true, planId: planResult.planId })
      }

      setTimeout(() => think(bot, { trigger: 'skill_complete', skillName: 'plan', skillResult: planResult }), 0)
      return
    }

    // !see — capture screenshot and describe via VLM
    // Handled here (before dispatch) like !design because it requires async VLM calls
    // and a consume-once result variable.
    if (result.command === 'see') {
      const focus = result.args?.focus || result.args?.description || ''
      console.log('[mind] !see triggered — rendering view')
      skillRunning = true
      const visionResult = await captureAndAnalyze(bot, _config?.dataDir || '', focus)
      skillRunning = false
      const description = visionResult?.description || null
      if (description) {
        _lastVisionResult = description
        console.log('[mind] !see result:', description.slice(0, 80))
      } else {
        console.log('[mind] !see: VLM unavailable or render failed')
      }
      lastActionTime = Date.now()
      setTimeout(() => think(bot, { trigger: 'skill_complete', skillName: 'see',
        skillResult: { success: true, reason: description || 'vision unavailable' } }), 0)
      return
    }

    // COO-03: Auto-claim build section when active plan exists and command is build
    if (result.command === 'build') {
      const activePlan = getActivePlan()
      if (activePlan?.sections?.length > 1) {
        const claimed = claimBuildSection(_config.name, activePlan.id)
        if (claimed) {
          console.log('[mind] claimed build section:', claimed.id)
        }
      }
    }

    // Anti-spam cooldown: don't send chat too rapidly (prevents ping-pong loops)
    if (result.command === 'chat' && Date.now() - _lastChatTimestamp < CHAT_COOLDOWN_MS) {
      console.log('[mind] chat cooldown active — skipping to avoid spam')
      lastActionTime = Date.now()
      return
    }

    // Chat message dedup: prevent LLM from generating the same text repeatedly
    if (result.command === 'chat' && result.args?.message) {
      const normMsg = result.args.message.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
      const isDupe = _recentSentMessages.some(prev => {
        if (normMsg === prev) return true
        // Fuzzy: if 80%+ of words overlap, it's a repeat
        const words = new Set(normMsg.split(/\s+/))
        const prevWords = prev.split(/\s+/)
        const overlap = prevWords.filter(w => words.has(w)).length
        return prevWords.length > 2 && overlap / prevWords.length > 0.8
      })
      if (isDupe) {
        console.log('[mind] suppressed duplicate chat:', result.args.message.slice(0, 60))
        clearConversation()
        lastActionTime = Date.now()
        return
      }
      _recentSentMessages.push(normMsg)
      if (_recentSentMessages.length > CHAT_DEDUP_WINDOW) _recentSentMessages.shift()
    }

    if (result.command === 'chat') {
      _lastChatTimestamp = Date.now()
      _chatResponseCount++
    } else {
      _chatResponseCount = 0  // game action resets chat counter — can chat again after doing something
    }

    // Stuck loop detection: if the same command+args failed MAX_REPEAT_FAILURES times,
    // force the agent to do something else (explore) to break out of the loop
    const repeatKey = `${result.command}:${JSON.stringify(result.args || {})}`
    if (_repeatTracker.key === repeatKey && _repeatTracker.count >= MAX_REPEAT_FAILURES) {
      console.log(`[mind] stuck loop detected — ${result.command} failed ${_repeatTracker.count}x, forcing explore`)
      _repeatTracker = { key: null, count: 0 }
      result.command = 'explore'
      result.args = {}
    }

    // Success repetition detection: catches navigate-to-same-coords, look-players-loop, etc.
    // Even if actions "succeed", doing the same thing 4+ times is a loop.
    _successRepeatHistory.push(repeatKey)
    if (_successRepeatHistory.length > SUCCESS_HISTORY_SIZE) _successRepeatHistory.shift()
    const recentSameCount = _successRepeatHistory.filter(k => k === repeatKey).length
    if (recentSameCount >= MAX_SUCCESS_REPEATS) {
      console.log(`[mind] action repeated ${recentSameCount}x — clearing history for fresh thinking`)
      _successRepeatHistory.length = 0
      _repeatTracker = { key: null, count: 0 }
      clearConversation()
      // Don't force explore — let the LLM decide with fresh context
      // It might legitimately need to repeat (gathering materials)
    }

    // Background brain hooks: check for urgent warnings from memory keeper
    try {
      const hooks = getBrainHooks()
      if (hooks.urgentWarning) {
        console.log(`[mind] memory keeper warning: ${hooks.urgentWarning}`)
      }
    } catch { /* brain hooks are non-fatal */ }

    // COO-04: Broadcast activity start before dispatch
    try {
      broadcastActivity(result.command, result.args || {}, 'running')
    } catch { /* non-fatal — partner visibility is best-effort */ }

    // Guard: if a skill is already running (from respondToChat dispatch), wait for it
    if (skillRunning) {
      console.log('[mind] dispatch deferred — skill already running from chat response')
      lastActionTime = Date.now()
      return
    }

    // Dispatch a real command to the body
    console.log('[mind] dispatching:', result.command, result.args)
    skillRunning = true
    const skillResult = await dispatch(bot, result.command, result.args)
    skillRunning = false

    console.log('[mind] skill result:', result.command, skillResult.success ? 'OK' : skillResult.reason)
    lastActionTime = Date.now()

    // COO-02 (Phase 24): per-partner chat loop prevention
    if (result.command === 'chat') {
      const key = _lastChatSender || '__broadcast__'
      _chatCountByPartner.set(key, (_chatCountByPartner.get(key) || 0) + 1)
    } else if (result.command !== 'idle') {
      // Any game action resets ALL per-partner counters and clears stale sender
      _chatCountByPartner.clear()
      _lastChatSender = null
    }

    // COO-04: Broadcast activity after every dispatch
    try {
      broadcastActivity(result.command, result.args || {}, skillResult.success ? 'complete' : 'failed')
    } catch { /* non-fatal — partner visibility is best-effort */ }

    // RAG-08: Track failures for auto-lookup on next think() cycle
    if (!skillResult.success) {
      _lastFailure = { command: result.command, args: result.args || {} }
      // Track repeated identical failures for stuck loop detection
      if (_repeatTracker.key === repeatKey) {
        _repeatTracker.count++
      } else {
        _repeatTracker = { key: repeatKey, count: 1 }
      }
    } else {
      // Success clears the repeat tracker
      _repeatTracker = { key: null, count: 0 }
    }

    // Log successful dispatches to the SQLite event log (Phase 17 — MEM-01/MEM-03/SPA-03)
    if (skillResult.success) {
      const EVT_MAP = { build: 'build', design: 'build', mine: 'discovery', gather: 'discovery', combat: 'combat', craft: 'craft', smelt: 'craft', chat: 'social', navigate: 'movement', harvest: 'craft', hunt: 'combat', explore: 'discovery', breed: 'observation', farm: 'craft' }
      const evtType = EVT_MAP[result.command] || 'observation'
      logEvent(bot, evtType, `${result.command}: ${JSON.stringify(result.args || {}).slice(0, 120)}`, { command: result.command, success: true })
      // Log each explore discovery as a separate spatial event (GPL-04)
      if (result.command === 'explore' && skillResult.discoveries?.length > 0) {
        for (const disc of skillResult.discoveries) {
          logEvent(bot, 'discovery', `explore: found ${disc.name} at ${disc.x},${disc.z}`, { command: 'explore', type: disc.type, name: disc.name, x: disc.x, z: disc.z })
        }
      }
    }

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
      // SPA-02: post-build scan for verification
      try {
        const pbx = parseInt(bx), pby = parseInt(by), pbz = parseInt(bz)
        if (!isNaN(pbx) && !isNaN(pby) && !isNaN(pbz)) {
          const scanResult = scanArea(bot, pbx - 2, pby, pbz - 2, pbx + 12, pby + 10, pbz + 12)
          if (scanResult.success) {
            _postBuildScan = `Post-build scan: ${scanResult.total} solid blocks — ` +
              Object.entries(scanResult.blocks)
                .filter(([k]) => k !== 'air' && k !== 'unloaded')
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([k, v]) => `${k}*${v}`)
                .join(', ')
          }

          // BLD-04/SPA-02: Blueprint-aware verification — diff placed blocks against expected
          const activePlan = getActivePlan()
          if (activePlan) {
            const activeSection = activePlan.sections.find(s => s.status === 'active')
            if (activeSection && activeSection.blueprintFile) {
              try {
                const { Vec3 } = await import('vec3')
                const sectionBp = JSON.parse(readFileSync(activeSection.blueprintFile, 'utf-8'))
                const expectedMap = buildExpectedBlockMap(sectionBp, pbx, pby, pbz)
                const repairs = []
                for (const [coordKey, blockName] of expectedMap.entries()) {
                  const [cx, cy, cz] = coordKey.split(',').map(Number)
                  const actual = bot.blockAt(new Vec3(cx, cy, cz))
                  if (!actual || actual.name === 'air') {
                    repairs.push({ x: cx, y: cy, z: cz, block: blockName, issue: 'missing' })
                  } else if (actual.name !== blockName) {
                    repairs.push({ x: cx, y: cy, z: cz, block: blockName, issue: 'wrong_type', found: actual.name })
                  }
                }
                if (repairs.length > 0) {
                  _postBuildScan = `Build verification: ${repairs.length} blocks need repair.\n` +
                    repairs.slice(0, 10).map(r => `  ${r.issue}: ${r.block} at ${r.x},${r.y},${r.z}${r.found ? ' (found: ' + r.found + ')' : ''}`).join('\n')
                  // BLD-05: Track repair attempts — increment counter, skip section after 3 failures
                  activeSection.repairAttempts = (activeSection.repairAttempts || 0) + 1
                  if (activeSection.repairAttempts >= 3) {
                    activeSection.status = 'done'
                    console.log(`[mind] section ${activeSection.id} — marking done after 3 repair attempts (${repairs.length} blocks unrepairable)`)
                  }
                  saveBuildPlan(activePlan)
                } else {
                  // Section is perfect — mark done and advance
                  activeSection.status = 'done'
                  saveBuildPlan(activePlan)
                  console.log(`[mind] section ${activeSection.id} verified OK — marked done`)
                  // Check if all sections done
                  if (activePlan.sections.every(s => s.status === 'done')) {
                    activePlan.status = 'done'
                    saveBuildPlan(activePlan)
                    _postBuildScan = `BUILD PLAN COMPLETE: "${activePlan.description}" — all ${activePlan.sections.length} sections verified.`
                  }
                }
              } catch (err) {
                console.log('[mind] blueprint diff failed (non-fatal):', err.message)
              }
            }
          }
        }
      } catch { /* non-fatal */ }
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

// runDesignWorker — async background design worker. Runs the full design pipeline
// without blocking the main think loop. Sets _pendingDesignNotification when done.
async function runDesignWorker(bot, description, origin) {
  if (_designWorkerRunning) {
    console.log('[design-worker] already running, rejecting:', description)
    _pendingDesignNotification = `Design rejected — another design is already in progress. Wait for it to finish.`
    return
  }
  _designWorkerRunning = true
  console.log('[design-worker] starting:', description)
  broadcastActivity('design', { description }, 'running')

  try {
    const designResult = await designAndBuild(bot, description, origin)

    if (designResult.success) {
      const pId = designResult.projectId || ''
      _pendingDesignNotification = `"${designResult.name}" designed! ${designResult.totalBlocks} blocks. Use !build id:${pId} to start building.`

      // Record in memory systems
      addWorldKnowledge(`Designed "${description}" at ${origin.x},${origin.y},${origin.z} [project:${pId}]`)
      logEvent(bot, 'build', `design: ${description}`, { command: 'design', success: true, projectId: pId })
      saveLocation('custom_build', origin.x, origin.y, origin.z, 'build')
      const project = pId ? getProject(pId) : null
      const dims = project?.blueprint?.size || { x: 0, y: 0, z: 0 }
      recordBuild({
        name: description,
        origin,
        dimensions: dims,
        blockCount: designResult.totalBlocks || 0,
        builder: bot.username,
        projectId: pId,
      })

      // Tell partner via chat
      bot.chat(`Blueprint ready: "${designResult.name}" (${designResult.totalBlocks} blocks) at ${origin.x},${origin.y},${origin.z}`)

      console.log('[design-worker] complete:', pId, designResult.name, designResult.totalBlocks, 'blocks')
    } else {
      _pendingDesignNotification = `Design failed: ${designResult.reason}. Try again with a simpler description.`
      console.log('[design-worker] failed:', designResult.reason)
    }
  } catch (err) {
    _pendingDesignNotification = `Design error: ${err.message}. Try again.`
    console.error('[design-worker] error:', err.message)
  } finally {
    _designWorkerRunning = false
    broadcastActivity('design', { description }, 'complete')
  }
}

// designAndBuild(bot, description) — orchestrates the full !design pipeline:
//   1. Survey terrain at build site
//   2. Select reference blueprints from BLUEPRINTS_DIR
//   3. Build a design prompt WITH terrain data
//   4. LLM call to generate blueprint JSON
//   5. Extract, validate, write to _generated.json
//   6. Create project in shared build ledger
//   7. Auto-execute incremental build with ledger callbacks
//
// Returns the build result { success, projectId, ... } or { success: false, reason }.
export async function designAndBuild(bot, description, origin = null) {
  const originX = origin ? origin.x : Math.round(bot.entity.position.x)
  const originY = origin ? origin.y : Math.round(bot.entity.position.y)
  const originZ = origin ? origin.z : Math.round(bot.entity.position.z)

  // ── 1. Survey terrain at build site ──
  const survey = surveyBuildSite(bot, originX, originZ, 16, 16)
  console.log('[mind] terrain survey:', survey.summary)

  // ── 2. Select reference blueprints ──
  let refs = []
  try {
    const files = readdirSync(BLUEPRINTS_DIR)
      .filter(f => f.endsWith('.json') && f !== '_generated.json')
    const shuffled = files.sort(() => Math.random() - 0.5).slice(0, 3)
    for (const f of shuffled) {
      try {
        const raw = readFileSync(join(BLUEPRINTS_DIR, f), 'utf-8')
        const bp = JSON.parse(raw)
        refs.push({ name: bp.name || f.replace('.json', ''), json: JSON.stringify(bp, null, 2) })
      } catch {}
    }
  } catch (err) {
    console.log('[mind] designAndBuild: could not read blueprints dir:', err.message)
  }

  // ── 3. Build design prompt WITH terrain data ──
  const designPrompt = buildDesignPrompt(description, refs, survey)

  // ── 4. Dedicated LLM call ──
  let result
  try {
    result = await queryLLM(designPrompt, 'Generate the blueprint now.', { maxTokens: 2048, isolated: true })
  } catch (err) {
    return { success: false, reason: `LLM call failed: ${err.message}` }
  }

  // ── 5. Extract + validate JSON ──
  const stripped = (result.raw || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  let jsonString = null
  try {
    JSON.parse(stripped)
    jsonString = stripped
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/)
    if (match) {
      try { JSON.parse(match[0]); jsonString = match[0] } catch { jsonString = null }
    }
  }
  if (!jsonString) return { success: false, reason: 'LLM did not produce valid JSON' }

  const validation = validateBlueprint(jsonString)
  if (!validation.valid) {
    return { success: false, reason: 'Blueprint validation failed: ' + validation.errors.join('; ') }
  }

  // Write to _generated.json for build() compatibility
  const generatedPath = join(BLUEPRINTS_DIR, '_generated.json')
  try { writeFileSync(generatedPath, jsonString) } catch (err) {
    return { success: false, reason: `Failed to write generated blueprint: ${err.message}` }
  }

  // ── 6. Create project in shared build ledger ──
  const blueprint = JSON.parse(jsonString)
  const project = createProject(
    blueprint.name || description.slice(0, 30),
    description,
    { x: originX, y: originY, z: originZ },
    blueprint,
    bot.username
  )
  console.log('[mind] created build project:', project.id, project.name)

  // Don't auto-build — return the project so the agent can chat/plan first, then !build when ready.
  // This keeps !design to ~15s (survey + LLM + validate) instead of minutes.
  const remaining = getRemaining(project.id)
  return {
    success: true,
    projectId: project.id,
    name: blueprint.name || description,
    totalBlocks: remaining.length,
    reason: `Designed "${blueprint.name || description}" (${remaining.length} blocks). Use !build id:${project.id} to start building.`,
  }
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
  //   - The bot's own messages echoed back are filtered by username match
  //   - System messages (death, join/leave) have sender=null — pass through for awareness
  bot.on('messagestr', (msgStr, position, jsonMsg, sender) => {
    // System messages (deaths, server announcements) — inject as context, don't trigger chat response
    if (!sender) {
      // Death messages contain "was slain", "was killed", "drowned", "blew up", "fell", etc.
      const isDeathMsg = /was (slain|killed|shot|blown|pummeled)|drowned|fell|burned|died|went off|hit the ground|experienced kinetic/.test(msgStr)
      if (isDeathMsg) {
        console.log('[mind] death message:', msgStr)
      }
      return
    }

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

    // Two-agent mode: every message from the other person triggers a response
    respondToChat(bot, username, msgStr)
  })

  // ── Trigger 2: Skill complete ──
  // Handled via setTimeout(0) inside think() after dispatch() returns (above).
  // No separate event listener needed.

  // ── Trigger 3: Idle timeout ──
  // Polls every 500ms. Fires think() if the bot has been idle for IDLE_THRESHOLD_MS.
  // Random jitter (0-2s) per agent prevents all 8 agents from thinking simultaneously,
  // which would cause vLLM to batch all requests into one burst.
  const IDLE_THRESHOLD_MS = 1500 + Math.floor(Math.random() * 2000)  // 1.5-3.5s — think often with atomic skills
  idleCheckTimer = setInterval(() => {
    if (skillRunning || thinkingInFlight) return
    const idleMs = Date.now() - lastActionTime
    if (idleMs >= IDLE_THRESHOLD_MS) {
      think(bot, { trigger: 'idle', idleMs })
    }
  }, 500)

  // ── Death handler ──
  // Reset conversation history and idle timer on death.
  // Wipes context so the bot doesn't resume with stale pre-death decisions.
  // Sets _lastDeath so next think() injects death recovery RAG context.
  bot.on('death', () => {
    const deathMsg = bot.game?.lastDeathMessage || 'unknown cause'
    console.log('[mind] bot died:', deathMsg, '— clearing conversation')
    clearConversation()
    recordDeath(deathMsg)
    logEvent(bot, 'death', deathMsg, { cause: deathMsg })
    _lastDeath = deathMsg
    lastActionTime = Date.now()
  })

  // Auto-set shared home at spawn so all agents cluster together
  if (!getHome() && bot.entity?.position) {
    const sp = bot.entity.position
    setHome(Math.round(sp.x), Math.round(sp.y), Math.round(sp.z))
    bot.homeLocation = { x: Math.round(sp.x), y: Math.round(sp.y), z: Math.round(sp.z) }
    console.log('[mind] auto-set home to spawn:', Math.round(sp.x), Math.round(sp.y), Math.round(sp.z))
  }

  console.log('[mind] initialized — listening for chat, skill complete, idle')
}
