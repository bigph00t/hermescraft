---
name: minecraft-combat-survival
description: Combat and survival tactics. Avoid death, fight mobs, manage health/food.
license: MIT
metadata:
    author: hermescraft
    version: "1.0"
    phase: "0"
    deaths_before_mastery: "0"
    success_rate: "0.7"
---

## Strategy

### Night survival (time >= 13000)
- If no shelter: dig a 1x1x2 hole, jump in, place block above your head.
- Or: dig underground — `look_at_block` at stone below you → `break_block` until safe.
- If caught outside: equip sword, fight with `attack`, sprint away from groups.

### Combat
- Always equip your best sword before fighting: `equip` diamond_sword/iron_sword/stone_sword.
- Use `attack` with target name: "zombie", "skeleton", "spider", "creeper".
- Sprint between attacks for knockback — `sprint` enabled then `attack`.
- NEVER fight creepers in melee unless you can kill in 2 hits. They explode.
- Skeletons: close distance fast or use a shield.

### Health management
- Eat when food < 14: use `eat` action (auto-selects best food in hotbar).
- If health < 10 and enemies nearby: run away, eat, then re-engage.
- Cooked meat restores 8 food. Raw meat only 3.

### Avoiding death
- Don't dig straight down (lava at Y < 10).
- Watch for creepers — if you hear a hiss, run.
- Stay above Y=10 unless you have iron armor.
- Keep food in hotbar at all times.
