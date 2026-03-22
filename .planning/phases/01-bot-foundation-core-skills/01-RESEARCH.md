# Phase 1: Bot Foundation + Core Skills - Research

**Researched:** 2026-03-22
**Domain:** Mineflayer headless bot, mineflayer-pathfinder, cooperative skill interruption
**Confidence:** HIGH (core API verified via official docs + npm registry + minecraft-data runtime inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints from PROJECT.md and STATE.md:
- Mind + Body split: LLM layer (mind/) never imports skill functions; body/ never calls LLM
- Cooperative interrupt: every skill checks `bot.interrupt_code` after every `await`
- Pathfinder hang: wrap `goto()` in wall-clock timeout
- Silent dig/place: verify block state changed with `bot.blockAt()` after every dig and place
- Item name normalization: port v1 normalizer before writing any skill
- Validate `mineflayer-pathfinder` 2.4.5 live on Paper 1.21.1 before full skill dev

### Claude's Discretion
All implementation choices (file structure, function signatures, error handling patterns) are at Claude's discretion within the constraints above.

### Deferred Ideas (OUT OF SCOPE)
None for this phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BOT-01 | Mineflayer bot connects to Paper 1.21.1 server in offline mode and spawns successfully | `mineflayer.createBot({ auth: 'offline', version: '1.21.1' })` pattern confirmed; known RangeError on advancement packets is intermittent and plugin-dependent |
| BOT-02 | Bot navigates to any reachable coordinate using mineflayer-pathfinder with wall-clock timeout on unreachable goals | Issue #222 (open, unresolved) confirms goto() hangs on unreachable goals — `Promise.race` with `setTimeout` reject is the correct mitigation; pathfinder.stop() on timeout |
| BOT-03 | Bot digs blocks using bot.dig() with post-dig verification (block actually changed) | `bot.dig(block)` returns Promise; `bot.blockAt(pos).name` check after resolves confirms server-side change |
| BOT-04 | Bot places blocks using bot.placeBlock() with post-place verification | `bot.placeBlock(refBlock, faceVector)` returns Promise; `bot.blockAt(pos).name` after confirms placement |
| BOT-05 | Cooperative interrupt system — all skill functions check interrupt flag and yield cleanly | Mindcraft pattern: `bot.interrupt_code` flag on bot object, checked after every `await` in loops |
| SKILL-01 | Gather skill — collect N of a resource (find nearest, pathfind, dig, repeat) | `bot.findBlocks({ matching, maxDistance, count })` + navigate + dig loop with interrupt check each iteration |
| SKILL-02 | Mine skill — mine ore with auto-best-tool selection | `minecraft-data` `block.harvestTools` map + tier ranking provides tool selection; `mineflayer-tool` plugin wraps this as `bot.tool.equipForBlock(block)` |
</phase_requirements>

---

## Summary

Phase 1 replaces the Fabric mod + HTTP bridge entirely with Mineflayer, establishing a headless bot that can connect to Paper 1.21.1, navigate, dig, place, and execute the two primitive skills (gather, mine). The critical infrastructure for all subsequent phases is the **cooperative interrupt harness** (`bot.interrupt_code` flag checked after every `await`) and the **wall-clock timeout wrapper** around `bot.pathfinder.goto()` to prevent indefinite hangs on unreachable goals.

The standard stack is: `mineflayer@4.35.0` (already installed), `mineflayer-pathfinder@2.4.5` (needs install), `mineflayer-tool@1.2.0` (needs install). Both plugins need to be added to `package.json`. The v1 `normalizer.js` is directly reusable as-is. The v1 `crafter.js` is reusable but belongs to Phase 2.

**Primary recommendation:** Implement body/ as a flat skill module directory with one file per skill. Use `Promise.race` for goto timeout. Check `bot.interrupt_code` after every `await` inside skill loops. Verify dig/place with `bot.blockAt()` immediately after. Install mineflayer-pathfinder and run a smoke test against the live Paper server before writing skills.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mineflayer | 4.35.0 (installed) | Headless MC bot, dig/place/chat API | The PrismarineJS standard; direct API, no HTTP bridge |
| mineflayer-pathfinder | 2.4.5 (needs install) | A* pathfinding, goto(goal) | Only mature pathfinder for mineflayer; latest stable |
| mineflayer-tool | 1.2.0 (needs install) | Auto-select best tool for block type | Handles harvestTools + speed ranking; avoids hand-rolling |
| minecraft-data | 3.105.0 (installed) | Block/item/recipe registry for 1.21.1 | Used by normalizer, crafter, and tool-selection logic |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vec3 | bundled with mineflayer | 3D coordinate math, faceVector for placeBlock | Every place/navigate operation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| mineflayer-tool | Hand-rolled tool ranking | mineflayer-tool handles edge cases (golden tools, material tiers); not worth hand-rolling |
| mineflayer-pathfinder | mineflayer-baritone fork | Baritone fork is experimental, no Paper 1.21.1 validation; pathfinder is the ecosystem standard |

**Installation:**
```bash
npm install mineflayer-pathfinder mineflayer-tool
```

**Version verification (confirmed against npm registry 2026-03-22):**
- mineflayer-pathfinder: 2.4.5 (published 2023-09-04, latest dist-tag)
- mineflayer-tool: 1.2.0 (published 2022-05-11, latest dist-tag)
- Both have no peerDependencies restrictions

---

## Architecture Patterns

### Recommended Project Structure
```
body/
├── bot.js           # createBot, loadPlugin, spawn lifecycle
├── navigate.js      # goto() with wall-clock timeout wrapper
├── dig.js           # dig() with post-dig verification
├── place.js         # placeBlock() with post-place verification
├── interrupt.js     # interrupt flag management helpers
├── skills/
│   ├── gather.js    # collect N of resource (find + nav + dig loop)
│   └── mine.js      # mine ore with auto-tool selection
normalizer.js        # already exists — reuse as-is
```

Mind layer (`mind/`) is Phase 3+. Phase 1 only builds the `body/` layer.

### Pattern 1: Wall-Clock Timeout Around goto()

**What:** `Promise.race` between `goto()` and a `setTimeout` reject — the only reliable defense against Issue #222 (pathfinder hangs indefinitely on unreachable goals, open as of March 2025).

**When to use:** Every single call to `bot.pathfinder.goto()` in every skill.

```javascript
// Source: mineflayer-pathfinder readme + Issue #222 mitigation
async function navigate(bot, goal, timeoutMs = 30000) {
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('nav_timeout')), timeoutMs)
  )
  try {
    await Promise.race([bot.pathfinder.goto(goal), timer])
    return true
  } catch (err) {
    bot.pathfinder.setGoal(null)  // force stop immediately
    if (err.message === 'nav_timeout') return false
    throw err  // re-throw unexpected pathfinder errors (noPath etc.)
  }
}
```

### Pattern 2: Cooperative Interrupt Check

**What:** All skill async loops poll `bot.interrupt_code` after every `await`. This is the Mindcraft-proven pattern for cooperative cancellation without forced termination.

**When to use:** Inside every `for`/`while` loop in every skill function, after every `await`.

```javascript
// Source: Mindcraft skills.js (collectBlock pattern)
async function gather(bot, blockName, count = 1) {
  for (let i = 0; i < count; i++) {
    if (bot.interrupt_code) break  // check BEFORE doing work
    const block = findNearestBlock(bot, blockName)
    if (!block) break
    await navigate(bot, new GoalNear(block.position.x, block.position.y, block.position.z, 1))
    if (bot.interrupt_code) break  // check AFTER every await
    await bot.dig(block)
    if (bot.interrupt_code) break
  }
}
```

**Interrupt flag management:**
- Set: `bot.interrupt_code = true` (from skill cancellation caller)
- Clear: `bot.interrupt_code = false` (reset at start of each new skill dispatch)
- The flag lives on the bot object — no module-level state needed

### Pattern 3: Post-Dig / Post-Place Verification

**What:** After `bot.dig(block)` resolves, immediately call `bot.blockAt(pos)` to confirm the block name changed. After `bot.placeBlock()`, confirm the target position is no longer air.

**When to use:** Every dig and place call. Required per BOT-03 and BOT-04.

```javascript
// Source: mineflayer API docs — bot.blockAt, bot.dig
async function digWithVerify(bot, block) {
  const pos = block.position.clone()
  const nameBefore = bot.blockAt(pos)?.name
  await bot.dig(block)
  const nameAfter = bot.blockAt(pos)?.name
  if (nameAfter === nameBefore) {
    // Server-side protection (WorldGuard, etc.) — dig silently failed
    return { success: false, reason: 'block_unchanged' }
  }
  return { success: true }
}

async function placeWithVerify(bot, refBlock, faceVector) {
  const targetPos = refBlock.position.plus(faceVector)
  await bot.placeBlock(refBlock, faceVector)
  const placed = bot.blockAt(targetPos)
  if (!placed || placed.name === 'air') {
    return { success: false, reason: 'placement_failed' }
  }
  return { success: true, placedBlock: placed.name }
}
```

### Pattern 4: Tool Selection for Mining (SKILL-02)

**What:** Use `mineflayer-tool` plugin's `bot.tool.equipForBlock(block)` before digging. It reads `minecraft-data` block.harvestTools and picks the fastest tool in inventory.

**When to use:** Before every `bot.dig()` call in mine/gather skills.

```javascript
// Source: mineflayer-tool API docs, minecraft-data runtime verification
await bot.tool.equipForBlock(block, { requireHarvest: false })
// requireHarvest: false means it'll try even without proper tool
// (block.canHarvest check optional — returns false if wrong tier)
const itemId = bot.heldItem ? bot.heldItem.type : null
const canDrop = block.canHarvest(itemId)
// if canDrop is false, warn but still dig (for wood, dirt, etc. that don't require specific tools)
```

**Tier data verified from minecraft-data 1.21.1:**
- iron_ore: requires stone_pickaxe or better (harvestTools enforced)
- diamond_ore: requires iron_pickaxe or better
- coal_ore, stone: any pickaxe works
- oak_log, dirt, gravel: no harvestTools restriction (any tool or bare hands)

### Pattern 5: Bot Connection (BOT-01)

```javascript
// Source: mineflayer docs, verified via GitHub issues/discussions
import mineflayer from 'mineflayer'
import { pathfinder, Movements } from 'mineflayer-pathfinder'
import { plugin as toolPlugin } from 'mineflayer-tool'

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'jeffrey',
  auth: 'offline',        // Paper offline-mode server
  version: '1.21.1',      // explicit version required for Paper
})

bot.loadPlugin(pathfinder)
bot.loadPlugin(toolPlugin)

bot.once('spawn', () => {
  const movements = new Movements(bot)
  bot.pathfinder.setMovements(movements)
  bot.interrupt_code = false  // initialize interrupt flag
})

bot.on('error', (err) => { /* log, reconnect */ })
bot.on('kicked', (reason) => { /* log, reconnect */ })
bot.on('end', () => { /* reconnect logic */ })
```

### Anti-Patterns to Avoid
- **Double-dig without await:** Calling `bot.dig()` twice before first resolves throws fatal `diggingAborted` error. Never fire-and-forget dig calls.
- **goto() without timeout:** Hangs forever on unreachable goals (Issue #222, open). Always use `Promise.race`.
- **Trusting dig result without blockAt check:** Server-side protection plugins (WorldGuard, CoreProtect) silently prevent digs without throwing an error. Always verify.
- **Setting bot.version to wrong value:** Mineflayer will use incorrect packet protocol. Always pass `version: '1.21.1'` explicitly.
- **Loading mineflayer-pathfinder before spawn:** setMovements must be called in the `spawn` event handler, not at module load time.
- **Writing skills before porting normalizer:** Every skill that takes a block/item name from external input needs normalization. Port first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Best tool for block type | Custom tool ranking by name string | mineflayer-tool `equipForBlock` | Handles golden tools, enchantments, tier ordering, and speed math |
| A* pathfinding | Custom BFS/DFS traversal | mineflayer-pathfinder `goto` | Handles vertical navigation, swimming, door opening, fall detection |
| Item name to block ID | Manual string→id mapping | `minecraft-data.blocksByName[name].id` | 900+ blocks; any custom map will miss variants |

**Key insight:** Both pathfinder and tool selection have dozens of edge cases baked in from years of community use. Hand-rolling either would consume multiple phases of work.

---

## Common Pitfalls

### Pitfall 1: Pathfinder Indefinite Hang (Issue #222)
**What goes wrong:** `bot.pathfinder.goto(goal)` never resolves or rejects when the goal is surrounded by unbreakable blocks. The Promise hangs forever, freezing the skill execution.

**Why it happens:** Pathfinder lacks detection logic for truly unreachable goals. It approaches the obstruction, stops moving, and emits no events. The Promise never settles.

**How to avoid:** Always wrap `goto()` in `Promise.race` with a `setTimeout` reject. After timeout, call `bot.pathfinder.setGoal(null)` (not `.stop()`) for immediate halt.

**Warning signs:** Skill function appears running but bot hasn't moved in 30+ seconds.

### Pitfall 2: Silent Dig Failure from Server Protection
**What goes wrong:** `bot.dig(block)` resolves successfully (no error thrown) but the block remains. This happens on protected land (WorldGuard, Residence, etc.) or when the bot lacks permissions.

**Why it happens:** The server sends a block update placing the block back; mineflayer resolves the dig Promise on its own state machine, not on server confirmation of the final block state.

**How to avoid:** Always follow `bot.dig()` with `bot.blockAt(pos).name` comparison. If name unchanged, mark as failed and do not count toward gather target.

**Warning signs:** gather() never terminates — digs same block repeatedly without progress.

### Pitfall 3: Double Dig Fatal Error
**What goes wrong:** `diggingAborted` fatal error crashes the bot or corrupts state.

**Why it happens:** Calling `bot.dig()` a second time before first dig resolves (e.g., in tight loops where interrupt check is missing).

**How to avoid:** One dig active at a time. Check `bot.interrupt_code` before each dig call. Never fire-and-forget.

### Pitfall 4: Wrong Version on Paper Connects Wrong Protocol
**What goes wrong:** Bot joins but behaves strangely, or gets kicked with "outdated client" variants.

**Why it happens:** Without explicit `version: '1.21.1'` in `createBot`, mineflayer defaults to `latestSupportedVersion` which may not match the Paper server version.

**How to avoid:** Always pass `version: '1.21.1'` explicitly.

### Pitfall 5: Advancement Packet RangeError (Issue #3492)
**What goes wrong:** Bot connects but immediately disconnects with `RangeError: ERR_OUT_OF_RANGE` (negative offset in packet deserialization).

**Why it happens:** A bug in `node-minecraft-protocol` when deserializing advancement packets sent by some Paper plugin configurations. Issue open as of May 2025.

**How to avoid:** This is intermittent and server-config-dependent. Test connection first. If hit: check Paper plugins for advancement-modifying plugins; the workaround is environment-specific. The smoke test wave (BOT-01 validation) must catch this early.

**Warning signs:** Bot gets kicked within 1-2 seconds of spawning with a protocol error stack trace.

### Pitfall 6: mineflayer-pathfinder Movements Not Set at Spawn
**What goes wrong:** `bot.pathfinder.goto()` throws "No movements set" or navigates incorrectly.

**Why it happens:** `new Movements(bot)` depends on bot world state being initialized. Must be called inside the `spawn` event handler.

**How to avoid:** Always set movements in `bot.once('spawn', ...)`.

---

## Code Examples

Verified patterns from official sources:

### Bot Creation (offline mode, Paper 1.21.1)
```javascript
// Source: mineflayer API docs + offline-mode discussion #2488
const bot = mineflayer.createBot({
  host: process.env.MC_HOST || 'localhost',
  port: parseInt(process.env.MC_PORT || '25565'),
  username: process.env.MC_USERNAME || 'jeffrey',
  auth: 'offline',
  version: '1.21.1',
})
```

### Plugin Setup (spawn handler)
```javascript
// Source: mineflayer-pathfinder readme
bot.loadPlugin(pathfinder)
bot.loadPlugin(toolPlugin)

bot.once('spawn', () => {
  const movements = new Movements(bot)
  movements.allowSprinting = true
  bot.pathfinder.setMovements(movements)
  bot.interrupt_code = false
})
```

### Navigate with Timeout
```javascript
// Source: mineflayer-pathfinder readme + Issue #222 analysis
import { goals } from 'mineflayer-pathfinder'

async function navigateTo(bot, x, y, z, range = 1, timeoutMs = 30000) {
  const goal = new goals.GoalNear(x, y, z, range)
  const timer = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('nav_timeout')), timeoutMs)
  )
  try {
    await Promise.race([bot.pathfinder.goto(goal), timer])
    return { success: true }
  } catch (err) {
    bot.pathfinder.setGoal(null)
    return { success: false, reason: err.message }
  }
}
```

### Dig with Verification
```javascript
// Source: mineflayer API docs — bot.dig, bot.blockAt
async function digBlock(bot, block) {
  const pos = block.position
  const before = bot.blockAt(pos)?.name
  await bot.dig(block)
  const after = bot.blockAt(pos)?.name
  return { success: after !== before, before, after }
}
```

### Gather Loop (SKILL-01 skeleton)
```javascript
// Source: Mindcraft collectBlock pattern + interrupt design
import { goals } from 'mineflayer-pathfinder'

async function gather(bot, blockName, count = 1) {
  bot.interrupt_code = false
  let collected = 0
  while (collected < count) {
    if (bot.interrupt_code) break

    const blockId = mcData.blocksByName[blockName]?.id
    const block = bot.findBlock({ matching: blockId, maxDistance: 64 })
    if (!block) break

    await bot.tool.equipForBlock(block, { requireHarvest: false })
    if (bot.interrupt_code) break

    const nav = await navigateTo(bot, block.position.x, block.position.y, block.position.z, 2)
    if (bot.interrupt_code) break
    if (!nav.success) continue  // unreachable — try next nearest

    const dig = await digBlock(bot, bot.blockAt(block.position))
    if (bot.interrupt_code) break
    if (dig.success) collected++
  }
  return collected
}
```

### Block Harvest Tool Check (SKILL-02)
```javascript
// Source: minecraft-data 1.21.1 runtime verification
// block.harvestTools is a map of { itemId: true }
// If empty/undefined, any tool (or bare hands) works
function canHarvestWith(block, heldItemId) {
  if (!block.harvestTools) return true  // no tool restriction
  return !!block.harvestTools[heldItemId]
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fabric mod + HTTP bridge (v1) | Mineflayer direct API | v2.0 | Eliminates crosshair drift, coordinate bugs, race conditions, 1GB RAM per bot |
| Baritone (chat command) | mineflayer-pathfinder (native JS) | v2.0 | No Minecraft client required, Promise-based, interruptible |
| Custom HTTP state polling | mineflayer events (spawn, physicsTick) | v2.0 | Event-driven, no polling overhead |
| `physicTick` event | `physicsTick` event (rename) | mineflayer ~4.x | `physicTick` is deprecated — use `physicsTick` |

**Deprecated/outdated:**
- `physicTick`: Renamed to `physicsTick` in recent mineflayer versions. Using old name generates deprecation warning (Mindcraft issue #134, #167).
- Fabric HermesBridge mod: Entirely replaced. Do not import or reference in v2.0.

---

## Open Questions

1. **RangeError on Paper 1.21.1 (Issue #3492)**
   - What we know: Intermittent `ERR_OUT_OF_RANGE` during advancement packet deserialization on some Paper configs. Open as of May 2025.
   - What's unclear: Whether it occurs on this specific server setup (Glass + specific Paper plugins).
   - Recommendation: Wave 0 / BOT-01 smoke test must connect bot and wait 30s for stability. If it fires, investigate server plugin list for advancement-related plugins.

2. **mineflayer-pathfinder 2.4.5 on Paper 1.21.1 live validation**
   - What we know: STATE.md flags this explicitly. Issue #222 is known to hang. No reports of 2.4.5 being broken on Paper 1.21.1 specifically.
   - What's unclear: Whether there are Paper-specific pathfinding edge cases beyond Issue #222.
   - Recommendation: Plan for a dedicated navigation smoke test task before skills are built on top of navigate(). Must confirm goto(), stop(), and timeout all behave correctly.

3. **Vec3 face vectors for placeBlock**
   - What we know: `bot.placeBlock(refBlock, faceVector)` places the new block at `refBlock.position.plus(faceVector)`. Standard face vectors are unit vectors on cardinal axes.
   - What's unclear: Whether the reference block must be adjacent to an existing solid face in all cases, or if free-floating placement is possible.
   - Recommendation: LOW risk — standard placement patterns (place on top of existing block) are well-documented. Handle in place.js implementation.

---

## Sources

### Primary (HIGH confidence)
- mineflayer npm registry — version 4.35.0 confirmed installed; exports verified
- mineflayer-pathfinder npm registry — version 2.4.5 confirmed latest; peer deps confirmed empty
- mineflayer-tool npm registry — version 1.2.0 confirmed latest
- `node_modules/minecraft-data` runtime inspection — block.harvestTools IDs decoded for iron_ore, diamond_ore, coal_ore, stone, oak_log; tool IDs to names verified
- `agent/normalizer.js` — existing v1 implementation confirmed reusable as-is
- mineflayer API docs (raw GitHub) — bot.dig, bot.placeBlock, bot.blockAt, bot.findBlocks signatures verified

### Secondary (MEDIUM confidence)
- mineflayer-pathfinder readme (raw GitHub) — setup, goto(), setGoal(null), path_update event
- mineflayer-tool API docs (raw GitHub) — equipForBlock signature, requireHarvest option
- Mindcraft skills.js (raw GitHub) — collectBlock, goToPosition, interrupt_code pattern; goToGoal structure
- mineflayer-pathfinder Issue #222 — pathfinder hang behavior documented, status open March 2025

### Tertiary (LOW confidence)
- mineflayer Issue #3492 — RangeError on Paper 1.21.1; intermittent, environment-dependent, open May 2025

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry versions confirmed; both plugins resolve with no peerDep conflicts; mineflayer already installed at 4.35.0
- Architecture: HIGH — Core patterns verified against official docs and Mindcraft reference implementation; interrupt pattern is the established approach
- Pitfalls: HIGH — Issues #222 and #3492 verified directly from GitHub; dig double-call behavior from mineflayer API docs

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (mineflayer ecosystem moves slowly; pathfinder 2.4.5 is 2.5 years old at this point)
