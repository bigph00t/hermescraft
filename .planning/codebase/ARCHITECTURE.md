# Architecture

**Analysis Date:** 2026-03-20

## Pattern Overview

**Overall:** Event-driven observe-think-act loop with layered memory and a plan/execute/review workflow.

**Key Characteristics:**
- Single-threaded async Node.js agent poll loop (tick every `TICK_MS`, default 2000ms)
- Fabric mod embedded HTTP API bridges the Minecraft client to the agent
- LLM tool-calling is the sole decision mechanism — no rule engine, no hard-coded state machine
- Per-agent data isolation: all persistent state scoped under `agent/data/<AGENT_NAME>/`
- `plan_task` / `update_task` / `save_context` are INFO_ACTIONS: they write local files and feed data back to the LLM as tool results, never reaching the mod API

## Layers

**Minecraft Client (Java, Fabric mod):**
- Purpose: Runs the actual game, exposes game state and accepts actions via HTTP
- Location: `mod/src/main/java/hermescraft/`
- Contains: `HermesBridgeMod` (lifecycle + auto-connect), `HttpServer` (routes), `StateReader` (game state JSON), `ActionExecutor` (Baritone/direct actions), `BaritoneIntegration`, `RecipeLookup`
- Key behavior: State is cached in `StateReader.cachedState` (volatile String), refreshed every 20 MC ticks (~1s) on the client thread. HTTP handler at `GET /state` returns this cache immediately; `POST /action` enqueues to `ActionExecutor.processTick()` which runs every MC tick.
- Port: `HERMESCRAFT_PORT` env var (default 3001); each additional agent gets port 3002, 3003, etc.

**Agent Core (Node.js, `agent/index.js`):**
- Purpose: Main tick loop — observe, think, act, manage plan state, handle deaths
- Location: `agent/index.js` (1052 lines)
- Contains: `tick()`, `main()`, info-action handlers (notepad, plan_task, update_task, save_context, delete_context, wiki, recipes), subtask review logic (`reviewSubtaskOutcome`), stuck detection, pipelining
- Depends on: All subsystems below
- Used by: Nothing — this is the entry point

**LLM Client (`agent/llm.js`):**
- Purpose: OpenAI-compatible client for vLLM/Hermes; maintains conversation history (L1 memory); handles tool-call parsing and fallback text parsing
- Location: `agent/llm.js`
- Key exports: `queryLLM`, `completeToolCall`, `trimHistoryGraduated`, `clearConversation`
- Conversation history: in-memory array of `{role, content, tool_calls?}` messages, trimmed round-by-round on overflow. Persisted to `agent/data/<name>/history.json` via `memory.js`.

**Actions Layer (`agent/actions.js`):**
- Purpose: Schema validation, pre-execution feasibility checks, HTTP dispatch to mod API
- Location: `agent/actions.js`
- Key exports: `validateAction` (schema check), `validatePreExecution` (game-state feasibility), `executeAction` (HTTP POST to mod), `INFO_ACTIONS` (Set of actions that never reach the mod)
- `INFO_ACTIONS`: `recipes`, `wiki`, `notepad`, `read_chat`, `save_context`, `delete_context`, `plan_task`, `update_task`

**Tool Definitions (`agent/tools.js`):**
- Purpose: OpenAI tool schema array passed to the LLM on every call; all tools include an injected `reason` string field
- Location: `agent/tools.js`
- Contains: `GAME_TOOLS` array (22 tools including `plan_task`, `update_task`, `save_context`, `delete_context`)

**Memory System (`agent/memory.js`):**
- Purpose: L2 curated memory (MEMORY.md), L3 session transcripts (JSONL), stats, conversation history persistence
- Location: `agent/memory.js`
- Files written: `<dataDir>/MEMORY.md`, `<dataDir>/stats.json`, `<dataDir>/sessions/session-*.jsonl`, `<dataDir>/history.json`

**Prompt Builder (`agent/prompt.js`):**
- Purpose: Assembles system prompt and user message from all context sources
- Location: `agent/prompt.js`
- Key exports: `buildSystemPrompt` (persona + instructions + memory + active skill + pinned context), `buildUserMessage` (game state + task plan + notepad + review result + stuck warning), `loadPinnedContext` (reads `<dataDir>/context/*.md`)

**Goals / Phases (`agent/goals.js`):**
- Purpose: 7-phase Ender Dragon progression OR open-ended/directed modes
- Location: `agent/goals.js`
- Modes: `phased` (default), `open_ended`, `directed` (custom goal string)

**Skills (`agent/skills.js`):**
- Purpose: L4 procedural memory — learned strategies in agentskills.io SKILL.md format
- Location: `agent/skills.js`
- Per-agent skills dir: `<dataDir>/skills/`. Seed skills (read-only): `agent/skills/`

**Social & Locations (`agent/social.js`, `agent/locations.js`):**
- Purpose: Track player relationships (sentiment scoring) and named world locations
- Files: `<dataDir>/players.json`, `<dataDir>/locations.json`

**Config (`agent/config.js`):**
- Purpose: Read env vars, load SOUL file, establish `dataDir`, return `agentConfig`
- Key env vars: `AGENT_NAME`, `AGENT_MODE`, `AGENT_GOAL`, `AGENT_SOUL`

## Data Flow

**Full tick flow (observe → think → act):**

1. `tick()` called from main loop with optional `precomputedResponse`
2. `fetchState()` → HTTP GET `<MOD_URL>/state` → JSON game state
3. `reviewSubtaskOutcome(state)` — check if `pendingReview` is due; compare state against `expected_outcome` keywords; mark subtask done/failed; auto-advance to next pending
4. Position-based stuck detection — if movement action failed to move for 8 ticks, force stop + clear conversation
5. Death check: if `health` transitioned from >0 to ≤0, record death in memory, clear conversation, sleep 5s, return
6. Phase transition check (phased mode only) — if transition, record phase complete, generate skill, clear conversation
7. Chat polling: GET `<MOD_URL>/chat`, dedup, track players in social memory
8. Stuck detection: if any action key has ≥2 failures, force stop + clear conversation
9. Auto-detect locations, update player proximity in social memory
10. Build system prompt: identity (SOUL) + gameplay instructions + phase/goal + active skill + L2 memory + social/location context + pinned context docs
11. Build user message: user instruction + task plan + notepad + game state + recent actions + stuck warning + review result
12. `queryLLM(systemPrompt, userMessage)` → returns `{reasoning, action, mode}`
13. Chat-limiter: if 3+ of last 5 actions were `chat`, override with `mine oak_log`
14. `validateAction(action)` — schema check; reject if invalid
15. If action is NOT in `INFO_ACTIONS`: `validatePreExecution(action, state)` — feasibility check. If rejected: push failure to action history, complete tool call with error, return.
16. If action IS in `INFO_ACTIONS`: handle locally (notepad read/write, wiki fetch, recipe lookup, `plan_task`, `update_task`, `save_context`, `delete_context`), call `completeToolCall(result)`, push to action history, return.
17. `executeAction(action)` — HTTP POST to `<MOD_URL>/action`
18. `completeToolCall(result)` — append tool result to conversation history
19. Update navigation tracking, push to action history, prune history to 50
20. If success AND action is a SUSTAINED_ACTION (`mine`, `navigate`, `break_block`): pipeline — immediately fetch next state, build next user message, call queryLLM, return pre-computed response for next tick

**plan_task execution trace ("build a house"):**

1. LLM calls `plan_task` tool with `{goal: "build a house", subtasks: ["gather 20 oak_log", "craft planks", "build walls", ...]}`
2. In tick step 16: `handlePlanTask` creates `taskState` object, sets subtask 0 to `in-progress`, saves to `<dataDir>/tasks.json`
3. `completeToolCall` pushes `{success: true, info: "Plan created..."}` to conversation history
4. Next tick: `loadTaskState()` reads `tasks.json`; `buildUserMessage` injects `== TASK PLAN ==` block showing all subtask statuses
5. LLM sees task plan, executes actions for subtask 0 (e.g., `mine oak_log`)
6. When LLM believes subtask 0 is done, it calls `update_task({index: 0, status: "done", expected_outcome: "have 20 oak_log in inventory"})`
7. `handleUpdateTask` sees `expected_outcome` present: sets subtask to `reviewing`, stores `pendingReview = {index: 0, expected_outcome: "...", reviewTick: tickCount + 1}`, saves tasks.json
8. Next tick (step 3): `reviewSubtaskOutcome(state)` fires. Checks inventory for `oak_log`. If found ≥20: marks done, auto-advances subtask 1 to `in-progress`. If not: increments `retry_count`; if <2, sets back to `in-progress`; if ≥2, sets `blocked`.
9. Review result injected into next user message as `== REVIEW PASSED ==` or `== REVIEW FAILED ==` with actual state

**Retry logic (WRK-04):**

- `handleUpdateTask` with `status: "failed"` increments `subtask.retry_count`
- If `retry_count >= max_retries` (default 2): status becomes `blocked`, next pending subtask auto-advances
- If `retry_count < max_retries`: status stays `in-progress` (retry immediately next tick)
- `reviewSubtaskOutcome` uses the same retry path inline when verification fails
- The `== REVIEW FAILED ==` message includes "Try a DIFFERENT approach" to break loops

**Pipelining (sustained actions):**

- After a successful `mine`, `navigate`, or `break_block`, the tick immediately calls `queryLLM` again with a hint: "Current action is running in background. Plan your NEXT action."
- The pre-computed response is returned from `tick()` and passed as `precomputedResponse` to the next tick call
- If a stuck situation or new chat arrives at the next tick, the pre-computed response is discarded and a fresh LLM call is made

## Entry Points

**Agent process:**
- Location: `agent/index.js` → `main()` at line 969
- Triggers: `node agent/index.js` (via `launch-agents.sh` or `steve-start.sh`)
- Responsibilities: Init all subsystems, set per-agent file paths, start tick loop, register SIGINT/SIGTERM handlers

**Minecraft mod:**
- Location: `mod/src/main/java/hermescraft/HermesBridgeMod.java` → `onInitializeClient()`
- Triggers: Fabric loader during client initialization
- Responsibilities: Start HTTP server on `HERMESCRAFT_PORT`, register client tick handler, register chat event listeners

## Error Handling

**Strategy:** Non-fatal by default; all recoveries logged; loop continues.

**Patterns:**
- `unhandledRejection` and `uncaughtException` are caught globally; `periodicSave()` called; process does NOT exit
- `tick()` errors are caught in the main loop; `pendingAction` is cleared; next tick proceeds normally
- `queryLLM` retries up to 3 times with exponential backoff; on context overflow trims 25% of history and retries immediately; after exhaustion trims 50% and throws
- `executeAction` errors are caught; failure tracked in `failureTracker`; action pushed to history with `success: false`
- `validatePreExecution` rejection does NOT reach the mod API; rejection reason is fed back to the LLM via `completeToolCall`
- Craft/smelt failures auto-trigger `close_screen` to prevent item-stuck-in-grid bugs
- Death triggers `clearConversation()` + 5s sleep — agent gets fresh context on respawn

## Cross-Cutting Concerns

**Logging:** `agent/logger.js` — rich terminal output with color, tick headers, death banners, session stats. All calls go through named exports (`logAction`, `logReasoning`, etc.), never raw `console.log`.

**Validation:** Two-stage: `validateAction` (schema, runs always) then `validatePreExecution` (game state feasibility, skipped for INFO_ACTIONS). Both run synchronously before any external I/O.

**Authentication:** vLLM API key via `VLLM_API_KEY` env var. OAuth detection: if key starts with `sk-ant-oat`, sets Anthropic-specific headers. The mod HTTP API has no authentication — it binds to localhost only.

**Memory persistence:** `periodicSave()` called every 20 ticks and on SIGINT/SIGTERM. Writes MEMORY.md, stats.json, history.json, players.json, locations.json.

---

*Architecture analysis: 2026-03-20*
