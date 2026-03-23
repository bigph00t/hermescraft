# movement-traversal.md — Player Movement, Traversal & Unstuck Procedures

All mechanics verified for Minecraft 1.21.1 Java Edition.

---

## Player Hitbox

### Know Your Hitbox Before Squeezing Through Gaps
Standing hitbox: 0.6 blocks wide, 1.8 blocks tall. You fit through a 1-wide, 2-tall doorway. You do NOT fit upright through a 1-block-tall gap — you must crawl. Sneaking shrinks height to 1.5 blocks. Crawling/swimming/gliding shrinks height to 0.6 blocks.

### Auto-Step Lets You Walk Up 1-Block Ledges
Players auto-step up any single block height without jumping. Horses do the same. Use this to walk up stairs, slabs, and soil mounds without consuming a jump.

---

## Sprinting

### Sprint Requires Hunger Above 3 Drumsticks (6 half-bars)
If hunger is 6 or below (3 drumsticks), sprinting is disabled. Eat before long traversal runs. Blindness status effect also disables sprinting.

### Activate Sprint: Double-Tap Forward or Hold Sprint Key
Default sprint key is Left Ctrl. Double-tapping W also starts a sprint. Sprinting at 5.612 m/s vs walking at 4.317 m/s — 30% faster.

### Sprint Cancels on Any Angled Block Collision
Hitting a solid block at more than 8 degrees from head-on cancels your sprint. Doors, corners, and narrow corridors silently kill your sprint. Jump over or realign before entering tight spaces.

### Sprint-Jumping Is the Fastest Overworld Ground Travel
Sprint + continuous jumping averages 7.127 m/s and clears up to 4 blocks horizontally per jump. Under a 2-block ceiling, use rapid sprint-jumping to reach 5-block jumps but it burns 1 hunger/second — only short bursts.

### Sprint-Jump Clears 4 Blocks Horizontally; Normal Jump Clears 2
Use sprint-jump to cross 4-wide gaps. A normal standing jump only clears 2 blocks. Fences are 1.5 blocks tall — sprint-jump clears them; normal jump does not.

---

## Sneaking

### Sneak Prevents Edge Falls — Hold Shift to Stop at Any Ledge
Sneaking prevents walking off edges where the height difference exceeds 0.6 blocks. You will hover at the edge rather than fall. However, if the block below your feet is destroyed while sneaking, you still fall.

### Sneak Speed Is 1.3 m/s; Diagonal Sneak Is 1.8 m/s
Sneaking diagonally is measurably faster. Use diagonal movement when sneaking across long distances.

### Sneak Reduces Mob Detection Range by 20%
Hostile mobs do not detect you until within 80% of their normal range while you sneak. Use this near creepers and skeletons.

### Sneak to Lock Position on Ladders and Vines
Holding sneak while on a ladder or vine stops all vertical movement — you grip the surface and hang in place. Mining speed decreases while gripping a ladder.

### Sneak Disables Slime Block Bounce
Sneaking when landing on a slime block absorbs all fall damage and removes the bounce entirely. Use this for controlled descents onto slime.

### Sneak to Prioritize Item Use Over Block Interaction
When sneaking, right-clicking uses the item in your hand rather than activating the targeted block. Essential when placing torches against interactive blocks like crafting tables.

---

## Jumping

### Max Jump Height Is 1.252 Blocks
A standard jump clears exactly 1 block and lands on the next. You cannot jump over a full 2-block-tall wall without Jump Boost. Fences and walls are 1.5 blocks — requires sprint-jump.

### Jump Boost I Adds ~0.5 Blocks; Jump Boost II Adds ~1.0 Block
Jump Boost II lets you clear 2-block-tall obstacles. Stack with sprint for maximum horizontal reach.

### Land in Water to Negate All Fall Damage
Any water at least 1 block deep completely cancels fall damage regardless of height. Swim down before the column ends to avoid impact.

---

## Crawling (1.21+)

### You Enter Crawl Mode Automatically When the Space Above Is Under 1.5 Blocks
Entering a gap below 1.5 blocks forces crawl. Crawl hitbox is only 0.625 blocks tall — you can pass through spaces as low as 0.375 blocks (e.g., a daylight detector height). Triggers via trapdoors, pistons, swimming exit, or tree growth overhead.

### Crawl Speed Equals Sneak Speed
Crawling is slow. Sprint-enter a crawlspace to carry a 30% speed bonus into it. Swift Sneak enchantment also applies.

### Exit Crawl Automatically When Overhead Clears to 1.5 Blocks
No key press required. Move to an open area and you stand back up.

### Crawling Still Triggers Sculk Sensors — Press Sneak to Silence It
Even crawling vibrations alert sculk sensors. Hold sneak while crawling to suppress footstep vibrations.

---

## Swimming

### Hold Jump to Rise, Sneak to Sink Faster
In water: jump key pulls you up, sneak key pushes you down. To ascend fastest: look up + sprint + jump simultaneously.

### Sprint-Swimming Reaches 3.9 m/s; With Depth Strider III: 5.3 m/s
Sprint-swimming requires hunger above 6 — same requirement as land sprinting. Depth Strider III boots add 35% to sprint-swim speed.

### Sprint-Swimming Lets You Fit Through 1-Block Horizontal Gaps
Sprint-swimming drops your hitbox to swimming mode (0.6 tall) — you pass through gaps you could not walk through upright.

### Dolphin's Grace Status Effect Unlocks Extreme Water Speed
Dolphin's Grace + Depth Strider III hits 48 m/s underwater. Swim near dolphins to receive the effect.

### Bubble Columns: Soul Sand Pushes Up, Magma Block Pulls Down
Place soul sand under a water column to create an upward lift elevator. Place magma block at the bottom to create a downward pull. Both columns restore breath to players inside. Use to avoid the swim-up grind in deep wells.

---

## Ladder Climbing

### Push Against a Ladder While Pressing Forward to Climb at 2.35 Blocks/sec
Alternatively, hold Jump in a 1×1 ladder shaft to ascend without pressing forward. Both methods work. Jump is the safer choice in enclosed shafts.

### Descent Speed Is Capped at ~3 Blocks/sec
Ladders slow free fall to a fixed descent speed — no fall damage. Entering a ladder from any height instantly cancels fall momentum and begins controlled descent.

### Never Land on the Top Surface of a Ladder
Hitting the narrow 1px top face of a ladder block counts as landing on solid ground — full fall damage applies. Always aim to enter the ladder from the side.

### Sneak to Grip and Hold Position on a Rung
Hold Shift while on a ladder to stop moving vertically. You can eat, craft, or look around while gripped. Note: mining speed is reduced while gripping.

### Lateral Friction on Ladders Equals Ice
Horizontal movement while gripping a ladder has ice-level friction. Do not expect to strafe precisely while on a ladder face.

### Open Trapdoor Above a Ladder Extends the Climbable Column
In Java Edition, an open trapdoor placed directly above a ladder on the same wall side acts as an additional climbable block. Use this to get through a floor while keeping a ladder column intact.

---

## Vine Climbing

### Press Jump to Climb Free-Hanging Vines — Forward Key Works Only Against a Backing Block
Vines not touching a solid block behind them can still be climbed with Jump alone. Vines against a solid surface allow both Forward and Jump to climb.

### Sprinting Cancels on Contact With Vines
Your sprint ends the moment you touch vines. Account for this when approaching a vine-covered wall at speed.

### Sneak to Hang on Vines — Even Without a Backing Block
Holding Shift while on vines holds you stationary regardless of whether there is a block behind the vine.

### Vines Absorb 100% of Fall Damage
Falling into any vine — even free-hanging ones — negates all fall damage entirely. Use vines placed on a single block face as emergency landing zones.

---

## Scaffolding

### Jump to Go Up, Sneak to Go Down on Scaffolding
Scaffolding moves you vertically through its column: jump goes up, sneak descends. No sprint needed.

### Scaffolding Extends Up to 6 Blocks Horizontally Without Support
A supported scaffolding pole can extend 6 blocks sideways before the blocks fall. Plan bridges to stay within this limit.

### Sneaking While Placing Scaffolding Places It on the Targeted Face, Not Extending the Column
Normal scaffolding placement stacks outward or upward automatically. Sneaking overrides this and places it directly on the face you're targeting — essential for filling gaps.

### Walking Through Scaffolding Sides Is Not Blocked
Scaffolding has open side collision — you can walk directly through the edges. This is intentional for build scaffolding access.

### Scaffolding Slows All Entity Movement
All mobs and players move slower while inside a scaffolding column. Account for slower escape speed when using scaffolding in combat areas.

---

## Elytra

### Press Jump in Mid-Air to Begin Gliding
You must already be airborne (falling or jumping). Elytra does not activate from the ground. Jump off a ledge or a tower, then press Jump again mid-air.

### Minimum Sustainable Glide Speed Is ~7.2 m/s at 30-Degree Upward Pitch
Pitching higher than 30 degrees causes stall — you lose speed rapidly. At 60+ degrees upward pitch, you stall completely and begin taking fall damage. Flatten your glide angle if speed drops.

### Firework Rockets Boost to 33.5 m/s Instantly
Hold a firework rocket and right-click to boost. Does not drain elytra durability. Any entities riding you are instantly dismounted on rocket use.

### Hairpin Turns Bleed Speed for Safe High-Speed Landings
Approach your target at altitude, then make a sharp 180-degree turn. The speed loss from reversing direction brings you to a survivable landing velocity on a small target.

### Elytra Breaks at 1 Durability Remaining — Never at 0
Elytra stops functioning at 1 durability (not 0). Repair with Phantom Membrane on an anvil (108 durability per membrane). Unbreaking III extends total flight time to ~29 minutes.

### Use Riptide III Trident to Gain Altitude in Rain or Water
Throw a Riptide III trident to launch yourself upward at extreme speed (~375 m/s). Combine with elytra to regain altitude without wasting a firework rocket. Only works in rain, snow, or when in water.

---

## Boats

### Boats Move at ~8 Blocks/sec on Water; ~40 Blocks/sec on Ice; ~73 Blocks/sec on Blue Ice
Ice boat highways are the fastest practical Overworld surface travel. Build an enclosed 2-block-tall ice boat highway for protection and speed.

### Boats Negate 100% of Fall Damage
A boat ridden off any height takes zero fall damage. Use a boat to descend cliffs safely.

### Dismount a Boat by Sneaking
Press Shift to exit the boat. The game automatically places you on nearby land if possible.

### Soul Sand Slows Boats to ~1 Block/sec
Even in water, soul sand drastically reduces boat speed. Avoid routing ice highways over soul sand.

### Magma Block Underwater Ejects Passengers and Sinks the Boat
Riding a boat over a submerged magma block will expel you and eventually sink the boat. Avoid magma-floored lakes and ocean floors.

---

## Minecarts

### Max Speed Is 8 Blocks/sec Per Axis — Diagonal Is 11.3 Blocks/sec
Minecarts on diagonal track segments travel at the Pythagorean sum of per-axis speeds. Plan diagonal segments to maximize throughput.

### Powered Rails Require Redstone Signal to Accelerate; Unpowered Powered Rails Slow You Down
An unactivated powered rail acts as a brake, not a neutral. Always supply redstone to powered rails in your tracks.

### Riding a Minecart That Lands on a Rail Takes Zero Fall Damage
Cart + rail landing = no fall damage. Drop shafts with a rail at the bottom are safe if timed correctly.

### Exit a Minecart by Sneaking (Shift)
Pressing Shift while riding ejects you. The cart calculates 8 possible ejection points in priority order (right, left, rear-right, rear-left, etc.).

### Minecarts Skip Across 1 Missing Rail Block at Speed
A fast-moving minecart can bridge a 1-block gap in tracks. Do not rely on this — gaps cause derailing at low speed.

---

## Horses

### Tame by Repeated Mounting With Empty Hand
Right-click a horse with an empty hand to mount it. It bucks you off until trust is earned. When hearts appear, it is tamed.

### Saddle Is Required for Any Movement Control
An unsaddled horse cannot be steered. Always carry a spare saddle. Without one, the horse wanders freely.

### Speed Range: 4.86 to 14.57 Blocks/sec; Average 9.71
Horse speed is fixed at birth and cannot be changed. Test horses before committing to one for long-distance travel.

### Jump Height: 1.15 to 5.92 Blocks Depending on the Horse
Charge the jump by holding Jump key — bar fills up. Release to jump. Maximum jump horse can clear a 6-block wall. Minimum jump horse barely clears a 1-block fence.

### Horses Take Half Normal Fall Damage and Start Taking Damage Only After 7-Block Falls
Horses are much more fall-resistant than players. A horse survives a 7-block drop with no damage at all, and takes half damage beyond that.

### Horses Auto-Step Up 1 Block
Like players, horses auto-climb 1-block-tall ledges. Navigate to terrain rather than jumping for every small elevation change.

---

## Water Elevators

### Soul Sand + Water Column = Upward Bubble Elevator
Place soul sand at the bottom of a water column (all source blocks). A stream of bubbles lifts players and items to the surface quickly. The column must be all source water — flowing water does not work.

### Magma Block + Water Column = Downward Bubble Elevator
Place magma at the bottom. The suction pulls players down. Both soul sand and magma columns restore air supply — important in deep shafts.

### Both Types Work in Any Dimension Including the Nether
Nether water placement is tricky (water evaporates near lava), but these elevators function wherever water can exist.

---

## Slime Blocks

### Slime Blocks Negate All Fall Damage and Bounce
Landing on a slime block cancels all fall damage. You bounce to a height proportional to your fall velocity — a 255-block fall produces a ~58-block bounce.

### Sneak While Landing on Slime to Absorb Impact Without Bouncing
Holding Shift on landing prevents the bounce and still takes zero fall damage. Use this for controlled landings in tight spaces.

### Walking on Slime Is 70% Slower Than Normal (1.36 m/s)
Do not build traversal paths on slime — it dramatically slows movement. Slime is for fall protection, not pathways.

---

## Hay Bales

### Hay Bales Reduce Fall Damage by 80%
You take only 20% of normal fall damage when landing on a hay bale. A 100-block fall (normally lethal) becomes survivable. Stack hay bales in emergency landing zones.

---

## Honey Blocks

### Walking on Honey Is 60% Slower Than Normal (2.5 m/s)
Honey blocks severely slow movement. Avoid walking over them; jump over instead.

### Jumping on Honey Is Reduced to 85% Less Height (~0.19 Blocks)
You nearly cannot jump while standing on honey. Do not get cornered on honey blocks in combat.

### Press Against a Honey Block Wall to Slide Down Without Fall Damage
Holding against a honey block vertical face slows your descent. In Java Edition, horizontal momentum also decays as you slide, letting you jump further from the wall after slowing. Zero fall damage on honey wall-slide landing.

### Honey Reduces Fall Damage by 80% (Same as Hay Bale)
Landing on top of a honey block: 80% fall damage reduction. Equivalent to hay bale. Both are reliable emergency landing blocks.

---

## Soul Sand

### Soul Sand Slows Movement by ~58% for Players Without Soul Speed Boots
Walking on soul sand: ~2.5 m/s. All movement modes are slowed (walking, sprinting, sneaking, crawling) except elytra gliding. Entities sink 2 pixels into the surface.

### Place Any Solid Block on Top of Soul Sand to Eliminate the Slowdown
A half-slab or thin block on top of soul sand prevents sinking and removes the speed penalty. Use this when building paths over soul sand.

### Soul Speed Boots Completely Bypass Soul Sand Slowdown
Enchant boots with Soul Speed I-III to walk at full speed on soul sand and soul soil. Soul Speed III makes sprinting on soul sand faster than normal ground walking.

---

## Ice, Packed Ice, Blue Ice

### Ice Is Slippery — Sprint-Jumping on Ice Beats Any Other Block Speed
On flat ice with a 2-block-tall corridor, sprint-jumping reaches extreme speeds. The slipperiness carries your momentum between jumps.

### Packed Ice and Regular Ice: ~40 Blocks/sec for Boats
Regular ice and packed ice give boats the same speed boost. Use packed ice for build convenience (does not melt).

### Blue Ice: ~73 Blocks/sec for Boats — 1.8x Faster Than Regular Ice
Blue ice is the fastest legitimate boat surface. Blue ice highways in the Nether (exploiting the 1:8 distance ratio) are the fastest practical overworld travel method in the game.

### Ice Melts When Adjacent Block Light Exceeds 11
Torches and other light sources melt ice. Use packed ice or blue ice in lit areas — both are immune to light-based melting.

### Non-Full Blocks on Ice Inherit Its Slipperiness
Any block shorter than 0.5 blocks placed on top of ice inherits the slippery movement properties. Slabs and carpets on ice are still slippery.

---

## Trapdoors

### Walk Normally on Closed Trapdoors — They Act as Solid Floors
A closed trapdoor is a full-collision surface. Build floors with them safely.

### Fall Through Open Trapdoors — Mobs Cannot Detect They Are Open
Mobs pathfind as if all trapdoors are closed, so they walk off open trapdoors. Use open trapdoors as mob trap floors.

### Closing a Trapdoor Overhead Forces Crawl Mode Automatically
Stand under a trapdoor and close it — your player enters crawl state. Use this to access 1-block-tall secret passages without a piston setup.

---

## Cobwebs

### Cobwebs Slow Movement to ~25% of Normal Walking Speed
Entering a cobweb drops you to ~1 m/s. Do not enter cobwebs while being chased.

### Cobwebs Completely Cancel Fall Damage
Falling into a cobweb from any height: zero fall damage. Cobwebs placed in a shaft bottom provide the same protection as water.

### Break Cobwebs in 0.4 Seconds With Shears or Sword
Shears: 0.4s, drops the cobweb block. Sword: 0.4s, costs 2 durability, drops only string. Without the right tool: 20 full seconds. Always carry shears in cave systems with cobwebs.

---

## Magma Blocks

### Walking on Magma Deals 1 HP Fire Damage Every 0.5 Seconds
Magma burns your feet continuously. Sneak to avoid all damage. Frost Walker boots also negate magma damage. Fire Resistance potion completely negates it.

### Magma Blocks Underwater Pull Entities Downward
Magma under water creates a downward bubble column. Do not swim over underwater magma — it pulls you into the floor.

---

## Pillaring Up

### Jump-Place a Block Under Yourself to Pillar Up
While jumping, look down and right-click a block to place it under your feet. This is the primary escape from holes and pits. Keep a stack of dirt, cobblestone, or sand in your hotbar for emergencies.

### Pillar Speed: 1 Block Per Jump Cycle (~1 Block/Second)
Pillaring is slow. Dedicate a hotbar slot to a non-perishable pillar block and practice the rhythm.

### Never Pillar With Gravel or Sand — They Fall on You
Gravel and sand are affected by gravity and will fall and suffocate you mid-pillar. Use cobblestone, dirt, stone, or any solid non-falling block.

---

## Descending Safely

### Staircase Mine at 45 Degrees for Safe Descent: 2-Wide, 1-Tall Steps
Dig 2 blocks forward, 1 block down, repeat. This creates a walkable ramp. Never dig straight down — gravel, lava, and fall voids kill.

### Dig 1x1 Vertical Descent Only With Full Situational Awareness
Straight-down digging risks: lava directly below, open cave void, gravel/sand column above. Look at the block faces, not straight down, and listen for lava sounds before each break.

### Pillaring Down With Water Is Fast and Safe
Pour a water bucket down a shaft, then swim down the resulting water column. Fall damage is negated in any water at least 1 block deep.

---

## Getting Unstuck

### Stuck in a 1x1 Hole: Pillar Up With Blocks Placed Under You
Jump and place a block under yourself each jump. You will rise 1 block per cycle. Keep at least 4-8 dirt in your inventory at all times for this exact scenario.

### Stuck in Water: Hold Jump to Swim Up — Place Blocks If Not Moving
If sprint-swimming up is not making progress, place blocks on the water floor to create a solid surface to stand on, then jump. Alternatively, reach a wall and climb along it.

### Stuck in a Cave Without Exit: Dig Staircase Upward at 45 Degrees
Always diagonal — never straight up. Listen before each dig for water above (splashing sound) and check the block type (avoid sand/gravel). Keep coal ore visible by the natural sparkle even in low light; mine it for torches.

### Stuck Between Blocks: Sneak Through or Break One
Sneaking reduces height to 1.5 blocks. If that is not enough, break one of the blocks. Carry a pickaxe or sword that can quickly remove the blocking material.

### Stuck on a Ledge With No Path Down: Bridge With Blocks to Safety
Place a 1-wide block bridge extending from your position to an adjacent cliff, slope, or tree. Sneak while placing to avoid falling. Dirt works — permanence is not required, you just need to cross.

### Stuck in Lava: Place Water Immediately — Do Not Swim Deeper
Lava burns 4 HP/second. Your water bucket creates obsidian on contact and gives you a safe block to stand on. Place it next to you, not below you. Fire Resistance potion gives 30 seconds of immunity — always carry one in the Nether.

### Stuck Underground With No Torches: Mine Coal or Dig Up at 45 Degrees
Coal ore has distinct dark speckle texture visible even in low light. Mine it for charcoal → torches. If no coal is visible, staircase diagonally upward until you break through to the surface or a lit area.

### Falling Into the Void or Deep Pit: Use Elytra, Water Bucket, or Ender Pearl
- Elytra: activate before you hit terminal velocity — press jump mid-fall.
- Water bucket: place on a wall 2-3 blocks above the floor to create a 1-block-deep pool that negates all fall damage.
- Ender pearl: land in water, vines, cobwebs, or hay bales to reduce teleport damage.
- Cobweb: placing one cobweb block in your fall path stops you with zero damage.

### Stuck in a Boat on Dry Land: Break the Boat (Sword = Instant)
Boats stuck on land cannot be steered off. Hit the boat to break it and exit. A sword breaks a boat in a single hit. You keep the boat as a dropped item.

### Stuck in a Minecart on a Dead-End Track: Sneak to Exit
Press Shift to dismount. If the cart is moving, it will continue forward. If you need to remove the cart, hit it to break it.

### Cornered on a Ledge by Mobs: Sprint-Jump Over Them
Mobs have a 0.6-wide hitbox same as players. A sprint-jump can clear over a single mob or a 1-wide gap. Aim for the edge of the mob hitbox rather than center to maximize clearance.
