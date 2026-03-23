# Phase 21: Multi-Agent Coordination - Research

**Researched:** 2026-03-23
**Domain:** Node.js multi-process coordination via shared JSON files, chat loop prevention, spatial task splitting for LLM agents
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Shared JSON + atomic renameSync for coordination (no Redis)
- Task claiming via shared file in a common data directory (`data/shared/coordination.json`)
- Chat loop prevention: force non-chat action after 3 consecutive chats
- Build section assignment: spatial decomposition from Phase 19 buildPlanner
- Partner activity sharing via shared state file

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user
setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COO-01 | Shared task registry — agents claim tasks to prevent duplicate work | `mind/taskRegistry.js` (new) + `data/shared/coordination.json` using atomic rename pattern already proven in `backgroundBrain.js` |
| COO-02 | Chat deduplication limiter — prevent conversation loops between agents | `consecutiveChatCount` counter in `mind/index.js` + force non-chat after 3 consecutive; intercept point is the think() dispatch block |
| COO-03 | Spatial task splitting for builds — decompose builds into sections assigned to each agent | `buildPlanner.js` already generates sections with a `claimedBy: null` field ready for use; only claiming logic needed |
| COO-04 | Activity broadcasting — agents see what partner is doing without asking | `data/shared/activity.json` written by each agent on every skill dispatch; read into system prompt via new `getPartnerActivityForPrompt()` |
</phase_requirements>

---

## Summary

Phase 21 implements coordination infrastructure for Luna and Max to run together without stepping on each other. The codebase is already staged for this: `buildPlanner.js` sections have `claimedBy: null` fields, `backgroundBrain.js` demonstrates the exact write-tmp-rename-atomic pattern, and `data/luna/` and `data/max/` per-agent directories are already isolated. The prior architecture research (ARCHITECTURE.md) designed the exact solution — this phase is implementation, not design.

The four requirements decompose cleanly into three new data files and two new modules. `COO-01` needs `mind/taskRegistry.js` and `data/shared/task-registry.json`. `COO-04` needs activity broadcasting via `data/shared/activity-<agent>.json` per agent (separate per-writer to eliminate concurrent-write risk), read into prompt by `mind/coordination.js`. `COO-02` (chat limiter) is a 10-line change in `mind/index.js`. `COO-03` (section assignment) is a `claimBuildSection(agentName, planId, sectionId)` function wired into the `!plan` / `!build` dispatch handlers.

**Primary recommendation:** Implement as two focused modules (`mind/taskRegistry.js` + `mind/coordination.js`) wired into three touch points (`start.js`, `mind/index.js`, `mind/prompt.js`). Zero new npm packages. All coordination via `data/shared/` directory.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fs` (Node built-in) | Node 24.11.1 (current env) | `readFileSync`, `writeFileSync`, `renameSync`, `existsSync`, `mkdirSync` | Already used everywhere in this codebase; no new dependency |
| `crypto` (Node built-in) | same | `randomUUID()` for task IDs | Already used in `buildPlanner.js` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `better-sqlite3` | ^12.8.0 (already in package.json) | Future upgrade path if > 5 agents | Not needed for Phase 21 — file JSON is sufficient at 2-agent scale |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared JSON + atomic rename | Redis pub/sub | Redis adds external process dependency; overkill at 2 agents. ARCHITECTURE.md explicitly rejects Redis. |
| Shared JSON + atomic rename | SQLite (better-sqlite3) | Already in package.json; valid upgrade path for 5+ agents. Keep for later. At 2 agents, JSON is simpler and debuggable with `cat`. |
| Per-agent activity files | Single shared activity file | Per-agent files (`activity-luna.json`, `activity-max.json`) eliminate concurrent-write collisions — each agent is sole writer to its own file. Always prefer per-writer file isolation over shared files. |

**Installation:** No new packages needed. All coordination uses existing Node.js built-ins.

---

## Architecture Patterns

### Recommended Project Structure

```
mind/
├── taskRegistry.js    # NEW: task claim/release, data/shared/task-registry.json
├── coordination.js    # NEW: activity broadcast read/write, getPartnerActivityForPrompt()
├── index.js           # MODIFY: consecutiveChatCount, claim check in dispatch, init coordination
├── prompt.js          # MODIFY: add partnerActivity option to buildSystemPrompt()
└── buildPlanner.js    # MODIFY: claimBuildSection(), releaseSection(), sectionOwner()

data/
└── shared/
    ├── task-registry.json      # Cross-agent task claims (written by either agent atomically)
    ├── activity-luna.json      # Luna broadcasts her current activity (sole writer = no collision)
    └── activity-max.json       # Max broadcasts his current activity (sole writer = no collision)

start.js               # MODIFY: init taskRegistry + coordination modules
```

### Pattern 1: Atomic Read-Modify-Write (task claiming)

**What:** Read registry, check claim, write claim atomically. If another agent claimed between read
and write, detect on the next read — no lock file needed at 2-agent scale.

**When to use:** Any shared JSON file where two processes could write simultaneously.

**Example:**
```javascript
// Source: backgroundBrain.js writeBrainState() — verified in codebase
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs'

function writeRegistry(data) {
  const tmp = REGISTRY_FILE + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  renameSync(tmp, REGISTRY_FILE)  // POSIX atomic on local disk
}

export function claimTask(agentName, taskId) {
  const data = loadRegistry()
  const task = data.tasks.find(t => t.id === taskId)
  if (!task || task.claimedBy !== null) return false  // already claimed
  task.claimedBy = agentName
  task.claimedAt = new Date().toISOString()
  task.status = 'active'
  writeRegistry(data)
  return true
}
```

### Pattern 2: Per-Writer Activity Files (activity broadcasting)

**What:** Each agent writes ONLY to its own activity file. The partner reads the other agent's file.
This eliminates any concurrent-write risk for COO-04 completely.

**When to use:** Any broadcast pattern where N agents each have distinct data to share.

**Example:**
```javascript
// mind/coordination.js
const ACTIVITY_FILE = join(DATA_DIR, '..', 'shared', `activity-${agentName}.json`)
const ACTIVITY_TMP  = ACTIVITY_FILE + '.tmp'

export function broadcastActivity(agentName, activity) {
  // activity: { command, args, startedAt, status: 'running'|'complete'|'idle' }
  const content = JSON.stringify({ ...activity, agent: agentName, ts: Date.now() }, null, 2)
  writeFileSync(ACTIVITY_TMP, content, 'utf-8')
  renameSync(ACTIVITY_TMP, ACTIVITY_FILE)  // atomic
}

export function getPartnerActivityForPrompt(partnerName) {
  const partnerFile = join(DATA_DIR, '..', 'shared', `activity-${partnerName}.json`)
  try {
    const raw = readFileSync(partnerFile, 'utf-8')
    const data = JSON.parse(raw)
    const ageS = Math.round((Date.now() - data.ts) / 1000)
    if (ageS > 120) return null  // stale — partner may be offline
    return `${partnerName} is ${data.status === 'idle' ? 'idle' : `${data.status}: ${data.command} ${JSON.stringify(data.args || {}).slice(0, 60)}`} (${ageS}s ago)`
  } catch {
    return null  // ENOENT or parse error — partner not yet active
  }
}
```

### Pattern 3: Chat Loop Prevention Counter

**What:** Module-level `consecutiveChatCount` in `mind/index.js`. Incremented when LLM picks
`!chat`; reset to 0 on any other command. When count reaches 3, inject a directive into the
next user message to force a non-chat action.

**When to use:** COO-02. Plugs into the existing think() result dispatch block.

**Example:**
```javascript
// mind/index.js — addition to existing dispatch block
let consecutiveChatCount = 0  // module-level

// In think(), after result = await queryLLM(...)
if (result.command === 'chat') {
  consecutiveChatCount++
} else {
  consecutiveChatCount = 0
}

// In buildUserMessage call (before queryLLM), inject enforcement:
const chatLimitWarning = consecutiveChatCount >= 3
  ? `\n⚠ You've sent ${consecutiveChatCount} chats in a row. TAKE ACTION now — no more !chat until you do something.`
  : null
```

### Pattern 4: Build Section Claiming

**What:** Extend `buildPlanner.js` with three functions that use the existing `claimedBy: null`
field already present on every section. Wire into mind/index.js when the LLM calls `!build`
during an active plan.

**When to use:** COO-03. When a `!build` command fires and a multi-section plan is active,
the agent claims the next unclaimed section before starting.

**Example:**
```javascript
// mind/buildPlanner.js additions
export function claimBuildSection(agentName, planId) {
  const plan = loadBuildPlan(planId)
  if (!plan) return null
  // Find first pending section not claimed by another agent
  const section = plan.sections.find(s =>
    s.status === 'pending' && (s.claimedBy === null || s.claimedBy === agentName)
  )
  if (!section) return null
  section.claimedBy = agentName
  section.claimedAt = new Date().toISOString()
  saveBuildPlan(plan)  // already uses atomic rename
  return section
}

export function releaseSection(agentName, planId, sectionId) {
  const plan = loadBuildPlan(planId)
  if (!plan) return
  const section = plan.sections.find(s => s.id === sectionId && s.claimedBy === agentName)
  if (section) {
    section.claimedBy = null
    section.claimedAt = null
    saveBuildPlan(plan)
  }
}
```

### Anti-Patterns to Avoid

- **Shared single activity file with two writers:** Two agents simultaneously writing
  `data/shared/activity.json` will corrupt it. Always use per-writer files.
- **Redis for 2-agent coordination:** Architecture decision in STATE.md — rejected. Adds external
  process dependency with zero benefit at this scale.
- **Polling task registry on every tick:** taskRegistry reads belong in think() only, not in the
  300ms body tick. The body tick is synchronous and performance-sensitive.
- **Chat count reset on idle:** Reset `consecutiveChatCount` only on a non-chat SKILL dispatch, not
  on `!idle` — idle is a non-action that shouldn't allow the chat budget to refill.
- **Blocking renameSync with a lock file:** `renameSync` is already atomic on Linux local disk.
  No additional lock file is needed at 2-agent scale.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom file locking / lockfile pattern | `writeFileSync(tmp) + renameSync(tmp, target)` | POSIX rename is atomic; lock files add complexity and can leak on crash |
| Task IDs | timestamp-based IDs | `randomUUID().slice(0, 8)` from `crypto` | Already used in `buildPlanner.js` — consistent pattern |
| Stale claim detection | Complex heartbeat protocol | `claimedAt` timestamp + 10-minute TTL check on read | Simple, debuggable, no coordination overhead |
| Partner position visibility | Custom spatial query | `data/shared/activity-<partner>.json` already has `args` which can include coordinates | Reuse existing broadcast payload |

**Key insight:** The atomic rename pattern is the only non-trivial coordination primitive needed.
Everything else is JSON reads and counter increments.

---

## Common Pitfalls

### Pitfall 1: Both Agents Read Then Write Simultaneously (Lost Update)

**What goes wrong:** Luna reads `task-registry.json`, sees task unclaimed. Max reads it at the
same time, also sees it unclaimed. Both write their claim. Max's write wins (it happened last),
overwriting Luna's claim. Luna proceeds with the task anyway because her `claimTask()` returned
`true`. Both agents work the same section.

**Why it happens:** Read-modify-write is not atomic even with `renameSync`. The rename only
makes the write atomic, not the read-check-write cycle.

**How to avoid:** After claiming, re-read the file and verify the claim survived. If
`data.tasks[i].claimedBy !== agentName` after write, another agent claimed it first. Abort
and find the next unclaimed task. This is optimistic concurrency: write, then verify.

```javascript
export function claimTask(agentName, taskId) {
  const data = loadRegistry()
  const task = data.tasks.find(t => t.id === taskId)
  if (!task || task.claimedBy !== null) return false
  task.claimedBy = agentName
  task.claimedAt = new Date().toISOString()
  task.status = 'active'
  writeRegistry(data)

  // Verify claim survived (optimistic concurrency check)
  const verify = loadRegistry()
  const claimed = verify.tasks.find(t => t.id === taskId)
  return claimed?.claimedBy === agentName
}
```

**Warning signs:** Both agents log `[coordination] claimed task X` for the same task ID.

### Pitfall 2: Shared Task Registry File Never Created on First Start

**What goes wrong:** Luna starts, calls `loadRegistry()`, file does not exist (first ever run),
returns null or throws. Luna crashes on startup instead of gracefully initializing an empty registry.

**Why it happens:** Cold-start initialization is not handled. `existsSync` check is missing.

**How to avoid:** `loadRegistry()` must handle ENOENT with an empty default:
```javascript
function loadRegistry() {
  try {
    return JSON.parse(readFileSync(REGISTRY_FILE, 'utf-8'))
  } catch {
    return { tasks: [], lastUpdated: null }  // ENOENT or corrupt — empty is fine
  }
}
```
And `initTaskRegistry()` must create the `data/shared/` directory:
```javascript
export function initTaskRegistry(config) {
  SHARED_DIR = join(dirname(config.dataDir), 'shared')
  mkdirSync(SHARED_DIR, { recursive: true })
  REGISTRY_FILE = join(SHARED_DIR, 'task-registry.json')
}
```

**Warning signs:** `ENOENT: no such file or directory, open 'data/shared/task-registry.json'`
on first launch.

### Pitfall 3: Chat Count Resets Too Eagerly

**What goes wrong:** Agent chats twice, then calls `!idle`. `consecutiveChatCount` resets to 0
because idle is "not chat." On the next tick, the agent chats again. The loop limit never
actually prevents a run of chat + idle + chat + idle + chat forever.

**Why it happens:** Idle is treated as "an action" but it is really "no action."

**How to avoid:** Reset `consecutiveChatCount` only on skills that have observable world
effect. Specifically: any command that goes through `dispatch()` and completes with
`skillResult.success === true`. `!idle` and `!chat` should NOT reset the counter.

**Warning signs:** Server chat log shows 10+ messages from a bot with `[mind] idle command`
lines interspersed but no `[mind] dispatching:` lines for real skills.

### Pitfall 4: Partner Activity File from Previous Session Misleads Agent

**What goes wrong:** Luna ran yesterday and wrote `activity-luna.json` saying "running: navigate".
Max starts today and reads that file. It is 18 hours stale. Max's prompt says "Luna is running:
navigate (64800s ago)" — confusing but harmless. However, if the prompt logic doesn't age-gate
the read, Max might defer a task thinking Luna is handling it.

**Why it happens:** No TTL on the activity file read.

**How to avoid:** `getPartnerActivityForPrompt()` must check the `ts` field and return `null`
(not inject anything) if the activity is older than 120 seconds. This makes the partner appear
offline if they haven't broadcast recently.

**Warning signs:** Max's system prompt shows partner activity with `(64800s ago)` or similar
very large ages.

### Pitfall 5: Build Section Claim Not Released on Crash

**What goes wrong:** Luna claims `north_wall` and crashes mid-build. Section has `claimedBy: 'luna'`
and `status: 'active'` forever. Max sees `north_wall` as claimed and skips it. The north wall
never gets built.

**Why it happens:** Crash recovery doesn't release stale claims.

**How to avoid:** Two-part solution:
1. On startup, `initTaskRegistry()` scans all sections in all active plans and releases any
   claims held by THIS agent that are older than 10 minutes.
2. `claimBuildSection()` checks `claimedAt` timestamp: if a section is claimed by another
   agent but the claim is older than 10 minutes, treat it as expired and allow re-claiming.

**Warning signs:** Both agents are idle but a plan shows 100% of sections with `claimedBy`
set and none with `status: 'done'`.

---

## Code Examples

### Verified Atomic Write Pattern (from backgroundBrain.js lines 112-116)

```javascript
// Source: mind/backgroundBrain.js writeBrainState() — direct codebase read
const content = JSON.stringify(state, null, 2)
writeFileSync(BRAIN_STATE_TMP, content, 'utf-8')
renameSync(BRAIN_STATE_TMP, BRAIN_STATE_FILE)  // atomic on POSIX local disk
```

### Verified Per-Agent Init Pattern (from buildPlanner.js lines 76-81)

```javascript
// Source: mind/buildPlanner.js initBuildPlanner() — direct codebase read
export function initBuildPlanner(config) {
  _buildsDir = join(config.dataDir, 'builds')
  if (!existsSync(_buildsDir)) {
    mkdirSync(_buildsDir, { recursive: true })
  }
}
```

### Verified Section claimedBy Field (buildPlanner.js line 353)

```javascript
// Source: mind/buildPlanner.js planBuild() — direct codebase read
sections.push({
  id: layout.id,
  status: 'pending',
  blueprintFile: blueprintFileRel,
  offsetX: layout.offsetX,
  offsetY: layout.offsetY,
  offsetZ: layout.offsetZ,
  completedIndex: 0,
  blockCount,
  claimedBy: null,    // ← already present, ready to be used
  repairAttempts: 0,
})
```

### System Prompt Option Injection Pattern (from prompt.js lines 239-296)

```javascript
// Source: mind/prompt.js buildSystemPrompt() — direct codebase read
// Pattern: options.X checked with `if (options.X)` then pushed as a string part
if (options.partnerActivity) {
  parts.push(`## Partner Activity\n${options.partnerActivity}`)
}
```

### Chat Dispatch Intercept Point (from mind/index.js lines 541-548)

```javascript
// Source: mind/index.js think() — direct codebase read
// This is where COO-02 counter increments:
console.log('[mind] dispatching:', result.command, result.args)
skillRunning = true
const skillResult = await dispatch(bot, result.command, result.args)
skillRunning = false
// ← COO-02: increment/reset consecutiveChatCount here, before this dispatch
// ← COO-04: broadcastActivity() here on skillResult.success
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No coordination | Shared JSON + atomic rename | Phase 21 (this phase) | Luna/Max work independently without collision |
| Agents talk until one acts | Chat counter cap at 3 | Phase 21 | Eliminates ping-pong loops |
| Both agents blindly work sections | Section claiming with TTL | Phase 21 | No duplicate section builds |
| Partner state via in-game chat only | Shared activity broadcast files | Phase 21 | Each agent sees partner status without asking |

**Deprecated/outdated:**
- Checking partner chat via `social.js getPartnerLastChat()` for activity awareness: still useful
  for conversation context, but insufficient for COO-04 (activity broadcasting). The activity
  broadcast file is authoritative for "what is partner doing right now."

---

## Open Questions

1. **Should task registry track gather/mine tasks, or only build sections?**
   - What we know: COO-01 says "shared task registry — agents claim tasks to prevent duplicate
     work." Pitfall 8 in PITFALLS.md describes both mining duplicates and build section conflicts.
   - What's unclear: For v2.3, agents are in `open_ended` mode — they decide their own tasks.
     The task registry is only useful if agents WRITE to it when they start a task.
   - Recommendation: For Phase 21, scope the registry to BUILD SECTIONS only (COO-03 + COO-01
     overlap). Mining task claiming requires the LLM to proactively write to the registry before
     mining, which is harder to enforce. Build sections are claimed programmatically in code.

2. **Where to inject the chat limit warning — system prompt or user message?**
   - What we know: `consecutiveChatCount >= 3` triggers the enforcement message.
   - What's unclear: System prompt injection (every tick) vs user message injection (on the
     specific tick where count hits 3) — the user message is more focused and costs fewer tokens.
   - Recommendation: Inject into the user message as a single `⚠` line, only when count is 3+.
     This follows the same pattern as the existing `⚠ ${partnerChat.sender} just spoke to you`
     injection in `buildUserMessage()`.

3. **Should `data/shared/` be created by start.js or by each module's init?**
   - What we know: Per-agent dirs are created in `loadAgentConfig()` via `mkdirSync(dataDir, { recursive: true })`. Module-level dirs are created in each module's `init*()` function (see `initBuildPlanner`).
   - Recommendation: Follow the module-init pattern. `initTaskRegistry(config)` creates
     `data/shared/`. This keeps module initialization self-contained.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — all coordination uses Node.js built-in `fs` module
and existing project dependencies. No new tools, services, or CLIs required.)

---

## Project Constraints (from CLAUDE.md)

All directives from `CLAUDE.md` enforced throughout this phase:

- **Mind/Body boundary:** Only `mind/registry.js` imports from `body/`. All new coordination
  modules (`taskRegistry.js`, `coordination.js`) live in `mind/`. No body module gains a mind import.
- **Atomic writes required:** All shared file writes use `writeFileSync(tmp) + renameSync(tmp, target)`.
- **camelCase exports, named only:** `claimTask`, `releaseTask`, `initTaskRegistry`,
  `broadcastActivity`, `getPartnerActivityForPrompt`. No default exports.
- **Module header comment:** Every new file begins with `// filename.js — Purpose description`.
- **Init pattern:** New modules export `initTaskRegistry(config)`, `initCoordination(config)`.
- **Module-level state:** `let _registryFile = ''`, `let _sharedDir = ''` — lowercase with leading
  `_` for module-private state.
- **Error handling:** All `JSON.parse()` calls wrapped in try/catch with empty fallback.
- **No artificial delays/throttling:** Chat counter prevents loops; does not add timer delays.
- **Logging:** `[task-registry]` and `[coordination]` prefixes; no direct `console.log` in
  business logic files — wired through `mind/index.js` which owns the log calls.
- **GSD Workflow Enforcement:** All changes must go through `/gsd:execute-phase`.
- **Test before deploy:** New modules must have smoke test assertions added to
  `tests/smoke.test.js` before any plan is complete.

---

## Smoke Test Requirements

`nyquist_validation` is `false` in `.planning/config.json` — no automated test framework.
All validation is source-level smoke tests via `node tests/smoke.test.js`.

New assertions to add to `tests/smoke.test.js`:

```javascript
// Section: Module Import Validation — mind/ (add after backgroundBrain asserts)
const taskRegistry = await import('../mind/taskRegistry.js')
assert('mind/taskRegistry: initTaskRegistry exported', typeof taskRegistry.initTaskRegistry === 'function')
assert('mind/taskRegistry: claimTask exported', typeof taskRegistry.claimTask === 'function')
assert('mind/taskRegistry: releaseTask exported', typeof taskRegistry.releaseTask === 'function')
assert('mind/taskRegistry: listTasks exported', typeof taskRegistry.listTasks === 'function')

const coordination = await import('../mind/coordination.js')
assert('mind/coordination: initCoordination exported', typeof coordination.initCoordination === 'function')
assert('mind/coordination: broadcastActivity exported', typeof coordination.broadcastActivity === 'function')
assert('mind/coordination: getPartnerActivityForPrompt exported', typeof coordination.getPartnerActivityForPrompt === 'function')

// Section: buildPlanner section claiming
assert('buildPlanner: claimBuildSection exported', typeof buildPlanner.claimBuildSection === 'function')
assert('buildPlanner: releaseSection exported', typeof buildPlanner.releaseSection === 'function')

// Section: coordination behavior
// taskRegistry cold-start: calling initTaskRegistry with a config should not throw
const tmpDir = '/tmp/hermescraft-smoke-test-' + Date.now()
taskRegistry.initTaskRegistry({ dataDir: tmpDir + '/luna' })
const tasks = taskRegistry.listTasks()
assert('taskRegistry: listTasks returns array after cold init', Array.isArray(tasks))
assert('taskRegistry: listTasks empty on cold init', tasks.length === 0)

// coordination cold-start: getPartnerActivityForPrompt returns null when no file exists
coordination.initCoordination({ dataDir: tmpDir + '/luna', partnerName: 'max' })
const activity = coordination.getPartnerActivityForPrompt()
assert('coordination: getPartnerActivityForPrompt returns null when partner file missing', activity === null)

// prompt: partnerActivity option injects into system prompt
const activityPrompt = prompt.buildSystemPrompt(mockBot, { partnerActivity: 'max is running: mine iron_ore' })
assert('prompt: partnerActivity option injects into system prompt', activityPrompt.includes('max is running'))
```

---

## Files to Create/Modify

| File | Action | Reason |
|------|--------|--------|
| `mind/taskRegistry.js` | CREATE | COO-01: shared task registry for build section claims |
| `mind/coordination.js` | CREATE | COO-04: activity broadcast read/write + prompt format |
| `mind/buildPlanner.js` | MODIFY | COO-03: add `claimBuildSection()`, `releaseSection()`, stale-claim cleanup |
| `mind/index.js` | MODIFY | COO-02: `consecutiveChatCount` + warning injection; COO-04: `broadcastActivity()` call after dispatch |
| `mind/prompt.js` | MODIFY | COO-04: add `partnerActivity` option to `buildSystemPrompt()` |
| `start.js` | MODIFY | Wire `initTaskRegistry(config)` + `initCoordination(config)` into startup sequence |
| `tests/smoke.test.js` | MODIFY | Add assertions for all new exports and behavior contracts |

---

## Sources

### Primary (HIGH confidence — direct codebase reads)

- `mind/backgroundBrain.js` — atomic write pattern (writeBrainState), confirmed working
- `mind/buildPlanner.js` — section structure with `claimedBy: null`, `saveBuildPlan` atomic write
- `mind/index.js` — think() loop, chat dispatch location, respondToChat guard pattern
- `mind/prompt.js` — buildSystemPrompt() option injection pattern, buildUserMessage() warning injection
- `mind/config.js` — agent name, partnerName, dataDir structure
- `start.js` — module init sequence, how new modules should be wired
- `mind/social.js` — getPartnerLastChat() pattern (reference for activity broadcast design)
- `.planning/research/ARCHITECTURE.md` — Section 5: Multi-Agent Coordination (task registry schema)
- `.planning/research/PITFALLS.md` — Pitfall 4 (chat loops), Pitfall 5 (shared state corruption), Pitfall 8 (duplicate work)
- `tests/smoke.test.js` — existing test pattern; 513 tests passing baseline confirmed

### Secondary (MEDIUM confidence — prior research synthesis)

- `.planning/research/STACK.md` — Redis vs shared JSON evaluation; `better-sqlite3` as upgrade path
- `.planning/research/FEATURES.md` — Mindcraft MineCollab paper: pre-task assignment vs real-time coordination
- `.planning/STATE.md` — architectural decisions: shared JSON + atomic rename confirmed as project standard

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified in codebase
- Architecture: HIGH — ARCHITECTURE.md Section 5 designed this exact solution; codebase staged for it
- Pitfalls: HIGH — PITFALLS.md Section 4+5+8 documented from prior research; optimistic concurrency race verified as real concern

**Research date:** 2026-03-23
**Valid until:** 2026-06-23 (stable domain — Node.js fs module, no external services)
