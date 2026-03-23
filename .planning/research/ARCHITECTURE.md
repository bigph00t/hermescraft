# Architecture Patterns

**Domain:** Minecraft AI agent RAG knowledge system (Node.js ESM, in-process)
**Researched:** 2026-03-22
**Confidence:** HIGH for retrieval libraries; MEDIUM for optimal chunk sizing (empirical tuning needed); HIGH for data source coverage analysis

---

## 1. Previous Architecture (Retained)

The existing ARCHITECTURE.md documented the v2.0 Mind+Body mineflayer rewrite. That content is preserved below the RAG section. This section covers the new knowledge retrieval layer added to that architecture.

---

## 2. RAG Knowledge System Architecture

### The Core Problem

The current agent has ~50 hardcoded MC facts (~600 tokens) injected on every tick. This covers less than 5% of what a competent MC player knows. The full domain (recipes, biomes, mobs, ores, farming, combat, redstone, structures, building, survival) runs to ~500-800 knowledge chunks at any reasonable granularity.

Options:

| Approach | Token cost/tick | Coverage | Complexity |
|----------|----------------|----------|------------|
| Current (50 facts, all injected) | ~600 tokens | 5% | None |
| Full static injection (800 chunks) | ~40,000 tokens | 100% | None |
| RAG (top-k retrieval) | ~2,000-4,000 tokens | On-demand | Medium |

With a 200k context model, full static injection is feasible in isolation but collides with existing prompt sections (SOUL, commands, memory, history, game state). Realistically, the game state + history + skills + system prompt is already 8,000-15,000 tokens per tick. Adding 40,000 tokens of MC knowledge every tick on every call would bloat every request substantially and add latency. RAG retrieval pays per query, not per tick — and queries only happen when the agent encounters an unknown.

**Decision: Hybrid approach.** Keep a compact always-present knowledge core (~1,500 tokens) for the highest-frequency facts. Use RAG for deep on-demand retrieval.

---

### Recommended Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     AGENT TICK LOOP                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              System Prompt Builder                    │   │
│  │                                                        │   │
│  │  SOUL + Commands + Memory     (always present)         │   │
│  │  Core MC Knowledge (~1,500 tokens)   (always present) │   │
│  │  RAG Context Block (~2,000 tokens)   (per-query)      │   │
│  └──────────────────────────────────────────────────────┘   │
│              │                                               │
│              │ retrieval trigger                             │
│              ▼                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 KnowledgeStore                        │   │
│  │                                                        │   │
│  │  retrieve(query, topK=5) → chunks[]                   │   │
│  │  ├── BM25 keyword index (MiniSearch)                  │   │
│  │  └── Vector similarity (Vectra + local embeddings)    │   │
│  │       → hybrid RRF fusion → top-5 chunks              │   │
│  └──────────────────────────────────────────────────────┘   │
│              │                                               │
│              ▼                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Knowledge Corpus (~800 chunks)           │   │
│  │  Built once at startup, cached in memory              │   │
│  │                                                        │   │
│  │  minecraft-data recipes → crafting chunks             │   │
│  │  minecraft-data items/entities/foods → fact chunks    │   │
│  │  Hand-authored MD files → tactics/building/farming    │   │
│  │  Auto-generated command docs → !commands reference    │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────┘
```

---

### Component: Knowledge Store

**Library: Vectra (in-process, file-backed) for vectors + MiniSearch for BM25.**

**Why Vectra:**
- Zero external server dependency. Index lives in a JSON file on disk.
- Loads fully into memory at startup. Lookup latency is <2ms for 800 chunks. (MEDIUM confidence — sub-10ms verified in community benchmarks for <10k vectors)
- Cosine similarity with metadata filtering via MongoDB-style operators.
- API matches the project's plain fetch/openai style — no framework overhead.
- Actively maintained. npm package: `vectra`.

**Why NOT LanceDB:**
- Requires platform-specific native binary (`@lancedb/lancedb-linux-x64-gnu`). Binary download at install time is fragile on offline/airgapped build environments. Adds ~50MB.
- Overkill for 800-2,000 chunks. Lance's columnar HNSW index shines at millions of vectors.

**Why NOT Chroma:**
- Chroma's in-process mode is Python-first. JavaScript client expects a running server process by default.
- Adds operational complexity contradicting the no-external-server requirement.

**Library: MiniSearch for BM25 keyword matching.**
- Pure JavaScript, zero dependencies, zero native code.
- Supports fuzzy matching, field boosting, prefix search.
- ESM native, current version 7.2.0.
- For MC knowledge, BM25 handles exact item name lookups better than semantic vectors (searching "oak_planks" should match the oak_planks chunk exactly, not "dark planks similar to oak").
- npm package: `minisearch`.

**Hybrid RRF fusion:**
Reciprocal Rank Fusion merges the two ranked lists (BM25 rank and vector rank) with equal weight. The formula is `score = 1/(k + rank_bm25) + 1/(k + rank_vector)` where k=60. Implementation is ~10 lines. The combined result outperforms either method alone on domain-specific knowledge retrieval. (MEDIUM confidence — established in retrieval literature, validated on structured knowledge corpora per NVIDIA 2024 chunking benchmark)

---

### Component: Embedding Model

**Recommendation: `@huggingface/transformers` (v3.x) with `Xenova/all-MiniLM-L6-v2`.**

**Rationale:**
- Fully local, no API key, no external call latency for index-time embedding.
- ONNX weights available. Node.js runs via ONNX Runtime (WASM backend). Pure ESM import.
- Produces 384-dimension vectors per chunk. 800 chunks × 384 dims = ~1.2MB in memory — trivial.
- Cold start: model download ~20-30MB, ONNX deserialization ~1-3s. After first run, model file is cached by the OS. Startup cost is a one-time penalty.
- Inference per chunk: ~5-15ms CPU on a modern machine. 800 chunks indexed at startup = ~4-12s. Acceptable for a process that runs for hours.
- The model's 256-token effective window fits MC knowledge chunks well (see Chunking Strategy below).
- npm package: `@huggingface/transformers` (requires dynamic import due to ESM structure — see Integration notes).

**Confidence:** HIGH. Xenova/all-MiniLM-L6-v2 ONNX model is officially maintained by HuggingFace and the 384-dim, 256-token limit is documented on the model card.

**Alternative considered: OpenAI `text-embedding-3-small`**
- Requires API call per chunk at index time. 800 chunks = 800 API calls at startup. Adds latency and cost to every agent startup. Acceptable if local ONNX is problematic, but worse default.

---

### Component: Knowledge Corpus

#### What `minecraft-data` npm covers (HIGH confidence, API docs read directly)

The package at `^3.105.0` (already installed) provides for 1.21.1:
- `mcData.recipes` — all crafting recipes with ingredient shapes and counts (structured JSON)
- `mcData.items` — all item IDs, display names, stack sizes
- `mcData.blocks` — all block IDs, hardness, tool type required, drops
- `mcData.entities` — all entity types, attributes
- `mcData.foods` — food items, hunger restored, saturation
- `mcData.enchantments` — enchantment IDs, max levels, applicable items
- `mcData.biomes` — biome IDs and names (no descriptive text, just data)
- `mcData.effects` — status effects
- `mcData.blockLoot` / `mcData.entityLoot` — drop tables

**What minecraft-data does NOT cover:**
- Combat tactics (how to fight skeletons, strafe patterns, armor priority)
- Building techniques (how to make a roof, window placement, material aesthetics)
- Survival strategies (first night checklist, progression order, food management)
- Biome descriptions (what spawns in swamps, village locations, biome-specific resources)
- Ore distribution by Y-level (which depth to mine for diamonds vs iron)
- Mob behavior (creeper explosion radius, zombie door-breaking, spider climb)
- Redstone mechanics (signal strength, contraption patterns)
- Structure locations (how to find villages, temples, strongholds)
- Gameplay progression heuristics (when to go to Nether, how to prep for Ender Dragon)

**Conclusion:** `minecraft-data` is sufficient for all recipe/item/block/entity factual lookups. It does NOT cover the strategic, behavioral, and contextual knowledge a player needs. That gap requires hand-authored Markdown files.

#### Data Sources

| Source | Generates | Format | Volume |
|--------|-----------|--------|--------|
| `minecraft-data` (programmatic) | Recipe chains, item facts, food values, block properties, enchantments | Auto-generated chunks at startup | ~250-350 chunks |
| Hand-authored Markdown (`agent/knowledge/*.md`) | Building, farming, survival, combat, biomes, structures, mining strategy | Static files parsed at startup | ~300-400 chunks |
| Auto-generated command docs | `!command` registry, arg signatures, common failure modes | Generated from `GAME_TOOLS` array at startup | ~40-60 chunks |

Total corpus: approximately 600-800 chunks, well within in-memory comfort zone.

---

### Component: Chunking Strategy

**Principle:** Each chunk must be a self-contained, answerable unit. A chunk is the smallest thing the LLM can act on without needing more context from the same chunk. It must also fit within 256 tokens (all-MiniLM-L6-v2 limit) to embed correctly.

#### Chunk Types and Target Sizes

**Type 1: Recipe Chain (auto-generated from `minecraft-data`)**

One chunk per final craftable item, including its full ingredient chain from raw materials.

```
[RECIPE] iron_pickaxe
Requires: 3 iron_ingot + 2 stick
iron_ingot: smelt raw_iron (fuel: wood/coal)
raw_iron: mine iron_ore (stone pickaxe+ required)
stick: craft from 2 oak_planks
oak_planks: craft from 1 oak_log (4 per log)
Tool tier: iron_pickaxe mines up to diamonds
```

~80-120 tokens. This is the most valuable single chunk type — agents fail most often because they don't know the full chain (e.g., knowing "iron pickaxe needs iron_ingot" but not knowing raw iron must be smelted first).

**Type 2: Item/Block Fact (auto-generated)**

One chunk per item or block for items with notable properties. Skip purely decorative blocks.

```
[ITEM] diamond
Found: Y -64 to Y 16, peak at Y -58
Requires: iron_pickaxe or better to mine
Uses: diamond_pickaxe, diamond_sword, diamond_armor, enchanting_table
Rarity: rare — branch mine at Y -58
```

~40-60 tokens.

**Type 3: Mob Behavior (hand-authored)**

One chunk per mob type covering threat level, behavior, and countermeasures.

```
[MOB] creeper
Threat: explodes on proximity (radius 4 blocks, lethal unarmored)
Behavior: sneaks up silently. Hisses 1.5s before explosion.
Countermeasure: sprint backward when hissing starts.
  One shot from iron sword if timed before hiss.
  Cats/ocelots cause creepers to flee.
Drops: gunpowder (0-2), music disc (if killed by skeleton)
```

~60-100 tokens.

**Type 4: Strategy/Technique (hand-authored)**

One chunk per distinct technique or strategy. These are the chunks most likely to be retrieved during failure states.

```
[STRATEGY] first_night_survival
Priority order: wood (3+ logs) → planks → crafting_table → sticks
→ wooden_pickaxe → mine stone (cobblestone) → stone_pickaxe
→ mine coal (torch light) → return to surface before dark (time 12000)
Shelter: simplest = dig 3 blocks into a hillside, block entrance.
Avoid: fighting mobs on night 1 without armor.
```

~80-120 tokens.

**Type 5: Command Reference (auto-generated from `GAME_TOOLS`)**

One chunk per command, pulled from the tool definition + known failure modes.

```
[COMMAND] smart_place
Purpose: Place a block at crosshair or specified support block.
Usage: smart_place(item="cobblestone") — places at current crosshair
       smart_place(item="oak_planks", x=10, y=64, z=20, face="top")
Requires: item in inventory. Auto-equips.
Common failure: calling without look_at_block first → places wrong face.
Pre-condition: call look_at_block(x,y,z) before smart_place.
```

~60-80 tokens.

**Target chunk token range: 40-150 tokens.** This stays well under the 256-token model limit and leaves headroom for the metadata (type, topic tags, item name) stored alongside.

#### Chunking Rules

1. Never split a recipe chain across chunks — the whole chain must be atomic.
2. Never create a chunk that requires another chunk for context (e.g., "see also: farming").
3. Tag every chunk with: `type`, `topic[]`, `item_name` (if applicable), `priority` (0=nice-to-have, 1=normal, 2=always-present).
4. Chunks with `priority: 2` are injected into every prompt without retrieval (these are the ~1,500-token always-present core).

---

### Component: Retrieval Triggers

**When to retrieve:**

| Trigger | Query | Notes |
|---------|-------|-------|
| Agent calls `wiki(query)` tool | The query string verbatim | Explicit LLM request — highest quality signal |
| Action fails with `error.includes("Cannot craft")` | The item name from the error | Auto-triggered on craft failure |
| Action fails with `error.includes("Cannot smelt")` | The item name | Auto-triggered |
| Action fails with `error.includes("not in inventory")` | The item name | Suggests agent needs recipe chain |
| Agent is about to execute `craft(item)` with unknown recipe | The item name | Proactive injection before crafting |
| Current phase objective changes | Phase name / objective text | Load relevant phase strategy |

**What NOT to trigger on:**
- Do not retrieve on every tick. The corpus is not a substitute for game state — it is a supplement for when the agent lacks procedural knowledge.
- Do not retrieve when action succeeds. Successful agents should not accumulate noise.

**Implementation pattern:**

```javascript
// agent/knowledge.js
export async function retrieveForAction(action, gameState) {
  const queries = []

  // Explicit wiki request
  if (action.type === 'wiki') {
    queries.push(action.query)
  }

  // Craft failure: look up the recipe chain
  if (action.type === 'craft' || (action.lastError && action.lastError.includes('craft'))) {
    queries.push(`recipe ${action.item}`)
  }

  // Phase change: load strategy
  if (action.phaseChanged) {
    queries.push(`strategy ${action.newPhase}`)
  }

  if (queries.length === 0) return ''

  const chunks = []
  for (const q of queries) {
    const results = await knowledgeStore.retrieve(q, 5)
    chunks.push(...results)
  }

  // Deduplicate and format
  const seen = new Set()
  const unique = chunks.filter(c => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })

  return unique.map(c => c.text).join('\n\n').slice(0, 4000)
}
```

---

### Component: Core Knowledge (Always Present)

The ~1,500-token always-present block replaces the current 600-token `GAMEPLAY_INSTRUCTIONS`. It contains:

1. **Tool progression** — wood → stone → iron → diamond → netherite, what each tier can mine
2. **Essential recipes** — crafting table (4 planks), furnace (8 cobblestone), all tool recipes with material counts
3. **Ore Y-levels** — coal (Y 45), iron (Y 16), gold (Y -16), diamond (Y -58), redstone (Y -58), copper (Y 48)
4. **Mob threat summary** — zombie (basic), skeleton (ranged), creeper (explosion), spider (night only), enderman (don't look)
5. **Food priority** — cooked beef/pork (best), bread, baked potato, raw carrot (last resort)
6. **Day/night timing** — day starts 0, night starts 12000, sunrise 24000; hostile mobs despawn at dawn
7. **Command quick-reference** — one-liner per command listing args and purpose

This block is hardcoded in `agent/prompt.js` (replacing `GAMEPLAY_INSTRUCTIONS`) and is never retrieved — it is injected on every tick unconditionally.

---

### Token Budget

| Section | Tokens (approximate) | Frequency |
|---------|----------------------|-----------|
| SOUL / identity | 400-800 | Every tick |
| Core MC knowledge (new) | 1,400-1,600 | Every tick |
| Commands + forbidden words | 300-500 | Every tick |
| Memory / lessons | 200-400 | Every tick |
| Pinned context (5 files × 8000 chars) | 0-8,000 | When present |
| Phase objectives + skill | 200-400 | When in phased mode |
| **RAG context block** | **0-4,000** | **On retrieval** |
| Game state (user message) | 500-1,500 | Every tick |
| History window (90 msgs) | 6,000-15,000 | Every tick |
| **Total** | **~10,000-35,000** | |

With a 200k context window, even the high end (~35k) is 17% utilization. RAG injection of 4,000 tokens on retrieval adds 11% in the worst case. Well within budget.

**Comparison to current approach:**
- Current: ~600 tokens of hardcoded MC facts, zero flexibility
- Post-RAG: ~1,500 tokens always-present core + 0-4,000 tokens on-demand = 1.5x-8.5x more knowledge, proportionally to need

---

### Integration with `agent/prompt.js`

RAG context is injected into the system prompt (not user message) so it survives conversation wipes. The retrieval happens before `buildSystemPrompt()` is called each tick — not inside it.

```javascript
// agent/index.js — in the tick loop, before buildSystemPrompt

const ragContext = await knowledgeStore.retrieveForAction({
  type: lastAction?.type,
  item: lastAction?.item,
  lastError: lastResult?.error,
  phaseChanged: phaseJustChanged,
  newPhase: currentPhase?.name,
}, gameState)

const systemPrompt = buildSystemPrompt(agentConfig, phase, {
  // ... existing params ...
  ragContext,   // new param
})
```

In `buildSystemPrompt()`:
```javascript
if (ragContext) {
  parts.push(`\n== KNOWLEDGE ==\n${ragContext}`)
}
```

The `== KNOWLEDGE ==` section appears after pinned context and before game state so it does not interfere with the task planning sections.

---

### Implementation: `agent/knowledge.js` Module

New module following project conventions:

```javascript
// knowledge.js — Minecraft knowledge corpus + RAG retrieval
// Responsibilities:
//   - Build corpus from minecraft-data + hand-authored MD files at startup
//   - Embed and index all chunks (Vectra + MiniSearch)
//   - Provide retrieve(query, topK) with hybrid BM25+vector RRF fusion
//   - Provide alwaysPresentKnowledge() → the 1,500-token static block

export async function initKnowledge(agentConfig) { ... }
export async function retrieveKnowledge(query, topK = 5) { ... }
export function alwaysPresentKnowledge() { ... }
export function getCommandDocs() { ... }   // auto-generated from GAME_TOOLS
```

The module is initialized once at startup inside `main()` alongside `initMemory()`, `initSkills()` etc. No per-tick I/O — corpus is fully in-memory after init.

---

### Auto-Documenting `!commands`

The `GAME_TOOLS` array in `agent/tools.js` is the source of truth for all commands. At knowledge init time, iterate `GAME_TOOLS` and generate one chunk per tool:

```javascript
function generateCommandChunks(tools) {
  return tools.map(tool => {
    const fn = tool.function
    const params = Object.entries(fn.parameters.properties || {})
      .filter(([k]) => k !== 'reason')
      .map(([k, v]) => `${k}: ${v.type}${v.description ? ` (${v.description})` : ''}`)
      .join(', ')
    return {
      id: `cmd:${fn.name}`,
      type: 'command',
      priority: 1,
      text: `[COMMAND] ${fn.name}\n${fn.description}\nArgs: ${params || 'none'}`,
    }
  })
}
```

This means command documentation never drifts from the actual registered tools. When a new command is added to `GAME_TOOLS`, its knowledge chunk is generated automatically next time the agent starts.

---

## 3. Architecture from Previous Research (v2.0 Rewrite)

The following content is retained from the earlier v2.0 architecture research and covers the Mind+Body mineflayer agent design. The RAG system described above adds a new subsystem to that architecture — the `KnowledgeStore` — sitting between the prompt builder and the corpus files.

```
agent/
├── index.js             # entry point
├── agent.js             # orchestrator
├── config.js
├── logger.js
│
├── mind/
│   ├── prompter.js      # LLM client
│   ├── self-prompter.js # goal loop
│   ├── history.js       # conversation window
│   └── prompt-builder.js
│
├── body/
│   ├── action-manager.js
│   ├── modes.js         # reactive behaviors
│   └── commands/        # LLM-visible interface
│       └── skills/      # mineflayer primitives
│
├── knowledge/           # NEW: RAG subsystem
│   ├── knowledge.js     # KnowledgeStore module
│   ├── corpus/          # hand-authored Markdown chunks
│   │   ├── biomes.md
│   │   ├── combat.md
│   │   ├── building.md
│   │   ├── farming.md
│   │   ├── mining.md
│   │   ├── survival.md
│   │   ├── redstone.md
│   │   └── structures.md
│   └── .index/          # Vectra index files (gitignored, rebuilt on startup)
│
└── memory/
    ├── memory.js
    └── session-log.js
```

---

## 4. Key Decisions Summary

| Decision | Rationale | Confidence |
|----------|-----------|------------|
| Vectra for vector store | Zero external server; in-memory; cosine similarity; file persistence; pure JS | HIGH |
| MiniSearch for BM25 | Zero dependencies; ESM native; exact item name matching where semantic fails | HIGH |
| Hybrid RRF fusion | Outperforms either method alone on structured knowledge; minimal code | MEDIUM |
| all-MiniLM-L6-v2 via @huggingface/transformers | Local ONNX; no API dependency; 384-dim; 256-token window fits MC chunks | HIGH |
| minecraft-data for recipes/items only | Auto-generates the structural half of corpus; strategic knowledge must be hand-authored | HIGH |
| 40-150 token chunk size | Fits embedding model's 256-token window; one fact per chunk; actionable standalone | MEDIUM |
| Retrieval on failure + explicit wiki call only | Prevents per-tick overhead; retrieval is an exception, not the rule | HIGH |
| Always-present core (~1,500 tokens) replaces current GAMEPLAY_INSTRUCTIONS | Higher coverage; consistent; no retrieval latency for critical survival facts | HIGH |
| Command docs auto-generated from GAME_TOOLS | Never drifts; zero maintenance; agents always have accurate command reference | HIGH |

---

## 5. Pitfalls

### Pitfall 1: Embedding model cold start blocking the tick loop
The first startup downloads and deserializes the ONNX model (~2-5s total). Do not block the tick loop. Initialize the knowledge module before entering the tick loop, in the `main()` startup sequence. If the embedding model fails to load, fall back to BM25-only mode — still useful for exact keyword matching.

### Pitfall 2: Vectra index drift after corpus changes
If hand-authored Markdown files are edited, the stored vectors will be stale. Solution: hash the corpus files at startup. If any hash differs from what is stored in `.index/corpus.hash`, rebuild the index. Rebuild takes ~4-12s — acceptable at startup, not acceptable mid-session.

### Pitfall 3: Recipe chains not being atomic
If a recipe chunk is split (ingredients in one chunk, crafting steps in another), retrieval may return only half the chain. The agent gets `iron_pickaxe needs iron_ingot` but not `smelt raw_iron to get iron_ingot`. Result: another failed craft. Atomic recipe chains per chunk are mandatory.

### Pitfall 4: LLM ignoring retrieved knowledge
If the RAG context is injected but the LLM ignores it, the failure is silent. The prompt section header `== KNOWLEDGE ==` must frame the content as authoritative, not optional. Example framing: `== KNOWLEDGE (use this) ==\n[retrieved chunks here]`.

### Pitfall 5: all-MiniLM-L6-v2 poor performance on game jargon
The model was trained on general English text. Minecraft-specific terms like "creeper", "enderman", "nether" may not embed well. Mitigation: tag chunks with explicit keywords used in the item_name and topic fields; these flow to BM25 which handles exact-match well. The hybrid approach specifically exists to handle this gap.

---

## 6. Sources

- Vectra GitHub (`Stevenic/vectra`) — file-backed in-memory model, cosine similarity, zero infrastructure — HIGH confidence (repository README read)
- MiniSearch npm/GitHub (`lucaong/minisearch`) — BM25 implementation, zero deps, ESM, 7.2.0 — HIGH confidence (npm package page + GitHub README)
- `@huggingface/transformers` npm (`huggingface/transformers.js`) — v3.x ONNX, all-MiniLM-L6-v2, Node.js ESM, 256-token limit — HIGH confidence (HuggingFace docs + model card)
- `PrismarineJS/node-minecraft-data` API docs — coverage boundaries established — HIGH confidence (API docs read directly)
- NVIDIA chunking benchmark 2024 — optimal chunk sizes by content type — MEDIUM confidence (secondary source, WebSearch)
- Hybrid BM25+vector RRF literature — consistent across multiple sources (2024-2025) — MEDIUM confidence
- Token budget estimates — based on measured prompt sections in `agent/prompt.js` — HIGH confidence (source read directly)
- LanceDB native binary requirement — `@lancedb/lancedb-linux-x64-gnu` platform dependency identified — MEDIUM confidence (WebSearch, not directly installed and measured)
- Mindcraft knowledge approach — no RAG, relies on base LLM knowledge + static examples — HIGH confidence (GitHub README read via WebFetch)

---

*Architecture research for: HermesCraft Minecraft RAG knowledge milestone*
*Researched: 2026-03-22*
