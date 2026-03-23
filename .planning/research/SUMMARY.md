# Project Research Summary

**Project:** HermesCraft v2.3 — Persistent Memory & Ambitious Building
**Domain:** LLM-driven Minecraft agent — episodic memory, spatial intelligence, large-scale build planning, multi-agent coordination
**Researched:** 2026-03-23
**Confidence:** HIGH

## Executive Summary

HermesCraft v2.3 extends a working Mind+Body agent architecture with four capability areas: cross-session episodic memory, spatial intelligence for build planning, LLM-generated building specifications, and lightweight multi-agent coordination. The research is grounded in peer-reviewed work (Stanford Generative Agents, Project Sid PIANO, Voyager, MrSteve PEM, T2BM building generation) and direct codebase analysis of 3,389 lines across 24 existing modules. The existing architecture is a strong foundation: RAG infrastructure (BM25 + vector via MiniSearch + Vectra) is already in place and can serve double duty as the episodic memory retrieval pipeline. The per-agent data directory pattern already exists. The recommended approach adds three new `mind/` modules (`memoryStore.js`, `buildPlanner.js`, `taskRegistry.js`) and modifies six existing ones, without touching the Mind/Body boundary or introducing external infrastructure.

The two highest-value features for this milestone are persistent cross-session memory with importance scoring and LLM-authored build specifications. Both are grounded in well-researched patterns. Memory should follow the Stanford Generative Agents architecture: append-only JSONL event log, importance-scored entries, recency-weighted retrieval injected into prompts alongside existing knowledge RAG. Build specs should follow the T2BM interlayer pattern: LLM describes building intent in natural language, deterministic code converts the validated JSON spec to block placements. The key insight is to separate design intent from spatial arithmetic — LLMs cannot reliably count grid cells above 10x10, but they can describe architecture well.

The primary risks are unbounded memory growth (degrades LLM attention and inflates token cost), LLM spatial reasoning failures in blueprint generation (grid miscounting, material underestimation), and multi-agent chat loops that consume all LLM budget with no skill execution. All three have well-understood mitigations: memory caps with temporal decay, blueprint validation with retry-and-feedback loops capped at 10x10, and a chat deduplication window with consecutive-chat-action limits. These mitigations must be designed in from day one — they cannot be retrofitted after the features ship.

---

## Key Findings

### Recommended Stack

The v2.3 stack requires only one new npm dependency: `better-sqlite3` for the persistent event log. All other new capability is implemented using existing dependencies. Honcho, Letta/MemGPT, Redis, and screenshot-based vision were all evaluated and rejected: Honcho and Letta impose the wrong abstraction for game event streams, Redis adds external infrastructure overhead with no benefit at 2-10 agent scale, and screenshot vision costs $130/day/agent at a 2s tick rate.

**Core technologies:**
- `better-sqlite3` 12.8.0: persistent cross-session event log — synchronous API fits the tick loop, zero infrastructure, single `.db` file per agent. Requires `node-gyp` on Glass.
- `MiniSearch` (existing): BM25 index for episodic memory retrieval — already used in `knowledgeStore.js`; apply same pattern to `experiences.jsonl` in new `mind/memoryStore.js`.
- `mineflayer-schem` 1.5.2: schematic interop — optional, only needed if agents will read/write `.litematic` files. Not required for JSON blueprint execution.
- Mineflayer block APIs (`bot.blockAt`, `bot.findBlock`): spatial intelligence — richer and cheaper than any screenshot-based vision approach.
- Shared JSON file + `fs.renameSync` atomic swap: multi-agent coordination — sufficient for 2-10 agents on one machine; upgrade to SQLite backing at 10+ agents.

### Expected Features

**Must have (v2.3 launch — table stakes):**
- Persistent cross-session memory log (JSONL, append on significant events only) — without this, "persistent agents" is marketing copy
- Memory importance scoring (heuristic: death=10, discovery=8, build_complete=7, conversation=5, routine=2) — prevents event log from becoming equal-weight noise
- Session journal entry at session end (200-400 tokens, stored in `data/{name}/journal/`) — agents that process their day are more coherent the next session
- Spatial memory index: each logged event tagged with (x, z, dimension) — enables MrSteve-style "what do I know about here?" queries
- LLM-authored build specs via `!plan` command — LLM describes building intent, deterministic code translates to JSON blueprint, body executes
- Material pre-planning before any build execution — agents that start builds without materials waste 30+ minutes and fail visibly
- Multi-phase build tracking with cross-session resume — build state file survives session restart
- Build quality self-verification: post-build scan of placed vs planned blocks, automatic patch loop

**Should have (v2.3.x — add after core loop validates):**
- Episodic memory RAG: add `experiences.jsonl` as second collection in `knowledgeStore.js` — reuse existing BM25+vector pipeline for personal memory retrieval
- Exploration with memory logging — systematic radius exploration with biome/ore/structure annotation feeding the spatial index
- Animal farming skill (`!farm_animals`) — breed, pen, maintain population; provides passive food loop
- Social memory extension — per-entity relationship score, shared event history, last interaction timestamp
- Mob hunting patrol — proactive combat/XP loop distinct from reactive self-defense

**Defer to v2.4+:**
- Background memory consolidation agent — need to see actual memory volume in production first
- Autonomous long-horizon goal progression (macro/meso/micro goal hierarchy) — requires stable memory + builds
- Multi-agent task splitting with atomic section claiming — single-agent builds must be reliable first
- Personality-driven build aesthetics (SOUL-aware material preferences) — bolt-on to LLM build specs, but full implementation is iterative
- Settlement layout planning — separate milestone (v2.5+), requires all of the above

### Architecture Approach

v2.3 is additive to the existing Mind+Body architecture. The critical boundary rule is unchanged: only `mind/registry.js` imports from `body/`; `body/` never imports from `mind/`. Three new `mind/` modules are added and six existing modules are modified. The memory system follows a parallel RAG path pattern: knowledge retrieval and episodic memory retrieval run in parallel via `Promise.all()` inside `think()`, merging before prompt construction at zero additional sequential latency. Background work (memory index rebuild, optional consolidation pass) uses an idle-gated `setInterval` in `start.js` — it defers when a skill is running or an LLM call is in flight.

**Major components and their status:**
1. `mind/memoryStore.js` (NEW) — BM25 index over `experiences.jsonl`, `retrieveMemories(query, topK)` API
2. `mind/buildPlanner.js` (NEW) — `planBuild()`, `auditMaterials()`, `saveBuildPlan()` for 500+ block structures
3. `mind/taskRegistry.js` (NEW) — cross-agent task claim/release via atomic-rename shared JSON file
4. `mind/memory.js` (MODIFY) — add `addExperience()`, experiences array, `experiences.jsonl` write-back
5. `mind/index.js` (MODIFY) — add parallel memory RAG path, `deriveMemoryQuery()`, `isThinking()` export
6. `mind/prompt.js` (MODIFY) — add `formatMemoryContext()`, build plan context injection
7. `mind/spatial.js` (MODIFY) — entity awareness tier, post-build scan injection
8. `body/skills/build.js` (MODIFY) — Z-slice pagination for 500+ block builds, `completedSlice` persistence
9. `start.js` (MODIFY) — init new modules, idle-gated background consolidation interval

**Data store additions:**
- `data/<agent>/experiences.jsonl` — append-only episodic event log
- `data/<agent>/plans/<planId>.json` — per-agent persistent build plans
- `data/shared_task_registry.json` — cross-agent task coordination

### Critical Pitfalls

1. **Unbounded memory file growth** — Apply FIFO caps and temporal decay from day one. Never inject the full memory log; always inject top-K most recent + relevant entries. Hard character budget on the memory section of the system prompt. Warning signs: MEMORY.md past 5KB, LLM stops referencing lessons, contradictions visible in the same dump.

2. **LLM blueprint spatial reasoning failures** — Grid row miscounts and material underestimation are fundamental LLM limitations, not model quality issues. Fix: hard-cap generated blueprints at 10x10x8, validate after generation and retry up to 2 times with specific error feedback injected, pre-compute exact material requirements from the validated palette before placing any block.

3. **Multi-agent chat loops** — Both agents become fully reactive to each other's chat, spending all LLM budget on `!chat` calls with no skill execution. Fix: chat deduplication window (3s cooldown on same-partner messages), `consecutiveChatActions` counter with forced action injection after 3 consecutive chats.

4. **Shared state file corruption** — `writeFileSync` is not atomic on Linux for files >4KB under concurrent writes. Fix: per-agent data directories for private state (already in v2.0) and atomic rename pattern (`write to .tmp` then `renameSync`) for any genuinely shared file.

5. **Embedding model memory leak** — `@huggingface/transformers` + ONNX Runtime leaks native tensor memory under high-frequency inference (confirmed open issue #860). Fix: batch embeddings at startup only (already done), cache identical query strings for 10s, add `process.memoryUsage()` logging every 5 minutes, schedule nightly restarts.

---

## Implications for Roadmap

Based on the ARCHITECTURE.md build order and FEATURES.md dependency graph, six implementation phases are suggested. The order is driven by hard dependencies: memory infrastructure must exist before build planning can record outcomes, and single-agent stability is a prerequisite for multi-agent coordination.

### Phase 1: Memory Foundation
**Rationale:** Everything else depends on this. Memory retrieval must work before build planning or coordination can use it. Lowest risk — pure `mind/` additions with no `body/` changes.
**Delivers:** Cross-session episodic memory that accumulates and is retrievable. Agents stop being amnesiac between sessions.
**Addresses:** Persistent memory log, importance scoring, session journal entry, spatial memory index (coordinates attached to events).
**Implements:** `mind/memory.js` extension + new `mind/memoryStore.js`, `experiences.jsonl`, `start.js` init wiring.
**Avoids:** Unbounded memory growth (Pitfall 1) — caps and deduplication built in from the start, not retrofitted.
**Research flag:** Standard patterns. Stanford Generative Agents + MrSteve PEM are well-documented. No additional research needed.

### Phase 2: Memory Integration into Prompts
**Rationale:** Memory stored but not retrieved is worthless. This phase closes the loop so retrieved experiences appear in prompts and agents demonstrate "I remember" behavior.
**Delivers:** Parallel RAG path in `think()` — knowledge chunks + memory chunks injected together. Measurable behavioral change: agents reference past events in their reasoning.
**Addresses:** Episodic memory RAG (P2 feature that can be wired early given the infrastructure exists from Phase 1).
**Implements:** `mind/index.js` `Promise.all` retrieval path, `mind/prompt.js` `formatMemoryContext()`.
**Avoids:** Context window stuffing (Pitfall 7) — enforce system prompt token ceiling of 4,000 tokens maximum.
**Research flag:** Standard patterns. Direct reuse of existing BM25 pipeline. No additional research needed.

### Phase 3: Enhanced Spatial Intelligence
**Rationale:** No new dependencies from Phase 1/2. Extends existing `spatial.js`. Required for build verification in Phase 4.
**Delivers:** Entity awareness in prompts, `!scan` command exposed via registry, post-build scan results injected as `postBuildScan` context.
**Addresses:** Spatial memory index queries ("what do I know about here?"), build quality self-verification groundwork.
**Implements:** `mind/spatial.js` entity tier + post-build scan, `mind/registry.js` `!scan` command.
**Avoids:** Screenshot-based vision anti-pattern (Pitfall 2) — all spatial intelligence via Mineflayer block APIs.
**Research flag:** Standard patterns. Mineflayer APIs are well-documented and already in use.

### Phase 4: Build Planning for 500+ Block Structures
**Rationale:** Requires Phase 1 (memory records build outcomes) and Phase 3 (spatial scan for post-build verification). This is the headline feature of v2.3.
**Delivers:** `!plan` command that generates build spec, audits materials, saves to disk, and tracks multi-phase progress across sessions. Build quality verification after completion.
**Addresses:** LLM-authored build specs, material pre-planning, multi-phase build tracking, build quality self-verification.
**Implements:** New `mind/buildPlanner.js`, `body/skills/build.js` Z-slice pagination, `mind/registry.js` `!plan` command.
**Avoids:** Blueprint spatial reasoning failures (Pitfall 3) — validation retry loop with error feedback, 10x10x8 hard cap, pre-computed material requirements.
**Research flag:** Needs attention during implementation. T2BM research shows even GPT-4 achieves only 48% material constraint satisfaction. MiniMax M2.7 is unverified for this workload. Plan a validation gate: measure blueprint validity rate on 10 test structures before declaring Phase 4 done.

### Phase 5: Multi-Agent Coordination
**Rationale:** Requires single-agent stability across all prior phases. Coordination bugs compound and are much harder to debug than single-agent bugs. Ship last.
**Delivers:** Shared task registry with atomic claim/release. Agents announce task claims via in-game chat (human-observable). No duplicate mining, no overwritten build plans.
**Addresses:** Multi-agent task splitting (enabling coordinated builds), chat loop prevention.
**Implements:** New `mind/taskRegistry.js`, `data/shared_task_registry.json`, chat deduplication window in the social layer.
**Avoids:** Shared file corruption (Pitfall 5) and multi-agent chat loops (Pitfall 4).
**Research flag:** Light verification needed on the atomic rename pattern under the Glass filesystem. Confirm `/tmp` and the data directory are on the same mount (required for `renameSync` atomicity guarantee on Linux).

### Phase 6: Memory Consolidation (Optional — Phase-Gated)
**Rationale:** Only build this after observing actual memory volume in production. May not be needed if importance scoring and caps from Phase 1 keep the log manageable.
**Delivers:** Background LLM consolidation pass: 20 recent experiences → 3-5 strategy bullet points appended to `memory.strategies`. Prevents unbounded raw log accumulation across months of sessions.
**Addresses:** Background memory consolidation agent (P3 feature from FEATURES.md).
**Implements:** Consolidation pass in the idle-gated `setInterval` already scaffolded in Phase 1's `start.js`.
**Avoids:** Background memory agent starving the game loop (Pitfall 9) — idle-only trigger, 30-minute minimum interval, defers if LLM API is busy.
**Research flag:** Phase-gate this behind a production observation period of at least 2 weeks. If Phase 1 caps keep memory healthy, skip Phase 6 entirely.

### Phase Ordering Rationale

- Phases 1-2 are pure `mind/` additions — no `body/` changes, lowest blast radius if something breaks, highest return for demonstrating the milestone theme.
- Phase 3 has no new dependencies and prepares the spatial verification tooling that Phase 4 requires. Worth placing before build planning, not after.
- Phase 4 is the headline feature but carries the highest implementation risk (LLM spatial reasoning on MiniMax M2.7). Placing it here ensures memory infrastructure is solid and the verification loop (Phase 3) is ready to catch placement errors.
- Phase 5 requires all prior phases to be stable. Multi-agent bugs compound; never debug coordination and memory simultaneously.
- Phase 6 is explicitly optional and dependent on production observation. Real usage data should drive the decision.

### Research Flags

Phases needing deeper research or empirical validation during planning:
- **Phase 4 (Build Planning):** Validate MiniMax M2.7's blueprint generation quality empirically before committing to the 10x10x8 cap as sufficient. T2BM results are from GPT-4. If validity rate is below 50% at 10x10, reduce to 8x8 and re-test before shipping.
- **Phase 5 (Multi-Agent):** Confirm POSIX `renameSync` atomicity on the Glass filesystem (local disk, same mount) before shipping the task registry. Non-issue if confirmed; data corruption risk if not.

Phases with standard patterns (skip `research-phase`):
- **Phase 1 (Memory Foundation):** Stanford Generative Agents architecture is fully specified in research literature. MrSteve PEM is concrete. Straightforward implementation.
- **Phase 2 (Memory RAG):** Direct reuse of existing `knowledgeStore.js` pattern. No new unknowns.
- **Phase 3 (Spatial):** Mineflayer block APIs are well-documented and already in production use by this project.
- **Phase 6 (Consolidation):** Pattern is clear from ARCHITECTURE.md; the decision to build it is empirical, not a research question.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Only one new package (`better-sqlite3`). All alternatives evaluated and rejected with clear rationale verified via official docs and npm registry. |
| Features | HIGH | Grounded in peer-reviewed research (Stanford Generative Agents, MrSteve, T2BM, Voyager, Project Sid PIANO). Full dependency graph mapped explicitly in FEATURES.md. |
| Architecture | HIGH | Based on direct codebase reads of 3,389 lines across 24 modules. Integration points are concrete, not speculative. Tick budget analysis confirms no new bottlenecks introduced. |
| Pitfalls | HIGH | Sourced from Mindcraft/Voyager post-mortems, MAST NeurIPS 2025 taxonomy, mineflayer issue tracker, and transformers.js issue tracker. Warnings include specific measurable symptoms and recovery steps. |

**Overall confidence:** HIGH

### Gaps to Address

- **MiniMax M2.7 blueprint quality:** T2BM research uses GPT-4. Blueprint generation quality for MiniMax M2.7 is unverified. Plan an empirical validation pass (10 test structures) early in Phase 4. If quality is poor, reduce size caps and supplement with hand-authored large blueprints.
- **`mineflayer-schem` 1.21.1 compatibility:** Library declares 1.8-1.20+ compatibility. Verify on 1.21.1 if schematic interop is needed. Listed as optional — do not block Phase 4 on this verification.
- **Glass filesystem for atomic rename:** `renameSync` is POSIX-atomic on the same device. Confirm Glass data and tmp directories share a device before shipping Phase 5. Non-issue if confirmed; critical race condition risk if not.
- **transformers.js memory leak status:** Reported as open in early 2025 (issue #860). Check release notes before upgrading. Add heap monitoring in Phase 1 to detect if it manifests in the current installed version.

---

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `mind/memory.js`, `mind/index.js`, `mind/knowledgeStore.js`, `mind/spatial.js` — integration point analysis for all new modules
- `body/skills/build.js`, `body/skills/scan.js` — build execution and scan API details
- `start.js`, `launch-duo.sh`, `mind/config.js` — multi-agent deployment and init sequence patterns

### Primary (HIGH confidence — peer-reviewed research)
- [Generative Agents: Park et al., UIST 2023](https://dl.acm.org/doi/10.1145/3586183.3606763) — memory stream, importance scoring, reflection, recency decay
- [Project Sid (arXiv 2411.00114)](https://arxiv.org/html/2411.00114v1) — PIANO architecture, social modules, role specialization emergence
- [MrSteve (arXiv 2411.06736, ICLR 2025)](https://arxiv.org/html/2411.06736v3) — Place Event Memory, what/where/when tagging, Explore/Execute mode switching
- [Voyager (arXiv 2305.16291)](https://arxiv.org/abs/2305.16291) — skill library as vector DB, iterative feedback, self-verification
- [T2BM (arXiv 2406.08751)](https://arxiv.org/html/2406.08751v1) — LLM building generation, 80% structure / 48% material accuracy with GPT-4
- [Mindcraft MineCollab (arXiv 2504.17950)](https://arxiv.org/html/2504.17950v1) — 15% performance penalty for detailed communication, construction plan failure taxonomy
- [MAST taxonomy, NeurIPS 2025 (arXiv 2503.13657)](https://arxiv.org/abs/2503.13657) — multi-agent failure classification

### Secondary (MEDIUM confidence)
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) — synchronous API, performance characteristics confirmed
- [Honcho docs](https://docs.honcho.dev/) — evaluated and rejected; architecture and pricing confirmed via official docs
- [Letta/MemGPT docs](https://docs.letta.com/concepts/memgpt/) — evaluated and rejected; tiered memory concept noted
- [Context Rot (Morph/Redis)](https://www.morphllm.com/context-rot) — context degradation under long context, 18-model study
- [Lost in the Middle (arXiv 2307.03172)](https://arxiv.org/abs/2307.03172) — U-shaped attention, 30% degradation for middle-context content
- [Transformers.js issue #860](https://github.com/huggingface/transformers.js/issues/860) — ONNX tensor memory leak
- [Mineflayer issue #1123](https://github.com/PrismarineJS/mineflayer/issues/1123) — chunk unload memory leak

### Tertiary (LOW confidence — needs live validation)
- MiniMax M2.7 blueprint generation quality — inferred from T2BM (GPT-4 baseline); needs empirical test in Phase 4
- `mineflayer-schem` 1.21.1 compatibility — declared for 1.20+; needs live confirmation if used

---
*Research completed: 2026-03-23*
*Ready for roadmap: yes*
