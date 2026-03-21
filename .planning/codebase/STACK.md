# Technology Stack

**Analysis Date:** 2026-03-20

## Languages

**Primary:**
- JavaScript (ES Modules) - Node.js agent (`agent/`)
- Java 21 - Minecraft Fabric mod (`mod/`)

**Secondary:**
- Bash - Launch scripts (`hermescraft.sh`, `launch-agents.sh`, `launch-client.sh`)
- Python 3 - Used inline in scripts for YAML manipulation and classpath building

## Runtime

**Environment:**
- Node.js (ESM — `"type": "module"` in `package.json`)
- Java 21+ (required by `fabric.mod.json`)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core (Node.js agent):**
- No framework — pure Node.js ESM with native `fetch` (no node-fetch)
- `openai` ^4.0.0 — OpenAI-compatible client pointed at vLLM or any OpenAI-compat endpoint
- `mineflayer` ^4.35.0 — Listed as dependency but NOT used by the custom agent (`agent/index.js`). Present for potential future use or alternative bot mode.
- `ws` ^8.16.0 — WebSocket library; listed but not actively used in current agent code

**Core (Java mod):**
- Minecraft Fabric `1.21.1` — client-side mod framework
  - `net.fabricmc:fabric-loader:0.16.9`
  - `net.fabricmc.fabric-api:fabric-api:0.107.0+1.21.1`
- `com.google.gson` — JSON serialization (bundled with Minecraft, no explicit dep)
- `com.sun.net.httpserver` — JDK built-in HTTP server (no external lib)
- Baritone — pathfinding mod loaded at runtime via reflection; no compile-time dependency

**Build (mod):**
- Gradle with `fabric-loom` plugin `1.8-SNAPSHOT`
- `processResources` expands version into `fabric.mod.json`
- Access widener: `src/main/resources/hermescraft.accesswidener`

**Testing:**
- No test framework detected

## Key Dependencies

**Critical:**
- `openai` ^4.0.0 — Powers all LLM calls via OpenAI-compatible API. Used in `agent/llm.js`. Configured to point at local vLLM or any remote endpoint via `VLLM_URL`.
- Baritone mod (runtime) — Provides all pathfinding (`#goto`, `#mine`, `#stop` chat commands). Without it, navigation and mining actions silently fail. Integration in `mod/src/main/java/hermescraft/BaritoneIntegration.java`.

**Infrastructure:**
- `mineflayer` ^4.35.0 — Declared but inactive; may be vestigial from earlier design
- `ws` ^8.16.0 — Declared but not imported in current agent code

## Configuration

**Environment (all read from process.env in agent):**
- `VLLM_URL` — LLM API base URL (default: `http://localhost:8000/v1`)
- `MODEL_NAME` — Model identifier (default: `Doradus/Hermes-4.3-36B-FP8`)
- `VLLM_API_KEY` — API key; auto-detects OAuth tokens (prefix `sk-ant-oat01-`) vs plain keys
- `ANTHROPIC_API_KEY` — Fallback API key for Claude/OAuth usage
- `MOD_URL` — HermesBridge HTTP server URL (default: `http://localhost:3001`)
- `TEMPERATURE` — LLM temperature (default: `0.6`)
- `MAX_TOKENS` — Max response tokens (default: `384`)
- `MAX_HISTORY` — Max conversation turns in L1 memory (default: `90` messages = ~30 rounds)
- `TICK_MS` — Agent loop interval in ms (default: `2000`)
- `AGENT_NAME` — Agent persona name (default: `hermes`), controls data directory
- `AGENT_MODE` — `phased` | `open_ended` | `directed` (default: `phased`)
- `AGENT_SOUL` — Path to SOUL persona markdown file
- `AGENT_GOAL` — Freeform goal text for `directed` mode
- `MC_USERNAME` — Minecraft username for the bot
- `HERMESCRAFT_PORT` — Port for HermesBridge HTTP server in the mod (default: `3001`)
- `HERMESCRAFT_SERVER` — MC server address for auto-connect (default: `localhost:25565`)

**Config Files:**
- `.env.example` — Documents all env vars; actual `.env` is gitignored
- `mod/build.gradle` — Gradle build configuration
- `mod/src/main/resources/fabric.mod.json` — Mod manifest (environment, entrypoints, dependencies)
- `mod/src/main/resources/hermescraft.accesswidener` — Fabric access widener for MC internals

## Platform Requirements

**Development:**
- Node.js with ESM support
- Java 21+ for mod compilation
- Gradle (via `./gradlew`) for mod builds
- Minecraft 1.21.1 installed with Fabric Loader + Baritone mod present in `~/.minecraft/mods/`

**Production / Multi-agent (Glass server):**
- `Xvfb` — Virtual framebuffer for headless MC client display per bot
- `tmux` — Session management for multi-agent coordination (`launch-agents.sh`)
- `docker` — Minecraft server runs in container (`minecraft-server` container referenced in `launch-agents.sh`)
- Python 3 — Required by `hermescraft.sh` for YAML config manipulation (PyYAML)
- `hermes` CLI — Optional alternate launch path via `hermescraft.sh` using NousResearch Hermes Agent CLI

**Minecraft requirements:**
- Minecraft 1.21.1 vanilla client installed
- Fabric Loader 0.16.9+ installed for the target MC version
- Baritone standalone jar in `~/.minecraft/mods/`
- HermesBridge mod jar in `~/.minecraft/mods/` (built from `mod/`)

---

*Stack analysis: 2026-03-20*
