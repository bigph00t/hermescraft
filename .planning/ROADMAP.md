# Roadmap: HermesCraft

## Milestones

- [x] **v1.0** - Paper Migration + Plugin-Enhanced Agents — Phases 1-4 (shipped 2026-03-22)
- [x] **v1.1** - Tool Quality & Building Intelligence — Phases 5-8 (shipped 2026-03-22)
- [x] **v2.0** - Mineflayer Rewrite — Phases 1-6 (shipped 2026-03-22)
- [x] **v2.1** - Creative Building + Bug Fixes — Phases 7-10 (shipped 2026-03-22)
- [x] **v2.2** - Minecraft RAG — Phases 11-13 (shipped 2026-03-23)
- [ ] **v2.3** - Persistent Memory & Ambitious Building — Phases 14-22

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

**Milestone Goal:** Transform agents into learning, growing beings with persistent memory, dual-brain reasoning, vision, ambitious building, and full Minecraft gameplay mastery. Deploy custom Qwen3.5-27B model on RunPod A6000 with background 9B brain.

## Phases

- [ ] **Phase 14: RunPod Infrastructure** - Deploy A6000 48GB pod with dual-model serving (27B main + 9B background)
- [x] **Phase 15: Dual-Brain Architecture** - Background brain module with shared state, insight injection, constraint system (completed 2026-03-23)
- [x] **Phase 16: Vision System** - Screenshot capture + VLM processing + spatial understanding database (completed 2026-03-23)
- [x] **Phase 17: Memory Foundation** - SQLite event log with importance scoring, spatial tagging, cross-session persistence (completed 2026-03-23)
- [x] **Phase 18: Memory Integration** - Episodic retrieval in LLM calls, reflection journals, background brain memory consolidation (completed 2026-03-23)
- [ ] **Phase 19: Enhanced Spatial + Building** - Entity awareness, build verification, LLM build specs, section decomposition, material planning
- [ ] **Phase 20: Gameplay Loops** - Animal farming, crop farming, mob hunting, exploration, trading, enchanting, nether, progression
- [ ] **Phase 21: Multi-Agent Coordination** - Shared task registry, chat dedup, spatial task splitting, activity broadcasting
- [ ] **Phase 22: Polish & Tool Fixes** - Tool auto-equipping, bug fixes, prompt tuning, overnight stability

## Phase Details

### Phase 14: RunPod Infrastructure
**Goal**: Custom Qwen3.5-27B heretic fine-tune running on RunPod A6000 48GB, replacing MiniMax M2.7, with secondary 9B model for background brain
**Depends on**: Phase 13 (existing agent system)
**Requirements**: Infrastructure — no REQ-IDs (enabling phase)
**Success Criteria** (what must be TRUE):
  1. RunPod A6000 48GB pod is running with llama-server serving Qwen3.5-27B heretic Q6_K GGUF on port 8000
  2. Secondary Qwen3.5-9B running via vLLM on port 8001 on the same pod
  3. Both Luna and Max agents connect to the new model and produce coherent responses
  4. Response latency is under 3 seconds for 128-token generation (main brain)
  5. .env.runpod configured for on-pod localhost deployment; Glass .env updated if agents also run remotely
**Plans:** 1/2 plans executed
Plans:
- [x] 14-01-PLAN.md — All infra scripts + code changes (autonomous: setup-pod, start-models, start-stack, llm.js MAX_TOKENS, launch-duo defaults, docker-compose.runpod, .env.runpod, smoke test)
- [ ] 14-02-PLAN.md — RunPod pod provisioning + full stack deployment + agent coherence verification (collaborative)

### Phase 15: Dual-Brain Architecture
**Goal**: Each agent has a background brain (9B) that runs every 30-60s, producing insights, plans, and constraints that the main brain (27B) reads on each tick
**Depends on**: Phase 14
**Requirements**: Infrastructure — enabling phase
**Success Criteria** (what must be TRUE):
  1. Background brain module runs on a 30-second interval, calling the 9B model asynchronously
  2. Background brain writes structured JSON to `data/<agent>/brain-state.json` (insights, plans, spatial hazards, constraints)
  3. Main brain reads brain-state.json with 5s TTL cache and injects relevant insights into the system prompt
  4. Ring buffers cap all state: 20 insights, 50 spatial entries, 100 partner observations
  5. GPU contention is negligible — main brain and background brain don't block each other
**Plans:** 2/2 plans complete
Plans:
- [x] 15-01-PLAN.md — Core background brain module (mind/backgroundBrain.js) + env var docs
- [x] 15-02-PLAN.md — Wiring into agent startup, think loop, system prompt + smoke tests

### Phase 16: Vision System
**Goal**: Agents can "see" their world via screenshots, processed by VLM into spatial understanding
**Depends on**: Phase 14, Phase 15
**Requirements**: Infrastructure — enabling phase
**Success Criteria** (what must be TRUE):
  1. prismarine-viewer renders the bot's perspective headlessly on RunPod
  2. `!see` command captures a screenshot, sends to Qwen2.5-VL-7B, returns natural language description
  3. Background brain periodically processes screenshots into spatial awareness entries
  4. Screenshots are stored in `data/<agent>/screenshots/` with timestamps for history
  5. Top-down minimap generation from block data as lightweight alternative
**Plans:** 2/2 plans complete
Plans:
- [x] 16-01-PLAN.md — Core vision modules (mind/vision.js, mind/minimap.js) + entity awareness in spatial.js (SPA-01)
- [x] 16-02-PLAN.md — Wiring: !see command, prompt injection, background brain vision, post-build scan (SPA-02), smoke tests

### Phase 17: Memory Foundation
**Goal**: Agents accumulate a persistent, spatially-tagged event log across sessions — no experience is ever lost
**Depends on**: Phase 14
**Requirements**: MEM-01, MEM-03, SPA-03
**Success Criteria** (what must be TRUE):
  1. After an agent session ends and restarts, experiences from the prior session exist in SQLite with timestamps and coordinates
  2. Deaths, build completions, and discoveries are assigned importance scores (1-10) — deaths score 10, routine actions score 2 or below
  3. Every logged event carries (x, z, dimension) coordinates enabling queries like "what do I know about this location?"
  4. The event log is capped with FIFO pruning — never grows unbounded across weeks of play
**Plans:** 1/1 plans complete
Plans:
- [x] 17-01-PLAN.md — SQLite event log module (mind/memoryDB.js) + startup wiring + lifecycle hooks + smoke tests (MEM-01, MEM-03, SPA-03)

### Phase 18: Memory Integration
**Goal**: Retrieved past experiences appear in every LLM call — agents demonstrably reference prior sessions
**Depends on**: Phase 15, Phase 17
**Requirements**: MEM-02, MEM-04
**Success Criteria** (what must be TRUE):
  1. Every think() call injects top-K relevant past experiences into the system prompt via Promise.all with knowledge RAG
  2. An agent that died to a creeper last session references that experience when exploring caves in the current session
  3. Background brain produces reflection journals — LLM-authored strategy summaries from recent experiences
  4. Total memory context stays within 4,000-token budget
**Plans:** 1/1 plans complete
Plans:
- [x] 18-01-PLAN.md — Memory retrieval in think() + prompt injection + reflection journals + smoke tests (MEM-02, MEM-04)

### Phase 19: Enhanced Spatial + Building
**Goal**: Agents have rich entity awareness, can verify builds, and can plan/execute 500+ block structures
**Depends on**: Phase 16, Phase 17
**Requirements**: SPA-01, SPA-02, SPA-04, BLD-01, BLD-02, BLD-03, BLD-04, BLD-05
**Success Criteria** (what must be TRUE):
  1. Agent prompts include nearby mobs, animals, villagers with types, distances, and health
  2. LLM generates structured build specs from natural language — deterministic code handles coordinates
  3. Builds over 100 blocks decompose into sections that persist across session restarts
  4. Agent reports exact material list and won't start without sufficient inventory
  5. Post-build scan detects missing/wrong blocks and auto-repairs
**Plans**: TBD

### Phase 20: Gameplay Loops
**Goal**: Agents pursue rich, human-like gameplay — farming, hunting, exploring, trading, progressing gear
**Depends on**: Phase 17
**Requirements**: GPL-01 through GPL-10
**Success Criteria** (what must be TRUE):
  1. Agents breed and manage animal pens autonomously
  2. Agents plant, grow, harvest crops with auto-replant and bone meal
  3. Agents proactively hunt hostile mobs for drops
  4. Agents explore systematically and log findings to spatial memory
  5. Agents pursue wood → stone → iron → diamond progression and manage smelting
**Plans**: TBD

### Phase 21: Multi-Agent Coordination
**Goal**: Multiple agents coordinate without duplicate work, chat loops, or state conflicts
**Depends on**: Phase 17, Phase 18, Phase 19
**Requirements**: COO-01 through COO-04
**Success Criteria** (what must be TRUE):
  1. Claimed tasks visible in shared registry — no duplicate work
  2. Chat loops impossible — forced non-chat action after 3 consecutive chats
  3. Large builds split spatially — each agent owns its section
  4. Each agent sees partner's current activity without asking
**Plans**: TBD

### Phase 22: Polish & Tool Fixes
**Goal**: Fix accumulated bugs, tune prompts, ensure overnight stability
**Depends on**: All prior phases
**Requirements**: Bug fixes, stability
**Success Criteria** (what must be TRUE):
  1. Agents auto-equip best tool before mining/gathering (no more mining with fists)
  2. Agents run 12+ hours without crashes or disconnects
  3. Prompt tuning: chat frequency, building ambition, exploration drive all feel natural
  4. Memory, brain-state, and spatial database all persist correctly across restarts
**Plans**: TBD

## Progress

**Execution Order:** 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 14. RunPod Infrastructure | 1/2 | In Progress|  |
| 15. Dual-Brain Architecture | 2/2 | Complete    | 2026-03-23 |
| 16. Vision System | 2/2 | Complete    | 2026-03-23 |
| 17. Memory Foundation | 1/1 | Complete    | 2026-03-23 |
| 18. Memory Integration | 1/1 | Complete   | 2026-03-23 |
| 19. Enhanced Spatial + Building | 0/TBD | Not started | - |
| 20. Gameplay Loops | 0/TBD | Not started | - |
| 21. Multi-Agent Coordination | 0/TBD | Not started | - |
| 22. Polish & Tool Fixes | 0/TBD | Not started | - |
