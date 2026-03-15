---
name: minecraft-combat
description: Combat strategies for every Minecraft mob — how to fight, when to flee, weapon selection
triggers:
  - minecraft combat
  - fight mobs
  - minecraft attack
  - kill mobs
version: 3.0.0
---

# Minecraft Combat

## Commands

```
mc attack [target]     # attack nearest hostile or specific mob type
mc eat                 # eat food to heal
mc equip stone_sword   # equip weapon
mc status              # check health + nearby threats
mc find_entities TYPE  # find specific mob type nearby
mc goto X Y Z          # flee to safe location
mc stop                # stop current action
```

## Combat Priority

Before ANY action, check health:
- Health ≤ 6: **RUN.** `mc eat` then flee. Do not fight.
- Health ≤ 10: Fight only if you have good weapon + armor
- Health > 14: Fight freely

## Weapon Selection

Equip best weapon before fighting:
```
mc equip netherite_sword   # best
mc equip diamond_sword     # great
mc equip iron_sword        # good
mc equip stone_sword       # okay
mc equip wooden_sword      # emergency
```

## Mob Strategies

### Zombie
- Slow, melee only. Easy kill.
- `mc attack zombie` — straight fight
- Watch for groups. Baby zombies are FAST.

### Skeleton
- Ranged (bow). Dangerous in open.
- Close distance fast, then `mc attack skeleton`
- Use shield if available. Fight near walls for cover.

### Creeper
- Explodes when close. **NEVER** let it get within 3 blocks.
- Sprint attack → retreat → sprint attack
- `mc attack creeper` then `mc goto` away quickly
- Kill with bow if possible

### Spider
- Neutral in daylight. Fast, can climb walls.
- `mc attack spider` — straightforward melee

### Enderman
- Only attacks if you look at it. Teleports.
- Fight in 2-block-high space (they can't fit)
- `mc attack enderman` — very strong, need iron+ gear

### Witch
- Throws potions. Dangerous.
- Close distance fast, melee quickly
- `mc attack witch`

### Creeper (charged)
- Blue glow = lightning-struck. 2x explosion.
- **RUN.** Do not engage.

### Blaze (Nether)
- Flies, shoots fireballs
- Need fire resistance or quick melee
- `mc attack blaze`

### Ghast (Nether)
- Flies high, shoots explosive fireballs
- Reflect fireballs by hitting them (hard with bot)
- `mc attack ghast`

## After Combat

1. `mc pickup` — collect drops (XP, items, mob drops)
2. `mc eat` — heal up
3. `mc status` — check surroundings for more threats
