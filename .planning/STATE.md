---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Creative Building + Bug Fixes
status: ready_to_plan
last_updated: "2026-03-22T21:30:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Agents feel and play like real people — creative, emotional, able to interact with the world
**Current focus:** Defining requirements for v2.1

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-22 — Milestone v2.1 started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

*Updated after each plan completion*

## Accumulated Context

### Key Architecture Decisions

- Mind + Body split: LLM layer (mind/) never imports skill functions; body/ never calls LLM — boundary is enforced
- Event-driven LLM: fires on chat received, skill complete, or idle — not on a fixed tick
- NO ARTIFICIAL DELAYS: the Mind should think as fast and often as possible
- NO ARTIFICIAL CAPS: don't hardcode turn limits, message limits, or action limits
- Cooperative interrupt: every skill checks `bot.interrupt_code` after every `await`
- Text mode only for LLM — !command parsing, not tool_choice (MiniMax M2.7 reliability)
- Two-export combat: attackTarget (body tick) + combatLoop (LLM dispatch)
- isSkillRunning as getter callback from mind/ to body/ — preserves boundary
- bot.homeLocation as mind/body boundary for shelter behavior
- getBuildContextForPrompt is pure formatter — no body/ imports in prompt.js
- Build skill saves state every 5 blocks for cross-session resume

### Critical Pitfalls (from v2.0)

- Pathfinder hang: always wrap goto() in wall-clock timeout
- Silent dig/place: verify block state with bot.blockAt() after every action
- CJS import for mineflayer-pathfinder: `import mpf from 'mineflayer-pathfinder'; const { goals } = mpf`
- v1 memory contamination: do NOT load v1 MEMORY.md

### Research Flags

- MiniMax M2.7 !command compliance still needs live smoke test
- LLM-generated JSON blueprint reliability needs testing — may need structured output validation

### Pending Todos

None yet.

### Blockers/Concerns

None currently.

## Session Log

- 2026-03-22: Milestone v2.1 started — Creative Building + Bug Fixes
