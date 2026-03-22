// index.js -- Event-driven Mind loop: chat/skill/idle -> think() -> dispatch()

import { queryLLM, clearConversation } from './llm.js'
import { buildSystemPrompt, buildUserMessage } from './prompt.js'
import { dispatch } from './registry.js'

// ── Module-level Guard State ──

let lastActionTime = Date.now()
let skillRunning = false
let thinkingInFlight = false
let idleCheckTimer = null

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
  if (thinkingInFlight) return
  thinkingInFlight = true

  try {
    const systemPrompt = buildSystemPrompt(bot)
    const userMessage = buildUserMessage(bot, context.trigger, context)

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

    // Dispatch a real command to the body
    console.log('[mind] dispatching:', result.command, result.args)
    skillRunning = true
    const skillResult = await dispatch(bot, result.command, result.args)
    skillRunning = false

    console.log('[mind] skill result:', result.command, skillResult.success ? 'OK' : skillResult.reason)
    lastActionTime = Date.now()

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
  }
}

// ── Exported Init Function ──

// initMind(bot) — registers event listeners on the bot and starts the idle timer.
// Call once after createBot() resolves.
export async function initMind(bot) {
  // ── Trigger 1: Chat received ──
  // Fire think() when a player sends a chat message.
  // Filters:
  //   - Messages with no sender (system/server messages) are ignored
  //   - The bot's own messages echoed back are filtered by username match
  bot.on('messagestr', (msgStr, position, jsonMsg, sender) => {
    if (!sender || sender === bot.username) return

    // Resolve sender UUID to username — players map contains UUID → Player objects
    const username = bot.players?.[sender]?.username || sender.toString().slice(0, 8)
    // Filter bot's own messages that come back with a sender UUID
    if (username === bot.username) return

    console.log('[mind] chat from', username, ':', msgStr)
    think(bot, { trigger: 'chat', sender: username, message: msgStr })
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
    lastActionTime = Date.now()
  })

  console.log('[mind] initialized — listening for chat, skill complete, idle')
}
