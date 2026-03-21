# Architecture

**Analysis Date:** 2026-03-20

## Pattern Overview

**Overall:** Single-agent observe-think-act loop with multi-level memory, optional multi-agent fan-out

**Key Characteristics:**
- Tick-based polling loop (default 2000ms) — agent observes world state every tick and picks one action
- No explicit plan→execute→review cycle; instead the LLM writes free-form reasoning in `<think>` tags and the agent uses a persistent notepad tool as a scratchpad/plan that survives ticks
- Memory is four-tiered: L1 session conversation history (in-memory), L2 curated MEMORY.md (lessons/strategies), L3 session JSONL transcripts, L4 agentskills.io SKILL.md files
- The agent is fully stateless between sessions except for file-backed memory; crash recovery is built in via global unhandledRejection/uncaughtException handlers

## Layers

**Fabric Mod (Java, client-side):**
- Purpose: Bridge between the Minecraft client and the Node.js agent
- Location: `mod/src/main/java/hermescraft/`
- Contains: HTTP server, state reader, action executor, Baritone integration, chat capture
- Depends on: Minecraft Fabric API, Baritone (optional), Gson
- Used by: Node.js agent via HTTP

**Node.js Agent (JavaScript, ESM):**
- Purpose: LLM-driven controller that observes game state and issues actions
- Location: `agent/`
- Contains: tick loop, prompt builder, LLM client, memory, skills, goals, social, locations, logger
- Depends on: Java mod HTTP API at `MOD_URL` (default `http://localhost:3001`), vLLM endpoint at `VLLM_URL`
- Used by: Launch scripts (`start.sh`, `launch-agents.sh`)

**vLLM / LLM Backend:**
- Purpose: Inference endpoint for the Hermes model (or compatible OpenAI-API model)
- Location: External process; configured via `VLLM_URL` and `MODEL_NAME` env vars
- Contains: OpenAI-compatible `/v1/chat/completions` endpoint
- Depends on: GPU host (local or remote RunPod)
- Used by: `agent/llm.js`

## Data Flow

**Per-Tick Observe-Think-Act:**

1. `agent/index.js` `tick()` calls `fetchState()` → `GET /state` on mod HTTP server
2. `StateReader.java` returns cached JSON (updated every 20 Minecraft ticks ≈ 1 second)
3. Agent checks for death, phase transitions, user instructions, and player chat
4. `buildSystemPrompt()` in `agent/prompt.js` assembles: persona (SOUL file) + gameplay rules + phase objectives + learned skills + MEMORY.md lessons + pinned context files
5. `buildUserMessage()` assembles: notepad content + phase progress + last action failure + game state summary + recent 6 actions + stuck warning
6. `queryLLM()` in `agent/llm.js` sends full message (system + conversation history + user message) to vLLM with `tool_choice: "required"` — model must call a tool
7. Response parsed: preferred path is OpenAI native `tool_calls`; fallback is regex parsing of `<tool_call>` XML, `REASONING:/ACTION:` text, or bare JSON
8. Action validated in `agent/actions.js` against `VALID_ACTIONS` set and per-type schema
9. Info actions (`recipes`, `wiki`, `notepad`, `read_chat`) are resolved locally and the result is injected back into conversation history via `completeToolCall()`
10. Game actions are dispatched via `POST /action` to `ActionExecutor.java`
11. Result appended to in-memory `actionHistory` (capped at 50 entries)
12. If action was a `SUSTAINED_ACTION` (`mine`, `navigate`, `break_block`), agent pipelines the next LLM call immediately while the action runs

**Pipelining (latency optimization):**
- After dispatching a sustained action, `tick()` immediately fires another `queryLLM()` call with the instruction "current action X is running in background, plan your NEXT action"
- The pre-computed response is stored in `pendingAction` and consumed by the very next tick, skipping the LLM call entirely

**Death Recovery Flow:**
1. `detectDeath()` watches for `health > 0 → health <= 0` transition
2. `recordDeath()` in `memory.js` analyzes context (nearby hostiles, time of day, armor) and generates a countermeasure lesson
3. Lesson is deduped and appended to MEMORY.md
4. `clearConversation()` wipes L1 session history for a fresh start
5. Mod auto-respawns the player every 40 MC ticks if dead

**Phase Transition Flow:**
1. `getCurrentPhase()` evaluates each phase's `completionCheck()` against current inventory/state
2. On forward transition: records strategy to MEMORY.md, generates a new SKILL.md file via `createSkillFromPhase()`
3. `clearConversation()` + `clearAllFailures()` — fresh context for new phase

## Key Abstractions

**Agent Mode:**
- Purpose: Controls what goal/phase system is active
- Values: `phased` (7-phase Ender Dragon quest), `open_ended` (no objectives), `directed` (user-supplied goal string)
- Config: `AGENT_MODE` env var, loaded in `agent/config.js`
- Used by: `agent/goals.js`, `agent/prompt.js`

**Phase:**
- Purpose: Named milestone with inventory-based completion detection
- Examples: Phase 1 "First Night", Phase 4 "Nether", Phase 7 "Dragon Fight"
- Files: `agent/goals.js` — `PHASES` array, each with `completionCheck(state)` and `progress(state)` functions
- Pattern: Completion is deterministic (inventory check); progress is a score 0-100

**SOUL File:**
- Purpose: Persona definition — the system prompt identity section
- Files: `SOUL-minecraft.md`, `SOUL-steve.md`, `SOUL-alex.md`
- Loading: `agent/config.js` tries `SOUL-{AGENT_NAME}.md`, then `SOUL-minecraft.md` as fallback
- Injected by: `buildSystemPrompt()` as the first element in the system prompt

**SKILL.md:**
- Purpose: Procedural memory for a completed phase — agentskills.io format with YAML frontmatter
- Files: `agent/skills/minecraft-*/SKILL.md` (shared seed skills), `agent/data/{name}/skills/*/SKILL.md` (per-agent learned)
- Pattern: Created by `createSkillFromPhase()` on phase completion; updated with new lessons on subsequent completions; injected into system prompt as "Learned strategy"
- Success rate tracked in metadata and updated ±0.1 per outcome

**Conversation History (L1 Memory):**
- Purpose: Rolling context window passed to LLM on every tick
- Location: In-memory `conversationHistory` array in `agent/llm.js`
- Bound: `MAX_HISTORY_MESSAGES` (default 90 ≈ 30 rounds)
- Trimming: Graduated removal of oldest 25% on context overflow; full wipe on death/phase-change/stuck; corrupt tool call entries filtered before storage

**Notepad:**
- Purpose: Persistent single-file scratchpad the agent reads/writes across ticks; survives conversation wipes
- File: `agent/data/{name}/notepad.txt`
- Access: Via `notepad` tool (`action: read|write`) — displayed in every user message
- Max chars: 2000 before truncation in prompt

**Pinned Context:**
- Purpose: Long-lived planning documents injected into system prompt every tick, surviving all history wipes
- Location: `agent/data/{name}/context/*.{md,txt,json}` (up to 5 files, 8000 chars each)
- Use case: Wave execution plans, long-lived task lists, role/quest instructions

**Failure Tracker:**
- Purpose: Stuck detection — if the same action key fails `MAX_STUCK_COUNT` (2) times, trigger recovery
- Location: `failureTracker` Map in `agent/index.js`
- Recovery: Stop Baritone, clear conversation, reset navigation flag

## Entry Points

**Single Agent:**
- Location: `agent/index.js` `main()`
- Triggers: `node agent/index.js` or `npm run agent`
- Responsibilities: Load config, init subsystems, disable Baritone overlays, start tick loop

**Multi-Agent (Glass deployment):**
- Location: `launch-agents.sh`
- Triggers: `./launch-agents.sh [num_bots]` (default 10)
- Responsibilities: For each bot — launch Xvfb virtual display, launch Minecraft client with unique HermesBridge port, wait for bridge health check, start Node.js agent process with auto-restart. All managed in tmux session `hermescraft-bots`.
- Agent isolation: Each agent gets unique `AGENT_NAME`, `MC_USERNAME`, `MOD_URL` (port 3001+N), separate `agent/data/{name}/` directory

**Minecraft Mod:**
- Location: `mod/src/main/java/hermescraft/HermesBridgeMod.java` `onInitializeClient()`
- Triggers: Fabric mod loader on client start
- Responsibilities: Start HTTP server, register chat message listeners, register tick event for action processing and state caching, auto-connect to server

## Error Handling

**Strategy:** Best-effort continuation — never crash the agent, degrade gracefully

**Patterns:**
- LLM failures: 3 retries with exponential backoff; context overflow triggers graduated history trimming (25% at a time); corrupt tool calls trigger full history wipe
- Action failures: Logged to actionHistory; failure counter incremented; craft/smelt failure closes screen to prevent stuck grid
- Stuck detection: After 2 failures on same action key, stops Baritone, clears conversation; after 8 ticks with no position change, same recovery
- Death: Clears conversation, records lesson, waits 5 seconds before resuming tick loop
- Crash recovery: `uncaughtException` handler calls `periodicSave()` and continues — does not exit
- Mod side: All HTTP handlers return JSON errors on exception; `getStateFresh()` falls back to cached state on timeout

## Cross-Cutting Concerns

**Logging:** `agent/logger.js` — ANSI-colored terminal output. Tick divider, health/food bars, agent reasoning block, action + result, death banner, phase-up banner. Designed for livestream viewers.

**Validation:** `agent/actions.js` `validateAction()` — checks action type against `VALID_ACTIONS` set and per-type parameter schema before any HTTP call.

**Authentication:** LLM API key via `VLLM_API_KEY` env var. OAuth support for Anthropic Claude via `sk-ant-oat*` prefix detection in `agent/llm.js`. No auth on mod HTTP server (localhost only).

**Persona:** Agent name, mode, and soul file loaded once at startup via `agent/config.js`. Persona is the first block of the system prompt, rebuilt every tick.

**State Caching (mod side):** `StateReader.cachedState` is a volatile String updated every 20 MC ticks on the render thread. HTTP `/state` handler reads this directly (thread-safe). `getStateFresh()` is available for forced on-demand updates but not used in the hot path.

---

*Architecture analysis: 2026-03-20*
