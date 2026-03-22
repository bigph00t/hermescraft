---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Tool Quality & Building Intelligence
status: defining_requirements
last_updated: "2026-03-21T00:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Agents feel and play like real people — creative, emotional, with desires, aesthetic sense, and the ability to interact with what they see
**Current focus:** Defining requirements for v1.1

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-21 — Milestone v1.1 started

## History

### v1.0 Paper Migration + Plugin-Enhanced Agents (completed 2026-03-22)

- Paper 1.21.1 server with 12 plugins in Docker on Glass
- Brain-hands-eyes 3-loop architecture (action 2s, vision 10s, planner 30s)
- Surface-first spatial awareness with look_at_block + break_block
- 37 agent tools (29 game + 8 plugin-backed)
- Creative intelligence: debt counter, BUILD vision evaluation, per-agent creative behaviors
- Deep SOUL personalities with creative drives and anti-meta-game enforcement
- Known critical issues: place action broken, no chest interaction, mine goes underground, blueprint builder unusable, wrong item names, no crafting chain solver

## Accumulated Context

- LLM reasoning is good — tools are what's failing it
- place action needs auto-equip + look-at-surface + place-on-face (like a real player)
- mine must be removed entirely — look_at_block + break_block only
- Agents wander 300+ blocks from base with no tether
- No chest interaction exists — agents can't use shared storage
- Item names wrong (sticks→stick, oak_planks_4→oak_planks)
- No crafting prerequisite chain resolution
- Blueprint builder has impossible material requirements — needs freestyle replacement
- Planner memory was fixed in live session (500-message rolling history)
- Chat filtering partially fixed but still fragile

## Blockers

None currently.

## Decisions

(Carrying forward from v1.0 — see MILESTONES.md for full v1.0 decision history)

## Session Log

- 2026-03-21: Milestone v1.1 started — Tool Quality & Building Intelligence
