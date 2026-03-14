---
name: minecraft-first-night
description: Survive the first night. Get wood, craft tools, build shelter. Use when in phase 1.
license: MIT
metadata:
    author: hermescraft
    version: "1.0"
    phase: "1"
    deaths_before_mastery: "0"
    success_rate: "0.8"
---

## Strategy

1. Find oak_log or spruce_log in nearbyBlocks. Use `look_at_block` with its coordinates, then `break_block`. Repeat for 5 logs.
2. Craft planks: `craft` oak_planks (or spruce_planks). One log = 4 planks.
3. Craft sticks: `craft` stick. Two planks = 4 sticks.
4. Craft crafting_table: `craft` crafting_table (needs 4 planks).
5. Place the crafting table: `place` crafting_table.
6. Craft wooden_pickaxe at the table (3 planks + 2 sticks).
7. Craft wooden_sword (2 planks + 1 stick).
8. Equip wooden_pickaxe. Find stone in nearbyBlocks, `look_at_block` + `break_block`. Gather 20 cobblestone.
9. Craft stone_pickaxe, stone_sword, stone_axe at crafting table.
10. Craft furnace (8 cobblestone).
11. If time > 11000 (approaching night), dig into a hillside with pickaxe for shelter.

## Tips

- Use `look_at_block` + `break_block` to gather blocks. Find coordinates in nearbyBlocks.
- Check your inventory BEFORE crafting. Don't assume you have items.
- Equip your best pickaxe before mining stone/ore.
- Kill any animals you see for food (use `attack` with target like "pig" or "cow").
- Coal ore spawns on surface — mine it for torches (coal + stick).

## Key Actions Used

Action sequence: mine -> craft -> place -> equip -> mine -> craft -> attack
