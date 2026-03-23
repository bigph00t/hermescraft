# Requirements: HermesCraft

**Defined:** 2026-03-23
**Core Value:** Agents that learn, grow, remember, and build ambitiously — playing Minecraft like real humans

## v2.3 Requirements

Requirements for Persistent Memory & Ambitious Building milestone.

### Memory

- [x] **MEM-01**: Agent experiences persist across sessions — deaths, builds, discoveries, conversations stored in SQLite with timestamps and coordinates
- [x] **MEM-02**: Memory retrieval in every LLM call — relevant past experiences injected alongside RAG knowledge
- [x] **MEM-03**: Importance scoring (1-10) on events — significant moments (first diamond, death, build completion) scored higher and retrieved more often
- [x] **MEM-04**: Reflection journals — periodic LLM pass summarizes recent experiences into strategies and lessons

### Build Planning

- [x] **BLD-01**: LLM generates structured build specs (style, dimensions, materials, features) — deterministic code handles coordinates
- [x] **BLD-02**: Section decomposition for structures over 100 blocks — break large builds into manageable chunks
- [x] **BLD-03**: Material estimation before building — agent knows what to gather before starting
- [x] **BLD-04**: Post-build verification — scan completed structure, detect missing/wrong blocks, auto-repair
- [x] **BLD-05**: Build retry with error feedback — failed placements get re-attempted with LLM guidance

### Spatial Intelligence

- [x] **SPA-01**: Enhanced entity awareness — track nearby mobs, animals, villagers with types, distances, health
- [x] **SPA-02**: Post-build scan integration — verify placed blocks match blueprint
- [x] **SPA-03**: What-where-when memory tagging — every experience tagged with coordinates for spatial queries
- [x] **SPA-04**: Area familiarity — agent knows what's been explored vs unknown territory

### Multi-Agent Coordination

- [ ] **COO-01**: Shared task registry — agents claim tasks to prevent duplicate work
- [ ] **COO-02**: Chat deduplication limiter — prevent conversation loops between agents
- [ ] **COO-03**: Spatial task splitting for builds — decompose builds into sections assigned to each agent
- [ ] **COO-04**: Activity broadcasting — agents see what partner is doing without asking

### Gameplay Loops

- [x] **GPL-01**: Animal farming — breed cows, sheep, pigs, chickens; manage pens; harvest food and materials
- [x] **GPL-02**: Crop farming — plant, grow, harvest wheat/carrots/potatoes; use bone meal; auto-replant
- [x] **GPL-03**: Mob hunting — actively seek and fight hostiles for drops (bones, string, gunpowder, ender pearls)
- [x] **GPL-04**: Exploration — systematic world exploration, discover villages/temples/biomes, report findings
- [ ] **GPL-05**: Villager trading — locate villagers, understand professions, trade for useful items
- [x] **GPL-06**: Smelting & furnace management — smelt ores, cook food, manage fuel efficiently
- [ ] **GPL-07**: Enchanting — build enchanting setup, enchant tools/armor when possible
- [ ] **GPL-08**: Nether exploration — build portal, explore nether, gather nether resources
- [ ] **GPL-09**: Storage organization — build and maintain organized chest storage, label and sort
- [ ] **GPL-10**: Tool/armor progression — actively pursue upgrades from wood → stone → iron → diamond

## Future Requirements

### Advanced
- **ADV-01**: Settlement layout planning — town grid, district zones, connecting paths
- **ADV-02**: Ender Dragon preparation and fight
- **ADV-03**: Redstone contraptions and automated farms
- **ADV-04**: Memory consolidation (sleep-replay) for multi-week longevity

## Out of Scope

| Feature | Reason |
|---------|--------|
| Screenshot-based vision | Mineflayer provides richer block data; screenshot vision costs $130/day per agent |
| Honcho / Letta / MemGPT | Over-engineered for file-backed architecture; SQLite is sufficient |
| Redis for coordination | Overkill for 2 agents on one machine; shared JSON + atomic rename |
| Settlement layout planning | Even GDMC competition hasn't solved terrain adaptation after 8 years; get individual builds right first |
| LLM coordinate generation | LLMs can't count blocks reliably; deterministic code handles all spatial math |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MEM-01 | Phase 14 | Complete |
| MEM-02 | Phase 15 | Complete |
| MEM-03 | Phase 14 | Complete |
| MEM-04 | Phase 15 | Complete |
| BLD-01 | Phase 17 | Complete |
| BLD-02 | Phase 17 | Complete |
| BLD-03 | Phase 17 | Complete |
| BLD-04 | Phase 17 | Complete |
| BLD-05 | Phase 17 | Complete |
| SPA-01 | Phase 16 | Complete |
| SPA-02 | Phase 16 | Complete |
| SPA-03 | Phase 14 | Complete |
| SPA-04 | Phase 16 | Complete |
| COO-01 | Phase 19 | Pending |
| COO-02 | Phase 19 | Pending |
| COO-03 | Phase 19 | Pending |
| COO-04 | Phase 19 | Pending |
| GPL-01 | Phase 18 | Complete |
| GPL-02 | Phase 18 | Complete |
| GPL-03 | Phase 18 | Complete |
| GPL-04 | Phase 18 | Complete |
| GPL-05 | Phase 18 | Pending |
| GPL-06 | Phase 18 | Complete |
| GPL-07 | Phase 18 | Pending |
| GPL-08 | Phase 18 | Pending |
| GPL-09 | Phase 18 | Pending |
| GPL-10 | Phase 18 | Pending |

**Coverage:**
- v2.3 requirements: 27 total (note: requirements file previously stated 23 — actual count is 27)
- Mapped to phases: 27/27
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
*Traceability updated: 2026-03-23 (roadmap v2.3)*
