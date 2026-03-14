---
name: minecraft-iron-age
description: Get iron tools and armor. Mine iron ore, smelt ingots, craft gear. Use when in phase 2.
license: MIT
metadata:
    author: hermescraft
    version: "1.0"
    phase: "2"
    deaths_before_mastery: "0"
    success_rate: "0.7"
---

## Strategy

1. Equip stone_pickaxe (required to mine iron ore).
2. Find iron_ore in nearbyBlocks → `look_at_block` → `break_block`. Repeat until you have 10 raw_iron. Iron spawns at any Y level, common around Y=16-48. Use `navigate` to go underground if needed.
3. Place furnace if not already placed.
4. Use `smelt` raw_iron with coal or planks as fuel. Repeat until all smelted.
5. Craft iron_pickaxe (3 iron_ingot + 2 sticks at crafting table).
6. Craft iron_sword (2 iron_ingot + 1 stick).
7. Craft shield (1 iron_ingot + 6 planks).
8. Craft iron_helmet, iron_chestplate, iron_leggings, iron_boots if enough iron.
9. Craft bucket (3 iron_ingot) — useful for water/lava later.

## Tips

- Need stone_pickaxe or better to mine iron ore. Wood pickaxe won't work.
- Smelt requires fuel — coal is best, planks work too.
- The furnace GUI needs to be open: first `smelt` call opens it, second loads items.
- Iron is extremely common — find iron_ore in nearbyBlocks, `look_at_block` + `break_block`.
- Craft a shield early — it blocks skeleton arrows and creeper blasts.

## Key Actions Used

Action sequence: equip -> look_at_block -> break_block -> place -> smelt -> craft
