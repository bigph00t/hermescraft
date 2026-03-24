# Phase 26: RunPod Deployment - Research

**Researched:** 2026-03-24
**Domain:** RunPod pod provisioning, llama-server inference, Paper MC server, Piper TTS, 8-agent launch
**Confidence:** HIGH (all scripts and artifacts already exist; research is about gap analysis and deployment procedure)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — all implementation choices are at Claude's discretion for this infrastructure phase.

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions. Key constraint: 8 agents (not 4), Qwen3.5-35B-A3B MoE via llama-server, Piper TTS on CPU, Simple Voice Chat plugin.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

---

## Summary

Phase 26 is the final deployment phase. All code was built in Phases 14-25. This phase is about running the scripts on a real RunPod A6000 pod and validating the full stack. The primary task is a collaborative human-AI execution: the user provisions the pod, Claude authors the step-by-step deployment checklist and any gap-fix scripts, and then human + Claude work through validation together.

The stack is well-defined. Five components must run in order: (1) Docker with Paper MC server, (2) llama-server serving Qwen3.5-35B-A3B MoE on port 8000, (3) Piper TTS bridge, (4) 8 agents via launch-agents.sh. The scripts for all four steps already exist in `infra/`. The major deployment risk is model download time (~22 GB), GPU memory headroom for the MoE model at concurrent load, and TTS voice model availability on the network volume.

**Primary recommendation:** Write a single `deploy.sh` that wraps `infra/setup-pod.sh` → `infra/start-stack.sh` with health checks between each stage, then author a human-executable validation checklist for the 7 success criteria.

---

## Standard Stack

### Core (already in codebase)

| Component | Version | Purpose | Status |
|-----------|---------|---------|--------|
| llama-server (llama.cpp) | latest CUDA release | Serves Qwen3.5-35B-A3B MoE via OpenAI API on :8000 | In `infra/start-models.sh` |
| Qwen3.5-35B-A3B-UD-Q4_K_XL.gguf | Q4_K_XL quant (~22 GB) | Main LLM brain for all 8 agents | Downloaded via `setup-pod.sh` |
| mmproj-F16.gguf | F16 | Vision projection model (optional, enables `!see`) | Downloaded via `setup-pod.sh` |
| Paper MC 1.21.1 (itzg/minecraft-server) | Docker latest | Game server | `docker-compose.runpod.yml` |
| Simple Voice Chat | Modrinth auto-download | Proximity voice plugin | `MODRINTH_PROJECTS` in compose |
| tts-plugin-1.0.0.jar | 1.0.0 | HTTP :8765 → EntityAudioChannel injection | Pre-compiled jar in `tts-plugin/build/libs/` |
| Piper TTS | piper-tts PyPI | CPU-side text-to-speech (8 voices) | Installed via `setup-pod.sh` |
| Node.js 20 | v20 (nvm) | Agent runtime | Installed via `setup-pod.sh` |
| tmux | system | Agent session management | Installed via `setup-pod.sh` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| llama-server (llama.cpp) | vLLM | vLLM requires safetensors, not GGUF. The unsloth GGUF is the available quant. llama-server is correct here. |
| Q4_K_XL GGUF | Q6_K or Q8_0 | Larger quants increase quality but reduce KV cache headroom on 48 GB. Q4_K_XL is the balance point per `setup-pod.sh`. |
| On-pod localhost | Remote RunPod proxy | Localhost eliminates proxy latency (~50-200ms per call). Critical for <3s tick target. |

---

## Architecture Patterns

### Deployment Flow

```
User: provision RunPod A6000 48GB pod
  → ssh to pod
  → git clone repo
  → bash infra/setup-pod.sh          # install deps + download models (~22 GB)
  → bash infra/start-stack.sh        # start MC server + llama-server + TTS bridge + 8 agents
  → validate success criteria
```

### Network Topology (on-pod)

```
llama-server :8000  ← all 8 agents (VLLM_URL=http://localhost:8000/v1)
Paper MC :25565     ← all 8 agents (Mineflayer direct, no Java client needed)
TTS plugin :8765    ← tts-bridge.py (HTTP POST with pcm_b64)
Voice Chat :24454   ← UDP voice to human Minecraft clients
```

### Agent Stagger Pattern

`launch-agents.sh` staggers agents 30 seconds apart (8 agents × 30s = ~3.5 minutes total launch window). This prevents simultaneous LLM warmup from stalling the first batch. Do NOT reduce this stagger — concurrent first requests to a cold llama-server can queue up and produce apparent timeouts.

### Component Start Order (strict)

1. MC server (wait for `rcon-cli list` → players response)
2. llama-server (wait for `GET :8000/health` → 200)
3. TTS bridge (wait 3s for voice model load — hardcoded in start-stack.sh)
4. Agents via launch-agents.sh (30s stagger built in)

This order is enforced by `infra/start-stack.sh`. Do not skip steps.

### Anti-Patterns to Avoid

- **Starting agents before llama-server is healthy**: The `until curl -sf http://localhost:8000/health` loop in `start-stack.sh` guards this. If bypassed, agents crash immediately on first LLM call.
- **Starting both llama-server and agents simultaneously**: VRAM spike during model load + KV cache init. Let llama-server reach healthy state first.
- **Running tts-bridge before Docker is up**: `docker logs -f hermescraft-server` will fail immediately, causing the bridge to retry loop. start-stack.sh order prevents this.
- **Reducing MAX_TOKENS above 256**: At ~30-40 tok/s on A6000, 256 tokens = ~7s. The TICK_MS=3000 means agents will stack up waiting. Keep MAX_TOKENS=128 as set in `.env.runpod`.
- **Forgetting to rebuild tts-plugin jar**: The jar is committed at `tts-plugin/build/libs/tts-plugin-1.0.0.jar`. If source changed since last commit, it needs rebuild with `cd tts-plugin && ./gradlew jar`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pod health checking | Custom polling loops | `curl -sf http://localhost:8000/health` (already in start-stack.sh) | Already implemented correctly |
| Agent session management | Custom process supervisor | tmux windows per agent (launch-agents.sh) | Already implemented with crash restart loop |
| Voice model download | HuggingFace API directly | `huggingface-cli download` or `hf_hub_download` (already in setup-pod.sh) | Already idempotent — skips existing files |
| Docker networking | Custom bridge | itzg/minecraft-server handles port exposure, Paper plugin binding | Docker compose handles all of it |

---

## Runtime State Inventory

This is a deployment phase (not a rename/refactor), but there is runtime state to be aware of:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Agent SQLite DBs (`agent/data/<name>/memory.db`) and notepad files are empty on fresh deploy — intentional | None — fresh deploy wipes data |
| Live service config | RunPod pod must be provisioned by human before any scripts run | Human action: provision pod, SSH in, clone repo |
| OS-registered state | tmux session `hermescraft-agents` — created by launch-agents.sh, survives reboots NOT | If pod reboots, re-run `start-stack.sh` |
| Secrets/env vars | HF_TOKEN for model download (set in RunPod pod environment at provisioning time) | Human sets this in RunPod UI or exports before setup-pod.sh |
| Build artifacts | `tts-plugin/build/libs/tts-plugin-1.0.0.jar` already compiled and committed | Verify jar exists before deploying — if stale, `cd tts-plugin && ./gradlew jar` |

**Network volume**: If the pod uses a RunPod network volume mounted at `/models`, model downloads persist across pod restarts. If no network volume, every pod restart re-downloads ~22 GB. Plan: use a network volume.

---

## Common Pitfalls

### Pitfall 1: HF_TOKEN Not Set Before setup-pod.sh

**What goes wrong:** `huggingface-cli download unsloth/Qwen3.5-35B-A3B-GGUF` fails with 401 or 403 if the model is gated and HF_TOKEN is not exported.

**Why it happens:** Some HuggingFace repos require authentication. The unsloth GGUF repos are typically public, but the HF rate limiter may restrict anonymous downloads.

**How to avoid:** Export `HF_TOKEN` before running `setup-pod.sh`. Set it in RunPod pod environment variables UI before pod launch, or `export HF_TOKEN=hf_xxx` in the SSH session.

**Warning signs:** `huggingface_hub.errors.RepositoryNotFoundError` or `401 Client Error` in setup-pod.sh output.

### Pitfall 2: llama-server Binary Architecture Mismatch

**What goes wrong:** `setup-pod.sh` tries to download a pre-built `llama-server-linux-cuda12-x86_64.tar.gz`. If RunPod's pod is on a different CUDA version or architecture, this fails silently and falls back to build-from-source (slow, 5-10 minutes).

**Why it happens:** The binary URL in setup-pod.sh points to `latest` GitHub release, which may not match the pod's CUDA version.

**How to avoid:** Let the fallback build run (it works, just takes longer). Alternatively, verify CUDA version on pod and use the matching release binary.

**Warning signs:** `curl -sfL` fails, then `apt-get install cmake build-essential` output appears — this is the fallback path. Wait it out.

### Pitfall 3: Simple Voice Chat vs TTS Plugin Port Conflict

**What goes wrong:** The TTS plugin's HTTP server starts on port 8765 inside the Docker container's JVM. If another process on the pod binds :8765 before the container starts, the plugin fails to register.

**Why it happens:** Port 8765 is not exposed to the host in docker-compose.runpod.yml — it's internal to the container. The `tts-bridge.py` POSTs to `http://localhost:8765/tts` from OUTSIDE the container. This only works because `tts-bridge.py` runs on the host and the container port needs to be host-accessible.

**Critical gap identified:** `docker-compose.runpod.yml` does NOT expose port 8765 to the host. The tts-bridge.py runs on the host and attempts `http://localhost:8765/tts` — but the TTS plugin HTTP server is inside the Docker container. This will fail unless port 8765 is exposed.

**How to fix:** Add `"8765:8765"` to the `ports` section of `docker-compose.runpod.yml`. This is a pre-deployment code fix required before the first deploy attempt.

**Warning signs:** tts-bridge.py logs show `Connection refused` for `http://localhost:8765/tts` despite MC server running.

### Pitfall 4: Minecraft Username Conflicts with Mineflayer

**What goes wrong:** 8 agents connect via Mineflayer (not Java client). The MC server is `ONLINE_MODE: "FALSE"` (offline mode in docker-compose.runpod.yml), so usernames are not authenticated. Mineflayer uses the `MC_USERNAME` env var as the username. If two agents have the same username, the second connection will fail or kick the first.

**Why it happens:** launch-agents.sh sets `MC_USERNAME=AGENT_NAME`. All 8 agents have unique names (luna, max, ivy, rust, ember, flint, sage, wren), so this should not be an issue IF launch-agents.sh is used correctly.

**How to avoid:** Always use launch-agents.sh. Do not manually launch agents with shared credentials.

**Warning signs:** Agent logs show `kicked: You logged in from another location`.

### Pitfall 5: TTS Bridge Starts Before Docker Logs Are Accessible

**What goes wrong:** tts-bridge.py tails `docker logs -f hermescraft-server`. If started before the container is running, the first attempt returns non-zero and the bridge enters the 5s retry loop. This is handled correctly in start-stack.sh (Step 3 starts after Step 1 confirms MC server up), but if run manually out of order, the bridge will loop.

**Why it happens:** Retry loop in tts-bridge.py is correct behavior, but adds 5-10s before voice chat works. If an agent speaks immediately at spawn, that first message may not get TTS coverage.

**How to avoid:** Always use `start-stack.sh` rather than manually starting components.

### Pitfall 6: llama-server ctx-size vs 8 Concurrent Agents

**What goes wrong:** `start-models.sh` launches llama-server with `--ctx-size 32768`. With 8 agents each consuming context (prompt + history), the KV cache can fill. Each agent's system prompt + user message is approximately 3000-5000 tokens. At peak, 8 concurrent agents × 5000 tokens = 40K tokens in flight — exceeds the 32K ctx-size.

**Why it happens:** llama-server with llama.cpp uses a single KV cache pool shared across all parallel slots. The `--ctx-size` sets the total KV cache. The 30s agent stagger means not all 8 are simultaneously mid-generation, mitigating this.

**How to avoid:** The 30s stagger prevents fully concurrent requests. If latency spikes are observed after all 8 agents are running, reduce MAX_HISTORY in agent config, or increase `--ctx-size` (at the cost of VRAM headroom).

**Warning signs:** llama-server logs show `slot unavailable` or agents report slow responses after full launch.

---

## Code Examples

### Health Check Pattern (from start-stack.sh)

```bash
# Source: infra/start-stack.sh
until curl -sf http://localhost:8000/health > /dev/null 2>&1; do sleep 5; done
echo "[stack] Main brain (port 8000) ready"
```

### Model Launch (from start-models.sh)

```bash
# Source: infra/start-models.sh
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
```

### TTS Plugin Port Exposure Fix (docker-compose.runpod.yml gap)

```yaml
# Add to ports section in docker-compose.runpod.yml
ports:
  - "25565:25565"
  - "24454:24454/udp"
  - "8765:8765"      # TTS plugin HTTP endpoint — required for host-side tts-bridge.py
```

### RunPod SSH via expect (from memory — MUST use, raw ssh fails)

```bash
expect -c '
set timeout 300
spawn ssh -o StrictHostKeyChecking=no -i /home/bigphoot/.ssh/id_ed25519 rr8am4a2u1wx9q-644113a2@ssh.runpod.io
expect -re {\$ }
send "cd /workspace/hermescraft && git pull && echo PULL_DONE\r"
expect -re {PULL_DONE.*\$ }
send "exit\r"
expect eof
' 2>&1 | grep -v "^spawn\|RUNPOD\|Enjoy\|^\-\-\|^Warning\|known_hosts"
```

---

## Pre-Deployment Code Gaps

These are real bugs that must be fixed before the first deploy attempt:

### Gap 1: Port 8765 Not Exposed in docker-compose.runpod.yml (CRITICAL)

**File:** `docker-compose.runpod.yml`
**Issue:** The TTS plugin HTTP server runs inside the Docker container on port 8765. The `tts-bridge.py` runs on the pod host and POSTs to `http://localhost:8765/tts`. Without `"8765:8765"` in the ports section, these two cannot communicate.
**Fix:** Add `- "8765:8765"` to the ports section of the minecraft service.
**Confidence:** HIGH — verified by reading both files. tts-bridge.py PLUGIN_URL defaults to `http://localhost:8765/tts`, TtsInjector listens on `new InetSocketAddress(8765)`, container has no port 8765 mapping.

### Gap 2: deploy-fresh.sh Wipes All Agent Data Including 8-Agent Dirs

**File:** `deploy-fresh.sh`
**Issue:** `deploy-fresh.sh` only creates `data/luna/sessions` and `data/max/sessions`. It does not create dirs for all 8 agents (ember, flint, ivy, rust, sage, wren). This script is for the duo setup and should NOT be used for the 8-agent RunPod deployment. Use `start-stack.sh` instead.
**Fix:** `start-stack.sh` is the correct script for RunPod. `deploy-fresh.sh` is irrelevant to this phase.

### Gap 3: No Validation Script for All 7 Success Criteria

**File:** Not yet created
**Issue:** The 7 success criteria (llama-server healthy, MC server up, 8 agents connected, TTS bridge working, <3s latency, 8 agents concurrent, 12h stable) have no automated checker. A `validate-stack.sh` would make the deployment process much cleaner.
**Fix:** Create `infra/validate-stack.sh` as part of Phase 26 plan.

---

## Environment Availability

This phase runs entirely on the RunPod pod, not the local machine. Environment check is for the pod target.

| Dependency | Required By | Available on Pod | Notes |
|------------|------------|-----------------|-------|
| NVIDIA GPU A6000 48GB | llama-server CUDA | Must provision | User action: select in RunPod UI |
| Docker | Paper MC server | Installed by setup-pod.sh | Installs from get.docker.com |
| Docker Compose | docker-compose.runpod.yml | Installed by setup-pod.sh | docker-compose-plugin |
| Node.js 20 | 8 agents | Installed by setup-pod.sh | Via nvm |
| llama-server CUDA build | LLM inference | Installed by setup-pod.sh | Pre-built binary or build from source |
| piper-tts (Python) | TTS bridge | Installed by setup-pod.sh | pip install piper-tts scipy |
| Piper voice models | TTS synthesis | Downloaded by setup-pod.sh | 8 models, ~600 MB, from rhasspy/piper-voices |
| Qwen3.5-35B-A3B GGUF | LLM inference | Downloaded by setup-pod.sh | ~22 GB from unsloth/Qwen3.5-35B-A3B-GGUF |
| tmux | Agent sessions | Installed by setup-pod.sh | apt-get install tmux |
| HF_TOKEN | Model download auth | Must export before setup-pod.sh | User sets in RunPod env vars |
| Network volume /models | Persistent model storage | User should attach | Prevents re-download on pod restart |

**Missing with no fallback:**
- A6000 48 GB GPU pod — user must provision this
- HF_TOKEN for model downloads (if gated)

**Missing with fallback:**
- Network volume: models re-download each pod start if not present (slow but works)
- Pre-built llama-server binary: falls back to build-from-source in setup-pod.sh

---

## Validation Architecture

Validation is manual (nyquist_validation: false per config.json). This section documents the success criteria and how to verify each one.

### Success Criteria Verification Map

| # | Criterion | Verification Method |
|---|-----------|---------------------|
| 1 | RunPod A6000 48GB pod running Qwen3.5-35B-A3B on :8000 | `curl http://localhost:8000/health` returns 200; `curl http://localhost:8000/v1/models` shows Qwen3.5-35B-A3B |
| 2 | Paper MC server in Docker with Simple Voice Chat plugin | `docker ps` shows hermescraft-server; `docker logs hermescraft-server | grep "simple-voice-chat"` shows plugin loaded |
| 3 | All 8 agents connected and producing coherent responses | `tmux attach -t hermescraft-agents`; verify all 8 windows show agent reasoning; `docker logs hermescraft-server | grep "<luna>\|<max>\|<ivy>"` etc |
| 4 | TTS bridge producing audio for all 8 agents | `tail -f /workspace/tts-bridge.log` shows synthesis lines: `[tts] luna: 'message...' -> NNNN bytes, HTTP 200` |
| 5 | Response latency under 3 seconds per agent tick | Watch llama-server log for generation speed; check agent logs for tick completion times; measure with `time curl -s http://localhost:8000/v1/chat/completions -d '{"model":"Qwen3.5-35B-A3B","messages":[{"role":"user","content":"hi"}],"max_tokens":128}'` |
| 6 | 8 agents run concurrently without GPU contention | `nvidia-smi` shows stable VRAM usage; no OOM errors in llama-server log; all 8 agent tmux windows active |
| 7 | System stable for 12+ hours | Let run overnight; check next morning that all 8 windows still active and llama-server still healthy |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hermes 4.3 36B via vLLM | Qwen3.5-35B-A3B MoE via llama-server | Phase 23 | Single model, native vision, GGUF quant |
| Dual-brain (27B + 9B) | Single MoE model | Phase 23 | One inference process, simpler ops |
| Java MC client + HermesBridge mod | Mineflayer direct connection | Phase 22 | No Xvfb, no Java client management needed |
| 4 agents (luna, max, ivy, rust) | 8 agents (+ ember, flint, sage, wren) | Phase 24 | SOUL files exist for all 8 |
| No TTS | Piper TTS + Simple Voice Chat | Phase 25 | Proximity voice audio for all 8 agents |

---

## Open Questions

1. **Is the RunPod pod still provisioned?**
   - What we know: SSH connection details exist in memory (rr8am4a2u1wx9q-644113a2@ssh.runpod.io), pod was used in Phase 14
   - What's unclear: Pod may have been terminated since Phase 14 was done weeks ago. RunPod pods are not persistent by default.
   - Recommendation: Phase 26 Plan 01 should start with: "Verify pod is running OR provision new pod." Include both paths.

2. **Does the network volume at /models still have the model weights?**
   - What we know: setup-pod.sh downloads to `MODEL_DIR=${MODEL_DIR:-/models}`. If a network volume was attached, it persists.
   - What's unclear: Whether a network volume was used in Phase 14 testing.
   - Recommendation: Plan for setup-pod.sh to be idempotent (it already is — skips existing files). Even if models are present, setup-pod.sh is safe to re-run.

3. **Does the TTS plugin jar need rebuilding?**
   - What we know: `tts-plugin/build/libs/tts-plugin-1.0.0.jar` (6,226 bytes) is committed and exists. Phase 25 verified it compiles correctly.
   - What's unclear: Whether any Phase 25 changes after the last jar build require a rebuild.
   - Recommendation: Run `bash -c "cd tts-plugin && ./gradlew jar"` as part of pre-deploy validation, or verify jar timestamp matches latest source change.

4. **Port 8765 gap — is there another mechanism we missed?**
   - What we know: tts-bridge.py posts to localhost:8765. TtsInjector binds to 8765. Port is not in docker-compose.runpod.yml ports mapping.
   - What's unclear: Could the tts-bridge run inside Docker? No — it's started by start-stack.sh on the host.
   - Recommendation: This is a real bug. Fix docker-compose.runpod.yml first.

---

## Project Constraints (from CLAUDE.md)

- Node.js ESM modules only (`"type": "module"`)
- No default exports — named exports only
- camelCase module files, flat structure in `mind/` and `body/`
- Every file begins with one-line purpose comment
- 2-space indent, single quotes, no semicolons
- Init functions named `init<Subsystem>`
- Constants `SCREAMING_SNAKE_CASE`
- No framework — pure Node.js with native fetch
- GSD workflow enforced: use `/gsd:execute-phase` for phase work
- This phase is deployment/infrastructure — most constraints apply to any gap-fix scripts written as part of this phase

---

## Sources

### Primary (HIGH confidence)
- `infra/setup-pod.sh` — pod provisioning procedure, verified by reading full file
- `infra/start-models.sh` — llama-server launch config, verified by reading
- `infra/start-stack.sh` — full stack orchestration, verified by reading
- `infra/tts-bridge.py` — TTS bridge implementation, verified by reading
- `docker-compose.runpod.yml` — MC server config, verified by reading
- `tts-plugin/src/main/java/hermescraft/tts/TtsInjector.java` — port 8765 binding, verified
- `.env.runpod` — RunPod env config, verified by reading
- `launch-agents.sh` — 8-agent launch with 30s stagger, verified by reading
- `.planning/phases/25-voice-chat/25-VERIFICATION.md` — Phase 25 completion status, verified
- `.planning/research/RUNPOD-DUAL-MODEL.md` — inference speed analysis, A6000 characteristics
- `.planning/research/MODEL-OPTIMIZATION.md` — quantization tradeoffs, vLLM vs llama.cpp
- Memory notes: `reference_runpod_ssh.md` — RunPod SSH expect pattern (9 days old, still valid)

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — accumulated architecture decisions across all phases
- `SOUL-*.md` presence check (15 files confirmed, all 8 required agents present)

---

## Metadata

**Confidence breakdown:**
- Existing scripts: HIGH — all read directly
- Port 8765 gap: HIGH — verified by cross-checking TtsInjector.java bind address vs docker-compose.runpod.yml ports
- A6000 inference speed: MEDIUM — from `.planning/research/MODEL-OPTIMIZATION.md` (March 2026, based on community benchmarks)
- Pod still provisioned: LOW — memory is 9 days old, pod may have been terminated

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable infrastructure; model quant choices may evolve faster)
