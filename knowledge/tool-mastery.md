# Tool Mastery — HermesCraft Agent Command Reference

Authoritative guide to every !command this agent can execute. All command names, argument keys,
block names, and item names are grounded in the MC 1.21.1 registry and the actual skill
implementations in `body/skills/`. Do not invent arguments or item names not shown here.

---

## Resource Gathering Patterns

### Using !gather for Surface Materials

`!gather` finds blocks within 64 blocks, navigates to them, and digs them. Use it for anything
reachable on the surface or in open terrain — trees, dirt, sand, gravel, clay.

Exact syntax: `!gather item:NAME count:N`

Common surface gathers:
- `!gather item:oak_log count:10` — chop oak trees (also works with spruce_log, birch_log, jungle_log, acacia_log, dark_oak_log)
- `!gather item:stone count:16` — gather stone (drops cobblestone; normalizer maps "cobblestone" to "stone" automatically)
- `!gather item:dirt count:8`
- `!gather item:sand count:16` — for glass production
- `!gather item:gravel count:4` — drops gravel (also chance of flint)
- `!gather item:clay count:4`
- `!gather item:grass_block count:4`
- `!gather item:wool count:4` — requires shearing nearby sheep

The item name is the BLOCK name, not the drop name. `!gather item:stone` yields cobblestone.
If no blocks of that type exist within 64 blocks, the skill returns collected < requested.

### Using !mine for Underground Ores

`!mine` enforces correct tool tier before digging. If the held tool cannot harvest the ore,
it returns `reason: no_suitable_tool` immediately — it will NOT waste time attempting.

Exact syntax: `!mine item:NAME count:N`

Ore block names and their drops:
- `!mine item:coal_ore count:8` — drops coal (wooden pickaxe or better)
- `!mine item:iron_ore count:8` — drops raw_iron (stone pickaxe or better)
- `!mine item:copper_ore count:4` — drops raw_copper (stone pickaxe or better)
- `!mine item:gold_ore count:4` — drops raw_gold (iron pickaxe or better)
- `!mine item:diamond_ore count:4` — drops diamond (iron pickaxe or better)
- `!mine item:redstone_ore count:4` — drops redstone (iron pickaxe or better)
- `!mine item:lapis_ore count:2` — drops lapis_lazuli (iron pickaxe or better)
- `!mine item:emerald_ore count:1` — drops emerald (iron pickaxe or better)
- `!mine item:ancient_debris count:1` — drops ancient_debris (diamond pickaxe required, Nether only)

The normalizer also accepts: `!mine item:stone` (finds stone blocks underground), and maps
"cobblestone" → stone and "raw_iron" → iron_ore automatically.

### Surface vs Underground Strategy

Surface gather (`!gather`): use when blocks appear in the loaded world above ground. Scan first
with `!scan` to confirm block types present. Max search radius is 64 blocks.

Underground mine (`!mine`): use when targeting ores below the surface. The skill finds ore blocks
within 64 blocks of the bot's current position. If the bot is standing at surface level, it will
only find exposed surface ores or shallow cave ore. Navigate underground first for best results:
- Coal and iron: y=0 to y=60 (common across all elevations)
- Gold: y=-64 to y=32 (peaks around y=-16)
- Diamond: y=-64 to y=15 (peaks around y=-58)
- Ancient debris: y=8 to y=22 in the Nether

### Batch Quantities for Common Projects

For a minimal survival setup (wooden tools → stone tools):
- `!gather item:oak_log count:8` — 8 logs yields 32 planks, enough for crafting table + tools
- `!mine item:stone count:24` — for stone tools, furnace (8 cobblestone), and building

For iron tools + basic armor:
- `!mine item:iron_ore count:24` — 24 raw_iron → 24 iron_ingot; 3 per pickaxe/sword, 24 for full armor set
- `!mine item:coal_ore count:8` — fuel for smelting

For a small cabin build (small_cabin blueprint — 5x7x5):
- `!gather item:oak_log count:20` → craft oak_planks (80 planks)
- Need: oak_planks (walls/floor), oak_log (pillars), glass_pane (windows), oak_door, oak_slab (roof)

---

## Crafting Chains (Tool Sequences)

### Craft Command Syntax

`!craft item:NAME count:N`

The crafter resolves the full dependency chain automatically. Crafting `wooden_pickaxe` will
also craft the required sticks and planks if they are missing but the raw materials are present.
It will find or place a crafting table automatically when a 3x3 recipe is needed.

### Wood Tier — First Session Essentials

Start here every new session before anything else:
1. `!gather item:oak_log count:4`
2. `!craft item:oak_planks count:16` — 4 logs → 16 planks (2x2, no table)
3. `!craft item:crafting_table` — 4 planks → crafting table (2x2, no table)
4. `!craft item:stick count:8` — 2 planks → 4 sticks (2x2)
5. `!craft item:wooden_pickaxe` — 3 planks + 2 sticks → pickaxe (3x3, needs table)
6. `!craft item:wooden_axe` — 3 planks + 2 sticks → axe
7. `!craft item:wooden_sword` — 2 planks + 1 stick → sword
8. `!craft item:wooden_shovel` — 1 plank + 2 sticks → shovel
9. `!craft item:wooden_hoe` — 2 planks + 2 sticks → hoe (needed for !farm)

Shorthand: `!craft item:wooden_pickaxe` resolves the full chain if you have oak_log in inventory.

### Stone Tier

Requires wooden_pickaxe (or better) to mine stone. Stone drops cobblestone.
1. `!mine item:stone count:18` — get cobblestone
2. `!craft item:stone_pickaxe` — 3 cobblestone + 2 sticks
3. `!craft item:stone_sword` — 2 cobblestone + 1 stick
4. `!craft item:stone_axe` — 3 cobblestone + 2 sticks
5. `!craft item:stone_shovel` — 1 cobblestone + 2 sticks
6. `!craft item:furnace` — 8 cobblestone (needed for !smelt)

### Iron Tier

Requires stone_pickaxe (or better). Iron_ore drops raw_iron which must be smelted.
1. `!mine item:iron_ore count:8`
2. `!mine item:coal_ore count:4` — fuel
3. `!smelt item:raw_iron fuel:coal count:8` — produces 8 iron_ingot
4. `!craft item:iron_pickaxe` — 3 iron_ingot + 2 sticks
5. `!craft item:iron_sword` — 2 iron_ingot + 1 stick
6. `!craft item:iron_axe` — 3 iron_ingot + 2 sticks
7. `!craft item:iron_shovel` — 1 iron_ingot + 2 sticks
8. `!craft item:iron_hoe` — 2 iron_ingot + 2 sticks
9. `!craft item:iron_helmet` — 5 iron_ingot
10. `!craft item:iron_chestplate` — 8 iron_ingot
11. `!craft item:iron_leggings` — 7 iron_ingot
12. `!craft item:iron_boots` — 4 iron_ingot

Full iron armor set: 24 iron_ingot total. Iron pickaxe: 3 ingots.

### Diamond Tier

Requires iron_pickaxe. Diamond_ore drops diamond directly.
1. `!mine item:diamond_ore count:8` — navigate to y=-58 area first
2. `!craft item:diamond_pickaxe` — 3 diamonds + 2 sticks
3. `!craft item:diamond_sword` — 2 diamonds + 1 stick
4. `!craft item:diamond_helmet` — 5 diamonds (etc. for full set)

Full diamond armor: 24 diamonds. Diamond pickaxe: 3 diamonds.

### Smelt Command Syntax

`!smelt item:INPUT fuel:FUEL count:N`

The skill finds the nearest furnace, blast_furnace, or smoker within 32 blocks. Must have a
furnace placed nearby before calling. Default fuel is coal.

Common smelt operations:
- `!smelt item:raw_iron fuel:coal count:8` → 8 iron_ingot
- `!smelt item:raw_gold fuel:coal count:4` → 4 gold_ingot
- `!smelt item:raw_copper fuel:coal count:4` → 4 copper_ingot
- `!smelt item:sand fuel:coal count:16` → 16 glass (for windows)
- `!smelt item:cobblestone fuel:coal count:8` → 8 stone (for stone_bricks recipe)
- `!smelt item:stone fuel:coal count:4` → smooth_stone
- `!smelt item:oak_log fuel:oak_log count:4` → charcoal (when no coal available)
- `!smelt item:porkchop fuel:coal count:4` → cooked_porkchop (smoker works faster)
- `!smelt item:beef fuel:coal count:4` → cooked_beef
- `!smelt item:chicken fuel:coal count:4` → cooked_chicken

Coal smelts 8 items per piece. `!smelt` auto-calculates fuel needed.

### Building Material Chains

Stone bricks (premium wall material):
1. `!mine item:stone count:4` — get cobblestone
2. `!smelt item:cobblestone fuel:coal count:4` → stone
3. `!craft item:stone_bricks count:1` — 4 stone → 4 stone_bricks

Glass panes (windows):
1. `!gather item:sand count:6`
2. `!smelt item:sand fuel:coal count:6` → 6 glass
3. `!craft item:glass_pane count:16` — 6 glass → 16 glass_pane

Torches (lighting, prevents mob spawning):
- `!craft item:torch count:4` — 1 coal + 1 stick → 4 torches

Bed (skip night):
- `!craft item:white_bed` — 3 wool + 3 planks (any color wool works)

Doors:
- `!craft item:oak_door count:3` — 6 oak_planks → 3 oak_doors

Food chain (bread):
1. `!gather item:wheat_seeds count:4` — break tall grass or wheat crops
2. `!craft item:wooden_hoe` (if not already have)
3. `!farm seed:wheat_seeds count:4` — till and plant; wait for crops to grow
4. `!gather item:wheat count:9`
5. `!craft item:bread count:3` — 3 wheat → 1 bread

Food chain (cooked meat):
1. `!breed animal:cow` (or pig/chicken/sheep) to grow the population
2. Kill animals to get raw meat (no direct kill command — use !combat on neutral mobs? Use the world naturally)
3. `!smelt item:beef fuel:coal count:4` → cooked_beef

---

## Building Workflows

### How !build Works

`!build blueprint:NAME x:N y:N z:N`

Loads the named blueprint JSON from `body/blueprints/`, resolves materials (uses first preferred
block found in inventory, falls back to first preferred block name), then places blocks bottom-up.

If the bot runs out of a material mid-build, the skill pauses and returns `reason: missing_material`
with a `missing` list. The build state is saved to disk. Calling `!build blueprint:NAME x:N y:N z:N`
again with the SAME coordinates resumes automatically from where it left off — do NOT use different
coordinates to resume, or it starts fresh.

A build is only complete when skill result shows `placed: X/X` matching total. "missing_material"
or "paused" means gather more and call !build again at the SAME coordinates.

The site must be mostly clear (less than 50% solid blocks in the footprint) or build returns
`reason: site_blocked`.

### Available Blueprints

These are the blueprints that exist in `body/blueprints/`:

| Blueprint name | Description | Footprint | Height |
|---|---|---|---|
| `shelter` | Minimal emergency survival shelter, cobblestone walls + door + slab roof | 3x3 | 3 |
| `small_cabin` | Wooden cabin with door, windows, and flat roof | 5x7 | 5 |
| `storage_shed` | Compact enclosed storage room, log corners + plank walls + door | 4x4 | 4 |
| `watchtower` | Stone tower, open observation platform on top | 5x5 | 8 |
| `animal_pen` | Fenced animal pen with gate on one side | 7x7 | 2 |
| `crop_farm` | 9x9 crop farm with water channel down the center | 9x9 | 2 |
| `dock` | Wooden dock extending outward with fence railings | 3x8 | 2 |
| `bridge` | Bridge spanning a gap | (check blueprint) | varies |
| `garden` | Decorative garden | (check blueprint) | varies |
| `lookout_platform` | Elevated lookout | (check blueprint) | varies |
| `staircase` | Staircase structure | (check blueprint) | varies |
| `windmill` | Windmill structure | (check blueprint) | varies |

Material requirements (approximate) per blueprint:
- `shelter`: ~12 cobblestone, 1 oak_door, 9 cobblestone_slab
- `small_cabin`: ~40 oak_planks, 8 oak_log, 6 glass_pane, 1 oak_door, 35 oak_slab
- `watchtower`: ~90 cobblestone, 20 oak_planks, 20 cobblestone_wall
- `animal_pen`: ~24 oak_fence, 1 oak_fence_gate
- `storage_shed`: ~24 oak_planks, 4 oak_log, 1 oak_door, 16 oak_slab

### Using !scan Before Building

`!scan` with no arguments scans a 16x8x16 box centered on the bot (8 blocks in each horizontal
direction, 4 blocks above and below).

Custom scan: `!scan x1:N y1:N z1:N x2:N y2:N z2:N`

Maximum scan volume is 32x32x32 = 32,768 blocks. The result lists all block types and counts
in the region. Use this to:
- Check terrain flatness before picking build coordinates
- Inventory what materials are already present (existing structures, resources)
- Confirm a build location is clear

Example scan before building: `!scan` → read the result → if mostly grass_block and air, pick
those coordinates for `!build`.

### Using !design for Custom Structures

`!design description:"your description here"`

This is handled by the Mind loop before dispatch. It triggers a separate LLM call to generate
a blueprint JSON, saves it, then builds it. Always prefer `!design` over `!build` for custom
city structures — `!build` is for blueprint catalog items.

Write DETAILED descriptions:
- Good: `!design description:"a 4-wide cobblestone road with oak_fence railings on both sides, 20 blocks long, running east-west"`
- Bad: `!design description:"a road"`

Design constraints enforced by the prompt: max 10x10 footprint, max 8 blocks tall, valid
MC 1.21.1 block names, layers in ascending y order.

### Changing Materials Mid-Build

`!material old:BLOCK_NAME new:BLOCK_NAME`

Remaps all remaining unplaced blocks in the active build from old material to new. Example:
- `!material old:oak_planks new:spruce_planks` — switch wood type mid-build
- `!material old:cobblestone new:stone_bricks` — upgrade wall material

Only works when a build is in progress (`_activeBuild` is set).

### Freeform Block Placement

There is no direct `!place` command. All block placement goes through `!build` (blueprints) or
`!design` (LLM-generated blueprints). For small freeform additions, design a custom blueprint:
`!design description:"a single cobblestone pillar 3 blocks tall at my current position"`

---

## Navigation and Exploration

### Navigating to Coordinates

`!navigate x:N y:N z:N`

Navigates to within 1 block of the given coordinates using mineflayer-pathfinder. Has a 30-second
wall-clock timeout per call. Returns `success: false, reason: nav_timeout` if unreachable.

The y coordinate must be a valid walkable surface. Use the bot's current y or scan the area to
find ground level. Common ground level range: y=60 to y=72 in normal terrain.

Examples:
- `!navigate x:100 y:64 z:200` — go to specific coordinates
- `!navigate x:0 y:64 z:0` — return toward world origin

### Exploration Strategy

No dedicated explore command exists. Systematic exploration:
1. `!scan` at current position to inventory the immediate area
2. `!navigate` to a new position 50-100 blocks away in unexplored direction
3. `!scan` again at new position
4. Repeat until desired terrain, resources, or structures are found

For finding biomes or structures: navigate in cardinal directions from known position, scanning
periodically. Structures (villages, temples, etc.) show up in scan results as unusual block
groupings (stone_bricks in a forest, sandstone in plains, etc.).

### Setting Home Base

`!sethome` — marks current position as home base (no arguments).

This is handled in the Mind loop directly. Use it once a base location is chosen. The location
is stored in the agent's locations memory and appears in future system prompts.

### Returning to Known Locations

Check the "Known locations" section in the system prompt for saved waypoints. Navigate using
the stored coordinates: `!navigate x:N y:N z:N`.

---

## Combat Workflows

### !combat Command

`!combat` — attacks the nearest hostile mob within 16 blocks. No arguments.

The skill auto-selects the nearest valid hostile entity. If no hostile mob is within 16 blocks,
returns `reason: no_hostile_nearby`.

Combat loop behavior:
- Closes distance to within 4 blocks using pathfinder GoalFollow
- Attacks at 600ms cooldown (~1.6 hits/second)
- Retreats automatically if health drops to 6 HP (3 hearts)
- Continues until mob is dead, bot retreats, or the command is interrupted by another !command

Hostile mobs recognized: zombie, skeleton, creeper, spider, cave_spider, enderman, blaze, witch,
pillager, vindicator, phantom, drowned, husk, stray, slime, magma_cube, ghast, wither_skeleton,
and all other entities with category "Hostile mobs" in MC 1.21.1 data.

### Gear Preparation Before Combat

Before entering caves, the Nether, or any dangerous area:
1. `!craft item:iron_sword` (or stone_sword minimum)
2. `!craft item:iron_chestplate` (highest protection per ingot)
3. `!craft item:iron_helmet`
4. `!craft item:torch count:16` — place frequently to prevent mob spawns
5. `!look target:inventory` — verify gear is actually in inventory

### Night Survival

At dusk (time > 12000), hostile mobs begin spawning outdoors.

Immediate response:
1. `!build blueprint:shelter x:N y:N z:N` — fastest shelter if nearby flat ground
2. OR `!navigate x:N y:N z:N` to return to home base
3. `!chat message:"heading inside, night coming"` — coordinate with teammates

If caught outdoors: `!combat` to kill approaching mobs, keep moving toward shelter.

Bed to skip night: `!craft item:white_bed` (needs 3 wool + 3 planks), then use it.

---

## Multi-Step Objectives

### Going Mining

Full sequence from surface to productive mine and back:
1. `!look target:inventory` — check current tools and food
2. `!craft item:stone_pickaxe` (minimum for iron) or `!craft item:iron_pickaxe` (for gold/diamond)
3. `!craft item:torch count:16` — essential for underground lighting
4. `!navigate x:N y:32 z:N` — descend to ore-rich elevation (adjust y for target ore)
5. `!mine item:coal_ore count:8` — get fuel first
6. `!mine item:iron_ore count:16` — bulk iron gather
7. `!navigate x:HOME y:HOME z:HOME` — return to base
8. `!smelt item:raw_iron fuel:coal count:16` — process ore
9. `!deposit item:iron_ingot count:16` — store surplus in chest

### Building a House

1. `!scan` — assess terrain at chosen location
2. `!chat message:"building a cabin at X,Y,Z"` — coordinate with teammates
3. Gather materials: `!gather item:oak_log count:20`, `!gather item:sand count:8`
4. Process: `!craft item:oak_planks count:80`, `!smelt item:sand fuel:coal count:8` → glass
5. Craft: `!craft item:glass_pane count:16`, `!craft item:oak_door count:1`, `!craft item:oak_slab count:35`
6. Build: `!build blueprint:small_cabin x:N y:N z:N`
7. OR design custom: `!design description:"a two-story oak cabin with spruce trim and glass windows..."`

### Setting Up a Farm

1. `!craft item:wooden_hoe` (if not already have)
2. `!gather item:wheat_seeds count:8` — break tall grass near water source
3. Find flat ground near water
4. `!scan` — confirm grass_block or dirt is present nearby
5. `!farm seed:wheat_seeds count:8` — tills up to 8 blocks and plants seeds
6. Wait (crops take several in-game days to grow — pursue other tasks)
7. Later: `!gather item:wheat count:9`, `!craft item:bread count:3`

Alternative: use the `crop_farm` blueprint for a structured 9x9 farm with irrigation.

### Preparing for the Nether

Full preparation checklist:
1. Iron armor set: `!mine item:iron_ore count:24`, `!smelt item:raw_iron fuel:coal count:24`, craft all four pieces
2. `!craft item:iron_sword` and `!craft item:iron_pickaxe`
3. `!craft item:flint_and_steel` — 1 iron_ingot + 1 flint (mine gravel for flint)
4. `!gather item:obsidian count:10` — requires diamond pickaxe; or find existing portal
5. Build nether portal frame (4x5 obsidian frame, ignite with flint_and_steel)
   - `!design description:"a 4x5 obsidian nether portal frame"` — or place manually
6. Stock food: cooked meat or bread
7. `!chat message:"heading to nether, anyone want to come?"` — coordinate with team

In the Nether: `!mine item:ancient_debris count:4` (needs diamond pickaxe), avoid ghasts and
blaze. Use `!combat` on aggressive mobs.

### Building a Village / City District

1. `!scan` — survey the area for existing structures and terrain
2. `!chat message:"I'm thinking we build [X] over here — what do you think?"` — coordinate
3. Plan district structure: housing, storage, farming zones, roads connecting them
4. Design structures one at a time with `!design` using detailed descriptions
5. Build connecting roads: `!design description:"3-wide cobblestone road from [start] to [end] with fence railings"`
6. Add lighting: `!craft item:torch count:32`, place them via !design or build skill
7. Label areas: `!chat` to describe what was built and where

Sequence for a basic city block:
- `!design description:"a 4x4 cobblestone town square with oak benches on each side and a central glowstone lamp post"`
- `!design description:"a 5x5 residential cabin with spruce planks and birch trim, facing the town square"`
- `!design description:"a 3-wide gravel road running south from the town square for 20 blocks with oak_fence railings"`
- `!build blueprint:storage_shed x:N y:N z:N` — add storage near residential area
- `!build blueprint:animal_pen x:N y:N z:N` — add animal pen at city edge

---

## Inventory and Storage

### Checking Inventory

`!look target:inventory` — lists all items and counts in the bot's inventory.

Always call this before starting a build or crafting chain to avoid wasted navigation.

### Checking a Chest

`!look target:chest` — opens and reads the nearest chest/barrel/trapped_chest within 32 blocks.

### Depositing and Withdrawing

`!deposit item:NAME count:N` — moves items from inventory to nearest chest within 64 blocks.
`!withdraw item:NAME count:N` — takes items from nearest chest within 64 blocks.

If no chest is within 64 blocks, both return `reason: no chest/barrel found`.

### Giving Items to Players

`!give player:PLAYERNAME item:NAME count:N` — tosses item toward a nearby player.
`!drop item:NAME count:N` — drops item on the ground at current position.

---

## Farming and Animals

### !farm Command

`!farm seed:SEED_NAME count:N`

Tills up to N nearby grass_block or dirt blocks within 16 blocks and plants seeds. Requires a
hoe in inventory. If no hoe is present, returns `reason: no_hoe_in_inventory`.

Supported seeds (any valid MC seed item name):
- `!farm seed:wheat_seeds count:8`
- `!farm seed:beetroot_seeds count:4`
- `!farm seed:melon_seeds count:4`
- `!farm seed:pumpkin_seeds count:4`
- `!farm seed:carrot count:4` — carrots are planted directly (item IS the seed)
- `!farm seed:potato count:4` — same

To farm without planting (just till): `!farm seed: count:4` (empty seed name).

### !breed Command

`!breed animal:TYPE` — feeds two nearby animals of that type to trigger breeding.

Supported types: `cow`, `sheep`, `pig`, `chicken`

Animals must be within 16 blocks. The skill auto-selects the right food item from inventory:
cows/sheep need wheat, pigs need carrot, chickens need seeds.

---

## Error Recovery

### !gather fails — wrong block name or nothing nearby

Result: `reason: unknown_block` or `collected: 0 < requested`.

- Unknown block: the name is not in the MC 1.21.1 registry. The normalizer corrects common
  aliases (planks → oak_planks, cobble → cobblestone, log → oak_log). Check the exact block
  name. Example: "sprucewood" is wrong; use "spruce_log".
- Nothing nearby: no blocks of that type within 64 blocks. `!navigate` to a different area,
  then retry.
- Cannot reach: unreachable blocks are skipped automatically; if ALL candidates are unreachable,
  `collected` will be 0. Find a different location.

### !mine fails — no_suitable_tool

Result: `reason: no_suitable_tool`.

You are trying to mine an ore that requires a higher-tier pickaxe. Tool tier requirements:
- wooden_pickaxe: stone, coal_ore only
- stone_pickaxe: iron_ore, copper_ore
- iron_pickaxe: gold_ore, diamond_ore, redstone_ore, lapis_ore, emerald_ore
- diamond_pickaxe: obsidian, ancient_debris

Fix: craft the required tier first. `!mine item:stone count:3` + `!craft item:stone_pickaxe` +
retry the original mine command.

### !craft fails — missing_materials

Result: `reason: missing_materials, missing: [item1, item2, ...]`

You do not have the raw materials needed. The crafter resolves the FULL chain but cannot gather
raw materials itself. Gather/mine the listed missing items then retry.

Common miss: forgetting to smelt. If missing `iron_ingot`, you need to:
1. `!mine item:iron_ore count:N`
2. `!smelt item:raw_iron fuel:coal count:N`
3. Then retry `!craft item:iron_pickaxe`

Result: `reason: no_crafting_table` — the crafter needs a 3x3 recipe but has no crafting table
and no planks to craft one. Fix: `!gather item:oak_log count:1`, `!craft item:crafting_table`.

### !smelt fails — no_furnace_nearby

Result: `reason: no_furnace_nearby`.

No furnace, blast_furnace, or smoker within 32 blocks. Fix:
1. `!mine item:stone count:8` to get cobblestone
2. `!craft item:furnace`
3. Place it: `!design description:"a single furnace placed on the ground"` or build a crafting
   area blueprint.

Result: `reason: smelt_timeout` — the furnace ran out of fuel or something went wrong. Retry with
more fuel. Each coal smelts 8 items; the skill auto-calculates needed fuel.

### !navigate fails — nav_timeout or path blocked

Result: `reason: nav_timeout` or a pathfinder error.

- Destination is underwater, inside a mountain, or surrounded by lava/void.
- Pathfinder cannot find a route within 30 seconds.

Fix: try a nearby coordinate instead. `!navigate x:N y:64 z:N` — adjust y to match the actual
terrain height. Use `!scan` to see what blocks are at the target area.

### !build fails — missing_material (paused)

Result: `reason: missing_material, missing: [block1, block2, ...], placed: X`.

The build is now PAUSED. The state is saved. Do NOT call `!build` with different coordinates
— that would start a new build.

Fix:
1. Gather each missing material (check the `missing` list in the result)
2. Call `!build blueprint:SAME_NAME x:SAME_X y:SAME_Y z:SAME_Z` — it resumes automatically

Result: `reason: site_blocked` — too many solid blocks at the build site (>50% of footprint).
Move to flatter terrain. `!scan` first to find a clear area.

Result: `reason: unknown_blueprint` — the blueprint name is not in `body/blueprints/`. Use exact
names from the Available Blueprints table above, or use `!design` to create a custom blueprint.

### !farm fails — no_hoe_in_inventory

Result: `reason: no_hoe_in_inventory`.

Fix: `!craft item:wooden_hoe` (2 planks + 2 sticks) then retry.

Result: `reason: no_tillable_blocks_nearby` — no grass_block or dirt within 16 blocks.
Navigate to a grassy area and retry.

### !combat returns no_hostile_nearby

No hostile mob within 16 blocks. Either the area is safe or mobs are farther away. Navigate
closer to the threat, or use `!idle` if the area is clear.

---

## Creative Decision Making

### Choosing What to Build

Assess the current city's needs before deciding:
1. `!look target:inventory` — know your resources
2. `!scan` — survey what already exists
3. `!chat message:"what do we need most right now?"` — coordinate with teammates

Priority order for a new settlement:
1. Survival: `shelter` blueprint at nightfall if no structure exists
2. Food: `crop_farm` blueprint + `!farm` once stable
3. Storage: `storage_shed` blueprint near work area
4. Expansion: custom residential or functional structures via `!design`
5. Infrastructure: roads, walls, lighting, watchtower for defense
6. Aesthetics: gardens, fountains, decorative elements

### Choosing Where to Build

Rules for placement:
- Scan first: `!scan` to confirm terrain is flat (mostly grass_block/air) and site is clear
- Connect to existing builds: place new structures adjacent to or along roads from existing ones
- Terrain fit: use `!navigate` to visit candidate sites before committing
- Water proximity: docks, mills, and farms benefit from water nearby (scan for water blocks)
- Height: watchtowers and lookout platforms work best on elevated terrain

Naming your builds: after completing, announce in chat:
`!chat message:"just finished the north storage shed at 120,65,200 — storing excess wood there"`

### Sequencing Multiple Projects

Work one structure at a time to completion. A build is only done when `placed: X/X` is confirmed.

Parallel opportunity: while a smelt operation completes (long wait), navigate to the build site
and scan it. Plan the next design call during transit.

Do not abandon a paused build — always gather the missing materials and resume before starting
something new, unless the teammate needs help urgently.

### Cooperating with Other Agents

When a teammate is building, offer to handle a different task:
- They build: you gather materials and `!give player:NAME item:oak_planks count:32`
- They mine: you farm and process food
- They fight mobs: you set up the base defenses

Read the build history in the system prompt ("Previous builds") to understand what each agent
has built. Extend others' work rather than duplicating it. If JeffEnderstein built a cabin at
120,65,200, build the adjacent storage shed or road rather than another cabin.

Use `!deposit` to stock shared chests so teammates can `!withdraw` what they need.
