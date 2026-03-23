# Phase 14: RunPod Infrastructure - Research

**Researched:** 2026-03-23
**Domain:** RunPod GPU pod deployment, vLLM dual-model serving, Qwen3.5 model configuration
**Confidence:** HIGH

---

## Summary

Phase 14 replaces the current Nous Research API (Hermes-4-405B remote API) with a self-hosted
Qwen3.5-27B model on a RunPod pod, plus a secondary Qwen3.5-9B model for background brain tasks.
The work is pure infrastructure: provisioning the pod, writing a startup script, configuring
both model servers, and updating the Glass `.env` to point agents at the new endpoint.

The research is exceptionally well-grounded. Pre-existing v2.3 research files (RUNPOD-DUAL-MODEL.md,
MODEL-OPTIMIZATION.md, DUAL-BRAIN-ARCHITECTURE.md) cover every dimension of this phase in depth.
The key decision already locked in STATE.md is **RTX A6000 48GB at ~$0.33/hr** (not A100 as the
phase brief mentions — the brief is stale, STATE.md is authoritative). The confirmed architecture
is llama-server (llama.cpp) for the fine-tuned heretic 27B GGUF + vLLM for the stock 9B FP8,
both on the same A6000. Existing RunPod pod with SSH connectivity is already in use (see memory:
`reference_runpod_ssh.md`); the user/host/key details are known.

**Primary recommendation:** Deploy the A6000 RunPod pod with llama-server serving the heretic Q6_K
GGUF on port 8000 and vLLM serving Qwen3.5-9B-FP8 on port 8001. Update Glass `.env` VLLM_URL,
MODEL_NAME, and MAX_TOKENS. Verify coherent agent responses after cutover.

---

## Architecture Decision Record

### GPU Choice: A6000 48GB (NOT A100)

STATE.md explicitly overrides the phase brief's mention of A100 SXM:

> "GPU: RunPod A6000 48GB ($0.33/hr) — NOT A100. Dual model fits with quantization."

The A100 SXM ($1.39/hr) would give ~60 tok/s vs A6000's ~22-30 tok/s, but the A6000 works at
MAX_TOKENS=128 and is 4.2x cheaper. The decision is locked.

### Model Serving: Mixed Backend

vLLM cannot serve two models in a single process (issue #13633, closed as "not planned"). The
heretic fine-tune only has GGUF weights — vLLM cannot serve GGUF. Therefore:

- **Port 8000:** `llama-server` (llama.cpp) serving heretic Q6_K GGUF (~22 GB)
- **Port 8001:** `vllm serve` serving Qwen3.5-9B-FP8 (~9 GB)
- **Total VRAM:** ~31 GB out of 48 GB — 17 GB KV cache headroom

This is the most reliable and well-tested configuration for this hardware.

### Model: Official vs Heretic Fine-Tune

| Scenario | 27B Model | Reasoning |
|----------|-----------|-----------|
| Quality first (recommended) | Qwen/Qwen3.5-27B-FP8 via vLLM | 787K downloads, official support, native vLLM FP8 |
| Claude reasoning style | heretic-v1 Q6_K via llama-server | Reasoning distillation from Claude Opus; GGUF only |

STATE.md records the heretic fine-tune as the v2.3 decision. Use heretic Q6_K GGUF.
If heretic quality proves insufficient during testing, fallback path is Qwen/Qwen3.5-27B-FP8
via vLLM (requires swapping from llama-server, but same port).

---

## Standard Stack

### Core Serving Infrastructure

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| llama-server (llama.cpp) | b5555+ | Serve heretic Q6_K GGUF on port 8000 | Only option for GGUF weights; OpenAI-compatible API |
| vLLM | 0.6.x+ | Serve Qwen3.5-9B-FP8 on port 8001 | Continuous batching for 2-agent concurrency; native FP8 |
| RunPod A6000 48GB | Community Cloud | GPU compute host | $0.33/hr, fits dual-model setup |
| Network Volume | 50-100 GB | Persist model weights across pod restarts | Avoids re-downloading 22+9 GB every restart |
| HuggingFace Hub | huggingface_hub | Model download | Standard model registry |

### Model Files Required

| Model | Format | Size | Download From |
|-------|--------|------|---------------|
| heretic-v1 Q6_K | GGUF | 22.1 GB | `llmfan46/Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled-heretic-v1-GGUF` |
| Qwen3.5-9B-FP8 | safetensors | ~9 GB | `Qwen/Qwen3.5-9B` (or FP8 variant) |

### HermesCraft Agent Side

| File | Change | What |
|------|--------|------|
| `.env` | VLLM_URL | `https://<pod-id>-8000.proxy.runpod.net/v1` |
| `.env` | MODEL_NAME | `hermes` (the `--served-model-name` alias from llama-server) |
| `.env` | MAX_TOKENS | `128` (down from current default — keeps latency <3s on A6000) |
| `launch-duo.sh` | No changes needed | Already reads env vars dynamically |

---

## Architecture Patterns

### Recommended Pod Architecture

```
RunPod A6000 48GB Pod
├── llama-server             # Port 8000 (main brain)
│   ├── Model: heretic Q6_K GGUF (22.1 GB VRAM)
│   ├── ctx-size: 32768
│   ├── --n-gpu-layers 999 (full GPU offload)
│   └── OpenAI-compatible /v1/chat/completions
│
├── vllm serve               # Port 8001 (background brain)
│   ├── Model: Qwen3.5-9B (FP8, ~9 GB VRAM)
│   ├── gpu-memory-utilization 0.38
│   ├── max-model-len 32768
│   └── --tool-call-parser qwen3_coder
│
└── Network Volume (/models) # Persists model weights
    ├── qwen35-27b-heretic-q6_k.gguf
    └── ~/.cache/huggingface/Qwen3.5-9B/
```

### Pattern 1: Sequential Startup Script

Start llama-server first, wait for health check, then start vLLM. This prevents both processes
from initializing CUDA allocations simultaneously, which can cause OOM on the 48GB GPU.

```bash
#!/bin/bash
# /workspace/start-models.sh
set -e

MODEL_DIR=/models

# Main brain: llama-server on port 8000
/usr/local/bin/llama-server \
  -m "$MODEL_DIR/qwen35-27b-heretic-q6_k.gguf" \
  --port 8000 \
  --host 0.0.0.0 \
  --n-gpu-layers 999 \
  --flash-attn \
  --ctx-size 32768 \
  --served-model-name hermes \
  -n 128 &
LLAMA_PID=$!

echo "Waiting for llama-server to initialize..."
until curl -sf http://localhost:8000/health > /dev/null 2>&1; do sleep 5; done
echo "llama-server ready on port 8000."

# Secondary brain: vLLM on port 8001
# Wait 30s extra after llama-server is healthy — let CUDA allocations settle
sleep 30

vllm serve Qwen/Qwen3.5-9B \
  --port 8001 \
  --host 0.0.0.0 \
  --gpu-memory-utilization 0.38 \
  --max-model-len 32768 \
  --reasoning-parser qwen3 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --served-model-name secondary &
VLLM_PID=$!

echo "Waiting for vLLM to initialize..."
until curl -sf http://localhost:8001/health > /dev/null 2>&1; do sleep 5; done
echo "vLLM ready on port 8001."
echo "Both models running. VRAM budget: ~31 GB used of 48 GB."

wait $LLAMA_PID $VLLM_PID
```

### Pattern 2: Glass .env Update

The Glass deployment reads `.env` from `/opt/hermescraft/agent/.env` (primary) with local
`.env` as override (see `launch-duo.sh`). Only VLLM_URL, MODEL_NAME, and MAX_TOKENS need
changing. Luna and Max both use the same main brain (port 8000) — secondary brain (port 8001)
is for future background processing phases.

```bash
# Glass /opt/hermescraft/agent/.env — after Phase 14 cutover
VLLM_URL=https://<pod-id>-8000.proxy.runpod.net/v1
VLLM_API_KEY=<runpod-proxy-auth-or-empty>
MODEL_NAME=hermes
MAX_TOKENS=128
TEMPERATURE=0.6
TICK_MS=3000
```

RunPod proxy URL format: `https://<pod-id>-<port>.proxy.runpod.net`
Direct port access also available via SSH tunnel or direct pod IP (only in Secure Cloud).

### Pattern 3: RunPod SSH via expect

The memory file `reference_runpod_ssh.md` documents that RunPod's SSH proxy requires `expect`
(not raw ssh). All deployment commands to the pod must use this pattern:

```bash
expect -c '
set timeout 300
spawn ssh -o StrictHostKeyChecking=no -i /home/bigphoot/.ssh/id_ed25519 rr8am4a2u1wx9q-644113a2@ssh.runpod.io
expect -re {\$ }
send "COMMAND && echo MARKER_DONE\r"
expect -re {MARKER_DONE.*\$ }
send "exit\r"
expect eof
' 2>&1 | grep -v "^spawn\|RUNPOD\|Enjoy\|^\-\-\|^Warning\|known_hosts"
```

Timeout for model downloads: 600s. For startup verification: 120s.

### Anti-Patterns to Avoid

- **Dual vLLM processes for both models:** The heretic fine-tune is GGUF only; vLLM cannot serve it.
- **Parallel startup of both servers:** Can cause OOM during simultaneous CUDA init on 48GB.
- **Serverless RunPod (worker-vllm):** Cold-start latency (~10-30s) breaks real-time tick loop.
- **A100 SXM if budget is a concern:** A6000 with MAX_TOKENS=128 achieves the <3s target.
- **MAX_TOKENS=384 on A6000:** At ~22-27 tok/s, 384 tokens = ~15s response. WAY over budget.
- **Starting secondary brain on port 8001 before agents confirm port 8000 works:** Debug main brain first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenAI-compatible inference endpoint | Custom HTTP server | llama-server (built-in) | Already implements /v1/chat/completions, tool calling, streaming |
| Model download management | Custom downloader | `huggingface_hub snapshot_download` | Handles resume, checksums, HF auth |
| GPU memory partitioning | Manual CUDA device splits | `--gpu-memory-utilization` flag | vLLM's fractional allocation is well-tested |
| Health check polling | Custom retry loop | `until curl -sf /health` | Standard pattern; llama-server and vLLM both expose /health |
| Tool call parsing for Qwen3.5 | Custom JSON extractor | `--tool-call-parser qwen3_coder` | vLLM has native support; llama-server supports via grammar |

**Key insight:** The agent's `mind/llm.js` already speaks OpenAI-compatible API. No agent code
changes are needed — only env vars change. The entire migration is infrastructure-only.

---

## Common Pitfalls

### Pitfall 1: OOM During Dual Startup
**What goes wrong:** Both llama-server and vLLM allocate CUDA resources simultaneously. On 48GB,
combined peak allocation during KV cache init can exceed available VRAM and OOM-kill one process.
**Why it happens:** vLLM's `gpu_memory_utilization` is a hint, not a hard cap. CUDA graph capture
at startup allocates extra memory beyond the model weights.
**How to avoid:** Sequential startup with `sleep 30` after llama-server health check before
starting vLLM. Use `--enforce-eager` on vLLM secondary instance to skip CUDA graph capture.
**Warning signs:** Second process exits immediately with CUDA OOM error in first 60 seconds.

### Pitfall 2: RunPod Pod vs Serverless Confusion
**What goes wrong:** Configuring a Serverless endpoint instead of a persistent Pod. First request
has 10-30s cold start, breaking the real-time tick loop.
**Why it happens:** RunPod's UI makes Serverless prominent. Persistent Pod requires selecting
"Deploy" not "Serverless."
**How to avoid:** Always create a **Pod** (persistent instance). Verify it shows "Running" status
continuously, not "Idle" (serverless indicator).
**Warning signs:** First LLM call from agent takes 30s+ but subsequent calls are fast.

### Pitfall 3: Port Exposure in RunPod UI
**What goes wrong:** Pod starts but agents can't connect because ports 8000 and 8001 are not
exposed via the RunPod proxy.
**Why it happens:** By default, only port 22 (SSH) and 8888 (Jupyter) are exposed. Custom ports
must be explicitly added in the pod configuration before creation (cannot be added post-creation).
**How to avoid:** Before clicking "Deploy," add custom HTTP ports 8000 and 8001 in the "HTTP
Ports" section of pod configuration.
**Warning signs:** `curl https://<pod-id>-8000.proxy.runpod.net/health` returns 502 or 404.

### Pitfall 4: Model Download on Every Pod Restart
**What goes wrong:** Pod is terminated and restarted. Model files are gone. 20+ minute download
blocks agent startup.
**Why it happens:** Pod container storage is ephemeral. Models stored in the container's
filesystem are lost on termination.
**How to avoid:** Attach a RunPod Network Volume (50-100 GB) mounted at `/models` or
`/root/.cache/huggingface`. Persist between pod restarts.
**Warning signs:** Startup script downloads models every time instead of loading from cache.

### Pitfall 5: llama-server Tool Call Format
**What goes wrong:** Agent's `mind/llm.js` uses OpenAI tool-call format, but llama-server may
return tool calls in a slightly different schema depending on the chat template used.
**Why it happens:** Qwen3.5 models use `qwen3` chat template. llama-server must be started with
`--chat-template qwen3` to use the correct format.
**How to avoid:** Start llama-server with `--chat-template qwen3`. Verify tool call response
format matches what `mind/llm.js` expects (OpenAI `tool_calls` array on assistant message).
**Warning signs:** Agent gets LLM responses but tool calls are not parsed; `_lastFailure` loops.

### Pitfall 6: Thinking Tokens Eating MAX_TOKENS Budget
**What goes wrong:** Qwen3.5 defaults to thinking mode (`<think>` blocks). With MAX_TOKENS=128,
the model exhausts all tokens on `<think>` reasoning and produces no tool call.
**Why it happens:** Thinking tokens count against the output token budget.
**How to avoid:** Either (a) increase MAX_TOKENS to 512 and account for longer latency, or
(b) disable thinking for action calls via `extra_body: { enable_thinking: false }` in llm.js,
enabling it only for planning calls.
**Warning signs:** Agent responses contain only `<think>...</think>` blocks with no tool call.

### Pitfall 7: A6000 Memory Bandwidth vs A100 Latency Gap
**What goes wrong:** Even with correct setup, 128-token responses take 5-6s instead of <3s
because A6000 has 768 GB/s bandwidth vs A100's 2,000 GB/s.
**Why it happens:** LLM inference at low batch size is memory-bandwidth bound. A6000 is 2.6x
slower than A100 for single-request generation.
**How to avoid:** Use streaming responses (OpenAI streaming API). The agent can act on the
first tokens while generation continues. Alternatively, reduce MAX_TOKENS to 64 for action calls.
**Warning signs:** `time curl http://pod:8000/v1/completions` shows 5-6s for 128 tokens.

---

## Code Examples

### Verify Both Endpoints Are Working

```bash
# Test main brain (heretic via llama-server)
curl -s http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "hermes",
    "messages": [{"role": "user", "content": "say hi in 5 words"}],
    "max_tokens": 20
  }' | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['choices'][0]['message']['content'])"

# Test secondary brain (Qwen3.5-9B via vLLM)
curl -s http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "secondary",
    "messages": [{"role": "user", "content": "say hi in 5 words"}],
    "max_tokens": 20
  }' | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['choices'][0]['message']['content'])"
```

### Disable Thinking Tokens for Action Calls (llm.js addition)

```javascript
// In mind/llm.js — add to the options passed to completions API
// Disable thinking for tight-budget action calls; enable for notepad/planning
const extra_body = options.planning
  ? { enable_thinking: true }
  : { enable_thinking: false }

// Add to the API call body alongside model, messages, max_tokens etc.
```

### Check VRAM Usage After Startup

```bash
nvidia-smi --query-gpu=memory.used,memory.free,memory.total --format=csv,noheader
# Expected: ~31000 MiB used, ~17000 MiB free, 49152 MiB total
```

### Glass .env Update (full file after cutover)

```bash
# /opt/hermescraft/agent/.env — Phase 14 target state
VLLM_URL=https://RUNPOD_POD_ID-8000.proxy.runpod.net/v1
VLLM_API_KEY=RUNPOD_API_KEY_IF_NEEDED
MODEL_NAME=hermes
MAX_TOKENS=128
TEMPERATURE=0.6
TICK_MS=3000
MOD_URL=http://localhost:3001
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nous Research Hermes-4-405B API | Self-hosted Qwen3.5-27B on RunPod | Phase 14 | Removes API dependency, reduces per-token cost at scale |
| MiniMax M2.7 API | Self-hosted Qwen3.5-27B | v2.3 target | Reasoning distillation, better tool calling format |
| Single model | Dual model (27B main + 9B background) | v2.3 | Enables async background brain for memory/planning phases |
| Hermes 4.3 tool call format | Qwen3.5 qwen3_coder format | Phase 14 | Different parser needed in llm.js or model config |

**Important:** The current `.env` shows `MODEL_NAME=Hermes-4-405B` and Nous Research API.
STATE.md shows agents are Luna and Max (not Jeffrey/John from Glass startup memory).
The Glass startup memory describes an older deployment with different agent names —
treat it as reference for the startup pattern, not the current agent names.

---

## Open Questions

1. **Does RunPod still have the existing pod from previous work?**
   - What we know: `reference_runpod_ssh.md` shows a pod at `rr8am4a2u1wx9q-644113a2@ssh.runpod.io`
     with `/workspace/hermescraft` as project dir. This was for Hermes 4.3 (36B A40 pod).
   - What's unclear: Whether this pod is still running or was terminated. A40 pod is different
     hardware from the target A6000 48GB.
   - Recommendation: SSH in first to check pod status before provisioning a new one.

2. **llama-server tool call compatibility with mind/llm.js**
   - What we know: `mind/llm.js` uses the OpenAI client pointing at whatever VLLM_URL is set.
     It currently uses `--tool-call-parser hermes` format (from previous Hermes model). Qwen3.5
     uses `qwen3_coder` format which produces different JSON structure.
   - What's unclear: Whether the existing llm.js tool call parser handles Qwen3.5's output
     format or needs adjustment.
   - Recommendation: Test with a single tool call immediately after cutover; compare response
     JSON structure against what mind/llm.js currently expects.

3. **Thinking tokens: on or off by default for Qwen3.5 via llama-server**
   - What we know: Qwen3.5 has thinking mode enabled by default. llama-server respects the
     chat template. With MAX_TOKENS=128, thinking blocks can consume the entire budget.
   - What's unclear: Whether the heretic fine-tune's chat template enables thinking by default
     or whether llama-server's `-n 128` flag applies to thinking + output combined.
   - Recommendation: Test explicitly. If thinking tokens eat the budget, add
     `chat_template_kwargs: { enable_thinking: false }` to startup flags or pass it per-request.

4. **Network volume mount and model file naming on the actual pod**
   - What we know: Network volumes mount at a configurable path. Model files must be at a known
     path for the startup script.
   - What's unclear: Whether an existing network volume has Qwen3.5 weights already, or if
     full download (~31 GB) is needed.
   - Recommendation: SSH into pod first, check `/models` or `~/.cache/huggingface` for existing
     weights before writing the startup script.

---

## Sources

### Primary (HIGH confidence)

- `.planning/research/RUNPOD-DUAL-MODEL.md` — RunPod GPU options, vLLM dual-process setup,
  VRAM budgets, startup scripts. Researched 2026-03-23.
- `.planning/research/MODEL-OPTIMIZATION.md` — Quantization comparison, A6000 speed estimates,
  MAX_TOKENS tuning, llama.cpp vs vLLM decision matrix. Researched 2026-03-23.
- `.planning/research/DUAL-BRAIN-ARCHITECTURE.md` — Communication patterns, anti-patterns,
  background brain design. Researched 2026-03-23.
- `.planning/STATE.md` — Authoritative GPU choice (A6000, not A100), model decisions, blockers.
- `reference_runpod_ssh.md` (memory file) — SSH expect pattern, existing pod credentials.
- `reference_glass_startup.md` (memory file) — Glass deployment pattern, env loading.

### Secondary (MEDIUM confidence)

- `launch-duo.sh` — Current agent startup pattern, env var names (verified via file read).
- `.env` — Current production config (Nous Research API, VLLM_URL format).
- `mind/index.js`, `start.js` — No agent code changes needed for Phase 14 (infrastructure-only).
- [vLLM issue #13633](https://github.com/vllm-project/vllm/issues/13633) — Dual-model in one
  process not planned. Confirmed in RUNPOD-DUAL-MODEL.md.

### Tertiary (LOW confidence — verify before acting)

- Tool call format compatibility between Qwen3.5 `qwen3_coder` parser and existing `mind/llm.js`.
  The llm.js was built for Hermes tool call format. Qwen3.5 may produce identical or slightly
  different JSON. Verify on first real call.
- Exact latency numbers for heretic Q6_K on A6000: estimated 22-27 tok/s based on A6000 memory
  bandwidth vs 3090 community benchmarks. Actual may differ ±20%.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — architecture and hardware decisions locked in STATE.md; research files
  are comprehensive and sourced from official docs + community benchmarks.
- Architecture patterns: HIGH — startup script pattern documented in RUNPOD-DUAL-MODEL.md
  with specific flags; Glass env loading pattern confirmed in launch-duo.sh.
- Pitfalls: HIGH — OOM risk, port exposure, and serverless confusion are all documented in
  pre-existing research and RunPod official docs.

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (RunPod pricing and vLLM flags are stable; Qwen3.5 model availability stable)

**Note on phase brief vs STATE.md discrepancy:**
The phase brief mentions "A100 SXM 80GB" as the target. STATE.md explicitly overrides this:
"GPU: RunPod A6000 48GB ($0.33/hr) — NOT A100." STATE.md is the authoritative source.
The planner should use A6000 48GB as the target hardware.
