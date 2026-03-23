# Phase 18: Memory Integration - Research

**Researched:** 2026-03-23
**Domain:** Episodic memory retrieval, prompt injection, reflection journal generation
**Confidence:** HIGH — all findings based on direct codebase reads plus prior v2.3 research documents

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Memory retrieval via `queryRecent` + `queryNearby` from `mind/memoryDB.js` (Phase 17)
- Top-K relevant experiences injected into system prompt via `Promise.all` with knowledge RAG
- 4,000-token budget for total memory context
- Background brain (Phase 15) produces reflection journals — LLM-authored strategy summaries
- Reflection journals stored as high-importance events in SQLite (importance=9)

### Claude's Discretion
All other implementation choices — module structure, query format, prompt placement, token allocation
within the 4,000-token budget, smoke test coverage — are at Claude's discretion.

### Deferred Ideas (OUT OF SCOPE)
None explicitly deferred — discuss phase skipped. Scope is MEM-02 and MEM-04 only.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MEM-02 | Memory retrieval in every LLM call — relevant past experiences injected alongside RAG knowledge | Direct: `think()` already has parallel RAG path; add second retrieval source via `queryRecent`/`queryNearby` |
| MEM-04 | Reflection journals — periodic LLM pass summarizes recent experiences into strategies and lessons | Direct: `backgroundBrain.js` already runs a 30s LLM cycle; extend it to write a reflection journal and call `logEvent` with importance=9 |
</phase_requirements>

---

## Summary

Phase 18 is the READ side of the v2.3 memory system. Phase 17 (complete) built the SQLite write path: `memoryDB.js` stores events with importance scores and spatial tags. Phase 18 makes that data visible to the agent in every LLM call, and tasks the background brain with periodically synthesizing raw events into strategy summaries.

The implementation is narrowly scoped to two integration points that already exist: `think()` in `mind/index.js` (retrieval injection) and `runBackgroundCycle()` in `mind/backgroundBrain.js` (reflection journal generation). No new files are strictly required — this is an additive wiring pass over existing Phase 15 and Phase 17 infrastructure.

The key architectural insight is that memory retrieval must mirror the existing knowledge RAG pattern exactly: derive a query, call the retrieval function, format the result, inject into `buildSystemPrompt()` via an options key. The parallel `Promise.all` pattern already used for knowledge RAG is the correct pattern here. The token budget (4,000 total across knowledge + memory) requires deciding how to split the allocation between the two sources — research below shows this is the only non-trivial design decision.

**Primary recommendation:** Add `retrieveMemoryContext()` in a new thin `mind/memoryRetrieval.js` module (or directly in `mind/index.js` as a local function), wire it into `think()` alongside knowledge RAG via `Promise.all`, add a new prompt Part 5.9 (shifting existing Parts), and extend `runBackgroundCycle()` to write a reflection journal. No new processes, no heavy dependencies.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | ^9.x | Synchronous SQLite reads via `queryRecent` / `queryNearby` | Already used by Phase 17's `memoryDB.js`; synchronous API is correct for the hot path |
| Node.js `fs` | built-in | None needed — all reads go through `memoryDB.js` prepared statements | — |
| `openai` | ^4.0.0 | Reflection journal LLM call in `backgroundBrain.js` | Already used by background brain; same `bgClient` instance |

### No New Dependencies

Phase 18 requires zero new npm packages. The entire implementation builds on:
- `mind/memoryDB.js` — `queryRecent(agentName, limit)` and `queryNearby(agentName, x, z, radius, limit)` (Phase 17)
- `mind/backgroundBrain.js` — existing 30s LLM cycle with `parseLLMJson`, `writeBrainState` (Phase 15)
- `mind/index.js` — `think()` with existing `Promise.all`-compatible RAG path
- `mind/prompt.js` — `buildSystemPrompt()` with numbered Part slots

**Version verification:** No new packages to verify.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
mind/
+-- index.js          MODIFY: add memory retrieval to think(), new deriveMemoryQuery(), formatMemoryContext()
+-- prompt.js         MODIFY: add memoryContext option to buildSystemPrompt(), new Part slot
+-- backgroundBrain.js MODIFY: add reflection journal generation + logEvent call in runBackgroundCycle()
+-- memoryDB.js       KEEP: Phase 17 artifact — no changes needed

tests/
+-- smoke.test.js     MODIFY: add smoke assertions for new exports and prompt injection
```

No new modules required. All changes are additive modifications to existing files.

### Pattern 1: Parallel Memory + Knowledge RAG

**What:** Add `retrieveMemoryContext()` alongside `retrieveKnowledge()` in a `Promise.all` call inside `think()`. Both run concurrently; results are merged before `buildSystemPrompt()`.

**When to use:** Any time two independent async retrievals feed the same prompt.

**Integration point in `think()`:**

```javascript
// In mind/index.js think() — after deriving ragQuery, before buildSystemPrompt()
// EXISTING code (knowledge RAG):
const chunks = await retrieveKnowledge(ragQuery, 3)
ragContext = formatRagContext(chunks)

// NEW parallel pattern (Phase 18):
const memoryQuery = deriveMemoryQuery(bot, context)
const [knowledgeChunks, memoryResult] = await Promise.all([
  retrieveKnowledge(ragQuery, 3),
  retrieveMemoryContext(bot, memoryQuery),
])
ragContext = formatRagContext(knowledgeChunks)
const memoryContext = memoryResult  // pre-formatted string or null
```

**Confidence:** HIGH — this exactly mirrors the existing `retrieveKnowledge` call site. No architectural risk.

### Pattern 2: Memory Query Derivation

**What:** A `deriveMemoryQuery()` function analogous to `deriveRagQuery()`. Produces a short query string used to select relevant past events from SQLite.

**Key difference from RAG query:** Memory queries are about *what the agent did or experienced*, not game mechanics. The RAG query asks "what should I know about iron ore?"; the memory query asks "what have I done related to caves, mining, dying?".

**Two retrieval modes (both available via `memoryDB.js`):**

1. `queryRecent(agentName, limit=20)` — time-ordered, no semantic filter. Use for session-start context injection ("what happened recently?").
2. `queryNearby(agentName, x, z, radius=50, limit=10)` — spatial proximity. Use when the agent is near a location it has visited before.

**Practical query derivation:**

```javascript
// In mind/index.js — new helper function
function deriveMemoryQuery(bot, context) {
  const pos = bot.entity?.position
  // If near a known area, use spatial query
  if (pos) return { mode: 'nearby', x: Math.round(pos.x), z: Math.round(pos.z) }
  // Default: recent events
  return { mode: 'recent', limit: 15 }
}

async function retrieveMemoryContext(bot, query) {
  const { queryRecent, queryNearby } = await import('./memoryDB.js')
  const name = _config?.name
  if (!name) return null

  let events
  if (query.mode === 'nearby') {
    events = queryNearby(name, query.x, query.z, 50, 8)
    // Fall back to recent if no nearby events
    if (events.length === 0) events = queryRecent(name, 12)
  } else {
    events = queryRecent(name, query.limit || 12)
  }

  return formatMemoryContext(events)
}
```

**Confidence:** HIGH — `queryRecent` and `queryNearby` are verified exports from `memoryDB.js`.

### Pattern 3: Memory Context Formatting

**What:** Convert SQLite event rows into a compact prompt string. Must stay within token budget.

**Token budget:** The CONTEXT.md specifies 4,000 total tokens for memory context. The existing knowledge RAG budget is 2,000 tokens (~8,000 chars enforced in `formatRagContext`). Memory gets the remaining headroom — target 800-1,200 tokens (~3,200-4,800 chars) so the combined budget stays at or below 4,000.

**Format design:** Each event row has `ts`, `event_type`, `importance`, `x`, `z`, `dimension`, `description`. The formatted output should be scannable by the LLM:

```javascript
function formatMemoryContext(events) {
  if (!events || events.length === 0) return null
  const lines = ['## Past Experiences']
  for (const ev of events) {
    const age = Math.round((Date.now() - ev.ts) / 1000 / 60)  // minutes ago
    const loc = ev.x != null ? ` at ${ev.x},${ev.z}` : ''
    lines.push(`[${age}m ago${loc}] ${ev.description}`)
  }
  const text = lines.join('\n')
  // Cap at ~1,200 tokens = 4,800 chars
  return text.length > 4800 ? text.slice(0, 4800) : text
}
```

**Confidence:** HIGH — mirrors `formatRagContext` pattern already in `mind/index.js`.

### Pattern 4: Prompt Injection Slot

**What:** Add a new `memoryContext` option to `buildSystemPrompt()` in `prompt.js`. Insert it as a new Part between the existing RAG context (Part 5.7) and background brain state (Part 5.8).

**Existing Part numbering in `prompt.js`:**
- Part 5.7: `ragContext` — dynamically retrieved knowledge
- Part 5.8: `brainState` — background brain state
- Part 5.9: `visionContext` — VLM !see result
- Part 5.10: `minimapContext` — minimap terrain summary
- Part 5.11: `postBuildScan` — post-build verification

**Insertion point:** Add new Part after 5.7 (RAG) and before 5.8 (brain state), renumbering comment only — code is additive:

```javascript
// Part 5.75: Memory context — retrieved past experiences from SQLite event log (Phase 18)
if (options.memoryContext) {
  parts.push(options.memoryContext)
}
```

**Confidence:** HIGH — `buildSystemPrompt` uses a simple `parts.push` pattern; adding a new slot has zero risk.

### Pattern 5: Reflection Journal Generation (MEM-04)

**What:** Extend `runBackgroundCycle()` in `backgroundBrain.js` to periodically generate a reflection journal entry and store it in SQLite as a high-importance event (importance=9).

**Where it hooks in:** At the end of `runBackgroundCycle()`, after the brain state is written. Uses the same LLM client (`bgClient`) and the same JSON-parsing utility (`parseLLMJson`) already present.

**Key design constraints:**
1. The reflection call must NOT fire every cycle — only when enough new events have accumulated (guard: minimum 5 new events since last reflection, or 30+ minutes elapsed)
2. `logEvent` requires a `bot` reference — `backgroundBrain.js` already holds `_bot` module state (set in `initBackgroundBrain`)
3. The journal description must be ≤500 chars (metadata field truncation limit in `memoryDB.js`)
4. importance=9 is between death (10) and discovery (8) — correctly prioritized for retrieval

**Implementation sketch:**

```javascript
// In backgroundBrain.js runBackgroundCycle() — AFTER writeBrainState() call

// Only generate a reflection if enough time has passed (e.g., 30 min = 2 cycles at 30s)
const REFLECTION_INTERVAL_MS = 30 * 60 * 1000  // 30 minutes
const now = Date.now()
const lastReflection = existingState?.lastReflectionAt || 0
if (now - lastReflection > REFLECTION_INTERVAL_MS) {
  await generateReflectionJournal(recentHistory, mergedState)
  mergedState.lastReflectionAt = now
  writeBrainState(mergedState)
}

async function generateReflectionJournal(recentHistory, brainState) {
  // Summarize recent history into 1-2 sentence strategy insight
  const histText = recentHistory
    .map(m => typeof m.content === 'string' ? m.content.slice(0, 150) : '')
    .join('\n').slice(0, 1500)
  const prompt = `Summarize in 1-2 sentences what you learned or accomplished recently. Be specific and tactical.
History: ${histText}
Output ONLY the summary sentence. No JSON, no markdown, no extra text.`
  const res = await bgClient.chat.completions.create({
    model: BACKGROUND_MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 80,
    temperature: 0.4,
  })
  const summary = (res.choices?.[0]?.message?.content || '').trim().slice(0, 480)
  if (summary && _bot) {
    logEvent(_bot, 'reflection', summary, { source: 'background_brain' })
  }
}
```

**Importance override:** The `logEvent` function uses `IMPORTANCE[eventType]`. Since `'reflection'` is not in the `IMPORTANCE` map, it defaults to `2`. To store with importance=9 (per CONTEXT.md locked decision), either:
- Add `'reflection': 9` to the IMPORTANCE map in `memoryDB.js`, OR
- Pass importance directly — but current `logEvent` signature does not accept an explicit importance override

**Resolution:** Add `'reflection': 9` to the IMPORTANCE map in `memoryDB.js`. This is a 1-line additive change that is backwards-compatible (existing event types are unchanged).

**Confidence:** HIGH — verified against `logEvent` signature and IMPORTANCE map in `memoryDB.js`.

### Anti-Patterns to Avoid

- **Per-tick SQLite reads:** `queryRecent` is synchronous; calling it inside a tight loop would block the event loop. It must only be called once per `think()` invocation. The existing `thinkingInFlight` guard ensures this.
- **Token budget overflow:** Knowledge RAG is capped at 8,000 chars. Memory context must be independently capped before injection — do not concatenate and cap the merged result, as this could silently drop all memory when knowledge is large.
- **Reflection on every background cycle:** Generating a reflection every 30 seconds produces noise. Guard with a timestamp check (minimum 30 minutes between reflections).
- **Awaiting `logEvent` in background brain:** `logEvent` is synchronous — do not wrap it in `await`. This is a common mistake when mixing sync/async in an async function.
- **Crossing the mind/body boundary for retrieval:** `memoryDB.js` is in `mind/` — retrieval stays in `mind/index.js`. No body imports needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite queries for recent/nearby events | Custom SQL in `think()` | `queryRecent()` / `queryNearby()` from `memoryDB.js` | Prepared statements, indexes already tuned by Phase 17 |
| LLM call for reflection | New `openai` client in a new module | `bgClient` in `backgroundBrain.js` | Avoids GPU contention from two concurrent main-brain requests; background brain is already rate-limited by `_bgRunning` guard |
| JSON parsing in background brain | Custom regex/parse | `parseLLMJson()` already in `backgroundBrain.js` | Handles `<think>` stripping, markdown fence removal, fallback extraction — battle-tested |
| Atomic state file writes | `writeFileSync` direct | `writeBrainState()` already in `backgroundBrain.js` | Uses tmp + `renameSync` for POSIX-atomic write; main brain never reads a partial file |
| Token budget enforcement | Count tokens manually | Char-based cap (~4 chars/token) | Already used throughout the codebase (`formatRagContext` uses 8,000 char cap); consistent, simple |

**Key insight:** Phase 17 and Phase 15 already solved the hard problems. Phase 18 is wiring, not infrastructure.

---

## Common Pitfalls

### Pitfall 1: Token Budget Collision Between Knowledge and Memory

**What goes wrong:** Knowledge RAG injects up to 8,000 chars. Memory context injects another 4,800 chars. Combined = ~12,800 chars = ~3,200 tokens — within budget but could crowd out the rest of the system prompt in edge cases.

**Why it happens:** Each injection is capped independently; the combined total is never checked.

**How to avoid:** The combined budget is 4,000 tokens for memory+knowledge per CONTEXT.md. Knowledge RAG already uses 2,000 tokens. Memory should target 800-1,000 tokens max (3,200-4,000 chars). Cap `formatMemoryContext` output at 4,000 chars, not 4,800.

**Warning signs:** System prompt grows beyond 8,000 tokens; model produces shorter responses; latency spikes.

### Pitfall 2: `logEvent` Requires a Live Bot Reference

**What goes wrong:** `backgroundBrain.js` calls `logEvent(_bot, ...)` but `_bot` is the bot object set during `initBackgroundBrain`. If the bot hasn't spawned yet or has disconnected, `_bot` is stale. `logEvent` guards `if (!db) return` but does NOT guard `if (!bot)` — it will crash on `bot?.entity?.position` only because of optional chaining.

**Why it happens:** Background brain fires 10 seconds after init (STARTUP_DELAY_MS = 10000). If `generateReflectionJournal` is called after bot disconnect, `_bot.entity` is undefined.

**How to avoid:** Wrap the `logEvent` call with `if (_bot?.entity)` to confirm the bot is still alive before writing.

**Warning signs:** `TypeError: Cannot read properties of undefined` in background brain logs.

### Pitfall 3: `importance=9` Not in IMPORTANCE Map

**What goes wrong:** `logEvent` uses `IMPORTANCE[eventType] ?? 2` — if `'reflection'` is not in the map, journals are stored with importance=2 (movement-level). They will be buried in retrieval by deaths, discoveries, and builds.

**Why it happens:** `memoryDB.js` IMPORTANCE map only covers the 8 original event types: death, discovery, combat, build, social, craft, observation, movement.

**How to avoid:** Add `reflection: 9` to the IMPORTANCE map in `memoryDB.js`. This is the ONLY change needed to `memoryDB.js` — all other Phase 18 work is in `index.js`, `prompt.js`, and `backgroundBrain.js`.

**Warning signs:** Reflection journals appear in `queryRecent` results but never surface near the top of `queryNearby` results despite being high-value content.

### Pitfall 4: Reflection Runs During Active Gameplay

**What goes wrong:** If `generateReflectionJournal` fires while the main brain is executing a multi-second LLM call, two concurrent model requests hit the GPU simultaneously (one from main brain `queryLLM`, one from background `bgClient`). GPU memory pressure increases; latency spikes on both.

**Why it happens:** `backgroundBrain.js` has `if (_bgRunning) return` but the flag is cleared at the end of the cycle. The reflection generation is a second LLM call *within* the cycle after the main cycle LLM call completes.

**How to avoid:** The reflection is generated within `runBackgroundCycle()` — it uses `bgClient` (port 8001, secondary model). The main brain uses `queryLLM` which hits the primary model (port 8000). These are separate processes; no contention. This pitfall is a false alarm — but document it so future engineers don't spend time investigating.

### Pitfall 5: Memory Context Injected But Never Retrieved

**What goes wrong:** `buildSystemPrompt` is updated to accept `memoryContext` but `think()` does not pass it, so the agent never sees memories despite the injection infrastructure being in place.

**Why it happens:** There are two separate changes: (1) `prompt.js` must add the new slot, (2) `think()` must pass `memoryContext` in the options object to `buildSystemPrompt`. Missing either makes the feature a no-op.

**How to avoid:** Smoke test: call `buildSystemPrompt(mockBot, { memoryContext: '## Past Experiences\ntest event' })` and assert the output contains `'## Past Experiences'`.

---

## Code Examples

Verified against direct codebase reads.

### Existing `retrieveKnowledge` call site (from `mind/index.js` — the pattern to mirror)

```javascript
// Source: mind/index.js think() — existing RAG path
const topK = ragQuery.startsWith('how to') ? 3 : 3
const chunks = await retrieveKnowledge(ragQuery, topK)
ragContext = formatRagContext(chunks)
if (ragContext) {
  console.log('[mind] RAG injected:', ragQuery, `(${chunks.length} chunks)`)
}
```

### Parallel retrieval pattern to implement (MEM-02)

```javascript
// Source: mind/index.js think() — Phase 18 addition
const memQuery = deriveMemoryQuery(bot, context)
const [knowledgeChunks, memCtx] = await Promise.all([
  retrieveKnowledge(ragQuery, 3),
  retrieveMemoryContext(bot, memQuery),
])
ragContext = formatRagContext(knowledgeChunks)
// memCtx is already formatted — null if no relevant events
```

### `queryRecent` and `queryNearby` signatures (from `mind/memoryDB.js`)

```javascript
// Source: mind/memoryDB.js — verified exports
export function queryRecent(agentName, limit = 20)   // returns event[] ordered by ts DESC
export function queryNearby(agentName, x, z, radius = 50, limit = 10)  // ordered by importance DESC, ts DESC
// Event shape: { id, ts, event_type, importance, x, z, dimension, description }
```

### Existing `buildSystemPrompt` Part injection pattern (from `mind/prompt.js`)

```javascript
// Source: mind/prompt.js — Part 5.7 (the slot immediately before the new one)
// Part 5.7: RAG context — dynamically retrieved knowledge relevant to current activity
if (options.ragContext) {
  parts.push(options.ragContext)
}
// NEW Part 5.75: Memory context — Phase 18
if (options.memoryContext) {
  parts.push(options.memoryContext)
}
// Part 5.8: Background brain state (existing — no change)
if (options.brainState) {
  parts.push(options.brainState)
}
```

### Existing `writeBrainState` pattern (from `mind/backgroundBrain.js`)

```javascript
// Source: mind/backgroundBrain.js — atomic write already in place
function writeBrainState(state) {
  // Ring buffer caps applied before write
  const content = JSON.stringify(state, null, 2)
  writeFileSync(BRAIN_STATE_TMP, content, 'utf-8')
  renameSync(BRAIN_STATE_TMP, BRAIN_STATE_FILE)  // POSIX-atomic on local disk
}
```

### IMPORTANCE map extension (from `mind/memoryDB.js` — 1-line change)

```javascript
// Source: mind/memoryDB.js — add reflection to existing map
const IMPORTANCE = {
  death:       10,
  reflection:   9,  // NEW — Phase 18: LLM-authored strategy journals
  discovery:    8,
  combat:       7,
  build:        6,
  social:       5,
  craft:        4,
  observation:  3,
  movement:     2,
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat MEMORY.md injected every tick | SQLite event log (Phase 17) with importance scoring and spatial index | Phase 17 (this milestone) | Foundation for semantic retrieval; raw events now addressable by recency and proximity |
| No episodic retrieval | `queryRecent` + `queryNearby` → prompt injection | Phase 18 (this phase) | Agent can reference "last time I was near this cave" |
| Background brain writes plan/insights only | Background brain also writes reflection journals (importance=9) | Phase 18 (this phase) | High-value strategy summaries surface prominently in future retrievals |

**Deprecated approaches (do not use):**
- Injecting full `MEMORY.md` every tick: replaced by SQLite retrieval. `getMemoryForPrompt()` still works and is kept for backward compatibility, but the new memory context is the primary episodic source.
- JSONL append-only experience log (`experiences.jsonl`): The v2.3 architecture research proposed this as a BM25 index, but Phase 17 chose SQLite (`memoryDB.js`) with `queryNearby`/`queryRecent` instead. Do not implement the JSONL/BM25 path — it was superseded.

---

## Open Questions

1. **Splitting top-K between recent vs. nearby events**
   - What we know: `queryNearby` returns up to 10 events; `queryRecent` returns up to 20. Combining both without deduplication could inject redundant events (nearby events are also recent).
   - What's unclear: Whether to use nearby OR recent (adaptive), or always recent (simpler), or merge and deduplicate.
   - Recommendation: Use nearby when `pos` is available (covers MrSteve-style spatial recall), fall back to recent. Skip deduplication — the overlap is small and the complexity cost is high. Keep total injected events at 8-10 (stay within 4,000-char cap).

2. **Reflection journal frequency**
   - What we know: Background brain runs every 30s. Generating a reflection every cycle is too noisy. CONTEXT.md says "periodic LLM pass."
   - What's unclear: Exact cadence — every 30 minutes? Every N events since last reflection?
   - Recommendation: 30-minute interval (tracked via `lastReflectionAt` in `brain-state.json`). This gives 48 reflections per 24-hour session — reasonable density without noise.

3. **Token budget enforcement mechanism**
   - What we know: CONTEXT.md specifies 4,000 total token budget for memory context. Knowledge RAG is separately capped at 2,000 tokens.
   - What's unclear: Whether "4,000 tokens for total memory context" means memory-only (exclusive of knowledge RAG), or memory + knowledge combined.
   - Recommendation: Interpret as memory-only (exclusive). Knowledge RAG has its own existing cap. Memory context capped at 4,000 tokens (~16,000 chars) — practically, keep it at 800-1,000 tokens to leave headroom in the full system prompt.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 18 is a pure code/integration change. It uses only `better-sqlite3` (already installed and in use by Phase 17) and the existing OpenAI-compatible `bgClient` (no new network dependencies). No new CLI tools, runtimes, or external services required.

---

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `mind/memoryDB.js` — `queryRecent`, `queryNearby`, `logEvent` signatures, IMPORTANCE map, schema
- `mind/backgroundBrain.js` — `runBackgroundCycle`, `parseLLMJson`, `writeBrainState`, `_bot` state, `_bgRunning` guard, `logEvent` import presence
- `mind/index.js` — `think()` structure, RAG path, `thinkingInFlight` guard, `formatRagContext`, `deriveRagQuery`, `buildSystemPrompt` call site
- `mind/prompt.js` — Part numbering (5.7-5.11), options interface, `parts.push` pattern
- `mind/knowledgeStore.js` — `retrieveKnowledge` signature, RRF fusion, async interface
- `start.js` — init sequence, confirmed `initMemoryDB` called before `initMind`
- `.planning/phases/18-memory-integration/18-CONTEXT.md` — locked decisions
- `.planning/research/ARCHITECTURE.md` — parallel RAG pattern, tick budget analysis, JSONL/SQLite decision history

### Secondary (MEDIUM confidence)
- `.planning/research/FEATURES.md` — Stanford Generative Agents importance scoring, MrSteve spatial memory patterns, verified against academic papers
- `.planning/STATE.md` — Phase 17 decisions: agent column = config.name, EVT_MAP, FIFO pruning at startup

### Tertiary (LOW confidence — not needed, architecture is clear from codebase)
- None required. All critical facts verified against direct file reads.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all libraries already in use
- Architecture: HIGH — all integration points traced to specific line ranges in actual files
- Pitfalls: HIGH — derived from direct inspection of `logEvent` signature, IMPORTANCE map, and background brain cycle structure

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable codebase — monthly review sufficient)
