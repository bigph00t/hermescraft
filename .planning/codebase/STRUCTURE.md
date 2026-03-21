# Codebase Structure

**Analysis Date:** 2026-03-20

## Directory Layout

```
hermescraft/
├── agent/                    # Node.js LLM agent
│   ├── index.js              # Main tick loop (entry point)
│   ├── llm.js                # LLM client + conversation memory
│   ├── prompt.js             # System prompt + user message builders
│   ├── actions.js            # Action validation + HTTP dispatch to mod
│   ├── tools.js              # OpenAI tool definitions (GAME_TOOLS)
│   ├── state.js              # Fetch + summarize game state from mod
│   ├── goals.js              # Phase system (7 phases) + 3 agent modes
│   ├── memory.js             # Multi-level memory (MEMORY.md + session JSONL)
│   ├── skills.js             # agentskills.io skill loading + creation
│   ├── social.js             # Player relationship tracking
│   ├── locations.js          # Named location memory
│   ├── config.js             # Agent config loader (name, mode, soul, dataDir)
│   ├── logger.js             # ANSI terminal output (viewer-facing)
│   ├── data/
│   │   ├── hermes/           # Default agent's persistent data
│   │   │   ├── MEMORY.md     # L2 memory: lessons, strategies, world knowledge
│   │   │   ├── stats.json    # Session counter, death count, highest phase
│   │   │   ├── notepad.txt   # Agent's persistent planning scratchpad
│   │   │   ├── players.json  # Known player relationships
│   │   │   ├── locations.json # Named locations (bed, storage, etc.)
│   │   │   ├── sessions/     # L3 session transcripts (JSONL, last 10 kept)
│   │   │   ├── skills/       # L4 learned skills (SKILL.md per phase)
│   │   │   └── context/      # Pinned context files (injected every tick)
│   │   └── Steve/            # Per-agent data directory (same layout)
│   └── skills/               # Shared seed skills (read-only fallbacks)
│       ├── minecraft-first-night/SKILL.md
│       ├── minecraft-iron-age/SKILL.md
│       ├── minecraft-diamonds/SKILL.md
│       ├── minecraft-nether/SKILL.md
│       ├── minecraft-blaze-rods/SKILL.md
│       ├── minecraft-ender-pearls/SKILL.md
│       ├── minecraft-dragon-fight/SKILL.md
│       ├── minecraft-combat-survival/SKILL.md
│       └── minecraft-resource-gathering/SKILL.md
├── mod/                      # Fabric client-side mod (Java)
│   └── src/main/java/hermescraft/
│       ├── HermesBridgeMod.java     # Mod entry point, tick events, chat capture
│       ├── HttpServer.java          # HTTP server routing (/state /action /chat /recipes /health)
│       ├── StateReader.java         # Game state reader + JSON builder
│       ├── ActionExecutor.java      # Action dispatcher (instant + sustained)
│       ├── BaritoneIntegration.java # Baritone pathfinding via chat commands
│       └── RecipeLookup.java        # Crafting recipe lookup
├── mcp-server/               # MCP server (not used in agent hot path)
├── SOUL-minecraft.md         # Default Minecraft player persona
├── SOUL-steve.md             # Steve persona (casual, social)
├── SOUL-alex.md              # Alex persona
├── .hermes.md                # Project context + Glass deployment notes
├── package.json              # Node.js project (ESM, openai + mineflayer deps)
├── launch-agents.sh          # Multi-bot launcher (tmux, Xvfb, auto-restart)
├── launch-client.sh          # Single MC client launcher
├── start.sh                  # Single agent startup script
├── steve-start.sh            # Steve agent startup shortcut
├── hermescraft.sh            # Utility script
├── vllm.sh                   # vLLM server launch script
└── .env.example              # Required environment variables
```

## Directory Purposes

**`agent/`:**
- Purpose: All Node.js agent logic — the LLM controller
- Contains: 13 source modules (all ESM), runtime data subdirectory
- Key files: `agent/index.js` (tick loop), `agent/llm.js` (LLM + memory), `agent/prompt.js` (context builder)

**`agent/data/{name}/`:**
- Purpose: Per-agent persistent state; isolated by `AGENT_NAME`
- Contains: MEMORY.md, stats.json, notepad.txt, players.json, locations.json, sessions/, skills/, context/
- Created automatically by `agent/config.js` on first run
- Note: `agent/data/hermes/` and `agent/data/Steve/` are the two committed examples

**`agent/data/{name}/context/`:**
- Purpose: Pinned context files — any `.md`, `.txt`, or `.json` placed here is injected verbatim into the system prompt every tick, surviving all history wipes
- This is the correct location for long-lived planning documents, wave execution plans, or role definitions that must outlive context resets
- Up to 5 files, 8000 chars each

**`agent/skills/`:**
- Purpose: Shared seed SKILL.md files shipped with the repo; used as read-only fallbacks when a per-agent skill doesn't exist yet
- Format: `agent/skills/{phase-name}/SKILL.md` with YAML frontmatter
- Per-agent learned skills are written to `agent/data/{name}/skills/`

**`mod/src/main/java/hermescraft/`:**
- Purpose: Fabric client mod that exposes an HTTP control plane for the agent
- Key files: `ActionExecutor.java` (handles 25+ action types including sustained multi-tick actions), `StateReader.java` (scans 16x16x16 block radius for notable blocks, reports 32-block entity radius)

## Key File Locations

**Entry Points:**
- `agent/index.js`: Node.js agent entry — `main()` at bottom, `tick()` is the hot path
- `mod/src/main/java/hermescraft/HermesBridgeMod.java`: Fabric mod entry — `onInitializeClient()`

**Configuration:**
- `.env` / `.env.example`: All runtime config — `VLLM_URL`, `MODEL_NAME`, `AGENT_NAME`, `AGENT_MODE`, `AGENT_GOAL`, `MOD_URL`, `TICK_MS`, `HERMESCRAFT_SERVER`, `HERMESCRAFT_PORT`
- `agent/config.js`: Reads env vars and resolves SOUL file path
- `agent/tools.js`: Tool schema definitions — edit here to add/remove agent capabilities

**Core Logic:**
- `agent/llm.js`: `queryLLM()` — the LLM call; `conversationHistory` — L1 memory; `completeToolCall()` — tool result injection
- `agent/prompt.js`: `buildSystemPrompt()` and `buildUserMessage()` — every token the model sees comes through here
- `agent/goals.js`: `PHASES` array with `completionCheck()` and `progress()` — the task planner
- `agent/memory.js`: `recordDeath()`, `recordPhaseComplete()`, `getMemoryForPrompt()` — L2/L3 memory

**Testing:**
- No test files detected

**Mod API:**
- `GET /state` → `StateReader.getState()` — cached JSON state (updated every 20 MC ticks)
- `POST /action` → `ActionExecutor.execute()` — dispatches to instant or sustained handler
- `GET /chat` → recent 20 chat messages as newline-delimited text
- `GET /recipes?item=X` → `RecipeLookup.lookup()`
- `GET /health` → `{"status":"ok","mod":"hermesbridge"}`

## Naming Conventions

**Files:**
- Agent JS modules: camelCase (`llm.js`, `goalSystem` → `goals.js`)
- Java classes: PascalCase (`ActionExecutor.java`, `StateReader.java`)
- SOUL/persona files: `SOUL-{name}.md` at project root
- Skill files: `minecraft-{phase-name}/SKILL.md`, directory name kebab-case

**Directories:**
- Per-agent data: `agent/data/{AgentName}/` — agent name used verbatim from `AGENT_NAME` env var
- Session logs: `agent/data/{name}/sessions/session-{ISO-timestamp}.jsonl`

**Environment Variables:**
- All caps with underscores: `VLLM_URL`, `AGENT_NAME`, `AGENT_MODE`, `MOD_URL`, `TICK_MS`

## Where to Add New Code

**New tool/action (agent capability):**
1. Add tool definition to `agent/tools.js` `GAME_TOOLS` array
2. Add action type to `VALID_ACTIONS` set and schema to `ACTION_SCHEMAS` in `agent/actions.js`
3. If it's an info action (no game state change): add to `INFO_ACTIONS` set and handle in `tick()` in `agent/index.js`
4. If it requires Java mod implementation: add handler in `ActionExecutor.java` (instant or sustained depending on duration)

**New agent mode:**
- Add to `agentMode` handling in `agent/goals.js` (`getCurrentPhase`, `getGoalName`)
- Add to `buildSystemPrompt()` conditional blocks in `agent/prompt.js`
- Add to startup banner in `agent/logger.js`

**New persona/character:**
- Create `SOUL-{name}.md` at project root
- Launch with `AGENT_NAME={name}` — config loader will find it

**New skill (seed knowledge):**
- Create `agent/skills/{skillname}/SKILL.md` with agentskills.io YAML frontmatter
- Set `metadata.phase` to target phase ID (integer string)

**New persistent context for an agent:**
- Drop a `.md` or `.txt` file in `agent/data/{name}/context/`
- It will be injected verbatim into the system prompt every tick

**New phase (goal step):**
- Add entry to `PHASES` array in `agent/goals.js`
- Implement `completionCheck(state)` and `progress(state)` functions
- Add progress detail breakdown to `getProgressDetail()` switch block

## Special Directories

**`agent/data/`:**
- Purpose: All runtime-generated agent data
- Generated: Yes (auto-created on first run)
- Committed: Partial — `hermes/` and `Steve/` example data are committed; session logs are gitignored

**`mod/build/`:**
- Purpose: Gradle build output for the Fabric mod JAR
- Generated: Yes
- Committed: No (gitignored)

**`.planning/`:**
- Purpose: GSD planning documents
- Generated: Yes (by GSD commands)
- Committed: Depends on project workflow

**`mcp-server/`:**
- Purpose: MCP server implementation (not used in agent hot path)
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-20*
