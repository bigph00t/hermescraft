---
phase: 02-crafting-inventory
plan: "02"
subsystem: body/skills
tags: [smelt, chest, inventory, furnace, mineflayer, skill]
dependency_graph:
  requires: [body/navigate.js, body/normalizer.js, body/interrupt.js, mineflayer furnace plugin, mineflayer chest plugin]
  provides: [body/skills/smelt.js, body/skills/chest.js, body/skills/inventory.js]
  affects: [mind layer (calls these skills), any mode that needs resource management]
tech_stack:
  added: []
  patterns:
    - Event-driven furnace wait via furnace.on('update') with wall-clock timeout fallback
    - JSON-persisted chest location memory with position-based deduplication
    - Armor tier comparison via string prefix matching against ordered tier array
    - O(1) food item lookup via Set built from mcData.foodsArray
key_files:
  created:
    - body/skills/smelt.js
    - body/skills/chest.js
    - body/skills/inventory.js
  modified: []
decisions:
  - Fuel count formula Math.ceil(count/8)+1 — coal smelts 8 items; +1 handles partial fuel safety for edge counts
  - Timeout formula count*12000+5000 — 12s per item (10s smelt + 2s margin) plus 5s global buffer
  - FOOD_NAMES Set built at module load from mcData.foodsArray — O(1) lookup avoids per-call array search
  - armorTier iterates ARMOR_TIER from high to low index to find best match prefix — handles multi-word prefixes correctly
  - initChestMemory is explicit call pattern (not auto-init) — matches init<Subsystem> naming convention
metrics:
  duration: "3min"
  completed_date: "2026-03-22T17:58:28Z"
  tasks_completed: 3
  files_created: 3
---

# Phase 02 Plan 02: Smelt, Chest, and Inventory Skills Summary

**One-liner:** Three Mineflayer skill wrappers — event-driven furnace smelt, chest deposit/withdraw with JSON location memory, and reactive armor-equip/eat-when-hungry — completing Phase 2 resource management.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create smelt skill with event-driven furnace wait | d2f9dee | body/skills/smelt.js |
| 2 | Create chest skill with deposit, withdraw, and location memory | 4824897 | body/skills/chest.js |
| 3 | Create inventory management skill — equip best armor and eat when hungry | 2d816fd | body/skills/inventory.js |

## What Was Built

### body/skills/smelt.js — SKILL-04

Furnace smelting skill that finds the nearest furnace/blast_furnace/smoker within 32 blocks, navigates to it, loads fuel then input (in correct order per Pitfall 6), waits for output via `furnace.on('update')` event polling with a wall-clock timeout fallback (`count * 12_000 + 5_000` ms), collects the output, and closes the furnace in a finally block.

Key implementation choices:
- Fuel count: `Math.ceil(count / 8) + 1` — handles coal (8 items/piece) with +1 safety margin
- Searches all three furnace types (furnace, blast_furnace, smoker) before giving up
- Interrupt checked after navigation, after putFuel, and after putInput

### body/skills/chest.js — SKILL-07

Chest interaction skill with five named exports plus initChestMemory. Handles deposit and withdraw with:
- Pre-open inventory count check (avoid silent no-op on deposit when item count = 0)
- Pre-open empty slot check (avoid Pitfall 4 throw on withdraw when inventory full)
- `chest.close()` in finally blocks for both operations
- JSON-persisted chest location memory at `agent/data/{agentName}/chests.json` with position-based deduplication
- `findChest()` searches chest, trapped_chest, and barrel types

### body/skills/inventory.js — SKILL-08

Reactive inventory management with two exports:
- `equipBestArmor(bot)` — iterates all 4 armor slots, compares current equipped tier vs inventory candidates, only equips if upgrade available
- `eatIfHungry(bot, threshold=14)` — eats below threshold 14 (sprint disabled), wraps `bot.consume()` in try/catch per Pitfall 5, uses O(1) FOOD_NAMES Set from `mcData.foodsArray`

Neither function registers persistent event listeners — they are reactive utilities for the Mind/Mode layer to call.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

All three files import cleanly under Node.js ESM:
- `smelt` — function ✓
- `depositToChest`, `withdrawFromChest`, `findChest`, `rememberChest`, `getChestMemory`, `initChestMemory` — all function ✓
- `equipBestArmor`, `eatIfHungry` — function ✓

No default exports. All files: 2-space indent, no semicolons, single quotes, named exports only, interrupt-cooperative, `{ success, reason }` return format.

## Self-Check: PASSED

Files exist:
- body/skills/smelt.js ✓
- body/skills/chest.js ✓
- body/skills/inventory.js ✓

Commits exist:
- d2f9dee (smelt) ✓
- 4824897 (chest) ✓
- 2d816fd (inventory) ✓
