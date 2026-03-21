# Testing Patterns

**Analysis Date:** 2026-03-20

## Test Framework

**Runner:** None — no test framework is installed or configured.

**Test files:** Zero. No `*.test.js`, `*.spec.js`, or `__tests__/` directories exist in the project source. All `*.test.*` files found are inside `node_modules/`.

**Config:** No `jest.config.*`, `vitest.config.*`, `mocha.*.js`, or similar files present.

**Run Commands:**
```bash
# No test commands exist. package.json scripts:
npm start      # Runs ./start.sh
npm run agent  # node agent/index.js
npm run dev    # node --watch agent/index.js
```

## Test Coverage

**Coverage:** 0% — no automated tests of any kind.

## What Is Being Validated (Runtime, Not Test-Time)

Despite no test suite, several runtime validation mechanisms exist:

**Action schema validation** (`agent/actions.js`):
```js
export function validateAction(action) {
  if (!action || typeof action !== 'object') return { valid: false, error: 'action must be an object' };
  const type = action.type || action.action;
  if (!VALID_ACTIONS.has(type)) return { valid: false, error: `unknown action type: ${type}` };
  const validator = ACTION_SCHEMAS[type];
  if (validator && !validator(action)) {
    return { valid: false, error: `invalid params for action "${type}"` };
  }
  return { valid: true };
}
```
Called in `agent/index.js` before every `executeAction`. Invalid actions abort the tick.

**LLM response validation** (`agent/llm.js`):
- Tool call JSON arguments validated with `JSON.parse` before storing in history
- Corrupt entries filtered out: `conversationHistory.filter(tc => { try { JSON.parse(...); return true; } catch { return false; } })`

**Phase completion checks** (`agent/goals.js`):
- Each `PHASES[]` entry has a `completionCheck(state)` function that reads inventory
- These are deterministic inventory-check predicates, not tests, but they encode correctness expectations about game state

**Death cause classification** (`agent/memory.js`):
- `generateCountermeasure` encodes rule-based expectations about survival behavior

## Testing Approach in Practice

The project uses **live-environment validation** rather than automated tests:

1. **Manual smoke test**: `curl http://localhost:3001/state` to verify the Fabric mod HTTP API is responding
2. **Agent startup log**: startup banner confirms model URL, tool calling mode, memory count, skill count
3. **Watch mode for development**: `npm run dev` uses `node --watch` for rapid iteration
4. **Session logs as audit trail**: JSONL files written to `agent/data/<name>/sessions/` on every tick — post-hoc review of agent behavior

## Risk Areas With No Test Coverage

**High-risk untested paths:**

- `agent/llm.js` — `parseResponseFallback`: complex regex parsing of 4 fallback formats. A malformed LLM response could silently default to `{ type: 'wait' }` without any indication of which format failed.

- `agent/memory.js` — `parseMemoryMd`: markdown section parser for MEMORY.md. Corruption of this file would silently load empty memory on startup (`{}` default, no error thrown).

- `agent/skills.js` — `parseFrontmatter` / `parseSkillMd`: YAML-like frontmatter parser. Malformed SKILL.md files are silently skipped (`try {} catch {}`).

- `agent/goals.js` — `getProgressDetail`: 7 per-phase inventory evaluation branches. No coverage of edge cases (empty inventory, missing fields, etc.).

- `agent/llm.js` — `trimHistory` / `trimHistoryGraduated`: history splicing logic. Off-by-one errors here could corrupt message role ordering (user/assistant/tool interleaving requirement).

- `agent/actions.js` — `ACTION_SCHEMAS`: each validator is a simple lambda. No test that all validators correctly accept valid inputs and reject invalid ones.

## Skill Files as Behavioral Specs

The closest thing to "specifications" in this codebase are the `agent/skills/*.../SKILL.md` files. Each contains:
- YAML frontmatter with `description`, `metadata.phase`, `metadata.success_rate`
- `## Strategy` section: numbered step-by-step objectives
- `## Tips` section: tactical heuristics
- `## Lessons Learned` section: death-derived countermeasures
- `## Key Actions Used` section: action type sequence

These are injected into the LLM system prompt and serve as behavioral contracts, but they have no automated verification.

Example structure from `agent/skills/minecraft-first-night/SKILL.md` pattern:
```
---
name: minecraft-first-night
description: Survive the first night. Use when in phase 1 (First Night).
metadata:
    phase: "1"
    deaths_before_mastery: "0"
    success_rate: "1.0"
---

## Strategy
1. Punch a tree to get wood logs
2. Craft planks and sticks
...
```

## If Tests Were Added

Given the architecture, the highest-value test targets would be:

**Unit test targets:**
- `agent/llm.js` `parseResponseFallback(text)` — pure function, no dependencies
- `agent/memory.js` `parseMemoryMd(content)` — pure function, no dependencies
- `agent/memory.js` `generateCountermeasure(cause, factors)` — pure function
- `agent/skills.js` `parseFrontmatter(text)` — pure function
- `agent/goals.js` `completionCheck(state)` for each phase — pure inventory predicates
- `agent/actions.js` `validateAction(action)` — pure function

**Integration test targets:**
- `agent/llm.js` `queryLLM` with a mock OpenAI client — test retry/fallback logic
- `agent/index.js` tick loop with mocked `fetchState` and `queryLLM`

**Recommended framework:** Vitest (ESM-native, zero config for ESM projects)

---

*Testing analysis: 2026-03-20*
