---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Mineflayer Rewrite
status: ready_to_plan
last_updated: "2026-03-22T00:00:00.000Z"
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Agents feel and play like real people — creative, emotional, able to interact with the world
**Current focus:** Phase 1 — Bot Foundation + Core Skills

## Current Position

Phase: 1 of 6 (Bot Foundation + Core Skills)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-03-22 — v2.0 roadmap created

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

## Accumulated Context

### Key Architecture Decisions

- Mind + Body split: LLM layer (mind/) never imports skill functions; body/ never calls LLM — boundary is enforced
- Event-driven LLM: fires on chat received, skill complete, or 2s idle — not on a fixed tick
- Cooperative interrupt: every skill checks `bot.interrupt_code` after every `await` — no forced termination
- v1 data isolation: fresh `data/jeffrey/` and `data/john/` directories; v1 data archived as `*_v1/`

### Critical Pitfalls (from research)

- Pathfinder hang: wrap `goto()` in 30s wall-clock timeout — required in Phase 1 before any skill is built on nav
- Silent dig/place: verify block state changed with `bot.blockAt()` after every dig and place
- Item name normalization: prerequisite for every skill — port v1 normalizer before writing any skill
- Context overflow: cap at 40 turns with progressive summarization (oldest 10 → 500-char summary)
- v1 memory contamination: do NOT load v1 MEMORY.md — contains dead action vocabulary

### Research Flags

- Phase 1: Validate `mineflayer-pathfinder` 2.4.5 live on Paper 1.21.1 before full skill dev (issue #222 behavior)
- Phase 3: MiniMax M2.7 `!command` syntax compliance needs smoke test — not tested against this model

### Pending Todos

None yet.

### Blockers/Concerns

None currently.

## Session Log

- 2026-03-22: Milestone v2.0 started — Mineflayer Rewrite
- 2026-03-22: v2.0 roadmap created — 6 phases, 30 requirements mapped
