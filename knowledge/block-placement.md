# Block Placement Rules — Minecraft Java Edition 1.21.1

Comprehensive placement constraints for an AI bot. Each section is a self-contained rule chunk.
Violations cause silent placement failure or immediate block destruction — know these rules before acting.

---

### Reach Distance

Place blocks only within 4.5 blocks of your eye position (Java Edition survival reach). Measure from your eye level (1.62 m above feet), not from your feet. Blocks more than 4.5 blocks away will not register as placed. In Creative mode reach extends to 5 blocks.

---

### Entities Block Placement

Never attempt to place a block in a space occupied by a player, mob, or item entity. The placement will fail silently. Check the target space is clear before placing. The lower half of a door is protected from entity-blocked placement, but the upper half may sometimes overlap entity space.

---

### Cannot Place Directly Below Your Feet While Standing

Do not try to place a block in the space directly beneath you while you are standing on it. Your own collision box prevents it. Step off the block first, or use a different angle of approach.

---

### Need an Adjacent Surface to Place Against

Every block placement requires you to target an existing solid (or semi-solid) surface. You cannot place a block into mid-air with no adjacent face to click. Aim at the face of an existing block; the new block fills the space on the other side of that face.

---

### Placement Orientation: Player Facing Direction

Many directional blocks (stairs, logs, pistons, hoppers, dispensers, observers, furnaces) face toward or away from the player at the moment of placement. The exact rule varies by block type — stairs orient based on which horizontal direction you face; pistons and observers point toward the player. Always position yourself on the correct side before placing directional blocks.

---

### Gravity Blocks — Full List

These blocks fall immediately when their supporting block is removed or when placed above air:
- **Sand** and **Red Sand**
- **Gravel**
- **Concrete Powder** (all 16 colors)
- **Anvil**, **Chipped Anvil**, **Damaged Anvil**
- **Dragon Egg**
- **Pointed Dripstone** (stalactite tip only — falls when the block above the base is removed)
- **Scaffolding** (falls when more than 6 blocks from its nearest supported scaffolding)
- **Suspicious Sand** and **Suspicious Gravel** (break on landing; contained items are lost)

Place gravity blocks only when there is a solid block beneath them. If you need a column of sand/gravel, place from the bottom up.

---

### Concrete Powder Water Conversion

Concrete Powder converts to its solid Concrete form on contact with water — when placed into, next to, or falling into a water source block, flowing water, or a waterlogged block. Use this deliberately to solidify powder in place. Rain and splash bottles do not trigger conversion.

---

### Anvil Falling Damage

A falling anvil deals 2 hearts of damage per block fallen (after the first block), capped at 40 hearts. Helmets take double durability loss. Each fall has a 5% chance to degrade the anvil one stage (normal → chipped → damaged → destroyed). Place anvils carefully — never drop them onto players or important blocks.

---

### Slabs — Top vs Bottom Half

Click the top half of a block's face to place a slab in the upper position (top slab). Click the bottom half to place it in the lower position (bottom slab). If you click the top face of an existing bottom slab, a second slab of the same material fills the space, creating a double slab. Slabs can be waterlogged by placing them in water.

---

### Stairs — Orientation and Upside-Down Placement

Stairs orient based on the horizontal direction you face when placing: they are placed so the step-up edge faces you. To place upside-down stairs, click the top half of a block's side face, or click the bottom face of a block from below — this sets the `half: top` state. Corner shapes (inner/outer) are auto-assigned when the new stair is adjacent to another stair already forming a corner.

---

### Doors — 2-Block Vertical Space Required

Doors occupy two vertically stacked blocks. The lower half is placed where you aim; the upper half fills the block directly above. Placement fails if the block above is solid. The door must rest on a full solid block face beneath it. Orientation (which side the door faces) is determined by your facing direction at placement. The hinge side is determined first by adjacent matching doors (to form double doors), then by whichever side has more adjacent solid block faces, then by your aim position as a tiebreaker.

---

### Trapdoors — Top and Bottom Half

Trapdoors can be placed on the side of any block. Clicking the bottom half of a block face produces a bottom-position trapdoor (opens upward). Clicking the top half produces a top-position trapdoor (opens downward). Since Java Edition 1.9, trapdoors do not require an attachment block to remain in place after placement.

---

### Beds — 2-Block Horizontal Space Required

Beds require two horizontally adjacent empty block spaces. The foot is placed at the targeted block; the head extends one block in the direction you are facing. In Java Edition, no solid block is required beneath the bed after placement, but both spaces must be clear when placing.

---

### Torches — Solid Surface Requirement

Place torches only on the top or sides of solid blocks. Torches attach successfully to: stone, wood, most full blocks, glass and stained glass, iron bars and glass panes, upside-down slabs and stairs, fences, glowstone, spawners, and jack-o-lantern tops. Torches are removed and drop as items if their attachment block is moved, destroyed, or if water or lava flows into their space.

---

### Redstone Torches — Attachment Rules

Redstone torches attach to the top or sides of solid blocks — the same surfaces as regular torches. They cannot attach to the bottom of any block. When placed on an invalid surface, the game snaps them to the nearest valid adjacent surface. Redstone torches power the blocks above them and on their sides (but not the block they are attached to).

---

### Signs — Walls and Floor

Signs can be placed on the top surface of any block (standing sign, faces toward you in any of 16 directions) or on the side of any block including semi-solid and non-solid blocks like fences, trapdoors, and other signs (wall sign, floats against the face). To place a sign on an interactive block (chest, note block), sneak while placing to avoid opening the inventory.

---

### Ladders — Solid Backing Block Required

Ladders require a full solid block face to attach to. Place a ladder on the north, south, east, or west side of a solid block only — not on top or bottom. The ladder faces away from the backing block. Ladders cannot attach to non-solid blocks. An open trapdoor directly above a ladder, facing the same direction, also becomes climbable.

---

### Vines — Block Face Attachment

Vines attach to the side of any block that fills its whole cube and blocks entity movement. Multiple vines can occupy the same block space as long as each vine is on a different face. Do not place vines on the bottom face of other vines (they will be deleted on any block update). Vines hanging without a horizontal-side attachment also disappear on a neighboring block update.

---

### Fence Gates — Orientation and Connections

Fence gates can be placed without any adjacent block — they float freely in air if needed. They automatically face toward you at placement. Fence gates visually connect to fences, nether brick fences, and walls, but do not connect to glass panes or iron bars. When adjacent to walls, the gate lowers by 3 pixels (`in_wall` state) for a cleaner visual join.

---

### Fences — Connection Behavior

Fences automatically connect to any solid block placed next to them, and also to the solid back sides of adjacent stairs. Wooden fences do not connect to nether brick fences (though they can stand next to each other). Fences have a 1.5-block collision height despite appearing 1 block tall — entities cannot jump over them without special conditions.

---

### Rails — Solid Top Surface Required

Rails can only be placed on top of blocks with a solid top face: full blocks, hoppers, top-facing slabs, upside-down stairs, or top-facing trapdoors. Rails cannot attach to the side or bottom of any block. When placed at the end of an existing rail line, new rails auto-extend in the same direction. Adjacent rails at different heights auto-form a ramp. At T-junctions the connecting rail curves; at 4-way junctions it defaults to south-east curve.

---

### Redstone Dust — Solid Top Surface Required

Redstone dust can only be placed on blocks with a full solid top surface (full blocks, hoppers) — referred to as "full square or hopper" surfaces. It is removed and drops as an item if its support block is moved, removed, or destroyed, or if water or lava flows into its space, or if a piston pushes it.

---

### Redstone Repeaters — Solid Surface and Orientation

Repeaters require a full solid top surface or upside-down slab/stair. They also work on glass, ice, glowstone, and sea lanterns. The repeater faces away from you (output toward you, input on the far side). They drop as items if flooded (Java Edition) or if their support is removed.

---

### Redstone Comparators — Opaque Full-Height Surface

Comparators require an opaque block with a full-height top surface, or an upside-down slab or stair. Like repeaters, they face away from you (output toward you). Lava destroys comparators without dropping an item; water only drops them.

---

### Pressure Plates — Top of Block Only

Pressure plates can only be placed on top of blocks — never on the side or bottom. Valid supports include blocks with a rigid support shape (full blocks, cauldrons, composters, hoppers), blocks with a center support shape (fences, walls, glass panes), and any block with a full top surface (upside-down stairs, closed trapdoors, scaffolding).

---

### Buttons — Any Solid Face

Buttons can be placed on any face (top, bottom, or any of four sides) of any full opaque block. They cannot be placed on piston faces. Buttons are destroyed by flowing water or lava (Java Edition) and by pistons pushing them.

---

### Levers — Any Solid Face

Levers attach to the top, bottom, or any side of any full solid opaque block. In Bedrock Edition they also attach to fence tops, stone wall tops, and hoppers. Levers cannot be placed on piston tops. When on a wall, down = on and up = off. When on floor or ceiling, off = north/west and on = south/east.

---

### Carpet — Almost Any Block

Carpet can be placed on any block except air, including non-solid blocks like fences and hoppers. When placed on tall grass or ferns, those plants break and the carpet lands on the block below. Carpet can also be placed over water by targeting an adjacent block with a visible hitbox.

---

### Farmland — Hoe on Dirt/Grass

Create farmland by using a hoe on dirt, grass blocks, or dirt paths. Coarse dirt and rooted dirt must first be tilled to regular dirt, then hoed again. Mycelium and podzol cannot be tilled. Farmland reverts to dirt if: left without crops and dehydrated, jumped on (fall height > 0.5), covered by solid blocks, or pushed by pistons.

---

### Crops — Farmland and Light Level 9

Plant wheat seeds, carrots, potatoes, and beetroot seeds only on farmland. The light level at the block above the crop must be at least 9 for growth to occur (or use bone meal to bypass this). A wheat seed is destroyed immediately if planted when the light level is below 9 (Java Edition). Crops in alternating rows with different crop types have their growth rate halved — plant same-type crops adjacent for full speed.

---

### Farmland Hydration — Water Within 4 Blocks

Farmland is hydrated if water exists within 4 blocks horizontally (including diagonally) at the same level or one block above the farmland. Both source and flowing water hydrate equally. Hydrated farmland allows much faster crop growth than dry farmland.

---

### Sugar Cane — Sand/Dirt Adjacent to Water

Sugar cane can only be placed on: grass blocks, dirt, coarse dirt, rooted dirt, podzol, mycelium, sand, red sand, suspicious sand, moss blocks, pale moss blocks, mud, muddy mangrove roots, or another sugar cane block. The block the cane sits on must be directly adjacent (horizontally) to a water source, flowing water, waterlogged block, or frosted ice. Sugar cane grows to 3 blocks tall naturally; stacking by hand allows it to go higher.

---

### Cactus — Sand With Air on All 4 Sides

Place cactus only on sand, red sand, suspicious sand, or another cactus block. All four horizontally adjacent block spaces must be air (or non-solid non-lava material). Any solid block, sign, or lava placed horizontally adjacent to a cactus immediately breaks the cactus and drops it as an item. Cactus grows to 3 blocks naturally.

---

### Mushrooms — Low Light or Special Soil

Mushrooms can be placed on any fully opaque block when the light level at the placement position is below 13. They can also be placed on mycelium, podzol, and nylium at any light level. Mushrooms placed in too much light pop off immediately. Huge mushroom growth requires a 7×7×9 (brown) or 5×7 (red) clear space.

---

### Saplings — Dirt/Grass With Light Level 9 Above

Plant saplings only on dirt variants (dirt, grass block, coarse dirt, rooted dirt — but not dirt paths) or moss blocks. The block directly above the sapling must receive a light level of at least 9 for the sapling to grow (bone meal bypasses this). Space requirements above for full growth vary by species — oak needs 5 blocks clear, birch 6, dark oak and pale oak require a 2×2 sapling arrangement with 7 blocks above.

---

### Lily Pads — Water Surface Only

Lily pads can only be placed on the top face of a water source block, flowing water, ice, or frosted ice. In Java Edition, they can also be placed on waterlogged top-half slabs. Unlike most blocks, targeting the side of an adjacent block that would result in lily pad placement on water does not work — you must directly target the water surface. Lily pads break instantly if a boat or entity runs into them.

---

### Sea Pickles — Coral Blocks Underwater

Sea pickles can be placed on most solid blocks but only emit light when submerged. To grow a colony using bone meal, sea pickles must be underwater and planted on living coral blocks. Up to 4 sea pickles can occupy one block. Light output: 1 pickle = 6, 2 = 9, 3 = 12, 4 = 15 (only when waterlogged).

---

### Kelp — Water Source or Downward-Flowing Water Only

Kelp can only be placed in water source blocks or downward-flowing water — not in horizontally flowing water. It can grow on most solid block types at the bottom. Kelp grows to a random height capped at 25 age ticks from the top; the tip stops growing at age 25 but can be reset by breaking and replanting.

---

### Coral and Coral Fans — Stay Underwater

Coral and coral fans can be placed on solid blocks, but they die and become dead coral within 3–5 seconds (Java Edition) if any of the six adjacent blocks are not water or a waterlogged block. Once dead, they cannot be revived. Always ensure at least one adjacent block is water before placing live coral decoratively.

---

### Bamboo — Dirt/Sand/Moss With Light 9

Bamboo can be planted on: moss blocks, pale moss blocks, grass blocks, dirt, coarse dirt, rooted dirt, gravel, mycelium, podzol, sand, red sand, suspicious sand, suspicious gravel, mud, muddy mangrove roots, or another bamboo shoot. Light level of at least 9 is required at the top for growth. Bamboo grows to 12–16 blocks tall.

---

### Flowers and Small Plants — Grass/Dirt Family

Flowers and small decorative plants (dandelion, poppy, cornflower, etc.) can be placed on: grass blocks, dirt, coarse dirt, rooted dirt, farmland, podzol, mycelium, moss blocks, pale moss blocks, mud, or muddy mangrove roots. Wither roses can additionally be placed on netherrack, soul sand, and soul soil.

---

### Lanterns — Floor or Ceiling

Lanterns can be placed on the top surface of a solid block (resting on floor) or on the bottom surface of a solid block (hanging from ceiling). The block type does not matter as long as it has a solid top or bottom face. Lanterns drop if their supporting block is removed or if a trapdoor they are attached to is opened. They connect seamlessly to chains.

---

### Scaffolding — Max 6 Blocks Horizontal Overhang

Scaffolding remains supported as long as it is within 6 horizontal blocks of a scaffolding block that rests on a solid block. The 7th block in a horizontal chain will fall. Pressing use on a scaffolding's top face extends it horizontally in the direction you face. Sneaking while placing puts the new block on the clicked face instead.

---

### Snow Layers — Solid Block Top, Not Ice

Snow layers can only be placed on blocks with a solid top face, excluding ice blocks. They stack up to 8 layers. Snow cannot be placed on farmland. They break when water or lava flows into their space.

---

### Pointed Dripstone — Stalactite or Stalagmite

Place pointed dripstone on the underside of a block to create a stalactite (pointing down). Place on top of a block to create a stalagmite (pointing up). Placing between an existing stalactite and stalagmite without sneaking merges them into a column. Falling pointed dripstone (when the block above is removed) deals 1 heart per block fallen, capped at 40 hearts.

---

### Candles — Up to 4 Per Block, No Non-Solid Surfaces

Up to 4 candles of the same color can be placed in a single block space. Candles cannot be placed on non-solid blocks (chests, cobwebs). A single candle of any color can be placed on an uneaten cake. Waterlogged candles cannot be lit. Candles are not automatically lit when placed — ignite them with flint and steel or a fire charge.

---

### Glow Lichen — Any Face of Solid Block

Glow lichen attaches to any face of a solid block (top, bottom, or any of four sides). Multiple lichen can occupy the same block on different faces simultaneously. Glow lichen does not spread naturally — only with bone meal. It cannot be broken by flowing water or lava.

---

### Tripwire Hooks — Must Face Each Other

Attach tripwire hooks to the side of any solid block. Two hooks must face each other across a straight horizontal line, with 1–40 blocks of string (tripwire item) connecting them. The circuit only activates if both hooks face inward toward the string. An invalid hook (facing wrong direction or unconnected) appears "folded" instead of extended.

---

### End Rods — Any Surface of Any Block

End rods can be placed on any face of any block, including other end rods. Orientation is determined by the face you click — the rod points away from the surface clicked. End rods do not break when their supporting block is removed. Gravity blocks (sand, gravel) do not fall onto a vertically oriented end rod but do break on a horizontally oriented one.

---

### Grindstones — Wall, Floor, or Ceiling

Grindstones can be attached to vertical block faces (wall), placed on the floor, or hung from a ceiling. In Java Edition they do not require support and can float once placed. Pistons cannot move grindstones.

---

### Bells — Four Attachment Modes

Bells can attach to: a floor (standing), a ceiling (hanging), a single wall face, or between two opposing wall blocks (double-wall). Bells break if their attachment block is moved or destroyed, or if an attached trapdoor is opened. The facing direction is opposite to the direction you face when placing.

---

### Chorus Flowers — End Stone or Chorus Plant Only

Chorus flowers must be placed on end stone or an existing chorus plant block, or be directly above air while horizontally adjacent to exactly one chorus plant. They grow through ages 0–4 before reaching the final age 5 (no further growth). Bone meal has no effect. No placement on any other block type.

---

### Nether Portal Frame — Obsidian Rectangle, 4×5 Minimum

Build the portal frame as a vertical rectangle of obsidian with interior dimensions at least 2 wide by 3 tall (4×5 frame with corners, or 4×3 without corners). Maximum interior is 21×21. Portals cannot be built horizontally. Light the interior with fire (flint and steel, fire charge, or natural fire spread). The End dimension does not support nether portals.

---

### Flower Pots — Any Block in Java Edition

Flower pots can be placed on any block in Java Edition, including over air. They accept: any one-block-high flower, sapling, fern, dead bush, cactus, bamboo, azalea, mangrove propagule, crimson/warped roots, and mushrooms. The plant is removed from the pot by right-clicking it again.

---

### Campfires — Solid Block Surface

Place campfires on any solid block surface. Campfires face the direction you are looking when placed. A hay bale directly below a campfire creates a signal fire with tall smoke. Leave unobstructed air between a campfire and a beehive above it to pacify bees during harvest.

---

### Piston — Cannot Push These Blocks

Pistons cannot push: bedrock, obsidian, crying obsidian, respawn anchor, enchanting table, command blocks, structure blocks, jigsaw blocks, barrier blocks, end portal frames, end portals, nether portals, beacons, and moving piston heads. Blocks with inventories (chests, furnaces, hoppers, dispensers, droppers, etc.) cannot be pushed either. Exceeding the 12-block push limit causes the piston to fail silently.

---

### Waterlogging Rules

Many non-full blocks can be waterlogged (placed inside a water source block while retaining their shape): stairs, slabs, fences, fence gates, walls, trapdoors, iron bars, glass panes, chests, boats, and more. To waterlog a block, place it directly into an existing water source block. Waterlogged blocks still produce their normal function while filled with water. Candles and redstone components (repeaters, comparators, redstone dust) are destroyed by water in Java Edition — they are not waterloggable.

---

### Block Update Propagation — Placement Side Effects

Some blocks pop off when a neighboring block updates:
- Torches, redstone torches, levers, buttons, and rails break if their support is removed.
- Vines without a solid horizontal backing disappear on any neighbor update.
- Doors and trapdoors destroy soft blocks (snow layers, grass, plants) in their swing path when opened.
- Cactus breaks immediately if any horizontally adjacent block becomes solid.
- Scaffolding beyond 6 horizontal blocks collapses entirely when the chain becomes unsupported.

Always account for cascading updates when placing or removing blocks in a complex structure.

---

### General Solid Block Definition (for Placement Support)

A block qualifies as solid for supporting most placeable blocks if it: (a) explicitly listed as solid in the game's registry, (b) has a collision box totaling 35+ pixels across axes, or (c) maintains 16+ pixels vertical extent. Forcibly non-solid blocks — including azalea, big dripleaf, chorus flower/plant, ladder, and snow layers — cannot support most placements despite appearing physical.

---
