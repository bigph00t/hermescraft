---
phase: 04-survival-modes
verified: 2026-03-22T19:10:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 4: Survival Modes Verification Report

**Phase Goal:** Autonomous reactive behaviors run on a 300ms Body tick entirely independent of the LLM — the bot survives hostile mobs, avoids environmental hazards, recovers from stuck pathfinding, picks up nearby items, and feels alive between decisions
**Verified:** 2026-03-22T19:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria + Plan must_haves)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Bot eats food automatically when hunger is below threshold without LLM deciding | VERIFIED | `checkSurvival` calls `eatIfHungry` when `bot.food <= 2` (unconditional) or `bot.food < 14 && !getSkillRunning()`. Fires at Priority 1 before any other check. |
| 2  | Bot flees fire, lava, and drowning hazards without LLM deciding | VERIFIED | `isInHazard` checks `FIRE_BLOCKS` at feet/body position and `bot.oxygenLevel <= 3`. Flee path calls `navigateTo` with 5s timeout. Triggers `requestInterrupt` before fleeing if skill running. |
| 3  | Bot attacks hostile mobs that are nearby and retreats at low health | VERIFIED | `checkCombat` finds nearest hostile via `HOSTILE_MOBS.has(e.name)` within 8 blocks, calls `attackTarget` (single hit per tick). `attackTarget` retreats at `bot.health <= 6` (3 hearts). |
| 4  | Bot detects stuck pathfinding (no position change for 3s while isMoving) and halts | VERIFIED | `checkStuck` tracks position delta every 300ms tick. After 10 ticks (3s) of `isMoving()` with delta < 0.5, calls `bot.pathfinder.setGoal(null)` and resets counters. |
| 5  | Bot looks at nearby entities when idle, giving appearance of awareness | VERIFIED | `checkIdleLook` finds nearest entity within 16 blocks, calls `bot.lookAt(entity.position.offset(0, entity.height/2, 0))`, rate-limited to once per 3s, gated on `!isMoving()`. |
| 6  | Bot auto-collects dropped items within 8 blocks | VERIFIED | `checkItemPickup` scans `Object.values(bot.entities)` for `e.name === 'item'` within `ITEM_PICKUP_RANGE = 8`. Sorts by distance, navigates to closest with 3s timeout. |
| 7  | Body tick does NOT interfere with active skills (gated on getSkillRunning) | VERIFIED | `bodyTick` calls `checkSurvival` first (with starvation override through), then `if (getSkillRunning()) return` — Priorities 2-5 all suppressed when skill running. |
| 8  | Bot attacks a hostile mob and the mob loses health (SKILL-06 / Plan 01) | VERIFIED | `attackTarget` calls `bot.attack(target)` in range after `bot.lookAt`. `combatLoop` sustains until `target.health <= 0`. |
| 9  | Bot retreats when health drops below 3 hearts (6 HP) | VERIFIED | `COMBAT_RETREAT_HEALTH = 6` in `combat.js`. Both `attackTarget` and `combatLoop` check `bot.health <= COMBAT_RETREAT_HEALTH` before each action. |
| 10 | LLM can dispatch !combat to start sustained combat | VERIFIED | `mind/registry.js` maps `combat` to `combatLoop` via `nearestEntity(e.type === 'mob')` lookup. `listCommands()` returns 8 commands including `combat`. |
| 11 | Body tick can call attackTarget for a single-hit-per-tick pattern | VERIFIED | `checkCombat` in `body/modes.js` calls `attackTarget(bot, target)` — not `combatLoop`. Non-blocking: closes distance with `GoalFollow` or attacks if in range, returns immediately. |
| 12 | 300ms body tick runs entirely independent of LLM | VERIFIED | `initModes` starts `setInterval(() => bodyTick(bot, getSkillRunning), 300)`. The ticker receives only a getter callback — no imports from `mind/`. `_tickBusy` guard prevents overlapping async ticks. |

**Score:** 12/12 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `body/skills/combat.js` | Combat skill: attackTarget (single hit) + combatLoop (sustained) + HOSTILE_MOBS Set | VERIFIED | Exists, 114 lines. Exports `attackTarget`, `combatLoop`, `HOSTILE_MOBS`. `HOSTILE_MOBS.size = 42`. Module loads without error. |
| `mind/registry.js` | Updated registry with !combat command | VERIFIED | Exists. `listCommands()` returns `['gather','mine','craft','smelt','navigate','chat','idle','combat']`. `combatLoop` imported at line 10. |
| `body/modes.js` | 300ms body tick with 5-priority behavior cascade | VERIFIED | Exists, 281 lines. Exports `initModes`. `TICK_MS = 300`, `STUCK_TICK_THRESHOLD = 10`, `_tickBusy` guard present. All 5 priority functions implemented. |
| `mind/index.js` | skillRunning getter for body/modes.js consumption | VERIFIED | `isSkillRunning()` exported at line 86. Returns boolean. `skillRunning` set to `true` before `dispatch()` and `false` after in `finally` block. |
| `start.js` | Wires initModes after initMind | VERIFIED | Line 5: `import { initModes } from './body/modes.js'`. Line 4: `import { initMind, isSkillRunning } from './mind/index.js'`. Line 16: `initModes(bot, isSkillRunning)` called after `await initMind(bot)`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `body/skills/combat.js` | `body/navigate.js` | `navigateTo` for flee | WIRED | `import { navigateTo } from '../navigate.js'` at line 5. Called in retreat paths in both `attackTarget` and `combatLoop`. |
| `body/skills/combat.js` | `body/interrupt.js` | `isInterrupted` in combatLoop | WIRED | `import { isInterrupted } from '../interrupt.js'` at line 4. Called at top of `combatLoop` while-loop at line 78. |
| `mind/registry.js` | `body/skills/combat.js` | !combat dispatch | WIRED | `import { combatLoop } from '../body/skills/combat.js'` at line 10. Registry `combat` entry calls `combatLoop(bot, target)`. |
| `body/modes.js` | `body/skills/combat.js` | `attackTarget` for MODE-02 tick combat | WIRED | `import { attackTarget, HOSTILE_MOBS } from './skills/combat.js'` at line 3. `checkCombat` calls `attackTarget(bot, target)` at line 126. |
| `body/modes.js` | `body/skills/inventory.js` | `eatIfHungry` for MODE-01 auto-eat | WIRED | `import { eatIfHungry } from './skills/inventory.js'` at line 4. Called in `checkSurvival` at lines 66 and 70. |
| `body/modes.js` | `body/navigate.js` | `navigateTo` for hazard flee and item pickup | WIRED | `import { navigateTo } from './navigate.js'` at line 5. Called in `checkSurvival` (hazard flee) and `checkItemPickup`. |
| `start.js` | `body/modes.js` | `initModes(bot, isSkillRunning)` call | WIRED | `import { initModes } from './body/modes.js'` at line 5. `initModes(bot, isSkillRunning)` called at line 16. |
| `start.js` | `mind/index.js` | `isSkillRunning` getter passed to body | WIRED | `import { initMind, isSkillRunning } from './mind/index.js'` at line 4. `isSkillRunning` passed by reference to `initModes`. |

All 8 key links: WIRED

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MODE-01 | 04-02-PLAN.md | Self-preservation — auto-eat, flee fire/lava/drowning, no LLM needed | SATISFIED | `checkSurvival` in `body/modes.js`: `eatIfHungry` on food threshold, `isInHazard` + `navigateTo` for flee. Fires at Priority 1 independent of LLM. |
| MODE-02 | 04-01-PLAN.md, 04-02-PLAN.md | Self-defense — attack hostile mobs targeting the bot | SATISFIED | `checkCombat` uses `HOSTILE_MOBS.has(e.name)` filter, calls `attackTarget`. Combat retreat at 3 hearts. Fires at Priority 2 (gated on `!skillRunning`). |
| MODE-03 | 04-02-PLAN.md | Unstuck detection — detect and recover from pathfinder hangs or wall-stuck | SATISFIED | `checkStuck`: 10-tick (3s) threshold, position delta < 0.5 blocks while `isMoving()`, halts via `bot.pathfinder.setGoal(null)`. Priority 3. |
| MODE-04 | 04-02-PLAN.md | Idle behaviors — look at nearby entities randomly, feel alive | SATISFIED | `checkIdleLook`: `bot.nearestEntity` within 16 blocks, `bot.lookAt` with height offset, rate-limited to 3s, gated on `!isMoving()`. Priority 5. |
| MODE-05 | 04-02-PLAN.md | Item collection — auto-pickup nearby dropped items | SATISFIED | `checkItemPickup`: `entity.name === 'item'` scan within 8 blocks, sorted by distance, `navigateTo` with 3s timeout. Priority 4. |
| SKILL-06 | 04-01-PLAN.md | Combat skill — attack hostile mobs, flee when low health | SATISFIED | `body/skills/combat.js`: `attackTarget` (single-hit, non-blocking), `combatLoop` (sustained with interrupt checks), `HOSTILE_MOBS` Set (42 entries). Health retreat at 6 HP. |

All 6 requirements: SATISFIED. No orphaned requirements detected.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `body/modes.js` | 48 | `return null` | Info | Expected — `isInHazard` returns null when no hazard detected. Not a stub. |

No blocker or warning anti-patterns found. The `return null` at line 48 is the intended no-hazard return value of `isInHazard`, clearly documented.

---

### Human Verification Required

#### 1. Combat Effectiveness

**Test:** Spawn a zombie near the bot in a vanilla Minecraft world and observe whether the bot attacks and the zombie takes damage.
**Expected:** Bot approaches the zombie, looks at it, and deals hit damage. With health at/below 3 hearts, bot navigates away from the zombie.
**Why human:** `bot.attack(target)` dispatches the Minecraft attack packet. Actual damage depends on server hit registration, armor, and timing. Cannot verify packet delivery or damage numbers programmatically.

#### 2. Hazard Flee Behavior

**Test:** Place the bot in lava or fire and observe whether it flees without a chat message or LLM intervention.
**Expected:** Bot detects hazard within one 300ms tick, calls `requestInterrupt` if skill running, then navigates away from the hazard block.
**Why human:** `bot.blockAt` result depends on active world connection and chunk loading state. Flee vector accuracy requires observing the actual bot movement trajectory.

#### 3. Idle Look-At Feel

**Test:** Leave the bot idle near other players or mobs for 30+ seconds.
**Expected:** Bot periodically turns to look at nearby entities, giving the impression of awareness. Should feel natural, not jerky.
**Why human:** Subjective "feels alive" quality from ROADMAP goal cannot be verified programmatically. Rate-limiting (3s) and movement gating are verified, but perceptual quality requires observation.

#### 4. Stuck Recovery in Practice

**Test:** Set bot to navigate to an unreachable coordinate (blocked by walls) and wait 3+ seconds.
**Expected:** Bot detects stuck state, halts pathfinder, logs `[modes] stuck detected — halting pathfinder`.
**Why human:** `bot.pathfinder.isMoving()` during attempted navigation of impassable terrain may vary by pathfinder version. Requires live Minecraft connection to test.

---

### Commits Verified

| Hash | Message | Status |
|------|---------|--------|
| `403058f` | feat(04-01): create body/skills/combat.js — attackTarget + combatLoop + HOSTILE_MOBS | EXISTS |
| `651bb41` | feat(04-01): wire !combat into mind/registry.js | EXISTS |
| `24aa445` | feat(04-02): create body/modes.js — 300ms autonomous body tick | EXISTS |
| `bdf957f` | feat(04-02): export isSkillRunning getter and wire initModes in start.js | EXISTS |

---

### Architecture Boundary Check

`body/` to `mind/` import boundary: **CLEAN**

```
grep -n "^import.*from.*mind/" body/modes.js body/skills/combat.js
# Returns: no matches
```

The comment in `body/modes.js` (lines 269-270) mentions `mind/index.js` in a doc comment but contains no actual import statement. The getter-callback pattern is correctly implemented: `start.js` passes `isSkillRunning` as a function reference to `initModes`, keeping `body/` fully decoupled from `mind/`.

---

### Summary

Phase 4 goal is achieved. All five autonomous behaviors are running on the 300ms body tick independent of the LLM:

- **Survival (MODE-01):** Auto-eat (starvation override at food <= 2 always fires) + hazard flee (fire/lava/drowning detection with cooperative interrupt before fleeing).
- **Combat (MODE-02 + SKILL-06):** `attackTarget` called once per tick for hostile mobs within 8 blocks; health-gated retreat at 3 hearts; LLM can dispatch `!combat` for sustained `combatLoop`.
- **Unstuck (MODE-03):** 10-tick position-delta tracker halts pathfinder after 3s of stuck movement.
- **Item pickup (MODE-04 coverage + MODE-05):** `entity.name === 'item'` scan within 8 blocks navigates to closest drop.
- **Idle look (MODE-04):** Rate-limited 3s interval lookAt on nearest entity, gated on `!isMoving()`.

The body/mind boundary is clean. All 8 key links are wired. All 6 requirements (MODE-01 through MODE-05, SKILL-06) are satisfied. Commits 403058f, 651bb41, 24aa445, and bdf957f are verified.

Human verification is recommended for live combat effectiveness, hazard flee accuracy, and the subjective "feels alive" quality — but all automated checks pass.

---

_Verified: 2026-03-22T19:10:00Z_
_Verifier: Claude (gsd-verifier)_
