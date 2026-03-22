# Phase 6: Creative Building - Research

**Researched:** 2026-03-22
**Domain:** Mineflayer block placement, build skill architecture, LLM-driven construction, cross-session persistence
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Mind + Body split: build skill lives in body/, build choice/planning is LLM-driven in mind/
- Post-place verification: every block placement must be verified server-side (from Phase 1 body/place.js)
- Cooperative interrupt: build skill checks interrupt after every placement
- Personality-driven: Jeffrey's curiosity drives different builds than John's pragmatism — expressed through LLM system prompt, not hardcoded rules
- Cross-session persistence: build plans and progress saved to per-agent data dir
- v1 had blueprints system (agent/blueprints/, agent/blueprints.js, agent/builder.js, agent/freestyle.js) — reference for patterns
- Structured plans: floor, walls, roof as block-by-block placement lists
- SOUL files define creative personality traits for each agent

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUILD-01 | Agents build real structures — walls, roof, floor — not single blocks | body/skills/build.js using layered blueprint JSON; placeBlock() primitive with post-place verify |
| BUILD-02 | Emergent creative behavior — agents choose what to build based on personality and context | Prompt injection of available blueprints + build context; SOUL file personality drives LLM choice |
| BUILD-03 | Base expansion over time — keep improving builds across sessions | build_state.json persists active plan + progress; memory worldKnowledge records completed builds |
| SKILL-05 | Build skill — place blocks from a structured plan, verify each placement | body/skills/build.js iterates block queue, calls placeBlock(), checks isInterrupted() each iteration |
</phase_requirements>

---

## Summary

Phase 6 builds on three prior investments: the `body/place.js` primitive (verified block placement), the v1 blueprint system (JSON layered plans with palette resolution), and the v2 Mind loop (!command dispatch + SOUL-driven personality). The job is to port the best of v1 into the v2 architecture — a `body/skills/build.js` skill that executes structured plans block-by-block with interrupt support, wired through `mind/registry.js` as `!build`, with prompt injection in `mind/prompt.js` so the LLM knows what to build and why.

The most technically interesting problem is **block placement mechanics in Mineflayer**: `bot.placeBlock(referenceBlock, faceVector)` places against an existing solid block, which means placement order is critical — floor first, then walls from bottom to top, then roof. The second challenge is **LLM-driven plan selection**: the LLM must choose blueprints based on personality context and game state, not pick randomly. Jeffrey (aesthetics, views, elevation) and John (function, organization, straight rows) will naturally favor different structures when blueprints are described well in the prompt.

The third challenge is **cross-session expansion** (BUILD-03): when a session starts, the agent must notice completed structures and have a vocabulary for improving them — adding a window, extending a wall, building an adjacent structure — without rerunning the same blueprint. This is primarily a prompt and memory problem, not a new skill problem.

**Primary recommendation:** Port v1 blueprint JSON format directly (it's well-designed); build `body/skills/build.js` as a straightforward block-queue skill over `placeBlock()`; wire `!build blueprint:name x:N y:N z:N` in registry; inject build state and blueprint catalog into the system prompt for personality-driven selection.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mineflayer (existing) | ^4.35.0 | `bot.placeBlock()`, `bot.blockAt()`, inventory | Already installed, all placement goes through this |
| vec3 (existing) | bundled with mineflayer | Position math, face vectors | `body/place.js` already uses it |
| minecraft-data (existing) | bundled | Block name validation, mcData.blocksByName lookup | Already used in gather/mine/freestyle |
| fs (Node built-in) | — | Build state persistence (JSON files) | Same pattern as memory.js, locations.js |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mineflayer-pathfinder (existing) | CJS import | Navigate to build site before placing | Any block out of reach (>4.5 blocks from bot) |
| mineflayer-tool (existing) | installed | Equip correct item before placing | Some blocks require held item match |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON blueprint files | Inline generated coordinates | JSON files are human-editable, version-controlled, can define new structures without code changes |
| Blueprint catalog in body/ | Blueprints in mind/ | Body owns execution data; mind drives selection — keeps boundary clean |
| Single `!build blueprint:name` command | `!build x:N y:N z:N block:name` per-block | Per-block LLM calls are expensive; blueprint approach batches the whole plan into one dispatch |

**Installation:** No new dependencies required.

---

## Architecture Patterns

### Recommended Project Structure

```
body/skills/
└── build.js               # New: build skill (SKILL-05)

body/blueprints/           # New: blueprint store (ported from agent/blueprints/)
├── small-cabin.json       # Existing blueprint (port)
├── animal-pen.json        # Existing blueprint (port)
├── crop-farm.json         # Existing blueprint (port)
└── watchtower.json        # New: Jeffrey-style lookout (elevated, view)

mind/
├── prompt.js              # Extend: inject build context + blueprint catalog
└── registry.js            # Extend: wire !build command

data/<agentname>/
└── build_state.json       # New: active plan + block progress (survives session restart)
```

### Pattern 1: Block Queue Execution (bottom-to-top layer order)

**What:** Sort blueprint layers by `y`, convert grid characters to world coordinates, build a flat `{x, y, z, block}` array. Execute in order with `placeBlock()`, checking interrupt after each placement.

**When to use:** Every build execution. Bottom-to-top is mandatory — placing a roof block first would fail because there's no adjacent solid block to place against.

**Example:**
```javascript
// body/skills/build.js — layer-to-queue conversion (port from v1 agent/builder.js)
const sortedLayers = [...blueprint.layers].sort((a, b) => a.y - b.y)
for (const layer of sortedLayers) {
  for (let row = 0; row < layer.grid.length; row++) {
    for (let col = 0; col < layer.grid[row].length; col++) {
      const char = layer.grid[row][col]
      if (char === '.' || char === ' ') continue
      const blockName = resolvedPalette[char]
      if (!blockName) continue
      queue.push({ x: originX + col, y: originY + layer.y, z: originZ + row, block: blockName })
    }
  }
}
```

### Pattern 2: Placement Mechanics — Reference Block + Face

**What:** `bot.placeBlock(referenceBlock, faceVector)` requires an existing solid adjacent block. For building upward, the reference is the block at `(x, y-1, z)` and the face is `FACE.TOP`. This is the fundamental constraint driving layer order.

**Critical cases:**
- Floor (y=0 of blueprint): reference block is the **natural ground** at `(x, originY-1, z)` — already exists
- Wall blocks: reference block is the floor or wall block below — already placed if bottom-to-top
- Roof: reference block is the top wall block — already placed

**Example:**
```javascript
// For each block in queue:
const refPos = new Vec3(block.x, block.y - 1, block.z)
const refBlock = bot.blockAt(refPos)
// If refBlock is null/air, no solid block to place against — try adjacent faces
const result = await placeBlock(bot, refBlock, FACE.TOP)
```

### Pattern 3: Proximity Navigation Before Placement

**What:** Mineflayer can only place blocks within ~4.5 blocks of the bot's position. Before iterating a batch, navigate to the block's position. For large structures, the bot must reposition mid-build.

**When to use:** Every placement. Either navigate-per-block (robust, slow) or navigate to zone center and place all blocks within reach (faster, requires distance check).

**Recommended approach:** Navigate to within 3 blocks of each target before calling `placeBlock()`. Use `navigateTo(bot, block.x, block.y, block.z, 3)`.

### Pattern 4: Build State Persistence

**What:** Save active build queue progress to `data/<agentname>/build_state.json` after each placement. On init, check for existing state and resume.

**When to use:** Session start (`initBuild(config)` pattern matching other init functions).

**Example:**
```javascript
// body/skills/build.js
export function initBuild(config) {
  _stateFile = join(config.dataDir, 'build_state.json')
  if (existsSync(_stateFile)) {
    try { _activeBuild = JSON.parse(readFileSync(_stateFile, 'utf-8')) }
    catch { _activeBuild = null }
  }
}
```

### Pattern 5: Inventory Check + Pause

**What:** Before placing each block, verify bot has the required item in inventory. If not, pause and return a `missingMaterials` list so the LLM can dispatch `!gather` or `!craft` first.

**Example (port from v1 resumeBuild):**
```javascript
// Check inventory before placement
const itemId = mcData.itemsByName[block.block]?.id
const hasItem = bot.inventory.findInventoryItem(itemId, null)
if (!hasItem) {
  return { success: false, reason: 'missing_material', missing: block.block, placed, total }
}
```

### Pattern 6: Personality-Driven Blueprint Selection (BUILD-02)

**What:** The `!build` command's blueprint argument is chosen by the LLM, not hardcoded. The system prompt lists available blueprints with descriptions. The SOUL file's aesthetic preferences naturally steer the choice.

**Jeffrey selects:** Elevated structures (watchtower), aesthetically striking builds (small_cabin with windows and views)
**John selects:** Functional structures (crop_farm for organized food, animal_pen for efficiency)

The LLM makes this choice autonomously — the planner only needs to ensure blueprint descriptions in the prompt match the personality drivers in SOUL files.

**Prompt injection example:**
```
Available blueprints:
  small_cabin — 5x7 wooden cabin with door, windows, flat roof (walls+roof+floor)
  animal_pen — 7x7 fenced pen with gate, open ground (fence perimeter)
  crop_farm — 9x9 irrigated farm rows (ground-level, water channel)
  watchtower — 5x5 stone tower, 8 blocks tall, open top with view

To build: !build blueprint:small_cabin x:120 y:64 z:200
```

### Pattern 7: Cross-Session Expansion (BUILD-03)

**What:** After build completes, write a `worldKnowledge` entry in MEMORY.md: `"Built small_cabin at 120,64,200. Needs furnishings."` On next session, memory injection surfaces this note, prompting the LLM to decide whether to expand or improve.

**Example memory entries:**
- `"Built animal_pen at 95,64,185. Could add a second pen for chickens."`
- `"Built small_cabin at 120,64,200. Walls done but no lighting yet."`
- `"Watchtower at 130,64,210 complete. Good view east toward forest."`

### Anti-Patterns to Avoid

- **Placing without navigating:** `bot.placeBlock()` silently fails if target is out of reach. Always navigate within 3 blocks first.
- **Top-to-bottom layer order:** Placing roof before walls fails — no adjacent solid block exists yet.
- **Blocking the Mind loop with full build execution:** A 100-block build should yield control via interrupt checks after every placement, not run to completion in one skill call.
- **Hardcoding blueprint choice per agent:** Personality-driven selection must come from the LLM reading SOUL + prompt context, not `if (agentName === 'jeffrey')` branching.
- **Importing mind/ from body/:** Build state and blueprint resolution live in body/. The registry dispatches and surfaces results back to the LLM as a normal skill result.
- **Using v1 agent/builder.js directly:** It uses the HermesBridge HTTP API (not mineflayer). Port the logic, not the imports.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Block placement with verification | Custom HTTP place action | `body/place.js` `placeBlock()` | Already built in Phase 1, handles post-place verification |
| Navigation to build site | Custom pathfinding | `body/navigate.js` `navigateTo()` | Already built in Phase 1, handles timeouts |
| Block name validation | Manual string checks | `mcData.blocksByName[name]` | Handles all 1.21.1 block IDs; v1 freestyle.js does this exactly |
| Inventory check | Loop over items manually | `bot.inventory.findInventoryItem(itemId, null)` | Mineflayer built-in, handles stacking and metadata |
| Blueprint JSON format | New schema | v1 `agent/blueprints/*.json` format | Already designed, has palette + layers + size; small-cabin.json is a working example |
| Cooperative interrupt | Custom cancellation flags | `isInterrupted(bot)` from `body/interrupt.js` | Already established pattern; all Phase 1-5 skills use it |

**Key insight:** Every mechanical primitive needed for building already exists. Phase 6 is integration work — wiring existing pieces into a build skill and surfacing it to the LLM.

---

## Common Pitfalls

### Pitfall 1: No Adjacent Block for placeBlock()
**What goes wrong:** `bot.placeBlock(refBlock, faceVector)` throws or resolves silently when `refBlock` is null or air. This happens when placing the first floor block on terrain that has gaps or when placing a wall block before the layer below it.
**Why it happens:** Mineflayer placement requires a **solid** adjacent block to place against. Air or null returns no error in some cases — the block just doesn't appear.
**How to avoid:** Always call `bot.blockAt(refPos)` before placement. If null or air, try adjacent faces (NORTH/SOUTH/EAST/WEST) for cases where terrain is uneven. Post-place verify with `body/place.js` catches silent failures.
**Warning signs:** `placeBlock()` resolves success but `bot.blockAt(targetPos)` still shows air.

### Pitfall 2: Bot Too Far to Place
**What goes wrong:** `bot.placeBlock()` throws `"No block in reach"` or similar error when target is >4.5 blocks away. In a large structure (e.g., far wall of 9x9 farm), the bot must move.
**Why it happens:** Mineflayer enforces arm reach distance client-side.
**How to avoid:** Navigate to within 3 blocks of each block before placing. For sequential blocks in the same zone, a single navigate per cluster (not per block) is acceptable if blocks stay within reach.
**Warning signs:** Consistent placement failures on one side of a structure but not the other.

### Pitfall 3: Door/Gate Special Blocks
**What goes wrong:** Doors (oak_door) and fence gates (oak_fence_gate) are two-block-tall entities in Minecraft but occupy special block state slots. `bot.placeBlock()` on door items creates both halves automatically — placing a second door block at y+1 produces a double door or corrupts state.
**Why it happens:** v1 small-cabin.json places door only at y=1 for this reason (comment in blueprint: "Door is 2-tall, place at y=1 only").
**How to avoid:** In blueprints, only mark the bottom position of doors and gates. The top half is auto-placed by the server. The `D` palette entry in the cabin blueprint is already correct.
**Warning signs:** Two-block doorways showing odd states or doubled doors.

### Pitfall 4: Equipped Item Mismatch
**What goes wrong:** Placing `oak_planks` requires holding an oak_planks item. If the bot has the item but it's not equipped (held in hand), `bot.placeBlock()` may fail or place the wrong block.
**Why it happens:** Mineflayer uses the currently held item for placement. The item must be in the hotbar and selected.
**How to avoid:** Before each `placeBlock()` call, call `bot.equip(itemId, 'hand')` to ensure the correct item is held. Pattern from v1: check inventory, equip, then place.
**Warning signs:** Block placed but wrong type (e.g., cobblestone where planks expected).

### Pitfall 5: Stale Build State After World Changes
**What goes wrong:** Loaded build state from `build_state.json` references world coordinates that now have blocks placed by another agent or the player. Trying to re-place already-filled coordinates wastes time or fails.
**Why it happens:** Cross-session state saves coordinates but not whether the block is currently there.
**How to avoid:** At resume time, scan the remaining queue and filter out positions where `bot.blockAt(pos).name !== 'air'` — those blocks are already placed and can be skipped.
**Warning signs:** Build reports `n` blocks remaining but structures looks complete.

### Pitfall 6: Blueprint Origin Selection
**What goes wrong:** The LLM picks arbitrary coordinates for `!build` that overlap existing structures, place the build inside a hill, or put it in water.
**Why it happens:** The LLM sees position from game state but doesn't check if the area is clear.
**How to avoid:** Build skill should do a pre-flight check — scan `originX` to `originX+size.x`, `originZ` to `originZ+size.z` at `originY` height and return a warning if too many non-air blocks are present. Surface this as a skill result so the LLM can choose a different location.
**Warning signs:** Structures with missing blocks where terrain existed.

---

## Code Examples

Verified patterns from existing codebase:

### Build Skill Skeleton
```javascript
// body/skills/build.js — new file

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import minecraftData from 'minecraft-data'
import { Vec3 } from 'vec3'
import { placeBlock, FACE } from '../place.js'
import { navigateTo } from '../navigate.js'
import { isInterrupted } from '../interrupt.js'

const mcData = minecraftData('1.21.1')
const BLUEPRINTS_DIR = new URL('../../body/blueprints', import.meta.url).pathname

let _stateFile = ''
let _activeBuild = null

export function initBuild(config) {
  _stateFile = join(config.dataDir, 'build_state.json')
  if (existsSync(_stateFile)) {
    try { _activeBuild = JSON.parse(readFileSync(_stateFile, 'utf-8')) }
    catch { _activeBuild = null }
  }
  // Filter already-placed blocks (stale state from prior session)
  // Done lazily at execute time, not here
}

export async function build(bot, blueprintName, originX, originY, originZ) {
  // Load blueprint
  // Resolve palette against inventory
  // Build block queue (sorted layers)
  // If resuming, skip to _activeBuild.completed index
  // Loop: navigate near block, equip item, placeBlock(), verify, save state
  // Check isInterrupted(bot) after every placement
  // Return { success, placed, total, reason? }
}
```

### Palette Resolution (port of v1 blueprints.js resolvePalette)
```javascript
// Source: agent/blueprints.js resolvePalette — port to body/skills/build.js
function resolvePalette(blueprint, bot) {
  const resolved = {}
  for (const [key, entry] of Object.entries(blueprint.palette)) {
    const preferred = entry.preferred || []
    // Find first preferred block bot actually has in inventory
    const match = preferred.find(name => {
      const itemId = mcData.itemsByName[name]?.id
      return itemId !== undefined && bot.inventory.findInventoryItem(itemId, null) !== null
    })
    resolved[key] = match || preferred[0] || 'cobblestone'
  }
  return resolved
}
```

### Registry Wiring Pattern (mirror of existing entries)
```javascript
// mind/registry.js — add to REGISTRY Map
['build', (bot, args) => {
  const { blueprintName, blueprint } = args
  const name = blueprintName || blueprint
  const x = parseInt(args.x)
  const y = parseInt(args.y)
  const z = parseInt(args.z)
  return build(bot, name, x, y, z)
}],
```

### Prompt Build Context Injection
```javascript
// mind/prompt.js buildSystemPrompt — add Part N: build context
if (options.buildContext) {
  parts.push(options.buildContext)
}

// mind/prompt.js new export
export function getBuildContextForPrompt(activeBuild, blueprintCatalog) {
  const lines = []
  if (activeBuild) {
    lines.push(`Active build: ${activeBuild.blueprintName} — ${activeBuild.completed}/${activeBuild.total} blocks placed.`)
    if (activeBuild.missingMaterials?.length) {
      lines.push(`Paused — need: ${activeBuild.missingMaterials.join(', ')}`)
    }
  }
  if (blueprintCatalog.length > 0) {
    lines.push('Available blueprints (use !build to start):')
    for (const bp of blueprintCatalog) {
      lines.push(`  ${bp.name} — ${bp.description}`)
    }
    lines.push('!build blueprint:name x:N y:N z:N')
  }
  return lines.join('\n')
}
```

### Cross-Session Memory Recording
```javascript
// In build.js, on build complete:
// Source: mind/memory.js addWorldKnowledge pattern
addWorldKnowledge(`Built ${blueprintName} at ${originX},${originY},${originZ}. Consider expanding.`)
```

---

## State of the Art

| Old Approach (v1) | Current Approach (v2) | Impact |
|-------------------|----------------------|--------|
| agent/builder.js sends HTTP to HermesBridge | body/skills/build.js calls bot.placeBlock() directly | No network overhead, synchronous world state |
| agent/freestyle.js — LLM generates coordinate lists | v2 uses structured blueprint JSON + palette resolution | Reliable block counts, valid MC IDs enforced, no 200-block truncation |
| agent/blueprints/ in agent/ directory | body/blueprints/ in body/ directory | Aligns with Mind/Body split; execution data lives in body/ |
| Module-level `_activeBuild` (in-memory only) | Per-agent `build_state.json` (persisted to disk) | Build survives crashes and session restarts |
| Tick-based 3-blocks-per-tick (resumeBuild called from tick loop) | Skill-loop: run until complete or interrupted | Cleaner — build is one dispatched skill, not a persistent tick state |

**Deprecated/outdated:**
- `agent/builder.js`: Uses HermesBridge HTTP API — dead in v2. Port logic only.
- `agent/freestyle.js`: LLM coordinate generation is fragile (hallucinates block IDs, hits 200-block cap). Blueprints are better.
- `agent/blueprints.js`: Port `resolvePalette` and `getBlueprintMaterials` logic directly into `body/skills/build.js`. No need for a separate loader module.

---

## Open Questions

1. **Watchtower blueprint needed for Jeffrey**
   - What we know: Jeffrey's SOUL drives "lookout point", "elevation over flat ground", "The Overlook" naming pattern
   - What's unclear: No elevated structure exists in v1 blueprint set
   - Recommendation: Create `body/blueprints/watchtower.json` (5x5, 8-block tower, open platform) as part of Wave 1; this directly enables BUILD-02 personality differentiation

2. **Per-block navigation vs zone navigation**
   - What we know: Navigating to each block individually is correct but slow for a 35-block floor
   - What's unclear: How much the overhead matters given the 2s+ LLM round-trip already dominates
   - Recommendation: Navigate to within 3 blocks of each block. The nav calls are fast (often no-op if already close). Do not optimize prematurely.

3. **Build origin selection — who decides the coordinates?**
   - What we know: `!build blueprint:name x:N y:N z:N` means the LLM must supply coordinates; LLM sees current position from game state
   - What's unclear: Will LLM reliably pick flat/clear terrain near current position?
   - Recommendation: Surface a simple pre-flight area check in build skill result. If terrain is cluttered, return `{ success: false, reason: 'site_blocked', suggestion: 'Choose coordinates on flatter terrain' }` so LLM can retry with different coords.

4. **`!build resume` vs auto-resume on init**
   - What we know: v1 freestyle.js auto-resumes from saved state on init
   - What's unclear: Auto-resume might confuse the LLM if it doesn't know a build is in progress
   - Recommendation: Auto-resume the queue state silently (skip already-placed blocks), but inject build progress into the prompt every tick so the LLM knows a build is active. Let the LLM decide to continue or cancel.

---

## Sources

### Primary (HIGH confidence)
- `/home/bigphoot/Desktop/hermescraft/body/place.js` — placeBlock() API, FACE vectors, post-place verify pattern
- `/home/bigphoot/Desktop/hermescraft/body/navigate.js` — navigateTo() range/timeout pattern
- `/home/bigphoot/Desktop/hermescraft/body/interrupt.js` — isInterrupted(), clearInterrupt() patterns
- `/home/bigphoot/Desktop/hermescraft/body/skills/gather.js` — cooperative interrupt loop pattern (model for build loop)
- `/home/bigphoot/Desktop/hermescraft/body/skills/craft.js` — inventory check + findInventoryItem pattern
- `/home/bigphoot/Desktop/hermescraft/mind/registry.js` — dispatch wiring pattern; where !build must be added
- `/home/bigphoot/Desktop/hermescraft/mind/prompt.js` — buildSystemPrompt parts injection pattern
- `/home/bigphoot/Desktop/hermescraft/mind/memory.js` — addWorldKnowledge() for cross-session persistence
- `/home/bigphoot/Desktop/hermescraft/mind/locations.js` — saveLocation() for recording build sites
- `/home/bigphoot/Desktop/hermescraft/agent/blueprints.js` — resolvePalette, getBlueprintMaterials (port)
- `/home/bigphoot/Desktop/hermescraft/agent/builder.js` — queue construction, inventory check, placement loop (port logic)
- `/home/bigphoot/Desktop/hermescraft/agent/freestyle.js` — build_state.json persistence pattern (port)
- `/home/bigphoot/Desktop/hermescraft/agent/blueprints/small-cabin.json` — canonical blueprint format reference
- `/home/bigphoot/Desktop/hermescraft/SOUL-jeffrey.md` — "Elevation over flat ground", "lookout point" creative drives
- `/home/bigphoot/Desktop/hermescraft/SOUL-john.md` — "organized workshops", "straight rows", "crop farm" creative drives
- `/home/bigphoot/Desktop/hermescraft/.planning/STATE.md` — confirmed architecture decisions and pitfalls from prior phases

### Secondary (MEDIUM confidence)
- Mineflayer docs: `bot.placeBlock(referenceBlock, faceVector)` requires adjacent solid block — consistent with existing body/place.js implementation
- Minecraft 1.21.1 mechanics: bottom-to-top layer order for valid placement adjacency — standard game mechanic, verified in v1 builder layer sorting

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries already installed and in active use
- Architecture: HIGH — directly derived from existing v1 code (agent/builder.js, agent/freestyle.js) and v2 patterns (body/skills/*.js)
- Pitfalls: HIGH — pitfalls 1-4 are from v1 code analysis and known Mineflayer placement constraints; pitfalls 5-6 are inferred from state management and LLM behavior patterns

**Research date:** 2026-03-22
**Valid until:** 2026-05-22 (stable stack — mineflayer API changes infrequently)
