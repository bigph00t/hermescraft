---
name: minecraft-building
description: Build structures in Minecraft — houses, shelters, walls, floors, basic to advanced construction
triggers:
  - minecraft build
  - build a house
  - minecraft construction
  - build shelter
version: 3.0.0
---

# Minecraft Building

## Commands

```
mc place BLOCK X Y Z    # place block at position
mc dig X Y Z            # remove block at position
mc collect BLOCK N       # gather building materials
mc craft ITEM [N]        # craft building blocks
mc status                # check position + inventory
mc find_blocks BLOCK     # find material sources
mc interact X Y Z        # open doors, chests, etc
```

## Emergency Shelter (first night)

Need: 20 cobblestone, 1 torch minimum

1. `mc collect cobblestone 20` (or dirt in emergency)
2. Note current position from `mc status`
3. Place walls: `mc place cobblestone X Y Z` around a 3x3 area
4. Stack 3 high, leave one gap for door
5. Place roof
6. Place torch inside
7. Wait for dawn: `mc wait 30`

## Simple House (5x5)

Materials: ~80 cobblestone or planks, 3 glass, 1 door, 4+ torches

1. Pick flat ground. Note corner position.
2. Lay floor: 5x5 grid of `mc place` at ground level
3. Walls: 3 blocks high around perimeter (skip for door + windows)
4. Roof: flat cap on top
5. `mc craft oak_door` — place in doorway
6. `mc craft glass_pane` — place for windows
7. Place torches inside to prevent mob spawns

## Building Tips

- Always `mc status` to know your exact position
- Build from one corner, work systematically
- Use `mc goto_near X Y Z` to get close to build site
- Place blocks relative to known coordinates
- For multi-story: build floor → walls → ceiling → repeat
- Torches every 7 blocks prevent mob spawns
- Doors keep zombies out (on most difficulty settings)

## Material Priorities

```
Starter:  cobblestone (mine stone), dirt (dig ground)
Basic:    planks (craft from logs), glass (smelt sand)
Mid:      stone bricks (smelt cobblestone → stone, craft 4 → bricks)
Advanced: quartz, concrete, glazed terracotta
```
