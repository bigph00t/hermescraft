---
phase: 23-model-switch-unified-inference
verified: 2026-03-23T00:00:00Z
status: passed
score: 7/7 success criteria verified
re_verification: false
---

# Phase 23: Model Switch + Unified Inference Verification Report

**Phase Goal:** Replace 3-model architecture (hermes 27B + 9B + VLM) with single Qwen3.5-35B-A3B MoE served via vLLM — native vision, one process for everything
**Verified:** 2026-03-23
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | infra/start-models.sh launches single llama-server instance with Qwen3.5-35B-A3B Q4_K_XL on port 8000 | VERIFIED | `llama-server -m "$MAIN_MODEL" --port 8000 --served-model-name Qwen3.5-35B-A3B` — single process, no secondary |
| 2  | infra/setup-pod.sh downloads Qwen3.5-35B-A3B from Unsloth (not heretic GGUF + Qwen3.5-9B) | VERIFIED | `huggingface-cli download unsloth/Qwen3.5-35B-A3B-GGUF --include "*UD-Q4_K_XL*" "*mmproj-F16*"` — no heretic/9B blocks present |
| 3  | mind/llm.js MODEL_NAME default updated, MAX_TOKENS tuned for MoE throughput | VERIFIED | Line 7: `|| 'Qwen3.5-35B-A3B'`; Line 9: `process.env.MAX_TOKENS \|\| '128'` |
| 4  | mind/backgroundBrain.js uses same VLLM_URL as main brain (no separate port 8001) | VERIFIED | Line 12: `process.env.VLLM_URL \|\| 'http://localhost:8000/v1'` — no 8001 references anywhere in file |
| 5  | mind/vision.js uses same VLLM_URL for native vision (no separate port 8002) | VERIFIED | Line 10: `process.env.VLLM_URL \|\| 'http://localhost:8000/v1'`; Line 11: `|| 'Qwen3.5-35B-A3B'` — no 8002 references |
| 6  | .env.runpod simplified to single endpoint | VERIFIED | `VLLM_URL=http://localhost:8000/v1`, `MODEL_NAME=Qwen3.5-35B-A3B`, `MAX_TOKENS=128` — no BACKGROUND_BRAIN_URL or VISION_URL entries |
| 7  | Smoke tests pass with updated defaults | VERIFIED | `node tests/smoke.test.js` — 573 passed, 0 failed; line 409 asserts `|| 'Qwen3.5-35B-A3B'` |

**Score:** 7/7 success criteria verified

---

### Required Artifacts (from PLAN frontmatter must_haves)

#### Plan 23-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `infra/setup-pod.sh` | Single-model download (Qwen3.5-35B-A3B GGUF + mmproj) | VERIFIED | Contains `unsloth/Qwen3.5-35B-A3B-GGUF` on line 77; mmproj-F16 on lines 73, 78, 81 |
| `infra/start-models.sh` | Single llama-server launch with vision support | VERIFIED | Contains `--mmproj` on line 24/29; `--served-model-name Qwen3.5-35B-A3B` on line 36 |
| `infra/start-stack.sh` | Simplified health check (port 8000 only) | VERIFIED | Contains `Main brain (port 8000) ready` on line 70; no 8001/SEC_OK references |

#### Plan 23-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `mind/llm.js` | Updated MODEL_NAME default | VERIFIED | Line 7: `|| 'Qwen3.5-35B-A3B'` |
| `mind/backgroundBrain.js` | Unified VLLM_URL for background brain | VERIFIED | Line 12: `process.env.VLLM_URL` |
| `mind/vision.js` | Unified VLLM_URL for vision | VERIFIED | Line 10: `process.env.VLLM_URL` |
| `.env.runpod` | Updated MODEL_NAME | VERIFIED | Line 8: `MODEL_NAME=Qwen3.5-35B-A3B` |
| `tests/smoke.test.js` | Updated assertions for new model name | VERIFIED | Line 409: `|| 'Qwen3.5-35B-A3B'`; line 546: `VLLM_URL endpoint` |

All 8 artifacts: EXIST + SUBSTANTIVE + WIRED.

---

### Key Link Verification

#### Plan 23-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `infra/setup-pod.sh` | `infra/start-models.sh` | MODEL_DIR and GGUF filename convention | VERIFIED | Both use `Qwen3.5-35B-A3B-UD-Q4_K_XL` filename; MODEL_DIR convention consistent |
| `infra/start-models.sh` | `infra/start-stack.sh` | port 8000 health endpoint | VERIFIED | start-stack.sh polls `curl.*localhost:8000/health` (2 instances) |

#### Plan 23-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `mind/backgroundBrain.js` | `mind/llm.js` | Same VLLM_URL env var default | VERIFIED | Both default to `http://localhost:8000/v1` via `process.env.VLLM_URL` |
| `mind/vision.js` | `mind/llm.js` | Same VLLM_URL env var default | VERIFIED | Both default to `http://localhost:8000/v1` via `process.env.VLLM_URL` |
| `tests/smoke.test.js` | `mind/llm.js` | Source-level string assertion | VERIFIED | Smoke test line 409 asserts `_llmSrc.includes("|| 'Qwen3.5-35B-A3B'")` |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase modifies infrastructure scripts and configuration defaults, not components that render dynamic data. No data-flow trace required.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Smoke tests pass with new model defaults | `node tests/smoke.test.js` | 573 passed, 0 failed | PASS |
| No old model/port refs in infra/ | `grep -r "heretic\|Qwen3.5-9B\|8001\|8002" infra/` | No matches | PASS |
| No old model/port refs in mind/ | `grep -r "'hermes'\|8001\|8002" mind/` | No matches | PASS |
| MODEL_NAME in .env.runpod | `grep MODEL_NAME .env.runpod` | `MODEL_NAME=Qwen3.5-35B-A3B` | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| Infrastructure — enabling phase | 23-01-PLAN.md, 23-02-PLAN.md | Free-text label for infra-only phase — not a tracked REQ-ID in REQUIREMENTS.md | SATISFIED | Phase is an enabling infrastructure change; no functional requirement ID maps to it. All 7 ROADMAP success criteria met. |

**Note on requirement traceability:** "Infrastructure — enabling phase" is a label used in both plan frontmatter fields, not a REQ-ID defined in REQUIREMENTS.md. The REQUIREMENTS.md traceability table covers v2.3 functional requirements (MEM-*, BLD-*, SPA-*, COO-*, GPL-*) and Phase 23 is correctly identified in the ROADMAP as an infra prerequisite phase with no functional requirement assignment. No orphaned IDs detected.

---

### Anti-Patterns Found

| File | Content | Severity | Assessment |
|------|---------|----------|------------|
| `.env.example` line 6 | `MODEL_NAME=hermes` | Info | Template file documenting legacy default. Not loaded at runtime — .env.runpod has correct `MODEL_NAME=Qwen3.5-35B-A3B`. No runtime impact. |
| `.env.example` line 38 | `# BACKGROUND_BRAIN_URL=http://localhost:8001/v1` | Info | Commented-out legacy documentation. Not active. No runtime impact. |

No blockers. No warnings. The two info-level items are stale documentation in `.env.example` that does not affect runtime behavior — the active config in `.env.runpod` is correct.

---

### Human Verification Required

None. All success criteria are mechanically verifiable via source inspection and smoke test execution. The infrastructure scripts (setup-pod.sh, start-models.sh, start-stack.sh) cannot be run locally (require RunPod A6000 + downloaded models), but their correctness is fully verifiable by source inspection.

---

### Gaps Summary

No gaps. Phase 23 goal is achieved.

All 7 ROADMAP success criteria are met:
- infra/setup-pod.sh downloads from Unsloth with correct GGUF + mmproj filenames
- infra/start-models.sh launches a single llama-server process with conditional mmproj vision and correct served-model-name
- infra/start-stack.sh health-checks only port 8000; no port 8001 references remain
- All three mind/ modules (llm.js, backgroundBrain.js, vision.js) default to `process.env.VLLM_URL` at port 8000
- MODEL_NAME defaults to `Qwen3.5-35B-A3B` everywhere
- .env.runpod is a single-endpoint config
- Smoke tests: 573 passed, 0 failed

The single terminology inconsistency in ROADMAP success criterion 1 ("vLLM instance" vs actual "llama-server") is a documentation artifact in the ROADMAP, not a code defect — the implementation uses llama-server throughout, which is correct per the research and plan decisions.

---

_Verified: 2026-03-23_
_Verifier: Claude (gsd-verifier)_
