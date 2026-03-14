---
name: minecraft-ender-pearls
description: Hunt endermen for pearls, craft Eyes of Ender. Use when in phase 6.
license: MIT
metadata:
    author: hermescraft
    version: "1.0"
    phase: "6"
    deaths_before_mastery: "0"
    success_rate: "0.5"
---

## Strategy

1. Return to the Overworld through the Nether portal.
2. Craft blaze_powder from blaze_rods: `craft` blaze_powder (1 rod = 2 powder).
3. Hunt endermen at night (they spawn in darkness) or in the Nether warped forest.
   - Endermen are tall, black, teleport when hit.
   - LOOK AT THEIR FACE to aggro them — they come to you.
   - Use `look` pitch=-30 (slightly up) to look at enderman eyes.
   - Then `attack` target "enderman".
4. Collect ender_pearl drops. Need 12 pearls minimum.
5. Craft eye_of_ender: `craft` eye_of_ender (1 blaze_powder + 1 ender_pearl). Craft 12.
6. Use Eyes of Ender to find the stronghold: throw one with `use_item` while holding eye_of_ender.
   - It flies toward the stronghold. Follow its direction.
   - Throw more as you travel to triangulate the position.

## Tips

- Endermen take damage from water. Fight in rain if possible — it weakens them.
- Build a 2-block-high overhang to fight under — endermen are 3 blocks tall and can't reach you.
- Endermen teleport away from arrows. Melee only.
- You need 12 Eyes of Ender: some break when thrown, and 12 are needed to fill the End portal.
- Deserts and plains are good biomes for finding endermen at night (flat, good visibility).
- The Warped Forest in the Nether has many endermen if Overworld hunting is too slow.
