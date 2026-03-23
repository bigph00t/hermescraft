# Roadmap: HermesCraft

## Milestones

- [x] **v1.0** - Paper Migration + Plugin-Enhanced Agents — Phases 1-4 (shipped 2026-03-22)
- [x] **v1.1** - Tool Quality & Building Intelligence — Phases 5-8 (shipped 2026-03-22)
- [x] **v2.0** - Mineflayer Rewrite — Phases 1-6 (shipped 2026-03-22)
- [x] **v2.1** - Creative Building + Bug Fixes — Phases 7-10 (shipped 2026-03-22)
- [x] **v2.2** - Minecraft RAG — Phases 11-13 (shipped 2026-03-23)
- [ ] **v2.3** - Persistent Memory & Ambitious Building — Phases 14-19

---

<details>
<summary>v2.2 Minecraft RAG (Phases 11-13) — SHIPPED 2026-03-23</summary>

- [x] Phase 11: Knowledge Corpus (3/3 plans) — completed 2026-03-23
- [x] Phase 12: KnowledgeStore (1/1 plans) — completed 2026-03-23
- [x] Phase 13: Prompt Integration (2/2 plans) — completed 2026-03-23

See: `.planning/milestones/v2.2-ROADMAP.md` for full details.

</details>

---

## v2.3 Persistent Memory & Ambitious Building

**Milestone Goal:** Transform agents from session-scoped bots into truly learning, growing beings that remember everything, plan massive builds, and coordinate complex multi-phase projects together.

## Phases

- [ ] **Phase 14: Memory Foundation** - Persistent cross-session event log with importance scoring and spatial tagging
- [ ] **Phase 15: Memory Prompt Integration** - Close the memory loop — retrieved experiences appear in every LLM call
- [ ] **Phase 16: Enhanced Spatial Intelligence** - Entity awareness, post-build scanning, and area familiarity
- [ ] **Phase 17: Ambitious Build Planning** - LLM-authored build specs for 500+ block structures with material planning and verification
- [ ] **Phase 18: Gameplay Loops** - Animal farming, crop farming, mob hunting, exploration, trading, and progression skills
- [ ] **Phase 19: Multi-Agent Coordination** - Shared task registry, chat deduplication, and activity broadcasting

## Phase Details

### Phase 14: Memory Foundation
**Goal**: Agents accumulate a persistent, spatially-tagged event log across sessions — no experience is ever lost
**Depends on**: Phase 13 (Prompt Integration)
**Requirements**: MEM-01, MEM-03, SPA-03
**Success Criteria** (what must be TRUE):
  1. After an agent session ends and restarts, experiences from the prior session exist in `data/<agent>/experiences.jsonl` with timestamps and coordinates
  2. Deaths, build completions, and discoveries are assigned importance scores (1-10) — deaths score 10, routine actions score 2 or below
  3. Every logged event carries (x, z, dimension) coordinates enabling queries like "what do I know about this location?"
  4. The event log is capped and never grows unbounded — FIFO pruning keeps it manageable across weeks of play
**Plans**: TBD

Plans:
- [ ] 14-01: TBD

### Phase 15: Memory Prompt Integration
**Goal**: Retrieved past experiences appear in every LLM call alongside RAG knowledge — agents demonstrably reference prior sessions
**Depends on**: Phase 14
**Requirements**: MEM-02, MEM-04
**Success Criteria** (what must be TRUE):
  1. Every `think()` call injects top-K relevant past experiences into the system prompt (retrieved in parallel with knowledge RAG via `Promise.all`)
  2. An agent that died to a creeper last session references that experience when exploring caves in the current session
  3. Periodic reflection journals exist in `data/<agent>/journal/` — LLM-authored summaries of recent experiences turned into strategy lessons
  4. Total memory context in the system prompt stays within the 4,000-token system prompt ceiling
**Plans**: TBD

Plans:
- [ ] 15-01: TBD

### Phase 16: Enhanced Spatial Intelligence
**Goal**: Agents have richer awareness of entities around them, can verify builds spatially, and know what territory they have and haven't explored
**Depends on**: Phase 14
**Requirements**: SPA-01, SPA-02, SPA-04
**Success Criteria** (what must be TRUE):
  1. Agent prompts include nearby mobs, animals, and villagers with types, distances, and health — not just a generic entity count
  2. After a build completes, the agent automatically scans the structure, detects missing or wrong blocks, and reports discrepancies
  3. The agent distinguishes explored vs unexplored territory based on accumulated spatial memory entries
**Plans**: TBD

Plans:
- [ ] 16-01: TBD

### Phase 17: Ambitious Build Planning
**Goal**: Agents can plan, gather materials for, and execute 500+ block structures with self-verification and retry
**Depends on**: Phase 14, Phase 16
**Requirements**: BLD-01, BLD-02, BLD-03, BLD-04, BLD-05
**Success Criteria** (what must be TRUE):
  1. `!plan` command generates a structured JSON build spec (style, dimensions, materials, features) from a natural language description
  2. A build over 100 blocks is automatically decomposed into sections — each section executes and persists independently, surviving session restarts
  3. Before any build begins, the agent reports the exact material list and won't start until inventory is sufficient
  4. After a build completes, the agent scans the result, identifies missing or incorrect blocks, and patches them automatically
  5. Failed block placements trigger an LLM-guided retry loop with error feedback injected — not silent failure
**Plans**: TBD

Plans:
- [ ] 17-01: TBD

### Phase 18: Gameplay Loops
**Goal**: Agents pursue rich, human-like gameplay activities — farming, hunting, exploring, trading, and progressing their gear
**Depends on**: Phase 14
**Requirements**: GPL-01, GPL-02, GPL-03, GPL-04, GPL-05, GPL-06, GPL-07, GPL-08, GPL-09, GPL-10
**Success Criteria** (what must be TRUE):
  1. Agents breed and manage animal pens, harvest food and materials, and maintain pen population autonomously via `!farm_animals`
  2. Agents plant, grow, and harvest crops with auto-replant and bone meal use via `!farm_crops`
  3. Agents proactively hunt hostile mobs for drops (bones, string, gunpowder, ender pearls) via `!hunt` — distinct from reactive self-defense
  4. Agents explore systematically, discover villages/temples/biomes, and log findings to spatial memory
  5. Agents actively pursue tool and armor upgrades from wood through diamond, smelting ores and managing furnace fuel efficiently
**Plans**: TBD

Plans:
- [ ] 18-01: TBD

### Phase 19: Multi-Agent Coordination
**Goal**: Multiple agents coordinate without duplicate work, chat loops, or file corruption — each sees what the other is doing
**Depends on**: Phase 14, Phase 15, Phase 17, Phase 18
**Requirements**: COO-01, COO-02, COO-03, COO-04
**Success Criteria** (what must be TRUE):
  1. When one agent claims a task (mine iron, build east wing), the other agent sees it as claimed and picks a different task — no duplicate work
  2. Agents cannot enter a chat loop — after 3 consecutive `!chat` actions a non-chat action is forced, and same-message deduplication prevents echo spirals
  3. A large build is decomposed into spatial sections, each agent claims its section via the shared registry, and both execute in parallel without colliding
  4. Each agent sees a live activity summary of its partner (what skill is running, last known location) without needing to ask via chat
**Plans**: TBD

Plans:
- [ ] 19-01: TBD

## Progress

**Execution Order:** 14 → 15 → 16 → 17 → 18 → 19

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 14. Memory Foundation | 0/TBD | Not started | - |
| 15. Memory Prompt Integration | 0/TBD | Not started | - |
| 16. Enhanced Spatial Intelligence | 0/TBD | Not started | - |
| 17. Ambitious Build Planning | 0/TBD | Not started | - |
| 18. Gameplay Loops | 0/TBD | Not started | - |
| 19. Multi-Agent Coordination | 0/TBD | Not started | - |
