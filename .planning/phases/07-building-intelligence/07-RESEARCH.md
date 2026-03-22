# Phase 7: Building Intelligence - Research

**Researched:** 2026-03-21
**Domain:** Freestyle LLM building — plan format, parser contract, placement tracking, post-build verification
**Confidence:** HIGH — based on direct codebase inspection of all integration points plus prior project-level research

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Planner writes building plan as a context file (uses existing `save_context` tool)
- Plan format: structured markdown with block list and placement sequence
- Each entry specifies: block type, relative position (x, y, z offset from origin), placement order
- Origin point: the agent's current position when the build starts
- Plan includes: structure name, dimensions, material list with quantities, layer-by-layer placement order (bottom up)
- Inventory check: reject plan before queuing if >10% of required blocks are not in inventory
- Plan lives in context file so it survives history wipes — action loop reads it each tick

- New `agent/freestyle.js` — parses the markdown building plan into a `[{block, x, y, z}]` array
- Writes parsed plan to action queue as a sequence of `smart_place` actions
- Each `smart_place` action includes the target block type and absolute coordinates (origin + offset)
- Progress tracking: mark each step complete as `smart_place` succeeds
- Plan completion: when all steps executed, delete the context file

- New `agent/placement-tracker.js` — persistent placed-blocks log
- File: `agent/data/{name}/placed_blocks.json`
- On every successful `smart_place` response: append `{block, x, y, z, timestamp}`
- Read from `smart_place` HTTP response (Phase 5 added placed block data to response)
- Survives agent restarts (JSON file persistence)
- Provides `getPlacedBlocks()` for verification and `getPlacedBlocksForPrompt()` for prompt injection

- After build completion, trigger verification using existing `pendingReview` mechanism in `index.js`
- Inject "verify your build" prompt — compare vision output + placement log against the plan
- Vision loop (Claude Haiku) provides the structural observation (`BUILD:` field)
- Placement tracker provides the block count and positions
- Log pass/fail result — if fail, optionally queue repair steps
- Do NOT block the tick loop for verification — make it async within the existing review cycle

- Do NOT modify existing `builder.js` or `blueprints.js` — leave them for backwards compatibility
- `freestyle.js` is the new building system — planner uses it instead of blueprints
- If `builder.js`/`blueprints.js` cause conflicts (double-place race condition), guard with a flag

### Claude's Discretion

- Exact markdown format for building plans (as long as it includes block, position, and order)
- Verification prompt wording (as long as it uses vision `BUILD:` field + placement log)
- Whether to support partial builds (resume after restart) vs full rebuilds

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUILD-01 | Agent can design structures via LLM-generated markdown building plans stored in context files | `save_context` tool already exists in GAME_TOOLS; `parseFreestylePlan()` contract defined below enables reliable parsing |
| BUILD-02 | Agent executes building plans block-by-block using smart place action | `smart_place` is already in VALID_ACTIONS and ACTION_SCHEMAS; `parseQueueFromPlan()` in planner.js is the expansion point |
| BUILD-03 | Agent tracks all placed blocks persistently (block type, position, timestamp) | `smart_place` response already returns `placed` field per Phase 5; `executeAction()` in actions.js is the integration point |
| BUILD-04 | Agent verifies completed builds against original plan using vision + block tracking | `pendingReview` mechanism exists in index.js and is partially wired; `reviewSubtaskOutcome()` is the hook; `BUILD:` field from vision loop is already parsed in planner.js |
</phase_requirements>

---

## Summary

Phase 7 builds three new agent-side modules on top of the reliable `smart_place` action shipped in Phase 5. No mod changes are required — the mod already returns `placed: {block, x, y, z}` in every successful `smart_place` response. Every integration point exists: `save_context`/`delete_context` tools, the `parseQueueFromPlan()` expansion hook in planner.js, the `pendingReview` mechanism in index.js, and the `BUILD:` field from the vision loop.

The single highest-risk design decision is the `parseFreestylePlan()` markdown format. If the format is ambiguous or verbose, the LLM will generate malformed plans and the parser will silently return an empty array — producing zero build actions with no error. The format must be parseable with simple line-by-line regex (no YAML parser, no complex tree walking) and must be natural enough for the LLM to produce reliably from a one-shot description in the planner prompt.

The second risk is the double-place race condition: both `builder.js` (which runs every tick when `isBuildActive()`) and the action queue (which `index.js` pops every tick) can issue `smart_place` calls simultaneously if a legacy blueprint build starts while a freestyle queue is populated. The fix is a one-line guard in the `isBuildActive()` branch of `index.js`: skip the `resumeBuild()` call when a freestyle build is active.

The verification approach via `pendingReview` is already partially implemented — the mechanism exists and fires one tick after `update_task` is called with `expected_outcome`. The gap is that `reviewSubtaskOutcome()` only knows how to check keywords against live state (inventory, position, health). For build verification, it needs to also check the placement log block count against the plan's declared block count. This is a small extension, not a rewrite.

**Primary recommendation:** Define the `parseFreestylePlan()` markdown contract first (Wave 0), then implement freestyle.js and placement-tracker.js (Wave 1), then wire the verification prompt extension (Wave 2).

---

## Standard Stack

### Core (no new dependencies)

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Node.js native `fs` | (existing) | JSON persistence for placed_blocks.json | Same pattern as chests.js, locations.json |
| `smart_place` action | (Phase 5) | Block placement with `placed` response field | Already wired, already in VALID_ACTIONS |
| `save_context` / `delete_context` | (existing GAME_TOOLS) | Plan file lifecycle | Survives history wipes; already in tools.js |
| `pendingReview` mechanism | (existing index.js) | Post-build verification trigger | Already fires one tick after `update_task` |
| Vision loop `BUILD:` field | (Phase 4) | Structural observation for verification | Already parsed in planner.js `parseBuildEvaluation()` |

### No New npm Dependencies

All features are implementable with existing stack. No `npm install` required.

---

## Architecture Patterns

### Recommended File Layout

```
agent/
  freestyle.js              NEW — parseFreestylePlan(), initFreestyle(), getFreestyleProgress()
  placement-tracker.js      NEW — initPlacementTracker(), recordPlacement(), getPlacedBlocks(), getPlacedBlocksForPrompt()
  data/{name}/
    placed_blocks.json      NEW — written by placement-tracker.js, truncated at 1000 entries
```

### Pattern 1: parseFreestylePlan() Markdown Contract

**What:** The contract between what the planner LLM writes and what `freestyle.js` parses.

**Design constraint:** Must parse with simple `line.match(regex)` — no YAML, no multiline lookahead. The LLM must be able to generate this format from a short example in its system prompt without memorizing a schema.

**Recommended format:**

```markdown
## BUILD: Watchtower
dimensions: 3x3x5
origin: current position

### Materials
oak_log: 20
oak_planks: 16
cobblestone: 9

### Placement
1. cobblestone 0 0 0
2. cobblestone 1 0 0
3. cobblestone 2 0 0
4. cobblestone 0 0 1
5. cobblestone 1 0 1
6. cobblestone 2 0 1
7. cobblestone 0 0 2
8. cobblestone 1 0 2
9. cobblestone 2 0 2
10. oak_log 0 1 0
11. oak_log 2 1 0
...
```

**Parsing rules:**
- Structure name: `## BUILD: (.+)` on the header line
- Materials section: lines matching `^([a-z_]+):\s*(\d+)` after `### Materials`
- Placement lines: `^(\d+)\.\s+([a-z_]+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)$`
- Parsing stops at blank lines between numbered entries and at the next `###` section header
- Relative coordinates (dx, dy, dz) are integers — can be negative (for structures that extend backward from origin)

**`parseFreestylePlan(text, originX, originY, originZ)` contract:**
- Returns `{ name, materials, blocks: [{block, x, y, z}] }` in placement order
- Absolute coords = origin + offset
- Returns `null` if no `## BUILD:` header found
- Returns `{ name, materials, blocks: [] }` if header found but no valid placement lines (caller must treat as parse failure)

**Source:** This format is designed for this project — no prior art. Confidence: HIGH that it is LLM-generatable (uses numbered list + space-separated coords, same pattern as many LLM training examples).

### Pattern 2: Queue Expansion via parseQueueFromPlan()

**What:** When planner writes a plan containing `QUEUE:\nfreestyle build_plan.md`, `parseQueueFromPlan()` detects the `freestyle` action type, reads the context file, calls `parseFreestylePlan()`, and expands into individual `smart_place` queue items.

**Integration point:** `parseQueueFromPlan()` in `planner.js` — add a `case 'freestyle':` branch alongside the existing `case 'craft':` chain expansion.

**Flow:**
```
Planner LLM writes in QUEUE section:
  freestyle build_plan.md | build the watchtower

parseQueueFromPlan() hits case 'freestyle':
  → read context file agent/data/{name}/context/build_plan.md
  → call parseFreestylePlan(text, state.position.x, state.position.y, state.position.z)
  → expand into [{type:'smart_place', args:{item:'cobblestone',x:10,y:64,z:20}}, ...]
  → check materials: if >10% blocks missing from inventory, push single {type:'chat', args:{message:"Need more materials to build"}} instead
  → push all smart_place items into queue (up to 20 per batch; remainder on next planner cycle)
```

**Note on queue size limit:** The existing `setQueue()` cap is 20 items. A 40-block build requires 2 planner cycles to fully queue. The planner's next cycle will detect the build is still in progress (via `getFreestyleProgress()`) and queue the next batch. The planner prompt must include this state.

**Alternative trigger path:** The planner LLM also has access to `save_context` directly. The intended trigger is: planner writes the context file in one tick (via `save_context` tool call), then on the next planner cycle detects the plan file exists and queues `freestyle build_plan.md`. This separation of design and execution is explicit.

### Pattern 3: Placement Tracker Integration

**What:** After every `smart_place` response, check for `result.placed` and call `recordPlacement()`.

**Integration point:** `executeAction()` in `actions.js` — the same location where `trackChest()` is already called from `chest_deposit`/`chest_withdraw` responses (lines 394-406 of actions.js).

**Exact pattern to follow:**
```javascript
// In executeAction(), after sendSingleAction() returns result:
if (type === 'smart_place' && result.success && result.placed) {
  try {
    recordPlacement(result.placed)  // {block, x, y, z}
  } catch (e) {
    // Non-critical — don't fail the action if tracking fails
  }
}
```

**`placement-tracker.js` exports:**
- `initPlacementTracker(agentConfig)` — load existing placed_blocks.json on startup
- `recordPlacement({block, x, y, z})` — append entry with timestamp, truncate to 1000
- `getPlacedBlocks()` — returns full array, used for verification
- `getPlacedBlocksForPrompt()` — returns compact summary: `"Last 5 placed: oak_planks at (10,64,20), ..."`
- `getPlacedBlockCount()` — integer, used for queue batch sizing in freestyle.js

**File format (`placed_blocks.json`):**
```json
{
  "blocks": [
    {"block":"cobblestone","x":10,"y":64,"z":20,"ts":"2026-03-21T12:00:00.000Z"},
    ...
  ]
}
```

### Pattern 4: Post-Build Verification Wiring

**What:** After all blocks in a freestyle build are placed, set `pendingReview` to trigger a structured verification prompt on the next tick.

**Where the trigger fires:** In `index.js`, after the action queue drains following a freestyle build. The planner detects `getFreestyleProgress()` shows complete and calls the verification path.

**Simpler approach (recommended):** The planner LLM naturally calls `update_task` with `status: "reviewing"` and `expected_outcome: "N blocks placed matching the plan"` when its action queue summary shows all smart_place actions done. `reviewSubtaskOutcome()` is then extended to handle a `placed_count:N` keyword.

**Extension to `reviewSubtaskOutcome()` in index.js:**
```javascript
// Check placed block count (e.g. "placed_count:20 blocks placed")
const placedCountMatch = expected.match(/placed_count:(\d+)/)
if (placedCountMatch) {
  const required = parseInt(placedCountMatch[1])
  const actual = getPlacedBlockCount()  // from placement-tracker.js
  if (actual < required * 0.9) {  // allow 10% tolerance
    passed = false
    actual_str = `only ${actual}/${required} blocks placed`
  }
}
```

**Verification prompt injection pattern:**

When `reviewResult` exists and `passed === false`, `buildUserMessage()` already injects it into the user message. The gap is that there is no BUILD-specific text. Add to `buildUserMessage()`:

```javascript
// When reviewResult is a failed build review:
if (reviewResult && !reviewResult.passed && reviewResult.expected_outcome.includes('placed')) {
  const placedSummary = getPlacedBlocksForPrompt()
  const buildEval = visionContext ? parseBuildEvaluation(visionContext) : null
  parts.push(`\n== BUILD VERIFICATION FAILED ==\n${reviewResult.actual}\nPlacement log: ${placedSummary}\nVision: ${buildEval || 'no vision data'}\nIf the build is incomplete, re-queue the remaining blocks.`)
}
```

**False positive prevention:** The current `reviewSubtaskOutcome()` defaults to `passed = true` when no keyword matches. For build verification, the `placed_count:N` keyword pattern ensures the check is deterministic. The LLM cannot hallucinate a passing review — the check is against `getPlacedBlockCount()` (a file read), not against LLM output.

### Pattern 5: Builder.js Double-Place Race Condition Guard

**What:** `builder.js` runs `resumeBuild()` every tick when `isBuildActive()` is true. If a freestyle build queue is also active, both paths fire and the same block gets placed twice.

**Fix (one line in index.js):**
```javascript
// In tick(), before if (isBuildActive()):
if (isBuildActive() && !isFreestyleActive()) {
  const buildResult = await resumeBuild(state.inventory || [])
  ...
}
```

`isFreestyleActive()` exported from `freestyle.js` — returns true when a freestyle context file exists and blocks remain.

**Alternative:** The planner should never queue a `build` action while a freestyle build is active, but a code-level guard is more reliable than prompt-level enforcement.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Block coordinate storage | Custom spatial index or quadtree | Plain JSON array in placed_blocks.json | Under 2000 blocks, sequential scan is fine |
| Plan file format | YAML/TOML parser or AST | Simple line-by-line regex | No npm dep needed; LLM generates simpler text |
| Build completion detection | Poll mod state every tick | Trust `smart_place` response `placed` field | Extra round-trip kills build speed |
| Verification logic | Second LLM call per tick | `reviewSubtaskOutcome()` keyword extension | LLM call per verification = latency spike on 2s tick budget |
| Plan file I/O | Custom context manager | Existing `save_context`/`delete_context` tools | Already in GAME_TOOLS, already tested, already survives history wipes |

---

## Common Pitfalls

### Pitfall 1: Parser Returns Empty Array Silently

**What goes wrong:** `parseFreestylePlan()` finds the `## BUILD:` header but the placement section uses a slightly different format (e.g., tabs instead of spaces, missing period after number). Returns `{ blocks: [] }`. Planner queues nothing. Build silently fails to start.

**Why it happens:** LLM generation is not perfectly constrained — a few tokens of variation breaks a strict regex.

**How to avoid:** Make the placement line regex lenient on whitespace: `^\s*\d+[.)]\s+([a-z_]+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)`. Log a warning when parsing yields 0 blocks from a non-empty placement section.

**Warning signs:** Action queue summary shows 0 items after planner cycle where plan write was expected.

### Pitfall 2: Origin Captured Too Early

**What goes wrong:** `parseFreestylePlan()` is called with the agent's position at plan-parse time (when planner runs), not at execution time. Agent walks to the build site after planning, but the origin is already baked in as absolute coordinates. Build executes at wrong location.

**Why it happens:** Queue expansion happens in `parseQueueFromPlan()` at planner time. The planner runs every 5s; the action loop executes later.

**How to avoid:** Two options:
1. Require the planner to also queue a `navigate` action to the build site before queuing `freestyle` — so the agent is at origin when execution starts. This is the correct approach.
2. Or: store relative coordinates in the queue and resolve origin at execution time. More complex, not needed.

**Recommendation:** Use option 1. The planner prompt should instruct: "Always navigate to the build origin first, then queue the freestyle action."

### Pitfall 3: Materials Check Uses Stale State

**What goes wrong:** `parseQueueFromPlan()` checks inventory at plan-write time. By execution time, the agent has used those materials for something else. Build starts, then fails at first placement.

**Why it happens:** Planner state snapshot vs execution state are different — up to 5s apart.

**How to avoid:** The `validatePreExecution` in `actions.js` already checks inventory for `smart_place` (`hasItem(action.item)`). This check fires at execution time and returns `{ valid: false }` if the item is missing. This is the correct safety net. The upfront materials check in `parseQueueFromPlan()` is an early rejection, not a guarantee.

### Pitfall 4: Large Build Exceeds Queue Cap

**What goes wrong:** A 200-block build queues only the first 20 actions (queue cap). Build stalls after 20 blocks. Planner sees partial completion and re-plans instead of continuing.

**Why it happens:** `setQueue()` hard-caps at 20 items. This is a safety valve, not a design intent.

**How to avoid:** `isFreestyleActive()` tells the planner the build is in progress. Add to planner prompt: "If `freestyle_active` is true in queue summary, queue the next batch via `freestyle build_plan.md` again — do not re-plan." Alternatively, freestyle.js can maintain its own progress pointer in a small JSON file (`freestyle_state.json`) and `parseQueueFromPlan()` respects the pointer to queue the next 20 unfilled positions.

**Recommendation:** Use the `freestyle_state.json` pointer approach — it survives history wipes and restarts cleanly.

### Pitfall 5: Verification Always Passes (False Positive)

**What goes wrong:** `reviewSubtaskOutcome()` defaults `passed = true` when no keyword pattern matches. If the `expected_outcome` string doesn't contain `placed_count:N`, the verification passes immediately without checking anything.

**Why it happens:** The default-pass behavior is intentional for non-verifiable goals. It becomes a false positive when the expected_outcome is vague like "build is complete."

**How to avoid:** The planner's build verification call must use `expected_outcome: "placed_count:N blocks"` where N is the block count from the plan's materials section. Document this pattern in the planner system prompt and in the freestyle.js completion handler that sets `pendingReview`.

### Pitfall 6: Placed Blocks JSON Grows Unbounded

**What goes wrong:** `placed_blocks.json` accumulates all blocks across all builds over all sessions. After 10 builds with 50 blocks each, the file has 500 entries and the prompt injection from `getPlacedBlocksForPrompt()` becomes large.

**How to avoid:** Two-level cap: hard truncate at 1000 entries (drop oldest), and `getPlacedBlocksForPrompt()` only shows the last 5 placed blocks as a brief summary. The full array is only accessed by verification logic, never directly injected into prompts.

---

## Code Examples

### parseFreestylePlan() Implementation Sketch

```javascript
// freestyle.js — parseFreestylePlan: parses LLM building plan markdown
// Source: designed for this project; format chosen for LLM generability

export function parseFreestylePlan(text, originX, originY, originZ) {
  if (!text) return null

  // Require BUILD header
  const headerMatch = text.match(/^##\s+BUILD:\s*(.+)$/m)
  if (!headerMatch) return null
  const name = headerMatch[1].trim()

  // Parse materials section
  const materials = {}
  const matSection = text.match(/###\s+Materials\n([\s\S]*?)(?:###|$)/)
  if (matSection) {
    for (const line of matSection[1].split('\n')) {
      const m = line.match(/^\s*([a-z_]+):\s*(\d+)/)
      if (m) materials[m[1]] = parseInt(m[2])
    }
  }

  // Parse placement section — lenient whitespace, supports period or ) after number
  const placSection = text.match(/###\s+Placement\n([\s\S]*?)(?:###|$)/)
  const blocks = []
  if (placSection) {
    for (const line of placSection[1].split('\n')) {
      const m = line.match(/^\s*\d+[.)]\s+([a-z_]+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/)
      if (m) {
        blocks.push({
          block: m[1],
          x: originX + parseInt(m[2]),
          y: originY + parseInt(m[3]),
          z: originZ + parseInt(m[4]),
        })
      }
    }
  }

  if (blocks.length === 0 && placSection) {
    console.warn('[freestyle] WARNING: placement section found but 0 blocks parsed — check format')
  }

  return { name, materials, blocks }
}
```

### Planner Prompt Snippet for BUILD Plan Generation

```
When you want to build a structure:
1. First navigate to the build site.
2. Call save_context to write a build plan in this EXACT format:

## BUILD: [structure name]
dimensions: WxDxH
origin: current position

### Materials
[block_name]: [count]

### Placement
1. [block_name] [dx] [dy] [dz]
2. [block_name] [dx] [dy] [dz]
...

RULES:
- Use only blocks in your current inventory
- dx/dy/dz are integers relative to your current position
- dy=0 is your feet level; dy=1 is one block above
- List blocks bottom-to-top (lowest dy first)
- After saving, queue: freestyle [filename].md
```

### Placement Tracker recordPlacement()

```javascript
// placement-tracker.js — persistent block placement log
// Source: follows chests.js module-owned persistence pattern

export function recordPlacement({ block, x, y, z }) {
  _placedBlocks.push({ block, x, y, z, ts: new Date().toISOString() })
  // Truncate to last 1000 to prevent unbounded growth
  if (_placedBlocks.length > 1000) {
    _placedBlocks = _placedBlocks.slice(-1000)
  }
  savePlacedBlocks()  // fire-and-forget write
}
```

### actions.js Integration Point

```javascript
// In executeAction(), after const result = await sendSingleAction(payload):
// Mirrors the trackChest pattern on lines 394-406 of actions.js

if (type === 'smart_place' && result.success && result.placed) {
  try {
    recordPlacement(result.placed)
  } catch (e) {
    // Non-critical
  }
}
```

### Verification Expected Outcome Convention

```javascript
// In freestyle.js, after all blocks queued, set pendingReview directly:
// (or the planner LLM calls update_task with this pattern)
const blockCount = plan.blocks.length
pendingReview = {
  index: currentSubtaskIndex,
  expected_outcome: `placed_count:${blockCount} blocks for ${plan.name}`,
  reviewTick: tickCount + 1,
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded blueprints (3 patterns) | LLM-designed freestyle plans in context files | Phase 7 | Agent can build any structure it imagines |
| No placement tracking | placed_blocks.json with block+position+timestamp | Phase 7 | Enables verification and progress display |
| No post-build review | pendingReview + placed_count keyword check | Phase 7 | Agents detect incomplete builds and repair |

**Established patterns in prior research:**
- T2BM (2024): Validated freestyle building via JSON interlayer — LLM designs, agent executes deterministically. 38% success rate with GPT-4 + repair modules. The repair module is what `pendingReview` approximates.
- Voyager: Self-verification caused 73% performance drop when removed — confirms this is not optional.
- HermesCraft: `smart_place` returns `placed` field (Phase 5 confirmed). The data pipeline is ready.

---

## Open Questions

1. **Partial build resume after restart**
   - What we know: `freestyle_state.json` can persist a progress pointer (index into blocks array). On restart, `initFreestyle()` checks for the file and resumes from the pointer.
   - What's unclear: Should the planner automatically re-trigger a partial build on startup, or require the user to re-instruct?
   - Recommendation: Automatic resume — on `initFreestyle()`, if `freestyle_state.json` exists with remaining blocks, restore `_activeFreestyle` and let the next planner cycle detect it and queue the next batch. The plan file still exists in context/, so no re-design is needed.

2. **Build size ceiling**
   - What we know: Queue cap is 20 items. `freestyle_state.json` progress pointer enables batching across planner cycles.
   - What's unclear: What's a reasonable per-build block limit? LLM-designed structures for a single agent are likely 10-100 blocks. T2BM studied 10-100 block structures.
   - Recommendation: Soft cap of 200 blocks in `parseFreestylePlan()` — log a warning and truncate if exceeded. A 200-block build takes 400s at 2s/tick (6.7 minutes), which is within reasonable session time.

3. **Vision BUILD: field timing for verification**
   - What we know: Vision loop runs every 10s. `BUILD:` field describes what the agent currently sees. After a build completes, the agent may have moved, making the vision field irrelevant.
   - What's unclear: Will the vision loop capture the completed structure reliably within one review cycle?
   - Recommendation: The `placed_count` keyword check is the authoritative pass/fail criterion. The `BUILD:` field from vision is supplementary context injected into the failure message, not the check itself. This avoids vision timing dependency.

---

## Integration Map

This is the complete picture of where each new piece connects to existing code:

```
NEW: agent/freestyle.js
  exports: parseFreestylePlan(), initFreestyle(), isFreestyleActive(), getFreestyleProgress()
  called from: planner.js parseQueueFromPlan() (case 'freestyle')
  called from: index.js isBuildActive() guard (new: && !isFreestyleActive())

NEW: agent/placement-tracker.js
  exports: initPlacementTracker(), recordPlacement(), getPlacedBlocks(), getPlacedBlocksForPrompt(), getPlacedBlockCount()
  called from: agent/actions.js executeAction() — after smart_place response
  called from: agent/index.js reviewSubtaskOutcome() — placed_count keyword check
  called from: agent/prompt.js buildUserMessage() — build failure injection

MODIFIED: agent/planner.js parseQueueFromPlan()
  add case 'freestyle': read context file → parseFreestylePlan() → expand to smart_place items
  add materials check: if >10% missing → push chat warning instead of placing

MODIFIED: agent/index.js
  isBuildActive() guard: add && !isFreestyleActive()
  reviewSubtaskOutcome(): add placed_count:N keyword handling

MODIFIED: agent/prompt.js buildUserMessage()
  add getPlacedBlocksForPrompt() injection on build failure reviewResult

MODIFIED: agent/actions.js executeAction()
  add recordPlacement() call after successful smart_place
```

---

## Sources

### Primary (HIGH confidence)
- Direct inspection: `agent/actions.js` lines 1-410 — VALID_ACTIONS, smart_place schema, trackChest pattern, executeAction() integration point
- Direct inspection: `agent/index.js` lines 88-430, 548-570 — pendingReview mechanism, reviewSubtaskOutcome(), isBuildActive() guard location, buildUserMessage() call signature
- Direct inspection: `agent/planner.js` lines 89-199 — parseQueueFromPlan(), case 'craft' chain expansion pattern to follow
- Direct inspection: `agent/builder.js` — isBuildActive(), resumeBuild(), double-place race condition
- Direct inspection: `agent/prompt.js` — buildUserMessage() signature and visionContext injection pattern
- Direct inspection: `agent/tools.js` — save_context/delete_context tool definitions

### Secondary (MEDIUM confidence)
- T2BM paper (arXiv 2406.08751) — LLM building via JSON interlayer; 38% GPT-4 success rate; repair module pattern
- Voyager paper (arXiv 2305.16291) — self-verification mechanism; 73% item discovery drop without it

### Project Research (HIGH confidence)
- `.planning/research/ARCHITECTURE.md` — full freestyle building data flow, placement-tracker.js spec
- `.planning/research/FEATURES.md` — feature dependency graph, don't-hand-roll list
- `.planning/research/SUMMARY.md` — pitfall catalog, confidence assessment, gap analysis

---

## Metadata

**Confidence breakdown:**
- parseFreestylePlan() format contract: HIGH — designed for parsability and LLM generability; verified against existing parsing patterns in codebase
- Integration points: HIGH — all hooks confirmed by direct code inspection (actions.js, index.js, planner.js)
- Verification wiring: HIGH — pendingReview mechanism confirmed present and partially wired; extension is small
- Partial build resume: MEDIUM — design is sound but no prior implementation to validate against

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable codebase, no fast-moving dependencies)
