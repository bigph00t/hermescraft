---
name: minecraft-resource-gathering
description: How to efficiently gather resources. Core skill used in all phases.
license: MIT
metadata:
    author: hermescraft
    version: "2.0"
    phase: "0"
    deaths_before_mastery: "0"
    success_rate: "0.9"
---

## Strategy

To gather any block: find it in nearbyBlocks (game state shows coordinates), use `look_at_block` with those coordinates, then `break_block`. Check inventory after each block.

### Gathering wood
- Look for oak_log, spruce_log, birch_log etc. in nearbyBlocks.
- `look_at_block` at the coordinates shown → `break_block` → repeat.
- Get 5+ logs to start — that gives 20+ planks.

### Gathering stone
- Equip a wooden_pickaxe or better first.
- Find stone or cobblestone in nearbyBlocks → `look_at_block` → `break_block`.

### Gathering ore
- Equip stone_pickaxe for iron/coal, iron_pickaxe for diamonds/gold.
- Find iron_ore, coal_ore, diamond_ore in nearbyBlocks → `look_at_block` → `break_block`.
- If ore isn't in nearbyBlocks, use `navigate` to go deeper (lower Y level) then check again.

### Food
- Use `attack` with target "pig", "cow", "chicken", or "sheep" for raw meat.
- Smelt raw meat in furnace for cooked food.

## Tips

- ALWAYS check inventory before crafting — the game state shows your exact items.
- Each block takes 2 actions: look_at_block → break_block. Plan accordingly.
- If the block you need isn't in nearbyBlocks, use `navigate` to move to a new area.
- After breaking a tree log, the ones above may drop — check nearbyBlocks again.
