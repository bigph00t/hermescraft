---
phase: 23-model-switch-unified-inference
plan: 01
subsystem: infra
tags: [llama-server, llama-cpp, qwen3.5, moe, gguf, mmproj, runpod, huggingface]

requires: []
provides:
  - "Single Qwen3.5-35B-A3B MoE model download script (Unsloth GGUF + mmproj-F16)"
  - "Single-process llama-server launch with native vision via --mmproj flag on port 8000"
  - "Simplified stack startup — port 8001 polling removed, single health check"
affects:
  - "23-model-switch-unified-inference plan 02 (mind/ module updates for unified endpoint)"
  - "RunPod deployment (setup-pod.sh, start-stack.sh)"

tech-stack:
  added: []
  patterns:
    - "Single GGUF model served via llama-server with conditional --mmproj flag"
    - "Idempotent download: check both MAIN_MODEL and MMPROJ before downloading"
    - "Conditional MMPROJ_FLAG: warns and disables vision if mmproj missing rather than failing hard"

key-files:
  created: []
  modified:
    - "infra/setup-pod.sh"
    - "infra/start-models.sh"
    - "infra/start-stack.sh"

key-decisions:
  - "Replace heretic 27B + Qwen3.5-9B dual download with single Unsloth Qwen3.5-35B-A3B GGUF + mmproj-F16 download"
  - "Remove vllm pip install — llama-server only architecture needs only huggingface_hub"
  - "MMPROJ_FLAG is conditional: vision degrades gracefully if mmproj absent rather than blocking startup"
  - "--served-model-name Qwen3.5-35B-A3B (was: hermes) — must match MODEL_NAME default updated in plan 02"
  - "-n 128 max tokens (was: 512) — MoE speed allows 128 at <3s latency on A6000"

patterns-established:
  - "Single-model infra: one llama-server process handles main brain + background + vision on port 8000"
  - "Health check: start-stack.sh only polls localhost:8000 — port 8001 fully retired"

requirements-completed:
  - "Infrastructure — enabling phase"

duration: 2min
completed: 2026-03-24
---

# Phase 23 Plan 01: Model Switch Infra Summary

**Replace 3-process model serving (heretic 27B + Qwen3.5-9B + VLM) with single llama-server process serving Qwen3.5-35B-A3B Q4_K_XL GGUF + mmproj vision on port 8000**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-24T00:02:26Z
- **Completed:** 2026-03-24T00:03:52Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- `setup-pod.sh`: Single download block for Unsloth Qwen3.5-35B-A3B GGUF + mmproj-F16 replaces two separate heretic GGUF and Qwen3.5-9B downloads; vllm removed from pip install
- `start-models.sh`: Full rewrite — single llama-server with `--mmproj` flag (conditional on file existence), `--served-model-name Qwen3.5-35B-A3B`, `-n 128`; secondary vLLM process entirely removed
- `start-stack.sh`: Port 8001 health check loop removed; `SEC_OK` variable removed; condition simplified to single `MAIN_OK`; footer banner updated from `hermes` to `Qwen3.5-35B-A3B`

## Task Commits

1. **Task 1: Rewrite infra scripts for single Qwen3.5-35B-A3B MoE model** - `ed62aad` (feat)

**Plan metadata:** (docs commit — added after state updates)

## Files Created/Modified

- `infra/setup-pod.sh` — Replace dual model downloads with single Unsloth GGUF + mmproj download; remove vllm pip install
- `infra/start-models.sh` — Full rewrite: single llama-server with conditional mmproj flag, new model name and token limit
- `infra/start-stack.sh` — Remove port 8001 polling, simplify health check to port 8000 only, update banner

## Decisions Made

- Keeping `--mmproj` conditional (warn and disable vision if absent) rather than hard-failing on startup — allows the stack to come up even if mmproj download was incomplete
- `huggingface-cli download unsloth/Qwen3.5-35B-A3B-GGUF --include "*UD-Q4_K_XL*" "*mmproj-F16*"` pulls both files in one call per Unsloth docs
- `--served-model-name Qwen3.5-35B-A3B` chosen to match the new MODEL_NAME default; plan 02 updates llm.js/backgroundBrain.js/vision.js defaults to match

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — infra scripts run on RunPod pod, no local config changes required.

## Next Phase Readiness

- Infra scripts are ready for RunPod deployment
- Plan 02 must update `mind/llm.js`, `mind/backgroundBrain.js`, `mind/vision.js` to use unified VLLM_URL endpoint (all defaulting to `http://localhost:8000/v1`) and update MODEL_NAME defaults to `Qwen3.5-35B-A3B`
- Smoke tests in plan 02 need `|| 'hermes'` assertion updated to `|| 'Qwen3.5-35B-A3B'`

---
*Phase: 23-model-switch-unified-inference*
*Completed: 2026-03-24*
