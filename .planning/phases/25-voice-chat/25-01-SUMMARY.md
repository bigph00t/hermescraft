---
phase: 25-voice-chat
plan: "01"
subsystem: tts-plugin
tags: [voice-chat, paper-plugin, java, tts, audio-injection, docker]
dependency_graph:
  requires: []
  provides: [tts-plugin-jar, voice-chat-docker-config]
  affects: [docker-compose.yml, docker-compose.runpod.yml]
tech_stack:
  added: [voicechat-api:2.6.0, paper-api:1.21.1-R0.1-SNAPSHOT, Simple-Voice-Chat-plugin]
  patterns: [Paper-JavaPlugin, VoicechatPlugin, EntityAudioChannel, JDK-HttpServer]
key_files:
  created:
    - tts-plugin/build.gradle
    - tts-plugin/settings.gradle
    - tts-plugin/gradlew
    - tts-plugin/src/main/java/hermescraft/tts/TtsPlugin.java
    - tts-plugin/src/main/java/hermescraft/tts/TtsInjector.java
    - tts-plugin/src/main/resources/plugin.yml
  modified:
    - docker-compose.yml
    - docker-compose.runpod.yml
    - .gitignore
decisions:
  - voicechat-api version downgraded from 2.6.12 to 2.6.0 (latest available on maven.maxhenkel.de)
  - .gitignore updated to exclude tts-plugin/.gradle/ and tts-plugin/build/ (generated outputs)
metrics:
  duration: ~8min
  completed: "2026-03-23"
  tasks: 2
  files: 9
---

# Phase 25 Plan 01: Paper TTS Plugin + Voice Chat Docker Config Summary

**One-liner:** Paper TTS plugin with HTTP POST /tts endpoint (port 8765) injecting 48kHz PCM as EntityAudioChannel proximity audio, with both docker-compose files wired for Simple Voice Chat auto-install and UDP 24454 exposure.

## What Was Built

### Task 1: Paper TTS Plugin

Created `tts-plugin/` at project root — a standalone Paper plugin (NOT fabric-loom) that:

1. **TtsPlugin.java** — JavaPlugin entrypoint; registers `TtsInjector` with Simple Voice Chat via `BukkitVoicechatService` on `onEnable()`. Handles the case where Simple Voice Chat is not yet loaded with a warning log.

2. **TtsInjector.java** — Implements `VoicechatPlugin`; in `initialize()` starts JDK `HttpServer` on port 8765. HTTP POST `/tts` handler:
   - Parses JSON `{ "agent": "luna", "pcm_b64": "<base64>" }`
   - Case-insensitive player lookup via `BukkitServer.getOnlinePlayers()`
   - Returns HTTP 404 if agent not online (not 500 — clean fail for offline bots)
   - Decodes base64 PCM to `short[]` via `ByteBuffer.LITTLE_ENDIAN`
   - Creates `EntityAudioChannel` with 48-block proximity radius
   - Streams 960-sample frames (hardcoded `FRAME_SIZE = 960`) via `Supplier<short[]>`
   - Pads last frame with zeros to exactly 960; returns `null` when done
   - Calls `AudioPlayer.startPlaying()`
   - Returns `{"ok": true, "frames": N}`

3. **plugin.yml** — `name: HermesCraftTTS`, `api-version: '1.21'`, `depend: [voicechat]`

4. **build.gradle** — Plain Java plugin (no fabric-loom), Java 21, paper-api:1.21.1-R0.1-SNAPSHOT, voicechat-api:2.6.0

Plugin compiles to `tts-plugin/build/libs/tts-plugin-1.0.0.jar` (6.2KB).

### Task 2: Docker Compose Voice Chat Configuration

Both `docker-compose.yml` and `docker-compose.runpod.yml` updated with:
- `"24454:24454/udp"` — UDP port (MUST include /udp suffix; TCP-only breaks voice silently)
- `MODRINTH_PROJECTS: "simple-voice-chat"` — auto-installs Simple Voice Chat on server start
- `./tts-plugin/build/libs/tts-plugin-1.0.0.jar:/data/plugins/tts-plugin.jar` — volume-mounts custom plugin
- Updated MOTDs: "HermesCraft — Voice Chat Enabled" (local) and "HermesCraft RunPod — 8 Agents + Voice" (RunPod)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] voicechat-api version 2.6.12 not available on maven.maxhenkel.de**
- **Found during:** Task 1 — first Gradle build attempt
- **Issue:** `de.maxhenkel.voicechat:voicechat-api:2.6.12` not found in maven repository; latest available version is 2.6.0
- **Fix:** Changed version from `2.6.12` to `2.6.0` in `tts-plugin/build.gradle`
- **Files modified:** `tts-plugin/build.gradle`
- **Commit:** 1410098

**2. [Rule 2 - Missing critical functionality] .gitignore missing tts-plugin build directories**
- **Found during:** Post-commit untracked file check
- **Issue:** `tts-plugin/.gradle/` and `tts-plugin/build/` were untracked generated outputs
- **Fix:** Added both paths to `.gitignore` alongside existing `mod/.gradle/` and `mod/build/` entries
- **Files modified:** `.gitignore`
- **Commit:** 5767e19

## Known Stubs

None — all implemented functionality is fully wired. The plugin is ready for deployment alongside Simple Voice Chat. The TTS bridge (Phase 25-02) will POST to this plugin's HTTP endpoint.

## Self-Check: PASSED

All created files confirmed present:
- `tts-plugin/build.gradle` — exists
- `tts-plugin/src/main/java/hermescraft/tts/TtsPlugin.java` — exists
- `tts-plugin/src/main/java/hermescraft/tts/TtsInjector.java` — exists
- `tts-plugin/src/main/resources/plugin.yml` — exists
- `tts-plugin/build/libs/tts-plugin-1.0.0.jar` — built and confirmed (6,226 bytes)
- `docker-compose.yml` — updated, YAML valid
- `docker-compose.runpod.yml` — updated, YAML valid

All commits verified:
- `1410098` — feat(25-01): create Paper TTS plugin
- `b063010` — feat(25-01): update docker-compose files
- `5767e19` — chore(25-01): add tts-plugin build dirs to .gitignore
