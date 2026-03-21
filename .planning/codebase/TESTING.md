# Testing Patterns

**Analysis Date:** 2026-03-20

## Test Framework

**Runner:** Node.js built-in test runner (`node:test`) — no external test library
- No config file — tests are invoked directly
- Available since Node 18; no `jest.config.*` or `vitest.config.*` exists

**Assertion Library:** `node:assert/strict` — Node built-in strict equality

**Run Commands:**
```bash
node --test agent/tests/llm.test.js        # Run all tests (currently only one test file)
node --watch --test agent/tests/llm.test.js # Watch mode (Node 20+)
# No npm test script configured in package.json — no "test" script in scripts block
```

**Current status:** All 10 tests pass.

## Test File Organization

**Location:** `agent/tests/` directory — separate from source

**Naming:** `<module>.test.js` — `llm.test.js` covers `llm.js`

**Structure:**
```
agent/
└── tests/
    └── llm.test.js    (the only test file — added in Phase 1)
```

## Test Structure

**Suite Organization:**
```js
import { describe, it, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

describe('Feature description', () => {
  beforeEach(() => {
    clearConversation()  // Reset state before each test
  })

  it('behavior under test', async () => {
    const { trimHistoryGraduated } = await import('../llm.js')
    // ... setup, execute, assert
  })
})
```

**Patterns:**
- `beforeEach` used for state reset (`clearConversation()`)
- Private functions imported via dynamic `await import()` inside each `it` block — because `trimHistoryGraduated` is not exported, the test asserts it IS exported first: `assert.ok(typeof fn === 'function', 'must be exported')`
- Source-reading tests: some tests read the source file directly with `readFileSync` and assert structural properties (absence of forbidden patterns)

## Mocking

**Framework:** None — no mock library used

**Patterns:**
- No external calls are mocked. Tests exercise pure in-memory logic only.
- `llm.js` is tested via its public exports (`setConversationHistory`, `getConversationHistory`, `clearConversation`) and the state manipulation they expose
- The `queryLLM` function (which calls the vLLM HTTP API) is NOT tested — no mock for `OpenAI` client

**What IS tested:** Pure data manipulation functions (history trim, history state management)

**What is NOT mocked/tested:** HTTP calls to vLLM, HTTP calls to mod API (`executeAction`), filesystem I/O

## Fixtures and Factories

**Test Data:**
```js
// Helper function defined in llm.test.js
function makeMsg(role, content = 'x') {
  return { role, content }
}

// Used directly in tests:
setConversationHistory([
  makeMsg('user', 'u1'),
  makeMsg('assistant', 'a1'),
  makeMsg('tool', 't1'),
])
```

**Location:** Inline in test file — no shared fixture directory or factory modules.

## Coverage

**Requirements:** None enforced — no coverage threshold, no CI pipeline

**View Coverage:**
```bash
node --test --experimental-test-coverage agent/tests/llm.test.js
```

**Estimated coverage:** Very low overall (~5% of codebase). Only `llm.js` has tests. No tests for `actions.js`, `index.js`, `prompt.js`, `memory.js`, `skills.js`, `social.js`, `locations.js`, `goals.js`, `state.js`, `config.js`, or `tools.js`.

## Test Types

**Unit Tests:** Yes — `llm.test.js` tests pure functions in `llm.js` in isolation

**Integration Tests:** None

**E2E Tests:** None

## What the Existing Tests Cover

**`llm.test.js` — 10 tests across 3 suites:**

**Suite 1: MEM-01 — `trimHistoryGraduated` round boundary safety** (5 tests)
- Never leaves `role='tool'` message at index 0 after trim
- Removes orphaned tool message at front (pre-existing broken state)
- No-op on empty history
- Removes at least one complete round (minimum 2 messages)
- First message after trim is always `role='user'`

**Suite 2: MEM-02 — Corrupt tool call handler uses graduated trim** (2 tests)
- Source-code assertion: `conversationHistory.length = 0` only appears inside `clearConversation`/`setConversationHistory`
- Source-code assertion: corrupt handler calls `trimHistoryGraduated(0.5)`

**Suite 3: New exports work correctly** (3 tests)
- `getConversationHistory` returns array
- `setConversationHistory` replaces history
- `setConversationHistory(null)` handled gracefully

## Coverage Gaps

**Phase 2 additions — no tests exist:**

**`validatePreExecution` (`agent/actions.js`):**
- All switch cases (`craft`, `equip`, `eat`, `navigate`, `smelt`, `place`) are untested
- `{ valid: false, reason }` return shape not verified
- Edge cases: empty inventory, partial item name matching

**`handleSaveContext` / `handleDeleteContext` (`agent/index.js`):**
- Filename validation (`/\.(md|txt|json)$/i`) untested
- Path traversal sanitization (`filename.replace(/[/\\]/g, '')`) untested
- 5-file limit enforcement untested
- 8000-char limit enforcement untested
- Risk: security-relevant code with no test coverage

**`handlePlanTask` / `handleUpdateTask` (`agent/index.js`):**
- Subtask status transitions untested (`pending` → `in-progress` → `done`/`failed`/`blocked`)
- Retry counter logic (`retry_count >= max_retries` → `blocked`) untested
- Auto-advance to next pending subtask untested
- `expected_outcome` queuing (`pendingReview` state) untested

**Phase 3 additions — no tests exist:**

**`reviewSubtaskOutcome` (`agent/index.js`):**
- Inventory keyword check (`have X in inventory`) untested
- Position coordinate check (`at X,Y,Z`) untested
- Health threshold check (`health above N`) untested
- Pass/fail branching and side effects on `taskState` untested
- `pendingReview` lifecycle (set, check, clear) untested
- Risk: review logic is the core Phase 3 feature; bugs here silently misclassify outcomes

**`buildUserMessage` with `reviewResult` (`agent/prompt.js`):**
- `== REVIEW PASSED ==` and `== REVIEW FAILED ==` prompt sections untested
- Both the passed and failed display branches need coverage

**`social.js` and `locations.js` (Phase 2 — new modules):**
- `trackPlayer` sentiment math untested
- `autoDetectLocations` block detection untested
- `getPlayersForPrompt` / `getLocationsForPrompt` output format untested

**Other high-value untested areas (pre-existing gaps):**
- `parseResponseFallback` (`agent/llm.js`) — all three fallback parsing paths
- `summarizeState` (`agent/state.js`) — output format assertions
- `buildSystemPrompt` (`agent/prompt.js`) — section inclusion logic per mode
- `loadAgentConfig` (`agent/config.js`) — soul file resolution order
