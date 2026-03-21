# Coding Conventions

**Analysis Date:** 2026-03-20

## Naming Patterns

**Files:**
- Flat `camelCase.js` in `agent/` — no subdirectories except `data/`, `skills/`
- SOUL files: `SOUL-<agentname>.md` at project root
- Skill files: `agent/skills/<kebab-name>/SKILL.md`
- Data files: `agent/data/<agentname>/` with `MEMORY.md`, `stats.json`, `notepad.txt`

**Functions:**
- Exported functions: `camelCase` — `buildSystemPrompt`, `queryLLM`, `executeAction`
- Internal helpers: `camelCase` — `trimHistory`, `parseResponseFallback`, `handleNotepad`
- Init pattern: always named `init<Subsystem>` — `initMemory`, `initSkills`, `initSocial`, `initLocations`
- Log functions: `log<Event>` — `logError`, `logReasoning`, `logDeathBanner`, `logPhaseChange`
- Boolean checks: `is<Condition>` — `isContextOverflowError`, `isToolCallingUnsupported`, `isToolCallingEnabled`
- Record/track operations: `record<Event>` — `recordDeath`, `recordPhaseComplete`, `recordAction`, `recordSkillOutcome`

**Variables:**
- Module-level mutable state: lowercase with leading `_` for "private" agent globals (`_agentConfig`), or plain lowercase for non-exported module state
- Constants: `SCREAMING_SNAKE_CASE` — `MAX_RETRIES`, `TICK_INTERVAL`, `MOD_URL`, `VALID_ACTIONS`
- Sets used as lookup tables: `SCREAMING_SNAKE_CASE` Set — `VALID_ACTIONS`, `INFO_ACTIONS`, `SUSTAINED_ACTIONS`, `HOSTILE_MOBS`

**Exports:**
- Named exports only — no default exports across any module
- Config objects passed by reference (agentConfig) from `loadAgentConfig()` into every `init*` function

## Code Style

**Formatting:**
- No formatter config detected (no `.prettierrc`, `biome.json`, or eslint config)
- 2-space indent throughout
- Single quotes for strings
- Semicolons absent — no-semi style
- Trailing commas in multiline object/array literals

**Module System:**
- ES Modules throughout (`"type": "module"` in `package.json`)
- `import.meta.url` + `fileURLToPath` to get `__dirname` equivalent in every file that needs it
- Dynamic imports not used — all static at module top

**File Headers:**
- Every file begins with a one-line comment: `// filename.js — Purpose description`
- Key architectural decisions documented inline above the code they affect

## Import Organization

**Order observed:**
1. Node.js built-ins (`fs`, `path`, `url`)
2. Third-party packages (`openai`)
3. Local agent modules (`./state.js`, `./llm.js`, etc.)

**No path aliases** — relative imports only (`./actions.js`, `../SOUL-steve.md`)

## Error Handling

**Philosophy:** Never crash the agent loop. All errors are caught and the loop continues.

**Patterns:**

- **Global crash handlers** registered in `agent/index.js`:
  ```js
  process.on('unhandledRejection', (err) => { logError(...); });
  process.on('uncaughtException', (err) => { logError(...); try { periodicSave(); } catch {} });
  ```

- **Silent catch for non-critical ops** — filesystem writes, external fetches where failure is acceptable:
  ```js
  try { writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2)); } catch {}
  ```

- **Structured error classification** in `agent/llm.js` — errors are categorized before handling:
  ```js
  function isContextOverflowError(err) { ... }
  function isToolCallingUnsupported(err) { ... }
  ```

- **Action failures are non-fatal** — `executeAction` returns `{ success: false, error: '...' }` instead of throwing; callers check `result.success`

- **HTTP errors** normalized: `fetch` non-ok responses return `{ success: false, error: 'HTTP 404: ...' }`, never throw

- **JSON parse failures** silently ignored with empty fallback in tool argument parsing:
  ```js
  try { args = JSON.parse(toolCall.function.arguments); } catch (parseErr) { /* Log but don't crash */ }
  ```

## LLM Error Handling (Critical Path)

The `queryLLM` function in `agent/llm.js` implements a **graduated recovery strategy**:

1. **Context overflow** → trim oldest 25% of history via `trimHistoryGraduated(0.25)`, retry immediately (no delay). Repeats on each attempt until history empty.
2. **Tool calling unsupported** (HTTP 400/422 with "tool"/"function_call" keywords) → fall back to text parsing for this request. After `MAX_TOOL_FAILURES` (3) consecutive failures, permanently disable tool calling.
3. **Corrupt tool call in history** (HTTP 400 with "invalid"/"tool_call") → wipe entire history, retry fresh.
4. **Generic errors** → exponential backoff: `1s * 2^attempt` for `MAX_RETRIES` (3) attempts.
5. **All retries exhausted** → trim 50% of history as last resort, then throw. Outer tick loop catches and continues.

## Prompt Engineering Patterns

### System Prompt Construction (`agent/prompt.js`)

The system prompt is assembled from ordered `parts[]` array, joined with newlines:

1. **Identity layer** — contents of `SOUL-<name>.md` file (persona, personality, behavioral rules), or `DEFAULT_IDENTITY` if no SOUL file found
2. **Gameplay instructions** — `GAMEPLAY_INSTRUCTIONS` constant: action-by-action tactical cheat sheet for Minecraft mechanics (always injected)
3. **Phase context** — current phase name + objectives (step-by-step) + tips (phased mode only)
4. **Goal** — in directed mode only
5. **Active skill** — full `SKILL.md` body for the current phase (from `agent/skills/`)
6. **Memory** — lessons (from deaths), strategies (from phase completions), world knowledge, player relationships, known locations
7. **Death count** — injected as emotional framing: "You have died N time(s). Each death stings."
8. **Pinned context** — any `.md`/`.txt`/`.json` files in `agentConfig.dataDir/context/` directory, injected verbatim. Survives all history wipes.

### User Message Construction (`agent/prompt.js`)

Built each tick from ordered `parts[]`:

1. `== USER INSTRUCTION ==` — operator command read from `instructions.txt` (consumed once, then cleared)
2. `== YOUR NOTEPAD ==` — persistent plan text from `notepad.txt` (max 2000 chars, truncates with rewrite hint)
3. `== PROGRESS ==` — itemized Done/TODO checklist derived from inventory state
4. `!! LAST ACTION FAILED: ...` — shown only when last action failed, with error text
5. `== GAME STATE ==` — compressed game state: position, health/food, inventory, nearby blocks with coordinates, nearby entities, state diffs
6. `== RECENT ACTIONS ==` — last 6 actions (reversed, newest first) with success/fail status
7. `⚠ STUCK:` — shown when same action fails 2+ times in a row
8. `Think deeply, then act.` — terminal directive (always last)

### Tool Design (`agent/tools.js`)

- All tools have a `reason` field injected programmatically post-definition:
  ```js
  props.reason = { type: 'string', description: 'Brief reason (5 words max)' };
  ```
- Tool descriptions are highly compressed action-oriented directives, not explanations
- `wait` is intentionally absent from GAME_TOOLS: "Never call 'wait' — it doesn't exist"
- Tool calling is set to `tool_choice: 'required'` — the model MUST call a tool every turn

### Response Parsing Cascade (`agent/llm.js` `parseResponseFallback`)

Four levels of fallback when tool calling fails:
1. `<tool_call>{"name": "...", "arguments": {...}}</tool_call>` — Hermes native XML format
2. `REASONING: ...\nACTION: {...}` — structured text format
3. Any JSON object with `name` or `type` field
4. Default `{ type: 'wait' }` — absolute last resort

## Output Quality Mechanisms

**There is no self-review loop.** The agent does not re-read its own output before acting.

**Quality gates that do exist:**

1. **Action validation before execution** — `validateAction` in `agent/actions.js` checks type is known and required params are present. Invalid actions are logged and the tick returns null (no action taken).

2. **Stuck detection** — `failureTracker` Map counts failures per action key. After `MAX_STUCK_COUNT` (2) failures of the same action: force-stop Baritone, clear conversation history (fresh context), clear failure tracker.

3. **Position-based stuck detection** — if position hasn't moved 0.5 blocks for 8+ ticks during navigation: force stop, clear conversation, reset.

4. **Tool call JSON validation before history storage** — corrupt tool calls (invalid JSON in arguments) are filtered out before being stored in `conversationHistory`, preventing context poisoning:
   ```js
   const cleanToolCalls = msg.tool_calls.filter(tc => {
     try { JSON.parse(tc.function.arguments); return true; } catch { return false; }
   });
   ```

5. **Notepad truncation hint** — when notepad exceeds 2000 chars, the prompt appends `... (truncated — rewrite concisely)`, prompting the agent to self-compress.

6. **Adaptive temperature** — temperature drops when agent is in danger (`health <= 6` → 0.3) or dangerous dimensions (nether → 0.5, end → 0.4). Intended to make the model more conservative under pressure.

## Auto-Review / Self-Evaluation Loops

**No explicit plan-review cycle exists.** The closest mechanisms:

- **Notepad** — the agent can call `notepad(action='read')` to inspect its own plan, then `notepad(action='write')` to revise it. This is the only mechanism for intra-session self-evaluation.
- **Death memory** — `generateCountermeasure` in `agent/memory.js` generates rule-based tactical advice from death context. Injected into future prompts as "Lessons learned."
- **Skill update** — when a phase completes (or fails via death), `updateSkill` appends new lessons to the `SKILL.md`. On the next session, improved guidance appears in the system prompt.
- **Progress detail** — Done/TODO checklist in every user message gives the model a compact self-assessment view.

## Logging

**Framework:** `console.log` with ANSI escape codes (defined in `agent/logger.js`)

**Design intent:** Optimized for livestream readability — prominently displays AI reasoning.

**Key patterns:**
- Reasoning text wrapped at 85 chars with `│` gutter indicator
- Health/food bars rendered as Unicode heart/drumstick symbols
- Rich death banner with box-drawing characters
- All log functions exported from `logger.js` — no direct `console.log` in business logic files except `index.js`

## Module Design

**Exports:** Named exports only. All subsystems export an `init<Name>(agentConfig)` function that stores the config reference in module-level state (effectively a singleton per process).

**State management:** Module-level mutable variables are the norm. Each module owns its state and exports accessor functions:
- `agent/llm.js` owns `conversationHistory`, `useToolCalling`, `toolCallingFailures`
- `agent/memory.js` owns `memory`, `stats`, `sessionLogFile`
- `agent/skills.js` owns `skills[]`
- `agent/goals.js` owns `agentMode`, `agentGoal`, `customGoal`

**No barrel files** — all imports are direct module paths.

## Comments

**When to Comment:**
- Module header: one-line purpose description
- Non-obvious decisions: inline comment above the code block
- Architecture callouts: `// ── Section Name ──` dividers group related functions within a file
- Workarounds: explicit notes on why (e.g., `// Anthropic API rejects temperature + top_p together`)
- TODO-style: not present — issues tracked in `.hermes.md`

---

*Convention analysis: 2026-03-20*
