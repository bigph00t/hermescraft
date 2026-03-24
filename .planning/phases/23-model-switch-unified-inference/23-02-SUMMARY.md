---
phase: 23-model-switch-unified-inference
plan: "02"
subsystem: mind
tags: [model-switch, inference, unified-endpoint, config]
dependency_graph:
  requires: []
  provides: [unified-vllm-endpoint, qwen35-model-defaults]
  affects: [mind/llm.js, mind/backgroundBrain.js, mind/vision.js, .env.runpod, tests/smoke.test.js]
tech_stack:
  added: []
  patterns: [unified-endpoint-pattern, env-var-override-chain]
key_files:
  modified:
    - mind/llm.js
    - mind/backgroundBrain.js
    - mind/vision.js
    - .env.runpod
    - tests/smoke.test.js
decisions:
  - "All three mind/ modules now use process.env.VLLM_URL (port 8000) as their shared endpoint — no separate port 8001 or 8002"
  - "BACKGROUND_MODEL fallback chain: BACKGROUND_MODEL_NAME -> MODEL_NAME -> 'Qwen3.5-35B-A3B' allows per-agent overrides"
  - "MODEL_NAME default changed from 'hermes' to 'Qwen3.5-35B-A3B' everywhere — single MoE model handles all roles"
metrics:
  duration: 120s
  completed_date: "2026-03-24"
  tasks: 2
  files_changed: 5
---

# Phase 23 Plan 02: Unified Inference Endpoint Summary

Unified all mind/ modules to a single VLLM_URL (port 8000) endpoint with Qwen3.5-35B-A3B as the default model name, eliminating the separate port 8001 (background brain) and port 8002 (vision) endpoints since the single MoE model handles all three roles.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update mind/ module defaults to unified VLLM_URL and Qwen3.5-35B-A3B | 3abdbc5 | mind/llm.js, mind/backgroundBrain.js, mind/vision.js |
| 2 | Update .env.runpod and smoke test assertions | 876bd37 | .env.runpod, tests/smoke.test.js |

## What Changed

### mind/llm.js
- Header comment updated to reference Qwen3.5-35B-A3B MoE
- `MODEL_NAME` default: `'hermes'` → `'Qwen3.5-35B-A3B'`

### mind/backgroundBrain.js
- `BACKGROUND_BRAIN_URL`: uses `process.env.VLLM_URL` (port 8000) instead of `BACKGROUND_BRAIN_URL` (port 8001)
- `BACKGROUND_MODEL`: fallback chain `BACKGROUND_MODEL_NAME || MODEL_NAME || 'Qwen3.5-35B-A3B'`
- Comment updated from "port 8001 — Qwen3.5-9B" to "same endpoint as main brain — Qwen3.5-35B-A3B MoE"

### mind/vision.js
- `VISION_URL`: uses `process.env.VLLM_URL` (port 8000) instead of `VISION_URL` (port 8002)
- `VISION_MODEL` default: `'Qwen/Qwen2.5-VL-7B-Instruct'` → `'Qwen3.5-35B-A3B'`
- Comments updated to reflect unified endpoint with native vision via mmproj

### .env.runpod
- `MODEL_NAME`: `hermes` → `Qwen3.5-35B-A3B`

### tests/smoke.test.js
- Line 409: assertion description and value updated for new MODEL_NAME default
- Line 546: description updated from "port 8001" to "VLLM_URL endpoint"

## Verification

- `node tests/smoke.test.js`: 573 passed, 0 failed
- `grep -r "'hermes'" mind/`: CLEAN
- `grep -r "8001" mind/`: CLEAN
- `grep -r "8002" mind/`: CLEAN
- `.env.runpod` contains `MODEL_NAME=Qwen3.5-35B-A3B`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale port 8002 reference in vision.js comment**
- **Found during:** Task 1 verification (grep for "8002" failed)
- **Issue:** vision.js line 52 had `optional service on port 8002` in a JSDoc comment — would have caused verification grep to fail
- **Fix:** Updated comment to `optional service on unified VLLM_URL`
- **Files modified:** mind/vision.js
- **Commit:** 3abdbc5

## Known Stubs

None — all defaults are wired to real env vars with correct fallbacks.

## Self-Check: PASSED

Files exist:
- mind/llm.js: FOUND
- mind/backgroundBrain.js: FOUND
- mind/vision.js: FOUND
- .env.runpod: FOUND
- tests/smoke.test.js: FOUND

Commits exist:
- 3abdbc5: FOUND
- 876bd37: FOUND
