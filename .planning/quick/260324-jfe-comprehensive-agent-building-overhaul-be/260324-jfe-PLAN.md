# Quick Task 260324-jfe: Comprehensive Agent Building Overhaul

**Goal:** Make Luna + John genuinely capable of building creative, human-quality structures by improving the entire building pipeline: better reference blueprints (as inspiration, not templates to copy), enhanced design prompts with architectural guidance, terrain clearing, road building, smarter site selection, and auto-lighting.

**Key Principle:** Agents should conceptualize their own builds. Reference blueprints teach JSON FORMAT and structural PATTERNS, but the design prompt must strongly encourage creative originality.

---

## Plan 01: Reference Blueprints + Design Prompt Enhancement

### Task 1: Add architecturally diverse reference blueprints
**files:** `body/blueprints/*.json`
**action:** Create 6 new reference blueprints that demonstrate advanced architectural patterns the LLM should learn from:
1. `tavern.json` — 8x10, 2-floor with peaked stair roof, windows, interior furnishing (tables, fireplace area), overhanging second floor
2. `market-stall.json` — 5x4 open-front structure with slab awning, fence posts, counter surface
3. `town-hall.json` — 10x12, peaked roof, double-height interior, balcony, stone base with wood upper
4. `garden-pavilion.json` — 6x6 open-walled structure with fence railings, slab roof, flower beds, pathway
5. `stone-wall-section.json` — 10x1x4 wall segment with crenellations (alternating full/half blocks at top), torch brackets
6. `cobblestone-road.json` — 1x1x10 road segment with gravel border, demonstrates path pattern

Each must demonstrate: peaked roofs (stairs), material mixing (2-3 block types), interior details (torches, functional blocks), non-box shapes where possible.

**verify:** All 6 files validate via `body/blueprints/validate.js` schema
**done:** New blueprints exist and are loadable

### Task 2: Enhance the design prompt for creative originality
**files:** `mind/prompt.js`
**action:** Rewrite `buildDesignPrompt()` to:
1. Emphasize creative originality: "These examples show the JSON FORMAT. Your design should be ORIGINAL — unique shape, creative material choices, interesting details"
2. Add architectural guidance section:
   - Roof variety: peaked (use stairs like oak_stairs, stone_brick_stairs), sloped (slabs at edges), flat only for small utility structures
   - Material mixing rules: always use 2-3 block types. Primary (walls), secondary (trim/corners), accent (details)
   - Interior expectations: torches every 5 blocks, functional blocks if appropriate (chests, crafting_table, furnace)
   - Proportion guidelines: wall height = width/2 + 1, doors on ground floor only, windows at eye level (y+2)
   - Shape variety: L-shapes, T-shapes, overhangs, porches, recessed doorways
3. Cap reference examples at 2 (not 3) to reduce prompt size and copying tendency
4. Add "DO NOT copy reference structures. Design something new that fits the description."

**verify:** `buildDesignPrompt()` returns enhanced prompt with architectural guidance
**done:** Design prompt updated

### Task 3: Add site selection and city planning hints to system prompt
**files:** `mind/prompt.js`
**action:** Update `buildSystemPrompt()` Part 2 (city building section) to add:
1. Before building: "Check your build history and locations. Find a spot 10-20 blocks from nearest existing building."
2. Terrain check: "Use !scan before building. Pick flat ground. Avoid water, lava, and steep hills."
3. City coherence: "Face buildings toward the town center or main road. Group related buildings (workshops near resources, homes near town center)."
4. Spacing: "Leave 3-5 blocks between buildings for roads and foot paths."
5. Update the example to show checking build history first

**verify:** System prompt includes site selection guidance
**done:** Prompt updated

---

## Plan 02: New Body Skills (Clear + Road + Torch)

### Task 1: Terrain clearing skill
**files:** `body/skills/clear.js` (new), `mind/registry.js`, `mind/prompt.js`
**action:**
1. Create `body/skills/clear.js` exporting `clear(bot, width, depth)`:
   - Starting at bot position, clear a `width x depth` area (default 10x10, max 20x20)
   - Remove all non-ground blocks above ground level (trees, flowers, tall grass)
   - Uses bot.dig() on each block, navigating as needed
   - Cooperative interrupt support
   - Returns { success, cleared: count, width, depth }
2. Register in `mind/registry.js`: `['clear', (bot, args) => clear(bot, parseInt(args.width) || 10, parseInt(args.depth) || 10)]`
3. Add to command reference in `mind/prompt.js`: `!clear width:N depth:N — flatten area for building`

**verify:** `!clear` is registered and listed in commands
**done:** Terrain clearing skill exists

### Task 2: Road/path building skill
**files:** `body/skills/road.js` (new), `mind/registry.js`, `mind/prompt.js`
**action:**
1. Create `body/skills/road.js` exporting `buildRoad(bot, toX, toZ, material)`:
   - Lays a 3-wide path from bot's current position to target x,z
   - Default material: cobblestone (configurable: gravel, stone_bricks, etc.)
   - Path follows straight line, placing blocks at ground level
   - Replaces grass/dirt with path material, clears obstacles above
   - Cooperative interrupt support
   - Returns { success, placed: count, from: {x,z}, to: {x,z} }
2. Register in `mind/registry.js`: `['road', (bot, args) => buildRoad(bot, parseInt(args.x), parseInt(args.z), args.material || 'cobblestone')]`
3. Add alias `path` → `road` in ALIASES
4. Add to command reference in `mind/prompt.js`: `!road x:N z:N material:cobblestone — build a 3-wide road to coordinates`

**verify:** `!road` and `!path` are registered and listed in commands
**done:** Road building skill exists

### Task 3: Auto-torch placement after build completion
**files:** `body/skills/build.js`
**action:**
1. After the placement loop completes successfully (line ~397), before clearing state:
   - Scan the interior of the built structure (1 block inside each wall)
   - Place torches on the floor every 4-5 blocks (check for air above, solid below)
   - Use bot.equip + placeBlock for torch placement
   - Non-fatal: if no torches in inventory, skip silently
2. Add a `placeTorchesInside(bot, originX, originY, originZ, sizeX, sizeZ)` helper function
3. Torch placement criteria: block below is solid, block at position is air, block above is air, not on the perimeter (walls)

**verify:** After successful build, torches are attempted inside the structure
**done:** Auto-torch placement exists
