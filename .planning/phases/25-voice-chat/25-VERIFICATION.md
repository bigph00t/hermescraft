---
phase: 25-voice-chat
verified: 2026-03-24T01:52:44Z
status: human_needed
score: 5/6 must-haves verified
re_verification: false
human_verification:
  - test: "Run Paper server with Simple Voice Chat + TTS plugin, then have an agent chat — verify proximity audio plays for nearby players"
    expected: "Player within 48 blocks hears the agent voice. Player beyond 48 blocks hears nothing."
    why_human: "Requires live Minecraft server with Simple Voice Chat loaded, an agent online, and a human player in-game to confirm 3D spatial audio attenuation."
  - test: "Measure TTS synthesis latency end-to-end (agent chat -> audio plays)"
    expected: "Under 500ms per utterance (ROADMAP Success Criterion 6)"
    why_human: "Requires Piper voice models installed at /models/piper/ and a running stack. Cannot measure latency from source analysis alone."
---

# Phase 25: Voice Chat Verification Report

**Phase Goal:** Text-to-speech for all 8 agents via Simple Voice Chat plugin — each agent has a distinct voice, proximity-based so players hear nearby agents talking
**Verified:** 2026-03-24T01:52:44Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Simple Voice Chat plugin installed on Paper server (docker-compose.runpod.yml) | VERIFIED | `MODRINTH_PROJECTS: "simple-voice-chat"` at line 29 of docker-compose.runpod.yml; UDP port `24454:24454/udp` at line 9 |
| 2 | Python TTS bridge script converts agent chat text to audio (Piper) | VERIFIED | `infra/tts-bridge.py` (203 lines); `PiperVoice.load()` at startup, `synthesize_48k()` with `resample_poly(up=160, down=147)`, syntax-valid |
| 3 | 8 distinct voice profiles configured (one per agent personality) | VERIFIED | `infra/tts-voices.json` — 8 entries: luna/max/ivy/rust/ember/flint/sage/wren, each with distinct `/models/piper/*.onnx` path |
| 4 | Audio injected into Simple Voice Chat as proximity audio — fades with distance | VERIFIED | `TtsInjector.java`: `createEntityAudioChannel` + `channel.setDistance(48)` + `AudioPlayer.startPlaying()` — full injection chain present and wired |
| 5 | infra/start-stack.sh launches TTS bridge alongside agents | VERIFIED | Step 3 (TTS Bridge) added between Step 2 (Models) and Step 4 (Agents); `nohup python3 .../tts-bridge.py` with pgrep idempotence check |
| 6 | TTS latency under 500ms per utterance | ? HUMAN | Cannot verify synthesis latency without /models/piper/ models installed and running stack |

**Score:** 5/6 success criteria verified

### Required Artifacts

#### Plan 25-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tts-plugin/build.gradle` | Gradle build with paper-api + voicechat-api | VERIFIED | Contains `paper-api:1.21.1-R0.1-SNAPSHOT`, `voicechat-api:2.6.0`; plain Java plugin (not fabric-loom) |
| `tts-plugin/src/main/java/hermescraft/tts/TtsPlugin.java` | Plugin entrypoint implementing JavaPlugin | VERIFIED | 29 lines; `onEnable()` registers TtsInjector via `BukkitVoicechatService.registerPlugin()` |
| `tts-plugin/src/main/java/hermescraft/tts/TtsInjector.java` | HTTP server on port 8765 + EntityAudioChannel injection | VERIFIED | 152 lines; `FRAME_SIZE=960`, port 8765, `createEntityAudioChannel`, `setDistance(48)`, `AudioPlayer.startPlaying()`, `pcm_b64` parsing |
| `tts-plugin/src/main/resources/plugin.yml` | Paper plugin manifest | VERIFIED | `name: HermesCraftTTS`, `api-version: '1.21'`, `depend: [voicechat]` |
| `tts-plugin/build/libs/tts-plugin-1.0.0.jar` | Compiled plugin jar | VERIFIED | 6,226 bytes — compiled successfully from source |
| `docker-compose.runpod.yml` | RunPod MC config with voice chat | VERIFIED | `24454:24454/udp`, `MODRINTH_PROJECTS: "simple-voice-chat"`, tts-plugin volume mount |

#### Plan 25-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `infra/tts-bridge.py` | Python TTS bridge (log tail, synthesis, HTTP POST) | VERIFIED | 203 lines (exceeds 80-line min); `resample_poly`, `AGENT_NAMES`, `PiperVoice.load`, `docker logs -f`, `queue.Queue(maxsize=32)`, port 8765 |
| `infra/tts-voices.json` | 8-agent voice model mapping | VERIFIED | Exactly 8 entries, all pointing to `/models/piper/` paths, all distinct Piper en_US models |
| `infra/setup-pod.sh` | Piper TTS install + 8 voice model downloads | VERIFIED | `pip install piper-tts scipy`, `PIPER_VOICES` array with 8 paths, `hf_hub_download` from `rhasspy/piper-voices`; bash syntax valid |
| `infra/start-stack.sh` | Stack launcher with TTS bridge as Step 3 | VERIFIED | Steps 1→2→3(TTS)→4(Agents) in correct order; bash syntax valid |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TtsPlugin.java` | `TtsInjector` (VoicechatPlugin) | `BukkitVoicechatService.registerPlugin()` | WIRED | Line 18: `service.registerPlugin(new TtsInjector(this))` |
| `TtsInjector.java` | voicechat-api `EntityAudioChannel` | `createEntityAudioChannel` + `AudioPlayer` | WIRED | Lines 99-124: full channel creation, setDistance, frame supplier, startPlaying |
| `docker-compose.runpod.yml` | `tts-plugin-1.0.0.jar` | volume mount | WIRED | Line 32: `./tts-plugin/build/libs/tts-plugin-1.0.0.jar:/data/plugins/tts-plugin.jar` |
| `infra/tts-bridge.py` | plugin HTTP `/tts` endpoint | `requests.post` to port 8765 | WIRED | Line 99: `requests.post(PLUGIN_URL, json=payload, timeout=5.0)` where `PLUGIN_URL` defaults to `http://localhost:8765/tts` |
| `infra/tts-bridge.py` | `infra/tts-voices.json` | JSON config load at startup | WIRED | Lines 38-39: `with open(config_path) as f: config = json.load(f)` |
| `infra/start-stack.sh` | `infra/tts-bridge.py` | `nohup python3` background launch | WIRED | Line 80: `nohup python3 "$PROJECT_DIR/infra/tts-bridge.py"` |
| `infra/setup-pod.sh` | piper-tts PyPI package | `pip install` | WIRED | Line 50: `pip install -q piper-tts scipy` |

### Data-Flow Trace (Level 4)

| Component | Data Variable | Source | Produces Real Data | Status |
|-----------|--------------|--------|--------------------|--------|
| `TtsInjector.java` HTTP handler | `allSamples` (short[]) | Decoded from POST body `pcm_b64` field | Real — comes from bridge | FLOWING |
| `TtsInjector.java` AudioPlayer | Frame supplier `short[]` | Sliced from `allSamples` at `FRAME_SIZE=960` | Real — sequentially yields frames | FLOWING |
| `tts-bridge.py` `synthesize_48k()` | `raw` PCM bytes | `PiperVoice.synthesize(text)` generator | Real — Piper model output | FLOWING (model files are runtime deps, not stubs) |
| `tts-bridge.py` log tail | `sender`, `message` | `docker logs -f` stdout matched against `CHAT_RE` | Real — live container output | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| tts-bridge.py Python syntax valid | `python3 -c "import ast; ast.parse(...)"` | SYNTAX OK | PASS |
| tts-voices.json has 8 entries with correct agents | `python3 -c "import json; assert len(...)==8"` | 8 entries: ember, flint, ivy, luna, max, rust, sage, wren | PASS |
| setup-pod.sh bash syntax valid | `bash -n infra/setup-pod.sh` | Exit 0 | PASS |
| start-stack.sh bash syntax valid | `bash -n infra/start-stack.sh` | Exit 0 | PASS |
| Step ordering in start-stack.sh | `grep "Step [1-4]" ...` | Steps 1, 2, 3 (TTS Bridge), 4 (Agents) in order | PASS |
| UDP port present in both compose files | `grep "24454.*udp" ...` | Both files: `24454:24454/udp` at expected line | PASS |
| tts-plugin jar compiled | `ls tts-plugin/build/libs/` | `tts-plugin-1.0.0.jar` (6,226 bytes) | PASS |
| TTS latency < 500ms per utterance | Requires running stack | Cannot test without /models/piper/ models | SKIP |

### Requirements Coverage

Both plans declare: `requirements: ["Infrastructure — enabling phase"]`

REQUIREMENTS.md does not contain a numeric REQ-ID for Phase 25 — the traceability table covers only v2.3 requirements (MEM/BLD/SPA/COO/GPL). Phase 25 is explicitly designated an infrastructure/enabling phase with no formal requirement IDs. This is consistent with how Phase 14 (RunPod Infrastructure) is also documented: "Requirements: Infrastructure — no REQ-IDs (enabling phase)".

No orphaned requirements found — REQUIREMENTS.md has no Phase 25 entries to cross-reference.

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| Infrastructure — enabling phase | 25-01, 25-02 | Voice chat TTS infrastructure (no REQ-ID by design) | SATISFIED | Full pipeline implemented: Paper plugin + Python bridge + infra scripts |

### Anti-Patterns Found

None detected. Full scan of `tts-plugin/src/`, `infra/tts-bridge.py`, `infra/tts-voices.json` — no TODO/FIXME/PLACEHOLDER comments, no empty return stubs, no hardcoded empty arrays flowing to output. The single `time.sleep(5)` is in the Docker reconnection retry path — correct behavior, not an artificial throttle.

**Notable detail (not an anti-pattern):** `voicechat-api` version was downgraded from `2.6.12` (plan) to `2.6.0` (actual) due to maven availability. This was documented as an auto-fixed deviation in 25-01-SUMMARY.md. The API surface used (`createEntityAudioChannel`, `EntityAudioChannel`, `AudioPlayer`, `BukkitVoicechatService`) is stable across these minor versions.

### Human Verification Required

#### 1. In-Game Proximity Audio Test

**Test:** Start Paper server with Simple Voice Chat installed (docker-compose.runpod.yml), wait for TTS plugin to register, have an agent (e.g., luna) log in and send a chat message. Stand within 48 blocks of luna as a human player.
**Expected:** Player hears luna's Kristin voice speaking the chat message. Moving beyond 48 blocks causes audio to fade out and stop.
**Why human:** Requires live Minecraft client with Simple Voice Chat mod installed, a running Paper server, the TTS bridge processing a real chat event, and human ears to confirm 3D spatial attenuation.

#### 2. TTS Latency Measurement

**Test:** With Piper models downloaded to `/models/piper/`, trigger an agent chat and measure time from chat line appearing in Docker logs to audio playing in-game.
**Expected:** Under 500ms (ROADMAP success criterion 6).
**Why human:** Piper model files (~600MB total) are not present in the repository (downloaded at pod setup). Synthesis latency depends on hardware (RunPod A6000 vs local CPU) and cannot be bounded from source analysis alone.

### Gaps Summary

No gaps blocking automated verification. The only open item is Success Criterion 6 (latency < 500ms) which cannot be measured programmatically without a running deployment. All code, wiring, and infrastructure artifacts are substantive and correctly connected.

The implemented pipeline is:
1. Agent chats in Minecraft
2. `tts-bridge.py` tails Docker logs, matches `<agentname> text` pattern against `AGENT_NAMES`
3. Worker thread synthesizes via `PiperVoice`, resamples `22050->48000Hz` with `resample_poly(160, 147)`
4. Bridge POSTs `{agent, pcm_b64}` to `http://localhost:8765/tts`
5. `TtsInjector.java` receives POST, decodes PCM, creates `EntityAudioChannel` at 48-block radius, streams 960-sample frames via `AudioPlayer.startPlaying()`
6. Simple Voice Chat broadcasts proximity audio to nearby players

All six stages are implemented, wired, and verified. Commits `1410098`, `ff70490`, `b063010`, `4386bb7`, `5767e19` exist and cover all modified files.

---

_Verified: 2026-03-24T01:52:44Z_
_Verifier: Claude (gsd-verifier)_
