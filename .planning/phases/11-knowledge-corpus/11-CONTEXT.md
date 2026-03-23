# Phase 11: Knowledge Corpus - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the complete Minecraft knowledge corpus as structured, retrievable chunks. This phase produces ~600-800 chunk objects covering all MC 1.21.1 recipes (with full ingredient chains), blocks/items/mobs/biomes from minecraft-data, hand-authored strategic gameplay knowledge, and auto-generated !command documentation. Output: chunk objects in memory ready for Phase 12 indexing.

</domain>

<decisions>
## Implementation Decisions

### Chunk Structure & Organization
- Corpus builder lives at `mind/knowledge.js` — follows existing mind/ module convention (prompt.js, memory.js, etc.)
- Chunk metadata schema: `{ id, text, type, tags[], source }` — minimal, sufficient for filtering and retrieval
- Chunk IDs are human-readable: `{type}_{name}` e.g. `recipe_iron_pickaxe`, `mob_creeper` — greppable and debuggable
- Hand-authored knowledge files live in `knowledge/` at project root — shared data not tied to mind/ or body/

### Recipe Chain Generation
- Full chain to raw materials: "iron pickaxe needs iron ingots (smelt iron ore) + sticks (planks from logs)"
- Pick simplest variant per item when multiple recipe variants exist, note alternatives
- Include smelting steps in recipe chains (e.g. iron_ore → iron_ingot via furnace)
- One chunk per final craftable item containing its full dependency chain

### Strategic Knowledge Scope
- 7 topic files per ROADMAP: building, farming, mining, combat, survival, biomes, structures
- ~40 chunks per file, ~300 total — practical gameplay tips the agent can act on
- Imperative directive writing style: "Mine diamonds at Y=-58 with iron pickaxe or better" — matches existing prompt voice
- Expand and restructure existing POC files (food.md, building.md) rather than starting from scratch

### Claude's Discretion
- Internal chunk parsing and serialization format details
- Exact markdown heading-to-chunk splitting logic
- Command documentation extraction heuristics from registry.js
- Validation and statistics reporting format

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `minecraft-data` ^3.105.0 already installed — `mcData.recipes`, `mcData.blocks`, `mcData.items`, `mcData.foods`, `mcData.entities`
- Existing POC knowledge files at `agent/knowledge/food.md` and `agent/knowledge/building.md`
- `mind/registry.js` REGISTRY Map — source for auto-generating command chunks
- `mind/memory.js` — pattern for file-backed persistent data with init/load/save cycle

### Established Patterns
- Module init pattern: `initKnowledge(config)` called in startup sequence before tick loop
- Config object passed by reference: `{ name, dataDir, soulContent, partnerName }`
- Module-level mutable state for module internals
- `import minecraftData from 'minecraft-data'; const mcData = minecraftData('1.21.1')` access pattern (from body/skills/build.js)

### Integration Points
- `mind/prompt.js` `buildSystemPrompt()` — will consume chunks in Phase 13 via `options.ragContext`
- `mind/index.js` `main()` — startup sequence where `initKnowledge(config)` will be called
- `knowledge/` directory at root — new location for hand-authored strategic files
- minecraft-data node_modules — data source for auto-generated chunks

</code_context>

<specifics>
## Specific Ideas

- Chunk size target: 40-150 tokens per chunk (fits embedding model's 256-token window in Phase 12)
- Always-present core knowledge (~1,500 tokens) replaces current GAMEPLAY_INSTRUCTIONS — defined in architecture research
- Retrieval triggers decided in STATE.md: explicit !wiki, on failure, phase change — NOT every tick

</specifics>

<deferred>
## Deferred Ideas

- Redstone, enchanting, brewing knowledge — future milestone scope
- Vector memory replacing flat MEMORY.md (MEM-01, MEM-02) — future milestone

</deferred>
