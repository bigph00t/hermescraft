# Requirements: HermesCraft

**Defined:** 2026-03-23
**Core Value:** Agents must feel and play like real people — with deep game knowledge

## v2.2 Requirements

Requirements for Minecraft RAG milestone.

### Knowledge Corpus

- [x] **RAG-01**: All MC 1.21.1 recipes auto-generated from minecraft-data into retrievable chunks with full dependency chains
- [ ] **RAG-02**: All blocks, items, mobs, biomes, foods from minecraft-data indexed with properties and relationships
- [x] **RAG-03**: Hand-authored strategic knowledge: building techniques, farming, mining (ore depths/tools), combat/mobs, exploration/biomes, redstone basics, survival strategies, creative architecture (~300 chunks)
- [ ] **RAG-04**: All !commands auto-documented from registry with args, usage patterns, failure modes, and examples

### Retrieval System

- [ ] **RAG-05**: Hybrid vector + BM25 search (Vectra + MiniSearch) with RRF fusion returning top-K chunks
- [ ] **RAG-06**: Local embeddings via all-MiniLM-L6-v2 through @huggingface/transformers (no external API)

### Integration

- [ ] **RAG-07**: !wiki command — agent queries MC knowledge mid-gameplay, answer injected into next LLM call
- [ ] **RAG-08**: Auto-lookup on skill failure — when craft/mine/build fails, automatically retrieve and inject correct approach
- [ ] **RAG-09**: Context-aware injection — relevant MC knowledge added to system prompt based on current activity (mining? ore info. building? material info)
- [ ] **RAG-10**: Replace hardcoded MINECRAFT KNOWLEDGE prompt section with dynamic retrieval, reducing base prompt size

## Future Requirements

### Advanced Gameplay
- **ADV-01**: Nether exploration with portal building
- **ADV-02**: Enchanting and brewing
- **ADV-03**: Redstone contraptions and automated farms
- **ADV-04**: Village trading

### Memory
- **MEM-01**: Vector memory replacing flat MEMORY.md
- **MEM-02**: Semantic recall of past experiences by similarity

## Out of Scope

| Feature | Reason |
|---------|--------|
| External vector DB server | In-process Vectra is sufficient, no ops overhead |
| Fine-tuning a model | RAG is faster to ship and iterate |
| Real-time wiki scraping | Pre-built corpus at startup, not live queries |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RAG-01 | Phase 11 | Complete |
| RAG-02 | Phase 11 | Pending |
| RAG-03 | Phase 11 | Complete |
| RAG-04 | Phase 11 | Pending |
| RAG-05 | Phase 12 | Pending |
| RAG-06 | Phase 12 | Pending |
| RAG-07 | Phase 13 | Pending |
| RAG-08 | Phase 13 | Pending |
| RAG-09 | Phase 13 | Pending |
| RAG-10 | Phase 13 | Pending |

**Coverage:**
- v2.2 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
