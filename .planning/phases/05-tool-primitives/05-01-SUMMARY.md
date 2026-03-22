---
phase: 05-tool-primitives
plan: 01
subsystem: agent
tags: [normalization, item-names, tool-pruning, minecraft-data]
dependency_graph:
  requires: []
  provides: [item-name-normalization, mine-action-removal]
  affects: [agent/actions.js, agent/tools.js, agent/prompt.js]
tech_stack:
  added: [minecraft-data (1.21.1 dataset via existing mineflayer transitive dep)]
  patterns: [normalizer pipeline, pre-dispatch normalization hook]
key_files:
  created: [agent/normalizer.js]
  modified: [agent/actions.js, agent/tools.js, agent/prompt.js]
decisions:
  - Strip _N suffix only when base is a valid registry item (prevents stripping raw_iron to raw_iro)
  - Return input unchanged on failed normalization (downstream error is better than silent wrong name)
  - Mine handler left in mod — unreachable but harmless, avoids mod rebuild
metrics:
  duration: 98s
  completed: 2026-03-21
  tasks_completed: 2
  files_changed: 4
---

# Phase 05 Plan 01: Item Name Normalization and Mine Removal Summary

**One-liner:** Item name normalization via 18-alias ALIASES map + mcData registry validation; mine action fully removed from agent toolset in favor of scan_blocks + look_at_block + break_block.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Create normalizer.js and wire into executeAction | 4723b05 | agent/normalizer.js (new), agent/actions.js |
| 2 | Remove mine action from agent tool set and update gameplay instructions | 1a12c68 | agent/tools.js, agent/actions.js, agent/prompt.js |

## What Was Built

### agent/normalizer.js (new)
Exports `normalizeItemName(name)` with a 7-step pipeline:
1. Falsy guard → return empty string
2. Lowercase + trim
3. Strip `minecraft:` prefix
4. Strip trailing `_N` suffix only if base name is a valid registry item
5. Check 18-entry ALIASES map for known LLM hallucinations
6. Try plural stripping (e.g. `logs` → `log` via registry check)
7. Validate exact match in `mcData.itemsByName`; try prefix search; return input unchanged if still not found

ALIASES cover the most common LLM-generated wrong names: sticks, oak_planks_4, wooden_planks, planks, log/logs/wood, wood_pickaxe/axe/sword/shovel/hoe, wooden_door, oak_door_3, cobble, iron_ore→raw_iron, gold_ore→raw_gold.

### agent/actions.js (modified)
- Added `import { normalizeItemName } from './normalizer.js'`
- `executeAction()`: normalizes `action.item` and `action.blockName` before building the payload and dispatching to the mod
- `validatePreExecution()`: normalizes both fields at entry so all inventory checks use canonical names
- Removed `'mine'` from VALID_ACTIONS Set
- Removed `mine: (a) => typeof a.blockName === 'string'` from ACTION_SCHEMAS

### agent/tools.js (modified)
- Deleted mine tool object entirely from GAME_TOOLS array (was lines 4–18)
- Updated `look_at_block` description: "Walk to and face a block. Primary way to mine — look at a surface block, then break_block."

### agent/prompt.js (modified)
- FALLBACK line replaced: "use scan_blocks to find them on the surface, then navigate closer and use look_at_block + break_block"
- FIRST PRIORITY line replaced: "No logs visible? scan_blocks(\"oak_log\") to find them"
- NEVER NAVIGATE line updated: "Use scan_blocks to find specific blocks first"

## Verification Results

All 10 normalization test cases passed:
- sticks → stick
- oak_planks_4 → oak_planks
- wooden_planks → oak_planks
- wood_pickaxe → wooden_pickaxe
- oak_door_3 → oak_door
- cobble → cobblestone
- iron_ore → raw_iron
- minecraft:stick → stick
- oak_planks (already valid) → oak_planks
- stick (already valid) → stick

Mine removal verification passed:
- mine absent from GAME_TOOLS
- look_at_block present in GAME_TOOLS
- mine absent from VALID_ACTIONS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Fix] Updated third mine reference in prompt.js**
- **Found during:** Task 2
- **Issue:** `- NEVER navigate to random coordinates hoping to find something. Use mine to find specific blocks.` — referenced mine as the discovery tool after we removed it
- **Fix:** Updated to "Use scan_blocks to find specific blocks first"
- **Files modified:** agent/prompt.js
- **Commit:** 1a12c68 (included in Task 2 commit)

## Self-Check: PASSED

- agent/normalizer.js: FOUND
- agent/actions.js (normalizeItemName import + calls): FOUND (5 matches)
- agent/tools.js (no mine entry): VERIFIED
- agent/prompt.js (no "mine block_name"): VERIFIED
- Commits 4723b05 and 1a12c68: FOUND in git log
