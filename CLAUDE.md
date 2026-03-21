<!-- GSD:project-start source:PROJECT.md -->
## Project

**HermesCraft Agent Hardening & Workflow Overhaul**

HermesCraft is a Minecraft AI agent system: a Node.js agent loop talks to an LLM (Hermes 4.3 via vLLM/LiteLLM) and controls a Minecraft client via a Fabric mod's HTTP bridge. The agent observes game state, reasons about what to do, and executes actions in a tick loop. This milestone focuses on fixing critical bugs in the memory/compression system and building a proper plan→execute→review workflow so the agent can handle complex multi-step tasks reliably.

**Core Value:** The agent must never silently lose its execution context — and when given a complex task, it must plan, execute, and review its own work instead of fire-and-forget.

### Constraints

- **Tick budget**: Agent tick runs every 2s. Planning/review must be lightweight enough to not starve the game loop. Consider async/background processing for heavy work.
- **Token budget**: System prompt + user message + history must fit in the model's context window. Pinned context is already capped at 5 files × 8000 chars.
- **LLM latency**: vLLM with Hermes 4.3 36B at FP8. First call ~2s uncached, subsequent ~0.5-1s. Can't afford multiple LLM calls per tick for review.
- **Mod stability**: Java mod changes require rebuild and Minecraft restart. Minimize mod changes.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- JavaScript (ES Modules) - Node.js agent (`agent/`)
- Java 21 - Minecraft Fabric mod (`mod/`)
- Bash - Launch scripts (`hermescraft.sh`, `launch-agents.sh`, `launch-client.sh`)
- Python 3 - Used inline in scripts for YAML manipulation and classpath building
## Runtime
- Node.js (ESM — `"type": "module"` in `package.json`)
- Java 21+ (required by `fabric.mod.json`)
- npm
- Lockfile: `package-lock.json` present
## Frameworks
- No framework — pure Node.js ESM with native `fetch` (no node-fetch)
- `openai` ^4.0.0 — OpenAI-compatible client pointed at vLLM or any OpenAI-compat endpoint
- `mineflayer` ^4.35.0 — Listed as dependency but NOT used by the custom agent (`agent/index.js`). Present for potential future use or alternative bot mode.
- `ws` ^8.16.0 — WebSocket library; listed but not actively used in current agent code
- Minecraft Fabric `1.21.1` — client-side mod framework
- `com.google.gson` — JSON serialization (bundled with Minecraft, no explicit dep)
- `com.sun.net.httpserver` — JDK built-in HTTP server (no external lib)
- Baritone — pathfinding mod loaded at runtime via reflection; no compile-time dependency
- Gradle with `fabric-loom` plugin `1.8-SNAPSHOT`
- `processResources` expands version into `fabric.mod.json`
- Access widener: `src/main/resources/hermescraft.accesswidener`
- No test framework detected
## Key Dependencies
- `openai` ^4.0.0 — Powers all LLM calls via OpenAI-compatible API. Used in `agent/llm.js`. Configured to point at local vLLM or any remote endpoint via `VLLM_URL`.
- Baritone mod (runtime) — Provides all pathfinding (`#goto`, `#mine`, `#stop` chat commands). Without it, navigation and mining actions silently fail. Integration in `mod/src/main/java/hermescraft/BaritoneIntegration.java`.
- `mineflayer` ^4.35.0 — Declared but inactive; may be vestigial from earlier design
- `ws` ^8.16.0 — Declared but not imported in current agent code
## Configuration
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
- `.env.example` — Documents all env vars; actual `.env` is gitignored
- `mod/build.gradle` — Gradle build configuration
- `mod/src/main/resources/fabric.mod.json` — Mod manifest (environment, entrypoints, dependencies)
- `mod/src/main/resources/hermescraft.accesswidener` — Fabric access widener for MC internals
## Platform Requirements
- Node.js with ESM support
- Java 21+ for mod compilation
- Gradle (via `./gradlew`) for mod builds
- Minecraft 1.21.1 installed with Fabric Loader + Baritone mod present in `~/.minecraft/mods/`
- `Xvfb` — Virtual framebuffer for headless MC client display per bot
- `tmux` — Session management for multi-agent coordination (`launch-agents.sh`)
- `docker` — Minecraft server runs in container (`minecraft-server` container referenced in `launch-agents.sh`)
- Python 3 — Required by `hermescraft.sh` for YAML config manipulation (PyYAML)
- `hermes` CLI — Optional alternate launch path via `hermescraft.sh` using NousResearch Hermes Agent CLI
- Minecraft 1.21.1 vanilla client installed
- Fabric Loader 0.16.9+ installed for the target MC version
- Baritone standalone jar in `~/.minecraft/mods/`
- HermesBridge mod jar in `~/.minecraft/mods/` (built from `mod/`)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Flat `camelCase.js` in `agent/` — no subdirectories except `data/`, `skills/`
- SOUL files: `SOUL-<agentname>.md` at project root
- Skill files: `agent/skills/<kebab-name>/SKILL.md`
- Data files: `agent/data/<agentname>/` with `MEMORY.md`, `stats.json`, `notepad.txt`
- Exported functions: `camelCase` — `buildSystemPrompt`, `queryLLM`, `executeAction`
- Internal helpers: `camelCase` — `trimHistory`, `parseResponseFallback`, `handleNotepad`
- Init pattern: always named `init<Subsystem>` — `initMemory`, `initSkills`, `initSocial`, `initLocations`
- Log functions: `log<Event>` — `logError`, `logReasoning`, `logDeathBanner`, `logPhaseChange`
- Boolean checks: `is<Condition>` — `isContextOverflowError`, `isToolCallingUnsupported`, `isToolCallingEnabled`
- Record/track operations: `record<Event>` — `recordDeath`, `recordPhaseComplete`, `recordAction`, `recordSkillOutcome`
- Module-level mutable state: lowercase with leading `_` for "private" agent globals (`_agentConfig`), or plain lowercase for non-exported module state
- Constants: `SCREAMING_SNAKE_CASE` — `MAX_RETRIES`, `TICK_INTERVAL`, `MOD_URL`, `VALID_ACTIONS`
- Sets used as lookup tables: `SCREAMING_SNAKE_CASE` Set — `VALID_ACTIONS`, `INFO_ACTIONS`, `SUSTAINED_ACTIONS`, `HOSTILE_MOBS`
- Named exports only — no default exports across any module
- Config objects passed by reference (agentConfig) from `loadAgentConfig()` into every `init*` function
## Code Style
- No formatter config detected (no `.prettierrc`, `biome.json`, or eslint config)
- 2-space indent throughout
- Single quotes for strings
- Semicolons absent — no-semi style
- Trailing commas in multiline object/array literals
- ES Modules throughout (`"type": "module"` in `package.json`)
- `import.meta.url` + `fileURLToPath` to get `__dirname` equivalent in every file that needs it
- Dynamic imports not used — all static at module top
- Every file begins with a one-line comment: `// filename.js — Purpose description`
- Key architectural decisions documented inline above the code they affect
## Import Organization
## Error Handling
- **Global crash handlers** registered in `agent/index.js`:
- **Silent catch for non-critical ops** — filesystem writes, external fetches where failure is acceptable:
- **Structured error classification** in `agent/llm.js` — errors are categorized before handling:
- **Action failures are non-fatal** — `executeAction` returns `{ success: false, error: '...' }` instead of throwing; callers check `result.success`
- **HTTP errors** normalized: `fetch` non-ok responses return `{ success: false, error: 'HTTP 404: ...' }`, never throw
- **JSON parse failures** silently ignored with empty fallback in tool argument parsing:
## LLM Error Handling (Critical Path)
## Prompt Engineering Patterns
### System Prompt Construction (`agent/prompt.js`)
### User Message Construction (`agent/prompt.js`)
### Tool Design (`agent/tools.js`)
- All tools have a `reason` field injected programmatically post-definition:
- Tool descriptions are highly compressed action-oriented directives, not explanations
- `wait` is intentionally absent from GAME_TOOLS: "Never call 'wait' — it doesn't exist"
- Tool calling is set to `tool_choice: 'required'` — the model MUST call a tool every turn
### Response Parsing Cascade (`agent/llm.js` `parseResponseFallback`)
## Output Quality Mechanisms
## Auto-Review / Self-Evaluation Loops
- **Notepad** — the agent can call `notepad(action='read')` to inspect its own plan, then `notepad(action='write')` to revise it. This is the only mechanism for intra-session self-evaluation.
- **Death memory** — `generateCountermeasure` in `agent/memory.js` generates rule-based tactical advice from death context. Injected into future prompts as "Lessons learned."
- **Skill update** — when a phase completes (or fails via death), `updateSkill` appends new lessons to the `SKILL.md`. On the next session, improved guidance appears in the system prompt.
- **Progress detail** — Done/TODO checklist in every user message gives the model a compact self-assessment view.
## Logging
- Reasoning text wrapped at 85 chars with `│` gutter indicator
- Health/food bars rendered as Unicode heart/drumstick symbols
- Rich death banner with box-drawing characters
- All log functions exported from `logger.js` — no direct `console.log` in business logic files except `index.js`
## Module Design
- `agent/llm.js` owns `conversationHistory`, `useToolCalling`, `toolCallingFailures`
- `agent/memory.js` owns `memory`, `stats`, `sessionLogFile`
- `agent/skills.js` owns `skills[]`
- `agent/goals.js` owns `agentMode`, `agentGoal`, `customGoal`
## Comments
- Module header: one-line purpose description
- Non-obvious decisions: inline comment above the code block
- Architecture callouts: `// ── Section Name ──` dividers group related functions within a file
- Workarounds: explicit notes on why (e.g., `// Anthropic API rejects temperature + top_p together`)
- TODO-style: not present — issues tracked in `.hermes.md`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Tick-based polling loop (default 2000ms) — agent observes world state every tick and picks one action
- No explicit plan→execute→review cycle; instead the LLM writes free-form reasoning in `<think>` tags and the agent uses a persistent notepad tool as a scratchpad/plan that survives ticks
- Memory is four-tiered: L1 session conversation history (in-memory), L2 curated MEMORY.md (lessons/strategies), L3 session JSONL transcripts, L4 agentskills.io SKILL.md files
- The agent is fully stateless between sessions except for file-backed memory; crash recovery is built in via global unhandledRejection/uncaughtException handlers
## Layers
- Purpose: Bridge between the Minecraft client and the Node.js agent
- Location: `mod/src/main/java/hermescraft/`
- Contains: HTTP server, state reader, action executor, Baritone integration, chat capture
- Depends on: Minecraft Fabric API, Baritone (optional), Gson
- Used by: Node.js agent via HTTP
- Purpose: LLM-driven controller that observes game state and issues actions
- Location: `agent/`
- Contains: tick loop, prompt builder, LLM client, memory, skills, goals, social, locations, logger
- Depends on: Java mod HTTP API at `MOD_URL` (default `http://localhost:3001`), vLLM endpoint at `VLLM_URL`
- Used by: Launch scripts (`start.sh`, `launch-agents.sh`)
- Purpose: Inference endpoint for the Hermes model (or compatible OpenAI-API model)
- Location: External process; configured via `VLLM_URL` and `MODEL_NAME` env vars
- Contains: OpenAI-compatible `/v1/chat/completions` endpoint
- Depends on: GPU host (local or remote RunPod)
- Used by: `agent/llm.js`
## Data Flow
- After dispatching a sustained action, `tick()` immediately fires another `queryLLM()` call with the instruction "current action X is running in background, plan your NEXT action"
- The pre-computed response is stored in `pendingAction` and consumed by the very next tick, skipping the LLM call entirely
## Key Abstractions
- Purpose: Controls what goal/phase system is active
- Values: `phased` (7-phase Ender Dragon quest), `open_ended` (no objectives), `directed` (user-supplied goal string)
- Config: `AGENT_MODE` env var, loaded in `agent/config.js`
- Used by: `agent/goals.js`, `agent/prompt.js`
- Purpose: Named milestone with inventory-based completion detection
- Examples: Phase 1 "First Night", Phase 4 "Nether", Phase 7 "Dragon Fight"
- Files: `agent/goals.js` — `PHASES` array, each with `completionCheck(state)` and `progress(state)` functions
- Pattern: Completion is deterministic (inventory check); progress is a score 0-100
- Purpose: Persona definition — the system prompt identity section
- Files: `SOUL-minecraft.md`, `SOUL-steve.md`, `SOUL-alex.md`
- Loading: `agent/config.js` tries `SOUL-{AGENT_NAME}.md`, then `SOUL-minecraft.md` as fallback
- Injected by: `buildSystemPrompt()` as the first element in the system prompt
- Purpose: Procedural memory for a completed phase — agentskills.io format with YAML frontmatter
- Files: `agent/skills/minecraft-*/SKILL.md` (shared seed skills), `agent/data/{name}/skills/*/SKILL.md` (per-agent learned)
- Pattern: Created by `createSkillFromPhase()` on phase completion; updated with new lessons on subsequent completions; injected into system prompt as "Learned strategy"
- Success rate tracked in metadata and updated ±0.1 per outcome
- Purpose: Rolling context window passed to LLM on every tick
- Location: In-memory `conversationHistory` array in `agent/llm.js`
- Bound: `MAX_HISTORY_MESSAGES` (default 90 ≈ 30 rounds)
- Trimming: Graduated removal of oldest 25% on context overflow; full wipe on death/phase-change/stuck; corrupt tool call entries filtered before storage
- Purpose: Persistent single-file scratchpad the agent reads/writes across ticks; survives conversation wipes
- File: `agent/data/{name}/notepad.txt`
- Access: Via `notepad` tool (`action: read|write`) — displayed in every user message
- Max chars: 2000 before truncation in prompt
- Purpose: Long-lived planning documents injected into system prompt every tick, surviving all history wipes
- Location: `agent/data/{name}/context/*.{md,txt,json}` (up to 5 files, 8000 chars each)
- Use case: Wave execution plans, long-lived task lists, role/quest instructions
- Purpose: Stuck detection — if the same action key fails `MAX_STUCK_COUNT` (2) times, trigger recovery
- Location: `failureTracker` Map in `agent/index.js`
- Recovery: Stop Baritone, clear conversation, reset navigation flag
## Entry Points
- Location: `agent/index.js` `main()`
- Triggers: `node agent/index.js` or `npm run agent`
- Responsibilities: Load config, init subsystems, disable Baritone overlays, start tick loop
- Location: `launch-agents.sh`
- Triggers: `./launch-agents.sh [num_bots]` (default 10)
- Responsibilities: For each bot — launch Xvfb virtual display, launch Minecraft client with unique HermesBridge port, wait for bridge health check, start Node.js agent process with auto-restart. All managed in tmux session `hermescraft-bots`.
- Agent isolation: Each agent gets unique `AGENT_NAME`, `MC_USERNAME`, `MOD_URL` (port 3001+N), separate `agent/data/{name}/` directory
- Location: `mod/src/main/java/hermescraft/HermesBridgeMod.java` `onInitializeClient()`
- Triggers: Fabric mod loader on client start
- Responsibilities: Start HTTP server, register chat message listeners, register tick event for action processing and state caching, auto-connect to server
## Error Handling
- LLM failures: 3 retries with exponential backoff; context overflow triggers graduated history trimming (25% at a time); corrupt tool calls trigger full history wipe
- Action failures: Logged to actionHistory; failure counter incremented; craft/smelt failure closes screen to prevent stuck grid
- Stuck detection: After 2 failures on same action key, stops Baritone, clears conversation; after 8 ticks with no position change, same recovery
- Death: Clears conversation, records lesson, waits 5 seconds before resuming tick loop
- Crash recovery: `uncaughtException` handler calls `periodicSave()` and continues — does not exit
- Mod side: All HTTP handlers return JSON errors on exception; `getStateFresh()` falls back to cached state on timeout
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
