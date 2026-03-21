# External Integrations

**Analysis Date:** 2026-03-20

## LLM Providers

**Primary — vLLM (self-hosted):**
- Default model: `Doradus/Hermes-4.3-36B-FP8`
- Endpoint: `VLLM_URL` env var (default `http://localhost:8000/v1`)
- Client: `openai` npm package (OpenAI-compatible API)
- Auth: `VLLM_API_KEY` env var; `'not-needed'` accepted for local vLLM
- Tool calling: vLLM launched with `--enable-auto-tool-choice --tool-call-parser hermes`
- Response parsing: native function calling (tool_calls) with fallback to `<tool_call>` XML / `REASONING:` / `ACTION:` text formats

**Secondary — Anthropic Claude (via OAuth):**
- Triggered when `VLLM_API_KEY` or `ANTHROPIC_API_KEY` starts with `sk-ant-oat01-`
- Same OpenAI-compat client; extra headers injected automatically:
  - `Authorization: Bearer <token>`
  - `anthropic-version: 2023-06-01`
  - `anthropic-beta: oauth-2025-04-20`
- Used when pointing `VLLM_URL` at Anthropic's API endpoint

**Multi-agent production — MiniMax:**
- Referenced in `launch-agents.sh`: `https://api.minimaxi.chat/v1`, model `MiniMax-M2.7-highspeed`
- Same OpenAI-compat client; `VLLM_API_KEY` required

**Alternate launch mode — NousResearch Hermes Agent CLI:**
- Used only via `hermescraft.sh` (not the primary `agent/index.js` path)
- Requires `hermes` CLI binary installed separately
- Configured via `~/.hermes/config.yaml`; SOUL persona file copied to `~/.hermes/SOUL.md`
- MCP server bridge at `mcp-server/` (referenced but not in main agent path)

## Token and Context Window Management

**L1 Session Memory (in-process, `agent/llm.js`):**
- Conversation history kept in `conversationHistory[]` array (module-level, process-lifetime)
- Trim limit: `MAX_HISTORY` env var (default 90 messages = ~30 rounds of user/assistant/tool)
- `trimHistory()` — removes oldest complete rounds (user+assistant+tool triplets) when over limit
- `trimHistoryGraduated(fraction)` — removes oldest `fraction * length` messages on context overflow; called with 0.25 on overflow, 0.5 as last resort before throwing
- Context overflow detection: inspects error messages for `context length`, `input tokens`, `maximum input length`, `too many tokens`
- Full history wipe: triggered on corrupt tool call (HTTP 400 + `invalid`/`tool_call` in message)
- `clearConversation()` — called on death, phase transition, stuck detection, position stuck

**Tool calling resilience:**
- `useToolCalling` flag starts `true`; disabled permanently after `MAX_TOOL_FAILURES` (3) consecutive failures
- Falls back to text-only completion on tool-unsupported errors (HTTP 400/422)
- On success, `toolCallingFailures` counter resets to 0

**Token budget:**
- `MAX_TOKENS` defaults to 384 output tokens (intentionally small for fast responses)
- System prompt includes: identity/SOUL, gameplay instructions, phase objectives, active skill, memory (7 recent lessons, 5 strategies, 5 world knowledge), death count, pinned context documents
- User message includes: notepad (max 2000 chars), phase progress detail, last failed action, game state summary, 6 recent actions
- Pinned context: up to 5 `.md/.txt/.json` files from `<dataDir>/context/`, each capped at 8000 chars, injected every tick (survives all history wipes)

**Request timeout:** 120 seconds (first call has no cache; 1024 tokens at 15 tok/s = ~69s)
**Retry policy:** 3 attempts with exponential backoff starting at 1000ms

## Minecraft Bridge (HermesBridge Mod)

**Protocol:** Custom HTTP REST API served by the Java mod using `com.sun.net.httpserver`
**Default port:** 3001 (overridden by `HERMESCRAFT_PORT` env var)
**Transport:** Plain HTTP, no auth, CORS unrestricted (`Access-Control-Allow-Origin: *`)

**Endpoints:**
- `GET /health` — Liveness check; returns `{"status":"ok","mod":"hermesbridge","version":"1.0.0"}`
- `GET /state` — Full game state as JSON (cached, updated every 20 MC ticks = 1 second)
  - Contains: health, food, saturation, armor, position, dimension, time, biome, XP, status flags, held item, full inventory, hotbar, armor slots, offhand, nearby entities (32m radius, max 50), nearby notable blocks (8m radius, curated set), status effects, Baritone pathing flag, crosshair target, recent chat, open screen details
- `POST /action` — Execute a game action; body is JSON `{"type": "<action>", ...params}`
  - Actions execute on the next MC client tick via `AtomicReference<PendingAction>` queue
  - Returns: `{"success": true/false, "message": "...", ...}`
- `GET /recipes?item=<name>` — Look up crafting recipe via `RecipeLookup.java`
- `GET /chat` — Returns last 20 chat messages as newline-delimited plain text

**Mod source:** `mod/src/main/java/hermescraft/`
- `HermesBridgeMod.java` — Entrypoint, chat capture, auto-connect, tick registration
- `HttpServer.java` — HTTP server and endpoint handlers
- `StateReader.java` — Game state collection and JSON serialization
- `ActionExecutor.java` — Action dispatch; sustained actions run over multiple ticks
- `BaritoneIntegration.java` — Baritone pathfinding via chat commands (`#goto`, `#mine`, `#stop`)
- `RecipeLookup.java` — In-game recipe lookup

**Baritone integration:**
- Detected at runtime via `Class.forName("baritone.BaritoneProvider")`
- Commands sent as chat messages starting with `#` (Baritone intercepts via mixin)
- `isPathing()` always returns `false`; agent uses position change detection instead
- Required for `navigate` and `mine` actions; without it they fail silently

## Persistence and Storage

**All storage is local filesystem — no database, no cloud storage.**

**Per-agent data directory:** `agent/data/<AGENT_NAME>/` (created on startup)

**L2 Curated Memory (`MEMORY.md`):**
- File: `agent/data/<AGENT_NAME>/MEMORY.md`
- Markdown format with `## Lessons`, `## Strategies`, `## World Knowledge`, `## Stats` sections
- Parsed/written by `agent/memory.js:parseMemoryMd` / `renderMemoryMd`
- Persisted on: death, phase completion, `periodicSave()` (every 20 ticks), graceful shutdown
- Limits: max 20 lessons, 10 strategies, 10 world knowledge entries (oldest evicted)

**Stats (`stats.json`):**
- File: `agent/data/<AGENT_NAME>/stats.json`
- JSON: `totalDeaths`, `totalActions`, `totalTicks`, `sessionsPlayed`, `highestPhase`, `highestPhaseName`, `totalPlayTimeMs`
- Written on every death and periodically

**L3 Session Transcripts (JSONL):**
- Files: `agent/data/<AGENT_NAME>/sessions/session-<timestamp>.jsonl`
- One entry per tick, death, and phase completion
- Auto-pruned to last 10 files by `pruneSessionLogs()` in `periodicSave()`

**L4 Skills (`SKILL.md`):**
- Shared seed skills: `agent/skills/<skill-name>/SKILL.md` (committed to repo, read-only)
- Per-agent learned skills: `agent/data/<AGENT_NAME>/skills/<skill-name>/SKILL.md`
- Format: YAML frontmatter (`name`, `description`, `license`, `metadata`) + markdown body
- Metadata fields: `author`, `version`, `phase`, `deaths_before_mastery`, `success_rate`
- Created/updated by `agent/skills.js:createSkillFromPhase`, `updateSkill`, `recordSkillOutcome`
- Loaded at startup; reloaded after write; shared seeds loaded as read-only fallbacks

**Notepad (persistent scratchpad):**
- File: `agent/data/<AGENT_NAME>/notepad.txt`
- Written/read by `notepad` tool (LLM-controlled); max 2000 chars injected into user message
- Survives session restarts; cleared only when LLM writes new content

**Player relationships:**
- File: `agent/data/<AGENT_NAME>/players.json`
- JSON map of player names to `{first_met, interactions[], sentiment, relationship, last_seen}`
- Written every 20 ticks via `savePlayers()` in `agent/social.js`

**Named locations:**
- File: `agent/data/<AGENT_NAME>/locations.json`
- JSON map of location names to `{x, y, z, type, saved}`
- Auto-populated: bed and storage chest positions detected from nearby blocks
- Written every 20 ticks via `saveLocations()` in `agent/locations.js`

**User instructions (one-shot):**
- File: `agent/data/<AGENT_NAME>/instructions.txt`
- Read once per tick, cleared after reading; external process writes goal changes here
- Goal prefix `GOAL:` triggers `setGoal()` in `agent/goals.js`

**Pinned context documents:**
- Directory: `agent/data/<AGENT_NAME>/context/`
- Any `.md`, `.txt`, or `.json` file placed here is injected into every system prompt
- Loaded by `agent/prompt.js:loadPinnedContext`; survives all conversation history wipes

## External APIs

**Minecraft Wiki (read-only):**
- Used by `wiki` tool in `agent/index.js:handleWikiLookup`
- Endpoint 1: `https://minecraft.wiki/api.php?action=query&prop=extracts&...` — page extract, 600 chars
- Endpoint 2: `https://minecraft.wiki/api.php?action=opensearch&...` — fallback search on missing page
- Timeout: 8s for page lookup, 5s for search; uses `AbortSignal.timeout`
- No auth required

## Authentication and Identity

**LLM auth:** API key in `VLLM_API_KEY` / `ANTHROPIC_API_KEY` env vars. No token rotation or secrets management beyond env vars.

**Minecraft auth:** `--accessToken 0 --userType legacy` in `launch-client.sh` — offline mode, no Mojang authentication.

## Monitoring and Observability

**Error tracking:** None — errors logged to stdout/stderr via `agent/logger.js`

**Logs:** ANSI-colored terminal output designed for livestream visibility:
- Heart/food bars with color coding
- LLM reasoning displayed prominently with `│` borders
- Rich death banners (box-drawing characters)
- Phase transition announcements
- Action results (green checkmark / red X)
- Session stats every 20 ticks

**Crash resilience:**
- `process.on('unhandledRejection')` and `process.on('uncaughtException')` handlers in `agent/index.js`
- `periodicSave()` called on uncaught exception before attempting to continue
- Multi-agent launcher has auto-restart loop: `while true; do node agent/index.js; sleep 5; done`

## CI/CD and Deployment

**Hosting:** Unspecified Linux server referred to as "Glass" in `launch-agents.sh`

**CI Pipeline:** None detected

**Multi-agent deployment:**
- `launch-agents.sh` spins up to 10 bots (expandable via `BOT_NAMES` array)
- Each bot: dedicated Xvfb virtual display, unique HermesBridge port (3001+N), tmux window
- MC server: Docker container (`docker logs -f minecraft-server` referenced)
- Bot clients launched via `launch-client.sh`: Java invoked directly with parsed classpath from Fabric/vanilla JSON files

---

*Integration audit: 2026-03-20*
