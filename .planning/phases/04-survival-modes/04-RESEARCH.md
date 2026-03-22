# Phase 4: Survival Modes - Research

**Researched:** 2026-03-22
**Domain:** mineflayer autonomous reactive behaviors — body-layer tick loop
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — pure infrastructure phase. All implementation choices at Claude's discretion.

### Claude's Discretion
All implementation choices are at Claude's discretion. Key constraints from PROJECT.md and STATE.md:
- Mind + Body split: these are body-layer autonomous behaviors — no LLM calls
- 300ms body tick for reactive behaviors, independent of the Mind's event-driven loop
- Cooperative interrupt: body tick behaviors must not conflict with active skills
- Self-preservation (eat, flee hazards) runs WITHOUT LLM involvement
- Combat (attack hostiles, retreat at low health) runs WITHOUT LLM involvement
- Unstuck detection and recovery for pathfinder hangs
- Idle look-at-entities for liveliness
- Auto-pickup nearby dropped items
- v1 agent/index.js has stuck detection patterns — reference for approach

### Deferred Ideas (OUT OF SCOPE)
None — infrastructure phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MODE-01 | Self-preservation — auto-eat, flee fire/lava/drowning, no LLM needed | `bot.health` event fires on every HP change; `bot.food` property; blockAt feet for fire/lava; `bot.oxygenLevel` for drowning |
| MODE-02 | Self-defense — attack hostile mobs targeting the bot | `entityHurt` event with source entity; `bot.attack(entity)`; entity.category === 'Hostile mobs' via minecraft-data; health threshold for retreat |
| MODE-03 | Unstuck detection — detect and recover from pathfinder hangs or wall-stuck | `bot.pathfinder.isMoving()`; position delta tracking; `bot.pathfinder.setGoal(null)` for halt |
| MODE-04 | Idle behaviors — look at nearby entities randomly, feel alive | `bot.nearestEntity(filter)`; `bot.lookAt(entity.position)`; only fires when `!skillRunning` |
| MODE-05 | Item collection — auto-pickup nearby dropped items | `bot.entities` scan for `entity.name === 'item'`; navigate to item; mineflayer auto-collects on proximity |
| SKILL-06 | Combat skill — attack hostile mobs, flee when low health | `bot.attack(entity)` sync call; `bot.pvp` plugin vs manual attack loop; health-gated retreat |
</phase_requirements>

---

## Summary

Phase 4 implements a 300ms autonomous body tick — a `setInterval` that runs independently of the Mind's event-driven LLM loop. All behaviors in this tick react to live game state without LLM involvement. The six behaviors are: eat-if-hungry, hazard flee (fire/lava/drowning), hostile combat with health-gated retreat, position-based stuck detection with pathfinder halt, idle entity look-at, and ground item auto-pickup.

The critical design challenge is cooperative non-interference: the body tick must detect whether a skill is actively running and either skip low-priority behaviors (look-at, item pickup) or interrupt for high-priority ones (critical health, fire). The existing `skillRunning` flag in `mind/index.js` becomes the shared gate. The body tick reads but does not write mind state.

The mineflayer API surface for all six behaviors is fully covered by existing installed packages (mineflayer + mineflayer-pathfinder + minecraft-data). No new packages are required. The `GoalFollow` pathfinder goal and `bot.attack()` method handle combat. `bot.entity.position.distanceTo()` handles stuck detection. The `entity.name === 'item'` pattern identifies dropped items.

**Primary recommendation:** Implement as `body/modes.js` — a single module exporting `initModes(bot, getSkillRunning)`. The init function starts the 300ms interval and wires all behaviors. Priority order within each tick: critical health/hazard flee first, then combat, then unstuck, then item pickup, then idle look. This matches the v1 design principle that survival always supersedes opportunistic behaviors.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mineflayer | ^4.35.0 (installed) | `bot.health`, `bot.food`, `bot.oxygenLevel`, `bot.attack()`, `bot.lookAt()`, `bot.entities` | Already installed; the only Minecraft API |
| mineflayer-pathfinder | 2.4.5 (installed) | `bot.pathfinder.isMoving()`, `bot.pathfinder.setGoal(null)`, `GoalFollow`, `GoalNear` | Already installed; used for flee/chase nav |
| minecraft-data | installed (via mineflayer) | `entity.category === 'Hostile mobs'` lookup Set; fire/lava block name Set | O(1) lookup at module init time |
| vec3 | installed (transitive) | `entity.position.distanceTo(bot.entity.position)` | Vec3 is mineflayer's native position type |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| prismarine-entity | installed (transitive) | `entity.type`, `entity.name`, `entity.getDroppedItem()` | Dropped item detection; entity category |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual attack loop on 300ms tick | `mineflayer-pvp` plugin | mineflayer-pvp is battle-tested but adds a dependency and has its own loop that may conflict with the body tick architecture. Manual `bot.attack()` on the tick interval is simpler and fully controlled. |
| `GoalInvert` for flee | Manual position offset flee | GoalInvert is pathfinder-idiomatic but inverted goals can pathfind into other hazards. Manual offset (run 10 blocks in opposite direction from mob) is simpler and more predictable for flee. |
| `physicsTick` event (50ms) | 300ms `setInterval` | physicsTick fires every 50ms which is too frequent for most checks and creates tight loop risk. 300ms setInterval matches the stated phase requirement. |

**Installation:** No new packages needed. All required libraries are already installed.

---

## Architecture Patterns

### Recommended Project Structure
```
body/
├── modes.js             # NEW — 300ms body tick, all six survival behaviors
├── skills/
│   └── combat.js        # NEW — combat skill (SKILL-06): attack + retreat
├── bot.js               # existing
├── interrupt.js         # existing
├── navigate.js          # existing (reused for flee)
└── skills/inventory.js  # existing (eatIfHungry reused)

mind/
└── index.js             # MODIFIED — export skillRunning getter for modes.js
```

### Pattern 1: Body Tick (300ms setInterval)

**What:** A single `setInterval` launched in `initModes()` that runs a priority-ordered behavior check each tick.

**When to use:** Reactive, non-blocking behaviors that must fire regardless of LLM state.

**Example:**
```javascript
// body/modes.js
export function initModes(bot, getSkillRunning) {
  const TICK_MS = 300

  setInterval(async () => {
    // Priority 1: critical survival — always fires even if skill running
    if (await checkHazards(bot)) return
    if (await checkCriticalHealth(bot)) return

    // Priority 2: combat — fires unless skill running
    if (!getSkillRunning() && await checkCombat(bot)) return

    // Priority 3: unstuck — fires unless skill running
    if (!getSkillRunning() && await checkStuck(bot)) return

    // Priority 4: item pickup — fires only when truly idle
    if (!getSkillRunning() && await checkItemPickup(bot)) return

    // Priority 5: idle look-at — fires only when truly idle
    if (!getSkillRunning()) await checkIdleLook(bot)
  }, TICK_MS)
}
```

**Key insight:** Each behavior is a small async function that returns `true` if it acted (allowing early return from the tick) or `false` if it did nothing. This avoids the tick from doing two things at once.

### Pattern 2: Hostile Mob Detection

**What:** Build a `HOSTILE_MOBS` Set at module load from `minecraft-data`; check `entity.name` against it on each tick.

**When to use:** Any time you need to identify hostile mobs without per-call overhead.

**Example:**
```javascript
// Source: minecraft-data entitiesByName, verified 2026-03-22
import minecraftData from 'minecraft-data'
const mcData = minecraftData('1.21.1')

const HOSTILE_MOBS = new Set(
  Object.values(mcData.entities)
    .filter(e => e.category === 'Hostile mobs')
    .map(e => e.name)
)
// HOSTILE_MOBS has 42 entries for 1.21.1 — confirmed by inspection

function isHostile(entity) {
  return entity.type === 'mob' && HOSTILE_MOBS.has(entity.name)
}
```

### Pattern 3: Fire/Lava/Drowning Hazard Detection

**What:** Check the block at the bot's feet position for fire/lava; check `bot.oxygenLevel` for drowning.

**Example:**
```javascript
// Source: minecraft-data blocksByName, verified 2026-03-22
const FIRE_BLOCKS = new Set(['fire', 'soul_fire', 'lava', 'campfire', 'soul_campfire'])
const HAZARD_HEALTH_THRESHOLD = 16  // flee when < 8 hearts

function isInHazard(bot) {
  const feetPos = bot.entity.position.floored()
  const feetBlock = bot.blockAt(feetPos)
  if (feetBlock && FIRE_BLOCKS.has(feetBlock.name)) return 'fire'

  // Also check the block the bot is standing in (body level)
  const bodyBlock = bot.blockAt(feetPos.offset(0, 1, 0))
  if (bodyBlock && (bodyBlock.name === 'lava')) return 'lava'

  if (bot.oxygenLevel <= 3) return 'drowning'
  return null
}
```

**Drowning detection:** `bot.oxygenLevel` is 0-10 (mapped from 0-300 raw ticks). At 0 the bot takes damage. Flee water when <= 3 (confirmed from mineflayer `breath.js` plugin: emits `breath` event on change, updates `bot.oxygenLevel` directly from metadata).

### Pattern 4: Stuck Detection (Position-Based)

**What:** Track `bot.entity.position` every tick. If the pathfinder `isMoving()` but position has not changed by >= 0.5 blocks over N consecutive ticks, call `setGoal(null)` to halt.

**When to use:** Detects both pathfinder hangs (bot thinks it's moving, isn't) and physical wall-stuck (obstacle never resolved).

**Example:**
```javascript
// Source: v1 agent/index.js stuck detection pattern — adapted for body tick
let _lastPos = null
let _stuckTicks = 0
const STUCK_TICK_THRESHOLD = 10  // 10 x 300ms = 3 seconds

function checkStuck(bot) {
  const pos = bot.entity.position
  const isMoving = bot.pathfinder.isMoving()

  if (!isMoving) {
    _stuckTicks = 0
    _lastPos = null
    return false
  }

  if (_lastPos && pos.distanceTo(_lastPos) < 0.5) {
    _stuckTicks++
    if (_stuckTicks >= STUCK_TICK_THRESHOLD) {
      bot.pathfinder.setGoal(null)
      _stuckTicks = 0
      _lastPos = null
      return true  // acted
    }
  } else {
    _stuckTicks = 0
  }
  _lastPos = pos.clone()
  return false
}
```

**Why 10 ticks (3s):** pathfinder legitimately pauses at corners, jumps, and recalculations — false positives below 3s. V1 used 8 ticks at 2s intervals (16s) which was far too long.

### Pattern 5: Dropped Item Detection and Auto-Pickup

**What:** Scan `bot.entities` for entities where `entity.name === 'item'` and distance < 8 blocks. Navigate to within 1 block; mineflayer auto-collects on proximity.

**Example:**
```javascript
// Source: mineflayer entities.js + minecraft-data entity inspection, verified 2026-03-22
function nearbyItems(bot, range = 8) {
  return Object.values(bot.entities).filter(e => {
    if (e.name !== 'item') return false
    return e.position.distanceTo(bot.entity.position) < range
  })
}
```

**Collection mechanic:** mineflayer simulates proximity item collection — when the bot walks within ~1 block of an item entity, the server sends a `playerCollect` packet and the item appears in inventory. There is no explicit "pick up" API call needed; navigate to the item and it collects automatically.

**`entity.getDroppedItem()`:** Returns the item stack metadata for `entity.name === 'item'` entities. Useful for filtering by item type if desired (e.g., skip cobblestone). For Phase 4 collect-all is fine.

### Pattern 6: Combat Skill (SKILL-06)

**What:** SKILL-06 is both a combat skill (dispatchable by the LLM via `!combat`) AND an autonomous mode (MODE-02, body tick activates it on hostile mobs). The combat skill encapsulates attack-until-dead + retreat-on-low-health.

**Example structure:**
```javascript
// body/skills/combat.js
const COMBAT_RETREAT_HEALTH = 6  // retreat at 3 hearts
const COMBAT_ATTACK_RANGE = 4

export async function attackNearest(bot) {
  const hostile = bot.nearestEntity(e =>
    e.type === 'mob' && HOSTILE_MOBS.has(e.name) &&
    e.position.distanceTo(bot.entity.position) < 16
  )
  if (!hostile) return { success: false, reason: 'no_hostile_nearby' }
  return combatLoop(bot, hostile)
}

export async function combatLoop(bot, target) {
  while (target.isValid && target.health > 0) {
    if (isInterrupted(bot)) return { success: false, reason: 'interrupted' }

    if (bot.health <= COMBAT_RETREAT_HEALTH) {
      // Flee: run 12 blocks away from the mob
      const away = bot.entity.position
        .plus(bot.entity.position.minus(target.position).normalize().scale(12))
      await navigateTo(bot, away.x, away.y, away.z, 1, 5000)
      return { success: false, reason: 'retreated_low_health' }
    }

    const dist = target.position.distanceTo(bot.entity.position)
    if (dist > COMBAT_ATTACK_RANGE) {
      // Close distance using GoalFollow
      const goal = new GoalFollow(target, 2)
      bot.pathfinder.setGoal(goal, true)
      await new Promise(r => setTimeout(r, 200))
    } else {
      bot.pathfinder.setGoal(null)
      await bot.lookAt(target.position.offset(0, target.height / 2, 0))
      bot.attack(target)
      await new Promise(r => setTimeout(r, 600))  // attack cooldown (~0.6s for most weapons)
    }
  }
  return { success: true }
}
```

**`bot.attack(entity)`:** Synchronous call — sends the attack packet immediately. Does NOT throw on miss. The 600ms sleep matches the base attack cooldown (1.6 attacks/sec = 625ms per attack for unarmed). With sword it's faster but 600ms is safe conservative.

**`GoalFollow` with `dynamic: true`:** Updates the goal as the entity moves — the second argument to `setGoal()`. This is required for chasing a moving mob.

### Anti-Patterns to Avoid

- **Spawning a new setInterval per behavior:** One 300ms interval runs the priority cascade. Multiple intervals cause jitter and ordering issues.
- **Awaiting navigateTo inside the setInterval callback without a short timeout:** The tick will block until navigation completes. For flee/chase use `navigateTo` with a short timeout (5000ms) or `GoalFollow` with `setGoal` (non-blocking, sets goal and returns immediately).
- **Mutating `mind/index.js` state from `body/modes.js`:** The boundary is `getSkillRunning` — a getter passed in. Never import from `mind/` in `body/`.
- **Using `physicsTick` instead of setInterval:** physicsTick fires every 50ms. At 300ms the check frequency is already intentional — use setInterval.
- **Calling `eatIfHungry` on every tick:** It's a short async function but calling it 3x per second generates spam. Gate on `bot.food < 14` inline first, then call.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hostile mob list | Hardcoded array of mob names | `minecraft-data` entity categories | minecraft-data has all 42 hostile mobs for 1.21.1; hardcoded list misses new/modded mobs |
| Item collection | Custom `entity_type` check | `entity.name === 'item'` | mineflayer already classifies dropped item entities by name; type field is 'other' not 'item' — check name not type |
| Combat approach logic | Custom pathfinding to mob | `GoalFollow(target, 2)` with `setGoal(goal, true)` | GoalFollow handles moving target tracking automatically; dynamic=true re-evaluates as mob moves |
| Health-based flee direction | Random direction or straight back | `mob_pos.subtract(bot_pos).normalize().scale(distance)` | Vector math gives the away direction directly |

**Key insight:** The mineflayer API surface covers all six behaviors directly. The only custom code needed is the 300ms tick coordinator and priority logic.

---

## Common Pitfalls

### Pitfall 1: `isMoving()` is True During Short Pauses
**What goes wrong:** `bot.pathfinder.isMoving()` returns `true` when a path is queued even if the bot hasn't moved yet (computing next segment). This causes false stuck triggers.
**Why it happens:** `isMoving()` returns `path.length > 0`, not "bot is currently changing position."
**How to avoid:** Only trigger stuck recovery after N consecutive ticks with `isMoving() === true` AND `position.distanceTo(lastPos) < 0.5`. The threshold must be >= 3s (10 ticks at 300ms).
**Warning signs:** Stuck recovery firing at corners, after jumps, or at the start of a long path.

### Pitfall 2: Combat Loop Blocks the Body Tick
**What goes wrong:** `await combatLoop(bot, target)` inside the setInterval callback runs for the full duration of combat. During combat, the body tick cannot check for other hazards (fire, drowning).
**Why it happens:** `combatLoop` is a long-running async function.
**How to avoid:** Combat is the Mode-02 "body tick activates" behavior. Keep the body tick to short, bounded operations. Use `GoalFollow` + `bot.attack()` calls that take < 300ms each iteration, not a full blocking loop. The tick-level approach: each tick does one attack action — "if in range, attack; if out of range, update GoalFollow." The full `combatLoop` skill function is for LLM dispatch (`!combat`), not the body tick.
**Warning signs:** Body tick not checking food/fire/drown during extended combat.

### Pitfall 3: Item Entity Type is 'other', Not 'item'
**What goes wrong:** Filtering `Object.values(bot.entities).filter(e => e.type === 'item')` returns nothing.
**Why it happens:** `entity.type` for dropped items is `'other'` (from `minecraft-data` entity category `'UNKNOWN'`). The `entity.name` field is `'item'`.
**How to avoid:** Always filter by `entity.name === 'item'`, not `entity.type`.
**Warning signs:** Auto-pickup mode never finds any items despite drops being visible.

### Pitfall 4: Combat Target Despawns Mid-Fight
**What goes wrong:** `target.isValid` is `false` mid-combat or `target.health` is `undefined`. Calling `bot.attack(target)` on an invalid entity throws.
**Why it happens:** Mobs despawn, are killed by other players, or go out of range. `entityGone` event fires but combat loop may not see it immediately.
**How to avoid:** Guard every attack call: `if (!target.isValid || target.health <= 0) break`. Check `target.isValid` before each attack.

### Pitfall 5: `setGoal(null)` During Skill-Dispatched Navigation
**What goes wrong:** Unstuck detection fires `setGoal(null)` while a body skill (`gather`, `mine`) is in the middle of `navigateTo()`. The skill's `goto()` promise rejects with "path interrupted."
**Why it happens:** Body tick sees `isMoving() === true` and position not changing (brief pause) and fires recovery.
**How to avoid:** Gate unstuck detection on `!getSkillRunning()`. Body-tick stuck detection must be suppressed while any skill is executing. Skills have their own timeout in `navigateTo()` (30s) which handles their stuck case. Body tick stuck detection is only for autonomous modes' own navigation.

### Pitfall 6: Idle Look-At Cancels Skill Movement
**What goes wrong:** `bot.lookAt()` during a `navigateTo()` call interferes with the pathfinder's yaw control, causing jerky movement or path deviation.
**Why it happens:** Both pathfinder and `lookAt()` control the bot's head orientation.
**How to avoid:** Only call `lookAt()` when `!getSkillRunning()` AND `!bot.pathfinder.isMoving()`.

---

## Code Examples

Verified patterns from official sources:

### Hostile Mob Detection at Module Init
```javascript
// Source: minecraft-data 1.21.1 entity categories — verified 2026-03-22
// Produces a 42-entry Set for MC 1.21.1
import minecraftData from 'minecraft-data'
const mcData = minecraftData('1.21.1')
const HOSTILE_MOBS = new Set(
  Object.values(mcData.entities)
    .filter(e => e.category === 'Hostile mobs')
    .map(e => e.name)
)
```

### Flee Direction Vector Math
```javascript
// Source: vec3 API — bot.entity.position is always Vec3
// Run away: compute vector from mob to bot, normalize, scale, navigate there
const away = bot.entity.position
  .minus(target.position)
  .normalize()
  .scaled(12)
  .plus(bot.entity.position)
await navigateTo(bot, Math.floor(away.x), Math.floor(away.y), Math.floor(away.z), 1, 5000)
```

### GoalFollow for Combat Approach (Non-Blocking)
```javascript
// Source: mineflayer-pathfinder goals.js — GoalFollow + setGoal with dynamic=true
import mpf from 'mineflayer-pathfinder'
const { goals } = mpf

// dynamic=true: pathfinder re-evaluates goal as entity moves
bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true)
```

### Dropped Item Detection
```javascript
// Source: mineflayer entities.js entity.name pattern — verified 2026-03-22
// Dropped items: entity.name === 'item', entity.type === 'other' (NOT 'item')
function nearbyDroppedItems(bot, range = 8) {
  return Object.values(bot.entities).filter(e =>
    e.name === 'item' &&
    e.position.distanceTo(bot.entity.position) < range
  )
}
// Navigate to within 1 block — server sends playerCollect automatically on proximity
```

### Oxygen/Drowning Check
```javascript
// Source: mineflayer breath.js plugin — oxygenLevel 0-10 scale
// Emit 'breath' on change, bot.oxygenLevel property updated directly
// Flee water when oxygenLevel <= 3 (server starts damage at 0)
if (bot.oxygenLevel <= 3) {
  // navigate to nearest non-water block upward
  const up = bot.entity.position.offset(0, 3, 0)
  await navigateTo(bot, Math.floor(up.x), Math.floor(up.y), Math.floor(up.z), 1, 3000)
}
```

### Mind-Body Integration (skillRunning getter)
```javascript
// mind/index.js — export a getter so body/modes.js can read without importing mind state
export function isSkillRunning() { return skillRunning }

// body/modes.js — import from mind via start.js
// start.js passes isSkillRunning as callback to initModes
import { isSkillRunning } from '../mind/index.js'
await initModes(bot, isSkillRunning)
```

**Note:** This creates a dependency from body/ to mind/. Alternative: pass `getSkillRunning` as a callback from `start.js`, which owns both `initMind` and `initModes`. This keeps body/ fully independent of mind/ — preferred.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1: 2s tick + Baritone for all navigation | 300ms body tick + mineflayer-pathfinder | Phase 1 rewrite | Much faster reactive behaviors; 300ms vs 2000ms response to hazards |
| v1: failureTracker Map + action-key counting | Position-delta stuck detection | v2 Phase 4 | Position-delta is cleaner; works even when action names vary |
| v1: LLM decides when to eat/flee | Body tick autonomous reaction | Phase 4 | Survival guaranteed even when LLM is slow or hallucinating |

**Deprecated/outdated:**
- v1's `failureTracker` key-counting pattern: replaced by position-delta for stuck detection; action-key counting was brittle across skill name changes.
- `physicTick` event (deprecated typo): use `physicsTick` — mineflayer now warns and will remove the old spelling.

---

## Integration Plan: start.js Changes

`start.js` must be updated to call `initModes` after `initMind`:

```javascript
// start.js additions
import { initModes } from './body/modes.js'

async function main() {
  const bot = await createBot()
  const { isSkillRunning } = await initMind(bot)  // mind exports getter
  await initModes(bot, isSkillRunning)
}
```

OR (cleaner, body fully independent):

```javascript
// start.js owns the bridge
let _skillRunning = false
// initMind returns/accepts a setter; start.js holds the flag
// initModes(bot, () => _skillRunning)
```

The planner should decide which approach. Both are valid. The second avoids any body→mind import.

---

## Open Questions

1. **Combat tick vs combat skill separation**
   - What we know: MODE-02 (body tick combat) and SKILL-06 (dispatchable combat) share the attack loop
   - What's unclear: Should `body/skills/combat.js` house both, with the body tick calling the low-level attack function directly? Or should they be two separate code paths?
   - Recommendation: One `body/skills/combat.js` file with exported `attackTarget(bot, entity)` (used by body tick for one-attack-per-tick) and `combatLoop(bot, entity)` (used by LLM dispatch for sustained combat). Body tick calls `attackTarget`; mind registry calls `combatLoop`.

2. **Flee behavior during active pathfinder skill**
   - What we know: Fire/lava flee must fire even when `skillRunning === true` (Priority 1 overrides)
   - What's unclear: Does calling `navigateTo` from the body tick while a skill's `bot.pathfinder.goto()` is pending cause a conflict?
   - Recommendation: Use `bot.pathfinder.setGoal(null)` first to halt the current path, then `requestInterrupt(bot)` to cancel the skill cooperatively, THEN navigate to safety. This is a controlled interruption of an in-flight skill — justified only for true survival hazards.

---

## Sources

### Primary (HIGH confidence)
- mineflayer source inspection (`node_modules/mineflayer/lib/plugins/`) — health.js, entities.js, physics.js, breath.js — direct API verification 2026-03-22
- mineflayer-pathfinder source inspection (`node_modules/mineflayer-pathfinder/`) — `isMoving()`, `path_update` status values, `GoalFollow`, `setGoal` API — 2026-03-22
- prismarine-entity `index.d.ts` — Entity type field values, `getDroppedItem()` — 2026-03-22
- minecraft-data runtime verification — hostile mob count (42), entity categories, fire/lava block names — node -e 2026-03-22
- v1 `agent/index.js` lines 88-630 — stuck detection pattern (position delta, samePositionTicks, setGoal null) — direct read 2026-03-22

### Secondary (MEDIUM confidence)
- vec3 `distanceTo` — verified by runtime call in node 2026-03-22

### Tertiary (LOW confidence)
- None — all claims verified against installed source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed; API surface verified by source inspection
- Architecture: HIGH — patterns derived from live mineflayer source + v1 reference
- Pitfalls: HIGH — derived from direct API inspection (entity.type 'other' gotcha verified, isMoving semantics verified)

**Research date:** 2026-03-22
**Valid until:** 2026-09-22 (mineflayer APIs are stable; minecraft-data entity list changes with MC versions)
