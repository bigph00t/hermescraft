# External Integrations

**Analysis Date:** 2026-03-20

## LLM Provider

**vLLM / OpenAI-compatible API:**
- Client: `openai` npm package (^4.0.0), configured in `agent/llm.js`
- Endpoint: `VLLM_URL` (default `http://localhost:8000/v1`)
- Default model: `Doradus/Hermes-4.3-36B-FP8` (Hermes 4.3 36B)
- Auth: `VLLM_API_KEY` or `ANTHROPIC_API_KEY`; auto-detects OAuth (`sk-ant-oat*`) and sets `anthropic-beta: oauth-2025-04-20` header
- Multi-agent production uses MiniMax M2.7-highspeed at `https://api.minimaxi.chat/v1` (set in `launch-agents.sh`)
- Tool calling: `tool_choice: 'required'` always set; falls back to XML/JSON text parsing after 3 consecutive failures
- Timeout: 120s per request

## HermesBridge Mod HTTP API

**Fabric mod embedded HTTP server (`mod/src/main/java/hermescraft/HttpServer.java`):**
- Port: `HERMESCRAFT_PORT` (default `3001`), configurable per-agent instance
- All endpoints return JSON (Content-Type: application/json)
- CORS headers set on all responses (`Access-Control-Allow-Origin: *`)

**Endpoints consumed by agent (`agent/state.js`, `agent/actions.js`, `agent/index.js`):**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/state` | Full game state JSON (position, health, food, inventory, nearby blocks/entities, dimension, time, effects, open screen, chat) |
| POST | `/action` | Execute a game action (JSON body: `{type, ...params}`) |
| GET | `/chat` | Recent chat messages as plain text (last 20, ring buffer) |
| GET | `/recipes?item=X` | Crafting recipe lookup via `RecipeLookup.java` |
| GET | `/health` | Liveness check |

**State polling pattern:**
- `StateReader.updateCachedState()` runs every 20 MC ticks (1s) on the client thread
- Agent calls `GET /state` each tick (every `TICK_MS` ms) via `fetchState()` in `agent/state.js`
- Actions submitted via `POST /action` are queued in `ActionExecutor.pendingAction` (atomic ref) and executed on the next MC client tick

**Baritone integration (`mod/src/main/java/hermescraft/BaritoneIntegration.java`):**
- Detected at runtime via `Class.forName("baritone.BaritoneProvider")` — no compile dependency
- Commands sent as chat messages (`#goto X Y Z`, `#mine blockname`, `#stop`) via `sendBaritoneCommand`
- `navigate` and `mine` agent actions route through this

## Minecraft Wiki API

**External HTTP call in `agent/index.js` (`handleWikiLookup`):**
- URL: `https://minecraft.wiki/api.php` (MediaWiki action API)
- Calls: `action=query&prop=extracts&exintro=true&explaintext=true&exchars=600` for page summaries
- Fallback: `action=opensearch` for search suggestions if page not found
- Timeout: 8s for page lookup, 5s for search
- Invoked only when LLM calls the `wiki` tool

## Memory / Skill / Context Data Flows

### L1: Conversation History
- **Storage:** In-memory `conversationHistory[]` array in `agent/llm.js`
- **Persistence:** Written to `<dataDir>/history.json` on every `periodicSave()` call (every 20 ticks)
- **Restoration:** Loaded in `loadMemory()` → `setConversationHistory()` on startup
- **Trim:** `trimHistoryGraduated(0.25)` removes oldest 25% of rounds on context overflow; hard cap at `MAX_HISTORY` (default 90 messages)
- **Wipe triggers:** On death, on phase transition, on stuck detection (8 ticks same position)

### L2: Curated Memory (MEMORY.md)
- **Storage:** `<dataDir>/MEMORY.md` — three sections: `## Lessons`, `## Strategies`, `## World Knowledge`
- **Write paths:**
  - `recordDeath()` in `agent/memory.js` — appends lesson (max 20, deduplicated by cause+countermeasure)
  - `recordPhaseComplete()` — appends strategy (one per phase name)
  - `addWorldKnowledge()` — appends world fact (max 10)
  - `saveMemory()` — triggered after any of the above
- **Read path:** `getMemoryForPrompt()` returns last 7 lessons + last 5 strategies + last 5 world knowledge items as formatted string
- **Injection:** `memoryText` param → `buildSystemPrompt()` → `\nLessons from past experience:\n${memoryText}` section of system prompt
- **Restoration:** `loadMemory()` → `parseMemoryMd()` parses the three sections on startup

### L3: Session Transcripts
- **Storage:** `<dataDir>/sessions/session-<ISO-timestamp>.jsonl` — one file per process start
- **Write path:** `writeSessionEntry()` appends JSONL records on every tick, death, and phase completion
- **Pruning:** `pruneSessionLogs()` keeps only the last 10 files
- **Not injected into prompts** — analytics / debugging only

### Stats
- **Storage:** `<dataDir>/stats.json` — `totalDeaths`, `totalActions`, `sessionsPlayed`, `highestPhase`, `totalPlayTimeMs`
- **Write path:** `saveStats()` after deaths, phase completions, and `periodicSave()`
- **Displayed in:** `getSessionStats()` → `logSessionStats()` terminal output every 20 ticks

### L4: Skills (agentskills.io format)
- **Shared seed skills directory:** `agent/skills/<slug>/SKILL.md` — read-only fallbacks shipped in repo
- **Per-agent skills directory:** `<dataDir>/skills/<slug>/SKILL.md` — agent-generated, takes precedence over seed
- **SKILL.md format:** YAML frontmatter (`name`, `description`, `metadata.phase`, `metadata.success_rate`, `metadata.deaths_before_mastery`) + markdown body (`## Strategy`, `## Tips`, `## Lessons Learned`, `## Key Actions Used`)
- **Auto-creation trigger:** In `agent/index.js` tick loop, when `checkPhaseTransition()` returns `transitioned: true` AND `transition.to.id > currentPhase.id` (forward progress only). Calls `createSkillFromPhase(currentPhase, actionHistory, deathCount, lessonsLearned)` in `agent/skills.js`
- **Create path:** `createSkillFromPhase()` → builds `SKILL.md` from phase objectives/tips + `extractKeyActions(actionHistory)` + current lessons → writes to `<dataDir>/skills/<slug>/SKILL.md` → calls `loadSkills()` to reload
- **Update path:** If skill file exists, `updateSkill()` appends new lessons (deduplicated) and updates `deaths_before_mastery` metadata
- **Success rate tracking:** `recordSkillOutcome(phase, success)` ±0.1 per outcome, clamped 0–1
- **Retrieval / scoring (`getActiveSkill()`):** Multi-signal scoring per skill:
  - +100 if `skill.phase === phase.id` (phased mode)
  - +30 per matched keyword category between goal text and skill text (directed mode)
  - +50 if health < 10 and skill is combat/survival
  - +20 if night time and skill is first-night/survival
  - +0–5 for success_rate tiebreaker
- **Injection:** Top-scored skill body + one general skill (phase=0) → `activeSkill` param → `buildSystemPrompt()` → `\nLearned strategy:\n${activeSkill}` in system prompt every tick

### Pinned Context Documents
- **Storage:** `<dataDir>/context/*.md|txt|json` — up to 5 files, 8000 chars each
- **Write path (agent tool):** `save_context` tool → `handleSaveContext()` in `agent/index.js` → writes file → returns confirmation; directory traversal sanitized
- **Delete path:** `delete_context` tool → `handleDeleteContext()`
- **Read path:** `loadPinnedContext(dataDir)` in `agent/prompt.js` — reads all `.md/.txt/.json` in `context/` alphabetically, truncates each at 8000 chars
- **Injection:** `pinnedContext` param → `buildSystemPrompt()` → `\n== PINNED CONTEXT (always available) ==\n${pinnedContext}` — injected into EVERY system prompt, survives all history wipes

### Task Plan State
- **Storage:** `<dataDir>/tasks.json` — `{goal, createdAt, subtasks: [{index, text, status, note, retry_count, max_retries, expected_outcome}]}`
- **Status values:** `pending`, `in-progress`, `done`, `failed`, `blocked`, `reviewing`
- **Write path:** `plan_task` tool → `handlePlanTask()` → `saveTaskState()` ; `update_task` tool → `handleUpdateTask()` → `saveTaskState()`
- **Auto-advance:** When a subtask moves to `done`, the next `pending` subtask is automatically set to `in-progress`
- **Self-review loop:** When `update_task` is called with `status: 'done'` AND `expected_outcome` is provided:
  1. Subtask set to `status: 'reviewing'`
  2. `pendingReview = { index, expected_outcome, reviewTick: tickCount + 1 }` stored in memory
  3. On the next tick, `reviewSubtaskOutcome(state)` runs keyword checks against live game state:
     - Inventory check: parses `"have <item>"` / `"in inventory"` patterns
     - Position check: parses `"at X,Y,Z"` / `"near X,Y,Z"` patterns (5-block tolerance)
     - Health check: parses `"health above N"` patterns
  4. Pass → subtask `done`, auto-advance; Fail → subtask `in-progress` (retry), increments `retry_count`; blocked after `max_retries` (default 2)
- **Injection:** `loadTaskState()` called each tick → `taskProgress` → `buildUserMessage()` → `== TASK PLAN ==` section showing goal, progress count, all subtasks with status markers and review results

### Notepad
- **Storage:** `<dataDir>/notepad.txt` — single free-text scratch file, max 2000 chars displayed
- **Write path:** `notepad` tool with `action: 'write'`
- **Read path:** `readNotepad()` called each tick → `notepadContent` → `buildUserMessage()` → `== YOUR NOTEPAD ==` section

### Social Memory (Players)
- **Storage:** `<dataDir>/players.json` — keyed by player name, includes `first_met`, `interactions[]`, `sentiment` (-10 to +10), `relationship`
- **Write path:** `trackPlayer()` called when player entities detected nearby or chat messages received; `savePlayers()` every 20 ticks
- **Injection:** `getPlayersForPrompt(nearbyEntities)` returns known/nearby players with relationship + last chat → included in `fullMemoryText` → system prompt `memoryText`

### Named Locations
- **Storage:** `<dataDir>/locations.json` — keyed by name (`bed`, `storage`, custom), with coordinates and type
- **Auto-detection:** `autoDetectLocations(state)` checks `nearbyBlocks` for beds and chests each tick; saves first instance of each type
- **Injection:** `getLocationsForPrompt()` → included in `fullMemoryText` → system prompt `memoryText`

## System Prompt Assembly (full injection order)

Every tick, `buildSystemPrompt()` in `agent/prompt.js` assembles:
1. Agent identity (from `SOUL-<name>.md` or `DEFAULT_IDENTITY` string)
2. `GAMEPLAY_INSTRUCTIONS` (hardcoded Minecraft action guide)
3. Phase objectives + tips (phased mode only) OR goal text (directed mode)
4. `Learned strategy:` — active skill content (`activeSkill`)
5. `Lessons from past experience:` — L2 memory + social + location text (`memoryText`)
6. Death count warning (if >0)
7. `== PINNED CONTEXT (always available) ==` — pinned context docs (`pinnedContext`)

User message (per tick) from `buildUserMessage()`:
1. `== USER INSTRUCTION ==` (if present)
2. `== TASK PLAN ==` with subtask progress (if plan exists)
3. `== REVIEW PASSED/FAILED ==` (if review just completed)
4. `== YOUR NOTEPAD ==`
5. `== PROGRESS ==` (phased mode itemized progress)
6. Last action failure (if any)
7. `== GAME STATE ==` (state summary string)
8. `== RECENT ACTIONS ==` (last 6 actions)
9. Stuck warning (if stuck detected)

## Persona / Soul System

- Each agent loads a `SOUL-<name>.md` file from project root as identity/personality
- Resolution order: `AGENT_SOUL` env var → `SOUL-<AGENT_NAME>.md` → `SOUL-minecraft.md`
- Personas available: `SOUL-steve.md`, `SOUL-alex.md`, `SOUL-anthony.md`, `SOUL-jeffrey.md`, `SOUL-john.md`, `SOUL-minecraft.md`
- Content replaces `DEFAULT_IDENTITY` as the first section of the system prompt

## CI/CD & Deployment

**Local / single-agent:**
- `start.sh` or `npm run agent` — launches Node.js agent process
- `hermescraft.sh` — wraps Claude Code CLI invocation (legacy)

**Multi-agent (Glass server):**
- `launch-agents.sh` — spins up N bots (default 10) in a tmux session `hermescraft-bots`
- Each bot: dedicated Xvfb display, MC client, HermesBridge port, Node.js agent process
- `launch-client.sh` — launches a single MC client with Xvfb

## Environment Variables Summary

| Variable | Default | Used In |
|----------|---------|---------|
| `VLLM_URL` | `http://localhost:8000/v1` | `agent/llm.js` |
| `MODEL_NAME` | `Doradus/Hermes-4.3-36B-FP8` | `agent/llm.js` |
| `VLLM_API_KEY` / `ANTHROPIC_API_KEY` | `not-needed` | `agent/llm.js` |
| `MOD_URL` | `http://localhost:3001` | `agent/state.js`, `agent/actions.js` |
| `TICK_MS` | `2000` | `agent/index.js` |
| `MAX_TOKENS` | `384` | `agent/llm.js` |
| `MAX_HISTORY` | `90` | `agent/llm.js` |
| `TEMPERATURE` | `0.6` | `agent/llm.js` |
| `AGENT_NAME` | `hermes` | `agent/config.js` |
| `AGENT_MODE` | `phased` | `agent/config.js`, `agent/goals.js` |
| `AGENT_SOUL` | (auto) | `agent/config.js` |
| `AGENT_GOAL` | `null` | `agent/config.js`, `agent/goals.js` |
| `MC_USERNAME` | `Steve` | `agent/index.js` (chat dedup) |
| `HERMESCRAFT_PORT` | `3001` | mod `HermesBridgeMod.java` |
| `HERMESCRAFT_SERVER` | `localhost:25565` | mod `HermesBridgeMod.java` |

---

*Integration audit: 2026-03-20*
