# Coding Conventions

**Analysis Date:** 2026-03-20

## Naming Patterns

**Files:**
- `kebab-case.js` not used — all files are `lowercase.js` single words
- Each file begins with a header comment: `// filename.js — One-line purpose description`

**Functions:**
- Exported public API: `camelCase` — `queryLLM`, `buildSystemPrompt`, `executeAction`
- Internal helpers: `camelCase` — `trimHistory`, `parseResponseFallback`, `handleNotepad`
- Init pattern: always `init<Subsystem>` — `initMemory`, `initSkills`, `initSocial`, `initLocations`
- Log functions: `log<Event>` — `logError`, `logReasoning`, `logDeathBanner`, `logPhaseChange`
- Boolean classifiers: `is<Condition>` — `isContextOverflowError`, `isToolCallingUnsupported`, `isToolCallingEnabled`
- Record/track operations: `record<Event>` — `recordDeath`, `recordPhaseComplete`, `recordSkillOutcome`
- Handler functions (Phase 2 additions): `handle<Feature>` — `handleSaveContext`, `handleDeleteContext`, `handlePlanTask`, `handleUpdateTask`

**Variables:**
- Module-level mutable singletons: lowercase — `conversationHistory`, `players`, `locations`, `skills`
- "Private" agent globals in `index.js`: leading underscore — `_agentConfig`
- Constants: `SCREAMING_SNAKE_CASE` — `MAX_RETRIES`, `TICK_INTERVAL`, `MOD_URL`
- Lookup sets/maps: `SCREAMING_SNAKE_CASE` Set — `VALID_ACTIONS`, `INFO_ACTIONS`, `SUSTAINED_ACTIONS`

**Types/Schemas:**
- No TypeScript — plain JavaScript objects, no JSDoc types enforced

## Code Style

**Formatting:** No formatter config (no `.prettierrc`, `biome.json`, or `.eslintrc`)

**Style rules (enforced by convention only):**
- 2-space indentation throughout
- Single quotes for all strings
- No semicolons (no-semi style) — **CRITICAL INCONSISTENCY: the original module-level declarations in `index.js` use semicolons, while Phase 2/3 additions (lines 185, 225, 233–288, 295–379) do not. Both coexist in the same file.**
  - Original style (lines 34–75): `let tickCount = 0;` — WITH semicolons
  - Phase 2/3 additions (task/review functions): `let TASKS_FILE = join(...)` — WITHOUT semicolons
  - All new modules (`social.js`, `locations.js`) follow no-semi
  - Target style is no-semi; old code has not been backported
- Trailing commas in multiline object/array literals
- ES Modules (`"type": "module"` in `package.json`) — `import`/`export` throughout, no `require()`
- `import.meta.url` + `fileURLToPath` to get `__dirname` equivalent in files that need it

## Import Organization

**Pattern:** Named imports only — no default exports across any module

**Order (observed):**
1. Node built-ins (`fs`, `path`, `url`)
2. npm packages (`openai`)
3. Local agent modules (`./state.js`, `./llm.js`, `./actions.js`)

**Path aliases:** None — all relative paths (`./module.js`)

**Placement:** All imports at module top. One exception: `index.js` has `import { readFileSync, ... }` at line ~175 in the middle of the file (added in Phase 2) — this is a style inconsistency vs every other module.

## Error Handling

**Three distinct error handling patterns are used — use the correct one for each context:**

**1. Silent catch for non-critical I/O** — filesystem writes, persistence where failure is acceptable:
```js
try { writeFileSync(path, data); } catch {}
try { players = JSON.parse(readFileSync(path)); } catch { players = {}; }
```
Used in: `social.js`, `locations.js`, `memory.js`, `config.js`, `skills.js`, `prompt.js`

**2. Classified error handling (LLM critical path)** in `agent/llm.js`:
```js
if (isContextOverflowError(err)) { trimHistoryGraduated(0.25); continue; }
if (isToolCallingUnsupported(err)) { /* fallback to text */ }
```
Errors are classified by `isContextOverflowError()` and `isToolCallingUnsupported()` before handling.

**3. Structured return values (never throw from action execution):**
- `validateAction()` returns `{ valid: false, error: string }` or `{ valid: true }`
- `validatePreExecution()` returns `{ valid: false, reason: string }` or `{ valid: true }`
- **NOTE: These two functions use different keys for failure reason (`error` vs `reason`). This is intentional but inconsistent — callers must use the correct key.**
  - `validateAction` → `result.error`
  - `validatePreExecution` → `result.reason`
- `executeAction()` returns `{ success: false, error: string }` or the mod API response object; never throws on HTTP errors

**4. Action dispatch in `index.js`:** All INFO actions (`save_context`, `plan_task`, etc.) return `null` from `tick()` on both success and error, logging via `logInfo`/`logWarn`. Game-world actions push to `actionHistory` with `{ success, error }`.

**Global crash handlers** in `agent/index.js`:
```js
process.on('unhandledRejection', ...) // logs, does not exit
process.on('uncaughtException', ...)  // saves state, does not exit
```

## Logging

**Framework:** Custom `agent/logger.js` — ANSI-colored terminal output with Unicode health/food bars

**Rule: No direct `console.log` in business logic** — all log calls go through `logger.js` exports:
- `logInfo(msg)` — general info (cyan)
- `logWarn(msg)` — warnings (yellow)
- `logError(msg, err)` — errors (red)
- `logReasoning(text, agentName)` — LLM reasoning display with `│` gutter (the "star of the show")
- `logAction(action, mode)` — action being taken
- `logActionResult(result)` — result of action
- `logDeathBanner(count, record)` — full-width death box (magenta)
- `logPhaseChange(from, to)` — phase transition
- `logSessionStats(stats)` — periodic stats dump

**Exception:** `index.js` has a few direct uses for `logInfo(...)` in main loop. Inline `console.log` is absent.

**Prefix pattern for Phase 2/3 additions:** `logInfo('[plan_task] ...')`, `logInfo('[update_task] ...')`, `logInfo('[reviewSubtaskOutcome] ...')` — bracket-prefixed subsystem labels in info logs.

## Comments

**Module header:** Required one-liner: `// filename.js — Purpose description`

**Section dividers:** `// ── Section Name ──` — used throughout to group related functions within a large file

**Decision comments:** Non-obvious code has inline explanation above it:
```js
// Hermes recommended sampling: temp=0.6, top_p=0.95
// Anthropic API rejects temperature + top_p together
```

**Workaround comments:** Explicitly note why: `// 'wait' deliberately removed — force real actions`

**No JSDoc** used anywhere — plain inline comments only.

## Function Design

**Size:** Helpers are small (5–20 lines). The `tick()` function in `index.js` is ~500 lines and is the main orchestrator — not broken up further.

**Parameters:** Config objects passed by reference (`agentConfig`) from `loadAgentConfig()` into every `init*` function.

**Return values:**
- Info handlers return `string` (human-readable result for LLM consumption)
- Validation functions return `{ valid: bool, error?: string }` or `{ valid: bool, reason?: string }`
- Game action dispatch returns `null` (not a result object)
- `reviewSubtaskOutcome()` returns `null` (no review pending) or `{ passed: bool, subtaskIndex, expected_outcome, actual? }`

## Module Design

**Ownership:** Each module owns its mutable singleton state:
- `agent/llm.js` → `conversationHistory`, `useToolCalling`, `toolCallingFailures`
- `agent/memory.js` → `memory`, `stats`, `sessionLogFile`
- `agent/skills.js` → `skills[]`
- `agent/goals.js` → `agentMode`, `agentGoal`, `customGoal`
- `agent/social.js` → `players` (Phase 2)
- `agent/locations.js` → `locations` (Phase 2)

**Exports:** Named exports only. No default exports. Every module with state exposes an `init<Subsystem>(agentConfig)` function.

**Barrel files:** None — direct module imports throughout.

## Prompt Engineering Patterns

### System Prompt (`agent/prompt.js` `buildSystemPrompt`)
Built by joining `parts[]` with `'\n'`:
1. Identity/persona (from `SOUL-*.md` file or `DEFAULT_IDENTITY` fallback)
2. `GAMEPLAY_INSTRUCTIONS` (always injected)
3. `== CURRENT PHASE: ... ==` block with objectives/tips (phased mode only)
4. `== YOUR GOAL ==` block (directed mode only)
5. Learned skill strategy (if active skill matched)
6. Lessons from past deaths/experience
7. Death count reminder (if > 0)
8. `== PINNED CONTEXT (always available) ==` (survives all history wipes — Phase 2 addition)

### User Message (`agent/prompt.js` `buildUserMessage`)
Built by joining `parts[]` with `'\n'`:
1. `== USER INSTRUCTION ==` (if present, including player chat)
2. `== TASK PLAN ==` block (Phase 2 addition) — shows goal, progress N/M, subtask list with status markers `[ ]` `[x]` `[>]` `[!]` `[B]` `[?]`
3. `== REVIEW PASSED ==` or `== REVIEW FAILED ==` inline within TASK PLAN section (Phase 3 addition)
4. `== YOUR NOTEPAD ==` — persistent scratchpad content
5. `== PROGRESS ==` — phase Done/TODO checklist (phased mode)
6. `!! LAST ACTION FAILED: ...` — failure feedback (if last action failed)
7. `== GAME STATE ==` — full `summarizeState()` output
8. `== RECENT ACTIONS ==` — last 6 actions reversed (newest first)
9. `⚠ STUCK: ...` warning (if stuck detected)
10. `Think deeply, then act.` — terminal instruction

### Review Result Display (Phase 3 — `agent/prompt.js`)
Review messages appear immediately after the task plan subtask list:
```
== REVIEW PASSED == Subtask N: "expected outcome" -- VERIFIED
```
or:
```
== REVIEW FAILED == Subtask N: expected "X" but found: Y
This subtask has been set back to in-progress for retry. Try a DIFFERENT approach.
```

### Tool Design (`agent/tools.js`)
- All tools have a `reason` field injected programmatically post-definition via a loop
- Tool descriptions are action-directive format, not prose explanations
- `wait` is intentionally absent: "Never call 'wait'" in system prompt
- `tool_choice: 'required'` — model MUST call a tool every turn

### Response Parsing Cascade (`agent/llm.js` `parseResponseFallback`)
1. `<tool_call>` XML (Hermes native format)
2. `REASONING: ... ACTION: {...}` text format
3. Any JSON with `"name"` or `"type"` field (last resort)
4. Default to `{ type: 'wait' }` if nothing parseable
