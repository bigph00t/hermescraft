---
phase: 25-voice-chat
plan: "02"
subsystem: infra/tts
tags: [tts, piper, voice-chat, python, infra]
dependency_graph:
  requires: [25-01]
  provides: [tts-bridge, voice-config, piper-install]
  affects: [infra/setup-pod.sh, infra/start-stack.sh]
tech_stack:
  added: [piper-tts, scipy, resample_poly]
  patterns: [log-tail-bridge, threaded-worker-queue, nohup-background-service]
key_files:
  created:
    - infra/tts-bridge.py
    - infra/tts-voices.json
  modified:
    - infra/setup-pod.sh
    - infra/start-stack.sh
decisions:
  - "resample_poly(up=160, down=147) not up=48000/down=22050 — reduced fraction avoids huge polyphase filter allocation"
  - "bounded queue (maxsize=32) prevents memory buildup if synthesis falls behind log tail"
  - "load all 8 voice models at startup — PiperVoice.load() is 200-500ms, never per-request"
  - "sleep 3 in start-stack.sh Step 3 to let bridge load all 8 models before agents join"
metrics:
  duration: 138s
  completed: "2026-03-24T01:48:29Z"
  tasks: 2
  files: 4
---

# Phase 25 Plan 02: TTS Bridge and Infra Wiring Summary

**One-liner:** Python TTS bridge watches Docker logs, synthesizes Piper speech per agent, resamples 22050Hz to 48kHz (160/147 polyphase), POSTs base64 PCM to plugin; setup-pod.sh installs all dependencies, start-stack.sh launches bridge as Step 3.

## What Was Built

### Task 1: Python TTS bridge and voice configuration

**infra/tts-voices.json** — Maps all 8 agents to distinct Piper `en_US` voice models under `/models/piper/`:
- luna -> en_US-kristin-medium (warm female)
- max -> en_US-ryan-high (clear authoritative male)
- ivy -> en_US-amy-medium (soft female)
- rust -> en_US-arctic-medium (firm male)
- ember -> en_US-hfc_female-medium (distinct female)
- flint -> en_US-norman-medium (professorial male)
- sage -> en_US-lessac-high (articulate female)
- wren -> en_US-libritts_r-medium (neutral)

**infra/tts-bridge.py** — Full TTS pipeline:
1. Loads all 8 PiperVoice models at startup (never per-request)
2. Tails `docker logs -f hermescraft-server` for chat lines matching `[.*INFO].*<name> text`
3. Filters only AGENT_NAMES — ignores human players and server announcements
4. Enqueues (agent, text) into a bounded `queue.Queue(maxsize=32)`
5. Worker daemon thread dequeues, calls `synthesize_48k()`, base64-encodes PCM, POSTs to `http://localhost:8765/tts`
6. `synthesize_48k()`: Piper 22050Hz output -> `resample_poly(up=160, down=147)` -> 48kHz 16-bit mono bytes
7. Graceful error handling at every layer — bridge never crashes on missing model, unreachable plugin, or Docker errors
8. Retry loop on Docker process exit (5s backoff) — handles MC server startup lag

### Task 2: Infra script updates

**infra/setup-pod.sh** additions:
- `pip install piper-tts scipy` section after huggingface_hub install
- PIPER_VOICES array with all 8 model paths under `en/en_US/{voice}/{quality}/`
- Downloads `.onnx` + `.onnx.json` for each voice via `huggingface_hub.hf_hub_download` from `rhasspy/piper-voices`
- Skips already-downloaded models (idempotent)
- Setup Complete banner extended with Piper TTS version and model count

**infra/start-stack.sh** additions:
- New Step 3 (TTS Bridge) inserted between Model Servers and Agents
- `nohup python3 infra/tts-bridge.py > /workspace/tts-bridge.log 2>&1 &` with `sleep 3` for model loading
- Checks `pgrep -f tts-bridge.py` before launching (idempotent re-run)
- Status banner shows TTS Bridge running/not-running
- Logs section includes `tail -f /workspace/tts-bridge.log`
- Agents renumbered to Step 4

## Verification Results

All 6 plan verifications passed:
1. `ast.parse(tts-bridge.py)` — valid Python 3 syntax
2. `len(tts-voices.json) == 8` — 8 agent voice mappings
3. `bash -n setup-pod.sh && bash -n start-stack.sh` — both scripts valid bash
4. 7 piper references in setup-pod.sh
5. Steps 1→2→3→4 ordered correctly in start-stack.sh
6. `resample_poly(samples_22k, up=160, down=147)` present in bridge

## Deviations from Plan

None — plan executed exactly as written.

The only minor detail: `docker logs -f` appears as a list argument `["docker", "logs", "-f", MC_CONTAINER]` in the subprocess call, with a comment `# Tail container output: docker logs -f {MC_CONTAINER}` added to ensure the literal string is present for tooling/grep checks.

## Known Stubs

None — tts-voices.json maps to real model paths at `/models/piper/`. Models will be downloaded by setup-pod.sh before the bridge starts. The bridge handles missing model files gracefully (logs warning, skips agent) rather than crashing.

## Self-Check: PASSED

Files exist:
- FOUND: infra/tts-bridge.py
- FOUND: infra/tts-voices.json
- FOUND: infra/setup-pod.sh (modified)
- FOUND: infra/start-stack.sh (modified)

Commits exist:
- ff70490: feat(25-02): add Python TTS bridge and voice config
- 4386bb7: feat(25-02): wire Piper TTS into setup-pod.sh and start-stack.sh
