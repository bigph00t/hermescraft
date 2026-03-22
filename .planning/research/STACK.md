# Stack Research

**Domain:** Minecraft AI Agent — Tool Quality & Building Intelligence (v1.1)
**Researched:** 2026-03-21
**Confidence:** HIGH — all key packages verified by live execution against the running codebase

---

## Context: What This Research Covers

The v1.0 STACK.md concluded "no new dependencies required." That was true for v1.0.

v1.1 requires:
- A recipe database with dependency chain solving
- Item name normalization (LLM outputs wrong names constantly)
- Block placement tracking (persistent spatial record)
- Spatial memory / world map
- Smart place action (mod-side: auto-equip, look-at-surface, place-on-face)
- Chest interaction (new mod action: open chest, deposit/withdraw)

This document covers ONLY the additions and changes needed for these features.

---

## Recommended Stack — New Additions

### Recipe Database

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `minecraft-data` | 3.105.0 (already installed) | Complete 1.21.1 recipe, item, and block database | Already in `node_modules`. Verified: 1333 items, 782 recipe output types, full 1.21.1 data. ESM `import` works directly. Used by Mindcraft and every serious MC bot project. |

**Verified behavior (live test 2026-03-21):**
```javascript
import minecraftData from 'minecraft-data'
const mcData = minecraftData('1.21.1')

// Item lookup by name (canonical names, not LLM variants)
mcData.itemsByName['stick']      // { id: 848, name: 'stick', displayName: 'Stick', ... }
mcData.itemsByName['oak_planks'] // { id: 36, name: 'oak_planks', ... }

// Recipe lookup by item ID (returns array — multiple variants per item)
mcData.recipes[848]  // all stick recipes
// Each recipe: { inShape: [[id, id], ...], result: { id, count } }  (shaped)
//           or: { ingredients: [id, ...], result: { id, count } }   (shapeless)

// Resolve ingredient IDs back to names
mcData.items[132].name  // 'oak_log'
```

**Recipe chain solver approach — no library needed, write it in `agent/crafting.js`:**

The chain solver is ~60 lines of recursive JS. No external package is warranted. The pattern:

1. Look up target item via `itemsByName[name]`
2. Get recipes via `recipes[item.id]`
3. For each ingredient, prefer the variant the agent actually has (inventory-aware recipe selection)
4. Recurse into missing ingredients until hitting raw materials (no recipes)
5. Return ordered `[{ craft: name, need: [{item, count}], output_count }]` list

Key implementation note: wooden_pickaxe has 11 recipe variants (one per plank type). The solver must prefer recipes whose ingredients the agent already has — not blindly pick recipe index 0. Confirmed: filtering `recipes[id]` by `inShape.flat().some(id => inventory.has(mcData.items[id]?.name))` works correctly.

**ESM import (no workaround needed):** `minecraft-data` is CJS but Node.js permits `import` of CJS packages from ESM files. The package is already in the project and confirmed working with `import minecraftData from 'minecraft-data'`.

---

### Item Name Normalization

**Approach: hardcoded alias map in `agent/item-names.js` — no library needed.**

The problem is specific and bounded: LLMs output ~20 common wrong names. A lookup table is the right tool.

Confirmed wrong names from live testing:
- `sticks` → `stick`
- `oak_planks_4` → `oak_planks` (LLM appends count to name)
- `log` → `oak_log`
- `wood_pickaxe` → `wooden_pickaxe`
- `oak_door_3` → `oak_door`

Normalization strategy (in priority order):
1. Strip `minecraft:` prefix
2. Strip trailing `_N` (count suffix) — regex `/^(.+?)_\d+$/`
3. Map known plural → singular: `sticks→stick`, `logs→log`, etc.
4. Map deprecated aliases: `log→oak_log`, `wood_pickaxe→wooden_pickaxe`, `planks→oak_planks`, `stone→cobblestone` (for crafting context)
5. Validate against `mcData.itemsByName` — if not found after normalization, fuzzy match (prefix search)

The normalized name feeds into: `validatePreExecution`, `craft` action, `place` action, `equip` action, recipe chain solver.

`minecraft-data` serves as the ground truth for valid item names: `mcData.itemsByName[normalized]` returns `null` for invalid names, enabling rejection with a clear error message.

---

### Block Placement Tracking

**Approach: JSON file, same pattern as `chests.js` — no library needed.**

New module: `agent/placed-blocks.js`

```javascript
// Schema per entry:
{
  "x,y,z": {
    block: "oak_planks",    // block name placed
    by: "jeffrey",          // agent name
    ts: 1234567890,         // unix timestamp
    purpose: "wall"         // optional context tag
  }
}
```

Why JSON (not SQLite, not rbush-3d):
- Max scale is ~2000 placed blocks per agent before a session, not millions
- Queries needed: "what did I place here?" (key lookup) and "what have I placed nearby?" (iterate + distance filter)
- A plain JS `Map` keyed by `"x,y,z"` strings handles both in microseconds at this scale
- No 3D spatial index library is warranted — rbush-3d adds 50KB for a problem that doesn't exist yet
- Saved to `agent/data/{name}/placed-blocks.json` on write, loaded on init

The block tracker feeds:
- Build verification (compare intended blueprint vs what was actually placed)
- The spatial world map (placed blocks are tagged as agent-built)
- Future: selective cleanup/teardown if a build needs revision

---

### Spatial Memory (World Map)

**Approach: extend `locations.js` with typed categories — no library needed.**

The existing `locations.js` stores named points as `{x, y, z, type, saved}`. Extend it with:

```javascript
// New categories for spatial memory:
// type: 'resource'  — known resource deposits (oak forest at X,Y,Z)
// type: 'chest'     — storage (deduplicate with chests.js later)
// type: 'build'     — agent construction sites
// type: 'hazard'    — cliffs, water, danger zones
// type: 'poi'       — points of interest (village, structure)
```

The world map summary in the prompt becomes:
```
Known locations: home(12,64,-8) | oak_forest(45,70,20) | shared_chest(-3,65,2) | build_site(20,65,-15)
```

Radius-based lookup (for "what's near me?"): iterate all locations, filter `Math.sqrt((px-lx)**2 + (pz-lz)**2) < radius`. Sufficient for <200 named locations.

No geospatial library (GeoJSON, rbush, etc.) is warranted at this scale. The vec3 package (already used by mineflayer, which is in node_modules) could provide cleaner distance math but the native approach is simpler and has zero overhead.

---

### Smart Place Action — Mod Side

**No new libraries. Java mod changes only.**

The current `place` action requires:
- Exact target coordinates (LLM guesses wrong)
- Item already in hotbar (not just inventory)

The smart place action replaces it with a workflow the mod handles internally:
1. Auto-equip: scan inventory for the requested item, move to hotbar if needed
2. Raycast from player: find which surface the player is looking at
3. Place on that surface face (uses existing BlockHitResult logic, already correct)

This is Java code in `ActionExecutor.java`. No new dependencies. The existing `selectHotbarItem`, `lookAtPos`, and `BlockHitResult` infrastructure already exists — smart place is a coordination wrapper around them.

**New action schema:**
```json
{ "type": "smart_place", "item": "oak_planks" }
```

Agent looks at target surface first (via `look_at_block`), then calls `smart_place`. The mod handles equip + place-on-face as a single atomic operation.

---

### Chest Interaction — Mod Side

**No new libraries. Java mod changes + new Node.js module.**

The mod needs a new `open_chest` action that:
1. Navigates to chest (if needed — delegate to Baritone or just check range)
2. Right-clicks chest (opens screen handler)
3. Returns chest contents as JSON
4. Executes deposit/withdraw slot operations
5. Closes screen

Fabric API provides `ContainerLockableOpenableMixin` / `GenericContainerScreenHandler` for this. The existing `interact_block` action already opens the chest GUI — the missing piece is reading the chest inventory and moving items.

New mod endpoints:
- `POST /action` with `{"type": "chest_open", "x": N, "y": N, "z": N}` — opens and returns contents
- `POST /action` with `{"type": "chest_deposit", "item": "oak_planks", "count": 32}` — deposits from inventory
- `POST /action` with `{"type": "chest_withdraw", "item": "stick", "count": 8}` — withdraws to inventory

On the Node.js side, `agent/chests.js` already tracks chest contents — it will be updated to populate from `chest_open` responses rather than manual inference.

---

## No New npm Dependencies Required

All v1.1 features are implementable with:
- `minecraft-data` 3.105.0 (already installed — not in package.json yet, add it)
- Native Node.js file I/O (already used throughout)
- Java mod changes (no new Fabric dependencies — existing API is sufficient)

### Add to package.json

```bash
npm install minecraft-data
```

It's already in `node_modules` (pulled in by `mineflayer`), but should be declared as a direct dependency so it's not accidentally pruned.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `minecraft-data` recipe lookup | `/recipes` mod endpoint (existing) | The mod endpoint works for single lookups but can't do dependency chain resolution — it requires being in-game and makes an HTTP round-trip per lookup. Use the mod endpoint as fallback/verification, use minecraft-data for chain solving. |
| Hardcoded alias map for normalization | LLM prompt engineering only | Prompt engineering alone is insufficient — live testing showed the LLM continues to output wrong names even with correction in the system prompt. A normalization layer is mandatory. |
| Extend `locations.js` for spatial memory | New dedicated spatial module | Dedicated module is only warranted when locations exceed ~500 entries or when spatial queries need radius indexing. Not needed yet. |
| `"x,y,z"` string keys for placement tracking | rbush-3d, QuadTree, or spatial DB | rbush-3d and similar are for 100K+ point queries with bounding box search. HermesCraft's placement tracking peaks at ~2000 blocks per session with simple key lookup queries. Overhead is not justified. |
| Java mod chest action | mineflayer chest API | mineflayer is declared in package.json but explicitly not used. The entire agent uses the Fabric mod HTTP bridge. Adding mineflayer chest interaction would create a split architecture. Stay with the mod. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `prismarine-recipe` | Last updated 2022, requires `prismarine-registry` peer dep, superseded by `minecraft-data` | `minecraft-data` which already includes all recipe data |
| `rbush-3d` / spatial index libraries | Gross overkill for <2000 block coordinate lookups | Plain JS object/Map with `"x,y,z"` string keys |
| SQLite / better-sqlite3 | Block tracking and spatial memory don't need relational queries; adds native addon compilation | JSON files with in-memory Maps (existing pattern in `chests.js`, `locations.js`) |
| `mineflayer` chest/crafting APIs | Architecture is Fabric mod + HTTP bridge, not mineflayer. Using both creates two inconsistent game interaction paths | Java mod actions via `/action` endpoint |
| External crafting chain solver packages | None are maintained for 1.21.1, all are underpowered or mineflayer-coupled | Custom `agent/crafting.js` using `minecraft-data` (~60 lines) |

---

## Integration Points with Existing Code

| New Feature | Integrates With | How |
|-------------|-----------------|-----|
| `minecraft-data` recipe lookup | `agent/actions.js` `validatePreExecution` | Replace hardcoded craft checks with recipe DB lookup |
| Recipe chain solver | New `agent/crafting.js` | Called by `plan_task` action and planner when crafting is needed |
| Item name normalization | `agent/actions.js` `executeAction` | Normalize `action.item` before sending to mod API |
| Block placement tracker | `agent/builder.js` `tickBuilder` | Record each successful `place` result |
| Spatial memory | `agent/locations.js` | Add typed categories, update auto-detection |
| Smart place | `mod/.../ActionExecutor.java` | New `case "smart_place"` + auto-equip wrapper |
| Chest interaction | `mod/.../ActionExecutor.java` + `agent/chests.js` | New mod actions + update chests.js to use mod data |

---

## Version Compatibility

| Package | Version | Notes |
|---------|---------|-------|
| `minecraft-data` | 3.105.0 | Supports 1.21.1 specifically. Confirmed: all items, blocks, recipes correct. |
| Node.js | 20+ | ESM import of CJS `minecraft-data` works without `createRequire` workaround |
| Fabric Mod | 1.21.1 | Chest `GenericContainerScreenHandler` API stable in 1.21.1. No API changes expected for new actions. |

---

## Sources

- `minecraft-data` npm — live tested against 1.21.1 dataset: 1333 items, 782 recipe types, ESM import confirmed working
- `node-minecraft-data` GitHub — API docs confirmed: `itemsByName`, `recipes[id]`, `items[id]`, `blocksByName`
- `minecraft-data` GitHub — version list confirmed: 1.21.1 is a first-class supported version (not aliased)
- Mindcraft `package.json` (verified via WebFetch) — uses `minecraft-data: ^3.97.0`, confirming it as the ecosystem standard
- Live codebase inspection — `minecraft-data` already in `node_modules` (dependency of `mineflayer`), version 3.105.0
- `ActionExecutor.java` live read — existing `place`, `interact_block`, `selectHotbarItem` infrastructure confirmed; smart_place is a coordination wrapper
- `chests.js`, `locations.js` live read — existing JSON file pattern confirmed as correct approach for block tracking and spatial memory

---

*Stack research for: HermesCraft v1.1 Tool Quality & Building Intelligence*
*Researched: 2026-03-21*
