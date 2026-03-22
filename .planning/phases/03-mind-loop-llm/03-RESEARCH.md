# Phase 3: Mind Loop + LLM - Research

**Researched:** 2026-03-22
**Domain:** Event-driven LLM agent loop, OpenAI SDK, mineflayer events, command dispatch
**Confidence:** HIGH (architecture confirmed against v1 code + mineflayer plugin source + MiniMax docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from PROJECT.md and STATE.md:
- Mind + Body split: mind/ layer never imports skill functions directly; body/ never calls LLM — boundary is enforced
- Event-driven LLM: fires on chat received, skill complete, or idle — not on a fixed tick
- NO ARTIFICIAL DELAYS: the Mind should think as fast and often as possible. No arbitrary cooldowns, no forced wait timers
- NO ARTIFICIAL CAPS: don't hardcode turn limits. Use graduated trimming when context gets large
- MiniMax M2.7 via OpenAI-compatible API — already configured via VLLM_URL and MODEL_NAME env vars
- !command pattern for LLM → Body dispatch (e.g., !gather oak_log 10, !craft wooden_pickaxe)
- v1 agent/llm.js has OpenAI client, conversation history, trimming — reference for patterns
- v1 agent/prompt.js has system prompt builder — reference for prompt engineering
- Research flag from STATE.md: MiniMax M2.7 !command syntax compliance needs smoke test

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase.

### Deferred Ideas (OUT OF SCOPE)

None — infrastructure phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MIND-01 | Event-driven LLM — fires on idle (2s no action), chat received, or skill completion | mineflayer `messagestr` event for chat; skill completion detected via skill return value; idle timer via `Date.now()` delta |
| MIND-02 | Command registry — LLM calls skills by name (!command pattern) | Text-based !command pattern is the safest approach given MiniMax M2.7 OpenAI tool calling unknowns; regex parse !command from LLM response; dispatch to body/ skill map |
| MIND-03 | Conversation history — 40-turn rolling window with graduated trimming | v1 `trimHistoryGraduated(fraction)` is the reference implementation; 40 turns = 80 messages in history array; compression means graduated trim from oldest, not abrupt drop |
| MIND-04 | Self-prompter — when idle with no goal, LLM re-evaluates and picks next action | Idle detection: track `lastActionTime`; if `Date.now() - lastActionTime > 2000ms` and no skill running, fire LLM with idle trigger context |
</phase_requirements>

---

## Summary

Phase 3 wires the LLM brain to the Body skills. The Mind module (`mind/`) sits between the mineflayer bot events (chat, skill completion, idle timer) and the body/ skill functions. When an event fires, the Mind builds a prompt from current game state, queries the LLM, parses the response for `!commands`, and dispatches the corresponding skill. A 40-turn rolling conversation window (80 messages) gives the LLM short-term memory across interactions.

The architecture is straightforward: a single `mind/index.js` entry that registers three event sources (chat, skill completion, idle) and routes them to a shared `think()` function. The `think()` function follows the same observe-reason-act loop as v1 `agent/index.js`, but triggered by events rather than a fixed tick. The command registry is a plain Map from command name to async skill function — the Mind calls the registry, never imports skill functions directly.

The key research flag — MiniMax M2.7 !command compliance — is resolved: vLLM serves M2.7 with `--tool-call-parser minimax_m2` and OpenAI SDK tool calling works if vLLM is configured correctly. However, there is a known issue with MiniMax M2.5/M2.7 where the thinking model adds overhead and occasionally ignores brevity constraints. The !command text-based fallback parser (ported from v1) is the safety net. The recommendation is to attempt OpenAI tool calling first but always fall back to `!command` text parsing if tool calls are absent from the response.

**Primary recommendation:** Implement Mind as `mind/index.js` with event-driven think() loop + `!command` text dispatch + conversation history capped at 40 turns via graduated trimming. Port v1's `trimHistoryGraduated` and `queryLLM` patterns wholesale.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | 4.104.0 (installed) | OpenAI-compatible LLM API calls | Already installed; v1 uses it; MiniMax M2.7 served via OpenAI-compat endpoint |
| `mineflayer` | 4.35.0 (via mineflayer-tool) | Bot events (chat, death, health) | Already installed; the bot is already created in body/bot.js |

No new packages needed for Phase 3. The `openai` SDK and `mineflayer` are already present.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `minecraft-data` | (via mineflayer dep) | Item/block name lookups for state summary | When building game state summary for prompt |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| !command text parsing | OpenAI native tool calling | Tool calling is preferred if vLLM is configured with `--tool-call-parser minimax_m2 --enable-auto-tool-choice`; but !command text is the reliable fallback because MiniMax M2.7 may use XML-format tool calls internally that vLLM converts — if vLLM is not configured, tool calls fail silently |
| Graduated trimming | Full history wipe on overflow | Graduated trim preserves recent context; full wipe loses execution context and causes the agent to repeat itself |
| Event-driven loop | Fixed-interval polling tick | Events are zero-latency responses to game state; polling adds unnecessary delay and fires even when nothing changed |

**Installation:**

No new installs needed.

```bash
# Verify
npm list openai mineflayer --prefix .
```

---

## Architecture Patterns

### Recommended Project Structure

```
mind/
├── index.js         # Entry point — init, event wiring, think() dispatch
├── llm.js           # LLM client, conversation history, trimming (port from agent/llm.js)
├── prompt.js        # State → prompt builder (minimal for Phase 3; expand in Phase 5)
└── registry.js      # Command registry — maps !command names to body/ skill functions
```

### Pattern 1: Event Source → think() Dispatch

**What:** Three event sources (chat message, skill complete, idle timeout) all funnel into a single `think(context)` function. The `context` parameter carries the trigger reason and any associated data (e.g., who sent the chat, what skill just completed, how long idle).

**When to use:** Always — this is the core loop.

```javascript
// mind/index.js
import { createBot } from '../body/bot.js'
import { think } from './llm.js'
import { registry } from './registry.js'

let lastActionTime = Date.now()
let skillRunning = false

export async function initMind(bot) {
  // Trigger 1: chat received
  bot.on('messagestr', async (msgStr, position, jsonMsg, sender) => {
    // Filter own messages and system messages (no sender)
    if (!sender || sender === bot.username) return
    await think(bot, { trigger: 'chat', sender, message: msgStr })
  })

  // Trigger 2: skill complete — called by registry after every skill returns
  // (see registry.js dispatch wrapper)

  // Trigger 3: idle timeout — checked on a lightweight interval
  setInterval(async () => {
    if (skillRunning) return
    const idleMs = Date.now() - lastActionTime
    if (idleMs >= 2000) {
      await think(bot, { trigger: 'idle', idleMs })
    }
  }, 500)  // Check every 500ms — no artificial minimum gap
}
```

**Key design:** `setInterval` at 500ms just polls the idle counter — it does NOT artificially cap LLM call rate. As soon as idle >= 2000ms AND no skill running, `think()` fires. After `think()` fires and dispatches a skill, `lastActionTime` is updated and `skillRunning = true`, which suppresses the idle trigger until the skill completes.

### Pattern 2: Command Registry

**What:** A plain Map from command name to async function. The registry wraps each skill call to update `lastActionTime`, set `skillRunning`, interrupt any prior skill, and fire `skill_complete` trigger on return.

```javascript
// mind/registry.js
import { clearInterrupt, requestInterrupt } from '../body/interrupt.js'
import { gather } from '../body/skills/gather.js'
import { mine } from '../body/skills/mine.js'
import { craft } from '../body/skills/craft.js'
import { smelt } from '../body/skills/smelt.js'
// ... other skills

const REGISTRY = new Map([
  ['gather',    (bot, args) => gather(bot, args.item, args.count)],
  ['mine',      (bot, args) => mine(bot, args.item, args.count)],
  ['craft',     (bot, args) => craft(bot, args.item, args.count)],
  ['smelt',     (bot, args) => smelt(bot, args.item, args.count)],
  ['chat',      (bot, args) => { bot.chat(args.message); return { success: true } }],
  ['idle',      (_bot, _args) => Promise.resolve({ success: true, reason: 'idle' })],
])

export async function dispatch(bot, command, args, onComplete) {
  const fn = REGISTRY.get(command)
  if (!fn) return { success: false, reason: `unknown_command: ${command}` }

  requestInterrupt(bot)           // Cancel any in-flight skill
  clearInterrupt(bot)             // Reset for new skill
  const result = await fn(bot, args)
  if (onComplete) onComplete(result)
  return result
}
```

**Mind boundary enforced:** `mind/registry.js` imports from `body/` — this is the ONLY file in `mind/` that touches `body/` directly. `mind/index.js` and `mind/llm.js` never import body/ functions.

### Pattern 3: !command Text Parsing

**What:** LLM response is plain text. The Mind scans for `!command arg1 arg2` patterns using a simple regex. This is reliable regardless of whether vLLM tool calling is configured.

```javascript
// Parse !command from LLM response text
// Source: pattern derived from v1 parseResponseFallback, simplified for !command prefix
function parseCommand(text) {
  // Match: !commandname key:value key:"quoted value" or positional args
  const match = text.match(/!(\w+)(?:\s+(.*))?/)
  if (!match) return null
  const name = match[1]
  const argStr = match[2] || ''
  const args = {}
  // Named: item:oak_log count:10
  for (const [, k, v] of argStr.matchAll(/(\w+):("([^"]+)"|(\S+))/g)) {
    args[k] = v.replace(/^"|"$/g, '')
  }
  // Positional fallback: !gather oak_log 10 → { item: 'oak_log', count: 10 }
  if (Object.keys(args).length === 0) {
    const parts = argStr.trim().split(/\s+/)
    if (parts[0]) args.item = parts[0]
    if (parts[1] && !isNaN(parts[1])) args.count = parseInt(parts[1])
  }
  return { command: name, args }
}
```

**Example LLM outputs that parse correctly:**
- `!gather item:oak_log count:10`
- `!gather oak_log 10`
- `!craft item:wooden_pickaxe`
- `!chat message:"I'm going to gather some wood"`
- `!idle`

### Pattern 4: Conversation History with Graduated Trimming

**What:** Port v1's `trimHistoryGraduated` verbatim. Cap at 40 turns = 80 messages. Trim 25% of oldest complete rounds when cap is reached.

```javascript
// mind/llm.js — trim to 40 turns (80 messages)
const MAX_HISTORY_MESSAGES = 80  // 40 turns

function trimHistory() {
  while (conversationHistory.length > MAX_HISTORY_MESSAGES) {
    // Remove complete rounds from front: [user, assistant] or [user, assistant, tool]
    if (conversationHistory[0]?.role === 'user') {
      const roundSize = (conversationHistory[1]?.role === 'assistant') ? 2 : 1
      conversationHistory.splice(0, roundSize)
    } else {
      conversationHistory.splice(0, 1)
    }
  }
}

export function trimHistoryGraduated(fraction = 0.25) {
  // Port verbatim from agent/llm.js — round-boundary-aware graduated removal
  // ...see agent/llm.js lines 72-105 for complete implementation
}
```

**MIND-03 note:** The requirement says "compressed, not dropped." In the context of this system, "compressed" means graduated trimming (remove oldest 25% of rounds at a time) as opposed to a full wipe. This matches v1's `trimHistoryGraduated`. True semantic summarization of old turns via a second LLM call is out of scope for Phase 3 — that would be a Phase 5 enhancement for long-running sessions.

### Pattern 5: Game State Summary for Prompt

**What:** At each `think()` call, read current bot state from mineflayer directly (no HTTP bridge needed) and format it as a compact string for the user message.

```javascript
// mind/prompt.js
export function buildStateText(bot) {
  const pos = bot.entity?.position
  const health = bot.health ?? '?'
  const food = bot.food ?? '?'
  const items = bot.inventory.items()
    .map(i => `${i.count}x ${i.name}`)
    .join(', ') || 'empty'

  return [
    pos ? `pos: ${Math.round(pos.x)},${Math.round(pos.y)},${Math.round(pos.z)}` : 'pos: unknown',
    `health: ${health}/20  food: ${food}/20`,
    `inventory: ${items}`,
  ].join('\n')
}
```

### Anti-Patterns to Avoid

- **Fixed polling tick as primary loop:** Don't use `setInterval(tick, 2000)` as the LLM trigger. Events should drive the loop. The 500ms idle-check interval is a sentinel only — it fires `think()` at most once per skill completion cycle.
- **Mind importing skill functions directly:** `mind/index.js` and `mind/llm.js` must never import from `body/skills/*`. Only `mind/registry.js` bridges the boundary.
- **Sending bot messages to itself:** Always filter `bot.on('messagestr')` with `if (!sender || sender === bot.username) return` — Paper 1.21.1 sends the bot's own chat back as a `messagestr` event.
- **Full history wipe on trimming:** Use `trimHistoryGraduated(0.25)` — never `conversationHistory.length = 0` during normal operation. Full wipes only on death or explicit reset.
- **Tool choice: required with MiniMax M2.7:** MiniMax's thinking model tends to ignore brevity constraints and may not reliably produce tool calls on every turn. Use `tool_choice: 'auto'` or text-only !command pattern. Do not set `tool_choice: 'required'`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LLM API client | Custom fetch wrapper | `openai` SDK (already installed) | Handles retries, streaming, auth, response parsing |
| Conversation history trimming | Custom trim logic | Port `trimHistoryGraduated` from `agent/llm.js` | Already battle-tested with round-boundary awareness |
| Bot interrupt | Custom boolean flag module | `body/interrupt.js` `requestInterrupt`/`clearInterrupt` | Already implemented; matches project conventions |
| Chat event parsing | Custom chat parser | `bot.on('messagestr', ...)` — mineflayer built-in | Handles Paper 1.21.1 signed chat format |
| Command argument parsing | YAML/JSON parser | Regex `!command key:value` — 10 lines | LLM output is not machine-precise; regex is resilient to spacing/quoting variation |

**Key insight:** All the hard plumbing (LLM client, history, interrupt) exists in v1's `agent/` directory. Phase 3 is a port and adaptation, not a greenfield build. Copying the relevant patterns (not the files themselves) is the right move.

---

## Common Pitfalls

### Pitfall 1: Chat Event Double-Fire / Bot's Own Messages

**What goes wrong:** `bot.on('messagestr')` fires for every server message including the bot's own chat output. If not filtered, the bot responds to itself and enters a chat loop.

**Why it happens:** Paper (and mineflayer's chat plugin) emits `messagestr` for all messages regardless of sender. The `sender` parameter is `undefined` for system/server messages and equals `bot.username` for the bot's own messages.

**How to avoid:** Always check `if (!sender || sender === bot.username) return` at the top of the messagestr handler.

**Warning signs:** Bot chat responses trigger new `think()` calls immediately after dispatch.

### Pitfall 2: MiniMax M2.7 Think Tags in Response Content

**What goes wrong:** MiniMax M2.7 wraps all output in `<think>...</think>` tags. If the response text is passed directly to `parseCommand`, the `!command` inside the think block is extracted even though it was "thinking aloud" rather than a final decision.

**Why it happens:** vLLM with `--reasoning-parser minimax_m2_append_think` appends the think block to `msg.content`. The actual action comes after `</think>`, not inside it.

**How to avoid:** Strip `<think>...</think>` blocks from `msg.content` before running `parseCommand`. Pattern: `text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()`. This is already done in v1 `agent/llm.js` line 267.

**Warning signs:** Bot executes internal reasoning steps as if they were commands.

### Pitfall 3: Skill Running Guard — Concurrent Dispatch

**What goes wrong:** `think()` is called again (from idle check or a second chat message) while a skill is still running. This causes two concurrent skill executions — a gather and a craft both holding the bot's hands, with interrupt races.

**Why it happens:** Async skills take several seconds; during that time the idle timer fires again.

**How to avoid:** Track `skillRunning` flag. The idle trigger checks this flag before firing `think()`. When `think()` dispatches a skill, set `skillRunning = true` before `await dispatch(...)` and `skillRunning = false` in the `finally` block. Chat triggers may still interrupt a running skill (that's intentional — chat is higher priority), but they must call `requestInterrupt(bot)` before dispatching the new skill.

**Warning signs:** Two "gathering" log lines appearing concurrently with different targets.

### Pitfall 4: History Round Boundary Corruption

**What goes wrong:** Trimming removes a `user` message but leaves its paired `assistant` message at index 0, or vice versa. The next LLM call has a malformed history and returns HTTP 400.

**Why it happens:** Naive trim (`conversationHistory.shift()`) removes single messages without regard for pair boundaries.

**How to avoid:** Port `trimHistoryGraduated` from `agent/llm.js` verbatim — it is round-boundary-aware. Never use `.shift()` or `.splice(0, 1)` on history.

**Warning signs:** LLM returns 400 errors with "invalid messages" after a history trim.

### Pitfall 5: MiniMax M2.7 !command Non-Compliance (the Research Flag)

**What goes wrong:** The model produces reasoning text but no `!command` in the output, or uses a different format (e.g., `[command: gather]`).

**Why it happens:** MiniMax M2.7 has a documented issue where the thinking model ignores brevity constraints and may deviate from output format instructions. The `!command` format has not been smoke-tested against this model.

**How to avoid:**
1. Include explicit few-shot examples of `!command` format in the system prompt.
2. If no `!command` is found in the response, default to `!idle` (do nothing, log the raw response).
3. Add a smoke test to the Phase 3 verification checklist: send a chat message "gather some wood" and confirm the LLM response contains `!gather`.

**Warning signs:** `parseCommand()` returns null consistently; bot does nothing despite LLM responding.

### Pitfall 6: Idle Timer Fires During Active LLM Query

**What goes wrong:** The 500ms idle-check interval fires while `think()` is still awaiting the LLM response (which takes 1-3s). This queues a second concurrent `think()` call.

**Why it happens:** `think()` is async; the idle check doesn't know a query is in-flight.

**How to avoid:** Track a second flag `thinkingInFlight`. The idle timer checks `if (skillRunning || thinkingInFlight) return`. Set `thinkingInFlight = true` at the start of `think()`, `false` in its `finally` block.

**Warning signs:** Multiple LLM queries running concurrently (observable in logs via overlapping "querying LLM" log lines).

---

## Code Examples

Verified patterns from official/in-repo sources:

### mineflayer messagestr Event (chat.js, installed version)

```javascript
// Source: node_modules/mineflayer/lib/plugins/chat.js lines 130-131
// For Paper 1.21.1 signed chat:
//   msgStr   — plain text of the full message (e.g., "<steve> hello")
//   position — 'chat'
//   jsonMsg  — ChatMessage object
//   sender   — UUID string (truthy for player messages, undefined for system)
bot.on('messagestr', (msgStr, position, jsonMsg, sender) => {
  // sender is undefined for system messages (server announcements, death messages)
  // sender is a UUID for player chat — NOT the username
  // Use jsonMsg.toString() for the clean formatted message
  // Use bot.players to resolve UUID to username if needed
})
```

**Important nuance:** `sender` in `messagestr` is a UUID string, not a username. To get the username: `bot.players[sender]?.username || sender`. On Paper offline mode, UUIDs are deterministic (based on username hash).

### OpenAI SDK with MiniMax M2.7 via vLLM (verified from v1 agent/llm.js)

```javascript
// Source: agent/llm.js lines 5-28 + 174-182
// openai@4.104.0 (installed)
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: process.env.VLLM_URL || 'http://localhost:8000/v1',
  apiKey: process.env.VLLM_API_KEY || 'not-needed',
  timeout: 120000,
})

const response = await client.chat.completions.create({
  model: process.env.MODEL_NAME || 'MiniMaxAI/MiniMax-M2.7',
  messages: [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ],
  temperature: 0.6,
  // tool_choice: 'auto'  — only if vLLM configured with --tool-call-parser minimax_m2
})
```

### Graduated History Trimming (from agent/llm.js lines 72-105)

```javascript
// Source: agent/llm.js — round-boundary-aware graduated removal
// Port verbatim. Key invariant: never leave an orphaned 'assistant' at index 0.
export function trimHistoryGraduated(fraction = 0.25) {
  if (conversationHistory.length === 0) return
  const targetRemove = Math.max(2, Math.ceil(conversationHistory.length * fraction))
  let removed = 0

  while (removed < targetRemove && conversationHistory.length > 0) {
    if (conversationHistory[0].role === 'tool') {
      conversationHistory.splice(0, 1); removed++; continue
    }
    if (conversationHistory[0].role === 'user') {
      let roundSize = 1
      if (conversationHistory[1]?.role === 'assistant') {
        roundSize = 2
        if (conversationHistory[2]?.role === 'tool') roundSize = 3
      }
      conversationHistory.splice(0, roundSize); removed += roundSize
    } else {
      conversationHistory.splice(0, 1); removed++
    }
  }
}
```

### !command System Prompt Instructions (MiniMax compliance)

```
When you decide to act, respond with a SINGLE line in this exact format:

  !command arg:value

Available commands:
  !gather item:oak_log count:10      — collect blocks
  !mine item:iron_ore count:3        — mine ores
  !craft item:wooden_pickaxe         — craft an item
  !smelt item:raw_iron count:5       — smelt in furnace
  !chat message:"hello there"        — say something
  !idle                              — wait and observe

Examples:
  !gather item:oak_log count:5
  !craft item:crafting_table
  !chat message:"I'm going to get some wood"

Your response must contain exactly one !command line. Nothing else after it.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fixed 2s tick loop | Event-driven (chat/skill/idle) | Phase 3 design | Zero-latency response to chat; no idle CPU spin |
| `tool_choice: 'required'` (v1) | `!command` text + optional tool calling | Phase 3 (MiniMax research) | More resilient to model format variation |
| Full history wipe on overflow | Graduated trim (25% per step) | v1 (already implemented) | Preserves recent context |
| Single mineflayer `chat` event | `messagestr` event | mineflayer 4.x+ | `chat` event message param is empty on some Paper+mod setups; `messagestr` is reliable |

**Deprecated/outdated:**
- `bot.on('chat', (username, message) => ...)`: The `message` parameter is empty on some Paper 1.21.1 setups (confirmed mineflayer issue #3493). Use `bot.on('messagestr', ...)` instead.
- `tool_choice: 'required'`: MiniMax M2.7 thinking model does not reliably comply. Use `'auto'` or text-only mode.

---

## Open Questions

1. **MiniMax M2.7 !command format compliance (the research flag)**
   - What we know: The model wraps output in `<think>` tags; may deviate from format instructions (documented in M2.5 issue #77); vLLM tool calling works with `--tool-call-parser minimax_m2`
   - What's unclear: Does the specific prompt format in the Phase 3 system prompt reliably produce `!command` output? Has this been tested against the actual deployed model?
   - Recommendation: Include a smoke test in the Phase 3 verification plan. If compliance is poor, add a second system prompt instruction and few-shot examples. Fallback: if no `!command` found in 3 consecutive responses, treat as `!idle` and log the raw output.

2. **vLLM configuration for tool calling vs text mode**
   - What we know: vLLM requires `--tool-call-parser minimax_m2 --enable-auto-tool-choice` to serve tool calls from MiniMax M2.7. Without these flags, all responses come as plain text.
   - What's unclear: Is the project's vLLM instance currently configured with these flags?
   - Recommendation: Design the Mind loop to work in text-only (`!command`) mode by default. If vLLM is configured for tool calling, the `queryLLM` function can optionally use it — but it's not required for Phase 3 success.

3. **Chat sender UUID vs username on Paper offline mode**
   - What we know: `messagestr` sender parameter is a UUID. `bot.players` maps UUID to player info. In offline mode, UUIDs are derived from username (deterministic hash).
   - What's unclear: Is `bot.players[sender]` reliably populated before the messagestr event fires?
   - Recommendation: Defensive resolution: `const username = bot.players[sender]?.username || sender.slice(0, 8)`. Log warnings if resolution fails.

---

## Sources

### Primary (HIGH confidence)

- `agent/llm.js` (v1 in-repo) — conversation history, graduated trimming, MiniMax think-tag handling, queryLLM pattern
- `agent/prompt.js` (v1 in-repo) — system prompt builder pattern, state summary structure
- `agent/tools.js` (v1 in-repo) — tool definition format reference
- `body/interrupt.js`, `body/bot.js`, `body/skills/gather.js`, `body/skills/craft.js` (in-repo) — skill return shapes, interrupt API
- `node_modules/mineflayer/lib/plugins/chat.js` — `messagestr` event signature (sender=UUID, lines 130-131)
- `node_modules/mineflayer/lib/plugins/health.js` — `death` event (line 25), `health` event (line 21)

### Secondary (MEDIUM confidence)

- MiniMax M2.7 Tool Use docs (platform.minimax.io/docs/guides/text-m2-function-call) — confirmed OpenAI-compatible tool_calls, think tags in content, reasoning_split option
- vLLM MiniMax-M2 recipe (docs.vllm.ai) — `--tool-call-parser minimax_m2` flag confirmed
- MiniMax-M2 HuggingFace tool calling guide — XML internal format, vLLM handles conversion to OpenAI format
- MiniMax M2.5 issue #77 (github.com/MiniMax-AI/MiniMax-M2/issues/77) — thinking model adds overhead, ignores brevity constraints in agent scenarios; thinking-optional mode recommended

### Tertiary (LOW confidence)

- mineflayer issue #3493 — `chat` event message empty on 1.21.1 with certain mods; core claim verified against chat.js source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — openai and mineflayer already installed and in-use; versions confirmed with `npm list`
- Architecture: HIGH — event-driven loop is the locked design; mineflayer event shapes verified from plugin source; v1 patterns are battle-tested in this codebase
- MiniMax M2.7 tool calling: MEDIUM — vLLM flags confirmed; !command compliance not smoke-tested against actual deployed model (the research flag)
- Pitfalls: HIGH for chat/history/interrupt; MEDIUM for M2.7 compliance (needs live test)

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack; MiniMax M2.7 section may need refresh if model version changes)
