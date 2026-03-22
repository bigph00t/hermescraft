---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Mineflayer Rewrite
status: defining_requirements
last_updated: "2026-03-22T00:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Agents feel and play like real people
**Current focus:** Defining requirements for v2.0

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-22 — Milestone v2.0 started

## Accumulated Context

### Why v2.0
- v1.0-v1.1 architecture (Fabric mod + HTTP bridge + Baritone) is fundamentally broken
- Every game action fights the HTTP bridge: crosshair drift, coordinate bugs, race conditions
- Agents narrate fantasy gameplay instead of actually playing
- Mineflayer eliminates all of this with direct bot API

### Architecture decision
- Mind (LLM) + Body (Mineflayer skill functions)
- LLM called every 15-30s for decisions, not every 2s tick
- Skill functions execute autonomously between LLM calls
- Reference: Mindcraft (kolbytn/mindcraft) for patterns

## Blockers

None currently.

## Session Log

- 2026-03-22: Milestone v2.0 started — Mineflayer Rewrite
