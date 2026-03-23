# Roadmap: HermesCraft

## Milestones

- [x] **v1.0** - Paper Migration + Plugin-Enhanced Agents — Phases 1-4 (shipped 2026-03-22)
- [x] **v1.1** - Tool Quality & Building Intelligence — Phases 5-8 (shipped 2026-03-22)
- [x] **v2.0** - Mineflayer Rewrite — Phases 1-6 (shipped 2026-03-22)
- [x] **v2.1** - Creative Building + Bug Fixes — Phases 7-10 (shipped 2026-03-22)
- [ ] **v2.2** - Minecraft RAG — Phases 11-13 (in progress)

---

## v2.2: Minecraft RAG (Current)

**Milestone Goal:** Agents get deep Minecraft knowledge via RAG — recipes, blocks, mobs, biomes, building techniques, and their own command structure. All queryable on demand with automatic injection on failure.

## Phases

- [x] **Phase 11: Knowledge Corpus** - Build and generate all retrievable knowledge chunks (recipes, facts, strategy, commands) (completed 2026-03-23)
- [x] **Phase 12: KnowledgeStore** - Implement hybrid vector + BM25 retrieval engine with local embeddings (completed 2026-03-23)
- [x] **Phase 13: Prompt Integration** - Wire retrieval into the agent mind loop, implement !wiki, auto-lookup, and context injection (completed 2026-03-23)

## Phase Details

### Phase 11: Knowledge Corpus
**Goal**: All Minecraft knowledge exists as structured, retrievable chunks ready to be indexed
**Depends on**: Nothing (first phase of v2.2)
**Requirements**: RAG-01, RAG-02, RAG-03, RAG-04
**Success Criteria** (what must be TRUE):
  1. Running the corpus builder produces ~600-800 chunk objects in memory with no errors
  2. Every craftable item in MC 1.21.1 has a chunk with its full ingredient chain from raw materials
  3. All blocks, items, foods, mobs, and biomes from minecraft-data have fact chunks with key properties
  4. Hand-authored Markdown files cover building, farming, mining, combat, survival, biomes, and structures with ~300 chunks total
  5. Every registered !command has an auto-generated chunk with args, usage pattern, and failure modes derived from GAME_TOOLS
**Plans:** 3/3 plans complete

Plans:
- [x] 11-01-PLAN.md — Recipe chain resolver (RAG-01): mind/knowledge.js module scaffold + buildRecipeChunks with smelting table and cycle detection
- [x] 11-02-PLAN.md — Strategic knowledge files (RAG-03): 7 hand-authored Markdown files in knowledge/ covering mining, combat, survival, biomes, building, farming, structures
- [x] 11-03-PLAN.md — Fact chunks, command chunks, and wiring (RAG-02, RAG-03, RAG-04): buildFactChunks, buildCommandChunks, buildStrategyChunks + start.js integration + smoke tests

### Phase 12: KnowledgeStore
**Goal**: A working retrieval module that takes a query string and returns the most relevant chunks using hybrid BM25 + vector search
**Depends on**: Phase 11
**Requirements**: RAG-05, RAG-06
**Success Criteria** (what must be TRUE):
  1. `retrieveKnowledge("iron pickaxe recipe")` returns the iron_pickaxe chain chunk as the top result
  2. `retrieveKnowledge("creeper explosion")` returns the creeper mob chunk even though "explosion" is not in the chunk title
  3. Retrieval latency is under 50ms after startup (index fully in-memory)
  4. Agent startup completes with the knowledge index built and all chunks embedded using local all-MiniLM-L6-v2 (no external API calls)
**Plans:** 1/1 plans complete

Plans:
- [x] 12-01-PLAN.md — Hybrid retrieval engine (RAG-05, RAG-06): mind/knowledgeStore.js with BM25 + vector search + RRF fusion, npm dependencies, start.js wiring, smoke tests

### Phase 13: Prompt Integration
**Goal**: The agent uses its knowledge automatically — injecting context on failure, answering !wiki queries, and replacing the hardcoded knowledge block with dynamic retrieval
**Depends on**: Phase 12
**Requirements**: RAG-07, RAG-08, RAG-09, RAG-10
**Success Criteria** (what must be TRUE):
  1. An agent that fails a craft action has the correct recipe chain injected into its next LLM call without any manual intervention
  2. An agent given `!wiki how do I find diamonds` responds with accurate depth and tool information drawn from the knowledge corpus
  3. An agent currently mining has ore/depth information in its context; an agent currently building has material/technique information in its context
  4. The base system prompt is smaller than before v2.2 (GAMEPLAY_INSTRUCTIONS replaced by always-present core + dynamic retrieval)
**Plans:** 2/2 plans complete

Plans:
- [x] 13-01-PLAN.md — Prompt restructuring (RAG-10): Replace MINECRAFT KNOWLEDGE with distilled always-present core, add ragContext option to buildSystemPrompt
- [x] 13-02-PLAN.md — RAG wiring + !wiki (RAG-07, RAG-08, RAG-09): Wire retrieveKnowledge into think() and respondToChat(), failure auto-lookup, context-aware injection, !wiki command

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 11. Knowledge Corpus | v2.2 | 3/3 | Complete    | 2026-03-23 |
| 12. KnowledgeStore | v2.2 | 1/1 | Complete    | 2026-03-23 |
| 13. Prompt Integration | v2.2 | 2/2 | Complete    | 2026-03-23 |
