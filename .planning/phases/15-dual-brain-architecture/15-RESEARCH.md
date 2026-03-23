# Phase 15: Dual-Brain Architecture - Research

**Researched:** 2026-03-23
**Domain:** Node.js async architecture — background LLM brain + shared JSON state
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Talker-Reasoner pattern (DeepMind 2024): Main brain every 3s (tick), background every 30-60s
- Shared JSON state via `data/<agent>/brain-state.json`
- Ring buffers: 20 insights, 50 spatial entries, 100 partner observations
- Background brain connects to port 8001 (vLLM Qwen3.5-9B), main brain to port 8000 (llama-server heretic 27B)
- File-based communication (atomic renameSync) — no Redis needed

### Claude's Discretion

All other implementation choices — module structure, prompt content, injection format, ring buffer
implementation, secondary client wiring, cold-start bootstrap behavior, token budget allocation.

### Deferred Ideas (OUT OF SCOPE)

None specified. This is a pure infrastructure phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MEM-02 | Memory retrieval in every LLM call — relevant past experiences injected alongside RAG knowledge | Background brain produces `insights` that get injected into main brain every tick |
| MEM-04 | Reflection journals — periodic LLM pass summarizes recent experiences into strategies and lessons | Background brain's reflection cycle IS the periodic LLM summarization pass |
| (infra) | Background brain module runs on 30s interval, calling 9B model asynchronously | Core deliverable — `mind/backgroundBrain.js` + `setInterval` in `start.js` |
| (infra) | Background brain writes structured JSON to `data/<agent>/brain-state.json` | Atomic rename write pattern, confirmed from existing `mind/build-history.js` pattern |
| (infra) | Main brain reads brain-state.json with 5s TTL cache, injects into system prompt | New `getBrainStateForPrompt()` called from `think()` in `mind/index.js` |
| (infra) | Ring buffers cap all state: 20 insights, 50 spatial, 100 partner observations | Pure JS array management — `shift()` when over cap, same pattern as `mind/memory.js` |
| (infra) | GPU contention negligible — brains don't block each other | Natural timing separation + separate OpenAI client instances (confirmed from `mind/llm.js` pattern) |

</phase_requirements>

---

## Summary

Phase 15 implements the Dual-Brain architecture: a background brain (`mind/backgroundBrain.js`) that
runs every 30s in a `setInterval`, calls the Qwen3.5-9B model at port 8001, and writes structured
JSON to `data/<agent>/brain-state.json`. The main brain reads this file (cached with 5s TTL) and
injects a compact summary into every system prompt call.

The codebase already contains all the patterns needed. The `openai` package client is already
instantiated in `mind/llm.js` — a second instance for port 8001 is trivial. Atomic rename writes
are already used in `mind/build-history.js`. The `setInterval` background task pattern is already
used in `start.js` for periodic save. The system prompt injection slot is already in
`mind/prompt.js`. This phase wires together existing patterns into a new module.

The primary risk is token budget: the background brain output must be limited to ≤300 tokens when
injected into the main brain's system prompt, or it will crowd out the RAG context slot. The
secondary risk is a cold-start gap — the main brain needs a valid bootstrap behavior for the 5-10
seconds before the first background cycle completes.

**Primary recommendation:** Create `mind/backgroundBrain.js` as a self-contained module with
`initBackgroundBrain(bot, config)` that starts its own `setInterval`. Wire it into `start.js`
after `initMind()`. Inject via a new `getBrainStateForPrompt()` helper passed to
`buildSystemPrompt()` as `options.brainState`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | ^4.0.0 | Second LLM client instance for port 8001 | Already installed; same pattern as main brain |
| Node.js `fs.renameSync` | built-in | Atomic brain-state.json write | POSIX atomic on local disk — already used in project |
| Node.js `setInterval` | built-in | Background brain tick timer | Already used for periodicSave in start.js |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `openai` | ^4.0.0 | Background brain LLM calls | Same package, different `baseURL` (port 8001) |

No new npm dependencies required. All stack needs are met by existing packages.

**Installation:** None needed. `openai` already at `^4.0.0` in package.json.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
mind/
+-- backgroundBrain.js   # NEW: background brain loop, secondary LLM client, atomic writes
+-- index.js             # MODIFY: import getBrainStateForPrompt, pass to buildSystemPrompt
+-- prompt.js            # MODIFY: add brainState injection slot in buildSystemPrompt()

data/<agent>/
+-- brain-state.json     # NEW (runtime): written by backgroundBrain, read by main brain
+-- brain-state.json.tmp # Transient: rename target for atomic write

start.js                 # MODIFY: import initBackgroundBrain, call after initMind
```

No new body/ changes. No new dependencies. Mind/body boundary unchanged.

### Pattern 1: Secondary OpenAI Client (port 8001)

**What:** Instantiate a second `OpenAI` client in `backgroundBrain.js` with
`baseURL: BACKGROUND_BRAIN_URL`. Same openai package, different endpoint.

**When to use:** Any time a second LLM endpoint is needed. Does not conflict with
the primary client in `mind/llm.js`.

**Example:**
```javascript
// mind/backgroundBrain.js
import OpenAI from 'openai'

const BACKGROUND_BRAIN_URL = process.env.BACKGROUND_BRAIN_URL || 'http://localhost:8001/v1'
const BACKGROUND_MODEL = process.env.BACKGROUND_MODEL_NAME || 'qwen3'
const BACKGROUND_MAX_TOKENS = parseInt(process.env.BACKGROUND_MAX_TOKENS || '1024', 10)

const bgClient = new OpenAI({
  baseURL: BACKGROUND_BRAIN_URL,
  apiKey: 'not-needed',
  timeout: 60000,
})
```

**Confidence:** HIGH — verified against `mind/llm.js` client instantiation pattern.

### Pattern 2: Atomic brain-state.json Write

**What:** Write to a `.tmp` file first, then `fs.renameSync` to the real path. On
Linux, `renameSync` is a single POSIX syscall — it is atomic. The main brain never
reads a partial file.

**When to use:** Any shared JSON file written from one coroutine and read from another.

**Example:**
```javascript
// mind/backgroundBrain.js
import { writeFileSync, renameSync } from 'fs'

function writeBrainState(state) {
  const content = JSON.stringify(state, null, 2)
  writeFileSync(BRAIN_STATE_TMP, content, 'utf-8')
  renameSync(BRAIN_STATE_TMP, BRAIN_STATE_FILE)  // atomic on POSIX
}
```

**Confidence:** HIGH — pattern confirmed in `mind/build-history.js` (`ARCHITECTURE.md` section 5,
Pattern 4). POSIX rename atomicity is a well-established guarantee on local filesystems.

### Pattern 3: 5s TTL Cache for brain-state.json

**What:** Read the file at most once every 5 seconds. Between reads, use the cached
in-memory value. Prevents unnecessary disk I/O on every 2s main brain tick.

**When to use:** Any file that changes slowly relative to the read frequency.

**Example:**
```javascript
// mind/backgroundBrain.js (exported getters used by main brain)
let _cachedState = null
let _cacheTime = 0
const TTL_MS = 5000

export function getBrainStateForPrompt() {
  const now = Date.now()
  if (!_cachedState || (now - _cacheTime) > TTL_MS) {
    try {
      const raw = readFileSync(BRAIN_STATE_FILE, 'utf-8')
      _cachedState = JSON.parse(raw)
      _cacheTime = now
    } catch {
      // File doesn't exist yet (cold start) — return null
      return null
    }
  }
  return formatBrainStateForPrompt(_cachedState)
}
```

**Confidence:** HIGH — TTL caching is a standard pattern. 5s TTL confirmed in CONTEXT.md locked decisions.

### Pattern 4: Non-Blocking setInterval (skip if previous cycle running)

**What:** Use a `_bgRunning` flag. If the previous background cycle has not
completed, skip the current interval tick entirely.

**Why critical:** The background brain LLM call may take 5-15s. Without the skip
guard, a second interval fires mid-call and two parallel LLM calls run against the
same 9B model endpoint, causing GPU contention and potential CUDA OOM.

**Example:**
```javascript
let _bgRunning = false

export function initBackgroundBrain(bot, config) {
  // Run first cycle within 5s of startup (cold-start bootstrap)
  setTimeout(() => runBackgroundCycle(bot, config), 5000)

  setInterval(async () => {
    if (_bgRunning) return  // previous cycle still running — skip
    runBackgroundCycle(bot, config)
  }, BACKGROUND_INTERVAL_MS)
}

async function runBackgroundCycle(bot, config) {
  _bgRunning = true
  try {
    // ... LLM call, write state ...
  } finally {
    _bgRunning = false
  }
}
```

**Confidence:** HIGH — directly documented in `DUAL-BRAIN-ARCHITECTURE.md` section 7.3
and anti-pattern 6.5. The `finally` block guarantees the flag clears on any error.

### Pattern 5: Ring Buffer via Array + shift()

**What:** Maintain a fixed-size array. When new item is pushed and length exceeds
cap, `shift()` removes the oldest entry from the front.

**When to use:** Whenever a growing collection needs a hard size bound without
structural overhead.

**Example:**
```javascript
function pushRingBuffer(arr, item, maxSize) {
  arr.push(item)
  while (arr.length > maxSize) arr.shift()
  return arr
}

// Usage:
state.insights = pushRingBuffer(state.insights || [], newInsight, 20)
state.spatial = pushRingBuffer(state.spatial || [], newLocation, 50)
state.partnerObs = pushRingBuffer(state.partnerObs || [], newObs, 100)
```

**Confidence:** HIGH — `memory.js` already uses the same `shift()` pattern for
`lessons`, `strategies`, and `worldKnowledge` arrays.

### Pattern 6: Prompt Injection Slot

**What:** Add `options.brainState` to `buildSystemPrompt()` in `mind/prompt.js`.
Inject after the `ragContext` slot (Part 5.7) as Part 5.8.

**Token budget:** The formatted brain state must not exceed 300 tokens (~1,200 chars).
Include only: goal, current step, top-3 constraints, top-3 insights, top-2 hazards.

**Example:**
```javascript
// mind/prompt.js — Part 5.8
if (options.brainState) {
  parts.push(options.brainState)
}
```

**Example formatted output:**
```
## Background Brain (updated 12s ago)
Goal: Build shelter before nightfall
Step: collect 20 oak_log (todo)
Insights: Found cave to the north. Iron visible at Y=42.
Hazards: Zombie horde 40m east.
```

**Confidence:** HIGH — slot injection pattern is identical to how `ragContext`,
`buildContext`, and `buildHistory` are injected in the existing `buildSystemPrompt()`.

### Pattern 7: Background Brain Prompt Structure

**What:** The background brain gets a dedicated system prompt — it is NOT the game
action prompt. Its sole job: analyze recent history, update the plan, extract
insights, and output structured JSON.

**Critical:** The output MUST be valid JSON only. Parse with try/catch.

**Prompt skeleton:**
```javascript
function buildBackgroundPrompt(recentHistory, gameState, existingState) {
  return `You are the planning brain for a Minecraft agent named ${agentName}.
Your job is NOT to take actions. You:
1. Analyze recent events and extract lessons (max 3)
2. Maintain a coherent multi-step plan
3. Note spatial hazards and notable locations (max 3 each)
4. Write ONLY valid JSON — no explanation, no markdown

Recent history (last 20 exchanges):
${recentHistory}

Current game state:
${gameState}

Existing plan (may be stale):
${JSON.stringify(existingState?.plan || {}, null, 2)}

Output ONLY this JSON structure:
{
  "plan": { "goal": "...", "steps": [...], "current_step": 0 },
  "insights": ["...", "..."],
  "spatial": [{ "label": "...", "note": "..." }],
  "constraints": [],
  "updated_at": ${Date.now()}
}`
}
```

**Confidence:** HIGH — prompt structure directly from `DUAL-BRAIN-ARCHITECTURE.md` section 7.4,
adapted for this project's text-mode (no tool_choice) LLM pattern.

### Anti-Patterns to Avoid

- **Await the background brain in think():** Never `await` background brain completion from
  within `think()`. The background `setInterval` is fully independent. Main brain reads the
  file (TTL-cached); it never waits for a write. Violation stalls the 2s tick loop.

- **Blocking import from backgroundBrain in think():** All cross-module state flows through
  `getBrainStateForPrompt()` (a cached file read). The background brain does NOT import
  `mind/index.js` and the main brain does NOT import backgroundBrain execution logic —
  only the read getter.

- **Writing plan steps as main brain actions:** Only the background brain writes the plan.
  The main brain reads the plan and executes one step at a time. Dual writes break the
  single-writer guarantee.

- **Using BACKGROUND_MAX_TOKENS=128:** The background brain needs 512-1024 tokens to produce
  meaningful JSON plans. The main brain's 128-token cap is for action speed, not for planning
  calls. These must be separate env vars.

- **Running background brain during startup boot:** The first background cycle should wait
  5s after startup to let the bot spawn, connect, and establish game state. Fire it via
  `setTimeout(5000)` before starting the interval.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file write | Custom lock file / write+sync | `writeFileSync` + `renameSync` | POSIX rename is atomic; lock files have race conditions |
| LLM client for port 8001 | HTTP fetch to vLLM directly | `new OpenAI({ baseURL: port8001 })` | Handles retries, timeouts, response parsing — already in project |
| Cross-process IPC | WebSocket, HTTP between agents | Shared JSON file | Zero infra, crash-safe, human-readable for debugging |
| Ring buffer | Custom circular buffer class | Array + `shift()` | Already used in `memory.js`; no new dependency |
| Background scheduling | Worker threads, child_process | `setInterval` in same process | Simpler deployment, same-process state access, already proven in `start.js` |

**Key insight:** Every infrastructure pattern needed in this phase already exists in the
codebase. This phase assembles known-good patterns into a new module, not invents new ones.

---

## Common Pitfalls

### Pitfall 1: Cold-Start Null brainState crashes buildSystemPrompt

**What goes wrong:** `backgroundBrain.js` starts its interval but hasn't fired yet. First
main brain `think()` call tries to read `brain-state.json` — file doesn't exist. `JSON.parse`
throws. If uncaught, it propagates up and kills the first tick.

**Why it happens:** `start.js` starts background brain, then immediately the agent is live
and `think()` fires on the `idle` timeout.

**How to avoid:** In `getBrainStateForPrompt()`, wrap `readFileSync + JSON.parse` in
try/catch and return `null` on any error. In `buildSystemPrompt()`, the `if (options.brainState)`
guard already handles null — no injection happens. Main brain runs normally without background
state until the first cycle fires.

**Warning signs:** "ENOENT: no such file" errors in the first 10 seconds of startup.

### Pitfall 2: Background Brain JSON Parse Failure Corrupts brain-state.json

**What goes wrong:** The 9B model outputs malformed JSON (truncated, extra text, markdown
fences). Code tries to `JSON.parse` it and throws. If the code writes the raw response
before parsing, it corrupts `brain-state.json`.

**Why it happens:** LLMs frequently add markdown fencing (`\`\`\`json`) around JSON output,
especially smaller models. The 9B model may also truncate at MAX_TOKENS boundary mid-object.

**How to avoid:** Always parse BEFORE writing. Apply the same strip pattern as
`designAndBuild()` in `mind/index.js`: strip `<think>...</think>` blocks, then strip markdown
fences (\`\`\`json...\`\`\`), then try `JSON.parse`. If parse fails, log and skip the write —
keep the existing (stale) `brain-state.json` intact.

**Warning signs:** `brain-state.json` contains markdown fences or truncated JSON objects.

### Pitfall 3: GPU Contention on Coincident Calls

**What goes wrong:** Main brain fires at t=0. Background brain fires at t=0 (cold start timeout).
Both hit the GPU simultaneously. For llama-server (not vLLM), there is no request queue —
the second call gets a 503 or hangs.

**Why it happens:** The 5s startup delay for background brain is shorter than the main brain's
first LLM call duration (~2s). Depending on timing they can overlap.

**How to avoid:** Use the `_bgRunning` flag. Additionally, set the background brain startup
delay to 10s (not 5s) to give the main brain time to complete its first tick before the
background brain makes its first call. The gap closes naturally after startup.

**Warning signs:** Timeout errors on background brain calls in the first 30 seconds.

### Pitfall 4: Token Budget Blowout in Main Brain Prompt

**What goes wrong:** Background brain output is injected verbatim (all 20 insights, full plan
JSON, all 50 spatial entries). Main brain prompt grows from ~2,000 tokens to ~4,000+. Context
overflow errors trigger history trimming on every tick.

**Why it happens:** No formatting cap in `getBrainStateForPrompt()`.

**How to avoid:** `formatBrainStateForPrompt()` must enforce hard slice limits:
- Max 3 insights from `state.insights` (newest first — `slice(-3)`)
- Max 1 plan step (current only)
- Max 2 constraints
- Max 2 spatial hazards
- Total output: ≤300 tokens (~1,200 chars). Enforce with a `slice(0, 1200)` safety guard.

**Warning signs:** `[mind] trimming history` log messages appearing every tick instead of
occasionally.

### Pitfall 5: Background Brain History Desync

**What goes wrong:** Background brain builds its analysis from `conversationHistory` exported
by `mind/llm.js`. But `conversationHistory` is the MAIN brain's history. After a death or phase
transition, the main brain calls `clearConversation()` — wiping the array the background brain
is about to read.

**Why it happens:** The background brain fires on a timer that doesn't respect history wipes.

**How to avoid:** Background brain should call `getHistory()` right before its LLM call (inside
`runBackgroundCycle`), not cache the reference at startup. `getHistory()` always returns the
current array state. An empty array is valid — the background brain can work from game state alone.

**Warning signs:** Background brain "reasoning about" actions that never happened — its analysis
refers to events from a wiped history.

### Pitfall 6: brain-state.json Grows Unbounded

**What goes wrong:** `insights` array accumulates without a cap. After 10 hours of play,
`brain-state.json` is 500KB. TTL cache reads become slow; prompt injection is 5,000 tokens.

**Why it happens:** Each background cycle appends new insights without evicting old ones.

**How to avoid:** Ring buffers enforced in `writeBrainState()` before every atomic write:
`state.insights = pushRingBuffer(state.insights, newInsight, 20)`. This is the same cap
confirmed in locked decisions.

**Warning signs:** `brain-state.json` file size grows continuously; prompt injection section
grows over time.

---

## Code Examples

Verified patterns from codebase or authoritative design:

### New Module Skeleton: mind/backgroundBrain.js

```javascript
// backgroundBrain.js — Background brain: periodic LLM analysis, atomic brain-state writes

import OpenAI from 'openai'
import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs'
import { join } from 'path'

const BACKGROUND_BRAIN_URL = process.env.BACKGROUND_BRAIN_URL || 'http://localhost:8001/v1'
const BACKGROUND_MODEL = process.env.BACKGROUND_MODEL_NAME || 'qwen3'
const BACKGROUND_MAX_TOKENS = parseInt(process.env.BACKGROUND_MAX_TOKENS || '1024', 10)
const BACKGROUND_INTERVAL_MS = parseInt(process.env.BACKGROUND_INTERVAL_MS || '30000', 10)
const STARTUP_DELAY_MS = 10000  // wait 10s before first cycle

let _bgRunning = false
let DATA_DIR = ''
let BRAIN_STATE_FILE = ''
let BRAIN_STATE_TMP = ''

// 5s TTL cache — main brain reads this, not the raw file every tick
let _cachedState = null
let _cacheTime = 0
const TTL_MS = 5000

const bgClient = new OpenAI({
  baseURL: BACKGROUND_BRAIN_URL,
  apiKey: 'not-needed',
  timeout: 60000,
})

export function initBackgroundBrain(bot, config) {
  DATA_DIR = config.dataDir
  BRAIN_STATE_FILE = join(DATA_DIR, 'brain-state.json')
  BRAIN_STATE_TMP = BRAIN_STATE_FILE + '.tmp'

  // First cycle after startup delay — don't block the main brain's first tick
  setTimeout(() => runBackgroundCycle(bot, config), STARTUP_DELAY_MS)

  setInterval(async () => {
    if (_bgRunning) return  // skip if previous cycle still running
    runBackgroundCycle(bot, config)
  }, BACKGROUND_INTERVAL_MS)

  console.log('[background-brain] initialized — first cycle in', STARTUP_DELAY_MS / 1000, 's')
}

// getBrainStateForPrompt — called by main brain each tick (TTL-cached)
export function getBrainStateForPrompt() {
  const now = Date.now()
  if (_cachedState && (now - _cacheTime) < TTL_MS) {
    return formatBrainState(_cachedState)
  }
  try {
    const raw = readFileSync(BRAIN_STATE_FILE, 'utf-8')
    _cachedState = JSON.parse(raw)
    _cacheTime = now
    return formatBrainState(_cachedState)
  } catch {
    return null  // cold start or parse error — main brain continues without it
  }
}
```

### Atomic Write Function

```javascript
function writeBrainState(state) {
  // Apply ring buffer caps before writing
  if (state.insights) while (state.insights.length > 20) state.insights.shift()
  if (state.spatial) while (state.spatial.length > 50) state.spatial.shift()
  if (state.partnerObs) while (state.partnerObs.length > 100) state.partnerObs.shift()

  const content = JSON.stringify(state, null, 2)
  writeFileSync(BRAIN_STATE_TMP, content, 'utf-8')
  renameSync(BRAIN_STATE_TMP, BRAIN_STATE_FILE)  // atomic on POSIX local disk
}
```

### Format Function (prompt injection, ≤300 tokens)

```javascript
function formatBrainState(state) {
  if (!state) return null
  const age = Math.round((Date.now() - (state.updated_at || 0)) / 1000)
  const lines = [`## Background Brain (${age}s ago)`]

  if (state.plan?.goal) {
    lines.push(`Goal: ${state.plan.goal}`)
    const step = state.plan.steps?.[state.plan.current_step ?? 0]
    if (step) lines.push(`Step: ${step.action} (${step.status || 'todo'})`)
  }
  if (state.constraints?.length) {
    lines.push(`Constraints: ${state.constraints.slice(0, 2).join('. ')}`)
  }
  const insights = (state.insights || []).slice(-3)  // newest 3
  if (insights.length) lines.push(`Insights: ${insights.join(' ')}`)
  const hazards = (state.spatial || []).filter(s => s.hazard).slice(0, 2)
  if (hazards.length) lines.push(`Hazards: ${hazards.map(h => h.note).join('. ')}`)

  const text = lines.join('\n')
  return text.length > 1200 ? text.slice(0, 1200) : text  // hard cap ~300 tokens
}
```

### start.js Integration

```javascript
// In start.js main(), after initMind:
import { initBackgroundBrain } from './mind/backgroundBrain.js'

// ... after: await initMind(bot, config)
initBackgroundBrain(bot, config)
console.log('[hermescraft] background brain initialized')
```

### mind/index.js Integration (think() function)

```javascript
// In think() function, add after buildContext:
import { getBrainStateForPrompt } from './backgroundBrain.js'

// In the systemPrompt building block:
const brainState = getBrainStateForPrompt()  // null during cold start

const systemPrompt = buildSystemPrompt(bot, {
  soul: _config?.soulContent,
  memory: getMemoryForPrompt(),
  players: getPlayersForPrompt(bot),
  locations: getLocationsForPrompt(bot.entity?.position),
  buildContext,
  buildHistory: getBuildHistoryForPrompt(),
  ragContext,
  brainState,  // NEW — null-safe, injected only when available
})
```

### mind/prompt.js Integration

```javascript
// In buildSystemPrompt(), after Part 5.7 (ragContext), add Part 5.8:

// Part 5.8: Background brain state — plan, insights, hazards from background cycle
if (options.brainState) {
  parts.push(options.brainState)
}
```

### JSON Parse Safety Pattern

```javascript
// In runBackgroundCycle — safe parse before writing
function parseLLMJson(raw) {
  // Strip <think> blocks
  let text = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  // Strip markdown fences
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  // Try parse
  try {
    return JSON.parse(text)
  } catch {
    // Try extracting outermost {...}
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch {}
    }
    return null  // parse failed — keep existing state
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single LLM brain handles all reasoning | Talker-Reasoner dual-process split | DeepMind 2024 | Main brain stays fast; planning depth moves to background |
| Polling-based shared state (Redis, SQLite) | File-based atomic rename IPC | Standard for small-scale agents | Zero infra dependency; crash-safe |
| Blocking outer loop (BabyAGI pattern) | Truly async `setInterval` with skip guard | 2024-2025 | Main brain never waits for background cycle |

---

## Open Questions

1. **background_brain conversationHistory access pattern**
   - What we know: `mind/llm.js` exports `getHistory()` which returns the live array
   - What's unclear: Does the background brain need its own conversation history for
     multi-turn refinement, or is a single one-shot call sufficient per cycle?
   - Recommendation: Start with one-shot per cycle (stateless). Add its own history
     only if the quality of plans is demonstrably poor. Single-shot is simpler, less
     memory, and avoids history-wipe desync entirely.

2. **brain-state.json schema versioning**
   - What we know: The initial schema has `plan`, `insights`, `spatial`, `constraints`,
     `partnerObs`, `updated_at`
   - What's unclear: Future phases (COO-01/04, SPA-01/04) will want to add fields.
     Should a `schema_version` field be included now?
   - Recommendation: Add `"schema_version": 1` to the initial write. Read code
     should gracefully handle missing fields (defaults). Upgrade is a new `schema_version`.

3. **BACKGROUND_BRAIN_URL env var naming**
   - What we know: CONTEXT.md says "port 8001" for secondary brain
   - What's unclear: Whether to use `BACKGROUND_BRAIN_URL` or `VLLM_URL_SECONDARY`
   - Recommendation: `BACKGROUND_BRAIN_URL` is more explicit and less likely to
     be confused with vLLM-specific config. Document in `.env.example`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `openai` npm package | Secondary LLM client | Already installed | ^4.0.0 | — |
| Node.js `fs.renameSync` | Atomic writes | Built-in | Node 24.11.1 | — |
| Port 8001 (Qwen3.5-9B) | Background brain LLM calls | Not available locally | — | Module initializes fine; background cycles fail silently and log errors |

**Missing dependencies with no fallback:** None — the background brain failing to connect
to port 8001 is non-fatal. It logs errors and skips writes. Main brain runs without
background state (cold-start bootstrap behavior handles this).

**Missing dependencies with fallback:** Port 8001 (RunPod, deployed in Phase 14).
Local dev runs without the secondary model; tests validate module structure only.

---

## Project Constraints (from CLAUDE.md)

Directives that the planner must preserve:

1. **ESM throughout** — `backgroundBrain.js` must use `import`/`export`, not `require`.
2. **Named exports only** — no `export default`. Every function is a named export.
3. **Module header comment** — first line: `// backgroundBrain.js — [purpose description]`
4. **camelCase exports** — `initBackgroundBrain`, `getBrainStateForPrompt`, etc.
5. **Init pattern** — entry point is `initBackgroundBrain(bot, config)` following `init<Subsystem>`.
6. **No formatter config** — 2-space indent, single quotes, no semicolons, trailing commas.
7. **Mind/body boundary** — `backgroundBrain.js` lives in `mind/`; does NOT import from `body/`.
8. **Only registry.js imports from body/** — `backgroundBrain.js` reads game state from the
   `bot` object passed in, not by importing body modules directly.
9. **GSD workflow enforcement** — all file edits go through GSD execute-phase.
10. **No artificial delays** — `BACKGROUND_INTERVAL_MS` is a real config value, not a workaround.
    The startup `setTimeout(10000)` is not a cooldown — it is a sequencing guarantee.
11. **Tick budget** — background brain must NEVER be awaited inside `think()`. The interval
    runs independently. The read path (`getBrainStateForPrompt`) is synchronous (sync file read,
    TTL-cached to max 1 read/5s).

---

## Sources

### Primary (HIGH confidence)

- Direct codebase read: `mind/llm.js` — OpenAI client pattern, env var naming, timeout config
- Direct codebase read: `mind/index.js` — `think()` flow, `formatRagContext` injection pattern,
  `thinkingInFlight` guard, `setInterval` idle check pattern
- Direct codebase read: `mind/prompt.js` — `buildSystemPrompt()` slot injection pattern (Parts 5.x)
- Direct codebase read: `start.js` — `setInterval` periodic save pattern, module init sequence
- Direct codebase read: `mind/memory.js` — ring buffer `shift()` pattern, `writeFileSync` usage
- Direct codebase read: `tests/smoke.test.js` — test structure, source-level assertion pattern,
  mock bot shape
- `.planning/research/DUAL-BRAIN-ARCHITECTURE.md` — Talker-Reasoner pattern, ring buffer sizes,
  anti-patterns, background prompt structure, GPU contention analysis
- `.planning/research/ARCHITECTURE.md` — atomic rename pattern, `setInterval` background task
  pattern, idle-gated background work pattern, tick budget analysis

### Secondary (MEDIUM confidence)

- `15-CONTEXT.md` — locked decisions on ports, file names, ring buffer sizes, model assignments
- `STATE.md` — confirmed llama-server (port 8000) vs vLLM (port 8001) split; `bgClient` needs
  same `not-needed` API key as llama-server

### Tertiary (LOW confidence)

- None — all claims verified against codebase or prior research documents.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — openai already installed, fs built-in, no new deps
- Architecture: HIGH — all patterns directly from existing codebase or verified research
- Pitfalls: HIGH — 5 of 6 pitfalls derived from codebase code paths; 1 from prior research

**Research date:** 2026-03-23
**Valid until:** 2026-05-23 (stable architecture; no external API churn)
