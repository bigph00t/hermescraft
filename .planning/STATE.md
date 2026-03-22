---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Tool Quality & Building Intelligence
status: unknown
last_updated: "2026-03-22T05:17:39.386Z"
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 8
  completed_plans: 8
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Agents feel and play like real people — creative, emotional, with desires, aesthetic sense, and the ability to interact with what they see
**Current focus:** Phase 07 — building-intelligence

## Current Position

Phase: 8
Plan: Not started

## Performance Metrics

**Velocity:**

- Total plans completed: 0 (v1.1)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 5. Tool Primitives | 0/3 | — | — |
| 6. Crafting Intelligence | 0/2 | — | — |
| 7. Building Intelligence | 0/3 | — | — |
| 8. Spatial Memory + Server Scripts | 0/2 | — | — |

*Updated after each plan completion*
| Phase 05 P01 | 98s | 2 tasks | 4 files |
| Phase 05 P02 | 5 | 1 tasks | 1 files |
| Phase 05 P03 | 2 | 1 tasks | 3 files |
| Phase 05 P03 | 10 | 1 tasks | 3 files |
| Phase 06 P01 | 2 | 2 tasks | 4 files |
| Phase 06 P02 | 525595min | 1 tasks | 2 files |
| Phase 07 P01 | 2 | 2 tasks | 2 files |
| Phase 07 P02 | 2 | 2 tasks | 3 files |
| Phase 07 P03 | 68s | 2 tasks | 2 files |

## Accumulated Context

### Key Facts for Planning

- Phase 5 requires exactly ONE mod rebuild — batch smart place + chest interaction + timeout fix together, do not split across plans
- normalizer.js and mine removal are agent-only changes (Plans 05-01) — zero rebuild risk, ship first
- minecraft-data 3.105.0 is already in node_modules via mineflayer transitive dep — declare it explicitly in package.json in Phase 6
- freestyle.js parseFreestylePlan() markdown format is undefined — define the contract as the first deliverable of Phase 7 before writing any code
- Craft two-call pattern: 3x3 crafting table recipes require two `craft` calls (open table, then craft) — crafter.js queue expansion must account for this
- Existing builder.js double-place race condition must be resolved before freestyle builder is trusted

### Decisions

- Batch mod rebuild in Phase 5 (one rebuild covers smart place + chest + timeout fix)
- response-driven state updates: embed state changes in action response JSON, not via polling
- planner expands abstract actions into concrete dependency-ordered steps at queue-write time
- each new agent-side module owns exactly one JSON file in data/{name}/
- [Phase 05]: Strip _N numeric suffix only when base name is a valid registry item — prevents raw_iron → raw_iro
- [Phase 05]: Return input unchanged on failed normalization — downstream error is more visible than silent wrong name
- [Phase 05]: Mine handler left intact in mod — unreachable but harmless, avoids mod rebuild
- [Phase 05]: smart_place is an instant action (equip+look+place in one tick, not sustained)
- [Phase 05]: chest actions enforce 6-block distance limit and require explicit x,y,z coordinates
- [Phase 05]: sustained action timeout self-clear uses isDone() check at start of tickSustainedAction
- [Phase 05]: place kept in VALID_ACTIONS for backward compat with queued items, removed from GAME_TOOLS so LLM never sees it
- [Phase 05]: chest_contents auto-parsed inline in executeAction with regex; trackChest errors silently caught to never fail the action
- [Phase 05]: Live testing of smart_place and chest tools deferred by user at checkpoint — code-complete, 8/8 static checks pass
- [Phase 06]: Use minecraft-data directly at startup — no separate recipes.json file to maintain
- [Phase 06]: selectBestVariant tie-breaks by preferring end of recipes array (oak variants last, most common early-game)
- [Phase 06]: solveCraft simulates inventory to avoid redundant prerequisite steps when crafting produces excess
- [Phase 06]: Craft chain expansion happens at queue-write time in planner, not at execution time in action loop
- [Phase 06]: inventoryToMap placed in planner.js — adapts state.inventory array format to solveCraft contract
- [Phase 07]: Soft cap at 200 blocks in parseFreestylePlan() — warns and truncates to prevent runaway builds
- [Phase 07]: getPlacedBlocksForPrompt() shows last 5 entries only — prevents prompt bloat; full array reserved for verification
- [Phase 07]: placed_blocks.json stored as {blocks:[...]} wrapper matching chests.js pattern
- [Phase 07]: getFreestyleProgress() does not expose planFile — template string in planner prompt omits planFile reference to avoid undefined property access
- [Phase 07]: Freestyle progress injected into userContent (not systemPrompt) so it shows per-cycle current state alongside CURRENT PLAN
- [Phase 07]: case 'freestyle' uses block scoping {} to allow const declarations without conflicts with other switch cases
- [Phase 07]: [Phase 07]: advanceFreestyle wired via response.mode === 'queue' check at post-action result site — queuedAction is out of scope there
- [Phase 07]: [Phase 07]: PLACED BLOCKS summary placed after BUILD STATUS section — natural reading order for build context
- [Phase 07]: [Phase 07]: 10% tolerance (0.9 multiplier) in placed_count check — accounts for occasional silent tracking pipeline failures

### Pending Todos

None.

### Blockers/Concerns

None currently.

## History

### v1.0 Paper Migration + Plugin-Enhanced Agents (completed 2026-03-22)

- Paper 1.21.1 server with 12 plugins in Docker on Glass
- Brain-hands-eyes 3-loop architecture (action 2s, vision 10s, planner 30s)
- 37 agent tools (29 game + 8 plugin-backed), creative intelligence, deep SOUL personalities
- Critical issues entering v1.1: place 90% failure rate, no chest interaction, mine goes underground, blueprint builder unusable, wrong item names, no crafting chain solver

## Session Log

- 2026-03-21: Milestone v1.1 started — Tool Quality & Building Intelligence
- 2026-03-21: v1.1 roadmap created — 4 phases (5-8), 11 plans, 15 requirements mapped
- 2026-03-21: Phase 5 planned — 3 plans in 2 waves (batched mod rebuild into single plan)
