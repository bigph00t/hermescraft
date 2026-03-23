# Phase 11: Knowledge Corpus - Research

**Researched:** 2026-03-22
**Domain:** minecraft-data API, knowledge chunking, recipe chain resolution, Markdown parsing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Corpus builder lives at `mind/knowledge.js` — follows existing mind/ module convention
- Chunk metadata schema: `{ id, text, type, tags[], source }` — minimal, sufficient for filtering and retrieval
- Chunk IDs are human-readable: `{type}_{name}` e.g. `recipe_iron_pickaxe`, `mob_creeper`
- Hand-authored knowledge files live in `knowledge/` at project root
- Full chain to raw materials: "iron pickaxe needs iron ingots (smelt iron ore) + sticks (planks from logs)"
- Pick simplest variant per item when multiple recipe variants exist, note alternatives
- Include smelting steps in recipe chains (e.g. iron_ore -> iron_ingot via furnace)
- One chunk per final craftable item containing its full dependency chain
- 7 topic files per ROADMAP: building, farming, mining, combat, survival, biomes, structures
- ~40 chunks per file, ~300 total — practical gameplay tips the agent can act on
- Imperative directive writing style: "Mine diamonds at Y=-58 with iron pickaxe or better"
- Expand and restructure existing POC files (food.md, building.md) rather than starting from scratch
- Chunk size target: 40-150 tokens per chunk (fits embedding model's 256-token window in Phase 12)
- Always-present core knowledge (~1,500 tokens) replaces current GAMEPLAY_INSTRUCTIONS
- Retrieval triggers: explicit !wiki, on failure, phase change — NOT every tick

### Claude's Discretion
- Internal chunk parsing and serialization format details
- Exact markdown heading-to-chunk splitting logic
- Command documentation extraction heuristics from registry.js
- Validation and statistics reporting format

### Deferred Ideas (OUT OF SCOPE)
- Redstone, enchanting, brewing knowledge — future milestone scope
- Vector memory replacing flat MEMORY.md (MEM-01, MEM-02) — future milestone
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RAG-01 | All MC 1.21.1 recipes auto-generated from minecraft-data into retrievable chunks with full dependency chains | minecraft-data `recipes` object has 782 craftable items; chain resolver needs hardcoded smelting table; cycle prevention required |
| RAG-02 | All blocks, items, mobs, biomes, foods from minecraft-data indexed with properties and relationships | mcData has 1060 blocks, 1333 items, 41 foods, 83 mobs (hostile+passive), 64 biomes; selective chunking strategy documented |
| RAG-03 | Hand-authored strategic knowledge: building, farming, mining, combat, survival, biomes, structures (~300 chunks) | 7 files x ~40 H2/H3 sections each; existing POC files have 4-6 sections and need 8x expansion |
| RAG-04 | All !commands auto-documented from registry with args, usage patterns, failure modes, and examples | 21 commands in REGISTRY; command arg schemas available in prompt.js Part 6; failure modes from skill source |
</phase_requirements>

---

## Summary

Phase 11 builds a corpus of structured text chunks from four sources: auto-generated crafting recipe chains (minecraft-data), auto-generated fact chunks for game objects (minecraft-data), hand-authored strategic gameplay knowledge (Markdown files), and auto-generated command documentation (registry.js + prompt.js). The output is an array of `{ id, text, type, tags, source }` objects held in module-level state, ready for Phase 12 to embed and index.

The core technical challenge is **recipe chain resolution**: minecraft-data v3.105.0 (the installed version) provides only crafting table recipes — no furnace/smelting data. A hardcoded smelting table must be embedded in `mind/knowledge.js` to complete chains like iron_ore -> raw_iron -> smelt -> iron_ingot. A secondary challenge is **cycle detection**: the recipes object contains circular references (iron_ingot <-> iron_nugget, iron_ingot <-> iron_block) that will infinite-loop a naive recursive resolver without a visited-set guard and a preference for smelting paths over craft-from-smaller-units paths.

The hand-authored Markdown files need substantial expansion: the existing POC files (`agent/knowledge/food.md`, `agent/knowledge/building.md`) contain 4-6 H2 sections each, but the ~40 sections-per-file target requires 8x more content. The new `knowledge/` root directory will hold 7 topic files.

**Primary recommendation:** Build `mind/knowledge.js` with four generators in sequence: `buildRecipeChunks()`, `buildFactChunks()`, `buildStrategyChunks()`, `buildCommandChunks()`. Export `initKnowledge(config)` and `getAllChunks()`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| minecraft-data | 3.105.0 (installed) | Recipes, blocks, items, mobs, biomes, foods | Already installed; this project already uses it in `body/skills/build.js` |
| Node.js `fs` (built-in) | — | Read hand-authored Markdown files from `knowledge/` directory | No external dependency needed; consistent with memory.js pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js `path` (built-in) | — | Resolve `knowledge/` directory path via `import.meta.url` | Consistent with other modules' `__dirname` pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hardcoded smelting table | External smelting JSON | Smelting table is ~20 entries; external file adds complexity with no benefit |
| H2-based Markdown splitting | Remark/unified parser | Simple `split(/\n## /)` is sufficient for controlled internal files; no external dep needed |
| Inline command schemas | registry.js metadata fields | Adding metadata to registry.js would require touching an existing module; inline in knowledge.js is simpler for Phase 11 |

**Installation:** No new packages required. All sources use existing installed dependencies.

---

## Architecture Patterns

### Recommended Project Structure
```
mind/
└── knowledge.js          # New corpus builder module

knowledge/                # New directory at project root
├── building.md           # Building techniques, material selection
├── farming.md            # Crop farming, animal breeding, food
├── mining.md             # Ore depths, tool tiers, cave navigation
├── combat.md             # Mob behaviors, combat tactics, armor
├── survival.md           # Day/night cycle, food, shelter, respawn
├── biomes.md             # Biome types, resources, structures
└── structures.md         # Generated structures, finding them, looting
```

### Pattern 1: Module Init with Lazy Build
**What:** `initKnowledge(config)` stores config, sets `KNOWLEDGE_DIR`. `loadKnowledge()` builds all chunks synchronously at startup and stores in module-level `let chunks = []`.
**When to use:** Called in `start.js` before `initMind()`, same ordering as `initMemory()`.
**Example:**
```javascript
// mind/knowledge.js — Minecraft knowledge corpus builder

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import minecraftData from 'minecraft-data'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mcData = minecraftData('1.21.1')

let KNOWLEDGE_DIR = ''
let chunks = []

export function initKnowledge(config) {
  KNOWLEDGE_DIR = join(__dirname, '..', 'knowledge')
  // config not currently needed but passed for future use
}

export function loadKnowledge() {
  chunks = [
    ...buildRecipeChunks(),
    ...buildFactChunks(),
    ...buildStrategyChunks(),
    ...buildCommandChunks(),
  ]
  return chunks
}

export function getAllChunks() {
  return chunks
}
```

### Pattern 2: Recipe Chain Resolver with Smelting Override
**What:** Recursive DFS over `mcData.recipes`, using a visited-set to prevent cycles, and a hardcoded `SMELTING_INPUTS` map to short-circuit smelted ingredients to their ore source.
**When to use:** Called inside `buildRecipeChunks()` for each of the 782 recipe item IDs.

```javascript
// Hardcoded smelting table — minecraft-data has NO furnace recipe data
// Keyed by PRODUCT, value is the input (what you smelt to get the key)
const SMELT_FROM = {
  iron_ingot:    'raw_iron',
  gold_ingot:    'raw_gold',
  copper_ingot:  'raw_copper',
  glass:         'sand',
  stone:         'cobblestone',
  smooth_stone:  'stone',
  brick:         'clay_ball',
  terracotta:    'clay',
  charcoal:      'oak_log',   // any log works
  nether_brick:  'netherrack',
  netherite_scrap: 'ancient_debris',
  cooked_beef:   'raw_beef',
  cooked_porkchop: 'raw_porkchop',
  cooked_chicken: 'raw_chicken',
  cooked_mutton: 'raw_mutton',
  cooked_rabbit: 'raw_rabbit',
  cooked_cod:    'raw_cod',
  cooked_salmon: 'raw_salmon',
  baked_potato:  'potato',
  dried_kelp:    'kelp',
}

// SMELT_FROM inverse: given an input, what does it smelt into?
// Used when we encounter raw_iron as ingredient — we know it needs smelting context

function resolveIngredients(itemId, visited) {
  const item = mcData.items[itemId]
  if (!item) return null

  // Cycle guard
  if (visited.has(item.name)) return `${item.name} (cycle — use smelt path)`
  visited.add(item.name)

  // If this item is produced by smelting, show that path instead of craft path
  if (SMELT_FROM[item.name]) {
    const input = SMELT_FROM[item.name]
    return `${item.name} (smelt ${input})`
  }

  const recipes = mcData.recipes[itemId]
  if (!recipes || recipes.length === 0) {
    return `${item.name} (gather/mine)`
  }

  // Pick simplest recipe (fewest ingredients)
  const recipe = recipes.reduce((a, b) => {
    const countA = flattenRecipe(a).length
    const countB = flattenRecipe(b).length
    return countA <= countB ? a : b
  })

  const ingIds = flattenRecipe(recipe)
  const ingNames = [...new Set(ingIds.map(id => mcData.items[id]?.name).filter(Boolean))]
  const subChains = ingNames.map(name => {
    const id = mcData.itemsByName[name]?.id
    if (id === undefined) return `${name} (unknown)`
    return resolveIngredients(id, new Set(visited))
  })

  return `${item.name} (craft from: ${ingNames.join(', ')}) — ${subChains.join('; ')}`
}
```

### Pattern 3: Markdown Heading Splitter
**What:** Split file content on H2 or H3 headings, treat each section as one chunk. Clean up whitespace, compute tag from heading text.
**When to use:** Inside `buildStrategyChunks()` for each file in `knowledge/`.

```javascript
function parseMarkdownChunks(filePath, fileType) {
  const content = readFileSync(filePath, 'utf-8')
  // Split on H2 headings (## ), keeping the heading in the section
  const sections = content.split(/(?=^## )/m).filter(s => s.trim())

  return sections.flatMap(section => {
    // Also split on H3 within a section if needed for size
    const h3Sections = section.split(/(?=^### )/m).filter(s => s.trim())
    return h3Sections.map(s => {
      const lines = s.trim().split('\n')
      const heading = lines[0].replace(/^#+\s*/, '').toLowerCase().replace(/\s+/g, '_')
      const text = s.trim()
      return {
        id: `${fileType}_${heading}`,
        text,
        type: 'strategy',
        tags: ['strategy', fileType, heading],
        source: 'hand-authored',
      }
    })
  })
}
```

### Pattern 4: Command Chunk Generator
**What:** Use the static command schema already defined in `prompt.js` Part 6 (the `!command` reference section) as the canonical arg definition source. Combine with failure mode annotations added inline in `buildCommandChunks()`.
**When to use:** RAG-04 auto-generation.

The 21 registered commands (confirmed by smoke test `registry has 21 commands`): gather, mine, craft, smelt, navigate, chat, drop, idle, combat, deposit, withdraw, build, design, scan, farm, breed, mount, dismount, look, give, material.

```javascript
// Static command schema — sourced from prompt.js Part 6 + registry.js
const COMMAND_SCHEMAS = [
  {
    name: 'gather',
    usage: '!gather item:name count:N',
    purpose: 'Collect blocks from the world surface (trees, dirt, sand, flowers)',
    args: { item: 'block name', count: 'number (default 1)' },
    examples: ['!gather item:oak_log count:5', '!gather item:dirt count:16'],
    failures: ['item not found nearby', 'no pathable route to target'],
  },
  // ... etc for all 21 commands
]
```

### Anti-Patterns to Avoid
- **Naive cycle traversal without visited-set:** iron_ingot has a craft recipe from 9 iron_nuggets, iron_nugget crafts from 1 iron_ingot -> infinite recursion. Always pass `new Set(visited)` (a copy, not the same set) into sub-calls so sibling ingredients don't falsely block each other.
- **Trusting minecraft-data for smelting:** The library has no furnace recipe data. `mcData.furnaceRecipes` is undefined. Raw_iron -> iron_ingot via smelting is not in `mcData.recipes` — only the crafting table variant (9 nuggets or iron block) appears. Without the `SMELT_FROM` table, iron_pickaxe chains will show "iron_ingot (craft from: iron_nugget, iron_nugget...)" which is correct but misleading for the agent.
- **Using `mcData.recipes[id]` with item id from itemsByName directly for recipes with shapeless form:** Some recipes use `ingredients` array (shapeless) and others use `inShape` (shaped). Both must be handled in `flattenRecipe()`.
- **Splitting Markdown on H1:** Knowledge files use H2 (`##`) as the primary chunk boundary. H1 is the file title, not a chunk.
- **Generating fact chunks for ALL 1060 blocks:** 1060 blocks x 1333 items = too many low-value chunks. Selective chunking strategy required (see Common Pitfalls).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Block/item/mob/biome data | Custom JSON files | `minecraft-data` `mcData.blocksArray`, `mcData.itemsArray`, `mcData.entitiesArray`, `mcData.biomesArray` | Already installed, maintained, version-locked to 1.21.1 |
| Recipe lookup | Scrape wiki or parse .jar | `mcData.recipes[itemId]` | Complete crafting table recipes for all 782 craftable items |
| Item ID to name mapping | Manual table | `mcData.items[id].name` and `mcData.itemsByName[name].id` | Bidirectional lookup built-in |
| Food stats (hunger/saturation) | Hardcode | `mcData.foodsArray` with `foodPoints`, `saturation`, `effectiveQuality` | 41 food items with all stats |
| Hostile mob list | Hardcode | `mcData.entitiesArray.filter(e => e.category === 'Hostile mobs')` | 42 hostile mobs; already used in `body/skills/combat.js` |

**Key insight:** minecraft-data covers the structured data completely. Only smelting/furnace recipes and strategic gameplay knowledge need to be hand-supplied.

---

## Common Pitfalls

### Pitfall 1: Recipe Chain Cycles
**What goes wrong:** Recursive ingredient resolution hits iron_ingot -> iron_nugget -> iron_ingot and stack-overflows or infinite-loops.
**Why it happens:** `mcData.recipes[iron_ingot.id]` returns two recipes: "9x iron_nugget" and "1x iron_block uncrafts to 9 ingots". Both point back to items that have iron_ingot in their own recipes.
**How to avoid:** Pass a `visited` Set into every recursive call. More importantly, intercept items in `SMELT_FROM` before recursing — metals come from smelting raw ores, not from crafting smaller units.
**Warning signs:** Node process hangs during `loadKnowledge()`. Stack overflow error. Missing items in final chunk list.

### Pitfall 2: minecraft-data Has No Smelting Recipes
**What goes wrong:** `mcData.furnaceRecipes` is `undefined`. The resolver returns "iron_ingot (craft from: iron_nugget...)" which is technically correct but never describes the actual gameplay path (mine iron_ore -> raw_iron -> smelt -> iron_ingot).
**Why it happens:** minecraft-data v3.105.0 does not include furnace recipe data for 1.21.1 (confirmed by checking the `/minecraft-data/data/pc/1.21.1/` directory contents, which has no smelting.json).
**How to avoid:** Embed `SMELT_FROM` map in `mind/knowledge.js`. For any item that IS a smelting product, the chain shows "smelt X" instead of the craft path. The ~20 smelting pairs cover all gameplay-relevant cases.
**Warning signs:** Agent chains for iron_pickaxe show "craft from: iron_nuggets" instead of "smelt raw_iron".

### Pitfall 3: Chunk Count Exceeds 256-Token Limit
**What goes wrong:** Phase 12 embedding model has 256-token context. A chunk with 300+ tokens gets truncated, losing tail content.
**Why it happens:** Recipe chains with many sub-ingredients can be verbose. Markdown sections with 20+ bullet points exceed the limit.
**How to avoid:** Cap recipe chain depth at 3 levels. Inline only the first-level ingredients + one sentence for each. For Markdown chunks, target H3-level granularity (one concept per chunk, not one topic area).
**Warning signs:** `text.split(' ').length > 180` (rough token proxy). Verify with: `Math.round(chunk.text.length / 4) > 256`.

### Pitfall 4: Block Count Inflation for RAG-02
**What goes wrong:** `mcData.blocksArray.length` is 1060 but most are state variants (open/closed door, powered/unpowered rail, etc.). Generating 1060 fact chunks for blocks wastes tokens on near-duplicate content.
**Why it happens:** minecraft-data encodes every block state as a separate block entry.
**How to avoid:** Filter to "canonical" blocks only: deduplicate on block name, then further filter to blocks that are either: (a) harvestable by the agent (has `diggable: true`), (b) craftable (appears in items), or (c) has gameplay significance (ore, mob spawner, chest, furnace, crafting_table). Target ~150-200 block chunks, not 1060.
**Warning signs:** `buildFactChunks()` returns >1000 chunks — that's too many.

### Pitfall 5: Hand-Authored Files Use Wrong Chunk Granularity
**What goes wrong:** Each knowledge file uses 1-2 H2 sections covering a broad topic. The retrieval system in Phase 12 can't distinguish "farming wheat" from "farming animals" because they're in the same chunk.
**Why it happens:** The existing POC files (food.md: 4 H2 sections, building.md: 6 H2 sections) were written for human reading, not retrieval.
**How to avoid:** Structure each H2 section around a single actionable concept. Use H3 subsections within H2 if needed. Each chunk should answer exactly ONE specific question: "How do I find diamonds?", "What do creepers do?", "How do I build a farm?".
**Warning signs:** Chunk text contains multiple unrelated topics separated by blank lines.

### Pitfall 6: Command Chunks Duplicate prompt.js Content
**What goes wrong:** RAG-04 command chunks contain arg syntax that differs from the canonical `!command reference` in `prompt.js`. Agent sees contradictory information.
**Why it happens:** Command arg syntax is defined in two places (prompt.js Part 6 and the knowledge corpus) and can drift.
**How to avoid:** The command arg syntax in `buildCommandChunks()` MUST exactly match `prompt.js` Part 6. The easiest approach: read the existing prompt.js command reference section as the authoritative source, or keep both in sync by keeping command metadata in one canonical location. For Phase 11, define the schemas once in `mind/knowledge.js` and add a note that `prompt.js` Part 6 should stay consistent.

---

## Code Examples

Verified patterns from direct code inspection:

### minecraft-data Import (from body/skills/build.js)
```javascript
// Source: /home/bigphoot/Desktop/hermescraft/body/skills/build.js
import minecraftData from 'minecraft-data'
const mcData = minecraftData('1.21.1')
```

### Recipe Object Shape (verified live)
```javascript
// mcData.recipes[itemId] returns array of recipe objects
// Shaped recipe (crafting table, specific slot arrangement):
{ inShape: [[811, 811, 811], [null, 848, null], [null, 848, null]], result: { id: 835, count: 1 } }
// iron_ingot=811, stick=848, iron_pickaxe=835

// Shapeless recipe (ingredient list, any arrangement):
{ ingredients: [88], result: { id: 811, count: 9 } }
// iron_block=88, iron_ingot=811 (9 nuggets -> 1 ingot direction is reversed here)
```

### Entity Data Shape (verified live)
```javascript
// mcData.entitiesByName['creeper']:
{ id: 23, name: 'creeper', displayName: 'Creeper', width: 0.6, height: 1.7,
  type: 'hostile', category: 'Hostile mobs', metadataKeys: [...] }
// NOTE: entity data has NO health points, damage, or loot data — those must be hand-authored
```

### Food Data Shape (verified live)
```javascript
// mcData.foodsByName['bread']:
{ id: 855, name: 'bread', stackSize: 64, displayName: 'Bread',
  foodPoints: 5, saturation: 6, effectiveQuality: 11, saturationRatio: 1.2 }
```

### Block Data Shape with Tool Requirements (verified live)
```javascript
// mcData.blocksByName['deepslate_diamond_ore']:
{ id: 180, name: 'deepslate_diamond_ore', hardness: 4.5, diggable: true,
  harvestTools: { '835': true, '840': true, '845': true },  // iron/diamond/netherite pickaxe
  drops: [805] }  // 805 = diamond
// map harvestTools keys to item names: mcData.items[835].name = 'iron_pickaxe'
```

### Biome Data Shape (verified live)
```javascript
// mcData.biomesByName['plains']:
{ id: 39, name: 'plains', category: 'plains', temperature: 0.8,
  has_precipitation: true, dimension: 'overworld', displayName: 'Plains', color: 9286496 }
// NOTE: biome data is minimal — no resource info, no structure spawns
// Surface resources, mob spawns, and structures must be hand-authored
```

### Module Init Pattern (from memory.js)
```javascript
// Source: /home/bigphoot/Desktop/hermescraft/mind/memory.js
// knowledge.js should follow this same pattern
let DATA_DIR = ''
// ... module-level mutable state

export function initKnowledge(config) {
  DATA_DIR = config.dataDir  // or just store config ref
}
```

### Adding to start.js (pattern from existing init calls)
```javascript
// Source: /home/bigphoot/Desktop/hermescraft/start.js
// Add to startup sequence BEFORE initMind:
import { initKnowledge, loadKnowledge } from './mind/knowledge.js'
// ...
initKnowledge(config)   // set data dir and config
loadKnowledge()         // build all chunks synchronously
```

---

## Chunk Count Analysis

Verified counts from live `mcData` introspection:

| Source | Raw Count | Expected Chunks | Chunking Strategy |
|--------|-----------|-----------------|-------------------|
| Recipes (RAG-01) | 782 craftable item IDs | ~782 | One chunk per item; full dep chain in text |
| Blocks (RAG-02) | 1060 total | ~150-200 | Deduplicate by name, filter to diggable/craftable/significant |
| Items (RAG-02) | 1333 total | ~200-300 | Filter to items with gameplay use (tools, armor, food, utility) |
| Foods (RAG-02) | 41 | ~41 | All foods with foodPoints and saturation |
| Mobs (RAG-02) | 83 (42 hostile + 41 passive) | ~83 | All mobs; supplement stats with hand-authored notes |
| Biomes (RAG-02) | 64 | ~64 | All biomes; supplement resources with hand-authored notes |
| Strategy files (RAG-03) | 7 files × ~40 sections | ~280 | H2/H3 splitting; one concept per chunk |
| Commands (RAG-04) | 21 commands | ~21 | One chunk per command with args, examples, failures |

**Total estimate:** ~1,600 chunks if all data is included. To hit the 600-800 target in the success criteria, the planner must decide on aggressive filtering for RAG-02 (blocks and items). Alternatively, the 600-800 target may be intentionally conservative and the actual implementation may produce more — the success criteria should be read as "at least 600" not "at most 800". This is a planning decision to clarify.

**Recommendation for the planner:** Treat the 600-800 range as a floor. Implement all four generators without aggressive filtering first, then measure. If the count is much higher (e.g. 1500+), the planner should add a filtering pass for RAG-02 items/blocks to exclude decorative/redundant variants.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded MINECRAFT KNOWLEDGE in prompt.js (~2000 tokens, always present) | Dynamic corpus chunks retrieved on demand | Phase 13 (not this phase) | Prompt shrinks, knowledge expands |
| POC knowledge files in `agent/knowledge/` (4-6 sections) | Expanded files in `knowledge/` root (~40 sections each) | Phase 11 | ~7x more content per topic |

---

## Integration Points

### Where `initKnowledge` Gets Called
`start.js` startup sequence, after `initMemory()` / `initSocial()` and before `initMind()`. This follows the established pattern of all `init*` functions.

### What Phase 12 Consumes
Phase 12 imports `getAllChunks()` from `mind/knowledge.js` and embeds each chunk's `text` field. The `id`, `type`, `tags`, and `source` fields are stored as metadata alongside the vector.

### What Phase 13 Consumes
Phase 13 calls `retrieveKnowledge(query)` from Phase 12's KnowledgeStore, which returns chunks. These chunks' `text` fields are injected into `buildSystemPrompt()` via `options.ragContext`.

### Smoke Test Integration
The existing `tests/smoke.test.js` uses no test framework — just `assert()` + `process.exit(failed > 0 ? 1 : 0)`. The planner should add a `knowledge` section to this file that:
1. Imports `initKnowledge`, `loadKnowledge`, `getAllChunks` from `mind/knowledge.js`
2. Asserts chunk count >= 600
3. Asserts at least one chunk with `type === 'recipe'` exists for `recipe_iron_pickaxe`
4. Asserts all chunks have `{ id, text, type, tags, source }` shape
5. Asserts no chunk `text` is empty

Run command: `node tests/smoke.test.js` (no framework, matches existing pattern).

---

## Open Questions

1. **Chunk count target: floor or ceiling?**
   - What we know: 782 recipe items alone fill the 600-800 range. Adding RAG-02/03/04 will push the total to ~1,500+.
   - What's unclear: Is the 600-800 an approximation (floor) or a hard budget (ceiling requiring aggressive filtering)?
   - Recommendation: Treat as a floor. Build all four generators, count, and document the actual total. The Phase 12 embedding step is not affected by count (just startup time).

2. **entity data gaps for RAG-02**
   - What we know: `mcData.entitiesArray` has `category`, `type`, `width`, `height` but NO health points, attack damage, or loot drops for entities. `mcData.entityLootArray` exists but returns mostly empty arrays for common mobs.
   - What's unclear: Should mob chunks be pure minecraft-data (limited stats) or should mob fact chunks be hand-authored entirely?
   - Recommendation: Generate skeleton mob chunks from mcData (name, category, dimensions) and supplement with hand-authored text for health/damage/drops/behavior. The `combat.md` knowledge file can cover hostile mob behaviors; the auto-generated mob chunks cover identification.

3. **Simplest recipe variant selection**
   - What we know: `mcData.recipes[crafting_table.id]` returns 11 variants (one per wood type). Picking "first" returns cherry_planks by coincidence.
   - What's unclear: Should the selector prefer oak variants (most common)? Or pick the variant with the fewest ingredient types?
   - Recommendation: Pick the recipe with the fewest unique ingredient names. If tied, prefer oak_log as the wood source (most common in starter biomes).

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `/home/bigphoot/Desktop/hermescraft/node_modules/minecraft-data/` — live data counts and object shapes verified via `node --input-type=module` introspection
- `/home/bigphoot/Desktop/hermescraft/mind/memory.js` — init/load/save module pattern
- `/home/bigphoot/Desktop/hermescraft/start.js` — startup sequence and init call order
- `/home/bigphoot/Desktop/hermescraft/mind/registry.js` — 21 registered commands confirmed
- `/home/bigphoot/Desktop/hermescraft/mind/prompt.js` — command arg schemas (Part 6) and GAMEPLAY_INSTRUCTIONS
- `/home/bigphoot/Desktop/hermescraft/tests/smoke.test.js` — test pattern (no framework, assert function)
- `/home/bigphoot/Desktop/hermescraft/agent/knowledge/food.md` and `building.md` — POC file size (40-50 lines, 4-6 sections)
- `/home/bigphoot/Desktop/hermescraft/.planning/phases/11-knowledge-corpus/11-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- `npm view minecraft-data version` → 3.105.0 (verified installed version matches package.json `^3.105.0`)
- Verified: `data/pc/1.21.1/` directory has NO `smelting.json` — confirmed absence of furnace recipe data

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — only built-in Node.js modules + already-installed minecraft-data
- Architecture: HIGH — patterns copied directly from existing module conventions
- Pitfalls: HIGH — verified via live code execution (recipe cycle found, smelting gap confirmed)
- Chunk count estimates: MEDIUM — counts confirmed for recipe/mob/biome, filtering strategy for blocks/items is a planning decision

**Research date:** 2026-03-22
**Valid until:** 2026-06-22 (minecraft-data 1.21.1 data is stable; no fast-moving dependencies)
