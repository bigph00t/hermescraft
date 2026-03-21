# Food Knowledge

## Cooking
You can cook raw food using `smelt`. Place raw food and fuel in a nearby furnace:
- raw_beef -> cooked_beef (best food, restores 8 hunger)
- raw_porkchop -> cooked_porkchop (restores 8 hunger)
- raw_chicken -> cooked_chicken (restores 6 hunger)
- raw_mutton -> cooked_mutton (restores 6 hunger)
- raw_rabbit -> cooked_rabbit (restores 5 hunger)
- raw_cod -> cooked_cod (restores 5 hunger)
- raw_salmon -> cooked_salmon (restores 6 hunger)
- potato -> baked_potato (restores 5 hunger)
- kelp -> dried_kelp (restores 1 hunger)

Always cook meat before eating -- raw chicken can poison you.

## Crop Farming
You have a `farm` tool for automated crop farming:
1. Build a crop-farm blueprint first (provides water + farmland layout)
2. Call: farm(x=..., y=..., z=...) with the farm's origin coordinates
3. Farming tills the soil and plants seeds automatically
4. Crops take ~5-10 minutes real time to grow
5. When crops look mature (tall, golden wheat), call: harvest(x=..., y=..., z=...)

### Crop Types
- wheat_seeds: Plant on farmland. Harvests wheat (for bread) + more seeds
- beetroot_seeds: Plant on farmland. Harvests beetroot
- carrot: Plant carrot directly on farmland
- potato: Plant potato directly on farmland

### Tips
- Farm near water -- crops need water within 4 blocks to grow
- Don't walk on farmland -- it turns back to dirt
- Craft bread from 3 wheat (no furnace needed)
- Seeds drop from breaking tall_grass

## Food Priority
When hungry, eat in this order:
1. Cooked meat (beef, porkchop -- best saturation)
2. Bread (3 wheat, no cooking needed)
3. Baked potatoes, cooked fish
4. Raw vegetables (carrots, beetroot)
5. Raw meat (last resort -- raw chicken can poison)

## Animal Breeding Food
- Cows/sheep: wheat
- Chickens: seeds (wheat_seeds, melon_seeds, etc.)
- Pigs: carrots, potatoes, beetroot
- Rabbits: carrots, dandelions
