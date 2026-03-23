---
gsd_state_version: 1.0
milestone: v2.3
milestone_name: Persistent Memory & Ambitious Building
status: Phase complete — ready for verification
stopped_at: Completed 21-02-PLAN.md — coordination wiring + smoke tests. Phase 21 complete.
last_updated: "2026-03-23T23:07:47.876Z"
progress:
  total_phases: 9
  completed_phases: 7
  total_plans: 14
  completed_plans: 13
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Agents that learn, grow, remember, and build ambitiously — playing Minecraft like real humans
**Current focus:** Phase 21 — multi-agent-coordination

## Current Position

Phase: 21 (multi-agent-coordination) — EXECUTING
Plan: 2 of 2

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v2.3); 6 (v2.2) for reference
- Average duration: not tracked
- Total execution time: not tracked

*Updated after each plan completion*

## Accumulated Context

### Key Architecture Decisions

**Carried from v2.2:**

- Mind + Body split enforced; only registry.js imports from body/
- KnowledgeStore: hybrid BM25 (MiniSearch) + vector (Vectra) + RRF fusion (k=60)
- Local all-MiniLM-L6-v2 embeddings via @huggingface/transformers
- Always-present core (~1,500 tokens) + dynamic RAG slot (0-4,000 tokens)
- Spatial awareness module (mind/spatial.js) injected every tick
- 2,710 RAG chunks across 17 knowledge files

**v2.3 Decisions:**

- **Model**: Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled-heretic-v1 (GGUF) as main brain, replacing MiniMax M2.7
- **Secondary brain**: Qwen3.5-9B for background processing (memory consolidation, spatial analysis, planning)
- **GPU**: RunPod A6000 48GB ($0.33/hr) — NOT A100. Dual model fits with quantization.
- **Quantization**: Main brain Q6_K GGUF (22GB) + secondary Q8_0 (10GB) = 32GB, 16GB KV headroom
- **Alternative**: vLLM with official Qwen3.5-27B-FP8 (28GB) + 9B FP8 (5GB) = 33GB — faster with MTP speculative decoding
- **MAX_TOKENS**: 128 for action calls, 512 for explicit planning calls (keeps latency <3s)
- **Dual-brain pattern**: Talker-Reasoner (DeepMind 2024). Main brain every 3s, background every 30-60s. Shared JSON state.
- **Vision**: On-demand `!see` tool via prismarine-viewer headless + Qwen2.5-VL-7B. NOT per-tick.
- **Memory**: SQLite (better-sqlite3) event log. Stanford Generative Agents importance scoring. Ring buffers.
- **Build planning**: LLM generates intent (style, dims, materials). Deterministic code handles coordinates. Section decomposition for >100 blocks.
- **Multi-agent coordination**: Shared JSON + atomic renameSync. No Redis.
- **Honcho/Letta/MemGPT**: Rejected — over-engineered for file-backed architecture
- **Screenshot vision cost**: Qwen2.5-VL-7B processes 320×240 screenshot in ~100 tokens, 130ms on A100

### Research Files (read these for deep context)

| File | What it covers |
|------|---------------|
| `.planning/research/STACK.md` | Stack additions: better-sqlite3, model choices, Honcho evaluation |
| `.planning/research/FEATURES.md` | Feature landscape: Stanford Generative Agents, Voyager, Mindcraft patterns |
| `.planning/research/ARCHITECTURE.md` | Integration design: memory as second RAG, dual-brain data flow, build decomposition |
| `.planning/research/PITFALLS.md` | 10 pitfalls: memory bloat, LLM coordinate failure, chat loops, ONNX leak |
| `.planning/research/SUMMARY.md` | Synthesis of all 4 research files |
| `.planning/research/RUNPOD-DUAL-MODEL.md` | RunPod GPU options, vLLM dual-model serving, pricing |
| `.planning/research/VISION-SCREENSHOTS.md` | prismarine-viewer headless, VLM options, minimap alternative |
| `.planning/research/DUAL-BRAIN-ARCHITECTURE.md` | Talker-Reasoner pattern, shared state design, ring buffers |
| `.planning/research/MODEL-OPTIMIZATION.md` | Quant comparison, A6000 speed estimates, MAX_TOKENS tuning |
| Phase 15-dual-brain-architecture P01 | 109s | 2 tasks | 2 files |
| Phase 15-dual-brain-architecture P02 | 90s | 2 tasks | 4 files |
| Phase 16-vision-system P01 | 129s | 2 tasks | 5 files |
| Phase 16-vision-system P02 | 240 | 2 tasks | 5 files |
| Phase 17-memory-foundation P01 | 5 | 2 tasks | 5 files |
| Phase 18-memory-integration P01 | 153 | 2 tasks | 5 files |
| Phase 19-enhanced-spatial-building P01 | 123 | 2 tasks | 2 files |
| Phase 19-enhanced-spatial-building P02 | 222 | 2 tasks | 6 files |
| Phase 20-gameplay-loops P01 | 480 | 2 tasks | 6 files |
| Phase 20-gameplay-loops P02 | 12 | 3 tasks | 3 files |
| Phase 21 P01 | 4 | 2 tasks | 3 files |
| Phase 21-multi-agent-coordination P02 | 184 | 2 tasks | 4 files |

### Decisions (Phase 21)

- data/shared/ lives as a sibling of data/<agent>/ — computed via dirname(config.dataDir); no extra config needed
- Stale claim TTL is 10 minutes for task registry and build sections; partner activity stale TTL is 120s
- Optimistic concurrency: re-read after claimTask write to verify claim survived racing writes from two agents
- getPartnerActivityForPrompt returns null for both ENOENT and age > 120s — single null signal regardless of cause
- claimBuildSection only claims 'pending' sections (not 'active'/'done') to avoid interrupting in-progress builds
- Broadcast fires twice per dispatch: 'running' before and 'complete/failed' after — real-time partner visibility
- chatLimitWarning injects into user message (not system prompt) — per-turn override signal, not persistent identity
- claimBuildSection only triggers when activePlan.sections.length > 1 — single-section plans are atomic

### Decisions (Phase 20)

- getProperties().age lambda required for crop state check in bot.findBlocks() — block ID matching can't inspect block state age values
- hunt uses combatLoop (blocking sustained loop) not attackTarget (single non-blocking hit) — !hunt fully engages until mob dies
- EVT_MAP extended: harvest->craft, hunt->combat, explore->discovery, breed->observation, farm->craft
- explore returns structured discoveries array enabling N individual logEvent calls per discovery for spatial memory granularity
- smoke test command count updated 24->27 (Rule 1 fix) — 477 tests pass

### Decisions (Phase 17)

- agent column = config.name (_agentName), not bot.username — consistent per-agent filtering even when MC username differs
- logEvent wired only in mind/index.js (has bot reference for spatial coords); mind/memory.js recordDeath has no bot access
- Dispatch EVT_MAP: build/design->build, mine/gather->discovery, combat->combat, craft/smelt->craft, navigate->movement; fallback observation
- FIFO pruning runs at initMemoryDB startup only — zero per-tick overhead in the game loop

### Decisions (Phase 14)

- MAX_TOKENS=128 default in all configs (A6000 <3s latency target)
- MODEL_NAME default changed from MiniMax to hermes everywhere
- Sequential startup with sleep 30 between llama-server and vLLM to prevent CUDA OOM
- VLLM_API_KEY no longer required (llama-server needs no auth); default changed to not-needed

### Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 14-runpod-infrastructure | P01 | 196s | 2 | 9 |

### Pending Todos

- Fix tool auto-equipping bug (agents mine with fists instead of pickaxe)
- Fix nightly agent restart for ONNX memory leak mitigation

### Blockers/Concerns

- heretic fine-tune only has GGUF weights — need llama-server (not vLLM) unless we convert to FP8
- A6000 memory bandwidth (768 GB/s) limits speed: Q6_K ~25-30 tok/s. May need MAX_TOKENS=128 cap.
- vLLM can't serve 2 models in one process (issue #13633 closed as "not planned") — need 2 separate processes
- MiniMax M2.7 stays as fallback while RunPod is being set up
- Embedding model ONNX tensor memory leak (transformers.js issue #860) — scheduled restart mitigates

## Session Continuity

Last session: 2026-03-23T23:07:47.874Z
Stopped at: Completed 21-02-PLAN.md — coordination wiring + smoke tests. Phase 21 complete.
Resume: `/gsd:execute-phase 14` or `/gsd:autonomous`
