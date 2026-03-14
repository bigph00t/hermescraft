---
name: minecraft-resource-gathering
description: How to efficiently gather resources. Core skill used in all phases.
license: MIT
metadata:
    author: hermescraft
    version: "1.0"
    phase: "0"
    deaths_before_mastery: "0"
    success_rate: "0.9"
---

## Strategy

The `mine` action is your primary resource gathering tool. It uses Baritone pathfinding to automatically find and mine the nearest matching block. Always prefer `mine` over manual `look` + `break_block`.

### Gathering wood
- `mine` with blockName "oak_log" or "spruce_log" (use whatever tree type is in nearby blocks).
- Mine 5+ logs to start — that gives 20+ planks.

### Gathering stone
- Equip a wooden_pickaxe or better first.
- `mine` with blockName "cobblestone" or just dig into a hillside.

### Gathering ore
- Equip stone_pickaxe for iron/coal, iron_pickaxe for diamonds/gold.
- `mine` with blockName "iron_ore", "coal_ore", "diamond_ore" etc.
- Use count parameter: `mine` iron_ore count=10.

### Food
- Use `attack` with target "pig", "cow", "chicken", or "sheep" for raw meat.
- Smelt raw meat in furnace for cooked food.

## Tips

- ALWAYS check inventory before crafting — the game state shows your exact items.
- After mining, Baritone may still be pathing. Wait for isPathing=false before next action.
- If `mine` fails, the block might not exist nearby. Try navigating to a different area.
