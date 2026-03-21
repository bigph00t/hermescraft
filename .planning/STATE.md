---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in-progress
last_updated: "2026-03-21T20:47:31Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 4
  completed_plans: 1
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Agents feel and play like real people with spatial awareness, creativity, and genuine interaction
**Current focus:** Phase 01 — Paper Server + Plugin Stack

## Current Phase

**Phase 1: Paper Server + Plugin Stack**

- Status: In progress (1/4 plans complete)
- Goal: Migrate to Paper, install 12 plugins, verify clients connect
- Current plan: 01-02 (plugin installation wave 1)

## History

### v1.0 (completed 2026-03-21)

- Built full agent harness: Node.js with multi-level memory, skills, vision, social, locations
- HermesBridge Fabric mod: HTTP API for game state + actions
- 3-loop architecture: action (2s), vision (10s), planner (20-30s)
- Claude Haiku vision, MiniMax M2.7 for text
- Two agents: Jeffrey Enderstein, John Kwon with deep SOUL personalities
- Known issues: Baritone underground tunneling, chat truncation, no spatial awareness

### v2.0 (starting)

- Paper server migration for plugin support
- 12 plugins for enhanced gameplay (Timber, VeinMiner, mcMMO, etc.)
- Spatial awareness rework: look+break instead of blind Baritone
- Brain-hands-eyes architecture with action queue

## Blockers

None currently.

## Decisions

- Paper over Fabric server — plugin ecosystem
- Skript for custom commands — no Java compilation needed
- Look+break as primary interaction — prevents underground tunneling
- No artificial token limits — let LLM generate naturally
- Peaceful difficulty — focus on building and cooperation
- Paper 1.21.1 build #133 as server platform (01-01)
- RCON on port 25575 for runtime server configuration (01-01)
- enforce-secure-profile=false for offline-mode bot access (01-01)

## Session Log

- 2026-03-21: Completed 01-01 (Paper server setup + world migration). Paper running, both clients connected.
