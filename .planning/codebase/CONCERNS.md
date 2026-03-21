# Codebase Concerns

**Analysis Date:** 2026-03-20

---

## Confirmed Bugs from Phase 1-3 Integration

### BUG-01: Context Overflow Double-Trim (History Shrinks ~44% Instead of 25%)

**Files:** `agent/llm.js` lines 182-188 (inner catch), 295-299 (outer catch)

**Issue:** When a context overflow error occurs during tool calling, TWO graduated trims run
on the same error. The inner `try` block (inside `if (useToolCalling)`) catches the overflow,
calls `trimHistoryGraduated(0.25)`, then re-throws. The outer `catch` block then catches the
same re-thrown error, detects `isContextOverflowError` again, and calls
`trimHistoryGraduated(0.25)` a second time. Net result: ~25% removed from original, then 25%
of the remainder — approximately 44% total trimmed instead of the intended 25%.

**Impact:** History shrinks faster than intended on overflow. Over multiple ticks this
compounds — the agent loses context it should retain, degrading reasoning quality.

**Fix approach:** In the inner catch, either return early (don't re-throw if overflow was
handled), or set a flag that prevents the outer catch from trimming again. Simplest fix: move
the overflow-triggered trim entirely to the outer catch, never in the inner one.

---

### BUG-02: Double Logging for `plan_task` and `update_task`

**Files:** `agent/index.js` lines 851-857

**Issue:** After handling `plan_task` and `update_task`, a dedicated `logInfo` call fires for
each (`[plan_task]` and `[update_task]`). Immediately after the if/else chain, a blanket
`logInfo(`[${actionType}] ${infoResult}`)` fires unconditionally for ALL info actions (line
857). Every `plan_task` and `update_task` invocation produces two identical log lines.

**Impact:** Cosmetic noise in terminal output; may mislead operators reading logs about what
ran how many times.

**Fix approach:** Either remove the dedicated `logInfo` calls inside the `plan_task` /
`update_task` branches, or add an `else` guard on the blanket log to skip when already logged.

---

### BUG-03: `handleSaveContext` / `handleDeleteContext` Crash if Called Before `main()`

**Files:** `agent/index.js` lines 425, 441

**Issue:** Both functions access `_agentConfig.dataDir` directly with no null guard.
`_agentConfig` is initialized to `null` at line 58 and set in `main()` at line 972. If
`handleSaveContext` or `handleDeleteContext` were somehow reached before `main()` completes
(e.g., in tests or if the tool dispatch path is entered during early startup), the access
throws `TypeError: Cannot read properties of null (reading 'dataDir')`.

**Impact:** Low-probability crash in edge conditions (tests that import index.js functions,
or unusual startup ordering).

**Fix approach:** Add `if (!_agentConfig) return 'Agent not initialized'` guards at the top
of both handlers.

---

### BUG-04: `wait` Action Schema Present but Tool Removed — Inconsistency

**Files:** `agent/actions.js` lines 14, 45; `agent/llm.js` line 277

**Issue:** `wait` is removed from `VALID_ACTIONS` (line 14 comment says "deliberately
removed") but is still present in `ACTION_SCHEMAS` at line 45 (`wait: () => true`). More
critically, `queryLLM()` in `llm.js` at line 277 defaults to `{ type: 'wait' }` when
text-fallback parsing fails (`result.action = { type: 'wait' }`). When the fallback fires and
`validateAction` runs on `{ type: 'wait' }`, it returns `{ valid: false, error: "unknown
action type: wait" }` because `wait` is not in `VALID_ACTIONS`. The tick then logs an invalid
action error and returns `null` — wasting a full tick doing nothing while confusingly logging
an error instead of a clean no-op.

**Impact:** Every LLM text-fallback failure appears as a validation error in logs. The tick
is skipped silently. Operators see `Invalid action: unknown action type: wait` without
understanding this is expected fallback behavior.

**Fix approach:** Either re-add `wait` to `VALID_ACTIONS` as a no-op game action (and handle
it in `executeAction`), or change the fallback in `llm.js` line 277 to use a valid action
like `{ type: 'stop' }` or `{ type: 'chat', message: '...' }`.

---

### BUG-05: `pendingReview.reviewTick` Logic — Off-by-Zero on Tick 0

**Files:** `agent/index.js` lines 254, 296, 471

**Issue:** `tickCount` is incremented at the very top of `tick()` (line 471), before
`reviewSubtaskOutcome` is called (line 484). `pendingReview.reviewTick = tickCount + 1` is
set inside `handleUpdateTask`, which runs during tick N (after `tickCount++` has already made
it N). So `reviewTick = N + 1`. On the next call to `tick()`, `tickCount++` makes it N+1, and
`tickCount < pendingReview.reviewTick` evaluates as `N+1 < N+1 = false` — so the review
fires. This is correct behavior.

**However:** if `tickCount` overflows `Number.MAX_SAFE_INTEGER` on extremely long-running
sessions (~2^53 ticks at 2s/tick ≈ 570 million years), reviews would never fire. Not a
practical concern, but worth noting as a theoretical bound.

**Impact:** Negligible in practice.

---

### BUG-06: Chat Dedup Keyed by Position-in-Batch — Breaks on Message Reordering

**Files:** `agent/index.js` lines 644-648

**Issue:** Chat messages are deduplicated using keys of the form `${i}:${message}`, where `i`
is the position in the current 5-message batch. If the same message appears at position 2 in
tick N and at position 3 in tick N+1 (due to a new message arriving and shifting the window),
the key changes from `2:<msg>` to `3:<msg>` and the message is treated as new — causing a
duplicate response. Conversely, two genuinely different messages at the same position could
collide if their text matches.

**Impact:** The agent may respond to the same player message twice in rapid succession, or
silently skip a genuinely new message that happens to share position and content with a prior
one. Reproducible when players are chatting at high frequency.

**Fix approach:** Key messages by their full text only (`msg`) rather than `${i}:${msg}`, and
maintain a time-windowed set (e.g., evict entries older than N seconds) rather than replacing
the entire set each tick.

---

## Integration Issues

### INT-01: Duplicate Import of `state.js` in `index.js`

**Files:** `agent/index.js` lines 5 and 8

**Issue:** `state.js` is imported twice on separate lines — first for
`fetchState, summarizeState, detectDeath, setNavigating`, then again for `fetchRecipes`. ES
modules deduplicate at the module level so this does not cause a runtime error or double
initialization, but it is a code hygiene issue that would fail a strict linter.

**Impact:** None at runtime. Confusing to future readers.

**Fix approach:** Merge both imports into a single `import { ... } from './state.js'` statement.

---

### INT-02: `read_chat` Tool Fetches Same Endpoint as Proactive Chat Reader — No Dedup

**Files:** `agent/index.js` lines 628-686 (proactive reader), lines 839-844 (read_chat handler)

**Issue:** The proactive chat reader runs at every tick before the LLM is queried (lines
628-686). It fetches `/chat`, filters player messages, and injects them into the user message
as `Chat: <messages>`. The `read_chat` tool handler (lines 839-844) also fetches `/chat` and
returns the raw text to the LLM. If the agent calls `read_chat`, it gets the same messages
it already saw in the proactive reader — they appear twice in the same context window (once
injected by the tick machinery, once as a tool result).

**Impact:** Token waste; the LLM may process the same chat content twice per tick and act
confusedly on "new" messages that were already handled.

**Fix approach:** The `read_chat` tool should either return only messages newer than the last
proactive-read batch, or the proactive reader should be disabled when the agent is actively
using `read_chat`.

---

### INT-03: MOD_URL Hardcoded as `process.env` Lookup Inside Functions (Not Module Constant)

**Files:** `agent/index.js` lines 631, 840

**Issue:** Inside the chat-reading code and the `read_chat` handler, `MOD_URL` is re-evaluated
via `process.env.MOD_URL || 'http://localhost:3001'` each call, shadowing the module-level
constant from `actions.js`. If `MOD_URL` changes at runtime (via env mutation in tests or
unusual process setups), the three code paths in `index.js`, `actions.js`, and `state.js` may
use different values. `actions.js` line 3 and `state.js` line 3 each also declare their own
module-level `MOD_URL` constants — there are now four separate `MOD_URL` evaluations across
the codebase.

**Impact:** Operational risk if environment changes. Confusing to trace during debugging.

**Fix approach:** Export a single `getModUrl()` utility from `state.js` or `actions.js` and
import it everywhere.

---

### INT-04: `infoResult` Can Be `undefined` When `logInfo` Runs

**Files:** `agent/index.js` line 857

**Issue:** The blanket `logInfo(`[${actionType}] ${infoResult}`)` runs after the if/else chain
that handles all INFO_ACTIONS. All branches assign `infoResult`. However, if a new `INFO_ACTIONS`
entry is added to the set (e.g., in `actions.js`) without a corresponding `else if` branch in
`index.js`, `infoResult` will be `undefined`. The tool call would complete with
`JSON.stringify({ success: true, info: undefined?.slice(0, 300) })` which throws
`TypeError: Cannot read properties of undefined (reading 'slice')` due to the optional chain
resolving to `undefined` which then calls `.slice()` on the result.

**Wait:** `infoResult?.slice(0, 300)` on line 860 correctly uses optional chain — it returns
`undefined` not a throw. But the log on line 857 would print `[someAction] undefined` which
is misleading.

**Impact:** Low crash risk (optional chain handles it), but silent functional gap when adding
new INFO_ACTIONS.

**Fix approach:** Add an `else` branch at the end of the if/else chain that assigns
`infoResult = 'Unknown info action'` as a fallback.

---

## Technical Debt

### DEBT-01: `mineflayer` and `ws` in `package.json` — Unused Dependencies

**Files:** `package.json` lines 13-17

**Issue:** `mineflayer: ^4.35.0` and `ws: ^8.16.0` are declared as production dependencies
but are not imported anywhere in the current codebase (verified via grep). These are likely
leftovers from an earlier architecture. They add ~15MB to `node_modules` and introduce a
larger attack surface.

**Impact:** Bloated install; potential vulnerability surface from unmaintained transitive deps.

**Fix approach:** `npm uninstall mineflayer ws` and verify the agent still starts.

---

### DEBT-02: `NOTEPAD_FILE` and `TASKS_FILE` Initialized to Wrong Paths Pre-`main()`

**Files:** `agent/index.js` lines 180, 185

**Issue:** `NOTEPAD_FILE` and `TASKS_FILE` are initialized at module evaluation time to paths
under `agent/data/` (using `__dirname_idx`). They are later reassigned in `main()` at lines
982-983 to per-agent paths. Any code that runs before `main()` completes (imports, module-
level code in tests) would use the wrong paths. This is the same pattern that led to needing
`DATA_DIR` re-initialization in `memory.js`.

**Impact:** If tests or scripts import and call `loadTaskState()` or `readNotepad()` before
calling the `main()` equivalent, they read from the wrong directory.

**Fix approach:** Initialize `NOTEPAD_FILE` and `TASKS_FILE` to `null` and add guards at the
top of `loadTaskState()`, `readNotepad()`, `writeNotepad()`.

---

### DEBT-03: `index.js` is 1052 Lines — Monolith Risk

**Files:** `agent/index.js`

**Issue:** `index.js` contains the main tick loop AND the notepad handler, context handler,
task planner, task updater, subtask reviewer, chat reader, wiki lookup, recipe lookup, action
dispatcher, pipelining logic, stuck detection, death handler, phase transition handler, Baritone
overlay disabler, and shutdown logic. Additionally, it contains a mid-file ES module `import`
statement at line 175 (after 174 lines of non-import code), which works in ESM but is
non-conventional and can confuse static analysis tools.

**Impact:** High cognitive load for future changes. The mid-file import is a latent risk
if the file is ever ported to CommonJS or processed by tools that expect imports at the top.

**Fix approach:** Extract notepad, task plan, and context handlers into a dedicated
`agent/tools-impl.js`. Extract the chat reading + dedup logic into `agent/chat.js`. This
would reduce `index.js` to the core observe-think-act loop (~400 lines).

---

### DEBT-04: `actionHistory` Array Grows to 50 But Is Never Compacted by Content

**Files:** `agent/index.js` lines 919-922

**Issue:** `actionHistory` is capped at 50 entries by splicing from the front. Each entry
contains `type`, `success`, `error`, `timestamp`, and optionally `info` (which can be up to
300+ chars of tool result text). The `writeSessionEntry` call at lines 932-941 appends to a
JSONL file every single tick. Over a 24h session at 2s/tick: 43,200 entries × ~200 bytes =
~8.6MB of JSONL per session. Combined with pruning at 10 sessions max, total is bounded at
~86MB — acceptable but worth monitoring.

**Impact:** Disk exhaustion is bounded by `pruneSessionLogs` at 10 session files. No leak.

---

### DEBT-05: `failureTracker` Map Is Pruned by Count, Not Time

**Files:** `agent/index.js` lines 75, 112-121

**Issue:** `failureTracker` stores failure counts keyed by action signature. `pruneFailureTracker()`
removes the lowest-count entries when size exceeds 50. However, stale entries (actions the
agent tried days ago and hasn't touched since) are never evicted by time — only by count.
In practice the map stays small, but a sufficiently diverse agent could accumulate many stale
entries that consume memory indefinitely.

**Impact:** Negligible in practice given the 50-entry cap. Low risk.

---

## Security Considerations

### SEC-01: Directory Traversal in `save_context` — Partial Mitigation Only

**Files:** `agent/index.js` lines 418-436

**Issue:** `handleSaveContext` strips path separators (`/` and `\`) from filenames using
`filename.replace(/[/\\]/g, '')`. This prevents basic traversal but does not handle:
- Null bytes in filenames (though Node.js `writeFileSync` would throw on these)
- Extremely long filenames that could hit filesystem limits
- Unicode path tricks (e.g., `..%2F` — though this comes after URL decode by the caller)
- Filenames that are only dots (e.g., `...md`) which would be valid per the regex check

The extension check `!/\.(md|txt|json)$/i.test(filename)` correctly enforces extension but
runs on the ORIGINAL `filename` before sanitization. If the filename were something like
`plan.md/`, the trailing slash would be stripped making it `plan.md` — the extension check
passes on the original string, and `safeName` becomes `plan.md`. This specific case is benign,
but the ordering (check then sanitize) is conceptually backwards.

**Impact:** Low risk in current deployment (only the agent itself calls these tools, not an
external API), but worth hardening.

**Fix approach:** Run sanitization first, then validate the sanitized name.

---

### SEC-02: `launch-agents.sh` Leaks `VLLM_API_KEY` into tmux Window Titles and Bash History

**Files:** `launch-agents.sh` lines 127-138

**Issue:** The agent launch command is built as a multi-line string with `VLLM_API_KEY='$VLLM_API_KEY'`
interpolated directly inline (line 131). This command is then passed to `tmux send-keys`.
The key appears in:
1. The tmux pane's command buffer (visible in `tmux list-keys`)
2. The shell's history file inside the tmux session
3. Potentially in `/proc/<pid>/cmdline` on Linux

**Impact:** API key exposure on a multi-user system (Glass). Low risk if Glass is single-user.

**Fix approach:** Export the key as an environment variable before launching the agent loop
rather than interpolating it inline.

---

## Performance Concerns

### PERF-01: Token Budget at Risk — System Prompt Can Exceed 12,000 Tokens

**Files:** `agent/prompt.js` lines 7, 13-14

**Issue:** Maximum theoretical system prompt size:
- SOUL file: ~900 tokens (3.6KB SOUL-steve.md)
- GAMEPLAY_INSTRUCTIONS: ~150 tokens
- Phase objectives + tips: ~200 tokens
- Skill content (activeSkill): variable, up to ~500 tokens per SKILL.md
- Memory (lessons + strategies + world knowledge): ~300 tokens
- Pinned context: 5 files × 8000 chars ÷ 4 chars/token = **10,000 tokens**

Total worst-case system prompt: ~12,000 tokens. With `MAX_HISTORY_MESSAGES = 90` messages
at ~100 tokens each (9,000 tokens), plus the user message (~500 tokens), total context can
approach **21,500 tokens** before `MAX_TOKENS = 384` for the response. This is well within
a 32K context model but could overflow a 16K-context deployment.

The immediate risk is that 5 × 8000-char context files is aggressively permissive. An agent
that calls `save_context` 5 times with 8000-char plans can nearly fill its own context window
with its own planning documents, leaving little room for game state.

**Impact:** Context overflow errors more likely; graduated trim will fire frequently, degrading
continuity.

**Fix approach:** Reduce `CONTEXT_MAX_CHARS_PER_FILE` to 3000-4000 or `CONTEXT_MAX_FILES` to
3. Add a token-count estimate to the startup banner so operators can see the actual prompt size.

---

### PERF-02: `loadTaskState()` Reads from Disk on Every Tick — Twice

**Files:** `agent/index.js` lines 748 (before LLM call), 955 (pipeline call)

**Issue:** `loadTaskState()` calls `readFileSync(TASKS_FILE)` + `JSON.parse()` synchronously.
In the main tick path it is called at line 748 to inject task progress into the user message.
If pipelining is active, it is called again at line 955. On every tick. The file is at most a
few KB and on a local SSD this is negligible, but on Glass with an NFS-mounted or slow drive
this could add measurable latency.

**Impact:** Low in typical deployment. Worth noting if tick latency becomes a concern.

**Fix approach:** Cache task state in memory and invalidate on `saveTaskState()` writes.

---

### PERF-03: `periodicSave()` Blocks the Tick Loop (Synchronous File I/O)

**Files:** `agent/memory.js` lines 399-411

**Issue:** `periodicSave()` calls `writeFileSync()` for `stats.json`, `MEMORY.md`, and
`history.json` (the largest — up to 90 × ~200 byte messages = ~18KB) synchronously. This
blocks the Node.js event loop during the write. Called every 20 ticks (40s at 2s/tick).

For small files on a local disk this is imperceptible. If `history.json` grows to 200+ messages
(possible given `MAX_HISTORY_MESSAGES = 90` and `setConversationHistory` not applying the cap),
or if the filesystem is slow, this will cause the tick to pause for tens of milliseconds.

**Impact:** Low in practice. Could cause a noticeable pause on Glass if the drive is HDD or
if disk I/O is contended with the MC server.

**Fix approach:** Use `writeFile` (async) with a mutex pattern, or accept the blocking as
acceptable given the 40s interval.

---

## Configuration Issues

### CFG-01: MC Version Mismatch — `launch-client.sh` Uses 1.21.1, Server Runs 1.21.11

**Files:** `launch-client.sh` line 13; `.hermes.md` line 7; `README.md` line 10

**Issue:** `launch-client.sh` hardcodes `MC_VERSION="1.21.1"`. `.hermes.md` documents that
the production Glass server runs Fabric 1.21.11 with multiple known issues (no Baritone,
crafting disabled, particle crash). `README.md` references 1.21.1 throughout including in
the badge, setup instructions, and architecture diagram. The production environment and the
documented/scripted environment are on different versions.

**Impact:** Running `launch-agents.sh` against a 1.21.11 server using a 1.21.1 client will
produce version mismatch errors on connect. The README misleads new contributors about the
actual server version and available features (Baritone is listed as a feature but is disabled
on 1.21.11).

**Fix approach:** Either pin the server back to 1.21.1 (where Baritone and crafting work) or
update `launch-client.sh` and README to reflect 1.21.11. Add a note in README about the 1.21.11
limitations documented in `.hermes.md`.

---

### CFG-02: 8 of 10 Multi-Agent SOUL Files Missing

**Files:** `launch-agents.sh` line 18; root SOUL files

**Issue:** `launch-agents.sh` supports 10 bots: Steve, Alex, Liam, Emma, Noah, Olivia, Ethan,
Sophia, Mason, Ava. SOUL files exist for: `SOUL-steve.md`, `SOUL-alex.md`, `SOUL-anthony.md`,
`SOUL-jeffrey.md`, `SOUL-john.md`, `SOUL-minecraft.md`. Liam, Emma, Noah, Olivia, Ethan,
Sophia, Mason, and Ava have no SOUL file. Per `config.js` lines 25-28, these fall back to
`SOUL-minecraft.md` (the generic soul). All 8 bots will share one personality, behaving
identically in the world — defeating the purpose of distinct multi-agent personas.

**Impact:** Multi-agent runs with >2 bots are functionally degraded — no personality
differentiation.

**Fix approach:** Create SOUL files for each bot name, or explicitly document that
`SOUL-minecraft.md` is the intended shared persona for all bots beyond Steve and Alex.

---

### CFG-03: `AGENT_MODE` Default in `launch-agents.sh` vs `config.js`

**Files:** `launch-agents.sh` line 35; `agent/config.js` line 12

**Issue:** `launch-agents.sh` defaults `AGENT_MODE=open_ended`. `config.js` defaults
`agentMode = 'phased'`. When using `npm run agent` or `steve-start.sh` without the env var,
agents run in phased mode. When using `launch-agents.sh`, agents run in open-ended mode.
This is a behavioral difference that is not documented anywhere.

**Impact:** Operators launching via different scripts get fundamentally different agent
behavior without any indication in the logs until they look at the startup banner.

**Fix approach:** Document the discrepancy explicitly. Consider standardizing on a single
default and requiring `AGENT_MODE` to be set explicitly for any deviation.

---

## Fragile Areas

### FRAGILE-01: `reviewSubtaskOutcome` Keyword Matching is Brittle

**Files:** `agent/index.js` lines 315-347

**Issue:** The expected_outcome check uses regex keyword extraction from a free-text string
that the LLM writes. The item check regex at line 316:
```
/(?:have\s+|have a\s+|in inventory[:\s]+)?([a-z_]+(?:_[a-z]+)*)\s*(?:in inventory|in hand)?/
```
This matches the FIRST occurrence of a snake_case word in the expected_outcome, regardless of
context. For an expected_outcome like `"wooden_pickaxe in inventory"`, it extracts
`wooden_pickaxe`. But for `"have at least 10 iron_ingot in inventory"`, it would extract `at`
(first snake_case-ish word, though `at` is short). More critically, the check only fires if
`expected.includes('have ')` or `expected.includes('inventory')` — this gate is correct.

The position check regex at line 328 requires the exact phrase pattern `"be at X Y Z"` or
similar. Any variation like `"reached coordinates -120 64 30"` or `"near (-120, 64, 30)"`
would fail to match, causing the review to silently pass (default `passed = true`).

**Impact:** Reviews can silently pass (false positive) when no keywords match, rewarding the
agent for subtasks it may not have completed. Over time this corrupts task state.

**Fix approach:** Add explicit fallback behavior: if NO keyword check fired, log a warning
and consider the review inconclusive (pass with warning) rather than silently passing.

---

### FRAGILE-02: Pipeline Pre-Computation Shares `systemPrompt` With Main Tick

**Files:** `agent/index.js` lines 942-961

**Issue:** The pipelining block at lines 942-961 calls `queryLLM(systemPrompt, nextUserMessage)`
using the `systemPrompt` variable from the enclosing `tick()` scope. This is correct at
first glance. However, the `systemPrompt` captured here includes the game state summary from
the CURRENT tick, not the upcoming tick. The pre-computed response returned to the next tick's
`tick()` call may be stale if game state changes significantly between the two LLM calls
(which is likely during a mine or navigate action that takes several seconds).

This is by design ("pre-think"), but the pre-computed response is used without re-validating
it against the new state (line 762: `if (precomputedResponse && !stuckInfo && !playerChatContext)`).
A pre-computed `craft` action might reference inventory items that were used or dropped between
ticks.

**Impact:** Pre-computed actions occasionally execute against stale state. The existing
`validatePreExecution` gate catches some cases (inventory checks), but not all.

**Fix approach:** Acceptable design trade-off, but `validatePreExecution` should be run on
the pre-computed response against the NEW state before using it. Currently it only runs on
line 806 after the `if (precomputedResponse)` branch exits the if/else — so pre-computed
actions DO pass through `validatePreExecution`. This mitigates the risk. Documented for
awareness.

---

## Test Coverage Gaps

### TEST-01: `trimHistoryGraduated` Exported But Only Tested for Round Boundaries

**Files:** `agent/tests/llm.test.js`; `agent/llm.js` line 71

**Issue:** The test suite at `agent/tests/llm.test.js` covers:
- Round boundary removal
- Orphaned tool message cleanup
- Empty history no-op
- Minimum removal amount
- First-message-is-user invariant

Not covered:
- The double-trim bug (BUG-01 above) — no test verifies that a single context overflow call
  results in exactly 25% removed, not 44%
- `completeToolCall` behavior when history is empty
- `queryLLM` retry logic with context overflow
- `parseResponseFallback` with malformed Hermes XML

**Impact:** BUG-01 was not caught by tests because no test exercises the full retry path.

**Fix approach:** Add integration-level tests that mock the OpenAI client and verify that
exactly one `trimHistoryGraduated(0.25)` call fires per overflow event.

---

### TEST-02: No Tests for `plan_task` / `update_task` / `reviewSubtaskOutcome`

**Files:** `agent/index.js` lines 208-380

**Issue:** The entire task planning subsystem (plan_task, update_task, reviewSubtaskOutcome,
retry logic, auto-advance) has zero test coverage. These are complex state machines with edge
cases (blocked subtasks, retry_count overflows, pending review not found).

**Impact:** High risk — a regression in task state management could cause the agent to loop
indefinitely on a single subtask or mark tasks complete that weren't.

**Fix approach:** Add `agent/tests/tasks.test.js` covering: create plan, mark done (immediate),
mark done with expected_outcome (deferred), failed retry increment, max retries → blocked,
auto-advance to next pending, reviewSubtaskOutcome pass, reviewSubtaskOutcome fail + retry.

---

### TEST-03: No Tests for `validatePreExecution`

**Files:** `agent/actions.js` lines 82-194

**Issue:** `validatePreExecution` contains complex craft-prerequisite logic covering 10+ item
types. No tests verify these checks.

**Impact:** A typo in the item name strings (e.g., `iron_pickaxe` vs `iron_pick`) would
silently block valid actions with no test catching it.

**Fix approach:** Add `agent/tests/actions.test.js` with mock inventory states exercising
each validation branch.

---

## Missing Documentation / Config

### DOC-01: README References Features That Are Disabled on Production (Baritone, Crafting)

**Files:** `README.md` lines 25-26, 101, 163, 176, 381, 394; `.hermes.md` lines 42-43

**Issue:** README prominently features Baritone pathfinding and crafting as core capabilities
with specific tool descriptions. `.hermes.md` documents that both are disabled on the 1.21.11
production deployment. A new contributor following the README will install Baritone, expect
crafting to work, and be confused when neither functions.

**Fix approach:** Add a "Production Status" section to README noting the 1.21.11 limitations
and linking to `.hermes.md` for the current known-issues list.

---

### DOC-02: `.hermes.md` Is a Gitignored Operational Note, Not Checked In

**Files:** `.hermes.md`; `.gitignore` (unverified)

**Issue:** `.hermes.md` contains critical operational context about the production deployment
(Glass server, ports, Java version requirements, Gradle constraints, known 1.21.11 API
changes). This file was listed as `??` in git status — untracked. If this file is not
committed, production context is lost if the local checkout is cleaned.

**Fix approach:** Either commit `.hermes.md` as project documentation, or extract its content
into a committed `DEPLOYMENT.md`.

---

### DOC-03: No `CONTRIBUTING.md` or Development Setup Instructions

**Files:** `README.md`

**Issue:** The README covers user-facing setup but does not document:
- How to run the test suite (`node --test agent/tests/llm.test.js`)
- How to run a single agent locally without a full MC server
- What environment variables are required vs optional
- How to add a new SOUL file
- How to add a new tool (requires changes in `tools.js`, `actions.js` VALID_ACTIONS +
  ACTION_SCHEMAS + INFO_ACTIONS if applicable, and `index.js` if/else handler)

**Impact:** New contributors will not know where to start.

---

*Concerns audit: 2026-03-20*
