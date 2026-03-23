# crafting-items.md — Niche Crafting, Smelting, and Item Interaction Rules for Minecraft 1.21.1

---

### Crafting Grid: 2×2 vs 3×3

The player's inventory has a 2×2 crafting grid. Use it ONLY for:
- Planks (any log → 4 planks)
- Sticks (2 planks → 4 sticks)
- Crafting table itself (4 planks)
- Torches (stick + coal/charcoal)
- A handful of other 2-ingredient shapeless recipes

**Everything else requires a crafting table (3×3 grid).** This includes all tools, all armor, all weapons, bows, boats, beds, chests, furnaces, doors, signs, and all multi-step shaped recipes. If a recipe uses more than 4 ingredients or any specific spatial arrangement beyond 2×2, you need a crafting table. Recipes that fit a 2×2 pattern can also be made in the 3×3 grid — always prefer the crafting table when available.

Shaped recipes can be mirrored horizontally and positioned anywhere in the grid. Shapeless recipes accept ingredients in any slot.

---

### Furnace Smelting

- Smelting one item takes exactly **10 seconds (200 ticks)**.
- The furnace processes one item at a time, in order.
- Fuel is consumed before the first item begins smelting; leftover heat carries over to subsequent items.

**Fuel values (items smelted per unit):**
| Fuel | Items smelted |
|---|---|
| Lava bucket | 100 (bucket returned to fuel slot) |
| Block of Coal | 80 |
| Dried Kelp Block | 20 |
| Blaze Rod | 12 |
| Coal / Charcoal | 8 each |
| Boat | 6 |
| Overworld log / stripped log | 1.5 |
| Planks | 1.5 |
| Wooden tools (any) | 1 |
| Sticks | 0.5 |

**Nether stems (Warped/Crimson logs) do NOT work as fuel.** Only Overworld wood burns.

The **lava bucket** is always the most efficient single-use fuel. After burning, an empty bucket remains in the fuel slot — retrieve it and refill.

Experience from smelting accumulates silently and is released only when you manually remove items from the output slot. Do not skip this step after a long smelt session.

---

### Blast Furnace

- Smelts at **2× speed (5 seconds per item)** but consumes the same fuel per item as a regular furnace.
- **Only accepts:** raw metals (raw iron, raw gold, raw copper), ore blocks (iron ore, gold ore, copper ore, deepslate variants, nether gold ore), metal tools and armor (iron, gold, copper, chainmail), and ancient debris.
- **Cannot smelt:** food, wood, sand, stone, terracotta, kelp, or any non-metal material. Attempting to put food into a blast furnace will not work.
- Use blast furnace for metal processing exclusively. Use a regular furnace for everything else that isn't food.

---

### Smoker

- Cooks food at **2× speed (5 seconds per item)**.
- **Only accepts food items:** raw meats, raw fish, potatoes, kelp.
- **Cannot cook:** chorus fruit (popped chorus fruit is inedible anyway, must be smelted in a regular furnace), ores, wood, sand, or any non-food.
- Use a smoker only when you have a stack of food to cook. A regular furnace is more versatile.

---

### Raw Ores: Drop Behavior (Critical)

In 1.21.1, mining iron, gold, or copper ore with a non-Silk-Touch pickaxe drops the **raw material**, not the ore block:
- Iron ore → `raw_iron` (must smelt to get iron ingots)
- Gold ore → `raw_gold` (must smelt to get gold ingots)
- Copper ore → `raw_copper` (must smelt to get copper ingots)

**These ores do NOT drop the gem/ingot directly.** You always need a smelting step.

By contrast, these ores drop their product directly without smelting:
- Coal ore → coal
- Diamond ore → diamond
- Lapis lazuli ore → lapis lazuli
- Redstone ore → redstone dust
- Emerald ore → emerald
- Nether quartz ore → quartz

If you want the ore block itself (for decoration or XP farming), use Silk Touch. Silk Touch on iron/gold/copper ore gives you the ore block, which you can smelt later for the same output.

---

### Fortune Enchantment

Fortune multiplies drops from applicable blocks. Key distinctions:

**Fortune DOES multiply:**
- Diamond ore, emerald ore, lapis lazuli ore, coal ore, redstone ore (drop quantity increases)
- Nether gold ore, nether quartz ore, amethyst clusters
- Glowstone (dust), melon (slices), sea lanterns (prismarine crystals), nether wart, sweet berry bushes

**Fortune on iron/gold/copper ores:** Fortune DOES apply to raw iron, raw gold, and raw copper drops. Each Fortune level can add additional raw material drops (up to 4 with Fortune III). This is a common misconception — Fortune IS useful on these ores.

**Fortune increases probability (not quantity) for:**
- Gravel → flint (10% base, 16% at I, 25% at II, 100% at III)
- Leaves → saplings, sticks, apples
- Gilded blackstone → gold nuggets
- Vines

**Fortune does NOT affect:**
- Crops (wheat, carrots, potatoes, beetroot) — these use a different binomial distribution, not simple multiplication
- Any block that doesn't have a special Fortune interaction

---

### Silk Touch Enchantment

- Causes mined blocks to drop themselves instead of their normal drops.
- **Incompatible with Fortune.** Cannot be applied to the same tool. If both exist via commands, Silk Touch takes precedence.
- Cannot be applied to swords or fishing rods.
- Useful for: moving ore veins intact, collecting grass blocks, harvesting spawners (no, see below), getting ice/packed ice, moving bookshelves.
- **Cannot obtain with Silk Touch:** Monster spawners (they break and drop nothing), budding amethyst, cake, end portal frames, or active crops/stems.
- Bee nests with Silk Touch retain their bees (up to 3). Mining without Silk Touch destroys the bees.
- Infested blocks (silverfish blocks) mined with Silk Touch drop the normal block version and do NOT spawn silverfish.

---

### Tool Durability Values (Java Edition)

| Material | Durability | Mining level |
|---|---|---|
| Wood | 59 | Mines stone tier |
| Stone | 131 | Mines iron tier |
| Iron | 250 | Mines diamond/gold tier |
| Gold | 32 | Mines stone tier only (cannot mine iron ore!) |
| Diamond | 1561 | Mines obsidian tier |
| Netherite | 2031 | Mines all |

**Gold tools are a trap.** Gold pickaxes are fast but have only 32 durability and cannot mine iron ore or anything harder than stone. Gold is useful for speed-mining stone in specific situations only.

Each use of a tool costs 1 durability. Mining the wrong material (wood pickaxe on iron ore) still costs durability but drops nothing.

**Mining level requirement — critical:**
- Wood/Gold pickaxe: can mine stone, coal ore, deepslate — NOT iron ore
- Stone pickaxe: can mine iron ore, lapis, emerald — NOT gold ore or diamond
- Iron pickaxe: can mine gold ore, diamond ore, redstone ore — NOT obsidian
- Diamond/Netherite: can mine obsidian and ancient debris

Using the wrong tier pickaxe on an ore wastes durability and drops nothing.

---

### Tool Repair

**Crafting grid repair (no anvil needed):** Combine two damaged tools of the same type and material in any crafting grid. Durability merges (sum of both + 5% of max). This strips all enchantments and prior work penalties. Only use this for unenchanted tools.

**Anvil repair — material method:** Place the tool in the left slot and the repair material in the right slot. Each unit of material restores 25% of max durability (rounded down) and costs 1 level per unit. Materials:
- Wooden tools: any plank
- Stone tools: cobblestone
- Iron tools/armor: iron ingot
- Gold tools/armor: gold ingot
- Diamond tools/armor: diamond
- Netherite tools/armor: netherite ingot (must upgrade to netherite first via smithing table)

**Anvil repair — tool + tool:** Combine two identical damaged tools. Durabilities add with a 12% bonus. Enchantments merge (higher level wins, same levels combine to next tier if possible).

**Prior work penalty:** Every anvil operation adds a prior work penalty that roughly doubles with each use. Once repair cost exceeds 39 levels, the anvil shows "Too Expensive!" and refuses the operation. There is no way to reset this on an item once it hits the cap (except grindstone, which removes enchantments and penalties but also strips enchantments).

---

### Mending Enchantment

- XP orbs collected while holding (or wearing) a Mending-enchanted item repair it at a rate of **2 durability per 1 XP point**.
- XP used for repair does NOT go toward your level bar.
- If multiple Mending items are equipped and damaged, one is selected randomly per orb collected.
- Fully repaired items are excluded from selection — damaged items always get priority over fully repaired ones.
- Leftover XP after repair adds to your level normally.
- Incompatible with Infinity on bows.
- A Mending fishing rod effectively has infinite durability because fishing generates XP.

---

### Anvil: Key Rules

- Level cost cap is **39 levels** in Survival. Above 39: "Too Expensive!" — operation blocked.
- Prior work penalty accumulates per operation: starts at 0, increases by 2^n + 1 per operation.
- Renaming an item costs 1 level and does NOT add prior work penalty.
- Grindstone removes prior work penalty but also strips all non-curse enchantments.
- Crafting grid repair resets prior work penalty and strips enchantments.
- "Too Expensive" is permanent on an item — plan anvil use carefully.

---

### Grindstone

- Combines two tools of the same type: durabilities add (sum + 5% max bonus), prior work penalty removed.
- Disenchants a single item: removes all non-curse enchantments, returns some XP (50–100% of enchantment value).
- **Cannot remove curse enchantments** (Curse of Binding, Curse of Vanishing). Curses are permanent.
- Cannot remove custom names.
- After grindstoning, the item can be re-enchanted at an enchanting table or anvil without prior work cost.

---

### Smithing Table: Netherite Upgrade

To upgrade diamond equipment to netherite:
1. Obtain a **Netherite Upgrade Smithing Template** (found in bastion remnants — 100% chance in treasure chests, ~10% in other bastion chests).
2. At the smithing table: template + diamond tool/armor + netherite ingot = netherite version.
3. **No XP cost.** Enchantments, durability state, trims, and custom names are all preserved.
4. The template is consumed. Duplicate it: existing template + 4 diamonds + 1 netherrack = 2 templates.

Netherite ingot recipe: 4 netherite scraps + 4 gold ingots (shapeless).
Netherite scrap: smelt 1 ancient debris → 1 netherite scrap. Need 4 ancient debris per ingot.

**Ancient debris facts:**
- Found only in the Nether, peak concentration at Y=16 (range Y=8 to Y=24).
- Blast resistance 1,200 — survives TNT and bed explosions (common mining method).
- In item form: floats on lava and is immune to fire. Cannot lose it to lava.

---

### Shears

Craft with 2 iron ingots (diagonal in crafting grid). Durability: 238 uses.

**Required for (cannot obtain item any other way without shears):**
- Wool from sheep (sword kills the sheep without dropping wool; only shears give wool while the sheep lives)
- Cobwebs (mining without shears destroys them; drop string with sword, drop cobweb with shears)
- Leaves (drop themselves only with shears; axe/hand drops nothing or saplings only)
- Tripwire (without triggering it)
- Vines (must use shears to collect vine item)
- Glow lichen

**Shears on mobs:**
- Sheep: removes wool coat, yields 1–3 wool, sheep regrows wool over time
- Mooshroom: harvests 5 mushrooms and converts to normal cow (irreversible)
- Snow golem: removes pumpkin head, revealing face (also irreversible)
- Beehive/bee nest: harvests 3 honeycombs when at honey level 5

**Cannot be smelted** into iron nuggets despite being made of iron.

---

### Flint and Steel

Recipe: 1 iron ingot + 1 flint (shapeless, 2×2 or 3×3 grid). Durability: 64 uses.

Flint comes from gravel: 10% base drop chance, 16%/25%/100% with Fortune I/II/III. Silk Touch on gravel suppresses flint — always use Fortune or bare hand to maximize flint yield from gravel.

**Uses:**
- Place fire on any solid top surface or against a flammable block
- Activate an obsidian nether portal frame (fire placed inside the frame)
- Light campfires and candles
- Ignite TNT (counts as player damage)
- Force-detonate creepers (player use only — dispensers cannot detonate creepers this way)

**Cannot** activate end portals (those require eye of ender in each frame slot).

Fire charge (blaze powder + coal + gunpowder) is the dispensable alternative for portal activation and TNT.

---

### Fishing

Cast a fishing rod into a water source block. Wait for the bobber to show bubble particles trailing toward it and then **dip below the surface** — that is the catch signal. Reel in within **1–2 seconds** (Java) or the fish escapes.

Wait time per catch: **5–30 seconds** base, reduced by:
- Lure enchantment: −5 seconds per level
- Rain: −20% wait time
- Open water (5×4×5 area of only water/air): required for treasure loot

**Loot categories:**
- 85% fish (cod, salmon, pufferfish, tropical fish)
- 10% junk (bones, bowls, leather, sticks, string, water bottles, etc.)
- 5% treasure (enchanted books, bows, fishing rods, name tags, nautilus shells, saddles) — treasure only drops in open water

Luck of the Sea enchantment shifts percentages toward treasure at the expense of fish and junk.

Reeling in entities costs 5 durability; reeling in dropped items costs 3 durability. A Mending rod regenerates this while fishing — effectively infinite.

---

### Bone Meal

Recipe: 1 bone → 3 bone meal (crafting, any grid). Or: 1 bone block → 9 bone meal.

Also obtained from composters (see below) and fish mob kills (5% drop chance).

**Works on (instant growth or growth boost):**
- All crops: wheat, carrots, potatoes, beetroot, melon stems, pumpkin stems
- Saplings (instant tree growth)
- Grass blocks (spawns tall grass and flowers)
- Mushrooms on mycelium or podzol (grows into large mushroom)
- Sugar cane (advances growth stages, not instant full height)
- Bamboo (advances growth)
- Kelp, sea grass, coral
- Flowers, sweet berry bushes, cave vines

**Does NOT work on:**
- Nether wart (cannot be accelerated by any means)
- Cactus (cannot be accelerated)
- Chorus plants
- Vines (natural growth only)
- Crops already at maximum growth stage (wasted)

Always check growth stage before applying bone meal — applying to a mature crop is wasteful.

---

### Composter

Craft: 7 wooden slabs in a U shape (3×3 crafting table).

Drop plant items into the composter. Each item has a chance to raise the fill level by 1 (out of 7). When the composter reaches level 7 it produces 1 bone meal on the next interaction.

**Fill probabilities:**
- 30%: seeds (wheat, pumpkin, melon, beetroot, etc.), saplings, dried kelp, leaves
- 50%: cactus, melon slice, vines, glow lichen
- 65%: apples, carrots, potatoes, flowers, melons, baked potatoes
- 85%: bread, cookies, hay bales, cake slices
- 100%: cake (whole), pumpkin pie

**Cannot be composted:** bamboo, dead bushes, poisonous potatoes, meat, fish, bone items, golden food items, chorus plants.

Average items needed per bone meal: ~21 seeds/saplings, ~10 apples/carrots, ~8 bread/hay bales.

---

### Bucket

Recipe: 3 iron ingots in a V shape (3×3 crafting table required).

**Fluids that can be collected:**
- Water source blocks
- Lava source blocks
- Powder snow

**Note:** Buckets collect **source blocks only**, not flowing water or lava. Always verify you are clicking the source block, not a flow block.

**Milk:** Right-click a cow, mooshroom, or goat with an empty bucket. Milk bucket cannot be emptied by placing — it can only be drunk (removes all status effects) or used to craft cake. Milk is the universal counter to negative potion effects, blindness, wither, etc.

**Lava bucket:** After fuel is consumed in a furnace, the empty bucket remains in the fuel slot. Retrieve it. Lava buckets stack to 1 (unlike water buckets which stack to 16).

**Mob buckets:** Right-click cod, salmon, tropical fish, pufferfish, axolotl, or tadpole with an empty bucket to collect them in a water bucket. Release by placing the bucket.

**Filled buckets do not stack** (except empty buckets stack to 16). Keep your inventory organized.

---

### Compass

Recipe: 4 iron ingots in a cross + 1 redstone dust in center (3×3 crafting table).

**Points to world spawn (the /setworldspawn point), NOT your bed spawn.** Do not use compass to find your bed. A compass is useless for finding your respawn point unless it happens to be world spawn.

Compass spins randomly in the Nether and The End — no valid target in those dimensions.

**Lodestone compass:** Use a regular compass on a lodestone block to bind it to that location. Will point to the lodestone from any dimension. Spins if the lodestone is destroyed. Reconnect manually by using the compass on a new lodestone.

---

### Clock

Recipe: 4 gold ingots in a cross + 1 redstone dust in center (3×3 crafting table).

Shows current in-game time of day anywhere: in your hand, in inventory, in an item frame, or even as a dropped item. Works without being held — just having it visible is enough.

**Does not work in the Nether or The End** — spins randomly because those dimensions have no day/night cycle.

Useful for timing crop growth, avoiding hostile spawns, and knowing when to sleep.

---

### Name Tags

Not craftable in vanilla 1.21.1. Obtain from:
- Mineshafts (42.3% chance)
- Monster rooms/dungeons (25.3%)
- Woodland mansions (28.3%)
- Ancient cities (16.1%)
- Fishing (0.8% treasure chance, requires open water)
- Wandering trader (upcoming only)

**Application:** Place the name tag in an anvil's left slot, type the name, take the renamed tag. Costs exactly 1 XP level. A stack of up to 64 tags can all be renamed for the same 1-level cost.

Apply the renamed tag to any mob by right-clicking it. **Named mobs do not despawn** and do not count toward the mob cap.

**Exceptions:** Wandering traders despawn regardless of naming. Players cannot be named. Ender dragons cannot be named.

**Easter eggs:** "Dinnerbone" or "Grumm" renders the mob upside-down. "jeb_" on a sheep creates a rainbow wool cycle. "Toast" on a rabbit shows a memorial texture. "Johnny" on a vindicator makes it attack all mobs.

Cannot remove a name from a mob without commands.

---

### Leads

**Recipe in 1.21.1:** 4 string + 1 slime ball → 2 leads (shapeless, crafting table required).

Note: As of Java Edition 1.21.6 the recipe changed to 5 string → 2 leads, but in **1.21.1 you still need a slime ball**. Slime balls drop from slimes (found in swamps at night and below Y=40 in slime chunks).

**Attach to mob:** Right-click a leashable mob with a lead in hand.

**Tie to fence:** Right-click any fence post while holding a leashed mob lead. The mob is tethered to the fence with a maximum leash range of ~5 blocks from the post.

**Leashable mobs:** Most passive mobs (cows, sheep, pigs, horses, donkeys, llamas, cats, dogs, chickens, rabbits, foxes, bees, axolotls, dolphins, frogs, camels, allays, etc.). Also iron golems and boats.

**Cannot leash:** Villagers, wandering traders, hostile mobs (generally), fish mobs. Wolves cannot be leashed while hostile.

Maximum stretch before breaking: 12 blocks (16 for happy ghasts). Leads snap when you use elytra + firework rockets.

---

### Dyes

16 dye colors. Sources:

| Dye | Source |
|---|---|
| White | Bone meal, Lily of the Valley |
| Orange | Red + Yellow dye, Orange Tulip |
| Magenta | Multiple: Purple+Pink, Allium, Lilac, etc. |
| Light Blue | Blue + White, Blue Orchid |
| Yellow | Dandelion, Sunflower, Wildflowers |
| Lime | Green + White, smelt Sea Pickle |
| Pink | Red + White, Pink Tulip, Peony |
| Gray | Black + White, Closed Eyeblossom |
| Light Gray | Gray + White, or Azure Bluet/Oxeye Daisy/White Tulip |
| Cyan | Blue + Green, Pitcher Plant |
| Purple | Blue + Red |
| Blue | Lapis lazuli, Cornflower |
| Brown | Cocoa beans (found in jungle trees) |
| Green | Smelt cactus in furnace |
| Red | Poppy, Red Tulip, Rose Bush, Beetroot |
| Black | Ink sac (squid drop), Wither Rose |

**Dyeable items:** wool, carpets, terracotta, concrete powder, glass and glass panes, shulker boxes, beds, candles, banners, firework stars, signs (text color), and leather armor (Java: crafting or cauldron; Bedrock: cauldron).

**Concrete powder** (8 sand + 8 gravel + 1 dye) hardens to concrete when it touches water. Cannot dye concrete after it hardens.

Green dye requires a furnace (cactus + fuel). Do not try to make green dye from a plant in the crafting grid — it does not work.

---

### Stonecutter

Recipe: 1 iron ingot + 3 stone blocks (in a row, 3×3 grid). Accepts stone, granite, diorite, andesite, deepslate, sandstone, tuff, bricks, and their variants as input.

**Efficiency vs. crafting table:**
- Stairs: stonecutter gives 1 stair per 1 block. Crafting table gives 4 stairs per 6 blocks (waste of 2 blocks). Always use stonecutter for stairs.
- Slabs: stonecutter gives 2 slabs per 1 block. Crafting table gives 6 slabs per 3 blocks (identical ratio — no difference here).
- Chiseled/polished variants: stonecutter can skip intermediate steps (e.g., stone → chiseled stone bricks directly, without making regular bricks first).
- Cut copper: 1 copper block → 4 cut copper (effectively quadruples the block).

Only one ingredient per recipe. Cannot process wood, metal, or non-stone materials.

---

### Enchanting Table

Recipe: 4 obsidian + 2 diamonds + 1 book (book in center top, diamonds on sides, obsidian filling bottom and corners) — 3×3 crafting table.

**Bookshelves for max level:** Place exactly **15 bookshelves** within 2 blocks of the enchanting table (1 block of air gap between bookshelf and table). Each bookshelf must have clear air on the side facing the table — torches, chests, or any solid block in that gap breaks the connection.

With 15 bookshelves: level 30 enchantments are available. With fewer bookshelves, the maximum offered level scales down proportionally.

**Cost structure:** You need X levels to see a level-X option, but you only pay 1–3 levels and 1–3 lapis lazuli. The level 30 option costs 3 levels and 3 lapis — not 30 levels. Having 30 levels is the requirement to unlock the option, not the cost.

Enchantments offered are random. Re-roll by enchanting a book or cheap item (fishing rod, pick) with a low-cost option to cycle the table's seed.

---

### Lectern

Recipe: any 3 wooden slabs on top row + 1 bookshelf below center (3×3 crafting table).

Place a written book or book and quill on it by right-clicking while holding the book. Only written/unfinished books work — not enchanted books, not regular books.

Generates a 2-tick redstone pulse when a page is turned. A comparator next to the lectern outputs a signal proportional to reading progress (1–15 based on current page / total pages).

Librarian villagers use lecterns as their job site block.

---

### Brewing Stand

Recipe: 1 blaze rod (bottom center) + 3 cobblestone (bottom row) — 3×3 crafting table. Also accepts blackstone or cobbled deepslate instead of cobblestone.

**Fuel:** Blaze powder (1 powder = 20 brewing operations). Fuel is consumed only when actively brewing — no waste when idle.

**Brewing order:**
1. Fill glass bottles with water (right-click water source or cauldron).
2. Place up to 3 water bottles in the bottom 3 slots of the brewing stand.
3. Add blaze powder to the fuel slot (top-left).
4. Add ingredient to the ingredient slot (top center).
5. Wait 20 seconds (400 ticks).

**Base potion chain:** Water bottle + nether wart → **Awkward Potion** (no effect). This is the required base for almost all useful potions.

**Potion from awkward potion + ingredient:**
| Ingredient | Effect |
|---|---|
| Glistering melon slice | Instant Health |
| Magma cream | Fire Resistance (3:00) |
| Golden carrot | Night Vision (3:00) |
| Ghast tear | Regeneration (0:45) |
| Blaze powder | Strength (3:00) |
| Sugar | Speed (3:00) |
| Rabbit's foot | Jump Boost (3:00) |
| Pufferfish | Water Breathing (3:00) |
| Spider eye | Poison (0:45) |
| Phantom membrane | Slow Falling (1:30) |

**Special case — Weakness:** Fermented spider eye + water bottle (no nether wart, no awkward potion). The ONLY potion brewed without nether wart. Used to cure zombie villagers (weakness + golden apple).

**Modifiers:**
- Redstone dust: extends duration (cannot combine with glowstone on timed potions)
- Glowstone dust: increases potency/level
- Fermented spider eye: inverts or corrupts the effect (Healing → Harming, Speed → Slowness, Night Vision → Blindness, etc.)
- Gunpowder: converts to splash potion
- Dragon's breath: converts splash to lingering potion (duration reduced to 1/4)

---

### Netherite Crafting Chain (Full)

1. Mine ancient debris in the Nether (Y=8–24, peak at Y=16).
2. Smelt ancient debris in any furnace: 1 ancient debris → 1 netherite scrap.
3. Craft netherite ingot: 4 netherite scraps + 4 gold ingots (shapeless).
4. At smithing table: Netherite Upgrade template + diamond gear + netherite ingot → netherite gear.

Need 4 ancient debris per netherite ingot. Need 1 ingot per gear piece.

Ancient debris in item form floats on lava and cannot be burned — safe to mine near lava flows.

---

### Nether Portal

Minimum frame: 4 wide × 5 tall (interior 2×3 opening), all obsidian. Corner blocks optional but included in game-generated portals.

Activate by placing fire anywhere inside the obsidian frame using flint and steel, fire charge, or natural fire spread. The fire is consumed and replaced by portal blocks instantly.

Portal activation rules:
- Frame must be complete before activating. Fire on an incomplete frame does nothing and will not activate when the last block is placed.
- Cannot be activated in The End.
- Teleportation takes 4 seconds in Survival (standing in the portal), 1 tick in Creative.

Obsidian requires a diamond or netherite pickaxe. Mining time: ~9.4 seconds with diamond pick, ~8.35 with netherite.

---

### Monster Spawner

- Activates only when a player is within **16 blocks**.
- Spawning attempts occur every 10–40 seconds. Each attempt tries to place 4 mobs.
- Spawns fail if 6+ mobs of the spawner's type are already within a 9×9×9 area centered on the spawner.
- Spawns also fail if the target location has light level above the hostile mob threshold (light level 0 for most; 12 for blazes and silverfish).
- **Cannot be obtained with Silk Touch.** Spawners cannot be moved in Survival by any means. Mining a spawner destroys it — it drops nothing except XP.
- Pistons cannot push spawners.
- To disable a spawner: flood the room with light (torches, lanterns, glowstone) to reach light level 12+ everywhere mobs can spawn.

---

### Flint: Acquisition Rules

Mine gravel to get flint. Base drop rate: **10%** (1 in 10 gravel blocks).

Fortune on the mining tool dramatically increases flint yield:
- Fortune I: 16%
- Fortune II: 25%
- Fortune III: 100% (every gravel block drops flint)

**Silk Touch suppresses flint drops entirely** — gravel mined with Silk Touch drops the gravel block, never flint. Never use Silk Touch to farm flint.

Gravel falling onto a non-solid block (falling gravel landing on a torch) also does not drop flint.

Beyond flint and steel, flint is used in: arrows (flint + stick + feather = 4 arrows), and fletching tables (2 flint + 4 planks).

---

### Arrows

Recipe: 1 flint + 1 stick + 1 feather → 4 arrows (crafting table, vertical column).

Fletchers trade arrows for emeralds. Skeletons drop arrows when killed. Gravel → flint farming is the most scalable arrow production method early-game.

Spectral arrows and tipped arrows require additional materials (glowstone dust or lingering potions respectively).

---

### Map

Recipe: 8 paper + 1 compass arranged around the compass (crafting table) → empty locator map (shows player position).

**A map must be held in hand and used (right-click) to begin recording terrain.** An empty map in your inventory does not fill itself. Hold it and explore to fill it.

**Expanding a map:** Use a cartography table: map + 8 paper → larger map (1 zoom level up). Repeat up to 4 times (zoom levels 0–4: 128×128 up to 2048×2048 blocks).

**Copying:** Cartography table: map + empty map → 2 identical copies. Copies stay synchronized as you explore.

A compass in the Nether spins randomly. A map in the Nether records terrain but is extremely disorienting due to scale.

---

### Enchantment Incompatibilities (Key Pairs)

- Fortune ↔ Silk Touch: mutually exclusive on the same tool
- Mending ↔ Infinity (bows): mutually exclusive
- Sharpness ↔ Smite ↔ Bane of Arthropods: only one per sword/axe
- Depth Strider ↔ Frost Walker: mutually exclusive on boots
- Protection ↔ Blast Protection ↔ Fire Protection ↔ Projectile Protection: only one per armor piece

Attempting to combine incompatible enchantments via anvil fails — the second enchantment is lost.

---

### Smelting: What Requires a Regular Furnace (Not Blast or Smoker)

Only the regular furnace handles these:
- Sand / red sand → glass / red glass
- Cobblestone → stone
- Stone → smooth stone
- Clay ball → brick
- Clay block → terracotta
- Terracotta → glazed terracotta (must be dyed first)
- Netherrack → nether brick
- Logs/wood → charcoal
- Cactus → green dye
- Sea pickle → lime dye
- Chorus fruit → popped chorus fruit (inedible; used for purpur blocks and end rods)
- Wet sponge → dry sponge
- Kelp → dried kelp (food, also a fuel block when crafted into dried kelp block)

Blast furnace and smoker will not accept any of these items.
