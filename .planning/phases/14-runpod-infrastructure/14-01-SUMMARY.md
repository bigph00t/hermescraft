---
phase: 14-runpod-infrastructure
plan: 01
subsystem: infrastructure
tags: [runpod, deployment, llama-server, vllm, max-tokens, env-config]
dependency_graph:
  requires: []
  provides:
    - infra/setup-pod.sh
    - infra/start-models.sh
    - infra/start-stack.sh
    - docker-compose.runpod.yml
    - .env.runpod
    - mind/llm.js (MAX_TOKENS wired)
  affects:
    - mind/llm.js
    - launch-duo.sh
    - .env.example
    - tests/smoke.test.js
tech_stack:
  added: []
  patterns:
    - Sequential dual-model startup (llama-server then vLLM, 30s OOM buffer)
    - Full stack orchestrator (MC server -> models -> agents)
    - MAX_TOKENS env var wired into every LLM API call
key_files:
  created:
    - infra/setup-pod.sh
    - infra/start-models.sh
    - infra/start-stack.sh
    - docker-compose.runpod.yml
    - .env.runpod
  modified:
    - mind/llm.js
    - launch-duo.sh
    - .env.example
    - tests/smoke.test.js
decisions:
  - MAX_TOKENS default set to 128 (keeps A6000 latency <3s per research)
  - MODEL_NAME default changed from MiniMaxAI/MiniMax-M2.7 to hermes everywhere
  - llama-server for main brain (GGUF), vLLM for secondary (FP8) — separate processes on separate ports
  - Sequential startup with sleep 30 between models to prevent CUDA OOM
  - VLLM_API_KEY no longer required (llama-server needs no auth)
  - Source-level MAX_TOKENS wiring assertions added to smoke.test.js after _here is defined (Section 13)
metrics:
  duration: "196s (~3 min)"
  completed: "2026-03-23"
  tasks: 2
  files: 9
---

# Phase 14 Plan 01: RunPod Infrastructure — Code & Scripts Summary

Full RunPod deployment pipeline built locally: infra scripts for pod setup, model startup, and full stack orchestration; MAX_TOKENS=128 wired into llm.js API calls; all defaults updated from MiniMax to hermes.

## What Was Built

### Task 1: infra/ Deployment Scripts

**infra/setup-pod.sh** — One-shot idempotent pod dependency installer:
- Installs Docker (if missing) via get.docker.com
- Installs Docker Compose plugin
- Installs Node.js 20 via nvm v0.40.1
- Installs tmux
- Installs `huggingface_hub` and `vllm` via pip
- Installs `llama-server` from pre-built CUDA binary (falls back to source build)
- Downloads heretic Q6_K GGUF (~22 GB) from HuggingFace
- Downloads Qwen3.5-9B (~9 GB) from HuggingFace

**infra/start-models.sh** — Sequential dual-model startup (A6000 48GB):
- Launches `llama-server` on port 8000 with `--chat-template qwen3`, `--served-model-name hermes`, `-n 512`
- Waits for health check, then sleeps 30s (CUDA OOM prevention)
- Launches `vllm serve` on port 8001 with `--enforce-eager`, `--served-model-name secondary`, `--gpu-memory-utilization 0.38`
- Reports VRAM usage via `nvidia-smi`

**infra/start-stack.sh** — Full stack orchestrator:
- Loads `.env.runpod` then `.env` (override)
- Step 1: Starts MC server via `docker compose -f docker-compose.runpod.yml up -d`
- Step 2: Starts model servers via `nohup start-models.sh`; waits for both health checks
- Step 3: Launches agents via `./launch-duo.sh`
- Skips already-running components (idempotent checks)

**docker-compose.runpod.yml** — Paper MC server for RunPod:
- Same as docker-compose.yml but adds `ENABLE_RCON: "true"` and `RCON_PASSWORD: "hermescraft"`
- RCON enables `start-stack.sh` health check via `rcon-cli`

**.env.runpod** — Pre-configured env for on-pod localhost deployment:
- `VLLM_URL=http://localhost:8000/v1` (on-pod, no proxy latency)
- `MODEL_NAME=hermes`, `MAX_TOKENS=128`, `TEMPERATURE=0.6`, `TICK_MS=3000`

### Task 2: MAX_TOKENS Wiring & Defaults Update

**mind/llm.js**:
- Added `const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '128', 10)`
- Added `max_tokens: MAX_TOKENS` to `client.chat.completions.create()` call
- Changed `MODEL_NAME` default from `'MiniMaxAI/MiniMax-M2.7'` to `'hermes'`
- Updated module header comment to reflect Qwen3.5-27B target

**.env.example**:
- Replaced vLLM section with full RunPod-aware docs
- Documents on-pod vs remote URL patterns
- `MODEL_NAME=hermes`, `MAX_TOKENS=128`, `VLLM_API_KEY=not-needed`

**launch-duo.sh**:
- `VLLM_URL` default: `https://api.minimaxi.chat/v1` → `http://localhost:8000/v1`
- `VLLM_API_KEY` default: empty → `not-needed`
- `MODEL_NAME` default: `MiniMax-M2.7-highspeed` → `hermes`
- `TEMPERATURE` default: `0.7` → `0.6`
- `MAX_TOKENS` default: `384` → `128`
- Removed `exit 1` on empty `VLLM_API_KEY`; replaced with localhost warning

**tests/smoke.test.js**:
- Added Phase 14 source-level assertions (after Section 13 where `_here` is defined):
  - `llm.js reads MAX_TOKENS from env`
  - `llm.js passes max_tokens to API call`
  - `llm.js default MODEL_NAME is hermes`
- Total: 294 passed, 0 failed (up from 291)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Moved smoke test assertions to after `_here` is initialized**
- **Found during:** Task 2
- **Issue:** Plan placed the source-level assertions at end of Section 6, but `_here` (used to read the llm.js source) is initialized in Section 13. Running the test produced `ReferenceError: Cannot access '_here' before initialization`.
- **Fix:** Moved the 3 new assertions to immediately after the existing Section 13 `_here`-dependent assertions (after line 409), before Section 14.
- **Files modified:** tests/smoke.test.js
- **Commit:** e9bab5d

## Commits

| Hash | Message |
|------|---------|
| c3d6c6a | feat(14-01): create infra/ deployment scripts for full RunPod stack |
| e9bab5d | feat(14-01): wire MAX_TOKENS into llm.js and update all env defaults |

## Known Stubs

None — all files are complete and functional. The infra scripts are deployment-ready and will be executed in Plan 02 when the RunPod pod is provisioned.

## Self-Check: PASSED

Files created:
- /home/bigphoot/Desktop/hermescraft/infra/setup-pod.sh — EXISTS
- /home/bigphoot/Desktop/hermescraft/infra/start-models.sh — EXISTS
- /home/bigphoot/Desktop/hermescraft/infra/start-stack.sh — EXISTS
- /home/bigphoot/Desktop/hermescraft/docker-compose.runpod.yml — EXISTS
- /home/bigphoot/Desktop/hermescraft/.env.runpod — EXISTS

Commits exist:
- c3d6c6a — feat(14-01): create infra/ deployment scripts
- e9bab5d — feat(14-01): wire MAX_TOKENS

Smoke test: 294 passed, 0 failed.
