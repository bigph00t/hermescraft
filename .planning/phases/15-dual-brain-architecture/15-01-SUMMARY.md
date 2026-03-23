---
phase: 15-dual-brain-architecture
plan: 01
subsystem: mind
tags: [background-brain, llm, dual-brain, talker-reasoner, ring-buffer, atomic-write]
dependency_graph:
  requires:
    - mind/llm.js (getHistory export)
    - openai package (already installed)
  provides:
    - mind/backgroundBrain.js (initBackgroundBrain, getBrainStateForPrompt)
    - data/<agent>/brain-state.json (runtime artifact written by this module)
  affects:
    - start.js (wired in Plan 02)
    - mind/index.js (wired in Plan 02)
    - mind/prompt.js (wired in Plan 02)
tech_stack:
  added: []
  patterns:
    - Secondary OpenAI client with different baseURL (port 8001)
    - Atomic write via writeFileSync + renameSync
    - TTL cache (5s) for file read throttling
    - Ring buffers via array + shift() — same pattern as memory.js
    - _bgRunning guard in try/finally for setInterval skip
    - parseLLMJson with think-tag stripping and markdown fence removal
key_files:
  created:
    - mind/backgroundBrain.js
  modified:
    - .env.example
decisions:
  - "STARTUP_DELAY_MS=10000 (not 5000) — pitfall 3 from research: 10s avoids GPU contention with main brain first tick"
  - "One-shot LLM call per cycle (no secondary conversation history) — simpler, avoids wipe-desync pitfall 5"
  - "Merge new insights into existing rather than replace — preserves ring buffer continuity across cycles"
  - "Cache invalidation on successful write (_cachedState=null) — ensures next getBrainStateForPrompt reads fresh data"
  - "schema_version: 1 added to brain-state.json — future-proof for Plan 02+ schema evolution"
metrics:
  duration: 109s
  completed_date: "2026-03-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 15 Plan 01: Background Brain Core Module Summary

**One-liner:** Self-contained background brain module with secondary OpenAI client (port 8001), 30s setInterval with _bgRunning guard, parseLLMJson safety, atomic renameSync write, TTL-cached read, and ring buffers (20 insights, 50 spatial, 100 partnerObs)

## What Was Built

`mind/backgroundBrain.js` implements the Talker-Reasoner pattern (DeepMind 2024) for HermesCraft agents. The background brain is a fully self-contained module that:

1. Runs on a 30s `setInterval` (configurable via `BACKGROUND_INTERVAL_MS`)
2. Calls a secondary LLM endpoint (Qwen3.5-9B at port 8001) via a dedicated `bgClient` OpenAI instance
3. Parses the response safely (stripping `<think>` blocks and markdown fences)
4. Merges new insights/spatial/constraints into the existing state preserving ring buffer continuity
5. Writes atomically via `writeFileSync + renameSync` (POSIX atomic on local disk)
6. Exposes a TTL-cached read function (`getBrainStateForPrompt()`) that the main brain calls every tick

The module has exactly 2 named exports (`initBackgroundBrain`, `getBrainStateForPrompt`) with no default exports, follows all project conventions (ESM, no-semi, 2-space indent, single quotes, camelCase), and has zero new npm dependencies.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create mind/backgroundBrain.js | daba902 | mind/backgroundBrain.js (306 lines) |
| 2 | Update .env.example with background brain vars | ecaa12d | .env.example (+7 lines) |

## Deviations from Plan

None — plan executed exactly as written.

The STARTUP_DELAY_MS constant was set to 10000ms as explicitly called out in the research (Pitfall 3), matching the plan spec.

## Known Stubs

None. This module creates real infrastructure. The background LLM calls will fail silently (with `[background-brain] cycle error:` logs) if no secondary model is running at port 8001 — this is expected behavior and documented in the research as the correct fallback. The module itself is complete and non-stub.

## Self-Check: PASSED

- mind/backgroundBrain.js: FOUND
- 15-01-SUMMARY.md: FOUND
- commit daba902 (Task 1): FOUND
- commit ecaa12d (Task 2): FOUND
