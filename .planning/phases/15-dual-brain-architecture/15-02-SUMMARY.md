---
phase: 15-dual-brain-architecture
plan: 02
subsystem: mind
tags: [background-brain, wiring, prompt-injection, smoke-tests, dual-brain]
dependency_graph:
  requires:
    - mind/backgroundBrain.js (initBackgroundBrain, getBrainStateForPrompt — from Plan 01)
    - mind/index.js (think() call site)
    - mind/prompt.js (buildSystemPrompt options)
    - start.js (agent startup sequence)
  provides:
    - Background brain startup wiring in start.js (step 5.5 after initMind)
    - Brain state injection into every think() LLM call via mind/index.js
    - System prompt Part 5.8 brain state slot in mind/prompt.js
    - Section 17 smoke tests validating all wiring and exports
  affects:
    - Every main brain LLM call (think() now passes brainState to buildSystemPrompt)
    - Agent system prompt (Part 5.8 conditionally injects background brain analysis)
tech_stack:
  added: []
  patterns:
    - Option threading: brainState flows from backgroundBrain.js -> index.js -> prompt.js
    - Conditional prompt section: Part 5.8 only renders when brainState is non-null
    - Source-level smoke test assertions: grep-style pattern checking for wiring correctness
key_files:
  created: []
  modified:
    - start.js (import + call initBackgroundBrain after initMind, step 5.5)
    - mind/index.js (import getBrainStateForPrompt, inject brainState into think())
    - mind/prompt.js (Part 5.8 conditional brainState push between ragContext and Part 6)
    - tests/smoke.test.js (Section 17: 25 new tests, total 319 passing)
decisions:
  - "brainState only passed to think() buildSystemPrompt — not respondToChat() — chat responses stay fast and lightweight"
  - "Part 5.8 placed between ragContext (5.7) and command reference (Part 6) — background brain analysis is context, not instruction"
  - "No changes to respondToChat() or wiki path — background brain is think()-only by design"
metrics:
  duration: 90s
  completed_date: "2026-03-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 4
---

# Phase 15 Plan 02: Background Brain Wiring Summary

**One-liner:** Wired backgroundBrain.js into agent startup (start.js step 5.5), think() loop (brainState injection), and system prompt (Part 5.8) with 25 new smoke tests — 319 total passing

## What Was Built

Connected `mind/backgroundBrain.js` (created in Plan 01) to the rest of the agent system with three minimal wiring changes:

1. **start.js** — added `import { initBackgroundBrain }` and step 5.5 call after `initMind`. The background brain starts its 30s interval 10s after agent startup (GPU contention avoidance is handled inside `initBackgroundBrain`).

2. **mind/index.js** — added `import { getBrainStateForPrompt }` and a single `const brainState = getBrainStateForPrompt()` call inside `think()`, between the RAG retrieval block and the `buildSystemPrompt` call. The `brainState` is added to the options object passed to `buildSystemPrompt`. The `respondToChat()` function is intentionally untouched — chat responses stay fast.

3. **mind/prompt.js** — added Part 5.8 (a 4-line conditional block) between the ragContext injection (Part 5.7) and the command reference (Part 6). When `options.brainState` is non-null, it is pushed as a prompt section. During cold start (no brain-state.json exists yet), `getBrainStateForPrompt()` returns null and Part 5.8 is silently skipped.

4. **tests/smoke.test.js** — added Section 17 with 25 new assertions covering module exports, cold start behavior, source-level pattern checks (renameSync, TTL_MS, _bgRunning, finally, ring buffer cap 20), all three wiring points, and a live prompt integration test confirming brainState injects/omits correctly.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire background brain into start.js, mind/index.js, mind/prompt.js | ed4186a | start.js, mind/index.js, mind/prompt.js |
| 2 | Add smoke tests for background brain module and wiring | 7a9743e | tests/smoke.test.js |

## Deviations from Plan

None — plan executed exactly as written.

The test count ended at 319 (not 318 as estimated in the plan). The extra test is `'no brainState means no Background Brain section'` which was in the plan spec — the estimate was just off by 1.

## Known Stubs

None. The wiring is complete and functional. When a secondary brain server is running at port 8001, `brain-state.json` will be written after 10s and Part 5.8 will render on the next think() call. When no secondary server is running, the background brain logs errors silently and `getBrainStateForPrompt()` returns null — the main brain is unaffected.

## Self-Check: PASSED

- start.js: FOUND initBackgroundBrain import and call
- mind/index.js: FOUND getBrainStateForPrompt import and brainState injection
- mind/prompt.js: FOUND Part 5.8 options.brainState block
- tests/smoke.test.js: FOUND Section 17
- commit ed4186a (Task 1): FOUND
- commit 7a9743e (Task 2): FOUND
- Smoke test result: 319 passed, 0 failed
