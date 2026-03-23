# RunPod Dual-Model Deployment Research
# For HermesCraft: Qwen3.5-27B (main) + Qwen3.5-9B (secondary)
# Target hardware: 48GB VRAM single GPU pod

_Researched: March 2026_

---

## 1. The Specific Model

**llmfan46/Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled-heretic-v1**

- Base: `Qwen/Qwen3.5-27B` (dense, not MoE)
- Fine-tuned via Unsloth 2026.3.3 from Jackrong/Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled
- Tensor type: BF16 (full precision weights on HF)
- Context window: 262,144 tokens (native), extensible to 1,010,000 via YaRN
- GGUF quantizations available at: `llmfan46/Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled-heretic-v1-GGUF`
  - Q4_K_M: ~16.5 GB VRAM, 29-35 tok/s on consumer hardware
  - No explicit FP8 variant published under this model ID — you would need to use the
    base Qwen FP8 weights and serve the fine-tuned delta, OR use GGUF via llama.cpp
- Thinking mode: enabled by default (`<think>` tags preserved)
- Native developer role in chat template (fixes Jinja issues with coding agents)
- Tool calling: not explicitly documented for this specific fine-tune, but the base
  Qwen3.5-27B architecture fully supports it via vLLM's `--tool-call-parser qwen3_coder`
- vLLM compatibility: the base model is fully vLLM-compatible; this fine-tune should work
  identically as it uses the same architecture

**Practical note**: Since only GGUF is published for this fine-tune, your options are:
1. Use llama.cpp / llama-server (not vLLM) with the GGUF weights directly
2. Convert to FP8 yourself using Unsloth or llmcompressor before serving with vLLM
3. Serve the BF16 weights with vLLM (requires ~54 GB — does NOT fit on a single A6000)

---

## 2. Qwen3.5 Model Family (Available Sizes)

| Model | Type | Release |
|---|---|---|
| Qwen3.5-397B-A17B | MoE | 2026-02-16 |
| Qwen3.5-122B-A10B | MoE | 2026-02-24 |
| Qwen3.5-35B-A3B | MoE | 2026-02-24 |
| Qwen3.5-27B | Dense | 2026-02-24 |
| Qwen3.5-9B | Dense | 2026-03-02 |
| Qwen3.5-4B | Dense | 2026-03-02 |
| Qwen3.5-2B | Dense | 2026-03-02 |
| Qwen3.5-0.8B | Dense | 2026-03-02 |

For the secondary brain, **Qwen3.5-9B** is the best fit — it's a dense model with the same
262K context and full tool calling/thinking support. A 14B does not exist in this family.

---

## 3. VRAM Requirements

### 3a. Qwen3.5-27B VRAM by Quantization

| Quantization | Model VRAM | Notes |
|---|---|---|
| BF16 (full precision) | ~54 GB | Does NOT fit on single A6000 |
| FP8 (Qwen/Qwen3.5-27B-FP8) | ~30-31 GB | Fits on A6000 with reduced context |
| GPTQ INT4 (Qwen3.5-27B-GPTQ-Int4) | ~30.3 GB | Counterintuitively same as FP8 due to sensitive layers kept in higher precision |
| Q8_0 (GGUF) | ~30 GB | Fits comfortably on A6000 (~20 tok/s) |
| Q4_K_M (GGUF) | ~16.5 GB | Fits easily, 29-35 tok/s |

**Single A6000 (48GB) with FP8**: The model weights occupy ~30 GB. Remaining 18 GB for
KV cache. At the default 262K context this is tight — you need to reduce `--max-model-len`
to 32K-64K to leave enough headroom for KV cache + CUDA overhead.

Confirmed single-A6000 Q8 performance: ~19-20 tok/s generation, ~500 tok/s prompt
processing. This is with llama.cpp, not vLLM.

FP8 via vLLM tested on RTX 5090 (32GB): ~30 GB at `--gpu-memory-utilization 0.75`, with
`--max-model-len 262144` fitting when using `--language-model-only` to skip vision encoder
(saves 2-4 GB of KV cache space).

### 3b. Qwen3.5-9B VRAM by Quantization

| Quantization | Model VRAM |
|---|---|
| BF16 | ~18 GB |
| FP8 | ~9-10 GB |
| Q8_0 | ~9-10 GB |
| Q4_K_M | ~5-6 GB |

A 9B at FP8 fits comfortably on any GPU with 16+ GB. On a 48GB pod it is trivial.

### 3c. Dual Model Budget on 48GB A6000

| Scenario | Model 1 VRAM | Model 2 VRAM | Total | KV Headroom |
|---|---|---|---|---|
| 27B FP8 + 9B FP8 | ~30 GB | ~10 GB | ~40 GB | ~8 GB — very tight |
| 27B Q4_K_M GGUF + 9B FP8 | ~17 GB | ~10 GB | ~27 GB | ~21 GB — comfortable |
| 27B FP8 (reduced ctx) + 9B Q4 | ~30 GB | ~6 GB | ~36 GB | ~12 GB — workable |

**Verdict**: Dual FP8 on 48GB is possible but leaves very little KV cache. You would need
to cap `--max-model-len` aggressively (8K-16K per model) and limit concurrent requests.
The Q4_K_M GGUF approach for the 27B gives far more comfortable headroom.

---

## 4. vLLM Multi-Model Serving: The Hard Truth

### 4a. Native vLLM Support: Does NOT Exist

vLLM does not natively support multiple models in a single process. Issue #13633 requested
this feature and was **closed as "not planned"** on June 22, 2025 (marked stale). A single
`vllm serve` command = one model.

What vLLM DOES support within one process:
- Multiple LoRA fine-tunes of the same base model (--enable-lora)
- That's it

### 4b. The Two-Instance Approach (What Actually Works)

Run two separate vLLM processes on the same GPU, each with a fractional
`--gpu-memory-utilization`. The CUDA memory is NOT hard-partitioned between processes —
both see the full GPU, and each will try to allocate up to its specified fraction.

**The key risk**: If both instances initialize KV caches simultaneously, total allocation
can exceed 48 GB and trigger OOM. vLLM's `gpu_memory_utilization` is a hint, not a hard
limit. The reported workaround is to set conservative fractions (0.4-0.45 each) and start
them sequentially, not in parallel.

**Practical setup for two vLLM instances on one A6000 48GB**:

```bash
# Instance 1: Main brain (27B FP8) — port 8000
# Model weights ~30 GB, leave KV cache budget with 0.65 util
CUDA_VISIBLE_DEVICES=0 vllm serve Qwen/Qwen3.5-27B-FP8 \
  --port 8000 \
  --host 0.0.0.0 \
  --gpu-memory-utilization 0.62 \
  --max-model-len 16384 \
  --language-model-only \
  --reasoning-parser qwen3 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --max-num-batched-tokens 4096 &

# Wait for instance 1 to finish KV cache init before starting instance 2
sleep 60

# Instance 2: Secondary brain (9B FP8) — port 8001
CUDA_VISIBLE_DEVICES=0 vllm serve Qwen/Qwen3.5-9B-FP8 \
  --port 8001 \
  --host 0.0.0.0 \
  --gpu-memory-utilization 0.20 \
  --max-model-len 16384 \
  --reasoning-parser qwen3 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder &
```

Why these fractions: 0.62 × 48 GB = ~30 GB (model weights + tiny KV cache), 0.20 × 48 GB
= ~10 GB (9B model weights + tiny KV cache). Total = ~40 GB, leaving ~8 GB buffer.

**The CUDA initialization issue**: Some users have reported that vLLM allocates a CUDA
memory resource at startup that cannot be shared across instances, causing the second
instance to fail. This may be version-dependent. Mitigation: use `--enforce-eager` on the
secondary instance to skip CUDA graph capture and reduce initialization memory.

### 4c. Alternative: llama-server (llama.cpp) for One Model

Since the fine-tuned model only has GGUF weights, a cleaner approach may be:
- Run `llama-server` for the 27B fine-tune (GGUF, Q4_K_M or Q8_0, port 8000)
- Run `vllm serve Qwen/Qwen3.5-9B-FP8` for the secondary (port 8001)

llama-server exposes an OpenAI-compatible API, so the HermesCraft agent would see no
difference. Q4_K_M of 27B at ~17 GB leaves ~31 GB entirely free for the 9B vLLM instance.

```bash
# Main brain via llama.cpp (GGUF fine-tune)
/usr/local/bin/llama-server \
  -m /models/qwen35-27b-heretic-q4_k_m.gguf \
  --port 8000 \
  --host 0.0.0.0 \
  --n-gpu-layers 999 \
  --ctx-size 32768 \
  --threads 4 &

# Secondary brain via vLLM (stock 9B FP8)
vllm serve Qwen/Qwen3.5-9B-FP8 \
  --port 8001 \
  --host 0.0.0.0 \
  --gpu-memory-utilization 0.62 \
  --max-model-len 32768 \
  --reasoning-parser qwen3 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder &
```

This is likely the most reliable dual-model setup on a single A6000 48GB.

### 4d. Recommended Production Architecture: Nginx Router

For a clean API from the agent's perspective, add Nginx as a reverse proxy routing by
`model` field in the request body or by URL prefix:

```
agent/llm.js (VLLM_URL=http://localhost:8080)
    → Nginx:8080
    → :8000 (27B, AGENT_NAME=hermes)
    → :8001 (9B, AGENT_NAME=pcrafty/aria/background tasks)
```

Or just point different agents at different ports directly — simpler for HermesCraft's
per-agent config.

---

## 5. RunPod GPU Options

### 5a. Pricing (as of March 2026)

| GPU | VRAM | Community $/hr | Secure $/hr | Notes |
|---|---|---|---|---|
| RTX A6000 | 48 GB | ~$0.33 | ~$0.43 | PCIe, 384 GB/s bandwidth |
| RTX 6000 Ada | 48 GB | ~$0.77 | ~$0.90 | Ada Lovelace, 864 GB/s bandwidth |
| A100 PCIe | 80 GB | ~$1.19 | ~$1.40 | |
| A100 SXM | 80 GB | ~$1.39 | ~$1.60 | Higher bandwidth than PCIe |
| H100 PCIe | 80 GB | ~$1.99 | ~$2.30 | |
| H100 SXM | 80 GB | ~$2.69 | ~$3.10 | Best bandwidth |

### 5b. Recommendation for This Use Case

**RTX A6000 (48GB) at $0.33/hr** — lowest cost that can run the dual-model setup.
**A100 SXM (80GB) at $1.39/hr** — best value upgrade if dual-model is too tight on 48GB.
  - On A100: 27B FP8 (~30 GB) + 9B FP8 (~10 GB) = 40 GB, leaving 40 GB for KV caches.
    This is dramatically more comfortable. Can use full 32K-64K context per model.

The **A6000 is 4.2x cheaper** than A100 SXM. For hobbyist/dev use it's the right call.
If production inference is needed with multiple agents hitting both models concurrently,
step up to A100 or H100.

### 5c. A6000 vs A100 for Inference Speed

Rough tok/s estimates for Qwen3.5-27B (single model, FP8 or Q8):
- A6000 (48GB, PCIe, 384 GB/s): ~20-25 tok/s single stream
- A100 SXM (80GB, 2 TB/s): ~50-70 tok/s single stream
- H100 SXM (80GB, 3.35 TB/s): ~80-100 tok/s single stream

For HermesCraft's 2-second tick budget, 20-25 tok/s on A6000 means a 384-token response
takes ~15-19s — that's too slow for the tick loop unless you cap MAX_TOKENS aggressively
(128-200 tokens) or use async/streaming. At 128 tokens: ~5-6s latency. Marginal.

On A100: 128-token response at 60 tok/s = ~2s. Much better fit for the 2s tick budget.

**Practical recommendation**: A6000 works if you set `MAX_TOKENS=128-256` and use
streaming. A100 is the comfortable choice for the current agent architecture.

---

## 6. RunPod Pod Setup: Step-by-Step

### 6a. Pod Type vs Serverless

Two options on RunPod:
1. **Serverless (worker-vllm)** — pay per second of compute, auto-scales to zero.
   Simpler to configure via UI but adds cold-start latency (~10-30s first request).
   NOT suitable for HermesCraft's real-time tick loop.

2. **Pod (persistent)** — always-on instance. Pay while running. This is what you want.
   Choose `vllm/vllm-openai:latest` or `runpod/pytorch` as the base image.

### 6b. Creating the Pod

1. Go to RunPod.io → Pods → Deploy
2. Select GPU: RTX A6000 (Community Cloud for cheapest, Secure Cloud for stability)
3. Template: Select "vLLM" template OR use custom Docker image `vllm/vllm-openai:latest`
4. Container configuration:
   - Disk: 50 GB+ (for model weights)
   - RAM: 32 GB minimum
   - Expose HTTP ports: 8000, 8001 (for dual-model), 22 (SSH)
5. Environment variables (set in RunPod UI):
   ```
   HF_TOKEN=<your-huggingface-token>
   HUGGING_FACE_HUB_TOKEN=<same>
   ```
6. Volume: Attach a Network Volume (50-100 GB) mounted at `/root/.cache/huggingface`
   to persist model downloads across pod restarts.

### 6c. Startup Script

Create a custom startup script (bake into Docker image or set as pod command):

```bash
#!/bin/bash
set -e

# Pre-download models to network volume (only on first run)
python -c "
from huggingface_hub import snapshot_download
snapshot_download('Qwen/Qwen3.5-27B-FP8')
snapshot_download('Qwen/Qwen3.5-9B')
"

# Start main brain (27B FP8) on port 8000
vllm serve Qwen/Qwen3.5-27B-FP8 \
  --port 8000 \
  --host 0.0.0.0 \
  --gpu-memory-utilization 0.62 \
  --max-model-len 16384 \
  --language-model-only \
  --reasoning-parser qwen3 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --max-num-batched-tokens 2048 \
  --served-model-name main &

MAIN_PID=$!

# Wait for main brain to fully initialize (KV cache allocation)
echo "Waiting for main model to initialize..."
until curl -sf http://localhost:8000/health > /dev/null; do sleep 5; done
echo "Main model ready."

# Start secondary brain (9B) on port 8001
vllm serve Qwen/Qwen3.5-9B \
  --port 8001 \
  --host 0.0.0.0 \
  --gpu-memory-utilization 0.20 \
  --max-model-len 16384 \
  --reasoning-parser qwen3 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --served-model-name secondary &

SECONDARY_PID=$!

echo "Secondary model starting..."
until curl -sf http://localhost:8001/health > /dev/null; do sleep 5; done
echo "Both models ready."

# Keep container alive
wait $MAIN_PID $SECONDARY_PID
```

### 6d. Connecting HermesCraft Agents

In `.env` or per-agent config:
```bash
# Main agents (hermes, steve, alex)
VLLM_URL=http://<pod-ip>:8000/v1
MODEL_NAME=main

# Background agents (pcrafty, aria)
VLLM_URL=http://<pod-ip>:8001/v1
MODEL_NAME=secondary
```

RunPod exposes pod ports via proxy URL format:
`https://<pod-id>-8000.proxy.runpod.net`

---

## 7. Quantization Deep-Dive: Which to Use

### FP8 (Recommended for vLLM)
- Official Qwen release: `Qwen/Qwen3.5-27B-FP8`
- Fine-grained FP8 with block size 128
- Quality: Nearly identical to BF16
- VRAM: ~30 GB for 27B
- Requires NVIDIA Ampere or newer (A6000, A100, H100 all supported)
- vLLM auto-detects and uses FP8 kernels

### AWQ (Alternative)
- 4-bit weight quantization, activation-aware
- VRAM: ~14-16 GB for 27B (significant saving vs FP8)
- Quality: Slightly lower than FP8 but still strong
- vLLM compatible with `--quantization awq`
- Tradeoff: smaller model = more KV cache room on A6000

### GPTQ INT4
- VRAM: ~30.3 GB (counterintuitively same as FP8 for Qwen3.5-27B — some layers kept in
  higher precision due to sensitivity)
- Not worth choosing over FP8 for this model; no VRAM advantage

### Q4_K_M GGUF (llama.cpp)
- VRAM: ~16.5 GB for 27B
- Generation: 29-35 tok/s on consumer GPU, 19-20 tok/s on A6000
- Use when: serving the fine-tuned heretic model (only GGUF is published), or when you
  need maximum KV cache headroom on 48GB

### Recommendation Matrix

| Scenario | 27B Choice | 9B Choice |
|---|---|---|
| A6000 48GB, quality first | FP8 (30 GB) | Q4_K_M GGUF or FP8 |
| A6000 48GB, context first | AWQ (14-16 GB) | FP8 (9-10 GB) — leaves ~22 GB KV |
| A6000 48GB, using heretic fine-tune | Q4_K_M GGUF (17 GB, llama-server) | FP8 via vLLM |
| A100 80GB | FP8 (30 GB) | FP8 (10 GB) — 40 GB KV cache |

---

## 8. Inference Speed Analysis for HermesCraft

### The 2-Second Tick Problem

HermesCraft's tick loop fires every 2 seconds. The LLM call must return before the next
tick is useful. Current setup (Hermes 4.3 36B FP8) reports ~0.5-1s for cached, ~2s for
first call.

Qwen3.5-27B on A6000:
- ~20-25 tok/s generation speed (single stream, vLLM FP8)
- At `MAX_TOKENS=384`: 384 / 22 = ~17 seconds per response — WAY too slow
- At `MAX_TOKENS=128`: 128 / 22 = ~5-6 seconds — still over 2s budget
- At `MAX_TOKENS=64`: 64 / 22 = ~3 seconds — borderline

Qwen3.5-27B on A100 SXM:
- ~60 tok/s generation speed
- At `MAX_TOKENS=128`: ~2 seconds — fits the tick budget
- At `MAX_TOKENS=256`: ~4 seconds — workable with async pre-fetch

**The generation speed on A6000 is the critical bottleneck.** The A6000 has 384 GB/s
memory bandwidth vs A100 SXM's 2,000 GB/s — a 5x difference. LLM inference at low batch
size is memory-bandwidth-bound.

### Recommendation

For real-time HermesCraft use:
- A100 SXM 80GB ($1.39/hr) is the minimum comfortable setup
- H100 SXM 80GB ($2.69/hr) is ideal
- A6000 works ONLY if `MAX_TOKENS` is capped at 64-96 and you accept 3-4s responses

Alternatively: use speculative decoding with a draft model (Qwen3.5-9B as drafter for
Qwen3.5-27B as verifier) — this can 2-3x output throughput on A6000:
```bash
vllm serve Qwen/Qwen3.5-27B-FP8 \
  --speculative-model Qwen/Qwen3.5-9B \
  --num-speculative-tokens 5 \
  ...
```
But this uses the 9B for speculation rather than as an independent secondary brain.

---

## 9. vLLM Key Flags Reference

```bash
# Core serving
--model <hf-repo-or-path>       # Model to serve
--port 8000                      # HTTP port
--host 0.0.0.0                   # Bind all interfaces (required for RunPod)
--served-model-name <alias>      # Name clients use in API calls

# Memory management
--gpu-memory-utilization 0.9     # Fraction of GPU VRAM to use (default 0.9)
--max-model-len 32768            # Max context length (reduces KV cache size)
--language-model-only            # Skip vision encoder, saves 2-4 GB KV headroom
--enforce-eager                  # Disable CUDA graph capture (less VRAM at startup)
--max-num-batched-tokens 4096    # Max tokens per batch step

# Qwen3.5 specific
--reasoning-parser qwen3         # Parse <think> tags
--enable-auto-tool-choice        # Enable tool calling
--tool-call-parser qwen3_coder   # Qwen3.5 tool call format

# Quantization
--quantization fp8               # Use FP8 (auto-detected for Qwen/Qwen3.5-27B-FP8)
--quantization awq               # Use AWQ

# Parallelism (multi-GPU only)
--tensor-parallel-size 2         # Split model across N GPUs
```

---

## 10. Summary & Recommended Plan

### Option A: A6000 48GB (Budget, ~$0.33/hr)

Architecture:
- llama-server (llama.cpp) serving the fine-tuned heretic model in Q4_K_M GGUF on port 8000
- vLLM serving Qwen3.5-9B-FP8 on port 8001
- Main agents → port 8000, background agents → port 8001

Pros: Cheapest. Both models fit comfortably (~27 GB total).
Cons: ~20-30 tok/s on main brain = slow responses. Must cap MAX_TOKENS to 64-128.
Works for: Dev, testing, non-real-time background tasks.

### Option B: A100 SXM 80GB (Recommended, ~$1.39/hr)

Architecture:
- vLLM serving Qwen3.5-27B-FP8 on port 8000 (gpu_memory_utilization 0.38, ~30 GB)
- vLLM serving Qwen3.5-9B-FP8 on port 8001 (gpu_memory_utilization 0.13, ~10 GB)
- Remaining ~40 GB split between KV caches

Pros: ~60 tok/s on 27B = 2s responses at 128 tokens. Both models fully functional.
Cons: 4.2x more expensive than A6000.
Works for: Production HermesCraft with real-time tick loop.

### Option C: A6000 48GB with Speculative Decoding (Budget + Speed)

Architecture:
- vLLM serving Qwen3.5-27B-FP8 with Qwen3.5-9B as speculative draft model (port 8000)
- Single serving instance, 9B not independently accessible

Pros: Potentially 2-3x speed boost on A6000 (40-60 tok/s effective). Still cheap.
Cons: 9B not independently usable for background tasks. Tighter VRAM budget.
Works for: Single-agent use or when secondary brain is less critical.

### Quick Decision

```
Need secondary brain independently?  YES → Option B (A100) or Option A (A6000 + llama-server)
                                      NO  → Option C (A6000 + speculative decoding)
Budget constrained?                   YES → Option A
Real-time tick loop (2s budget)?      YES → Option B or C
```

---

## Sources

- [Qwen/Qwen3.5-27B-FP8 — HuggingFace](https://huggingface.co/Qwen/Qwen3.5-27B-FP8)
- [Qwen/Qwen3.5-27B — HuggingFace (architecture details)](https://huggingface.co/Qwen/Qwen3.5-27B)
- [llmfan46/Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled-heretic-v1](https://huggingface.co/llmfan46/Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled-heretic-v1)
- [QwenLM/Qwen3.5 GitHub — model sizes and architecture](https://github.com/QwenLM/Qwen3.5)
- [vLLM issue #13633 — multi-model per GPU: closed as not planned](https://github.com/vllm-project/vllm/issues/13633)
- [vLLM 2 containers on single GPU discussion](https://discuss.vllm.ai/t/2-vllm-containers-on-a-single-gpu/608)
- [vLLM FP8 deployment guide for Qwen3.5-27B (pentagi)](https://github.com/vxcontrol/pentagi/blob/master/examples/guides/vllm-qwen35-27b-fp8.md)
- [vLLM Qwen3.5-27B GPTQ INT4 memory bug issue](https://github.com/vllm-project/vllm/issues/37080)
- [vLLM GPU memory utilization docs](https://docs.vllm.ai/projects/vllm-omni/en/latest/configuration/gpu_memory_utilization/)
- [RunPod RTX A6000 pricing](https://www.runpod.io/gpu-models/rtx-a6000)
- [RunPod pricing page](https://www.runpod.io/pricing)
- [RunPod worker-vllm GitHub](https://github.com/runpod-workers/worker-vllm)
- [vLLM Qwen3.5 usage guide (official recipes)](https://docs.vllm.ai/projects/recipes/en/latest/Qwen/Qwen3.5.html)
- [Qwen3.5 27B on RTX A6000 — ~20 tok/s benchmark](https://insiderllm.com/guides/qwen-3-5-local-ai-guide/)
- [Qwen3.5 9B GPU requirements](https://apxml.com/models/qwen35-9b)
- [Qwen3.5 quantization comparison — FP8 vs GPTQ](https://kaitchup.substack.com/p/qwen35-quantization-similar-accuracy)
