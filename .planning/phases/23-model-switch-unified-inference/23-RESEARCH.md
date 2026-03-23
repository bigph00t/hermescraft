# Phase 23: Model Switch + Unified Inference - Research

**Researched:** 2026-03-23
**Domain:** vLLM / llama-server inference infrastructure, Qwen3.5-35B-A3B MoE serving
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — pure infrastructure phase.
Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Claude's Discretion
Everything. Use ROADMAP success criteria as the spec.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | infra/start-models.sh launches single vLLM instance with Qwen3.5-35B-A3B Q4_K_XL on port 8000 | See Architecture Patterns — llama-server GGUF serving, not vLLM (BF16 too large for single A6000) |
| SC-2 | infra/setup-pod.sh downloads Qwen3.5-35B-A3B from Unsloth (not heretic GGUF + Qwen3.5-9B) | See Standard Stack — huggingface-cli download command verified |
| SC-3 | mind/llm.js MODEL_NAME default updated, MAX_TOKENS tuned for MoE throughput | llm.js default `|| 'hermes'` → new default; MoE is faster than dense so 128 is appropriate |
| SC-4 | mind/backgroundBrain.js uses same VLLM_URL as main brain (no separate port 8001) | bgClient hardcodes `http://localhost:8001/v1` — must change to use VLLM_URL env var |
| SC-5 | mind/vision.js uses same VLLM_URL for native vision (no separate port 8002) | vlmClient hardcodes `http://localhost:8002/v1` — must switch to VLLM_URL; vision requires `--mmproj` flag when using llama-server |
| SC-6 | .env.runpod simplified to single endpoint | Currently only sets one VLLM_URL (port 8000) and one MODEL_NAME — already simple; remove BACKGROUND_BRAIN_URL/VISION_URL if set |
| SC-7 | Smoke tests pass with updated defaults | Smoke test line 409 asserts `|| 'hermes'`; line 546 asserts `new OpenAI` presence; both need updating |
</phase_requirements>

---

## Summary

Phase 23 replaces the three-process model serving architecture (llama-server for heretic 27B on port 8000, vLLM for Qwen3.5-9B on port 8001, and a separate VLM on port 8002) with a single llama-server process serving Qwen3.5-35B-A3B-UD-Q4_K_XL GGUF on port 8000. This is an infrastructure-only change: five source files need updating (two infra scripts, two mind/ modules with hardcoded alternate ports, one env file) plus smoke test assertion updates.

The key architectural insight is that Qwen3.5-35B-A3B is a Mixture-of-Experts model — only ~3B parameters are active per token, which makes it faster than the 27B dense model it replaces despite having more total parameters. The GGUF Q4_K_XL variant is ~22GB on disk and fits comfortably on an A6000 48GB with ~26GB headroom for KV cache and vision encoder. Native vision is included via a separate `mmproj-F16.gguf` projection file that llama-server loads alongside the main GGUF. This eliminates the need for a separate VLM process on port 8002.

The single-model architecture collapses three separate OpenAI-compat clients (main brain on 8000, background brain on 8001, vision on 8002) into one shared endpoint. `backgroundBrain.js` and `vision.js` currently hardcode their ports — they must be updated to read `VLLM_URL` from the environment, falling back to `http://localhost:8000/v1` (the same default as llm.js). The `start-stack.sh` healthcheck loop that polls port 8001 must also be removed.

**Primary recommendation:** Use llama-server (llama.cpp) with `--mmproj` for the GGUF model — this is the path confirmed by Unsloth's own docs. vLLM serving the official BF16 Qwen3.5-35B-A3B requires tensor-parallel-size 4+ (too large for single A6000).

---

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| llama-server (llama.cpp) | latest CUDA build | Serves Q4_K_XL GGUF + mmproj vision on port 8000 | Only backend that natively loads GGUF + mmproj in one process; vLLM needs safetensors format |
| unsloth/Qwen3.5-35B-A3B-GGUF (UD-Q4_K_XL) | ~22.2 GB | Main model weight file | Unsloth's Dynamic 2.0 quant — best quality-per-VRAM for GGUF; 99.9% KL divergence vs BF16 |
| unsloth/Qwen3.5-35B-A3B-GGUF (mmproj-F16.gguf) | ~same repo | Vision projection encoder | Required for multimodal input; separate file downloaded alongside main GGUF |
| huggingface-cli | installed on pod | Download both files to /models | Standard tool for model downloads; `--include` filter selects specific files |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| openai (npm) | ^4.0.0 — already in package.json | OpenAI-compat client in backgroundBrain.js and vision.js | Already present; no new dep needed — just change the baseURL |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| llama-server GGUF | vLLM BF16 Qwen3.5-35B-A3B | vLLM BF16 is 69 GB — doesn't fit on A6000; would need A100 80GB ($4x more expensive). vLLM with GGUF is not supported. |
| llama-server GGUF | vLLM + AWQ quantized | AWQ quantized Qwen3.5-35B-A3B exists (cyankiwi/Qwen3.5-35B-A3B-AWQ-8bit) and can run single A6000. However Unsloth GGUF is the user-specified approach per memory note. |
| Q4_K_XL quant | UD-IQ3_XXS (13GB) | Smaller = more KV headroom but quality noticeably worse. Q4_K_XL is the user-specified quant. |

**Download command (from Unsloth official docs — HIGH confidence):**
```bash
huggingface-cli download unsloth/Qwen3.5-35B-A3B-GGUF \
    --include "*UD-Q4_K_XL*" "*mmproj-F16*" \
    --local-dir /models/
```

---

## Architecture Patterns

### Recommended llama-server Launch

```bash
# start-models.sh — after this phase
llama-server \
  -m "$MODEL_DIR/Qwen3.5-35B-A3B-UD-Q4_K_XL.gguf" \
  --mmproj "$MODEL_DIR/mmproj-F16.gguf" \
  --port 8000 \
  --host 0.0.0.0 \
  --n-gpu-layers 999 \
  --flash-attn \
  --ctx-size 32768 \
  --chat-template qwen3 \
  --served-model-name Qwen3.5-35B-A3B \
  -n 128 &
```

Source: Unsloth official inference guide (https://unsloth.ai/docs/models/qwen3.5)

**Key flags:**
- `--mmproj mmproj-F16.gguf` — enables native vision; omitting this flag disables multimodal support
- `--chat-template qwen3` — required for correct Qwen3.5 prompt formatting including `<think>` tag handling
- `--served-model-name Qwen3.5-35B-A3B` — the model name clients pass in API calls; update MODEL_NAME defaults to match
- `-n 128` — max tokens generated per request; MoE speed allows up to 200 at <3s
- `--ctx-size 32768` — 32K context is ample for agent use and keeps KV cache footprint small (~0.6 GB)

### Pattern 1: Unified VLLM_URL — All Clients on Same Endpoint

**What:** All three OpenAI clients (main LLM, background brain, vision) read from the same `VLLM_URL` env var, defaulting to `http://localhost:8000/v1`.

**When to use:** After this phase — single model serves all three use cases.

**Before (current backgroundBrain.js):**
```javascript
const BACKGROUND_BRAIN_URL = process.env.BACKGROUND_BRAIN_URL || 'http://localhost:8001/v1'
const bgClient = new OpenAI({ baseURL: BACKGROUND_BRAIN_URL, ... })
```

**After:**
```javascript
const BACKGROUND_BRAIN_URL = process.env.VLLM_URL || 'http://localhost:8000/v1'
const bgClient = new OpenAI({ baseURL: BACKGROUND_BRAIN_URL, ... })
```

**Before (current vision.js):**
```javascript
const VISION_URL = process.env.VISION_URL || 'http://localhost:8002/v1'
const vlmClient = new OpenAI({ baseURL: VISION_URL, ... })
```

**After:**
```javascript
const VISION_URL = process.env.VLLM_URL || 'http://localhost:8000/v1'
const vlmClient = new OpenAI({ baseURL: VISION_URL, ... })
```

**Note:** Keep env var names `BACKGROUND_BRAIN_URL` and `VISION_URL` as local constants (for clarity inside the file) but change their fallback source to `process.env.VLLM_URL`. The comment in the source that says `"port 8001"` or `"port 8002"` should also be updated.

### Pattern 2: Vision Model Name Update

`vision.js` currently defaults to `'Qwen/Qwen2.5-VL-7B-Instruct'` for `VISION_MODEL`. After this phase the llama-server is serving `Qwen3.5-35B-A3B` (or whatever `--served-model-name` is set to). The model name in vision.js API calls must match:

```javascript
// before
const VISION_MODEL = process.env.VISION_MODEL || 'Qwen/Qwen2.5-VL-7B-Instruct'

// after
const VISION_MODEL = process.env.VISION_MODEL || 'Qwen3.5-35B-A3B'
```

### Pattern 3: llm.js MODEL_NAME Default

`llm.js` line 7: `const MODEL_NAME = process.env.MODEL_NAME || 'hermes'`

The new `--served-model-name` is `Qwen3.5-35B-A3B`. Update the default:

```javascript
const MODEL_NAME = process.env.MODEL_NAME || 'Qwen3.5-35B-A3B'
```

Smoke test line 409 checks for `|| 'hermes'` — this assertion must be updated to match the new default.

### Pattern 4: Simplified start-stack.sh Health Check

`start-stack.sh` currently checks health on both port 8000 and 8001, then waits for both. After this phase only port 8000 exists:

```bash
# Remove these lines from start-stack.sh:
SEC_OK=$(curl -sf http://localhost:8001/health 2>/dev/null && echo "yes" || echo "no")
# ...
until curl -sf http://localhost:8001/health > /dev/null 2>&1; do sleep 5; done
echo "[stack] Secondary brain (port 8001) ready"
```

Also update the status banner at the bottom of `start-stack.sh`.

### Pattern 5: setup-pod.sh — Remove llama-server install, Remove 9B download

`setup-pod.sh` currently installs `llama-server` from source/binary AND downloads both:
1. `qwen35-27b-heretic-q6_k.gguf` (~22 GB)
2. `Qwen3.5-9B` directory (~9 GB)

After this phase:
1. Keep the llama-server installation block (still needed)
2. Replace both downloads with a single `huggingface-cli download unsloth/Qwen3.5-35B-A3B-GGUF` call
3. Use `--include "*UD-Q4_K_XL*" "*mmproj-F16*"` to pull only the two needed files

### Pattern 6: .env.runpod Cleanup

Current `.env.runpod`:
```bash
VLLM_URL=http://localhost:8000/v1
VLLM_API_KEY=not-needed
MODEL_NAME=hermes
MAX_TOKENS=128
TEMPERATURE=0.6
MC_HOST=localhost
MC_PORT=25565
TICK_MS=3000
AGENT_MODE=open_ended
```

After this phase — update MODEL_NAME, remove any BACKGROUND_BRAIN_URL/VISION_URL/BACKGROUND_MODEL_NAME that may have been added:
```bash
VLLM_URL=http://localhost:8000/v1
VLLM_API_KEY=not-needed
MODEL_NAME=Qwen3.5-35B-A3B
MAX_TOKENS=128
TEMPERATURE=0.6
MC_HOST=localhost
MC_PORT=25565
TICK_MS=3000
AGENT_MODE=open_ended
```

### Anti-Patterns to Avoid

- **Starting without `--mmproj`**: Without the mmproj file, vision calls to the API will fail with a model error or return empty responses. The mmproj file must be in `/models/` and path must be correct.
- **Wrong `--served-model-name`**: If the model name in llama-server does not match what `mind/llm.js` sends as `model:`, every API call returns `404 model not found`. The name is arbitrary but must be consistent across all files.
- **Using vLLM for GGUF**: vLLM does not load GGUF files. Only llama-server works with GGUF + mmproj.
- **Leaving port 8001 healthcheck in start-stack.sh**: It will wait forever and block agent startup since nothing is listening on 8001 anymore.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MoE inference routing | Custom batching layer | llama-server built-in OpenAI API | llama-server handles MoE routing natively in GGML CUDA kernels; manual routing would re-implement what's already there |
| Vision preprocessing | Node.js image encoding | Pass base64 to existing queryVLM() — llama-server handles it | Qwen3.5-35B-A3B with mmproj accepts image_url content natively via OpenAI multimodal API format |
| Model name aliasing | Custom routing proxy | Use `--served-model-name` flag in llama-server | One flag is all that's needed to expose the model under any name |

---

## Runtime State Inventory

> Rename/migration checklist — string "hermes" (model name) and port numbers 8001/8002 are being retired.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | No databases store the model name or port numbers as keys | None |
| Live service config | `.env.runpod` has `MODEL_NAME=hermes` | Code edit — update to `Qwen3.5-35B-A3B` |
| OS-registered state | None — no systemd units, no Task Scheduler entries for this project | None |
| Secrets/env vars | `BACKGROUND_BRAIN_URL` (defaults to port 8001) in backgroundBrain.js; `VISION_URL` (defaults to port 8002) in vision.js | Code edit — change defaults to use `process.env.VLLM_URL` |
| Build artifacts | None — no compiled binaries in the repo; llama-server is installed on RunPod pod, not in git | None (pod re-runs setup-pod.sh on fresh deploy) |

---

## Common Pitfalls

### Pitfall 1: mmproj File Not Downloaded
**What goes wrong:** llama-server starts without `--mmproj`, or the mmproj file path doesn't match. Vision queries return an error or fall through to `return null` silently. Agent loses vision capability with no warning.
**Why it happens:** The mmproj-F16.gguf is a separate file from the main GGUF. huggingface-cli download with the wrong `--include` pattern silently downloads only the GGUF.
**How to avoid:** The `--include` filter must be `"*UD-Q4_K_XL*" "*mmproj-F16*"` (both globs in one call). Add an existence check in start-models.sh for both files before launching.
**Warning signs:** `[vision] queryVLM returned null` in agent logs; `captureScreenshot` succeeds but `queryVLM` returns null.

### Pitfall 2: Smoke Test Assertion for `|| 'hermes'` Will Fail
**What goes wrong:** After updating `llm.js` default MODEL_NAME, smoke.test.js line 409 asserts `_llmSrc.includes("|| 'hermes'")` — this will FAIL.
**Why it happens:** The smoke test does source-level string matching, not behavioral testing.
**How to avoid:** Update the assertion to check for the new default: `_llmSrc.includes("|| 'Qwen3.5-35B-A3B'")` (or whatever the new served-model-name is).

### Pitfall 3: Smoke Test Assertion for `port 8001` Comment
**What goes wrong:** Smoke test line 546 checks `_bgSrc.includes('new OpenAI')` — this is fine. But any test that checks for the string `'8001'` in source will fail. Currently line 546 does NOT check for the port number string, only for `new OpenAI` presence. Verify no other assertions check `8001`.
**Why it happens:** Source-level assertions are brittle against string changes.
**How to avoid:** Grep smoke.test.js for `8001` before committing — the only occurrence is in the comment text of the assertion name (line 546), not the tested value. The actual `includes('new OpenAI')` check will still pass.

### Pitfall 4: backgroundBrain.js `BACKGROUND_MODEL` Default
**What goes wrong:** `backgroundBrain.js` sets `BACKGROUND_MODEL = process.env.BACKGROUND_MODEL_NAME || 'qwen3'`. After this phase, `bgClient` talks to llama-server on port 8000 serving `Qwen3.5-35B-A3B`. If the model name sent to the API is `'qwen3'`, llama-server will return `404 model not found`.
**Why it happens:** The env var default is a short alias that matched the old vLLM served-model-name. The new llama-server uses a different `--served-model-name`.
**How to avoid:** Update `BACKGROUND_MODEL_NAME` default from `'qwen3'` to `'Qwen3.5-35B-A3B'` (same as the new MODEL_NAME default). Or derive it: `process.env.BACKGROUND_MODEL_NAME || process.env.MODEL_NAME || 'Qwen3.5-35B-A3B'`.

### Pitfall 5: start-stack.sh Blocks on Port 8001 Health Poll
**What goes wrong:** After removing the secondary model, `start-stack.sh` still polls `http://localhost:8001/health` and blocks agent startup indefinitely.
**Why it happens:** The script has two health check loops — one per port.
**How to avoid:** Remove all port 8001 references from `start-stack.sh` as part of this phase. Also remove the `SEC_OK` variable and the `if [ "$MAIN_OK" = "yes" ] && [ "$SEC_OK" = "yes" ]` condition.

### Pitfall 6: Unsloth GGUF File Naming
**What goes wrong:** After download, the GGUF filename contains `UD-Q4_K_XL` not `q4_k_xl`. The old heretic model used `qwen35-27b-heretic-q6_k.gguf` (custom rename). The new model keeps its original filename from HuggingFace.
**Why it happens:** setup-pod.sh currently downloads and renames the heretic GGUF to a predictable path. The new download should use the actual filename from the repo.
**How to avoid:** Check the exact filename after download with `ls $MODEL_DIR/*UD-Q4_K_XL*.gguf`. Expected: `Qwen3.5-35B-A3B-UD-Q4_K_XL.gguf`. Set `MAIN_MODEL` variable in start-models.sh to match.

---

## Code Examples

### setup-pod.sh — New Model Download Section

```bash
# ── Download Qwen3.5-35B-A3B GGUF + mmproj to network volume ──
MODEL_DIR="${MODEL_DIR:-/models}"
mkdir -p "$MODEL_DIR"

MAIN_MODEL="$MODEL_DIR/Qwen3.5-35B-A3B-UD-Q4_K_XL.gguf"
MMPROJ="$MODEL_DIR/mmproj-F16.gguf"

if [ ! -f "$MAIN_MODEL" ] || [ ! -f "$MMPROJ" ]; then
    echo "[setup] Downloading Qwen3.5-35B-A3B Q4_K_XL + mmproj (~22 GB total)..."
    huggingface-cli download unsloth/Qwen3.5-35B-A3B-GGUF \
        --include "*UD-Q4_K_XL*" "*mmproj-F16*" \
        --local-dir "$MODEL_DIR/"
    # Verify download
    ls -lh "$MODEL_DIR/"*UD-Q4_K_XL*.gguf 2>/dev/null || echo "[setup] WARNING: Q4_K_XL file not found"
    ls -lh "$MODEL_DIR/mmproj-F16.gguf" 2>/dev/null || echo "[setup] WARNING: mmproj file not found"
else
    echo "[setup] Qwen3.5-35B-A3B already downloaded: $(ls -lh "$MAIN_MODEL" | awk '{print $5}')"
fi
```

Source: Unsloth docs https://unsloth.ai/docs/models/qwen3.5

### start-models.sh — New Single-Model Launch

```bash
#!/bin/bash
# start-models.sh — Single-model launch: Qwen3.5-35B-A3B Q4_K_XL via llama-server
set -e

MODEL_DIR="${MODEL_DIR:-/models}"
MAIN_MODEL="$MODEL_DIR/Qwen3.5-35B-A3B-UD-Q4_K_XL.gguf"
MMPROJ="$MODEL_DIR/mmproj-F16.gguf"

export HF_HOME="${MODEL_DIR}/.cache"

if [ ! -f "$MAIN_MODEL" ]; then
    echo "[start-models] ERROR: Model not found at $MAIN_MODEL"
    echo "[start-models] Run infra/setup-pod.sh first"
    exit 1
fi

if [ ! -f "$MMPROJ" ]; then
    echo "[start-models] WARNING: mmproj not found at $MMPROJ — vision will be disabled"
fi

echo "[start-models] Starting Qwen3.5-35B-A3B on port 8000..."
MMPROJ_FLAG=""
[ -f "$MMPROJ" ] && MMPROJ_FLAG="--mmproj $MMPROJ"

llama-server \
  -m "$MAIN_MODEL" \
  $MMPROJ_FLAG \
  --port 8000 \
  --host 0.0.0.0 \
  --n-gpu-layers 999 \
  --flash-attn \
  --ctx-size 32768 \
  --chat-template qwen3 \
  --served-model-name Qwen3.5-35B-A3B \
  -n 128 &
LLAMA_PID=$!

echo "[start-models] Waiting for llama-server health..."
until curl -sf http://localhost:8000/health > /dev/null 2>&1; do sleep 5; done
echo "[start-models] Qwen3.5-35B-A3B ready on port 8000 (PID $LLAMA_PID)"

nvidia-smi --query-gpu=memory.used,memory.free,memory.total --format=csv,noheader

wait $LLAMA_PID
```

### backgroundBrain.js — Updated URL and Model Name Defaults

```javascript
// Change these two lines:
const BACKGROUND_BRAIN_URL = process.env.VLLM_URL || 'http://localhost:8000/v1'
const BACKGROUND_MODEL = process.env.BACKGROUND_MODEL_NAME || process.env.MODEL_NAME || 'Qwen3.5-35B-A3B'

// Comment update (line 19):
// ── Secondary OpenAI Client (same endpoint as main brain — Qwen3.5-35B-A3B MoE) ──
```

### vision.js — Updated URL and Model Name Defaults

```javascript
// Change these two lines:
const VISION_URL = process.env.VLLM_URL || 'http://localhost:8000/v1'
const VISION_MODEL = process.env.VISION_MODEL || 'Qwen3.5-35B-A3B'

// Comment update (line 15):
// ── VLM Client (same endpoint as main brain — native vision via mmproj) ──
```

### llm.js — Updated MODEL_NAME Default

```javascript
// Line 7 — change:
const MODEL_NAME = process.env.MODEL_NAME || 'Qwen3.5-35B-A3B'
```

### Smoke Test Update (line 409)

```javascript
// Before:
assert('llm.js default MODEL_NAME is hermes', _llmSrc.includes("|| 'hermes'"))

// After:
assert('llm.js default MODEL_NAME is Qwen3.5-35B-A3B', _llmSrc.includes("|| 'Qwen3.5-35B-A3B'"))
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate dense 27B (main) + 9B (background) + VLM (vision) — 3 processes | Single MoE 35B-A3B (all three roles) — 1 process | Phase 23 | Infrastructure simplification; ~26 GB free VRAM on A6000 after loading model |
| llama-server (GGUF) + vLLM (safetensors) hybrid | llama-server only (GGUF + mmproj) | Phase 23 | No CUDA OOM risk from dual-process VRAM sharing |
| `MODEL_NAME=hermes` (llama-server served-model-name alias) | `MODEL_NAME=Qwen3.5-35B-A3B` | Phase 23 | All mind/ modules use one consistent model name |

**MoE inference speed note:** Qwen3.5-35B-A3B Q4_K_XL at 32K context uses ~21.67 GB VRAM total (21.06 GB model + 0.61 GB KV). On an RTX 5090 (confirmed benchmark): 203 tok/s decode. On A6000 (384 GB/s memory bandwidth vs 5090's ~1.8 TB/s), expect roughly 30-60 tok/s — faster than the old dense 27B at the same quant level due to sparse activation. At 128 tokens max, response latency should be ~2-4s on A6000. (LOW confidence on A6000 speed — no direct A6000 benchmark found; estimate extrapolated from MoE sparsity advantage and bandwidth ratio.)

---

## Open Questions

1. **Exact filename after huggingface-cli download**
   - What we know: The Unsloth HF repo lists `Qwen3.5-35B-A3B-UD-Q4_K_XL.gguf` as the file
   - What's unclear: Whether huggingface-cli preserves this exact filename or adds a directory prefix
   - Recommendation: In setup-pod.sh, do `ls $MODEL_DIR/*UD-Q4_K_XL*.gguf` after download to resolve the actual path, then set MAIN_MODEL dynamically (same pattern as current heretic download uses `mv` to rename)

2. **vLLM vs llama-server for GGUF + vision**
   - What we know: llama-server is the confirmed path for GGUF + mmproj. vLLM cannot load GGUF.
   - What's unclear: Whether an official FP8/AWQ variant of Qwen3.5-35B-A3B exists that would enable pure vLLM serving on a single A6000
   - Recommendation: Stick with llama-server per user's memory note and success criteria. The success criteria explicitly says "Q4_K_XL" which is a GGUF quant.

3. **smoke.test.js assertion for backgroundBrain.js port 8001 comment**
   - What we know: Line 546 asserts `_bgSrc.includes('new OpenAI')` (checks for client existence, not port number)
   - What's unclear: Whether the description string "for port 8001" in the assertion name matters for test output readability
   - Recommendation: Update the assertion description text to say "for VLLM_URL endpoint" but the tested value is just `new OpenAI` — still passes after the code change.

---

## Environment Availability

> All tools below are RunPod-only. Local machine has Node.js but no GPU/CUDA.

| Dependency | Required By | Available (local) | Available (RunPod) | Fallback |
|------------|------------|-------------------|--------------------|----------|
| llama-server (CUDA build) | start-models.sh | No | Yes — setup-pod.sh installs it | setup-pod.sh must run first |
| huggingface-cli | setup-pod.sh model download | Yes (~/.local/bin) | Yes — pip installed | — |
| NVIDIA A6000 (48 GB) | Model fits in VRAM | No | Yes | — |
| `scrot` | vision.js screenshot capture | Not checked — RunPod only | Yes (Ubuntu) | vision returns null if missing |
| vLLM | (not needed for this phase) | No | Yes — available on pod | Not needed: llama-server used instead |

**Missing dependencies with no fallback:** None — all needed tools are available on RunPod.

**Note on smoke tests:** All smoke tests are source-code level checks (no live inference). They run locally with `node tests/smoke.test.js` and do not require GPU or llama-server.

---

## Sources

### Primary (HIGH confidence)
- Unsloth official docs https://unsloth.ai/docs/models/qwen3.5 — llama-server command with `--mmproj`, download command, Q4_K_XL size
- unsloth/Qwen3.5-35B-A3B-GGUF HuggingFace page — full quant size table, vision capability confirmed, vLLM compatibility notes
- Project memory note `project_model_switch.md` — locked decision: single vLLM instance, Q4_K_XL from Unsloth, ~22GB VRAM

### Secondary (MEDIUM confidence)
- https://localllm.in/blog/llamacpp-vram-requirements-for-local-llms — VRAM at runtime: 21.06 GB model + 0.61 GB KV at 32K context; RTX 5090 benchmark 203 tok/s
- vLLM issue #35625 — confirmed tensor-parallel-size 1 works with vLLM BF16 on high-VRAM GPUs (Blackwell); not applicable to A6000 but confirms single-GPU is architecturally possible
- Existing project research files RUNPOD-DUAL-MODEL.md and MODEL-OPTIMIZATION.md — confirmed llama-server still valid path for GGUF on A6000

### Tertiary (LOW confidence)
- A6000 inference speed estimate ~30-60 tok/s — extrapolated from MoE sparsity + bandwidth ratio; no direct A6000 benchmark found for this model

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Unsloth docs and HF page confirm GGUF + mmproj download and llama-server command
- Architecture patterns: HIGH — direct code inspection of 5 files; changes are mechanical string/URL updates
- Pitfalls: HIGH — all pitfalls derived from direct source code reading (smoke test assertions, hardcoded ports, model name strings)
- Inference speed on A6000: LOW — no direct benchmark found; estimate only

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable infrastructure; Unsloth GGUF repo updated March 5 with improved quant algorithm)
