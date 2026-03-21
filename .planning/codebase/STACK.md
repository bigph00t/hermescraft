# Technology Stack

**Analysis Date:** 2026-03-20

## Languages

**Primary:**
- JavaScript (ES Modules) — Node.js agent runtime: all of `agent/`
- Java 17+ — Fabric mod: all of `mod/src/main/java/hermescraft/`

**Secondary:**
- Bash — launch orchestration scripts (`launch-agents.sh`, `launch-client.sh`, `hermescraft.sh`, `start.sh`)

## Runtime

**Environment:**
- Node.js (via nvm) — agent process

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

**Module System:**
- ESM (`"type": "module"` in `package.json`) — all agent files use `import`/`export`

## Frameworks

**Core (Agent):**
- `mineflayer` ^4.35.0 — (listed as dependency but not directly used in current main loop; bridge mod has superseded it for state/action)
- `openai` ^4.0.0 — OpenAI-compatible client pointed at vLLM or any OpenAI API endpoint
- `ws` ^8.16.0 — WebSocket support (available but not actively used in main loop)

**Mod (Java):**
- Fabric Loader 0.16.9 — client mod loader
- Fabric API 0.107.0+1.21.1 — event hooks (`ClientTickEvents`, `ClientReceiveMessageEvents`)
- Minecraft 1.21.1 (Yarn mappings 1.21.1+build.3)
- Gson — JSON serialization (bundled with Minecraft/Fabric)
- Baritone — runtime-optional pathfinding (detected via class reflection; NOT a compile dependency)
- `com.sun.net.httpserver` — embedded HTTP server (JDK built-in)

**Build (Mod):**
- Gradle with `fabric-loom` plugin 1.8-SNAPSHOT

**Testing:**
- `agent/tests/llm.test.js` — one test file, no test runner configured in `package.json`

## Key Dependencies

**Critical:**
- `openai` ^4.0.0 — the only LLM client; all inference calls go through `agent/llm.js` using this SDK against `VLLM_URL`
- Baritone (runtime) — pathfinding backbone for `navigate` and `mine` actions; loaded dynamically; absence degrades to no-op
- Fabric API — event system that drives the mod's client tick loop and chat interception

**Infrastructure:**
- `com.sun.net.httpserver` (JDK built-in) — the HTTP bridge server running on port 3001 inside the Fabric mod
- `CompletableFuture` + fixed thread pool of 4 — bridges HTTP thread → Minecraft client thread in `ActionExecutor` and `StateReader`

## Configuration

**Environment (agent):**
- Configured via `.env` (see `.env.example`)
- `VLLM_URL` — LLM inference endpoint (default: `http://localhost:8000/v1`)
- `MODEL_NAME` — model identifier (default: `Doradus/Hermes-4.3-36B-FP8`)
- `VLLM_API_KEY` / `ANTHROPIC_API_KEY` — auth token; OAuth mode auto-detected if value starts with `sk-ant-oat`
- `MOD_URL` — HermesBridge HTTP base URL (default: `http://localhost:3001`)
- `TICK_MS` — agent loop interval in ms (default: `2000`)
- `MAX_TOKENS` — LLM generation limit (default: `384`)
- `MAX_HISTORY` — conversation history trim limit in messages (default: `90` = ~30 rounds)
- `TEMPERATURE` — base sampling temperature (default: `0.6`)
- `AGENT_NAME` — per-agent data directory key (default: `hermes`)
- `AGENT_MODE` — `phased` | `open_ended` | `directed` (default: `phased`)
- `AGENT_SOUL` — path to SOUL file override; auto-discovered as `SOUL-<name>.md`
- `AGENT_GOAL` — goal string for `directed` mode only

**Environment (mod):**
- `HERMESCRAFT_PORT` — mod HTTP server port (default: `3001`)
- `HERMESCRAFT_SERVER` — Minecraft server address for auto-connect (default: `localhost:25565`)

**Build:**
- `mod/build.gradle` — Fabric loom config, Minecraft version pinned to 1.21.1
- `mod/settings.gradle` — project name

## Platform Requirements

**Development:**
- Node.js (LTS recommended, via nvm)
- JDK 17+ for Fabric mod compilation (`./gradlew build` in `mod/`)
- Minecraft 1.21.1 client with Fabric Loader and Baritone installed
- vLLM server OR any OpenAI-compatible API endpoint

**Production (multi-agent):**
- tmux + Xvfb (virtual display per bot) — managed by `launch-agents.sh`
- One HermesBridge process per bot client, each on a unique port (`3001 + N`)
- MiniMax M2.7-highspeed API used in multi-agent `launch-agents.sh` (not vLLM)
- Linux with `DISPLAY` env set for each headless MC client

---

*Stack analysis: 2026-03-20*
