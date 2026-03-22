---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Creative Building + Bug Fixes
status: Phase complete — ready for verification
last_updated: "2026-03-22T20:52:46.269Z"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 4
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Agents feel and play like real people — creative, emotional, able to interact with the world
**Current focus:** Phase 08 — blueprint-intelligence

## Current Position

Phase: 08 (blueprint-intelligence) — COMPLETE
Plan: 2 of 2 (all plans complete)

## Performance Metrics

**Velocity:**

- Total plans completed: 2
- Average duration: 13.5min
- Total execution time: 27min

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 07-live-testing-bug-fixes | 01 | 12min | 2 | 4 |
| 07-live-testing-bug-fixes | 02 | 15min | 1 | 2 |
| 08-blueprint-intelligence | 01 | 3min | 2 | 10 |
| 08-blueprint-intelligence | 02 | 3min | 2 | 4 |

*Updated after each plan completion*

## Accumulated Context

### Key Architecture Decisions

- Mind + Body split: LLM layer (mind/) never imports skill functions; body/ never calls LLM
- Event-driven LLM: fires on chat received, skill complete, or idle — not on a fixed tick
- NO ARTIFICIAL DELAYS: the Mind should think as fast and often as possible
- Cooperative interrupt: every skill checks `bot.interrupt_code` after every `await`
- Text mode only for LLM — !command parsing, not tool_choice (MiniMax M2.7 reliability)
- Build skill saves state every 5 blocks for cross-session resume
- Blueprint JSON: LLM generates it as !command text, not structured output — needs validation layer
- Normalizer: registry identity check (=== ITEM_REGISTRY) gates item-only aliases — iron_ore/gold_ore block lookups are NOT aliased to raw_iron/raw_gold (07-01)
- Smoke test pattern: pure Node.js ESM, no test framework, assert(name, condition) helper, process.exit(failed>0?1:0) (07-02)
- bot.js and start.js excluded from smoke test imports — both attempt live MC server connection (07-02)
- validateBlueprint() infers size from grid when size field absent — LLM need not include it (08-01)
- Validator collects ALL errors before returning — LLM sees full issue list, not just first (08-01)
- Only preferred[0] validated against mcData; preferred[1+] are fallback alternatives (08-01)
- designAndBuild() in mind/index.js orchestrates separate LLM call for !design; handled in think() before dispatch (08-02)
- Generated blueprints written to body/blueprints/_generated.json — avoids API changes to build() (08-02)
- Two-stage JSON extraction for LLM blueprint output: strip think tags -> direct parse -> regex {[\s\S]*} fallback (08-02)
- !design registry entry is a stub for listCommands() coverage; real logic is pre-dispatch in think() (08-02)

### Critical Pitfalls (from v2.0)

- Pathfinder hang: always wrap goto() in wall-clock timeout
- Silent dig/place: verify block state with bot.blockAt() after every action
- CJS import for mineflayer-pathfinder: `import mpf from 'mineflayer-pathfinder'; const { goals } = mpf`
- v1 memory contamination: do NOT load v1 MEMORY.md
- MiniMax M2.7 !command compliance: needs live smoke test in Phase 7

### Research Flags

- LLM-generated JSON blueprint reliability: validate output before passing to build skill
- Reference blueprint format: must match existing body/blueprints/ JSON schema exactly

### Pending Todos

None yet.

### Blockers/Concerns

None currently.

## Session Log

- 2026-03-22: Milestone v2.1 started — Creative Building + Bug Fixes
- 2026-03-22: Roadmap created — 4 phases (7-10), 9/9 requirements mapped
- 2026-03-22: Plan 07-01 complete — fixed deps, ore alias, and missing prompt commands
- 2026-03-22: Plan 07-02 complete — 152-assertion smoke test, npm test passes 0 failures
- 2026-03-22: Phase 07 complete — all v2 bug fixes and smoke test gate shipped
- 2026-03-22: Plan 08-01 complete — 8 new blueprints + validateBlueprint() with 41-assertion TDD suite
- 2026-03-22: Plan 08-02 complete — !design pipeline: buildDesignPrompt() + designAndBuild() + registry wiring, 194 smoke tests pass
- 2026-03-22: Phase 08 complete — blueprint intelligence shipped
