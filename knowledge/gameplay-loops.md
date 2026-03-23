# Gameplay Loop Strategies

## Animal Farming Strategy

When to breed animals: once you have a stable food supply and want sustainable resources.
Breed cows for leather and steak, sheep for wool and mutton, chickens for feathers and eggs,
pigs for porkchops. Need 2 of the same animal nearby and their food item.
Breed cows and sheep with wheat, pigs with carrots/potatoes/beetroot, chickens with any seeds.
Build fenced pens before breeding. Animals have a 5-minute cooldown between breedings.
Use !breed to trigger breeding mode.

## Crop Farming Strategy

When to plant crops: day 1 or 2. Wheat is easiest — seeds come from breaking tall grass.
Use !farm to till dirt and plant seeds. Use !harvest when crops are mature to collect and auto-replant.
Bone meal speeds growth (craft from bones dropped by skeletons).
Build farms near water — farmland must be within 4 blocks of a water source block.
Replant immediately after harvest for continuous supply.
Early priority: wheat for bread, carrots for hunger and pig breeding.

## Crop Harvesting Tips

Mature wheat is tall and golden (age 7). Carrots and potatoes show tops poking out at age 7.
Beetroot matures at age 3 (only 4 growth stages, not 8).
Use !harvest to auto-detect mature crops in the area and replant with seeds from inventory.
Harvesting early gives nothing useful — crops must reach max age.
Bone meal can be applied with !farm to accelerate growth.

## Bone Meal Farming

Craft bone meal from bones (skeleton drops: 1 bone = 3 bone meal).
Bone meal instantly advances crops by 2-5 growth stages per application.
Efficient loop: kill skeletons at night for bones, use bones for bone meal, accelerate farming.
One bone = 3 bone meal = potentially 3 crops grown faster.
Also composts plant matter in a composter block for more bone meal.

## Mob Hunting for Resources

Hunt specific mobs for valuable drop items.
Skeletons drop bones (for bone meal) and arrows. Spiders drop string (bows and fishing rods).
Zombies rarely drop iron ingots or carrots. Creepers drop gunpowder (TNT, fireworks).
Endermen drop ender pearls (required for End portal activation).
Use !hunt to proactively seek hostile mobs in a 48-block radius.
Best hunting time: night, in open areas. Bring a sword and food.

## Hostile Mob Drop Table

Skeleton: bones, arrows, rarely a bow. Zombie: rotten flesh, rarely iron ingot or carrot or potato.
Creeper: gunpowder (2-5 per kill). Spider: string (0-2), rarely spider eye.
Witch: glass bottles, sticks, redstone dust, glowstone dust, sugar, spider eyes.
Enderman: ender pearl (1 per kill). Blaze: blaze rod (0-2, needed for brewing and eyes of ender).
Wither skeleton: coal, bones, rarely wither skull.
Use !hunt target:skeleton or !hunt target:creeper to target specific mob types.

## Exploration Strategy

Explore systematically in all 4 cardinal directions.
Use !explore direction:north distance:64 to scout new areas.
Look for villages (trading, free crops), temples (treasure loot), mineshafts (ores and rails),
ocean monuments (sponges and prismarine), strongholds (End portal).
Log what you find in your notepad. Return to base before night if undergeared.
Always bring food and a sword on any expedition.
Use !look target:horizon direction:north first to scout before committing movement.

## Village Discovery

Villages contain villagers with professions tied to workstation blocks.
Librarian (bookshelf workstation): trades paper for emeralds, sells enchanted books — most valuable.
Farmer (composter workstation): buys wheat, carrots, potatoes, and beetroot for emeralds.
Armorer / Weaponsmith (blast furnace or grindstone): sells diamond gear.
Cleric (brewing stand): buys rotten flesh for emeralds.
Butcher (smoker): buys raw meat. Villages have free crops, loot chests, and iron golems.

## Villager Trading Basics

Right-click any villager to open their trade menu.
Each trade costs specific items for emeralds or emeralds for goods.
First trade on a fresh villager is cheap — prices rise with demand then reset overnight.
Librarians are the most valuable: they sell enchanted books including Mending.
Mending auto-repairs gear from XP orbs — the single most important enchantment.
To unlock a profession: place the relevant workstation block near an unemployed villager.
Trading enough raises villager level from Novice to Master, unlocking better trades.

## Smelting Management

Smelt raw ores immediately after mining: raw_iron becomes iron_ingot, raw_gold becomes gold_ingot.
Cook all raw meat for 3-4x better food value (cooked_beef heals 8 hunger vs raw_beef 3).
Use coal as fuel — 1 coal smelts 8 items. Charcoal works identically (smelt any log).
Blast furnace smelts ores 2x faster than a regular furnace.
Smoker cooks food 2x faster.
Use !smelt item:raw_iron fuel:coal count:N to batch smelt multiple items.

## Furnace Fuel Efficiency

1 coal or charcoal smelts 8 items. 1 wooden plank smelts 1.5 items (wasteful).
A lava bucket smelts 100 items (best single fuel source). Blaze rods smelt 12 items each.
Dried kelp blocks smelt 20 items. Never burn logs directly when coal is available.
For large operations: use lava buckets from the nether or run !smelt in parallel furnaces.
Always prefer higher-efficiency fuels for mass smelting operations.

## Enchanting Setup Guide

Required: enchanting table (4 obsidian + 2 diamonds + 1 book), 15 bookshelves for max level 30,
lapis lazuli (2-3 per enchant). Place bookshelves 1 block away from the table with air gap.
You need XP level 30 for max enchantments — kill mobs and smelt ores for XP.
Best enchantments: Fortune III (multiply ore drops), Efficiency V (fast mining),
Protection IV (major damage reduction), Sharpness V (high weapon damage), Unbreaking III (4x durability).

## Enchanting Priority

Enchant pickaxe first with Fortune III or Efficiency V — massive quality-of-life improvement.
Second: sword with Sharpness V. Third: all armor pieces with Protection IV.
Apply Unbreaking III to every tool and armor piece — extends durability 4 times.
Mending (from librarian villagers) automatically repairs gear using XP orbs — get this ASAP.
Get Mending on your best pickaxe and sword before enchanting lesser tools.

## Nether Portal Construction

Build frame: obsidian rectangle 4 wide x 5 tall minimum (10 obsidian, corners optional).
Must mine obsidian with a diamond pickaxe.
Light the portal interior with flint and steel (craft: 1 iron ingot + 1 flint from gravel).
Nether dangers: ghasts shoot fireballs, blazes shoot fire, wither skeletons cause wither effect.
Essential gear before entering: iron or diamond armor, bow and arrows, food, cobblestone for shelter.
Mark your portal coordinates — it's easy to get lost in the nether.

## Nether Resources

Nether quartz ore: abundant, gives XP, used in redstone comparators and observers.
Nether gold ore: mine with any pickaxe, gives gold nuggets (9 nuggets = 1 gold ingot).
Ancient debris: at Y=8-22 (best Y=15), needs diamond pickaxe, blast resistant.
Smelt ancient debris for netherite scrap — combine 4 scraps + 4 gold ingots = 1 netherite ingot.
Glowstone clusters: break for dust, reassemble 4 dust = 1 block for lighting.
Blaze rods: from blazes at nether fortresses, needed for brewing and eyes of ender.

## Nether Survival Tips

Build a cobblestone shelter immediately around your portal — ghast fireballs cannot destroy cobblestone.
Mark your path back to portal with cobblestone markers (cobblestone doesn't naturally occur in nether).
Beds EXPLODE in the nether — never place one.
Carry a flint and steel in case your portal gets extinguished by a ghast fireball.
Wearing gold armor makes piglins neutral (they won't attack).
Water cannot exist in the nether — bring fire resistance potions for lava areas.

## Storage Organization

Build dedicated storage rooms near your base.
Use !deposit to put items in chests, !withdraw to take items out.
Suggested chest groups: ores and ingots, building materials, food, tools and weapons, miscellaneous.
Keep a "quick grab" chest near the entrance with torches, food, tools, and a sword.
Full inventory = missed item drops — deposit regularly after every mining or combat session.
Organize chests with item frames showing one example of the chest's contents.

## Chest Management Tips

Group similar items: all stone variants together, all wood types together, all food together.
Label chests with item frames. Keep emergency supplies in an easy-to-access chest:
16+ torches, 5+ food items, a pickaxe, a sword.
Sort after every major expedition. Dump cobblestone surplus in a dedicated chest.
Never store important gear in unsecured chests — other players can access them.
Periodically clear out excess materials to keep storage organized.

## Tool Progression Path

Start: punch tree for logs, craft planks, craft crafting table, craft wooden pickaxe (3 planks + 2 sticks).
Immediately mine cobblestone and upgrade to stone pickaxe (3 cobblestone + 2 sticks).
Mine iron ore at Y=16-64, smelt with !smelt, craft iron pickaxe (3 iron ingots + 2 sticks).
Mine below Y=16 for diamonds (best at Y=-59), craft diamond pickaxe (3 diamonds + 2 sticks).
Tier unlocks: wood mines stone/coal, stone mines iron/copper, iron mines gold/diamond/redstone/lapis,
diamond mines obsidian. Wrong tier = block breaks but drops NOTHING.

## Armor Progression

Craft armor in sets: helmet (5 ingots), chestplate (8 ingots), leggings (7 ingots), boots (4 ingots).
Full iron set = 24 iron ingots. Full diamond set = 24 diamonds.
Shield (1 iron ingot + 6 planks) blocks all frontal damage and is cheap to make early.
Always wear armor when exploring or fighting — naked combat is dangerous past early game.
With iron armor and a sword, most overworld mobs become manageable.
Upgrade iron to diamond armor as soon as you have enough diamonds.

## When to Upgrade Gear

Upgrade pickaxe tier when you have 3+ materials of the next tier.
Do not skip tiers — stone required for iron, iron required for diamonds.
Replace tools before they break: diamond pickaxe has 1561 uses, iron has 250, stone has 131.
Enchant before upgrading tier if possible — Fortune III on iron beats unenchanted diamond for ores.
Netherite upgrade: smelt ancient debris into netherite scrap, combine with gold ingots and smithing table.
Netherite gear cannot burn in lava — essential protection against the nether's biggest hazard.

## Daily Activity Loop

Morning: check crops with !harvest if farms are mature, replant automatically, eat if hungry.
Midday: go mining below Y=16 for diamonds, or !explore new areas, or build structures.
Afternoon (dusk approaching): return to base, deposit mined items, start !smelt on ores.
Craft upgrades and tools. Seal base doors and light up dark areas with torches.
Night: mine underground (zero mob risk), or !hunt mobs on surface if well-geared,
or organize storage and craft items. Keep sword equipped at all times.

## Progression Milestone Checklist

Early game (day 1-3): wooden then stone tools, first shelter, wheat farm started, food from kills.
Mid game (day 4-14): iron tools and armor, established crop farm, animal pens with !breed active,
basic organized storage, located a nearby village with !explore.
Late mid game (day 15-30): diamond pickaxe, enchanting setup with 15 bookshelves, nether expedition,
trading enchanted books from librarian villagers.
End game: netherite gear, full enchanting suite, massive organized base, active farming and !hunt loops.
