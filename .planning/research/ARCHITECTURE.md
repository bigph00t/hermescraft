# Architecture Research

**Domain:** LLM-driven Minecraft AI agent — v2.3 Persistent Memory and Ambitious Building
**Researched:** 2026-03-23
**Confidence:** HIGH — based on direct reading of existing codebase (3,389 lines across 24 modules)

---

## Context: What This Research Covers

v2.3 is additive. The v2.0 Mind+Body architecture is stable, tested, and correct. This document
answers specifically: where do the six new feature areas integrate, which modules change vs are
created new, what are the data flow implications, and what is the safe build order.

The existing boundary rule is critical and must be preserved in every integration decision:
**only `mind/registry.js` imports from `body/`; `body/` never imports from `mind/`.**

---

## Existing System Overview

```
+---------------------------------------------------------+
|                    MIND LAYER                           |
|                                                         |
|  +----------+  +----------+  +----------+  +---------+ |
|  | index.js |  | prompt.js|  | memory.js|  |social.js| |
|  | (think())|  |(builder) |  |(MEMORY.md|  |(players)| |
|  +----+-----+  +----------+  | sessions)|  +---------+ |
|       |                      +----------+              |
|  +----+--------------------------------------------------+
|  |  llm.js (queryLLM, conversationHistory)              |
|  +----+--------------------------------------------------+
|       | !command text                                    |
|  +----+---------+  +--------------+  +--------------+   |
|  | registry.js  |  |knowledgeStore|  |  spatial.js  |   |
|  | (dispatch)   |  |(BM25+vector) |  |(block vision)|   |
|  +----+---------+  +--------------+  +--------------+   |
+----- -|--------------------------------------------------+
|                    BODY LAYER                           |
|  +----+-------------------------------------------------+
|  |  skills/: build, mine, gather, craft, combat...     |
|  |  navigate.js, place.js, dig.js, crafter.js          |
|  |  modes.js (300ms tick: combat, flee, eat, stuck)    |
|  +-----------------------------------------------------+
+---------------------------------------------------------+
|                    PERSISTENCE LAYER                    |
|  +----------+  +----------+  +----------+  +---------+ |
|  |MEMORY.md |  |locations |  |build_    |  |sessions/| |
|  |stats.json|  |.json     |  |history   |  |*.jsonl  | |
|  +----------+  +----------+  +----------+  +---------+ |
|  +-----------------------------------------------------+ |
|  |  shared_build_history.json (cross-agent)            | |
|  +-----------------------------------------------------+ |
+---------------------------------------------------------+
```

---

## v2.3 Feature Areas and Integration Points

### 1. Persistent Long-Term Memory

**What exists now:**
`mind/memory.js` provides session-scoped in-memory storage with a flat `MEMORY.md` file backing.
Structure: `{ lessons: [], strategies: [], worldKnowledge: [] }`. Limits: 20 lessons, 10 strategies,
10 world knowledge entries — all trimmed with `shift()` when full. No cross-agent sharing. No
timestamps. No semantic retrieval — prompt injection is a flat `getMemoryForPrompt()` call that
concatenates the last 7/5/5 entries.

**What v2.3 needs:**
Cross-session memory that grows, is organized by topic, survives session pruning, and can be
queried semantically. The key insight: the RAG infrastructure (BM25 + vector via `knowledgeStore.js`)
is already in the project. Long-term memory is a second corpus indexed by the same pipeline.

**Where it lives: extend `mind/memory.js` + new `mind/memoryStore.js`**

`memory.js` grows a new section: `experiences` — structured entries with timestamp, category
(`build`, `survival`, `social`, `exploration`, `craft`), agent name, and text. Unlike the current
flat lists, experiences accumulate without a hard cap and are never `shift()`-pruned. They flush
to a new file: `data/<agent>/experiences.jsonl` (append-only, one JSON object per line).

`memoryStore.js` is a new module (parallel to `knowledgeStore.js`) that:
- Loads `experiences.jsonl` at startup into a searchable corpus
- Builds a BM25 index over experiences using MiniSearch (same library already installed)
- Exposes `retrieveMemories(query, topK)` returning the most relevant past experiences
- Is queried by `mind/index.js` `think()` alongside knowledge RAG

The `think()` function gains a second RAG path: experience memory alongside game knowledge. Budget
allocation: 3 knowledge chunks + 2 memory experiences per think() call = unchanged total context.

**No new process, no worker thread.** Memory write-back (experience to jsonl) is a synchronous
append (`appendFileSync`) in existing lifecycle hooks: `recordDeath`, the dispatch success handler,
and the `!design` completion handler. These writes are <1ms and do not require async.

**Data flow change:**
```
think() triggers
  -> deriveRagQuery() generates knowledge query (unchanged)
  -> deriveMemoryQuery() generates memory query (new, parallel)
  -> retrieveKnowledge() + retrieveMemories() (both async, run in parallel via Promise.all)
  -> formatRagContext() + formatMemoryContext() (new) -> injected into system prompt
```

**Write-back data flow:**
```
Skill completes successfully
  -> addExperience({ category, text, timestamp }) in mind/memory.js (new function)
  -> appendFileSync(experiences.jsonl) -- synchronous, <1ms
  -> periodic re-index in background (see Background Memory Agent below)
```

---

### 2. Background Memory Agent

**What v2.3 needs:**
Sessions accumulate experiences. The BM25 index is rebuilt from scratch at startup
(already the case for knowledge). What is new: the index must be refreshed during long sessions
as new experiences are added. A "background consolidation" step should also periodically
summarize and tag experience clusters.

**Where it lives: async setInterval in `start.js`, NOT a separate Node process**

A separate process adds IPC complexity, restart dependencies, and shared-file race conditions.
The existing architecture is single-process by deliberate design. The 300ms body tick and the
event-driven mind loop already demonstrate that background work runs fine via `setInterval`.

The background memory task:
- Runs every 5 minutes via `setInterval` in `start.js`
- Calls `rebuildMemoryIndex()` in `memoryStore.js` -- reads `experiences.jsonl`, rebuilds BM25
- Optionally calls a lightweight "consolidation" LLM pass (see constraint below)

**Constraint: No extra LLM calls during active gameplay.** The background task only runs when
`!skillRunning && !thinkingInFlight` (exposed via `isSkillRunning()` + a new `isThinking()`
getter from `mind/index.js`). If the agent is busy, the task defers to the next 5-minute window.

**The optional consolidation pass** (phase-gate this after basic memory retrieval works):
A single LLM call with the last 20 experiences, instructed to produce 3-5 strategy bullet points.
Output appended to `memory.strategies`. Budget: ~500 tokens, fires at most once per 5 minutes
when idle. This is the "memory distillation" path -- raw experiences condense into strategies.

---

### 3. Vision System

**What exists now:**
`mind/spatial.js` provides block-based "vision" via three tiers: immediate (6 adjacent blocks,
<1ms), near vision (16-block radius findBlocks scan, 3s cache), and terrain context (<0.5ms).
This is already injected into every prompt via `buildSpatialAwareness()`. There are no screenshots.
The PROJECT.md `Out of Scope` section explicitly calls out `Vision/screenshots (Claude Haiku)` as
cut in v2.0 because Mineflayer provides world state directly.

**What v2.3 needs:**
"Enhanced spatial understanding" and "deeper block awareness" -- NOT screenshot analysis. The
Mineflayer API already provides richer data than screenshots would reveal: block types,
entity positions, chest contents, build verification. The right investment is extending
`spatial.js` and adding `body/skills/scan.js` integration into the prompt layer.

**Where it lives: extend `mind/spatial.js` + integrate `body/skills/scan.js`**

`scan.js` already exists (`body/skills/scan.js`) but is not injected into prompts. It returns
a block inventory for a 3D AABB (max 32x32x32). It should be exposed as a `!scan` command via
`mind/registry.js` and its output stored as a "site survey" in world knowledge.

`spatial.js` gains two additions:
1. **Entity awareness tier** -- `bot.entities` filtered to players + hostile mobs + animals within
   16 blocks. Already partially done via `spatial.js` hazard detection; extend to include entity
   names and distances in prompt text.
2. **Build verification** -- after `!build` or `!design` completes, run `scanArea()` over the
   build AABB to count placed vs expected blocks, injected as a `postBuildScan` context field
   in the next `think()`.

No screenshot analysis. No external vision API. No new dependencies. Confidence: HIGH.

---

### 4. Build Planning for 500+ Block Structures

**What exists now:**
`body/skills/build.js` executes blueprints from JSON files (max ~200 blocks in existing blueprints).
`mind/index.js` `designAndBuild()` generates a blueprint via one LLM call, validates it, writes
`_generated.json`, and executes it. Current prompt constraint: `max 10x10 footprint, max 8 blocks
tall` -- that is a 10x10x8 = 800 block theoretical max, but generated buildings average ~50-100 blocks.
Larger builds are blocked by: (1) single-LLM-call generation limit, (2) no material pre-planning,
(3) no pause/resume for mid-build material gathering, (4) single `_generated.json` overwritten on
each `!design`.

**What v2.3 needs:**
Multi-phase build planning: (1) design phase (LLM generates blueprint JSON), (2) material audit
phase (what blocks are needed, what is missing), (3) gather/craft phase (acquire materials),
(4) execution phase (place blocks), (5) verify phase (scan + report). For 500+ blocks this is
necessarily multi-session.

**Where it lives: new `mind/buildPlanner.js` + extend `body/skills/build.js`**

`mind/buildPlanner.js` owns the planning side:
- `planBuild(bot, description)` -- LLM call to generate blueprint (can produce larger blueprints
  by removing the 10x10 max constraint for "plan" mode vs "immediate build" mode)
- `auditMaterials(bot, blueprint)` -- compare blueprint palette requirements against current
  inventory + chest contents; return `{ have, need }` lists
- `saveBuildPlan(planId, blueprint)` -- writes to `data/<agent>/plans/<planId>.json`
- `listBuildPlans()` -- list incomplete plans
- `getBuildPlanForPrompt()` -- formats active plan status for prompt injection

`body/skills/build.js` gains:
- Larger blueprint support -- remove implicit volume limit (pagination: build in Z-slice batches)
- Per-slice persistence -- `_activeBuild.completedSlice` so mid-build crashes resume at the right
  layer, not just the right block index

The `!design` command splits into two modes in the registry:
- `!design <description>` -- small immediate builds (current behavior, unchanged)
- `!plan <description>` -- creates a build plan stored to disk; agent then works through the
  material-gather -> build loop across sessions

**Multi-agent coordination for builds:** see section 6.

---

### 5. Multi-Agent Coordination

**What exists now:**
Agents share `data/shared_build_history.json` (written by `mind/build-history.js`). Each agent has
a separate `data/<name>/` directory. Communication is via in-game chat (`bot.chat()`) which both
agents observe via `messagestr`. There is no explicit task registry, no lock file, no Redis, no
direct IPC. The `config.js` `ALL_AGENTS` list is hardcoded.

**What v2.3 needs:**
Coordination for large build projects: who is building which section, who is gathering which
materials, how to avoid two agents pathfinding to the same block. At 2-agent scale (Luna + Max),
a shared JSON file is sufficient. At 5-10 agents it needs a lock-and-lease pattern.

**Where it lives: new `data/shared_task_registry.json` + new `mind/taskRegistry.js`**

**For 2-agent scale (v2.3):**
A new `mind/taskRegistry.js` module manages a shared JSON file: `data/shared_task_registry.json`.
Structure:
```json
{
  "tasks": [
    {
      "id": "uuid",
      "type": "build_section | gather | explore",
      "description": "build north wall of watchtower",
      "claimedBy": "luna | null",
      "claimedAt": "ISO timestamp | null",
      "status": "pending | active | done | failed",
      "planId": "watchtower-v1 | null"
    }
  ]
}
```

`claimTask(agentName, taskId)` uses read-modify-write with a file lock guard (simple: rename-based
atomic swap via `fs.renameSync` after writing temp file). Claims expire after 10 minutes
(stale agent detection). Agents announce task claims via in-game chat: "I'm starting the north
wall." This keeps the coordination human-observable.

**For 5-10 agent scale (v2.3+ future):**
Replace the shared JSON file with SQLite (`better-sqlite3`) -- synchronous API, no daemon,
single file, ACID. The `taskRegistry.js` module interface stays the same; only the backend changes.
Redis is overkill at this scale and adds an external process dependency. Do NOT use Redis for v2.3.

**No direct inter-process IPC.** Agents coordinate through two channels only:
1. Shared file system (task registry, build plans, shared build history)
2. In-game chat (human-observable, logged to sessions/*.jsonl)

This preserves the architectural simplicity and the "feels like real players" observable behavior.

---

### 6. Tick Budget Analysis

**Current tick budget:**
- Body tick: 300ms -- 6-priority cascade, synchronous checks, async only for navigation/attack
- Mind think(): event-driven -- fires on chat/skill_complete/idle (2s timeout)
- RAG retrieval: ~50-100ms per think() call (BM25 fast, vector query dominates)
- LLM call: ~500ms-2000ms (MiniMax M2.7 via API)
- Total think() cycle: 600ms-2100ms

**v2.3 additions and their budget impact:**

| Addition | Execution Location | Time Cost | Budget Impact |
|----------|-------------------|-----------|---------------|
| Memory retrieval (BM25 only) | In think(), parallel with knowledge RAG | ~5-15ms | Negligible |
| Memory write (appendFileSync) | In dispatch handlers | <1ms | Negligible |
| Memory index rebuild | Background setInterval, only when idle | ~50-200ms | Zero (deferred) |
| Build plan audit | Before !plan execution, one-time | ~10ms | Negligible |
| Scan area (32x32x32) | After build completion, one-time | ~10ms | Negligible |
| Task registry read | In think() periodically | <5ms | Negligible |
| Task registry write (atomic) | On task claim/complete | ~5ms | Negligible |

**Consolidation LLM pass** (background, idle-only): adds one LLM call (~500ms) at most once per
5 minutes when the agent is idle. Not in the hot path. Safe.

**Verdict:** v2.3 additions do not threaten the tick budget. The memory retrieval runs in parallel
with knowledge RAG via `Promise.all()` -- it adds zero sequential latency. All writes are
synchronous file appends (<1ms). Background tasks are idle-gated.

**The only budget risk:** larger blueprint generation via `!plan`. A 500-block blueprint may
require a longer LLM call with a larger context. Mitigate by keeping `!plan` as a separate,
user-initiated operation -- not triggered mid-gameplay by the agent's autonomy loop.

---

### 7. Data Flow: Memory Write-Back

Full lifecycle for an experience from event to future retrieval:

```
1. Agent completes a build (!design watchtower -> success)
         |
2. mind/index.js dispatch handler:
   addExperience({ category: 'build', text: 'Designed + built watchtower at 120,64,-30',
                   timestamp: ISO, agent: 'luna' })
         |
3. memory.js appendFileSync(experiences.jsonl, JSON.stringify(entry) + '\n')
   (synchronous, <1ms, no await needed)
         |
4. (background, idle, 5min interval)
   memoryStore.js rebuildMemoryIndex() reads experiences.jsonl, rebuilds MiniSearch index
         |
5. (optional) consolidateMemo() LLM pass: 20 recent experiences -> 3 strategy bullets
   -> appended to memory.strategies -> saveMemory()
         |
6. Future session: start.js calls initMemoryStore()
   -> loads experiences.jsonl -> builds BM25 index
         |
7. think() fires, deriveMemoryQuery() returns "building watchtower watch tower design"
   -> retrieveMemories(query, 2) returns the watchtower experience
   -> injected as "Past experience: Built watchtower at 120,64,-30"
```

---

## Recommended Project Structure Changes

```
mind/
+-- index.js          # MODIFY: add memory RAG path, deriveMemoryQuery(), isThinking()
+-- memory.js         # MODIFY: add addExperience(), experiences[] storage, experiences.jsonl
+-- memoryStore.js    # NEW: BM25 index over experiences, retrieveMemories()
+-- buildPlanner.js   # NEW: planBuild(), auditMaterials(), saveBuildPlan()
+-- taskRegistry.js   # NEW: claimTask(), listTasks(), releaseTasks() -- shared JSON file
+-- prompt.js         # MODIFY: add formatMemoryContext(), build plan context injection
+-- build-history.js  # KEEP: unchanged -- shared_build_history.json is fine
+-- knowledge.js      # KEEP: unchanged
+-- knowledgeStore.js # KEEP: unchanged
+-- spatial.js        # MODIFY: add entity awareness tier, expose postBuildScan
+-- llm.js            # MODIFY: add isThinking() export (tiny: return thinkingInFlight)
+-- config.js         # KEEP: unchanged
+-- locations.js      # KEEP: unchanged
+-- social.js         # KEEP: unchanged
+-- registry.js       # MODIFY: add !plan command, !scan command

body/
+-- skills/
|   +-- build.js      # MODIFY: Z-slice pagination for large builds, completedSlice
|   +-- scan.js       # KEEP: already works -- just needs registry exposure
|   +-- ... (all others unchanged)
+-- modes.js          # KEEP: unchanged
+-- ... (all others unchanged)

data/
+-- shared_task_registry.json  # NEW: cross-agent task coordination
+-- shared_build_history.json  # EXISTS: unchanged
+-- <agent>/
    +-- MEMORY.md              # EXISTS: unchanged
    +-- stats.json             # EXISTS: unchanged
    +-- experiences.jsonl      # NEW: append-only experience log
    +-- plans/                 # NEW: per-agent build plans
    |   +-- <planId>.json
    +-- locations.json         # EXISTS: unchanged
    +-- players.json           # EXISTS: unchanged
    +-- build_state.json       # EXISTS: unchanged
    +-- sessions/              # EXISTS: unchanged
        +-- session-*.jsonl

start.js               # MODIFY: init memoryStore, taskRegistry, background consolidation interval
```

---

## Architectural Patterns for v2.3

### Pattern 1: Parallel RAG Path

**What:** Run knowledge retrieval and memory retrieval in parallel, merge results before prompt build.
**When to use:** Any time two async retrievals feed the same prompt and are independent.
**Trade-offs:** No code complexity increase (just wrap in `Promise.all`). Zero latency added vs serial.

```javascript
// In mind/index.js think() -- parallel retrieval
const [knowledgeChunks, memoryChunks] = await Promise.all([
  retrieveKnowledge(ragQuery, 3),
  retrieveMemories(memoryQuery, 2),
])
const ragContext = formatRagContext(knowledgeChunks)
const memoryContext = formatMemoryContext(memoryChunks)
// Both injected independently into buildSystemPrompt()
```

### Pattern 2: Idle-Gated Background Work

**What:** Background tasks that need CPU/LLM time defer to idle windows -- never preempt active gameplay.
**When to use:** Any periodic maintenance task (index rebuild, consolidation, save).
**Trade-offs:** Work is not always "fresh" -- memory index may lag by up to 5 minutes.
Acceptable because retrieval degrades gracefully (missing recent entries, not breaking).

```javascript
// In start.js
setInterval(async () => {
  if (isSkillRunning() || isThinking()) return  // defer if busy
  await rebuildMemoryIndex()
  // optional: await consolidateMemories(bot, config)
}, 5 * 60 * 1000)
```

### Pattern 3: Append-Only Experience Log

**What:** Write experiences as JSONL (one JSON object per line), never overwrite.
**When to use:** Any write that must be durable, auditable, and fast (no read-before-write).
**Trade-offs:** File grows unbounded. Mitigate with an annual prune at startup (keep last 1000 entries).
Do NOT use a database at 2-agent scale -- JSONL is simpler, grep-able, and crash-safe.

```javascript
// In mind/memory.js
export function addExperience(entry) {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n'
  appendFileSync(EXPERIENCES_FILE, line, 'utf-8')
}
```

### Pattern 4: Shared File Coordination via Atomic Rename

**What:** Read-modify-write shared JSON file using temp-write + `fs.renameSync` for atomic swap.
**When to use:** Any write to a shared file where two agents could collide.
**Trade-offs:** On Linux, `renameSync` is atomic at the kernel level (POSIX guarantee).
Works for 2-10 agents. Does NOT work across network filesystems (NFS). Glass uses local disk -- safe.

```javascript
// In mind/taskRegistry.js
function writeRegistry(data) {
  const tmp = REGISTRY_FILE + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  renameSync(tmp, REGISTRY_FILE)  // atomic on local POSIX filesystem
}
```

---

## Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `mind/memory.js` | In-session memory, MEMORY.md, addExperience() write-back | MODIFY |
| `mind/memoryStore.js` | BM25 index over experiences.jsonl, retrieveMemories() | NEW |
| `mind/buildPlanner.js` | Blueprint generation, material audit, plan persistence | NEW |
| `mind/taskRegistry.js` | Cross-agent task claim/release, shared_task_registry.json | NEW |
| `mind/index.js` | Orchestration: parallel RAG, memory query, plan context | MODIFY |
| `mind/prompt.js` | Formatting: memory context, build plan context | MODIFY |
| `mind/spatial.js` | Block + entity awareness, post-build scan injection | MODIFY |
| `mind/llm.js` | isThinking() getter (1 line) | MODIFY |
| `body/skills/build.js` | Z-slice pagination for 500+ block builds, completedSlice | MODIFY |
| `body/skills/scan.js` | Already works -- needs registry exposure only | KEEP |
| `mind/registry.js` | !plan and !scan commands | MODIFY |
| `start.js` | Init new modules, background interval | MODIFY |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Background Memory Process

**What people do:** Spawn a child_process or Worker thread for memory indexing.
**Why it is wrong:** Adds IPC complexity, restart dependencies, shared-file race conditions.
The existing architecture is single-process and resilient. The index rebuild takes ~50-200ms
and only needs to run when the agent is idle -- a setInterval is sufficient.
**Do this instead:** Idle-gated setInterval in `start.js`. If idle: rebuild. If busy: skip.

### Anti-Pattern 2: Redis for Multi-Agent State

**What people do:** Add Redis for agent coordination at first sign of shared state.
**Why it is wrong:** Redis is an external process, a deployment dependency, and a restart hazard.
At 2-agent scale the coordination surface is tiny: one shared JSON file with atomic writes.
At 10-agent scale, SQLite (`better-sqlite3`) has the same synchronous API, zero daemon, and
full ACID. Redis adds operational complexity with no benefit until agents > 50.
**Do this instead:** JSONL + atomic rename for v2.3. SQLite upgrade later if warranted.

### Anti-Pattern 3: Blocking Memory Writes in the Hot Path

**What people do:** `await fs.promises.appendFile()` inside think() for experience write-back.
**Why it is wrong:** Async writes in think() create await points that pause the decision loop.
Synchronous `appendFileSync` for a 100-byte JSONL entry completes in <1ms -- always faster than
the overhead of scheduling an async I/O. The event loop is not blocked for a meaningful duration.
**Do this instead:** `appendFileSync` in dispatch handlers and lifecycle hooks. No await.

### Anti-Pattern 4: Single-Call 500-Block Blueprint Generation

**What people do:** Pass the full 500-block blueprint description to the LLM and expect coherent JSON.
**Why it is wrong:** LLMs degrade on large structured JSON generation. Errors compound: one mismatched
palette key invalidates hundreds of grid cells. Build quality degrades asymptotically above ~100 blocks.
**Do this instead:** Decompose into sections (north wall, south wall, roof). Each section is a
separate small blueprint (<100 blocks). `buildPlanner.js` sequences them. Agents can parallelize
sections between themselves.

### Anti-Pattern 5: Replacing spatial.js with Screenshot Vision

**What people do:** Capture a screenshot, send to a vision API for scene understanding.
**Why it is wrong:** Mineflayer provides structured block data that is more accurate than any vision
inference. `bot.findBlocks()` is deterministic and covers 16 blocks in <5ms. A vision API call adds
300-1000ms of latency and a per-call cost. Headless Mineflayer has no display to screenshot anyway.
**Do this instead:** Extend `spatial.js` with richer structured data (entities, containers, light
levels at more offsets). Use `scan.js` for build verification. No screenshots.

---

## Build Order for v2.3

Dependencies run strictly from top to bottom. Each item is a prerequisite for those below it.

```
Phase 1 (Foundation)
  +-- memory.js: add addExperience(), experiences.jsonl path
  +-- memoryStore.js: new module, BM25 index, retrieveMemories()
  +-- start.js: init memoryStore, background interval

Phase 2 (Integration)
  +-- mind/index.js: add memory RAG path (parallel Promise.all), deriveMemoryQuery()
  +-- mind/prompt.js: formatMemoryContext(), inject into buildSystemPrompt()
  +-- VALIDATE: memory retrieval appears in prompts, experiences accumulate in jsonl

Phase 3 (Enhanced Spatial)
  +-- spatial.js: entity awareness tier, post-build scan
  +-- registry.js: !scan command -> scanArea()
  +-- VALIDATE: !scan returns block counts, entities appear in prompt

Phase 4 (Build Planning)
  +-- buildPlanner.js: planBuild(), auditMaterials(), saveBuildPlan()
  +-- body/skills/build.js: Z-slice pagination, completedSlice
  +-- registry.js: !plan command
  +-- VALIDATE: !plan watchtower creates plan file, material audit correct

Phase 5 (Multi-Agent Coordination)
  +-- taskRegistry.js: claimTask(), listTasks(), releaseTasks()
  +-- start.js: init taskRegistry
  +-- VALIDATE: Luna claims task, Max sees claim in registry, no collision

Phase 6 (Memory Consolidation -- optional, phase-gate)
  +-- memory consolidation LLM pass in background interval
  +-- VALIDATE: strategies section grows from experience distillation
```

**Rationale for this order:**
- Phase 1 and 2 are pure mind/ additions with no body/ changes -- lowest risk, highest value.
- Phase 3 requires no new dependencies -- just extending existing modules.
- Phase 4 needs the memory system to record plan outcomes (Phase 1 is a dependency).
- Phase 5 needs single-agent stability with all features working (Phases 1-4 must be green).
- Phase 6 is explicitly optional because the consolidation LLM pass adds complexity and the
  basic memory retrieval (Phase 2) is the 80% solution.

---

## Integration Points Summary

| New Feature | Touch Points | New Files | Modified Files |
|-------------|-------------|-----------|----------------|
| Long-term memory | memory.js, start.js, mind/index.js, prompt.js | `memoryStore.js`, `experiences.jsonl` | `memory.js`, `index.js`, `prompt.js`, `start.js` |
| Background memory agent | start.js, memoryStore.js | -- | `start.js`, `memoryStore.js`, `llm.js` |
| Vision / spatial enhancement | spatial.js, registry.js | -- | `spatial.js`, `registry.js` |
| Build planning (500+ blocks) | build.js, registry.js | `buildPlanner.js`, `data/<agent>/plans/` | `body/skills/build.js`, `mind/registry.js` |
| Multi-agent coordination | taskRegistry.js, start.js | `taskRegistry.js`, `shared_task_registry.json` | `start.js` |

**Mind/Body boundary: UNCHANGED.** All new modules are in `mind/` or `data/`. `body/skills/build.js`
is modified (Z-slice) but the change is purely internal to the body layer -- no body module gains
a mind/ import.

---

## Scaling Considerations

| Scale | Architecture | Notes |
|-------|-------------|-------|
| 2 agents (v2.3 target) | Shared JSONL + atomic rename | Current approach, covers all coordination needs |
| 5-10 agents | Replace task registry with SQLite | Same `taskRegistry.js` interface, swap backing store |
| 10+ agents | SQLite + dedicated index server for memory | memoryStore.js becomes a separate process with HTTP API |

**First bottleneck at scale:** shared file write contention. At 2 agents writing to
`shared_task_registry.json` the atomic rename pattern handles collision perfectly. At 10+ agents
writing concurrently, file lock contention becomes measurable. Migrate to SQLite at that point --
`better-sqlite3` is synchronous, lock-safe, and requires zero changes to the `taskRegistry.js`
public API.

**Second bottleneck:** memory index rebuild time. 2 agents x 1000 experiences each = 2000 entries,
BM25 rebuild in ~100ms. At 10 agents x 5000 entries = 50,000 entries, rebuild takes ~2-3s. At
that scale, the in-memory BM25 is replaced by a persistent index with incremental updates.

---

## Sources

### Primary (HIGH confidence -- direct codebase reads)
- `mind/memory.js` -- current memory structure, limits, MEMORY.md format
- `mind/index.js` -- think() loop, RAG path, dispatch handlers, event-driven architecture
- `mind/knowledgeStore.js` -- BM25 + vector indexing pattern (MiniSearch + Vectra + all-MiniLM-L6)
- `mind/spatial.js` -- block awareness tiers, cache pattern
- `body/skills/build.js` -- blueprint execution, activeBuild state, pagination opportunity
- `body/skills/scan.js` -- scanArea() API, volume limits
- `mind/build-history.js` -- shared file pattern (read-modify-write)
- `start.js` -- init sequence, periodic save pattern, setInterval usage
- `launch-duo.sh` + `mind/config.js` -- multi-agent deployment, per-agent data dirs

### Secondary (MEDIUM confidence)
- `data/shared_build_history.json` pattern -- confirms shared file approach is already established
- Existing MiniSearch usage in `knowledgeStore.js` -- confirms BM25 works at 2,677 chunks in ~50ms
- Existing `appendFileSync` usage in `memory.js` session logging -- confirms sync write is standard

---

*Architecture research for: HermesCraft v2.3 -- Persistent Memory and Ambitious Building*
*Researched: 2026-03-23*
*Confidence: HIGH -- all integration points verified against direct codebase reads*
