---
name: minecraft-farming
description: Food production in Minecraft — crop farming, animal breeding, cooking, food sources
triggers:
  - minecraft farm
  - grow food minecraft
  - minecraft food
  - breed animals
version: 3.0.0
---

# Minecraft Farming

## Commands

```
mc collect CROP N        # harvest crops
mc place SEEDS X Y Z     # plant seeds
mc craft ITEM             # craft farming tools
mc smelt RAW_FOOD         # cook food in furnace
mc attack ANIMAL          # kill for meat
mc find_blocks BLOCK      # find farmland, water, crops
mc interact X Y Z         # use hoe on dirt
mc use                    # use held item (bone meal, etc)
```

## Quick Food (Early Game)

Fastest way to not starve:

1. Kill animals: `mc attack cow`, `mc attack pig`, `mc attack chicken`
2. `mc pickup` — collect raw meat
3. `mc smelt raw_beef` (or raw_porkchop, raw_chicken)
4. Cooked steak = 8 food points (best common food)

## Crop Farming

### Setup
1. Craft hoe: `mc craft stone_hoe`
2. Find water or `mc place water_bucket X Y Z`
3. Till dirt near water: equip hoe, `mc interact X Y Z` on dirt blocks
4. Get seeds: break grass with hand → wheat seeds
5. Plant: `mc place wheat_seeds X Y Z` on farmland

### Harvest
- Wheat grows in ~20 minutes. Fully grown = golden color.
- `mc collect wheat N` — harvest mature wheat
- `mc craft bread` — 3 wheat → 1 bread (6 food points)

### Best Crops
- **Wheat**: bread (6 food) — easy, found everywhere
- **Carrots**: eat raw (3 food) or golden carrot (6 food + saturation)
- **Potatoes**: bake in furnace (5 food) — excellent
- **Beetroot**: beetroot soup (6 food) — decent

## Animal Farming

### Breeding
1. Build fenced enclosure: `mc craft oak_fence`
2. Lure animals with food (wheat for cows/sheep, seeds for chickens, carrots for pigs)
3. Feed two of same animal to breed

### Animal Products
- **Cow**: raw beef (cook it), leather
- **Pig**: raw porkchop (cook it)
- **Chicken**: raw chicken (cook it), feathers, eggs
- **Sheep**: wool (shear or kill), raw mutton

## Food Rankings (food points + saturation)

```
Golden carrot:     6 food, 14.4 sat  (best overall)
Cooked steak:      8 food, 12.8 sat  (best farmable)
Cooked porkchop:   8 food, 12.8 sat  (tied with steak)
Baked potato:      5 food, 6.0 sat   (easy to mass produce)
Bread:             5 food, 6.0 sat   (easy early game)
Cooked chicken:    6 food, 7.2 sat   (decent)
Apple:             4 food, 2.4 sat   (oak tree drops)
```
