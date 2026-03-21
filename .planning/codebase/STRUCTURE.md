# Codebase Structure

**Analysis Date:** 2026-03-20

## Directory Layout

```
hermescraft/
├── agent/                    # Node.js AI agent (the brain)
│   ├── index.js              # Main tick loop, plan/review handlers, entry point
│   ├── actions.js            # Action validation + mod API dispatch
│   ├── config.js             # Agent config loader (env vars, SOUL file)
│   ├── goals.js              # 7-phase Ender Dragon progression + open/directed modes
│   ├── llm.js                # vLLM client, conversation history (L1 memory)
│   ├── locations.js          # Named location memory (auto-detected + persisted)
│   ├── logger.js             # Rich terminal output (colors, banners, stats)
│   ├── memory.js             # L2 curated memory (MEMORY.md), L3 sessions, stats
│   ├── prompt.js             # System prompt + user message builders
│   ├── skills.js             # L4 procedural memory (agentskills.io SKILL.md format)
│   ├── social.js             # Player relationship tracking (sentiment scoring)
│   ├── state.js              # fetchState(), summarizeState(), detectDeath()
│   ├── tools.js              # OpenAI tool schema array (GAME_TOOLS)
│   ├── data/                 # Per-agent persistent state (gitignored)
│   │   ├── hermes/           # Default agent data
│   │   │   ├── MEMORY.md     # L2 lessons + strategies + world knowledge
│   │   │   ├── stats.json    # Death count, action count, highest phase, sessions
│   │   │   ├── history.json  # Saved L1 conversation history (restored on startup)
│   │   │   ├── notepad.txt   # Agent's writable scratchpad
│   │   │   ├── tasks.json    # Active task plan (plan_task / update_task state)
│   │   │   ├── players.json  # Social memory (sentiment, interactions)
│   │   │   ├── locations.json# Named world locations (bed, storage, etc.)
│   │   │   ├── context/      # Pinned context docs (save_context tool output)
│   │   │   │   └── *.md      # Injected verbatim into system prompt every tick
│   │   │   ├── sessions/     # L3 session transcripts
│   │   │   │   └── session-*.jsonl
│   │   │   └── skills/       # Agent-specific learned skills (SKILL.md)
│   │   └── Steve/            # Second agent data (same layout as hermes/)
│   └── skills/               # Seed skills (read-only, shared across all agents)
│       ├── minecraft-first-night/SKILL.md
│       ├── minecraft-iron-age/SKILL.md
│       ├── minecraft-diamonds/SKILL.md
│       ├── minecraft-nether/SKILL.md
│       ├── minecraft-blaze-rods/SKILL.md
│       ├── minecraft-ender-pearls/SKILL.md
│       ├── minecraft-dragon-fight/SKILL.md
│       ├── minecraft-combat-survival/SKILL.md
│       └── minecraft-resource-gathering/SKILL.md
├── mod/                      # Fabric mod (Java — the eyes and hands)
│   └── src/main/java/hermescraft/
│       ├── HermesBridgeMod.java   # Mod entry point, chat capture, tick handler
│       ├── HttpServer.java        # HTTP API routes (/health /state /action /chat /recipes)
│       ├── StateReader.java       # Game state serialization to JSON
│       ├── ActionExecutor.java    # Action dispatch to Baritone + direct MC calls
│       ├── BaritoneIntegration.java
│       └── RecipeLookup.java
├── mcp-server/               # MCP server (unused in main flow)
├── .planning/                # GSD planning artifacts
│   ├── codebase/             # This document's home
│   ├── phases/               # Implementation phase plans
│   └── research/
├── SOUL-*.md                 # Agent persona files (Steve, Alex, etc.)
├── SOUL-minecraft.md         # Default persona (no custom SOUL)
├── launch-agents.sh          # Multi-agent tmux launcher (N bots, port assignment)
├── launch-client.sh          # Single Minecraft client launcher (Xvfb + Fabric)
├── start.sh                  # Single-bot launcher (dev/local)
├── steve-start.sh            # Steve-persona single-bot launcher
├── hermescraft.sh            # Original launch script
├── vllm.sh                   # vLLM server startup helper
├── package.json              # Node.js project (type: module, entry: agent/index.js)
└── .env / .env.example       # Environment configuration (never read contents)
```

## Directory Purposes

**`agent/`:**
- Purpose: All Node.js agent code
- Contains: 13 JS modules, `data/` directory for runtime state, `skills/` for seed skills
- Key files: `index.js` (entry + tick loop), `tools.js` (LLM tool schemas), `actions.js` (validation + dispatch)

**`agent/data/<AGENT_NAME>/`:**
- Purpose: Complete per-agent isolation of all persistent state
- Created by: `config.js:loadAgentConfig()` on first run via `mkdirSync(..., {recursive: true})`
- Name comes from: `AGENT_NAME` env var (default: `hermes`)
- Contains: MEMORY.md, stats.json, history.json, notepad.txt, tasks.json, players.json, locations.json, `context/`, `sessions/`, `skills/`

**`agent/data/<AGENT_NAME>/context/`:**
- Purpose: Pinned context files written by `save_context` tool; injected verbatim into system prompt every tick, surviving all conversation history wipes
- Limits: max 5 files, max 8000 chars each, extensions `.md`, `.txt`, `.json` only
- Key property: The only agent-writable storage that persists through `clearConversation()` calls

**`agent/skills/` (shared seed skills):**
- Purpose: Read-only fallback skills for all agents; agent-specific skills in `<dataDir>/skills/` take precedence
- Format: `<skill-name>/SKILL.md` with YAML frontmatter

**`mod/src/main/java/hermescraft/`:**
- Purpose: Fabric client mod; provides the HTTP bridge between game and agent
- Contains: 6 Java files
- Build output: `mod/build/libs/`

**`.planning/`:**
- Purpose: GSD planning artifacts; not committed to main workflow
- Generated: No — manually maintained
- Contains: `codebase/` (this dir), `phases/` (implementation plans per phase), `research/`

## Key File Locations

**Entry Points:**
- `agent/index.js` — `main()` at line 969; starts the agent process
- `mod/src/main/java/hermescraft/HermesBridgeMod.java` — `onInitializeClient()`; Fabric mod entry

**Configuration:**
- `agent/config.js` — reads env vars, resolves SOUL file, sets `dataDir`
- `.env` — local environment variables (VLLM_URL, VLLM_API_KEY, MOD_URL, AGENT_NAME, AGENT_MODE, etc.)
- `.env.example` — documents all supported env vars

**Core Logic:**
- `agent/index.js` — tick loop (line 470), `reviewSubtaskOutcome` (line 294), `handlePlanTask` (line 208), `handleUpdateTask` (line 232), pre-execution validation gate (line 803–821)
- `agent/actions.js` — `validatePreExecution` (line 82), `executeAction` (line 196)
- `agent/llm.js` — `queryLLM` (line 153), `completeToolCall` (line 110)
- `agent/prompt.js` — `buildSystemPrompt` (line 68), `buildUserMessage` (line 121), `loadPinnedContext` (line 16)
- `mod/src/main/java/hermescraft/StateReader.java` — `buildState()` (line 113); authoritative game state

**Testing:**
- `agent/tests/` — test directory exists; contents not populated

## Naming Conventions

**Files:**
- Agent modules: camelCase (`index.js`, `actions.js`, `llm.js`)
- Java classes: PascalCase (`HermesBridgeMod.java`, `StateReader.java`)
- SOUL files: `SOUL-<name>.md` (e.g., `SOUL-steve.md`, `SOUL-alex.md`)
- Skill packages: `minecraft-<topic>/SKILL.md` (kebab-case)
- Session logs: `session-<ISO-timestamp>.jsonl`

**Directories:**
- Per-agent data: `agent/data/<AGENT_NAME>/` where `AGENT_NAME` matches `MC_USERNAME` (e.g., `Steve`, `hermes`)
- Shared skills: `agent/skills/<skill-name>/`

## Where to Add New Code

**New INFO action (tool that returns data without touching mod API):**
1. Add tool schema to `agent/tools.js` in `GAME_TOOLS`
2. Add action name to `INFO_ACTIONS` Set in `agent/actions.js`
3. Add schema validator to `ACTION_SCHEMAS` in `agent/actions.js`
4. Add handler function in `agent/index.js` (near line 827, follow the `if (actionType === 'plan_task')` pattern)
5. Inject result into user message via `buildUserMessage` in `agent/prompt.js` if it needs persistent display

**New game action (dispatched to mod API):**
1. Add tool schema to `agent/tools.js`
2. Add action name to `VALID_ACTIONS` Set in `agent/actions.js`
3. Add schema validator to `ACTION_SCHEMAS`
4. Optionally add feasibility check in `validatePreExecution` switch block
5. Implement Java handler in `mod/src/main/java/hermescraft/ActionExecutor.java`

**New per-agent persistent file:**
1. Declare the file path variable near line 17 in `agent/memory.js` (or in the relevant subsystem module)
2. Set path in the subsystem's `init*` function using `agentConfig.dataDir`
3. Read/write using standard `fs` functions — no shared state, each agent instance has its own path

**New agent persona:**
1. Create `SOUL-<name>.md` at project root with the character's voice/backstory
2. Launch with `AGENT_NAME=<name> AGENT_SOUL=/path/to/SOUL-<name>.md node agent/index.js`
3. Per-agent data dir is auto-created at `agent/data/<name>/`

**New seed skill:**
1. Create `agent/skills/<skill-name>/SKILL.md` with YAML frontmatter (`name`, `phase`, `tags`, `success_rate`)
2. Skill is auto-loaded on agent startup; agent-specific skills in `<dataDir>/skills/` take precedence

## Special Directories

**`agent/data/`:**
- Purpose: Runtime state for all agent instances; fully isolated per AGENT_NAME
- Generated: Yes — created by `config.js` on first run
- Committed: No (in `.gitignore`)

**`mod/build/`:**
- Purpose: Gradle build output for the Fabric mod
- Generated: Yes
- Committed: No

**`.planning/`:**
- Purpose: GSD phase plans and codebase analysis docs
- Generated: Partially — written by GSD commands
- Committed: Yes (planning artifacts are tracked)

## Multi-Agent Port Assignment

Each agent instance requires:
- A unique `MOD_URL` pointing to its Minecraft client's bridge port
- A unique `AGENT_NAME` (determines data isolation directory)
- A unique MC username (`MC_USERNAME`)

`launch-agents.sh` assigns:
- Bridge port: `3001 + i` (bot 0 = 3001, bot 1 = 3002, ...)
- Xvfb display: `:99 + i` (bot 0 = :99, bot 1 = :100, ...)
- Agent name / MC username: from `BOT_NAMES` array (Steve, Alex, Liam, Emma, ...)

Agents do NOT share conversation history, task state, memory, notepad, or any file-backed state. The shared-skills directory (`agent/skills/`) is read-only and safe for concurrent access.

---

*Structure analysis: 2026-03-20*
