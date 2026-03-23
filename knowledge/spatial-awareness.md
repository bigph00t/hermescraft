# Spatial Awareness

## Reading Your State

### Understanding Terrain Type
"terrain: underground" means solid blocks are overhead — you are below the surface. "terrain: surface" means open sky. "terrain: underwater" means you are submerged — swim up immediately. "terrain: deep underground" means you are below Y=0 where lava lakes and diamonds exist — carry a water bucket. "terrain: in cave" means you are in a natural underground opening.

### Understanding Light Levels
Light 0 means total darkness — hostile mobs WILL spawn next to you. Place a torch immediately. Light 7 prevents most mob spawns. Light 14-15 is full brightness (torches, sunlight). If you see "light: 0" or "light: 1", you are in extreme danger underground. Always place torches as you move.

### Understanding Your Facing Direction
"facing: N (looking level)" means you face north and your view is horizontal. "facing: S (looking down)" means you face south but your view points at the ground. When mining, your pickaxe hits what you are LOOKING at — if looking down, you mine the floor. If looking level, you mine the wall in front of you. Change your facing before mining to control WHAT you mine.

### Understanding Ground and Headroom
"ground: stone" means you stand on stone. "ground: air" means you are falling — this is dangerous. "headroom: clear" means nothing above your head — you can jump. "headroom: blocked" means a solid block is above — you cannot jump or pillar up until you mine the ceiling. "headroom: water" means water is overhead — drowning risk.

## Responding to Alerts

### TRAPPED Alert
When you see "TRAPPED" in your state, you are physically enclosed by blocks. This is urgent. DO NOT dig down — you will make it worse. First try digging SIDEWAYS — mine a wall block to create an exit. If all walls are too hard to mine (obsidian, bedrock), try mining the ceiling block, then pillar up by jumping and placing a block under you. If you have no tools, punch the weakest-looking wall block (dirt or sand break fastest).

### DANGER Alert
DANGER lists hazardous blocks nearby: "DANGER: lava 3b S" means lava is 3 blocks south. Move AWAY from the danger direction immediately. Never mine toward a DANGER alert. If lava is below you, do NOT mine downward. If fire is adjacent, move away and do not place wood nearby.

### PIT Alert
"PIT: drop to S" means the ground drops off to the south — walking that way causes fall damage. Sneak (crouch) to approach edges safely. Place blocks to bridge across gaps. Never sprint near a pit alert.

## Using Nearby Block Information

### Reading the "around" Line
"around: oak_log 5b NE, iron_ore 4b N below" tells you what notable blocks are within 16 blocks. The format is: block_name distance direction. "5b NE" means 5 blocks to the northeast. "4b N below" means 4 blocks north and lower than you. Use this to decide what to gather, mine, or navigate toward without needing to call !scan.

### When Resources Show in "around"
If you see ores in "around", you know exactly where to mine. Navigate toward the ore's direction. If you see tree logs, navigate there to gather wood. If you see a chest or furnace, you can go use it. This information updates automatically — you always know what is near you.

### When Nothing Shows in "around"
If "around" is empty or not shown, there are no notable blocks within 16 blocks. You are in a featureless area. Use !look target:horizon to scout further out, or navigate in a new direction to find resources.

## Using Horizon Farsight

### When to Use !look target:horizon
Use horizon scanning when you need to see far: picking a build site, finding a biome or forest, locating water for a farm, planning a route across terrain. The default 360° scan shows all four cardinal directions at once — great for choosing where to go.

### Reading Horizon Results
Results come in distance bands: "0-20b: plains/grassland, flat | 20-40b: forest (oak), rolling | 40-64b: water/ocean". This tells you plains are nearby, a forest starts 20 blocks out, and ocean is beyond that. Pick the terrain that matches your goal — flat ground for building, forest for wood, water for farming.

### Directional Scanning
Use "!look target:horizon direction:north" to focus on one direction with more detail. Use "direction:forward" to scan where you are currently facing. This is useful when you want to check what is ahead before walking a long distance.

## Spatial Body Awareness

### Your Character in Space
You are 0.6 blocks wide and 1.8 blocks tall. You fit through 1-wide gaps horizontally but NOT through 1-tall gaps. When building, remember you need 2 blocks of vertical clearance to walk through doorways and corridors.

### Block Placement from Your Body
You can place blocks up to 4.5 blocks from your feet. You CANNOT place a block where your body is standing. To place a block below you, jump first then place while in the air. To place a block at your feet level, step back 1-2 blocks first. Stand OUTSIDE structures when building walls.

### Mining Direction
Your pickaxe mines what your character is FACING and LOOKING AT. If your state shows "facing: N (looking down)", you will mine the block below your feet to the north. To mine a wall, you need to be facing it and looking level. To mine the ceiling, look up. To mine the floor, look down. Always check your facing before mining to avoid digging in the wrong direction.

## Understanding Your World Position

### Y-Level Meaning
Y above 63 means you are above sea level — safe from underground lava. Y between 0-63 means you could be underground or in a valley. Y below 0 means deep underground — diamonds spawn here but lava pools are common. Y below -50 means you are near the lava sea level — extreme caution.

### Being Lost
If you are far from your partner or builds, check your coordinates. Your partner's location shows in "entities" when nearby. Use !navigate to return to known coordinates. Write down important locations (home base, mine entrance, farms) in chat or your notepad so you can find them again.

### Underground vs Surface Awareness
When terrain says "underground", the blocks around you are all stone/deepslate. When terrain says "surface", you have sky above. If you are underground and want to get out, mine upward in a staircase pattern (never straight up — gravel can fall on you). Check which direction has "air" in the nearby blocks and mine toward it.
