# Phase 25: Voice Chat - Research

**Researched:** 2026-03-23
**Domain:** Piper TTS + Simple Voice Chat mod API + Python audio bridge
**Confidence:** HIGH (core technical path verified via official docs and API javadocs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Piper TTS — lightweight, CPU-only, fast (<100ms per utterance). Does NOT use GPU VRAM (reserved for LLM)
- TTS bridge runs on the RunPod pod CPU alongside llama-server
- Audio delivered via Simple Voice Chat mod API — inject PCM audio as if from a player at the agent's position
- Audio format: 16kHz mono PCM (Simple Voice Chat native format, no transcoding)
- Use distinct Piper voice models for each of the 8 agents — Piper has ~30 English voices with varied pitch/speed/gender
- Voice is player-facing only — agents communicate via text chat, they don't "hear" each other's voice
- TTS triggers on every !chat action — TTS bridge watches agent chat messages and converts to audio
- Use Simple Voice Chat's built-in proximity attenuation — no custom distance curve code needed

### Claude's Discretion
- Which specific Piper voice model maps to which agent personality
- Python TTS bridge architecture (watch chat log vs webhook vs poll)
- Simple Voice Chat plugin configuration details
- How the TTS bridge discovers agent positions for spatial audio
- docker-compose.runpod.yml plugin installation method

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 25 adds text-to-speech voices to all 8 agents using Piper TTS (CPU-only, ~22kHz native, <100ms latency) and Simple Voice Chat's server-side Java plugin API. The integration requires three coordinated pieces: (1) a Python TTS bridge that watches the Minecraft server log, synthesizes speech with Piper, and POSTs PCM audio to an HTTP endpoint; (2) a Paper plugin that receives the PCM audio and injects it as proximity audio via `EntityAudioChannel`; and (3) docker-compose additions to install the Simple Voice Chat plugin automatically via `MODRINTH_PROJECTS`.

**CRITICAL FORMAT CORRECTION:** The locked decision states "16kHz mono PCM" as the Simple Voice Chat format, but the official Simple Voice Chat API javadocs explicitly require **48kHz 16-bit PCM** with Opus frame size of **960 samples (20ms)**. Piper outputs at 22050Hz natively. The bridge must resample from 22050Hz → 48000Hz using `scipy.signal.resample_poly(up=48000, down=22050)`. The planner must account for this resampling step.

**Primary recommendation:** Build a small Java Paper plugin (jar) that exposes an HTTP endpoint for audio injection, and a Python bridge that tails the Docker server log, synthesizes with Piper, resamples to 48kHz, and POSTs 960-sample frames to the plugin. The plugin calls `EntityAudioChannel` keyed on the speaking agent's entity. This is the only architecture that reaches players with true proximity attenuation.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INF-01 | Simple Voice Chat plugin installed on Paper server (docker-compose.runpod.yml) | `MODRINTH_PROJECTS: "simple-voice-chat"` + UDP 24454 port exposure pattern confirmed |
| INF-02 | Python TTS bridge script converts agent chat text to audio (XTTS-v2 or Piper) | Piper TTS Python API confirmed: `PiperVoice.load()`, `voice.synthesize()`, `pip install piper-tts` |
| INF-03 | 8 distinct voice profiles configured (one per agent personality) | VOICES.md confirms 20+ en_US voices; personality mapping researched |
| INF-04 | Audio injected into Simple Voice Chat as proximity audio — fades with distance | `EntityAudioChannel` + `createAudioPlayer` confirmed in official javadocs |
| INF-05 | infra/start-stack.sh launches TTS bridge alongside agents | start-stack.sh pattern reviewed; Step 4 addition needed |
| INF-06 | TTS latency under 500ms per utterance | Piper synthesizes in <100ms on CPU; 22050→48000 resample adds ~1ms; opus encode ~1ms |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| piper-tts | 1.4.1 (Feb 2026) | Python TTS synthesis | CPU-only, <100ms, 20+ English voices, ONNX-based |
| scipy | latest (already numpy installed) | PCM resampling 22050→48000 | `resample_poly` is standard polyphase resampler |
| voicechat-api (Java) | 2.6.x | Simple Voice Chat Plugin API | Official API for audio injection via EntityAudioChannel |
| Simple Voice Chat plugin | bukkit-2.6.12 | Paper plugin for proximity voice | Official plugin, Paper 1.21.1 compatible |
| Paper API | 1.21.1-R0.1-SNAPSHOT | Plugin platform | Matches existing server |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| onnxruntime | >=1.11.0,<2 | Piper ONNX model inference | Installed automatically with piper-tts |
| piper-phonemize | ~=1.1.0 | Phoneme conversion | Installed automatically with piper-tts |
| watchdog or follow | any | Log file tail (Python) | Alternative to subprocess `tail -f` for log watching |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Log tail | webhook from mind/index.js | Webhook is more reliable (no log parsing), adds Node.js complexity; log tail is simpler for a bridge |
| scipy resample_poly | librosa.resample | librosa is heavier; scipy is already in reach given numpy is installed |
| Custom Paper plugin | Existing addon | No existing addon exposes HTTP for external audio injection; must build |

**Installation:**
```bash
# Python bridge deps (on RunPod pod)
pip install piper-tts scipy

# Download Piper voice models (8 models ~50-100MB each = ~600MB total)
# Models auto-download on first use OR pre-download via huggingface_hub
pip install huggingface_hub
python -c "from huggingface_hub import hf_hub_download; hf_hub_download('rhasspy/piper-voices', filename='en/en_US/ryan/high/en_US-ryan-high.onnx', local_dir='/models/piper')"

# Java plugin build (Paper plugin, no Gradle needed if jar is pre-built)
# OR: build via mod/gradlew with Paper API dependency
```

**Version verification (verified 2026-03-23):**
- `piper-tts`: 1.4.1 (pypi.org, released 2026-02-05)
- Simple Voice Chat Paper: bukkit-2.6.12 (hangar.papermc.io, 1.8–1.21.11 compatible)
- voicechat-api: 2.6.x (maven.maxhenkel.de/repository/public)

---

## Architecture Patterns

### Recommended Project Structure
```
infra/
├── tts-bridge.py          # Python TTS bridge process
├── tts-voices.json        # Agent → voice model mapping
├── start-stack.sh         # (modified) Step 4: launch tts-bridge
└── setup-pod.sh           # (modified) install piper-tts + scipy

tts-plugin/
├── build.gradle           # Paper plugin build (voicechat-api dep)
├── src/main/java/hermescraft/tts/
│   ├── TtsPlugin.java     # Plugin entrypoint
│   └── TtsInjector.java   # HTTP server + EntityAudioChannel injection
└── src/main/resources/
    └── plugin.yml

server-data/
└── plugins/               # tts-plugin.jar deployed here (via docker volume)
```

### Pattern 1: Log-Tail Chat Capture

**What:** Python subprocess runs `docker logs -f hermescraft-server` and parses chat lines
**When to use:** Simplest integration, no Node.js changes required

Paper server chat log format:
```
[HH:MM:SS INFO]: <playername> message text here
```
Regex: `r'\[.*?INFO\]: <(\w+)> (.+)'` captures `(sender, message)`.

Mineflayer bots appear in Paper chat as `<agentname> message` because they use `bot.chat()`.

### Pattern 2: Piper Python Synthesis

**What:** Load voice model once at startup, synthesize per-message
**When to use:** Always — per-request model loading is too slow

```python
# Source: PyPI piper-tts 1.4.1
from piper import PiperVoice
import numpy as np
from scipy.signal import resample_poly

voice = PiperVoice.load("/models/piper/en_US-ryan-high.onnx")

def synthesize_48k(text: str) -> bytes:
    # Piper outputs 22050Hz 16-bit mono PCM chunks
    pcm_22k = b"".join(
        chunk.audio_int16_bytes
        for chunk in voice.synthesize(text)
    )
    # Resample 22050 -> 48000 Hz for Simple Voice Chat API
    samples_22k = np.frombuffer(pcm_22k, dtype=np.int16).astype(np.float32)
    samples_48k = resample_poly(samples_22k, up=48000, down=22050)
    return samples_48k.astype(np.int16).tobytes()
```

**IMPORTANT:** `resample_poly(up=160, down=147)` is the reduced fraction of 48000/22050.

### Pattern 3: Simple Voice Chat EntityAudioChannel Injection

**What:** Paper plugin receives POST with agent name + raw PCM, finds entity, plays via EntityAudioChannel
**When to use:** This is the only server-side audio injection path

```java
// Source: modrepo.de/minecraft/voicechat/api/examples + javadocs
// Audio format: 48kHz 16-bit mono, frame size MUST be exactly 960 shorts per frame

VoicechatServerApi api = ...; // injected via VoicechatPlugin interface

// Get entity for agent (by player name)
Player player = Bukkit.getPlayer(agentName);
EntityAudioChannel channel = api.createEntityAudioChannel(
    UUID.randomUUID(),
    api.fromEntity(player)
);
channel.setDistance(48);  // blocks; built-in attenuation handles falloff

// Split PCM bytes into 960-sample frames
short[] allSamples = bytesToShorts(pcmBytes);
int frameSize = 960;  // 20ms at 48kHz — HARDCODED, do not change

// createAudioPlayer with Supplier<short[]> for streaming
int[] frameIndex = {0};
AudioPlayer player = api.createAudioPlayer(
    channel,
    api.createEncoder(),
    () -> {
        int start = frameIndex[0] * frameSize;
        if (start >= allSamples.length) return null;  // null = stop
        short[] frame = Arrays.copyOfRange(allSamples, start,
            Math.min(start + frameSize, allSamples.length));
        frameIndex[0]++;
        // Pad last frame to 960 if needed
        if (frame.length < frameSize) {
            frame = Arrays.copyOf(frame, frameSize);
        }
        return frame;
    }
);
player.startPlaying();
```

### Pattern 4: Docker Plugin Installation via MODRINTH_PROJECTS

**What:** itzg/minecraft-server auto-downloads plugin from Modrinth on startup
**When to use:** For Simple Voice Chat; eliminates manual jar management

```yaml
# docker-compose.runpod.yml additions
services:
  minecraft:
    ports:
      - "25565:25565/tcp"
      - "24454:24454/udp"      # MUST be UDP — voice data channel
    environment:
      MODRINTH_PROJECTS: "simple-voice-chat"  # auto-installs latest compatible version
    volumes:
      - ./server-data:/data
      - ./tts-plugin/build/libs/tts-plugin.jar:/data/plugins/tts-plugin.jar  # custom plugin
```

**CRITICAL:** UDP port 24454 MUST be exposed explicitly as `/udp`. `24454:24454` without `/udp` only exposes TCP and voice chat will not work.

### Pattern 5: TTS Bridge Process Lifecycle in start-stack.sh

**What:** Add Step 4 to start-stack.sh that launches tts-bridge.py as background process
**When to use:** Always — must start after MC server (needs log stream) and before agents

```bash
# Step 4: TTS Bridge (after MC server, before agents)
echo "── Step 4: TTS Bridge ──"
nohup python3 "$PROJECT_DIR/infra/tts-bridge.py" \
    > /workspace/tts-bridge.log 2>&1 &
TTS_PID=$!
echo "[stack] TTS bridge PID: $TTS_PID (log: /workspace/tts-bridge.log)"
sleep 2  # let bridge initialize model
```

### Anti-Patterns to Avoid

- **UDP-only Docker port syntax omission:** `"24454:24454"` silently maps TCP only. Voice chat fails. Must be `"24454:24454/udp"`.
- **Wrong audio frame size:** Simple Voice Chat Opus encoder frame must be exactly 960 samples. Smaller/larger frames cause encoding errors or silence.
- **Loading Piper model per-request:** PiperVoice.load() takes ~200-500ms. Load once at startup, reuse.
- **Assuming 16kHz native format:** CONTEXT.md states "16kHz" but the Simple Voice Chat API requires 48kHz. Piper outputs 22kHz. All three are different; resampling is required.
- **Tailing log file instead of docker logs:** The MC server runs in a container. The log is at `server-data/logs/latest.log`, but `docker logs -f hermescraft-server` is more reliable and doesn't require volume path knowledge.
- **Blocking synthesis in TTS bridge:** If synthesis blocks the log-tail loop, subsequent chat messages pile up. Use a thread/queue: log-tail thread enqueues messages, synthesis worker dequeues and sends.
- **Sending audio for non-agent players:** Parse only messages from known agent names (luna, max, ivy, rust, ember, flint, sage, wren).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TTS synthesis | Custom neural TTS | Piper TTS (piper-tts pip package) | Piper handles phonemization, ONNX inference, audio chunking |
| Proximity attenuation | Custom distance curve | Simple Voice Chat EntityAudioChannel.setDistance() | Built-in 3D audio with OpenAL falloff |
| Opus encoding | Custom Opus codec | api.createEncoder() in voicechat-api | Opus encoding details (bitrate, DTX, complexity) are opaque; wrong params cause garbled audio |
| Voice model discovery | Crawling HuggingFace | VOICES.md + `huggingface_hub` download | Pre-defined list; models are at known paths |
| PCM resampling | Custom interpolation | scipy.signal.resample_poly | Polyphase resampling handles 22050→48000 correctly; naive interpolation introduces aliasing |

**Key insight:** The Simple Voice Chat API's Opus layer is the hardest part — frame size, timing, and encoding must match exactly. `createAudioPlayer` with a `Supplier<short[]>` handles the timing loop in a separate thread automatically; don't replicate that logic.

---

## Common Pitfalls

### Pitfall 1: Wrong Sample Rate (The Big One)
**What goes wrong:** Audio is injected at wrong rate → sounds chipmunk (too fast) or slowed (too slow). Or silent if encoder rejects non-standard frame lengths.
**Why it happens:** Three different sample rates in play: Piper native (22050Hz), Simple Voice Chat API required (48000Hz), CONTEXT.md stated (16000Hz — incorrect).
**How to avoid:** Always resample Piper output to exactly 48000Hz before sending to plugin. Verify with `voice.config.sample_rate` attribute on the loaded PiperVoice instance.
**Warning signs:** Audio plays at wrong pitch; AudioPlayer stops immediately after startPlaying().

### Pitfall 2: UDP Port Not Exposed in Docker
**What goes wrong:** Players connect, see voice chat status icon, but never hear anything. No error messages.
**Why it happens:** Docker-compose `24454:24454` only maps TCP by default. Voice data uses UDP exclusively.
**How to avoid:** Always write `24454:24454/udp` in ports section. Verify with `docker port hermescraft-server`.
**Warning signs:** Client shows "connected" but voice indicator never activates.

### Pitfall 3: Client Mod Required
**What goes wrong:** Players hear nothing even with correct server setup.
**Why it happens:** Simple Voice Chat is NOT a vanilla-compatible plugin. Players must install the Simple Voice Chat client mod (Fabric/Forge version) to participate.
**How to avoid:** Document in README that players need client mod. The Paper plugin + client mod combination works without agents needing a mod (entity audio channels work server-side only).
**Warning signs:** Server logs show plugin loaded and port open, but zero player connections to voice.

### Pitfall 4: Agent Entity Not Online When Injecting
**What goes wrong:** `Bukkit.getPlayer(agentName)` returns null → NullPointerException in plugin → TTS bridge HTTP call fails.
**Why it happens:** Mineflayer bots may not be fully connected when first TTS injection arrives, or a bot crashed/disconnected.
**How to avoid:** Plugin HTTP endpoint should return HTTP 404 when player not found (not 500), and bridge should swallow 404 gracefully — the agent is just offline.
**Warning signs:** Bridge logs show HTTP errors on startup or after bot crashes.

### Pitfall 5: Chat Log Parsing False Positives
**What goes wrong:** TTS fires for player-typed messages or server system messages, not just agent !chat outputs.
**Why it happens:** Log regex `<name> message` matches all chat, not just agent names.
**How to avoid:** Filter to only process messages where `name in AGENT_NAMES` set.
**Warning signs:** TTS fires for human player messages; system announcements trigger synthesis.

### Pitfall 6: Piper Model File Not Found
**What goes wrong:** `PiperVoice.load()` raises FileNotFoundError on RunPod pod.
**Why it happens:** Models are not pre-downloaded; tts-bridge.py starts before models are present.
**How to avoid:** Add model download step to `setup-pod.sh` before tts-bridge launch. Use `huggingface_hub` to download all 8 model pairs (.onnx + .onnx.json) on pod setup.
**Warning signs:** Bridge crashes at startup; model directory is empty.

---

## Voice Personality Mapping (Claude's Discretion)

Based on agent SOUL personalities and available en_US Piper voices:

| Agent | Personality | Recommended Voice | Quality | Rationale |
|-------|-------------|-------------------|---------|-----------|
| Luna | Warm, excitable, artistic, female | `en_US-kristin-medium` | medium | Warm, expressive female |
| Max | Dry, measured, male engineer | `en_US-ryan-high` | high | Clear authoritative male, best quality |
| Ivy | Gentle, nurturing, female | `en_US-amy-medium` | medium | Soft female voice |
| Rust | Blunt, military cadence, male | `en_US-arctic-medium` | medium | Firm, clear male — slightly rough |
| Ember | Opinionated, energetic, female | `en_US-hfc_female-medium` | medium | Distinct female with presence |
| Flint | Academic, slightly distracted, male | `en_US-norman-medium` | medium | Professorial male quality |
| Sage | Formal, precise, female | `en_US-lessac-high` | high | Clear articulate female |
| Wren | Quick, eager, gender-neutral | `en_US-libritts_r-medium` | medium | Younger neutral quality |

**Note:** These are initial assignments. The specific voice models can be swapped by editing `tts-voices.json` without code changes.

---

## Code Examples

### Bridge Architecture (Python)

```python
# infra/tts-bridge.py
# Source: derived from Piper Python API docs + subprocess log-tail pattern

import subprocess, re, threading, queue, requests, json, os, numpy as np
from piper import PiperVoice
from scipy.signal import resample_poly

AGENT_NAMES = {"luna", "max", "ivy", "rust", "ember", "flint", "sage", "wren"}
PLUGIN_URL = "http://localhost:8765/tts"  # Paper plugin HTTP server
VOICES_CONFIG = "/workspace/hermescraft/infra/tts-voices.json"

# Load all 8 voices at startup
voices = {}
with open(VOICES_CONFIG) as f:
    config = json.load(f)
for agent, model_path in config.items():
    voices[agent] = PiperVoice.load(model_path)

# PCM synthesis + resample to 48kHz
def synthesize(agent: str, text: str) -> bytes:
    voice = voices[agent]
    raw = b"".join(c.audio_int16_bytes for c in voice.synthesize(text))
    s22 = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
    s48 = resample_poly(s22, up=160, down=147)  # 48000/22050 = 160/147
    return s48.astype(np.int16).tobytes()

# Worker: dequeue synthesis jobs
job_queue = queue.Queue()
def worker():
    while True:
        agent, text = job_queue.get()
        try:
            pcm = synthesize(agent, text)
            requests.post(PLUGIN_URL, json={
                "agent": agent,
                "pcm_b64": __import__("base64").b64encode(pcm).decode()
            }, timeout=2.0)
        except Exception as e:
            print(f"[tts] error for {agent}: {e}")
        finally:
            job_queue.task_done()

threading.Thread(target=worker, daemon=True).start()

# Log tail — parse Paper server output
CHAT_RE = re.compile(r'\[.*?INFO\].*?<(\w+)> (.+)')
proc = subprocess.Popen(
    ["docker", "logs", "-f", "hermescraft-server"],
    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True
)
for line in proc.stdout:
    m = CHAT_RE.search(line)
    if m:
        sender, msg = m.group(1).lower(), m.group(2)
        if sender in AGENT_NAMES:
            job_queue.put((sender, msg))
```

### Simple Voice Chat Plugin: HTTP Injection Endpoint (Java)

```java
// TtsInjector.java — HTTP server receiving PCM, injecting via EntityAudioChannel
// Source: voicechat-api javadocs + Sun HttpServer pattern

import com.sun.net.httpserver.*;  // JDK built-in (already used in HermesBridge)
import de.maxhenkel.voicechat.api.*;
import de.maxhenkel.voicechat.api.audiochannel.*;
import java.util.Base64;
import java.util.Arrays;

// Called from plugin when POST arrives at /tts
void injectAudio(VoicechatServerApi api, String agentName, byte[] pcmBytes) {
    Player player = Bukkit.getPlayer(agentName);
    if (player == null) return;  // agent offline — skip silently

    EntityAudioChannel channel = api.createEntityAudioChannel(
        UUID.randomUUID(), api.fromEntity(player)
    );
    channel.setDistance(48);  // proximity radius in blocks

    short[] allSamples = pcmBytesToShorts(pcmBytes);
    final int FRAME = 960;
    final int[] idx = {0};

    AudioPlayer ap = api.createAudioPlayer(channel, api.createEncoder(), () -> {
        int start = idx[0]++ * FRAME;
        if (start >= allSamples.length) return null;
        short[] frame = Arrays.copyOf(
            Arrays.copyOfRange(allSamples, start, start + FRAME), FRAME
        );
        return frame;
    });
    ap.startPlaying();
}

static short[] pcmBytesToShorts(byte[] bytes) {
    short[] shorts = new short[bytes.length / 2];
    java.nio.ByteBuffer.wrap(bytes).order(
        java.nio.ByteOrder.LITTLE_ENDIAN
    ).asShortBuffer().get(shorts);
    return shorts;
}
```

### Plugin.yml

```yaml
name: HermesCraftTTS
version: 1.0.0
main: hermescraft.tts.TtsPlugin
api-version: 1.21
depend: [voicechat]
```

### build.gradle (Paper plugin)

```groovy
repositories {
    maven { url "https://repo.papermc.io/repository/maven-public/" }
    maven { url "https://maven.maxhenkel.de/repository/public" }
}
dependencies {
    compileOnly "io.papermc.paper:paper-api:1.21.1-R0.1-SNAPSHOT"
    compileOnly "de.maxhenkel.voicechat:voicechat-api:2.6.12"
}
```

### docker-compose.runpod.yml diff

```yaml
# Add to minecraft service:
ports:
  - "25565:25565"
  - "24454:24454/udp"        # voice chat UDP (MUST specify /udp)
environment:
  MODRINTH_PROJECTS: "simple-voice-chat"   # auto-installs on startup
volumes:
  - ./server-data:/data
  - ./tts-plugin/build/libs/tts-plugin.jar:/data/plugins/tts-plugin.jar
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| XTTS-v2 (GPU required) | Piper TTS (CPU-only) | Phase 25 decision | Preserves all GPU VRAM for LLM |
| rhasspy/piper (archived) | OHF-Voice/piper1-gpl (active fork) | Oct 2025 | piper-tts PyPI package still works; new dev at OHF-Voice |
| Manual jar upload for plugins | MODRINTH_PROJECTS env var | itzg pattern (current) | Auto-installs compatible version on server start |

**Deprecated/outdated:**
- `rhasspy/piper` GitHub repo: Archived Oct 6 2025, read-only. Development moved to `OHF-Voice/piper1-gpl`. The `piper-tts` PyPI package still installs and works as of 1.4.1 (Feb 2026).

---

## Open Questions

1. **TTS bridge communication with Paper plugin: HTTP vs socket**
   - What we know: Sun HttpServer is already used in HermesBridge (existing mod). HTTP POST with base64 PCM is clear and debuggable.
   - What's unclear: Whether running a second HttpServer in a separate Paper plugin causes port conflicts. HermesBridge uses port 3001; TTS plugin can use port 8765.
   - Recommendation: Use HTTP on a distinct port (8765). Keep it simple and consistent with project's existing pattern.

2. **Do Mineflayer bots appear as online Players in Bukkit.getPlayer()?**
   - What we know: Mineflayer bots connect to the Paper server as real Minecraft clients. The Paper server treats them as normal players.
   - What's unclear: The exact `bot.username` that Paper registers. In launch-agents.sh, `MC_USERNAME=AGENT_NAME` so `Bukkit.getPlayer("luna")` should work.
   - Recommendation: Paper plugin should do case-insensitive lookup. Log when player not found to surface any name mismatch.

3. **Voice model storage on RunPod pod**
   - What we know: Pod setup downloads LLM to `/models/`. Piper models are ~50-100MB each, 8 total = ~600MB.
   - What's unclear: Whether `/models/` is on the persistent network volume or ephemeral pod storage.
   - Recommendation: Download Piper models to `/models/piper/` via `setup-pod.sh` so they persist. Alternatively, download lazily on bridge startup if models directory is empty.

4. **TTS for very long agent messages**
   - What we know: Agent chat messages are capped at 256 chars by Minecraft. Synthesis of 256 chars ~= 2-5 seconds of audio.
   - What's unclear: Whether playing 4-5s of entity audio via EntityAudioChannel blocks other concurrent TTS injections.
   - Recommendation: Each agent gets its own `EntityAudioChannel` UUID. Concurrent audio from different entities should be independent. Test with 2-3 agents chatting simultaneously.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | TTS bridge | YES | 3.11.14 | — |
| numpy | PCM conversion | YES | 2.4.3 | — |
| scipy | Resampling 22050→48000 | NO | — | Install: `pip install scipy` |
| piper-tts | Synthesis | NO | — | Install: `pip install piper-tts` |
| Java 21 | Paper plugin build | YES | 21.0.10 | — |
| Docker | MC server container | YES | 28.2.2 | — |
| mod/gradlew | Paper plugin build | YES | present | — |
| Simple Voice Chat plugin | Proximity voice | NO (not in docker-compose yet) | — | Add MODRINTH_PROJECTS to docker-compose |

**Missing dependencies with no fallback:**
- Simple Voice Chat plugin: Must be added to docker-compose.runpod.yml (`MODRINTH_PROJECTS: "simple-voice-chat"`) — no alternative provides server-side proximity audio injection.

**Missing dependencies with fallback (install step needed):**
- `scipy`: `pip install scipy` in setup-pod.sh
- `piper-tts`: `pip install piper-tts` in setup-pod.sh
- Piper voice model files: Download via `huggingface_hub` or `piper-tts` auto-download in setup-pod.sh

---

## Project Constraints (from CLAUDE.md)

- **ESM throughout**: TTS bridge is Python, not JavaScript — no ESM concern.
- **No framework — pure Node.js ESM**: TTS bridge is a separate Python process; does not need to follow Node.js patterns.
- **Tick budget (2-3s)**: TTS bridge runs async in a background process — zero impact on agent tick loop. No TTS logic enters mind/index.js.
- **Token budget**: TTS bridge adds no system prompt content.
- **LLM latency**: Piper synthesis happens after `bot.chat()` is already called and dispatched — latency is irrelevant to the LLM call path.
- **Mod stability**: Phase 25 does NOT require Java mod changes to HermesBridge. The TTS plugin is a separate Paper plugin jar.
- **init<Subsystem> pattern**: TTS bridge is a standalone Python process, not a JS module — naming conventions don't apply.
- **GSD workflow**: Changes go through GSD execute-phase per CLAUDE.md.

---

## Sources

### Primary (HIGH confidence)
- `modrepo.de/minecraft/voicechat/api/examples` — EntityAudioChannel, AudioPlayer, createAudioPlayer code patterns
- `maven.maxhenkel.de/javadoc/...VoicechatServerApi.html` — API method signatures, parameter types
- `maven.maxhenkel.de/javadoc/...AudioPlayer.html` — AudioPlayer interface methods
- `github.com/rhasspy/piper/VOICES.md` — Complete en_US voice model list with quality tiers
- `github.com/itzg/docker-minecraft-server/examples/simple-voice-chat/paper-compose.yaml` — MODRINTH_PROJECTS pattern, UDP port syntax
- `hangar.papermc.io/henkelmax/SimpleVoiceChat` — Latest Paper plugin version (bukkit-2.6.12), MC 1.21.1 compatible
- PyPI piper-tts 1.4.1 — install command, Python API (`PiperVoice.load`, `voice.synthesize`)
- `pypi.org/project/piper-tts/` — Version 1.4.1 confirmed released 2026-02-05

### Secondary (MEDIUM confidence)
- WebSearch confirming 48kHz, 960 samples/frame requirement for Simple Voice Chat API (multiple sources agree)
- WebSearch confirming `resample_poly(up=48000, down=22050)` as standard scipy approach for this resampling task
- WebSearch confirming Paper log format `[HH:MM:SS INFO]: <username> message`
- `github.com/henkelmax/voicechat-api-bukkit` — build.gradle dependency pattern for voicechat-api

### Tertiary (LOW confidence)
- Voice-to-personality mapping recommendations — based on voice sample descriptions, not tested

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pip package verified on PyPI, voicechat-api javadocs confirmed, docker pattern from official itzg example
- Architecture: HIGH — API methods confirmed via official javadocs; pattern is straightforward
- Pitfalls: HIGH — UDP docker port issue confirmed in multiple itzg issues; 48kHz requirement verified via javadoc and search
- Voice personality mapping: LOW — requires listening to voice samples to validate

**Research date:** 2026-03-23
**Valid until:** 2026-06-23 (stable ecosystem; Piper archived but piper-tts pip package remains functional)
