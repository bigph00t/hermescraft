# Phase 12: KnowledgeStore - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the retrieval engine that takes any query string and returns the most relevant knowledge chunks using hybrid BM25 + vector search. This is the bridge between the Phase 11 corpus (2,677 chunks) and Phase 13's prompt integration. The agents must become inherently and automatically knowledgeable about every aspect of Minecraft gameplay from the moment they start up.

</domain>

<decisions>
## Implementation Decisions

### Retrieval Architecture
- Module at `mind/knowledgeStore.js` — follows mind/ convention with camelCase naming
- RRF fusion with k=60 (standard reciprocal rank fusion formula)
- Return top-8 chunks per query — more context is better, agents need depth not brevity (~1,200 tokens at 150/chunk, well within budget)
- Rebuild index at startup from corpus — no stale index risk, ensures knowledge is always current

### Embedding & Search Config
- Eager load embedding model at init — agents should be knowledge-ready from first tick, not lazy
- BM25 searches both `text` and `id` fields — weight `id` higher so exact item lookups (e.g. "iron_pickaxe") rank the matching chunk first
- No deduplication within retrieval results — same chunk shouldn't appear twice in a single call, so dedup by ID within each retrieval
- Export: `retrieveKnowledge(query, topK=8)` → `Promise<{chunk, score}[]>` — include relevance scores so prompt builder can make smart injection decisions
- `initKnowledgeStore(chunks)` called after `loadKnowledge()` — takes the full chunk array, builds both indexes

### Depth Over Simplicity
- User directive: don't avoid complexity for simplicity's sake. Ensure agents become deeply, automatically knowledgeable about every aspect of Minecraft and their place within it
- The retrieval system should be thorough — better to return too much relevant context than too little
- Score-based results enable smart downstream decisions (Phase 13 can filter by threshold)

### Claude's Discretion
- Internal index data structure details
- Vectra vs alternative in-process vector store implementation choice
- MiniSearch configuration (stemming, fuzzy matching thresholds)
- Embedding batch size and caching strategy
- Error handling for embedding model load failures

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mind/knowledge.js` — `loadKnowledge()` returns 2,677 chunks with `{ id, text, type, tags[], source }`
- `start.js` already calls `initKnowledge(config)` + `loadKnowledge()` at step 3.6
- Chunk types: recipe (782), fact (1,662), strategy (211), command (22)

### Established Patterns
- Module init pattern: `initKnowledgeStore(chunks)` called in startup sequence
- Async init acceptable — model download may take time on first run
- Config object passed by reference from `loadAgentConfig()`
- ESM imports throughout (`import.meta.url` + `fileURLToPath`)

### Integration Points
- `start.js` — wire `initKnowledgeStore` after `loadKnowledge()`, before `initMind`
- `mind/knowledge.js` — `getAllChunks()` provides the corpus
- Phase 13 will import `retrieveKnowledge` for prompt injection

### Dependencies to Install
- `vectra` — in-process vector store (file-backed)
- `minisearch` — BM25 keyword search
- `@huggingface/transformers` — local ONNX embeddings (all-MiniLM-L6-v2)

</code_context>

<specifics>
## Specific Ideas

- Retrieval latency target: under 50ms after startup (index fully in-memory)
- Embedding model: all-MiniLM-L6-v2 via @huggingface/transformers (384-dim, 256-token window)
- Cold start budget: 2-5 seconds for model load + index build is acceptable at startup
- Test with specific queries: "iron pickaxe recipe" → recipe_iron_pickaxe top result; "creeper explosion" → mob_creeper even without "explosion" in chunk title (semantic search)

</specifics>

<deferred>
## Deferred Ideas

- Persistent index caching (rebuild-on-hash-change) — possible optimization for future if startup is too slow
- Query expansion / rewriting — could improve retrieval but adds complexity
- Multi-query retrieval (decompose complex questions into sub-queries)

</deferred>
