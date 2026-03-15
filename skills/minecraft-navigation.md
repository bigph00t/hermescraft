---
name: minecraft-navigation
description: Navigation and exploration in Minecraft — finding biomes, structures, caves, ores, and efficient movement
triggers:
  - minecraft navigate
  - find biome
  - minecraft explore
  - find village
  - find cave
version: 3.0.0
---

# Minecraft Navigation

## Commands

```
mc goto X Y Z            # pathfind to exact position
mc goto_near X Y Z [r]   # pathfind near position (default range: 2)
mc follow PLAYER          # follow a player continuously
mc stop                   # stop movement
mc status                 # check position, biome, dimension
mc find_blocks BLOCK      # find block types nearby
mc nearby [radius]        # scan surroundings (default: 32)
mc look_at X Y Z          # look at position
```

## Coordinate System

- **X**: East (+) / West (-)
- **Y**: Height (0=bedrock, 64=sea level, 320=sky limit)
- **Z**: South (+) / North (-)

Always check `mc status` for current position before navigating.

## Finding Resources by Y-Level

```
Diamonds:       Y = -64 to -1    (best at Y = -59)
Iron:           Y = -64 to 72    (best at Y = 16)
Gold:           Y = -64 to 32    (best at Y = -16)
Coal:           Y = 0 to 192     (best at Y = 96)
Copper:         Y = -16 to 112   (best at Y = 48)
Lapis:          Y = -64 to 64    (best at Y = 0)
Redstone:       Y = -64 to 16    (best at Y = -59)
Emerald:        Y = -16 to 320   (mountain biomes only)
Ancient Debris: Y = 8 to 119     (best at Y = 15, Nether only)
```

## Finding Structures

Structures don't have search commands, but strategies:

- **Village**: explore plains, savanna, desert, taiga biomes
- **Cave/Ravine**: `mc find_blocks air` near Y=40-60, or just explore
- **Stronghold**: throw eye of ender, follow direction
- **Nether Fortress**: explore nether, tend to be along Z axis
- **Ocean Monument**: find ocean biome, look for dark structure

## Exploration Strategies

### Spiral Search
Walk in expanding squares to cover area:
1. Go north 50 blocks
2. Turn east 50 blocks
3. Turn south 100 blocks
4. Turn west 100 blocks
5. Continue expanding

### Strip Mining (for ores)
1. `mc goto X -59 Z` — go to diamond level
2. Dig straight tunnel (2 high, 1 wide)
3. Branch tunnels every 3 blocks left and right
4. `mc find_blocks diamond_ore` periodically to check

### Cave Exploration
1. `mc find_blocks cave_air` or look for openings
2. Bring torches (lots)
3. Place torches on RIGHT wall (so you can find way out: follow torches on LEFT)
4. `mc status` frequently — watch for mobs

## Saving Locations

When you find something important, save coordinates to memory:
- Base location
- Mine entrance
- Village location
- Nether portal
- Mob spawner
- Good farming spot

Use hermes memory tool: save coordinates for future sessions.
