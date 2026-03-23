# MODEL-OPTIMIZATION.md — Qwen3.5-27B A6000 Deployment Research

**Date**: 2026-03-23
**Hardware target**: Single NVIDIA RTX A6000 (48 GB VRAM)
**Goal**: Optimal serving configuration for HermesCraft agent — low latency, high quality, dual-model potential

---

## 1. The Heretic Fine-Tune: llmfan46/Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled-heretic-v1

### What it is
- **Base**: Qwen/Qwen3.5-27B (BF16)
- **Method**: SFT + LoRA via Unsloth 2026.3.3
- **Training data**:
  - `nohurry/Opus-4.6-Reasoning-3000x-filtered`
  - `TeichAI/claude-4.5-opus-high-reasoning-250x`
  - `Jackrong/Qwen3.5-reasoning-700x`
- **Key feature**: Claude 4.6 Opus reasoning distillation — structured `<think>` block reasoning before answers
- **Abliteration**: "Heretic v1" also decensors the model (21/100 refusals vs 98/100 base). KL divergence 0.0092 — minimal quality loss from abliteration.
- **Context**: 262K tokens native (no compromise)
- **Community speed** (RTX 3090, Q4_K_M): 29–35 tok/s

### Available GGUF Quants (heretic-v1-GGUF repo)

| Quant | Size | Notes |
|-------|------|-------|
| BF16  | 53.8 GB | Does NOT fit A6000 alone |
| Q8_0  | 28.6 GB | Near-lossless, fits with 19 GB headroom |
| Q6_K  | 22.1 GB | Excellent quality, fits with 25 GB headroom |
| Q5_K_M | 19.4 GB | High quality, ~29 GB headroom |
| Q5_K_S | 18.7 GB | Slightly smaller Q5 |
| Q4_K_M | 16.5 GB | Good quality, 29–35 tok/s on 3090 |
| Q4_K_S | 15.6 GB | Smallest offered |

The heretic-v1 GGUF repo provides 7 quant levels. No FP8, no AWQ, no GPTQ — GGUF only via llama.cpp.

---

## 2. Official Qwen3.5-27B Quant Landscape

Qwen team provides multiple official quants — these are the safest bets for vLLM:

### Official Qwen Releases (HuggingFace)

| Model | Format | Est. Size | vLLM Ready | Downloads/mo |
|-------|--------|-----------|------------|--------------|
| Qwen/Qwen3.5-27B | BF16 | ~54 GB | Yes | 2.21M |
| Qwen/Qwen3.5-27B-FP8 | FP8 | ~28 GB | Yes (native) | 787K |
| Qwen/Qwen3.5-27B-GPTQ-Int4 | GPTQ 4-bit | ~14 GB | Yes | 238K |

**FP8 note**: Fine-grained FP8 (block size 128). vLLM supports this natively with `--quantization fp8`. Benchmarks show near-identical accuracy to BF16. This is the recommended production format for vLLM on A6000.

**GPTQ-Int4 note**: ~14 GB. vLLM flag: `--quantization moe_wna16`. Leaves 34 GB free. Good for dual-model config.

### Third-Party Quants

| Model | Format | Size | Notes |
|-------|--------|------|-------|
| QuantTrio/Qwen3.5-27B-AWQ | AWQ 4-bit | 21 GB | vLLM native, `--quantization awq` |
| unsloth/Qwen3.5-27B-GGUF | GGUF (many) | 8–54 GB | llama.cpp only |
| bartowski/Qwen_Qwen3.5-27B-GGUF | GGUF (many) | 7.75–53.8 GB | llama.cpp only |

**QuantTrio AWQ** vLLM command (requires 2 GPUs per their card — use `--tensor-parallel-size 1` for single A6000):
```bash
vllm serve QuantTrio/Qwen3.5-27B-AWQ \
  --quantization awq \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.9 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --reasoning-parser qwen3
```

---

## 3. Other Notable 27B Distilled Fine-Tunes

| Model | Downloads | What makes it different |
|-------|-----------|------------------------|
| Jackrong/Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled | 151K | Claude Opus reasoning distill; the base the heretic v1 is built on |
| HauhauCS/Qwen3.5-27B-Uncensored | 169K | Abliterated, not reasoning-distilled |
| mlx-community/Qwen3.5-27B-Claude-4.6-Opus-Distilled-MLX-4bit | 22.8K | MLX only (Apple Silicon) |

**Assessment**: The heretic-v1 is the heretic version of the Jackrong distill — it combines Claude Opus reasoning with abliteration. For a Minecraft agent, the abliteration doesn't matter much; the reasoning quality does. The Jackrong base model (151K downloads) is solid and may perform identically on MC tasks.

---

## 4. VRAM Budget Analysis for A6000 (48 GB)

### Dual-model configurations (27B + 9B simultaneously)

| 27B Model | 27B Size | 9B Model | 9B Size | Total | KV Cache Headroom |
|-----------|----------|----------|---------|-------|-------------------|
| heretic Q8_0 | 28.6 GB | Q8_0 9B | ~10 GB | 38.6 GB | ~9 GB |
| heretic Q6_K | 22.1 GB | Q8_0 9B | ~10 GB | 32.1 GB | ~16 GB |
| heretic Q5_K_M | 19.4 GB | Q8_0 9B | ~10 GB | 29.4 GB | ~18 GB |
| Qwen3.5-27B-FP8 (official) | ~28 GB | FP8 9B | ~5 GB | ~33 GB | ~15 GB |
| Qwen3.5-27B-GPTQ-Int4 | ~14 GB | GPTQ 9B | ~5 GB | ~19 GB | ~29 GB |

**KV cache sizing**: At 32K context, each token costs ~0.5 MB/layer for Q8_0. For a 27B model with 64 layers, 32K context = ~1 GB. At 128K context = ~4 GB. At 262K = ~8 GB.

**Best dual-model pick**:
- `heretic Q6_K (22.1 GB) + Q8_0 9B (~10 GB) = 32.1 GB` — leaves 16 GB for KV cache. Supports ~64K context on the 27B.
- Or: `Qwen3.5-27B-FP8 (28 GB) + small 9B FP8 (5 GB) = 33 GB` — clean vLLM setup, no GGUF needed.

### Single-model configurations (maximize quality)

| Format | Size | Headroom | Recommended |
|--------|------|----------|-------------|
| heretic Q8_0 | 28.6 GB | 19.4 GB | Best quality GGUF, fits comfortably |
| heretic Q6_K | 22.1 GB | 25.9 GB | Excellent, more KV room |
| Qwen3.5-27B-FP8 | ~28 GB | ~20 GB | Best for vLLM single-model |
| Qwen3.5-27B-AWQ | 21 GB | 27 GB | Good for vLLM, 4-bit |

---

## 5. Inference Backend: llama.cpp vs vLLM on A6000

### llama.cpp (for GGUF)

**Pros:**
- Only option for GGUF quantized models
- Lower memory overhead — weights + KV cache, minimal framework overhead
- Flash attention supported on CUDA ✅
- Partial GPU offload via `--n-gpu-layers` for models that overflow VRAM
- Speculative decoding supported (draft model acceleration)
- Generally lower first-token latency for single-request scenarios

**Cons:**
- Throughput optimized for single-user, not batched requests
- No continuous batching — each request sequential
- No tensor parallelism for single large model
- Slower at high concurrency vs vLLM
- Tool calling requires server-mode with grammar/JSON schema enforcement

**A6000 speed estimates for 27B GGUF** (based on 3090 community data + A6000 being ~15% faster in memory bandwidth):

| Quant | Est. tok/s (A6000) | Quality |
|-------|-------------------|---------|
| Q8_0 | 18–22 tok/s | Near-lossless |
| Q6_K | 22–27 tok/s | Excellent |
| Q5_K_M | 26–32 tok/s | High |
| Q4_K_M | 32–40 tok/s | Good |

*(A6000 has 768 GB/s memory bandwidth vs 3090's 936 GB/s — actually slightly slower on bandwidth-bound inference. A6000 advantage is 48 GB capacity, not raw speed.)*

### vLLM (for safetensors/FP8/AWQ/GPTQ)

**Pros:**
- Continuous batching — much better throughput under load
- Native FP8, AWQ, GPTQ support
- Flash attention v2 built-in
- Multi-Token Prediction (MTP) speculative decoding built-in
- OpenAI-compatible server — drop-in for HermesCraft's `llm.js`
- Tool calling with `--enable-auto-tool-choice --tool-call-parser qwen3_coder`
- Reasoning parser: `--reasoning-parser qwen3` (strips `<think>` blocks from response)

**Cons:**
- Requires safetensors format (no GGUF)
- Higher baseline memory overhead (~2–3 GB framework overhead)
- Requires CUDA 12.1+
- First-call warmup can be slow

**vLLM speed estimates for Qwen3.5-27B on A6000:**
- FP8 single-model: ~35–45 tok/s (optimized CUDA kernels)
- AWQ 4-bit single-model: ~50–60 tok/s
- With MTP speculative decoding (`num_speculative_tokens: 2`): +20–40% throughput

### Verdict: Which is faster for HermesCraft?

| Scenario | Winner | Why |
|----------|--------|-----|
| Single agent, low concurrency | llama.cpp | Lower overhead, lower latency |
| Multiple agents (10 bots) | vLLM | Continuous batching handles concurrent requests |
| Tool calling reliability | vLLM | Native parser, structured output support |
| Max quality at 48 GB | vLLM FP8 | Better quantization method, bigger model in VRAM |
| Dual model on one GPU | llama.cpp | Can split VRAM across two server processes |

**For HermesCraft's 10-bot launch**: vLLM wins decisively. The tick loop fires LLM calls every 2 seconds across 10 agents — vLLM's continuous batching handles this gracefully. llama.cpp would queue requests serially.

---

## 6. Speculative Decoding

### vLLM MTP (Multi-Token Prediction)
Qwen3.5-27B has native MTP support built into the architecture:
```bash
--speculative-config '{"method":"qwen3_next_mtp","num_speculative_tokens":2}'
```
This is self-speculative (no separate draft model needed). Gains 20–40% throughput at minimal quality cost. Recommended.

### llama.cpp Draft-Model Speculative Decoding
llama.cpp supports a separate draft model via `--model-draft`. Could run a 9B model as draft:
- 27B main: Q6_K (22.1 GB) + 9B draft: Q8_0 (~10 GB) = 32.1 GB total
- Theoretical speedup: 1.5–2.5x if draft acceptance rate >60%
- Drawback: Draft model quality heavily affects acceptance rate. A Claude-distilled 9B draft + Qwen 27B main may have acceptance rate issues if reasoning styles differ.

**Best speculative decoding path**: Use vLLM + MTP self-speculation. Avoids draft model mismatch issues.

---

## 7. Optimal MAX_TOKENS for <3s Latency

At 35–45 tok/s (vLLM FP8), latency budget math:
- 3s = 105–135 tokens max
- HermesCraft currently uses `MAX_TOKENS=384` — **too high for <3s target**
- First-token latency adds ~0.5–1s (prefill time)
- Effective budget: ~2s generation = 70–90 tokens

**Recommendation**: `MAX_TOKENS=128` for tick actions. The agent's tool calls are almost always short (JSON with action + args). 128 tokens covers even verbose reasoning outputs. Bump to 512 for planning/notepad operations if needed.

With MTP enabled, effective generation rate increases to ~50–65 tok/s → `MAX_TOKENS=150` becomes viable at <3s.

---

## 8. Official Qwen3.5-27B-Instruct vs Heretic Fine-Tune

### Official Qwen3.5-27B-Instruct
- Hugging Face page returns 401 (gated/private at time of research)
- Likely identical to Qwen/Qwen3.5-27B base with chat template applied
- **Thinking mode ON by default** (same as all Qwen3.5 variants)
- Official FP8 and GPTQ-Int4 quants available
- Better tested, more stable, no abliteration surprises

### Heretic Fine-Tune
- Built on top of Jackrong's Claude Opus reasoning distill
- Reasoning style shaped by Claude — may produce more structured, careful reasoning
- Abliteration reduces refusals (minor benefit for MC agent tasks)
- Less tested than base model; 28.6K downloads vs 2.21M for base

### Recommendation for HermesCraft
Use **Qwen/Qwen3.5-27B-FP8** (official) for production if running vLLM. Reasons:
1. Official support, continuously updated
2. Native FP8 — best quality-per-VRAM tradeoff for vLLM
3. 787K downloads = well-tested
4. Identical architecture — tool calling, reasoning parser, MTP all work

Use **heretic Q6_K GGUF** only if forced to use llama.cpp or want the reasoning distillation benefits specifically.

---

## 9. Recommended Deployment Configurations

### Config A: Single-model vLLM (Best for 10-bot production)

```bash
vllm serve Qwen/Qwen3.5-27B-FP8 \
  --port 8000 \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.88 \
  --reasoning-parser qwen3 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --speculative-config '{"method":"qwen3_next_mtp","num_speculative_tokens":2}' \
  --language-model-only
```

- VRAM: ~28 GB model + ~8 GB KV cache = ~36 GB
- Throughput: 40–60 tok/s with MTP
- Supports 10 concurrent agents easily

### Config B: Dual-model vLLM (27B writer + small 9B planner)

```bash
# Port 8000 — Main 27B model
vllm serve Qwen/Qwen3.5-27B-GPTQ-Int4 \
  --port 8000 \
  --quantization moe_wna16 \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.45 \
  --reasoning-parser qwen3 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder

# Port 8001 — Fast 9B model (e.g., Qwen3.5-9B-FP8 or similar)
vllm serve Qwen/Qwen3-9B-Instruct-FP8 \
  --port 8001 \
  --max-model-len 16384 \
  --gpu-memory-utilization 0.45
```

- GPTQ-Int4 27B: ~14 GB; 9B FP8: ~5 GB; total: ~19 GB + overhead ~25 GB
- Leaves 23 GB headroom across both processes

### Config C: Single-model llama.cpp (Best quality-per-token, single agent testing)

```bash
./llama-server \
  -m Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled-heretic-Q6_K.gguf \
  --n-gpu-layers 999 \
  --flash-attn \
  --ctx-size 32768 \
  --port 8000 \
  --chat-template qwen3 \
  -n 128
```

- VRAM: 22.1 GB model + ~2 GB KV (32K ctx) = ~24 GB
- Speed: ~25–30 tok/s
- Best for: development testing, single-agent scenarios

---

## 10. Recommended HermesCraft .env Settings

```bash
MODEL_NAME=Qwen/Qwen3.5-27B-FP8          # or heretic model name
VLLM_URL=http://localhost:8000/v1
MAX_TOKENS=128                             # down from 384 — keeps ticks <3s
TEMPERATURE=0.6                            # good for action selection
TICK_MS=2000                               # keep as-is
```

For vLLM with reasoning parser, add to LLM call options in `agent/llm.js`:
```javascript
// Disable thinking tokens for action calls (saves tokens, reduces latency)
// Pass extra_body: { enable_thinking: false } for game action calls
// Pass extra_body: { enable_thinking: true } for planning/notepad calls
```

---

## Summary Decision Matrix

| Need | Best Choice |
|------|-------------|
| Max quality, single A6000, vLLM | Qwen3.5-27B-FP8 (official) |
| Claude-style reasoning, GGUF | heretic-v1 Q6_K (22.1 GB) |
| Dual model on one A6000 | GPTQ-Int4 27B + FP8 9B via vLLM |
| Fastest tokens/sec | AWQ 4-bit or GPTQ-Int4 + vLLM MTP |
| 10-bot concurrent serving | vLLM (any format) — not llama.cpp |
| Low-latency single bot testing | llama.cpp Q6_K or Q8_0 |
| Speculative decoding | vLLM MTP self-spec (no draft model needed) |
