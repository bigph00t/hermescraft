---
gsd_state_version: 1.0
milestone: v2.3
milestone_name: Persistent Memory & Ambitious Building
status: Phase complete — ready for verification
stopped_at: Completed 15-02-PLAN.md — background brain wiring complete, 319 smoke tests passing
last_updated: "2026-03-23T20:24:49.002Z"
progress:
  total_phases: 9
  completed_phases: 1
  total_plans: 4
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Agents that learn, grow, remember, and build ambitiously — playing Minecraft like real humans
**Current focus:** Phase 15 — dual-brain-architecture

## Current Position

Phase: 15 (dual-brain-architecture) — EXECUTING
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

Last session: 2026-03-23T20:24:49.000Z
Stopped at: Completed 15-02-PLAN.md — background brain wiring complete, 319 smoke tests passing
Resume: `/gsd:execute-phase 14` or `/gsd:autonomous`
