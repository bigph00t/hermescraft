# Feature Research: v2.3 Persistent Memory & Ambitious Building

**Domain:** LLM-driven Minecraft agent — persistent episodic memory, ambitious build planning, complex gameplay loops, multi-agent coordination
**Researched:** 2026-03-23
**Confidence:** HIGH for memory architecture patterns (verified against Stanford Generative Agents, Project Sid PIANO, MrSteve papers); HIGH for build planning approach (verified against T2BM, APT, GDMC research); MEDIUM for skill learning pipeline (Voyager verified, Mineflayer integration is inference); LOW for specific implementation timings

> **Note:** This file replaces the v2.0 FEATURES.md. The v2.0 table-stakes (pathfinding, crafting, survival modes, etc.) are already shipped and not repeated here. This document covers what is NEW for v2.3.

---

## Context: The Research Landscape

Four key projects define the state-of-the-art for what we're building:

**Stanford Generative Agents ("Smallville", 2023):** The canonical episodic memory architecture. Every observation enters a memory stream. A scoring function (recency × importance × relevance) determines what gets retrieved. When accumulated importance exceeds a threshold, agents "reflect" — writing higher-level summaries from raw memories. This produces human-like behavior emergence without any pre-programmed rules.

**Project Sid / PIANO (Altera, 2024):** 1000 agents on a Minecraft server. PIANO runs memory processing, behavior recognition, fast action generation, goal setting, and social recognition in parallel streams. Key finding: agents with social memory modules spontaneously specialized into farmers, engineers, traders, guards — with no explicit role-assignment code. Social modules were the critical differentiator between agents that felt alive and agents that felt robotic.

**Voyager (MineDojo, 2023):** Skill library as a vector database. Key indexed by embedding of skill description, value is the JavaScript code. Retrieval: embed (current task + environment state) → top-5 similar skills. Self-verification before adding a skill. Iterative feedback loop: execute → get error → revise → re-execute up to N times. Skills compound: complex skills call simpler ones. This is the right model for skill learning.

**MrSteve / Place Event Memory (2024, ICLR 2025):** Episodic memory keyed on **what + where + when** — not just raw text. Spatial indexing enables "I remember finding iron near the ravine to the east" rather than buried-in-text recall. Mode Selector: if the task-relevant resource exists in memory → Execute mode; else → Explore mode. This is the right model for Minecraft spatial memory.

**T2BM / APT (2024):** LLM generates buildings as structured JSON (interlayer representation), not raw coordinates. Structural vs. functional component separation. GPT-4 + repair modules: 80% structural success but only 48% material-constraint satisfaction. Key lesson: LLMs can reason about architecture but struggle with exact spatial precision — the right role is **design intent**, not **coordinate arrays**.

---

## Table Stakes (New for v2.3)

Features that the v2.3 milestone must deliver to feel complete. Without these, the milestone has no coherent theme.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Persistent cross-session memory (JSONL log + retrieval) | Agents must remember "what happened yesterday" — sessions feel connected, not amnesiac | MEDIUM | Append every significant event to a JSONL log. On session start, load recent N entries into context. Without this, "persistent agents" is marketing copy. |
| Memory importance scoring | Raw event log without ranking buries the signal in noise | MEDIUM | Score each memory on a 1-10 scale at write time (LLM call or heuristic). Combine with recency and relevance for retrieval. Direct application of Stanford Generative Agents approach. |
| Session journal entry (end-of-session reflection) | Agents that process their experiences are more coherent next session | MEDIUM | After each session ends (or after N experiences accumulate), write a 200-400 token summary: "Today I did X, learned Y, built Z." Store as a dated journal entry in `data/{name}/journal/`. |
| Spatial memory (place + event index) | Minecraft is a 3D world — memories without coordinates are nearly useless for retrieval | MEDIUM | Each event tagged with coordinates and dimension. Query: "what do I know about this area?" via bounding-box lookup. Directly from MrSteve PEM architecture. |
| LLM-authored build specs (not hand-authored blueprints) | Agents designing their own buildings is the headline v2.3 feature | HIGH | Agent describes a building concept (style, dimensions, materials) in natural language. A build-spec generator translates to a structured JSON blueprint (T2BM interlayer pattern). Body executes from spec. |
| Material planning before build execution | Agents that start builds without materials waste 30+ minutes and fail visibly | MEDIUM | Before starting any build, emit a !plan_build command that computes: materials needed, materials on hand, gap list, estimated gather time. LLM approves or revises before body begins. |
| Multi-phase build tracking (progress state) | Builds of 200+ blocks require state across ticks and sessions | MEDIUM | Build state file: phase (foundation/walls/roof/interior/done), blocks placed vs. planned, current worker assignments. Read by agent on session start to resume interrupted builds. |
| Animal farming skill (!farm_animals) | Complex gameplay loop agents currently lack — provides food passively | MEDIUM | Breed animals (right-click with food item), build a pen (fence + gate), maintain population. Mineflayer has `bot.activateEntityAt()` for feeding, `bot.activateBlock()` for gates. |
| Mob hunting loop (active patrol behavior) | Agents that farm XP and loot feel like real players | MEDIUM | Patrol a radius, detect hostile mobs via `bot.nearestEntity()`, engage and kill, collect drops, return to base. Distinguished from reactive `self_defense` mode — this is *proactive* hunting. |
| Exploration with memory logging | Agents that map the world and remember what they found are dramatically more useful | MEDIUM | On explore, log biome, notable blocks (ores, structures, chests), coordinates. Store to spatial memory. Enables "go mine iron at the ravine I found last Tuesday." |
| Multi-agent task splitting (!assign command) | Two agents coordinating on a large build halves the time and looks impressive | HIGH | Coordinator agent decomposes a build into sections (foundation to Agent A, walls to Agent B). Agents claim sections atomically to prevent double-work. Status broadcast via chat. |

---

## Differentiators (Competitive Advantage)

Features that would make HermesCraft stand out from Mindcraft, Voyager, and every other Minecraft AI project.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Personality-driven build aesthetics | Jeffrey builds warm oak-and-stone cottages; John builds efficient utilitarian structures — builds reveal character | HIGH | SOUL file encodes aesthetic preferences (preferred materials, structural motifs, size defaults). Build spec generator uses SOUL context when generating building descriptions. No other MC agent project does this. |
| Background memory consolidation agent | A separate lightweight process that runs while agents are offline, summarizing and indexing yesterday's memories | HIGH | Runs as a cron job or session-end trigger. Uses a cheap LLM call to compress 50 raw memories into 10 high-value summaries. Prevents memory log from growing unbounded. Analogous to neuroscience sleep consolidation. |
| Episodic memory retrieval in prompt (RAG) | Instead of injecting full MEMORY.md every tick, retrieve the 5 most relevant past experiences for the current situation | HIGH | Existing RAG infrastructure (BM25 + vector, `mind/knowledgeStore.js`) is already built. Add an episodic memory collection alongside the MC knowledge collection. Apply the same hybrid retrieval to personal memory. |
| "What do I know about here?" spatial query | Agent standing near a cave can ask its own memory for what it found last time it was nearby | MEDIUM | Bounding-box lookup in spatial memory index: find all events within 50 blocks of current position. Inject into user message as "Nearby memory:" context. MrSteve PEM pattern applied to HermesCraft. |
| Settlement layout planning | Agents lay out an entire settlement — placing buildings in relation to each other (farm near water, forge near mine entrance, sleeping quarters away from noise) | VERY HIGH | LLM-generated site plan: describe relationships, constraints, order of construction. Terrain reader assesses candidate positions. This is what GDMC has been researching for 8 years. Only build this once agents can reliably build individual structures. |
| Autonomous long-horizon goal progression | Agent sets its own multi-day goal ("build a proper farm, then a forge, then expand the base") and drives toward it across sessions | HIGH | Goal hierarchy: macro-goals (multi-day) → meso-goals (per-session) → micro-goals (current action). Macro-goals persist in memory, meso-goals regenerated each session based on macro-goal progress. Project Sid found agents with long-term agendas felt more alive. |
| Social memory (relationship tracking) | Agents remember past interactions with players and each other, build up opinions, reference shared history | MEDIUM | `social.js` extended with: per-entity relationship score (neutral/friendly/tense), list of shared events ("we built the forge together"), last interaction timestamp. Injected into prompt for relevant entities. |
| Build quality self-verification | After placing a structure, agent walks around it, detects missing/wrong blocks, patches errors before declaring done | MEDIUM | Post-build scan: for each planned block in build spec, check `bot.blockAt(x,y,z)`. Collect discrepancies. Issue patch commands for errors. T2BM research showed repair modules are essential — even GPT-4 has placement errors. |

---

## Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Free-form coordinate generation (LLM outputs raw x/y/z arrays) | "Give the LLM full spatial freedom" | T2BM with GPT-4 + repair: only 48% material constraint satisfaction. Smaller models (MiniMax M2.7): likely near 0%. Spatial arithmetic is LLM kryptonite. | LLM outputs a *description* (5x5x4 oak cabin, pitched roof, 2 windows per side). Deterministic code translates description to coordinates. Structural intent separated from spatial math. |
| Screenshot-based vision for build verification | "The agent should see what it built" | Requires Xvfb, Claude Haiku costs $, 1GB RAM per agent. Already marked Out of Scope in PROJECT.md. v1.0 failure mode: agents narrated fantasy while placements failed. | `bot.blockAt(x,y,z)` gives ground truth. Post-build verification loop compares blueprint spec against actual world state. No camera needed. |
| Full Voyager-style code generation for all tasks | "Let the agent write its own skills for any task" | MiniMax M2.7 is not GPT-4. Code generation with smaller models has very high error rates. HermesCraft v2.0 already has Tier 2 code gen as escape hatch. | Extend the Tier 1 command palette. New !commands for the new v2.3 gameplay loops. Reserve code gen for truly novel tasks the palette can't express. |
| Unbounded memory accumulation | "Store everything forever" | Without consolidation, a 30-day session log has 50k+ entries. Retrieval quality degrades with index size. Prompt injection of raw log becomes impossible. | Memory consolidation: raw events → daily journal summaries → persistent lessons. Three layers: raw log (JSONL), daily summaries (one per session), distilled lessons (MEMORY.md). |
| Real-time multi-agent chat coordination for builds | "Agents should negotiate every block placement" | Mindcraft MineCollab paper found coordination communication has 15% performance penalty. Real-time chat is latency-sensitive and noisy. | Pre-task assignment: coordinator decomposes task once at the start, assigns spatial sections atomically, agents execute independently. Check-in only at phase boundaries. |
| Continuous self-prompting without task context | "Agent should always be thinking about something" | Without goal hierarchy, continuous self-prompting produces circular behavior (collect wood → make sticks → collect wood). Project Sid noted agents got stuck without long-horizon structure. | Goal hierarchy enforced. When micro-goal completes, agent retrieves next micro-goal from meso-goal. When meso-goal completes, agent derives new meso-goal from macro-goal. Never prompting into a void. |
| Per-tick memory writes | "Save every observation to memory immediately" | Writes at 300ms tick rate = 10k+ entries/hour. Disk thrash. Retrieval quality collapses. | Write to memory only on significant events: skill completion, build phase transition, discovery (new biome/ore/structure), death, social interaction, session end. |

---

## Feature Dependencies

```
Persistent Cross-Session Memory (JSONL log)
    └── required by: Memory importance scoring
    └── required by: Session journal entry
    └── required by: Episodic memory RAG retrieval
    └── required by: Social memory
    └── enables: All "I remember..." behaviors

Memory Importance Scoring
    └── requires: Persistent memory log
    └── enhances: Episodic memory RAG (better signal/noise ratio)
    └── enables: Background memory consolidation (knows what to keep)

Spatial Memory (place + event index)
    └── requires: Persistent memory log (adds coordinate tag)
    └── enables: "What do I know about here?" spatial query
    └── enables: MrSteve-style Explore/Execute mode switching
    └── independent of: Episodic RAG retrieval

LLM-Authored Build Specs
    └── requires: Existing !build command (body/skills/build.js)
    └── requires: Existing blueprints system (body/blueprints/)
    └── enables: Personality-driven build aesthetics
    └── enables: Settlement layout planning (much later)
    └── required by: Material planning before build execution
    └── required by: Multi-phase build tracking
    └── required by: Build quality self-verification

Material Planning Before Build Execution
    └── requires: LLM-authored build spec (needs material list)
    └── requires: Inventory query (!inventory)
    └── requires: Crafting plan query (!getCraftingPlan)
    └── enables: Reliable large build attempts (no mid-build failures)

Multi-Phase Build Tracking
    └── requires: LLM-authored build specs
    └── requires: Persistent storage (build state file)
    └── enables: Cross-session build continuation
    └── required by: Multi-agent task splitting (needs shared state)

Animal Farming Skill
    └── requires: Navigation (mineflayer-pathfinder)
    └── requires: Block placement (fence, gate)
    └── independent of: memory system
    └── enables: Passive food loop

Mob Hunting Loop
    └── requires: Existing combat (!combat command)
    └── enhances: XP and loot collection
    └── independent of: memory system

Exploration with Memory Logging
    └── requires: Spatial memory (coordinate tagging)
    └── requires: Navigation (!navigate command)
    └── enables: "What do I know about here?" queries
    └── enables: Autonomous long-horizon goal progression (knows what's out there)

Multi-Agent Task Splitting
    └── requires: Multi-phase build tracking (shared state)
    └── requires: Existing multi-agent coordination (chat routing)
    └── requires: LLM-authored build specs (section decomposition)
    └── enhances: Large build speed and impressiveness

Episodic Memory RAG Retrieval
    └── requires: Persistent memory log
    └── requires: Existing KnowledgeStore (mind/knowledgeStore.js) — add new collection
    └── enhances: All LLM reasoning (relevant past context injected)
    └── enables: Background memory consolidation agent (defines what to consolidate)

Background Memory Consolidation Agent
    └── requires: Persistent memory log with importance scores
    └── requires: Episodic RAG (determines retrieval quality baseline)
    └── enables: Unbounded session longevity (memory stays manageable)
    └── runs: async, separate process, does not block main tick

Autonomous Long-Horizon Goal Progression
    └── requires: Episodic memory RAG (knows what was accomplished)
    └── requires: Persistent memory (macro-goals survive session end)
    └── requires: Material planning + build tracking (know current state)
    └── enhances: Agent "feels alive" over days/weeks

Settlement Layout Planning
    └── requires: Multiple reliable individual builds (prerequisite: LLM build specs working)
    └── requires: Spatial memory (know the terrain)
    └── requires: Multi-agent task splitting (buildings assigned to agents)
    └── DEFER: Only after individual buildings are reliable
```

---

## MVP Definition for v2.3

### Launch With (v2.3 milestone — Persistent Memory & Ambitious Building)

These are the minimum features that make v2.3 coherent and demonstrable.

- [ ] **Persistent cross-session memory log** — JSONL, append on significant events only (skill complete, death, discovery, build phase, social interaction). Session start loads last 24h.
- [ ] **Memory importance scoring** — heuristic-first (death=10, discovery=8, build_complete=7, conversation=5, routine_action=2). LLM scoring only for ambiguous events. Prevents log from being equal-weight noise.
- [ ] **Session journal entry** — written at session end (or every 30 minutes of activity). 200-400 tokens: "Today I accomplished X, found Y, worked on Z with John." Stored in `data/{name}/journal/`. Injected into session-start context.
- [ ] **Spatial memory index** — each logged event gets (x, z, dimension) tag. `!what_do_i_know_here` query does bounding-box lookup within 100 blocks.
- [ ] **LLM-authored build specs** — !design_build command: LLM describes a building (style, dimensions, material choices, personality flavor). Build spec generator produces structured JSON. Body executes from spec. No hand-authored blueprints for new builds.
- [ ] **Material planning before build** — !plan_build produces material checklist from spec. Agent gathers missing materials before placing a single block.
- [ ] **Multi-phase build tracking** — build state file: phase, blocks placed, agent assignments. Survives session restart. Agent resumes without being told.
- [ ] **Build quality self-verification** — post-build: scan all planned coordinates, report errors, patch automatically where possible.

### Add After Validation (v2.3.x)

Features to add once the core memory + build loop is working reliably.

- [ ] **Episodic memory RAG** — add memory JSONL as a second collection in `mind/knowledgeStore.js`. Retrieve top-5 relevant memories per think() call using existing BM25+vector pipeline.
- [ ] **Animal farming skill** — breed, pen, maintain. Trigger: agents reliably build structures (needs fences + gates).
- [ ] **Mob hunting patrol** — proactive combat loop. Trigger: combat skill is stable, bots have armor.
- [ ] **Exploration with memory logging** — systematic radius exploration with biome/ore/structure annotation. Trigger: basic spatial memory working.
- [ ] **Social memory extension** — track per-entity interaction history, opinion score, shared events. Inject for relevant entities.

### Future Consideration (v2.4+)

Defer until v2.3 core is validated.

- [ ] **Background memory consolidation agent** — async process, compresses old raw memories to summaries. Defer: need to see actual memory volume in production first.
- [ ] **Autonomous long-horizon goal progression** — goal hierarchy: macro/meso/micro. Defer: requires stable memory + builds to be worth tracking.
- [ ] **Multi-agent task splitting** — coordinate decomposition and atomic section claiming. Defer: single-agent builds must be reliable first.
- [ ] **Settlement layout planning** — site selection, building relationship planning. Defer: requires reliable individual builds + spatial memory + multi-agent splitting. This is a separate milestone (v2.5+).
- [ ] **Personality-driven build aesthetics** — SOUL-aware material preferences. Can be bolted onto LLM build specs early (just SOUL context injection) but full implementation is iterative.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Persistent cross-session memory log | HIGH | LOW | P1 |
| Memory importance scoring (heuristic) | HIGH | LOW | P1 |
| Session journal entry | HIGH | LOW | P1 |
| Spatial memory index | HIGH | MEDIUM | P1 |
| LLM-authored build specs | HIGH | HIGH | P1 |
| Material planning before build | HIGH | MEDIUM | P1 |
| Multi-phase build tracking | HIGH | MEDIUM | P1 |
| Build quality self-verification | MEDIUM | MEDIUM | P1 |
| Episodic memory RAG | HIGH | MEDIUM | P2 |
| Animal farming skill | MEDIUM | MEDIUM | P2 |
| Mob hunting patrol | MEDIUM | MEDIUM | P2 |
| Exploration with memory logging | HIGH | MEDIUM | P2 |
| Social memory extension | MEDIUM | MEDIUM | P2 |
| Background memory consolidation | HIGH | HIGH | P3 |
| Autonomous long-horizon goals | HIGH | VERY HIGH | P3 |
| Multi-agent task splitting | HIGH | HIGH | P3 |
| Personality-driven build aesthetics | HIGH | LOW | P2 (bolt-on to LLM build specs) |
| Settlement layout planning | HIGH | VERY HIGH | P4 (separate milestone) |

**Priority key:**
- P1: v2.3 launch
- P2: v2.3.x after validation
- P3: v2.4+ milestone
- P4: Separate milestone (v2.5+)

---

## Competitor Feature Analysis

| Feature | Mindcraft (kolbytn) | Voyager (MineDojo) | Project Sid (Altera) | HermesCraft v2.3 Plan |
|---------|---------------------|--------------------|-----------------------|----------------------|
| Cross-session memory | 500-char LLM summary of history. No true persistence beyond session. | Skill library persists (code), not episodic experience | Full persistent memory with PIANO parallel streams | JSONL event log + importance scores + journal + RAG retrieval |
| Episodic memory retrieval | None — uses in-context history only | None — skills are procedural not episodic | Yes — retrieves past interactions for social context | RAG over personal experience log (reuse existing KnowledgeStore) |
| Spatial memory | Saved named places only. No event-location index. | None | Implicit in agent state, not explicit index | Coordinate-tagged events + bounding-box query ("what's near me?") |
| Build planning | `!newAction` code gen. LLM writes JS with coordinates. High error rate. | Code gen only, requires GPT-4 | Not a focus | LLM describes intent in natural language → JSON spec → deterministic executor |
| Material pre-planning | None — agents attempt crafts that fail | None | Not a focus | Explicit !plan_build: full material checklist before first block placed |
| Build progress tracking | None — builds are single-call attempts | None | Not a focus | Build state file, cross-session resume, phase tracking |
| Skill learning | No auto-improvement from outcomes | Vector DB of generated JS skills, self-verifying | Not explicit | HermesCraft SKILL.md pattern (existing) + automatic update on build completion |
| Multi-agent coordination | Conversation routing + goal sharing. MineCollab found 15% perf penalty from chat coordination. | Single agent | PIANO parallel processing, specialized role emergence | Pre-task assignment (not real-time chat negotiation), atomic section claiming |
| "Feels human" behavior | idle_staring, elbow_room, day/night routine (all v2.0 shipped) | None — pure task optimizer | Role specialization emergence, cultural behaviors | All v2.0 behaviors + memory continuity ("I remember when we built this together") |
| Build quality verification | None | None (code gen either works or errors out) | Not a focus | Post-build coordinate scan, automatic patch loop |

---

## Sources

- [Voyager paper (arXiv 2305.16291)](https://arxiv.org/abs/2305.16291) — Skill library as vector DB, iterative feedback, self-verification. HIGH confidence.
- [Voyager GitHub (MineDojo)](https://github.com/MineDojo/Voyager) — Implementation details, skill_manager, .js skill files, top-5 retrieval. HIGH confidence.
- [Generative Agents: Interactive Simulacra of Human Behavior (Park et al., UIST 2023)](https://dl.acm.org/doi/10.1145/3586183.3606763) — Memory stream, importance scoring, reflection, recency decay. HIGH confidence. The canonical reference for episodic memory in LLM agents.
- [Project Sid: Many-agent simulations toward AI civilization (arXiv 2411.00114)](https://arxiv.org/html/2411.00114v1) — PIANO architecture, STM/LTM/WM, social modules, role specialization emergence. HIGH confidence.
- [MrSteve: Instruction-Following Agents in Minecraft with What-Where-When Memory (arXiv 2411.06736, ICLR 2025)](https://arxiv.org/html/2411.06736v3) — Place Event Memory (PEM), what/where/when tagging, Explore/Execute mode switching. HIGH confidence.
- [3D Building Generation in Minecraft via Large Language Models / T2BM (arXiv 2406.08751)](https://arxiv.org/html/2406.08751v1) — Interlayer JSON representation, structural/functional decomposition, 80% completeness / 48% material accuracy with GPT-4. MEDIUM confidence.
- [Mindcraft MineCollab: Collaborating Action by Action (arXiv 2504.17950)](https://arxiv.org/html/2504.17950v1) — 15% performance penalty for detailed communication, communication is primary bottleneck in multi-agent MC. HIGH confidence.
- [GDMC Settlement Generation Competition 2024/2025](https://gendesignmc.wikidot.com/wiki:2024-settlement-generation-competition) — Site selection, terrain adaptation, district suitability marking. MEDIUM confidence.
- [Memory in the Age of AI Agents (arXiv 2512.13564)](https://arxiv.org/abs/2512.13564) — Survey of memory mechanisms: recency, importance, relevance retrieval; consolidation; reflection. MEDIUM confidence.
- [HermesCraft PROJECT.md](/.planning/PROJECT.md) — v2.3 milestone goals, existing shipped features (all v2.0 + RAG system). HIGH confidence.

---

*Feature research for: HermesCraft v2.3 Persistent Memory & Ambitious Building*
*Researched: 2026-03-23*
