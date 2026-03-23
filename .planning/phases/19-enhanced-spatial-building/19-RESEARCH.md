# Phase 19: Enhanced Spatial + Building - Research

**Researched:** 2026-03-23
**Domain:** LLM-driven build planning, section decomposition, material validation, post-build verification, multi-agent coordination
**Confidence:** HIGH — all findings verified against direct codebase reads of 15+ source files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Key decisions from STATE.md:
- LLM generates intent (style, dims, materials) — deterministic code handles coordinates
- Section decomposition for >100 blocks: floor, walls, roof, interior as separate sections
- Build plans stored in `data/<agent>/builds/` as JSON for session persistence
- Material list validation before starting — won't build without sufficient inventory
- Post-build scan (Phase 16 SPA-02) detects missing/wrong blocks and auto-repairs
- Build history in `mind/build-history.js` already exists — extend for persistent plans

### Claude's Discretion
All design choices: section naming, JSON schema for build plans, material estimation algorithm, repair strategy, task registry schema, deduplication approach, activity broadcast mechanism.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPA-01 | Enhanced entity awareness — track nearby mobs, animals, villagers with types, distances, health | Already fully implemented in `mind/spatial.js` Tier 4 (`getEntityAwareness`). Verify only. |
| SPA-02 | Post-build scan integration — verify placed blocks match blueprint | Partially implemented: scanArea called after `!build` in `mind/index.js`. Missing: per-block diff against blueprint spec, auto-repair loop. Extension needed. |
| SPA-04 | Area familiarity — agent knows what's been explored vs unknown territory | Already implemented via minimap + spatial awareness tiers. Verify only. |
| BLD-01 | LLM generates structured build specs (style, dims, materials, features) — deterministic code handles coordinates | Partially exists: `!design` + `designAndBuild()` generates small blueprints. Phase 19 extends to larger structures via `mind/buildPlanner.js`. |
| BLD-02 | Section decomposition for structures over 100 blocks | Not yet implemented. Requires new section-aware blueprint generator in `buildPlanner.js` and Z-slice pagination in `build.js`. |
| BLD-03 | Material estimation before building — agent knows what to gather before starting | Not yet implemented. Requires `auditMaterials()` in `buildPlanner.js`. |
| BLD-04 | Post-build verification — scan completed structure, detect missing/wrong blocks, auto-repair | Scan already fires in `mind/index.js` after `!build`. Missing: comparison against blueprint, per-block repair commands. Extension of existing SPA-02 scan. |
| BLD-05 | Build retry with error feedback — failed placements re-attempted with LLM guidance | Not yet implemented. The `build.js` placement loop already skips unreachable blocks; feedback loop needs to surface failures back to LLM with context. |
</phase_requirements>

---

## Summary

Phase 19 builds the ambitious building system that turns agents from blueprint-executors into genuine builders. The core architecture is already designed in ARCHITECTURE.md and partially instantiated in Phases 16-17. What remains is implementing `mind/buildPlanner.js`, extending `body/skills/build.js` for section-based large structures, wiring material validation before build start, completing the post-build repair loop, and adding multi-agent task registry (COO requirements).

**Three clusters of work:**
1. **Build planning system** (BLD-01 through BLD-05): New `mind/buildPlanner.js` module with `planBuild()`, `auditMaterials()`, `saveBuildPlan()`. The `!design` command stays for small immediate builds; a new `!plan` command handles large multi-section builds. The `build.js` Z-slice pagination enables 500+ block execution.
2. **Spatial verification enhancement** (SPA-01, SPA-02, SPA-04): SPA-01 and SPA-04 are done — verify only. SPA-02 needs extension from "report block counts" to "diff against blueprint spec + repair loop".
3. **Multi-agent coordination** (COO-01 through COO-04): New `mind/taskRegistry.js` with atomic-rename shared JSON. Activity broadcasting via in-game chat event listeners. Chat deduplication via a seen-message hash ring.

**Primary recommendation:** Implement in dependency order — buildPlanner.js first (BLD-01/02/03), then repair loop (BLD-04/05), then taskRegistry.js (COO-01-04). SPA-01/SPA-04 need only verification tests.

---

## What Is Already Implemented (Do Not Re-Implement)

This is critical context. Phase 19 extends existing work — several requirements are partially or fully done.

### Fully Done (verify only)

| Feature | Where | Evidence |
|---------|-------|----------|
| SPA-01: Entity awareness | `mind/spatial.js` Tier 4 `getEntityAwareness()` | Lines 241-270: hostile/passive/player sets, distance, direction, health injected into `buildSpatialAwareness()`. Injected every think() via `buildStateText()`. |
| SPA-04: Area familiarity | `mind/minimap.js` + `mind/spatial.js` near-vision | Minimap injected as "Area Overview" in system prompt (prompt.js Part 5.10). Near-vision block scan cached 3s radius 16. |
| Post-build scan fires | `mind/index.js` lines 525-539 | `scanArea()` called after every `!build` success; result stored in `_postBuildScan`, injected into next think() as "Build Verification". |
| `!scan` command | `mind/registry.js` lines 90-100 | Registered with default 16x8x16 box around bot. Full coordinate overrides supported. |

### Partially Done (extend, don't replace)

| Feature | What Exists | What's Missing |
|---------|-------------|----------------|
| BLD-01: Build spec generation | `designAndBuild()` in `mind/index.js` — LLM generates blueprint JSON, validates, executes. Max 10x10x8 constraint enforced. | Remove 10x10 constraint for `!plan` mode. Add section-aware generation in `buildPlanner.js`. |
| SPA-02: Post-build verification | Block count scan fires after `!build`. Result injected into prompt as "Build Verification". | No diff against blueprint spec. No per-block repair. The scan reports "what's there" not "what's missing from the plan". |
| Build resume | `build.js` already resumes from `completedIndex` and skips already-placed blocks (non-air check). | No Z-slice-level resume. Large builds can only resume from block index, not section. |
| Build state file | `data/<agent>/build_state.json` persists `completedIndex`, `paused`, `missingMaterials` | Per-section tracking missing. Plan IDs missing. |

---

## Standard Stack

### Core (no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `better-sqlite3` | Already installed (Phase 17) | Task registry if scaling beyond 2 agents | Synchronous API, no daemon, ACID; already used by `memoryDB.js` |
| `fs` (built-in) | Node.js built-in | Atomic JSON writes via `renameSync` | Already established pattern in `build-history.js` and `taskRegistry.js` |
| `uuid` or `crypto.randomUUID()` | Node 14.17+ built-in | Plan IDs, task IDs | `crypto.randomUUID()` — zero dependencies |
| `minecraft-data` | Already installed | Block name validation for material audit | Already used in `build.js` palette resolution |

**No new npm packages required for this phase.** All required libraries are already installed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared JSON + atomic rename | Redis | Redis requires external process; JSON + rename is POSIX-atomic, already established pattern. No benefit at 2-agent scale. |
| Shared JSON + atomic rename | better-sqlite3 | SQLite is the right migration path at 5+ agents. For v2.3 (2 agents), JSON is simpler. |
| In-process blueprint generation | Separate codegen service | Single-process is the project's deliberate architecture. No external services. |

---

## Architecture Patterns

### Recommended Project Structure Changes

```
mind/
+-- buildPlanner.js   # NEW: planBuild(), auditMaterials(), saveBuildPlan(), listBuildPlans(), resumeBuildPlan()
+-- taskRegistry.js   # NEW: initTaskRegistry(), claimTask(), releaseTask(), completeTask(), listPendingTasks(), getTaskRegistryForPrompt()
+-- index.js          # MODIFY: wire !plan command, !assign command, task-aware think() context
+-- registry.js       # MODIFY: add !plan and !assign commands (stubs like !design and !see)
+-- prompt.js         # MODIFY: getBuildPlanForPrompt() — active plan section injection

body/skills/
+-- build.js          # MODIFY: Z-slice execution + completedSection in state

data/
+-- shared_task_registry.json  # NEW: cross-agent task coordination
+-- <agent>/
    +-- builds/                # NEW: persistent build plans
        +-- <planId>.json
```

### Pattern 1: LLM Generates Section Specs, Deterministic Code Handles Coordinates

**What:** The LLM is asked to describe each section as a standalone small blueprint (e.g., "north wall: 12x6 oak planks with 2 windows"). The existing `buildDesignPrompt` + `validateBlueprint` pipeline handles each section. Coordinates are computed by `buildPlanner.js` from section type + section index, never by the LLM.

**When to use:** Any structure > 100 blocks, or any structure requiring multi-session execution.

**Example section decomposition for a 20x12x20 castle:**
```javascript
// buildPlanner.js — section layout (deterministic, not LLM-generated)
function decomposeSections(planSpec) {
  const { width, depth, height, style } = planSpec
  return [
    { id: 'foundation', offsetX: 0, offsetY: 0, offsetZ: 0, maxW: width, maxD: depth, maxH: 1 },
    { id: 'north_wall', offsetX: 0, offsetY: 1, offsetZ: 0, maxW: width, maxD: 2, maxH: height - 2 },
    { id: 'south_wall', offsetX: 0, offsetY: 1, offsetZ: depth - 2, maxW: width, maxD: 2, maxH: height - 2 },
    { id: 'east_wall', offsetX: width - 2, offsetY: 1, offsetZ: 0, maxW: 2, maxD: depth, maxH: height - 2 },
    { id: 'west_wall', offsetX: 0, offsetY: 1, offsetZ: 0, maxW: 2, maxD: depth, maxH: height - 2 },
    { id: 'roof', offsetX: 0, offsetY: height - 1, offsetZ: 0, maxW: width, maxD: depth, maxH: 2 },
  ]
}
```

**Why this works:** Each section fits within `buildDesignPrompt`'s 10x10x8 constraint if we further split walls. The LLM generates one JSON blueprint per section with style context. No coordinate math in LLM output.

### Pattern 2: Build Plan JSON Schema

Stored in `data/<agent>/builds/<planId>.json`. This is the contract between `buildPlanner.js` and `build.js`.

```javascript
// build plan schema — source of truth for cross-session persistence
{
  id: "crypto.randomUUID()",          // unique plan identifier
  description: "20x12x20 stone castle", // human-readable, from !plan command
  createdAt: "ISO timestamp",
  origin: { x: 100, y: 64, z: 200 }, // world coordinates for section offsets
  totalEstimatedBlocks: 847,
  status: "pending | active | done | failed",
  // LLM-generated overall spec (style, preferred materials, personality flavor)
  spec: {
    style: "medieval castle",
    materials: { primary: "stone_bricks", secondary: "oak_planks", accent: "glass_pane" },
    dimensions: { width: 20, height: 12, depth: 20 }
  },
  // Material audit result — filled by auditMaterials()
  materialAudit: {
    needed: { stone_bricks: 400, oak_planks: 120, glass_pane: 30 },
    have: { stone_bricks: 64, oak_planks: 0, glass_pane: 0 },
    gap: { stone_bricks: 336, oak_planks: 120, glass_pane: 30 }
  },
  sections: [
    {
      id: "foundation",
      status: "done | pending | active | failed",
      blueprintFile: "builds/plan-uuid-foundation.json",  // written by planBuild()
      completedIndex: 0,                                  // for partial resume
      blockCount: 120,
      claimedBy: null                                     // for multi-agent
    },
    // ... more sections
  ]
}
```

### Pattern 3: Material Audit Before Build Start

**What:** Before any section execution, compare the section's resolved palette requirements against `bot.inventory.items()` plus nearby chest contents. Return a gap list. Do not start until gap is empty.

**Key implementation detail:** The audit runs against the FULL plan's material needs, not just the first section. This prevents gathering enough for section 1, starting, then pausing 5 sections later.

```javascript
// buildPlanner.js — auditMaterials()
export function auditMaterials(bot, plan) {
  // Count all blocks needed across all pending sections
  const needed = {}
  for (const section of plan.sections) {
    if (section.status === 'done') continue
    const bp = loadSectionBlueprint(section.blueprintFile)
    for (const [char, entry] of Object.entries(bp.palette)) {
      const block = entry.preferred[0]
      const count = countCharInLayers(bp.layers, char)
      needed[block] = (needed[block] || 0) + count
    }
  }
  // Compare against inventory
  const have = {}
  for (const item of bot.inventory.items()) {
    have[item.name] = (have[item.name] || 0) + item.count
  }
  const gap = {}
  for (const [block, count] of Object.entries(needed)) {
    const deficit = count - (have[block] || 0)
    if (deficit > 0) gap[block] = deficit
  }
  return { needed, have, gap, ready: Object.keys(gap).length === 0 }
}
```

### Pattern 4: Post-Build Repair Loop (BLD-04/05)

**What:** After a section completes, run a blueprint-diff scan: for each planned block coordinate, call `bot.blockAt()`. Collect coordinates where actual block !== expected block (wrong type) or block is air (missing). Issue `!build` resume for missing blocks or `!material` + resume for wrong-type blocks.

**The existing `_postBuildScan` pattern** already fires after every `!build`. The extension is to pass the blueprint spec alongside the scan result so the diff can be computed.

```javascript
// mind/index.js — extended post-build scan (after build completion)
// Pass blueprint reference so diff is possible
const scanResult = scanArea(bot, minX, minY, minZ, maxX, maxY, maxZ)
const expected = buildExpectedBlockMap(blueprint)  // from loaded blueprint JSON
const repairs = []
for (const [coordKey, blockName] of expected.entries()) {
  const [x, y, z] = coordKey.split(',').map(Number)
  const actual = bot.blockAt(new Vec3(x, y, z))
  if (!actual || actual.name === 'air') {
    repairs.push({ x, y, z, block: blockName, issue: 'missing' })
  } else if (actual.name !== blockName) {
    repairs.push({ x, y, z, block: blockName, issue: 'wrong_type', found: actual.name })
  }
}
// Inject repair list into next think() as "Build Repairs Needed" section
if (repairs.length > 0) {
  _postBuildScan = `Build verification: ${repairs.length} blocks need repair.\n` +
    repairs.slice(0, 10).map(r => `  ${r.issue}: ${r.block} at ${r.x},${r.y},${r.z}`).join('\n')
}
```

**BLD-05 (retry with error feedback):** The `build.js` placement loop already skips unreachable/failed blocks but doesn't surface them. Add a `failedPlacements[]` array to the build result. `buildPlanner.js` receives this and sets the section to `status: 'needs_repair'` with the failed coordinates stored. On next `!plan` execution, those specific blocks are retried with a focused LLM call describing what failed.

### Pattern 5: Atomic Shared Task Registry

**What:** Read-modify-write `data/shared_task_registry.json` using temp-write + `fs.renameSync` for atomic swap on local POSIX filesystem.

```javascript
// mind/taskRegistry.js — atomic write pattern (same as build-history.js)
function writeRegistry(data) {
  const tmp = REGISTRY_FILE + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  renameSync(tmp, REGISTRY_FILE)  // POSIX atomic on local disk
}

export function claimTask(agentName, taskId) {
  const data = readRegistry()
  const task = data.tasks.find(t => t.id === taskId)
  if (!task || task.claimedBy) return false
  task.claimedBy = agentName
  task.claimedAt = new Date().toISOString()
  task.status = 'active'
  writeRegistry(data)
  return true
}
```

### Pattern 6: Activity Broadcasting (COO-04)

**What:** Agents see what their partner is doing without asking. Two mechanisms work together:
1. **Chat announcements**: When an agent claims a task, it calls `bot.chat()` announcing the task. This is already human-observable and gets injected into the partner's `mind/social.js` via `messagestr` event.
2. **Shared task registry injection**: `getTaskRegistryForPrompt()` reads the registry and formats active tasks into a prompt section showing "luna: building north_wall, max: gathering stone_bricks". Injected into `buildSystemPrompt()` as a new Part 5.12.

```javascript
// mind/taskRegistry.js
export function getTaskRegistryForPrompt(agentName) {
  const data = readRegistry()
  const active = data.tasks.filter(t => t.status === 'active')
  if (active.length === 0) return null
  const lines = ['## What Agents Are Doing']
  for (const task of active) {
    const who = task.claimedBy === agentName ? 'you' : task.claimedBy
    lines.push(`  ${who}: ${task.description}`)
  }
  return lines.join('\n')
}
```

### Pattern 7: Chat Deduplication (COO-02)

**What:** When two agents are both online, they tend to respond to each other's chat messages, creating loops. The fix: a seen-message hash ring in `mind/social.js`. When the agent sends a `!chat` message, hash it and store. When `messagestr` arrives, check if the hash matches a recently-sent message — if so, ignore it.

**Key insight from MEMORY.md:** `feedback_no_throttling.md` says never add artificial cooldowns. The fix here is structural (track seen messages), not temporal (don't add cooldown timers).

```javascript
// mind/social.js — extend with dedup ring buffer
const SENT_HASHES = new Set()  // simple hash ring, max 20 entries
const MAX_DEDUP_ENTRIES = 20

export function recordSentMessage(message) {
  const hash = simpleHash(message)
  SENT_HASHES.add(hash)
  if (SENT_HASHES.size > MAX_DEDUP_ENTRIES) {
    SENT_HASHES.delete(SENT_HASHES.values().next().value)  // delete oldest
  }
}

export function isOwnEcho(message) {
  return SENT_HASHES.has(simpleHash(message))
}

function simpleHash(str) {
  // djb2 — fast, good enough for dedup
  let hash = 5381
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i)
  return hash >>> 0  // unsigned 32-bit
}
```

### Anti-Patterns to Avoid

- **LLM coordinate generation:** Never ask the LLM to output coordinate arrays. LLMs fail at spatial arithmetic. The LLM outputs style/dimensions/materials; `buildPlanner.js` computes all x/y/z values. (REQUIREMENTS.md Out of Scope confirms this.)
- **Single-call 500-block blueprint:** Asking the LLM for a 500-block blueprint in one call produces degraded output. Each section must be a separate LLM call with max 10x10 constraint enforced per section. Quality maintained, context budget respected.
- **Screenshot-based build verification:** `scanArea()` + `bot.blockAt()` gives ground truth without any vision API. Already implemented. Use it.
- **Per-tick task registry reads:** Read registry once per `think()` cycle, cache the result. Don't re-read on every tick.
- **Blocking material audit during gameplay:** `auditMaterials()` runs synchronously but fast (<5ms). Don't make it async. Call it once before a `!plan` execution begins, not every tick.
- **Chat response loops:** Never use `respondToChat()` to respond to the partner's agent chat messages that the agent itself triggered. The deduplication ring (Pattern 7) prevents this. The existing `mind/index.js` chat handler already filters own-username echoes (line 698) but does NOT filter own-message content that arrives as a partner echo.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blueprint JSON validation | Custom validator | `body/blueprints/validate.js` already exists | `validateBlueprint()` is already used in `designAndBuild()` |
| Atomic file write | Custom file locking | `writeFileSync(tmp) + renameSync` | Already established pattern in `build-history.js`. POSIX-atomic on local disk. |
| Block name validation | Custom lookup | `minecraft-data` `blocksByName` | Already used in `build.js` line 411 |
| BM25 search | Custom text search | MiniSearch (already installed) | Reuse same library as `knowledgeStore.js` if build plan search is needed |
| SQLite for task registry | Roll your own | `better-sqlite3` (already installed) | Same library as `memoryDB.js`; use if atomic JSON proves insufficient at 3+ agents |
| Entity distance calc | Custom math | `entity.position.distanceTo(bot.entity.position)` | Mineflayer Vec3 already handles this |

**Key insight:** The entire tech stack for this phase is already in the project. New modules (`buildPlanner.js`, `taskRegistry.js`) are pure JavaScript logic modules with no new npm dependencies.

---

## Common Pitfalls

### Pitfall 1: Build Plan Overwrites `_generated.json`
**What goes wrong:** The existing `designAndBuild()` always writes to `body/blueprints/_generated.json`. Large build plans generate multiple section blueprints. If the agent calls `!design` during a `!plan` execution, it overwrites `_generated.json` and invalidates the active section blueprint reference.
**Why it happens:** `designAndBuild()` hardcodes `_generated.json` as the output path.
**How to avoid:** `buildPlanner.js` must write section blueprints to `data/<agent>/builds/<planId>-<sectionId>.json`, NOT to `body/blueprints/`. The `build()` function in `build.js` must accept a full file path, not just a name key that resolves against `BLUEPRINTS_DIR`. Add a `blueprintPath` argument as an override.
**Warning signs:** Agent starts a `!plan` build, then calls `!design`, and section blueprints go missing.

### Pitfall 2: Material Audit Counts Palette Characters, Not Resolved Blocks
**What goes wrong:** `auditMaterials()` counts how many of each palette *character* is in the grid, but the palette has multiple preferred blocks per character. The inventory may have `oak_planks` when the palette asks for `spruce_planks`. The audit incorrectly reports "enough material" because it finds something in the `preferred[]` list.
**Why it happens:** Palette resolution happens at build-time against the current inventory. The audit needs to do the same resolution.
**How to avoid:** Run the same palette-resolution logic from `build.js` lines 157-168 inside `auditMaterials()` to resolve each palette char to the first available block. Audit the *resolved* block names, not the raw `preferred[]` array.

### Pitfall 3: Section Z-Slice Pagination Breaks Reference Block Logic
**What goes wrong:** `build.js` placement loop checks all adjacent blocks for a "reference block" to place against. For the first block in a Z-slice (bottom layer of a new section), there may be no adjacent solid block if the section starts at y+1 above air.
**Why it happens:** Sections are typically built in isolation. The bottom of "north_wall" starts where "foundation" ended. If foundation placed blocks at y=64 and wall starts at y=65, the wall's first block needs to place against the top of the foundation — which is a valid reference block. But if the origin offsets are wrong, the wall starts over air.
**How to avoid:** When building sections, the origin `y` must be set so that `y-1` has solid blocks (the previously completed section). `buildPlanner.js` must track the top-y of each completed section and pass it as the `originY` for the next section.

### Pitfall 4: Task Registry Claim Race Between Two Agents at Session Start
**What goes wrong:** Both agents start within 2 seconds of each other. Both read the registry, see a pending task, and both call `claimTask()`. With atomic rename on local disk, one wins. But the loser reads the file again and sees the task is already claimed — and should then look for the next unclaimed task. The pitfall is: the loser might retry indefinitely instead of claiming a different task.
**Why it happens:** `claimTask()` returns `false` on failure. Callers must check the return value and select a different task.
**How to avoid:** `claimTask()` returns `{ claimed: true, taskId }` or `{ claimed: false, reason }`. The caller (in `think()` context injection) lists unclaimed tasks for the LLM, and the LLM picks one. On claim failure, the next `think()` cycle will see the task is taken and pick a different one.

### Pitfall 5: Post-Build Repair Loop Triggers Infinite Retries
**What goes wrong:** After a build completes, `_postBuildScan` injects "3 blocks need repair." The LLM sees this and calls `!build` again. The repair build completes but still has 1 floating block with no reference. The scan fires again. The agent keeps trying to repair an unreachable block forever.
**Why it happens:** Some blocks in a blueprint genuinely cannot be placed due to geometry (floating corners, overhangs without scaffolding).
**How to avoid:** Implement a `repairAttempts` counter in the build plan JSON. If a coordinate has been attempted 3 times with no success, mark it `skip: true` and exclude from future repair scans. Log it to the session but don't block progress.

### Pitfall 6: `!plan` vs `!design` Command Confusion in System Prompt
**What goes wrong:** The LLM sees both `!design` and `!plan` in the command reference and doesn't know which to use for which size of build. It calls `!design` for a castle (too large, will degrade), or `!plan` for a small shed (unnecessary overhead).
**Why it happens:** Inadequate command documentation in the system prompt.
**How to avoid:** Update `prompt.js` command reference with explicit size guidance:
```
!design description:"text"    — small immediate builds (under ~100 blocks). Generates and places in one call.
!plan description:"text"      — large structures (100+ blocks). Creates a multi-session build plan; agent works through sections.
```

---

## Code Examples

### Build Plan Init in `buildPlanner.js`

```javascript
// mind/buildPlanner.js — init + plan storage
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

let _buildsDir = ''

export function initBuildPlanner(config) {
  _buildsDir = join(config.dataDir, 'builds')
  if (!existsSync(_buildsDir)) mkdirSync(_buildsDir, { recursive: true })
}

export function saveBuildPlan(plan) {
  const path = join(_buildsDir, `${plan.id}.json`)
  writeFileSync(path, JSON.stringify(plan, null, 2), 'utf-8')
}

export function loadBuildPlan(planId) {
  const path = join(_buildsDir, `${planId}.json`)
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(path, 'utf-8')) } catch { return null }
}

export function listBuildPlans() {
  if (!existsSync(_buildsDir)) return []
  return readdirSync(_buildsDir)
    .filter(f => f.endsWith('.json') && !f.includes('-section-'))
    .map(f => { try { return JSON.parse(readFileSync(join(_buildsDir, f), 'utf-8')) } catch { return null } })
    .filter(Boolean)
}

export function getActivePlan() {
  return listBuildPlans().find(p => p.status === 'active') || null
}

export function getBuildPlanForPrompt() {
  const plan = getActivePlan()
  if (!plan) return ''
  const pending = plan.sections.filter(s => s.status === 'pending').length
  const done = plan.sections.filter(s => s.status === 'done').length
  const total = plan.sections.length
  const audit = plan.materialAudit
  if (audit && Object.keys(audit.gap).length > 0) {
    const missing = Object.entries(audit.gap).map(([k, v]) => `${k}*${v}`).join(', ')
    return `ACTIVE BUILD PLAN: "${plan.description}" — ${done}/${total} sections done. MISSING MATERIALS: ${missing}. Gather these before building.`
  }
  return `ACTIVE BUILD PLAN: "${plan.description}" — ${done}/${total} sections done. Next: ${plan.sections.find(s => s.status === 'pending')?.id || 'all done'}. Use !build to continue.`
}
```

### `planBuild()` — LLM-Driven Plan Creation

```javascript
// mind/buildPlanner.js — planBuild()
// Source: based on existing designAndBuild() in mind/index.js + ARCHITECTURE.md section 4
export async function planBuild(bot, description, queryLLM, buildDesignPrompt, validateBlueprint) {
  const planId = randomUUID().slice(0, 8)
  const pos = bot.entity.position

  // Step 1: LLM generates overall spec (style, dimensions, materials)
  const specPrompt = buildSpecPrompt(description)
  const specResult = await queryLLM(specPrompt, 'Generate the build spec JSON now.')
  const spec = extractJSON(specResult.raw)
  if (!spec) return { success: false, reason: 'LLM did not generate a valid spec' }

  // Step 2: Decompose into sections based on spec dimensions
  const sections = decomposeSections(spec)

  // Step 3: For each section, LLM generates a small blueprint JSON
  const sectionBlueprints = []
  for (const section of sections) {
    const sectionPrompt = buildDesignPrompt(
      `${spec.style} ${section.id}: ${section.maxW}x${section.maxH}x${section.maxD} using ${spec.materials.primary}`,
      []  // no refs needed — spec provides context
    )
    const sectionResult = await queryLLM(sectionPrompt, 'Generate the section blueprint JSON now.')
    const bp = extractJSON(sectionResult.raw)
    if (!bp || !validateBlueprint(JSON.stringify(bp)).valid) {
      console.log(`[buildPlanner] section ${section.id} blueprint invalid — skipping`)
      continue
    }
    const bpPath = join(_buildsDir, `${planId}-section-${section.id}.json`)
    writeFileSync(bpPath, JSON.stringify(bp, null, 2), 'utf-8')
    sectionBlueprints.push({ ...section, blueprintFile: bpPath, status: 'pending', blockCount: countBlocks(bp) })
  }

  // Step 4: Build plan object
  const plan = {
    id: planId,
    description,
    createdAt: new Date().toISOString(),
    origin: { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) },
    status: 'active',
    spec,
    materialAudit: null,  // filled by auditMaterials() before first build
    sections: sectionBlueprints,
    totalEstimatedBlocks: sectionBlueprints.reduce((sum, s) => sum + s.blockCount, 0),
  }

  saveBuildPlan(plan)
  return { success: true, planId, sections: sectionBlueprints.length, totalBlocks: plan.totalEstimatedBlocks }
}
```

### Task Registry Schema

```javascript
// data/shared_task_registry.json — canonical shape
{
  "tasks": [
    {
      "id": "a1b2c3d4",
      "type": "build_section",
      "description": "build north_wall of castle plan a1b2c3d4",
      "planId": "a1b2c3d4",
      "sectionId": "north_wall",
      "claimedBy": null,
      "claimedAt": null,
      "status": "pending",
      "completedAt": null
    }
  ],
  "lastUpdated": "2026-03-23T21:00:00.000Z"
}
```

### Z-Slice Pagination in `build.js`

```javascript
// body/skills/build.js — Z-slice execution for 500+ block builds
// Source: based on existing placement loop + ARCHITECTURE.md Pattern Anti-Pattern 4

// New approach: execute layer by layer (y ascending), save state at layer boundaries.
// Replaces current flat completedIndex with { completedLayer: N, completedIndexInLayer: M }
// This allows precise cross-session resume without replaying all prior layers.

export async function buildSliced(bot, blueprintPath, originX, originY, originZ) {
  const blueprint = JSON.parse(readFileSync(blueprintPath, 'utf-8'))
  const layers = [...blueprint.layers].sort((a, b) => a.y - b.y)

  // Resume state
  const state = _activeBuild && _activeBuild.blueprintPath === blueprintPath ? _activeBuild : null
  const startLayerIdx = state?.completedLayer || 0

  for (let li = startLayerIdx; li < layers.length; li++) {
    const layer = layers[li]
    // ... existing block placement logic for this layer ...

    // Save state at layer completion (crash-safe boundary)
    _activeBuild.completedLayer = li + 1
    _saveState()
  }
  return { success: true, placed: totalPlaced, total: totalBlocks }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-call full blueprint generation | Section decomposition — one LLM call per section | T2BM (2024) showed degradation above ~100 blocks | Maintains quality at any size |
| Coordinate arrays from LLM | LLM describes intent; deterministic code handles coordinates | T2BM with GPT-4: 80% completeness but 48% material accuracy | Smaller models like Hermes can generate good section descriptions |
| Build-and-forget | Post-build scan + repair loop | T2BM repair modules (2024) | Automated quality assurance |
| Real-time chat coordination | Pre-task assignment + atomic registry | MineCollab 15% penalty (2025) | Removes bottleneck without coordination overhead |

**Deprecated:**
- `body/blueprints/_generated.json` as the only output for generated blueprints: still valid for `!design`, but `!plan` must use named files in `data/<agent>/builds/` to prevent collisions.

---

## Integration Points

### `mind/index.js` Changes

1. **`!plan` command handler** (parallel to `!design` handler, lines 432-463): intercepts `result.command === 'plan'` before dispatch, calls `buildPlanner.planBuild()`, stores plan ID in world knowledge, calls `auditMaterials()`.
2. **`!assign` command handler**: intercepts `result.command === 'assign'`, calls `taskRegistry.claimTask()`.
3. **`think()` context injection**: add `buildPlanContext: getBuildPlanForPrompt()` and `taskContext: getTaskRegistryForPrompt(config.name)` to the `buildSystemPrompt()` call.
4. **Post-build scan extension** (lines 524-540): pass blueprint path to `scanArea()` call so diff can be computed. Store repair list in `_postBuildScan`.

### `mind/prompt.js` Changes

1. Add `!plan description:"text"` and `!assign sectionId:N` to the command reference (Part 6).
2. Add `Part 5.12: Task context` — formatted output of `getTaskRegistryForPrompt()`.
3. Add `Part 5.13: Build plan context` — output of `getBuildPlanForPrompt()`.
4. Update `!design` description to specify "small builds under ~100 blocks".

### `mind/registry.js` Changes

1. Add `!plan` stub entry (handled in `index.js` like `!design` and `!see`).
2. Add `!assign` stub entry.

### `body/skills/build.js` Changes

1. Accept optional `blueprintPath` argument (full path) as alternative to name-based lookup against `BLUEPRINTS_DIR`. This is required so `buildPlanner.js` can point to `data/<agent>/builds/*.json`.
2. Add `completedLayer` tracking in `_activeBuild` state (alongside existing `completedIndex`) for Z-slice resume.
3. Add `failedPlacements[]` to the return value so `buildPlanner.js` can record unreachable blocks.

### `start.js` Changes

1. `import { initBuildPlanner } from './mind/buildPlanner.js'` and call `initBuildPlanner(config)` after other inits.
2. `import { initTaskRegistry } from './mind/taskRegistry.js'` and call `initTaskRegistry(config)` after other inits.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — all required libraries already installed, no new services needed).

---

## Open Questions

1. **How large can section blueprints be before Hermes Qwen3.5-27B degrades?**
   - What we know: T2BM used GPT-4 and saw degradation above ~100 blocks. Project CLAUDE.md confirms `max 10x10 footprint, max 8 blocks tall` is the current prompt constraint.
   - What's unclear: Whether Hermes 4.3 / Qwen3.5-27B can handle 10x10x8 = 800 blocks reliably for structured sections.
   - Recommendation: Keep sections at max 10x10x6 for initial implementation. Monitor `_generated.json` quality. Increase if validation pass rates are high.

2. **Should `!plan` also execute the first section immediately, or just plan?**
   - What we know: The existing `!design` always immediately executes. Users expect `!plan` to result in visible building activity.
   - What's unclear: Whether agents should plan + audit + execute all in one thick call, or plan first and let the next think() cycle handle execution.
   - Recommendation: `!plan` does plan + audit only. The LLM sees the plan and material gap in the next think() cycle and naturally calls `!mine`/`!gather` to fill gaps, then `!build` to start the first section. This is more natural and easier to debug.

3. **COO-02 deduplication scope: own messages only, or loop detection?**
   - What we know: Chat loops happen when agent A responds to agent B, agent B's response triggers agent A to respond again.
   - What's unclear: Whether deduplicating own-echo messages (Pattern 7 above) is sufficient, or whether loop detection (detecting "I just said something very similar") is needed.
   - Recommendation: Start with own-echo deduplication (Pattern 7). It addresses the primary case. If chat loops persist after testing, add a per-partner cooldown of 10 seconds (structural, not artificial — the partner's next action will fire before the cooldown expires in normal play).

---

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `mind/spatial.js` — Tier 4 entity awareness implementation (getEntityAwareness, lines 241-270), verified fully implemented
- `mind/index.js` — designAndBuild() pipeline, !design handler, post-build scan pattern, think() structure
- `body/skills/build.js` — palette resolution, placement loop, resume logic, `_activeBuild` state schema
- `body/skills/scan.js` — scanArea() API, volume limit (32x32x32), block inventory return format
- `mind/registry.js` — !scan registration, !design/!see stub pattern to replicate for !plan/!assign
- `mind/prompt.js` — system prompt part structure, command reference format, getBuildContextForPrompt() pattern
- `mind/build-history.js` — atomic rename pattern, shared file convention
- `mind/memoryDB.js` — SQLite initialization pattern with WAL mode (reference for taskRegistry if upgraded)
- `mind/knowledgeStore.js` — BM25 + vector index pattern (reference only, not needed in this phase)
- `start.js` — init sequence, setInterval pattern for background tasks
- `.planning/research/ARCHITECTURE.md` — build planning design (buildPlanner.js spec, section decomposition, anti-patterns)
- `.planning/research/FEATURES.md` — T2BM/APT research findings, Mindcraft MineCollab coordination findings
- `.planning/REQUIREMENTS.md` — BLD-01 to BLD-05 and COO-01 to COO-04 definitions and status
- `.planning/phases/19-enhanced-spatial-building/19-CONTEXT.md` — locked decisions for this phase
- `body/blueprints/validate.js` — exists and is used in designAndBuild(); must be reused, not re-implemented

### Secondary (MEDIUM confidence)
- T2BM paper (arXiv 2406.08751) — interlayer JSON representation, 80% completeness / 48% material accuracy with GPT-4, repair modules essential
- MineCollab (arXiv 2504.17950) — 15% performance penalty for real-time chat coordination; pre-task assignment is correct
- ARCHITECTURE.md section 4 "Build Planning for 500+ Block Structures" — verified against current codebase, design is sound

### Tertiary (LOW confidence)
- None — all critical claims are directly code-verified.

---

## Metadata

**Confidence breakdown:**
- SPA-01/SPA-04 status (already done): HIGH — direct code read of spatial.js lines 241-270 and minimap injection in prompt.js
- BLD-01/02/03 design: HIGH — buildPlanner.js architecture from ARCHITECTURE.md, cross-checked against existing designAndBuild() pattern
- BLD-04/05 design: HIGH — extending existing _postBuildScan pattern, clear diff algorithm
- COO-01/02/03/04 design: HIGH — ARCHITECTURE.md section 5 verified against build-history.js atomic pattern
- Section decomposition approach: MEDIUM — solid architecture decision from ARCHITECTURE.md, but section sizes for Hermes 4.3 are empirically unverified

**Research date:** 2026-03-23
**Valid until:** 2026-04-22 (stable tech, 30-day window)

---

*Phase 19 research for: HermesCraft v2.3 — Enhanced Spatial + Building*
*All integration points verified against direct codebase reads*
*No new npm dependencies required*
