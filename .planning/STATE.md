---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Creative Building + Bug Fixes
status: ready_to_plan
last_updated: "2026-03-22T21:30:00.000Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Agents feel and play like real people — creative, emotional, able to interact with the world
**Current focus:** Phase 7 — Live Testing + Bug Fixes

## Current Position

Phase: 7 of 10 (Live Testing + Bug Fixes)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-03-22 — v2.1 roadmap created (4 phases, 9 requirements mapped)

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

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
