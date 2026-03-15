---
name: minecraft-survival
description: Master Minecraft survival skill — observe/think/act game loop, phase progression from spawn to Ender Dragon
triggers:
  - play minecraft
  - minecraft survival
  - beat the ender dragon
  - survive in minecraft
  - minecraft agent
version: 3.0.0
---

# Minecraft Survival — Master Skill

## Tools

You control your Minecraft bot via the `mc` CLI in the terminal:
```
mc status              # see everything — health, pos, inventory, nearby, chat
mc inventory           # detailed categorized inventory
mc nearby              # blocks + entities nearby
mc read_chat           # read player messages
mc collect BLOCK N     # find and mine N blocks (e.g. mc collect oak_log 5)
mc craft ITEM [N]      # craft item (need crafting table nearby for 3x3)
mc recipes ITEM        # look up crafting recipe ingredients
mc smelt INPUT         # smelt in nearby furnace
mc goto X Y Z          # pathfind to position
mc goto_near X Y Z     # pathfind near position
mc follow PLAYER       # follow a player
mc attack [target]     # attack nearest hostile (or specific mob)
mc eat                 # eat best food in inventory
mc equip ITEM          # equip tool/weapon to hand
mc place BLOCK X Y Z   # place block at position
mc dig X Y Z           # dig specific block
mc find_blocks BLOCK   # search for block locations
mc pickup              # collect nearby item drops
mc chat "message"      # say something in game chat
mc stop                # stop all movement
```

## Game Loop (NEVER break this)

```
OBSERVE → THINK → ACT → OBSERVE → THINK → ACT → ...forever
```

1. **OBSERVE**: Run `mc status`
2. **THINK**: Check priorities below. What phase am I in? What do I need next?
3. **ACT**: Run ONE mc command
4. **REPEAT**: Back to step 1. ALWAYS. After EVERY action.

## Priority System (check in order)

1. **EMERGENCY** (health ≤ 6): `mc eat`. If no food, flee from threats.
2. **EAT** (food ≤ 14): `mc eat` before doing anything else.
3. **NIGHT DANGER** (not day + no weapons/shelter): Build shelter or craft weapons NOW.
4. **HOSTILE MOB** (within 5 blocks + have weapon): `mc attack` or flee.
5. **CHAT** — respond to player messages via `mc chat`.
6. **PROGRESS**: Follow current phase objectives.

## Phase Progression

### Phase 1: First Day (0 → stone tools)
Goal: stone tools + crafting table + furnace + shelter

1. `mc collect oak_log 4` — punch trees
2. `mc craft oak_planks 4` — logs → planks
3. `mc craft stick` — planks → sticks
4. `mc craft crafting_table` — 4 planks → table
5. Find flat ground, `mc place crafting_table X Y Z`
6. `mc craft wooden_pickaxe` — need table nearby
7. `mc collect cobblestone 20` — mine stone
8. `mc craft stone_pickaxe` + `mc craft stone_sword`
9. `mc craft furnace` — 8 cobblestone
10. `mc collect coal_ore 5` (or smelt logs for charcoal)
11. `mc craft torch 4` — coal + stick
12. Kill animals for food: `mc attack cow` / `mc attack pig` / `mc attack sheep`
13. `mc pickup` to collect drops
14. Smelt raw meat: `mc smelt raw_beef`
15. Build shelter: dig into hillside or build 5x5 cobblestone walls

**Phase complete when**: stone pickaxe + stone sword + furnace + shelter + food

### Phase 2: Iron Age
Goal: iron tools + shield + bucket

1. `mc find_blocks iron_ore` — find iron (Y=0 to Y=64)
2. `mc collect iron_ore 11` — need 11+ ingots
3. `mc smelt raw_iron` — raw iron → iron ingots
4. `mc craft iron_pickaxe` — 3 iron + 2 sticks
5. `mc craft iron_sword` — 2 iron + 1 stick
6. `mc craft shield` — 1 iron + 6 planks
7. `mc craft bucket` — 3 iron ingots

**Phase complete when**: iron pickaxe + iron sword + shield + bucket

### Phase 3: Diamonds
Goal: diamond gear + enchanting table

1. Mine at Y=-59: `mc goto X -59 Z` then `mc collect deepslate_diamond_ore 5`
2. Need iron pickaxe minimum (diamond pickaxe preferred)
3. `mc craft diamond_pickaxe` — 3 diamonds + 2 sticks
4. `mc craft diamond_sword` — 2 diamonds + 1 stick

### Phase 4: Nether
Goal: nether access + blaze rods + ender pearls

1. Get 10 obsidian (water + lava source, mine with diamond pick)
2. `mc craft flint_and_steel` — 1 iron + 1 flint
3. Build 4x5 obsidian frame, light with flint and steel
4. Enter nether, find fortress
5. Kill blazes for blaze rods, endermen for pearls
6. Craft eyes of ender → find stronghold → beat the dragon

## Key Recipes (quick reference)

- Planks: 1 log → 4 planks
- Sticks: 2 planks → 4 sticks
- Crafting table: 4 planks
- Wooden pickaxe: 3 planks + 2 sticks (needs table)
- Stone pickaxe: 3 cobblestone + 2 sticks (needs table)
- Furnace: 8 cobblestone (needs table)
- Torch: 1 coal + 1 stick → 4 torches
- Chest: 8 planks (needs table)

Use `mc recipes ITEM` to look up any recipe you're unsure about.
