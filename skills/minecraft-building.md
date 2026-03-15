---
name: minecraft-building
description: Build structures in Minecraft — houses, cabins, shelters with actual aesthetics. Not slop.
triggers:
  - minecraft build
  - build a house
  - minecraft construction
  - build shelter
  - log cabin
version: 4.0.0
---

# Minecraft Building — With Taste

## Commands

```
mc place BLOCK X Y Z    # place block at position
mc dig X Y Z            # remove block at position
mc collect BLOCK N       # gather building materials
mc craft ITEM [N]        # craft building blocks
mc status                # check position + inventory
mc find_blocks BLOCK     # find material sources
mc interact X Y Z        # open doors, chests, etc
mc goto_near X Y Z       # get close to build site
mc nearby                # see what's around you
```

## Before You Build ANYTHING

1. **CHECK MEMORY** for building lessons the player taught you
2. **ASK the player** where they want it if they didn't specify
3. **Survey the terrain** — `mc status` + `mc nearby` to find flat ground
4. **Plan it out** — tell the player your plan in chat before placing blocks
5. **Clear the area** — `mc dig` to remove trees, tall grass, uneven ground
6. **Level the ground** — fill holes, remove bumps to make a flat foundation

## Golden Rules

- **BUILD ON THE GROUND.** Not in trees. Not floating. On solid flat ground.
- **Place crafting tables and furnaces INSIDE buildings**, not randomly in the wilderness
- **Use multiple materials** — variety is what makes builds look good
- **Don't just make boxes** — add depth, overhangs, different heights
- **Foundations first** — lay cobblestone/stone base before walls
- **Roof isn't flat** — use stairs for sloped roofs, slabs for overhangs
- **Light it up** — torches/lanterns inside AND outside to prevent mob spawns

## Log Cabin Style

Materials needed:
- Oak/spruce logs (frame + pillars): ~40-60
- Stripped logs or planks (walls): ~80-120
- Cobblestone or stone bricks (foundation + chimney): ~40-60
- Glass panes (windows): 8-12
- Stairs (roof): ~40-60
- Slabs (details): ~20
- Door: 1
- Torches/lanterns: 8+
- Fences (porch railing): ~10

Build order:
1. Clear + level a ~12x10 area on the ground
2. Lay cobblestone foundation (1 block deep perimeter)
3. Place log pillars at corners + every 3-4 blocks (3-4 high)
4. Fill walls between pillars with planks (leave gaps for windows + door)
5. Place glass panes for windows (2 wide, 1-2 high)
6. Build roof with stairs — peaked/A-frame looks best
7. Add chimney on one end with cobblestone/bricks going above roofline
8. Place door
9. Interior: crafting table, furnace, chests, bed, torches
10. Exterior: fence porch/railing, flower pots, path with gravel/cobble

## Material Combos That Look Good

```
Rustic cabin:   oak_log frame + spruce_planks walls + cobblestone base + stone_brick chimney
Medieval:       stone_bricks + dark_oak_planks + cobblestone + oak fences
Modern:         quartz + glass + concrete + stone slabs  
Cozy cottage:   birch_planks + stripped_birch_log + flowering_azalea + lanterns
Desert:         sandstone + smooth_sandstone + red_sandstone accents
```

## Roof Techniques

```
A-frame:     stairs ascending from both sides meeting at peak
Flat+border: slab roof with stair border overhang  
Hip roof:    stairs on all 4 sides converging
Overhang:    extend roof 1 block past walls using stairs/slabs
```

## Common Mistakes to Avoid

- ❌ Placing crafting tables outside or in trees
- ❌ Single-material builds (all planks = ugly)
- ❌ No foundation (walls directly on grass)
- ❌ Flat roofs with no overhang
- ❌ No windows or lighting
- ❌ Ignoring terrain (building on steep hills without terracing)
- ❌ Forgetting interior furnishing
- ❌ Building too small (5x5 boxes) or way too big to fill
- ❌ Not clearing trees/obstacles first

## Systematic Placement

When placing a wall/floor/roof, work in a systematic pattern:
1. Note the starting corner coords from `mc status`
2. Work along one axis (e.g. X), placing each block
3. Move to next row (increment Z), repeat
4. For height, do one full layer then go up (increment Y)

Example — 7x5 floor at Y=64 starting at X=100, Z=200:
```
for x in 100..106:
  for z in 200..204:
    mc place oak_planks X 64 Z
```
(In practice, run each mc place individually)

## Emergency Shelter (first night)

If night is coming and there's no time for a proper build:
1. `mc collect cobblestone 24` 
2. Dig into a hillside or place 3x3x3 box
3. Seal yourself in, place torch
4. Wait for dawn
5. **But tell the player** "quick shelter for the night, we'll build properly tomorrow"
