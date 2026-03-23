# Survival Knowledge

Comprehensive survival reference for AI agents. All data is Java Edition 1.21.1.
Directives are imperative. Each section is self-contained for RAG retrieval.

---

## First Day and Early Game

### First Day Sequence: Tree to Stone Tools
Punch a tree immediately on spawn — hold left-click, takes ~1.5s per log with bare hands. Collect 3–5 logs. Open inventory (E), place one log in the 2×2 grid for 4 planks. Craft 4 planks into a crafting table. Place it on the ground and right-click to access the 3×3 grid. Craft sticks (2 planks vertically), then a wooden pickaxe (3 planks top row + 2 sticks below center). Find stone — it generates on the surface of most biomes. Mine 3 cobblestone. Upgrade to a stone pickaxe (3 cobblestone top row + 2 sticks). Craft a stone sword (2 cobblestone vertically + 1 stick). Stone tools are ~3× more durable than wood and ~2× faster.

### Survival Before Night: Shelter and Light
You have roughly 10 real minutes (12,000 ticks) before hostile mobs spawn. Dig 3 blocks into a hillside, hollow a 3×3 room, and seal the entrance with a door. This is faster than building from scratch. Minimum viable shelter: fully enclosed walls and ceiling, a door, 2+ torches inside, and a bed. Torches are 1 coal + 1 stick → 4 torches. Mine coal on the way to your shelter — it spawns at all elevations. If you cannot find coal, smelt logs in a furnace to make charcoal. Mobs cannot spawn inside your shelter if the interior is enclosed and has any light (light level ≥ 1).

### Crafting Fundamentals
Core early recipes at a crafting table:
- Furnace: 8 cobblestone in a ring (leave center empty)
- Chest: 8 planks in a ring (leave center empty), gives 27 storage slots
- Bed: 3 wool (top row) + 3 planks (middle row) — kill 3 sheep or shear them
- Torches: 1 coal/charcoal + 1 stick → 4 torches
- Sticks: 2 planks vertically → 4 sticks
- Wooden pickaxe: 3 planks top row + 2 sticks below center

Craft a chest before leaving the spawn area. Build a furnace to start smelting iron and cooking food immediately.

---

## Day/Night Cycle

### Tick Timeline and Mob Spawning
One full day/night cycle = 24,000 ticks = ~20 real minutes at 20 ticks/second.
- Tick 0: Sunrise. Full daylight.
- Tick 6000: Solar noon.
- Tick 12000: Sunset begins. Hostile mobs start spawning on dark surfaces.
- Tick 13000: Full night. Mobs spawn freely outdoors.
- Tick 18000: Midnight.
- Tick 23000: Sunrise begins. Zombies and skeletons catch fire in sunlight.
- Tick 24000: Day resets to 0.

Creepers, spiders, and endermen do NOT burn in sunlight — they remain dangerous outdoors during the day if encountered. Check time with `/time query daytime` or craft a clock (4 gold ingots + 1 redstone) to read in-game time. Sleep in a bed between ticks 12541 and 23459 to skip to tick 0 (sunrise).

---

## Hunger, Saturation, and Health

### Hunger Bar and Saturation
The hunger bar shows 10 drumstick icons = 20 hunger points total. Saturation is a hidden buffer — food fills saturation first, hunger depletes only after saturation reaches 0. High-saturation foods (cooked steak, golden carrots) keep you full far longer than low-saturation foods (bread, melon slices). Hunger depletes from sprinting, jumping, and combat. Standing still barely drains it.

### Health Regeneration and Starvation
Natural health regen triggers only when hunger ≥ 18 (9+ full drumstick icons). At full hunger, regen is 1 HP per ~1.5 seconds. Below 18 hunger, no regen occurs. At 0 hunger, starvation begins: on Normal difficulty, health drains to 1 HP and stops (cannot kill). On Hard difficulty, starvation CAN kill completely. Eat immediately after combat to restore hunger and reactivate regen.

Best early-game foods: cooked chicken (6 hunger, common drop), cooked pork/beef (8 hunger, high saturation), bread (5 hunger, craft from wheat). Raw chicken has a 30% food poisoning chance — always cook it.

### Potion of Regeneration and Golden Apple
Regeneration I potion heals 1 HP per 2.5 seconds regardless of hunger level — bypasses the hunger requirement entirely. Brew from ghast tear + awkward potion. A golden apple (8 gold ingots surrounding an apple) grants Regeneration II (5 sec) + Absorption shield (4 extra HP). Both are essential for boss fights.

---

## Death and Respawn

### Death Mechanics
On death, all inventory items drop as item entities at death location. Items despawn after exactly 5 minutes (6000 ticks) — sprint to recover them. XP orbs drop at death location. The death coordinates appear in chat — write them down. Respawn priority: (1) charged respawn anchor (Nether), (2) your last-used bed, (3) world spawn if bed is gone or blocked.

### Bed as Spawn Point
Sleeping in a bed sets your personal spawn. If the bed is later destroyed or the 2 air blocks above the head-end are blocked, your respawn fails and you appear at world spawn with "Your home bed was missing or obstructed." Place beds in open areas with clearance above. In the Nether or End, right-clicking a bed causes a massive explosion (≈5 TNT) — never do this. Use a respawn anchor (charged with glowstone) in the Nether instead.

---

## Shelter and Lighting

### Building a Safe Shelter
Fully enclose the shelter — no gaps in walls, ceiling, or floor. Use a door (wooden doors can be broken by zombies on Hard; iron doors cannot be broken by any mob). On Hard, use iron doors with a button or pressure plate — zombies cannot activate buttons. Place torches every 6–8 blocks to maintain light level ≥ 1 on all interior surfaces. One torch at light level 14 prevents mob spawns within 13 blocks in any direction. Mobs in 1.18+ spawn only at light level 0, so any light source eliminates spawns on that surface.

### Light Level Reference
| Source | Level |
|---|---|
| Sun (outdoors, noon) | 15 |
| Glowstone / Sea Lantern / Lantern | 15 |
| Torch | 14 |
| Soul Lantern | 10 |
| Redstone Torch | 7 |
| Magma Block | 3 |

For cave mining: place torches on the right-hand wall going away from base. Returning, torches will be on the left — this prevents getting lost. Hostile mobs spawn only at block light level 0 in 1.18+.

---

## Water Bucket

### Water Bucket: Essential Survival Item
A water bucket (3 iron ingots in a bucket shape, then right-click a water source block) is the single most important item to carry. It eliminates or mitigates: fall damage at any height (MLG water — place water below you before impact), lava damage (pour water onto lava source → obsidian; onto flowing lava → cobblestone), fire (right-click while burning to extinguish), and mob pursuit (water slows mobs). Create an infinite water source by digging a 2×2 pit and filling two opposite corners — refill the bucket indefinitely from the center.

### MLG Water Technique
While falling, look down and right-click to place a water source block on the ground below you. The water block must be placed ~0.5 seconds before impact. Landing in water cancels all fall momentum — 0 damage from any height. Practice this as a reflex: it counters one of the most common death types.

---

## Hazards: Fall Damage, Fire, Drowning

### Fall Damage
Damage begins at falls greater than 3 blocks. Formula: (fall distance − 3) × 0.5 hearts. Falling 23 blocks = 10 hearts = death from full health. To negate: land in water (0 damage), land on hay bale (80% reduction), land on slime block (0 damage, bounces — crouch to stop bounce), land on honey block (0 damage, no bounce), use MLG water. Feather Falling IV boots reduce fall damage by 48%. Opening an elytra mid-fall resets the fall counter.

### Fire and Lava
Lava deals 4 HP (2 hearts) per second while submerged; 2 HP per second on surface contact. Fire set by lava continues at 1 HP/sec after you exit lava. Fire Resistance potion = complete immunity to fire and lava damage for 3 minutes (8 minutes extended). Brew from magma cream + awkward potion. Carry this for all Nether travel. In the Nether, water buckets evaporate instantly — useless against lava. Use fire resistance potions instead.

### Drowning and Underwater Survival
Oxygen lasts 15 seconds underwater before drowning starts (1 HP/sec). Swim back to air at any time to restore oxygen. Create air pockets underwater: place a door, sign, or ladder — these create breathable gaps. Respiration III helmet enchant extends underwater time to ~45 seconds. Aqua Affinity helmet enchant mines at normal speed underwater (default is 5× slower). Magma blocks on seafloor create downward bubble columns that drag you and deal suffocation — avoid. Soul sand on seafloor creates upward columns that propel you up and replenish air.

### Status Effects: Poison and Wither
Poison drains to 1 HP and stops — it cannot kill you. Sources: cave spiders, witches, pufferfish, bee stings. Drink milk to cure instantly. Wither effect (black health bar) CAN kill completely. Sources: wither skeletons, wither boss, wither rose flowers. Drink milk immediately. Milk removes ALL active effects simultaneously — time it to avoid removing beneficial effects like fire resistance. Powder snow causes freezing damage (1 HP/2 sec) when submerged. Wearing leather boots lets you walk on top of powder snow without sinking — any other boots cause you to fall in.

---

## Inventory and Storage

### Inventory Layout and Hotbar
Total inventory: 36 main slots (hotbar 1–9 + 27 above) + 4 armor slots + 1 offhand. Press 1–9 to select hotbar slots. Offhand (F key to assign) holds shields, maps, and torches accessible while main hand is busy. Most items stack to 64. Tools and armor do not stack. Ender pearls, eggs, and snowballs stack to 16. Shift-click to move items between inventory and container. Ctrl+Q drops an entire stack.

Recommended hotbar: (1) sword, (2) pickaxe, (3) axe, (4) shovel, (5) food, (6) torches, (7) water bucket, (8) building block, (9) bow or utility item.

### Chests and Storage Organization
Single chest: 27 slots. Double chest: place two chests side by side = 54 slots (leave 1 air block above to open). Trapped chests look identical to normal chests but emit a redstone signal when opened — avoid using them for standard storage. Organize storage by category: wood/planks, stone/cobblestone, ores/ingots, food/farming, tools. Use item frames on chest fronts to label contents.

### Ender Chest
Ender chest (8 obsidian surrounding 1 Eye of Ender) provides 27 personal slots accessible from any ender chest in any dimension. Contents are never dropped on death. Store your most valuable items (diamonds, enchanted gear, rare drops) here. Breaking an ender chest without Silk Touch returns 8 obsidian — contents are NOT lost, just inaccessible until you use another ender chest.

---

## Smelting

### Furnace, Blast Furnace, and Smoker
Furnace (8 cobblestone in a ring): smelts anything, 10 seconds per item. Blast furnace (5 iron + 1 furnace + 3 smooth stone): smelts ores and raw metals at 2× speed (5 sec/item) — does not cook food. Smoker (4 logs + 1 furnace): cooks food at 2× speed — does not smelt ores. Use blast furnace for all ore processing, smoker for all food, regular furnace for everything else.

### Fuel Efficiency
| Fuel | Items Smelted |
|---|---|
| Lava bucket (returns empty bucket) | 100 |
| Coal block | 80 |
| Coal / Charcoal | 8 |
| Wood log or planks | 1.5 |
| Sticks | 0.5 |

Use coal blocks or lava buckets for bulk smelting. Never burn planks for fuel unless desperate — planks are worth more as building material. A furnace with a full stack of coal (64 × 8 = 512 items) can smelt an entire inventory.

---

## XP (Experience Points)

### XP Sources
| Source | XP |
|---|---|
| Killing most mobs | 1–5 |
| Killing Blaze | 10 |
| Killing Ender Dragon (first) | 12,000 |
| Mining diamond/emerald ore | 3–7 |
| Mining redstone ore | 1–5 |
| Mining coal/iron/gold ore | 0–2 |
| Smelting items | 0.1–1.0 each |
| Breeding animals | 1–7 |
| Trading with villagers | 3–6 |
| Fishing | 1–6 |

XP required per level increases as levels rise: level 0→30 needs ~1395 total XP. Enchanting and anvil operations spend levels, not raw XP. Build a mob grinder for consistent XP: dark room above a 22-block drop (leaves mobs at 1 HP), one hit kills for full XP, rates of 100+ mobs/hour achievable.

---

## Villager Trading

### Profession Assignment and Trade Leveling
Unemployed villagers claim the nearest unclaimed workstation. Assign professions by placing the corresponding block:
- Librarian → lectern (enchanted books — most important)
- Armorer → blast furnace
- Weaponsmith → grindstone
- Toolsmith → smithing table
- Farmer → composter
- Cleric → brewing stand
- Cartographer → cartography table
- Fletcher → fletching table
- Mason → stonecutter
- Butcher → smoker

Trade with a villager to level them up: Novice → Apprentice → Journeyman → Expert → Master. Higher levels unlock better trades. Villagers restock twice per in-game day when they can access their workstation.

### Librarian Book Rolling and Zombie Villager Curing
The book a librarian offers is determined when it first claims a lectern. Break and replace the lectern to reroll the offered book before trading with the villager. This is the fastest way to obtain specific enchanted books. For permanently discounted prices: find a zombie villager, hit it with a splash Potion of Weakness, then feed it a golden apple. It cures in ~5 minutes and offers 1-emerald prices for most trades — the most efficient path to max-enchanted gear.

---

## Maps, Compass, and Navigation

### Maps and Compass
Craft a map: 1 compass surrounded by 8 paper. Right-click to initialize. Maps are dimension-specific (Overworld maps are blank in the Nether). Zoom out by surrounding the map with 8 paper (up to 4 times, reaching 1:16 scale = 2048×2048 block coverage). Mark waypoints by right-clicking a named banner with your active map — the banner appears as a labeled marker. A standard compass points to world spawn (not your bed). In the Nether and End, compasses spin randomly — useless.

### Lodestone Compass and Coordinates
Craft a lodestone (8 chiseled stone bricks + 1 netherite ingot). Right-click it with a compass to create a lodestone compass that points to that lodestone from any dimension — essential for Nether navigation. Use F3 debug screen for exact coordinates (X = east/west, Y = elevation, Z = north/south). Write your base coordinates down and store them in your in-game notepad. Diamond ore peaks at Y=15 in 1.18+. Ancient debris peaks at Nether Y=15. Sea level is Y=63. Bedrock floor is Y=-64.

---

## Spawn Chunks

### Spawn Chunk Behavior
A 16×16 area of chunks centered on the world spawn point (0,0) remains always loaded regardless of player position. Redstone and existing entity movement in spawn chunks runs continuously 24/7 with no player nearby. Build permanent automation (item sorters, automatic farms, redstone clocks) here for always-on operation. Use F3+G to display chunk borders and identify spawn chunk boundaries (approximately -8,-8 to +7,+7 in chunk coordinates, centered on world spawn).

### Spawn Chunk Limitations
Mob spawning does NOT occur in spawn chunks without a player within 128 blocks — only redstone and already-existing entity physics tick. World spawn (spawn chunk center) ≠ your bed spawn. A compass and spawn chunks always reference world spawn coordinates, not your personal bed location.

---

## Mining Strategy

### Strip Mining and Cave Mining
For diamonds (Y=15 in 1.18+): mine a main 1×2 corridor, branch off every 3rd block in both directions. This maximizes ore exposure per block mined. Torch the main corridor and branches. Alternative: explore natural cave systems at Y 5–20 — caves expose far more ore per block broken but are more dangerous. Always carry torches and 3+ food stacks when mining. Ancient debris (netherite source) only spawns in the Nether between Y=-29 and Y=119, peaking at Y=15.

### Fortune vs Silk Touch
Fortune III: diamonds yield 1–4 per ore (avg 2.2×), coal yields 1–3 per ore. Always use Fortune for ore mining. Silk Touch retrieves the block itself — useful for ice, grass blocks, bookshelves, spawner blocks, and glass. Never mine diamond ore with Silk Touch if you have a Fortune pickaxe available — use Fortune directly. Exception: mine ore with Silk Touch to stockpile unmined ore blocks for Fortune-mining later.

---

## Combat

### Sword Mechanics and Critical Hits
Swords have an attack cooldown shown by the charge indicator at the bottom center. Wait for 100% charge between hits — spam-clicking deals reduced damage. Jump-attack: jump and swing while falling = critical hit = 50% bonus damage (star particles appear). Master the jump-crit: jump, swing at peak, hit on the way down. Fully charged attacks on groups also trigger a sweep attack hitting all mobs within 1 block of the target — target the center mob of a group.

### Shield and Bow
Craft a shield (6 planks + 1 iron ingot). Right-click to raise it. Shields block all frontal melee damage and most projectiles. Axes deal extra damage through shields and stun them for 5 seconds on hit — counter-stun by timing a sword block. For bow: draw fully (~1 second) for maximum power = 9–10 damage. Power V bow one-shots most mobs. Flame I bow sets mobs on fire for 5 seconds. Infinity enchant prevents arrow consumption (requires at least 1 arrow in inventory — it is never consumed).

---

## Animal Farming and Food

### Breeding Animals
Feed two animals of the same species their breeding item — both must be fed:
- Cows, Sheep: wheat
- Pigs: carrot, potato, or beetroot
- Chickens: any seed (wheat, melon, pumpkin, beetroot)
- Horses/Donkeys: golden apple or golden carrot
- Rabbits: dandelion, golden carrot, or carrot

Hearts appear, baby spawns after 5 seconds. 5-minute cooldown per parent. Fence animals in with fences (1.5 blocks tall — mobs cannot jump over). Use fence gates to access pens. Build a hopper under chicken pens to auto-collect eggs; throw eggs to hatch chickens (1/8 chance per throw).

### Crop Farming Essentials
All crops need: hydrated farmland (hoe dirt within 4 blocks of water, or use a water source above on higher elevation), light level ≥ 8, and un-trampled ground (don't jump on farmland). Bone meal (from skeleton drops or composting) force-grows most crops 2–5 stages. Key crops:
- Wheat: seeds from tall grass, gives 1–3 wheat + seeds on harvest
- Carrots/Potatoes: self-seeding, just replant one
- Melons/Pumpkins: grow as adjacent blocks from a stem — leave space next to the stem
- Sugar cane: needs adjacent water, grows 3 blocks tall, plant beside a river

---

## Resource Acquisition Order

### Priority Resources: Iron, Coal, Diamonds, Obsidian
Get iron first (Y 15–40 for peak density): 24 iron unlocks bucket + shield + spare pickaxe. Never pass coal ore — it is fuel and torches at all elevations. Smelt logs into charcoal as a fallback. Diamond tools are required for mining obsidian (8 sec with diamond pickaxe vs 50+ sec with iron). Need minimum 3 diamonds for a pickaxe, 2 for an enchanting table. Obsidian (10 blocks for a Nether portal frame) is farmed by pouring water onto a lava source block — one water bucket + any lava pool is sufficient. Flint and steel (1 iron ingot + 1 flint) lights the portal; flint drops from gravel at 10% chance or 100% with Fortune III.

---

## Key Structures

### Villages, Strongholds, and Nether Fortress
Villages generate in plains, desert, taiga, savanna, and snowy plains biomes — high-value early targets for beds, food, and trading. Strongholds (End portals) are underground; find them by throwing Eyes of Ender and following their arc — when an eye drops rather than flies, dig down. Nether Fortresses are required for blaze rods (→ brewing fuel + blaze powder) and wither skeleton skulls (→ Wither boss). Bastion Remnants contain ancient debris, netherite scraps, and piglin barter goods. Woodland Mansions contain evokers (drop Totem of Undying — prevents one death). End Cities (post-dragon) contain elytra (wings for gliding) and shulker boxes (portable storage containers).

---

## The Nether

### Entering and Navigating the Nether
Build a portal frame: 4 wide × 5 tall obsidian (minimum 2×3 interior). Light with flint and steel on the inside. Stand in the purple vortex 4 seconds to transfer. Nether coordinate scaling: 1 block in the Nether = 8 blocks in the Overworld — build Nether highways at Y=110–120 to fast-travel massive Overworld distances. Wear at least one piece of gold armor around piglins or they attack. Barter by throwing gold ingots at adult piglins for random loot (ender pearls, fire resistance potions, string). Water buckets evaporate instantly in the Nether — bring fire resistance potions instead. Ghasts fire explosive projectiles from 100 blocks — deflect with a sword hit. Blaze rods drop from Blazes in Nether Fortresses; need minimum 12–24 for a full brewing setup.

---

## The End

### Reaching and Defeating the Ender Dragon
Throw Eyes of Ender (blaze powder + ender pearl) into the air; they fly toward the stronghold. When one drops rather than flies, you are directly above it. Dig down to the portal room, fill the 12-slot frame with Eyes of Ender (some slots may be pre-filled), and step into the center. In The End: destroy all End Crystals on obsidian pillars first (shoot with bow — they explode). The dragon is invincible while any crystal is intact. Once all crystals are gone, attack when the dragon perches on the center fountain. Beds explode in The End — place one on the fountain and right-click from behind cover to deal massive damage to the perched dragon. Killing the dragon releases 12,000 XP and opens the exit portal. Post-dragon: throw an ender pearl into an End Gateway to reach End Cities, which contain elytra and shulker boxes.

---

## Tool Maintenance and Repair

### Anvil Repair
Use an anvil (3 iron blocks + 4 iron ingots) to repair tools and armor. Place the damaged item in the first slot and either another item of the same type or the raw material (iron, diamond, gold, netherite ingot) in the second slot. Each repair increases the "prior work" cost — after 5+ repairs, the cost may exceed 39 levels ("Too Expensive"). Plan repairs early before costs compound. Grindstone (2 sticks + 1 stone slab + 2 planks) repairs items for free but removes all enchantments — only use grindstone on unenchanted items.

### Tool Durability Guide
Durability determines how many blocks you can mine or hits you can deal before the tool breaks. Sword: wood 60, stone 131, iron 250, diamond 1561, netherite 2031. Pickaxe: same values. Armor varies by piece and tier — iron chestplate has 240 durability, diamond chestplate has 528. Always keep a spare tool in your hotbar when mining deep. A broken pickaxe strands you underground.

## Torches and Lighting Strategy

### Torch Placement for Mob Prevention
Hostile mobs spawn only at block light level 0 in 1.18+. A single torch has light level 14 at source, dropping by 1 per block. Place torches every 12 blocks along walls to maintain minimum light level 2 everywhere between torches. For mob-free areas, use light level 8 as your minimum target — place torches every 8 blocks. Light your base perimeter with lanterns (higher light, longer range) on fence posts. Underground mines: place torches on one consistent wall to use them for navigation.

### Light Sources Comparison
Torch: 14 light, craft from coal + stick. Lantern: 15 light, craft from torch + iron nuggets. Glowstone: 15 light, found in Nether, crush for glowstone dust. Sea lantern: 15 light, found in ocean monuments, drops prismarine crystals without Silk Touch. Soul lantern: 10 light, craft from soul sand + iron + torch. Candle: 3-12 light (1-4 candles on a block), craft from string + honeycomb. Jack-o-lantern: 15 light, carved pumpkin + torch — decorative mob-proof light.

## Nether Preparation

### Gear Before Entering the Nether
Do not enter the Nether without: iron armor minimum (full set), iron sword, iron pickaxe, 20+ cooked food, 64+ torches, a bucket (not water — useless in Nether), and flint and steel (relight portals). Build gold armor boots minimum — piglins attack any player wearing no gold. The Nether has ghasts, piglins, zombie piglins, blazes, wither skeletons, magma cubes, and hoglins — each lethal to unprepared players.

### Nether Portal Safety
Mark your portal's Nether-side coordinates immediately on entering — they will be approximately X/8, same Y, Z/8 of your Overworld position. Build a small cobblestone shelter around your Nether portal immediately to protect it from ghast fireballs. Ghast fireballs destroy portal frames if they hit unprotected obsidian areas. Replace any destroyed obsidian with spare obsidian carried in your inventory. Carry flint and steel to relight the portal if the flame is extinguished.

## Progression Milestones

### Early Game Milestones (Day 1–3)
Day 1 targets: wood tools, stone tools, shelter, torches, bed. Day 2: mine iron (at least 24 ingots), craft full iron armor + iron pickaxe + iron sword + water bucket + shield. Day 3: mine diamonds (at least 6), craft diamond pickaxe + enchanting table obsidian (4 blocks). Complete this progression before venturing far from base. Skipping any tier compounds risk — stone tools in a cave at night is a death sentence.

### Mid Game Milestones (Week 1)
Get a full set of iron armor before exploring caves. Build a base with storage, a bed, a farm, and a furnace array. Get a diamond pickaxe before going below Y=-40. Establish a food farm (wheat or carrots) before the second night. Trade with villagers to get useful items without mining. Build a Nether portal after getting iron armor. Mine 4 ancient debris for 1 netherite ingot before the End fight.

## Fishing

### Fishing Mechanics
Craft a fishing rod from 3 sticks + 2 string. Cast into any water body (2+ blocks deep works best). Wait for the bobber to dip underwater (sound: splash) — right-click immediately to reel in. Fishing yields: fish (55% chance), treasure (5% chance), junk (40%). Treasure includes: enchanted books (with random enchantments — best source of Mending and rare enchants), bows, fishing rods, saddles, name tags, and nautilus shells. Fish in rain for +20% chance of catching fish. Open water bonus: fishing in a 5x5x5 open water area reduces wait time by 20%.
