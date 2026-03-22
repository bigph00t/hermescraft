---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Mineflayer Rewrite
status: Phase complete — ready for verification
last_updated: "2026-03-22T17:59:15.236Z"
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 5
  completed_plans: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Agents feel and play like real people — creative, emotional, able to interact with the world
**Current focus:** Phase 02 — crafting-inventory

## Current Position

Phase: 02 (crafting-inventory) — EXECUTING
Plan: 2 of 2

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
| Phase 01-bot-foundation-core-skills P01 | 2min | 2 tasks | 5 files |
| Phase 01-bot-foundation-core-skills P02 | 2min | 2 tasks | 3 files |
| Phase 01-bot-foundation-core-skills P03 | 8min | 2 tasks | 2 files |
| Phase 02-crafting-inventory P01 | 4min | 2 tasks | 2 files |
| Phase 02-crafting-inventory P02 | 3min | 3 tasks | 3 files |

## Accumulated Context

### Key Architecture Decisions

- Mind + Body split: LLM layer (mind/) never imports skill functions; body/ never calls LLM — boundary is enforced
- Event-driven LLM: fires on chat received, skill complete, or idle — not on a fixed tick
- NO ARTIFICIAL DELAYS: the Mind should think as fast and often as possible. No arbitrary cooldowns, no forced wait timers, no token-per-minute caps. If the LLM can respond in 0.5s, fire again in 0.5s. Let it think.
- NO ARTIFICIAL CAPS: don't hardcode turn limits, message limits, or action limits. Use graduated trimming when context gets large, but don't preemptively throttle. Let the agent be as active as it wants.
- Cooperative interrupt: every skill checks `bot.interrupt_code` after every `await` — no forced termination
- v1 data isolation: fresh `data/jeffrey/` and `data/john/` directories; v1 data archived as `*_v1/`
- [01-01] Promise-based createBot with 30s spawn timeout — skills await connection before proceeding; spawn_timeout surfaces clearly
- [01-01] bot.interrupt_code on bot object (not module state) — supports multiple concurrent bot instances
- [01-01] normalizeBlockName shares _normalize helper with normalizeItemName — avoids duplicating 9-step pipeline; ALIASES apply to both items and blocks
- [01-01] Movements set inside spawn handler per research Pitfall 6 — new Movements(bot) requires initialized world state
- [01-02] CJS import for mineflayer-pathfinder: import mpf then destructure — `import { goals }` named import fails in Node 24 ESM
- [01-02] timerId pattern in navigateTo: clearTimeout in both success and error paths prevents lingering timer leaks
- [01-02] All body/ primitives return { success, reason } structs and never throw — skills always check result.success
- [01-03] gather uses equipForBlock without requireHarvest — blocks like oak_log/dirt have no harvestTools restriction; enforcing tier would wrongly reject them
- [01-03] mine uses equipForBlock with requireHarvest:true + canHarvestWith() hard stop — wrong tool tier produces no ore drop, so early return avoids spinning through useless candidates
- [01-03] Both skills use bot.findBlocks(count:10) per outer iteration — batch candidates, inner loop tries each, breaks on first successful dig
- [02-01] body/crafter.js is a utility module (not a skill) — solveCraft imported by skills, not dispatched directly; module-level mcData init replaces initCrafter() wrapper
- [02-01] Two-recipe-system bridge: BFS solver uses mcData.recipes for dependency analysis; bot.recipesFor() provides prismarine-recipe objects; raw mcData recipes must never be passed to bot.craft()
- [02-01] findOrPlaceCraftingTable tries 4 cardinal ground offsets for placement — more robust than fixed single position in varied terrain
- [02-02] Fuel count Math.ceil(count/8)+1 — coal smelts 8 items; +1 handles partial fuel safety for edge counts
- [02-02] FOOD_NAMES Set from mcData.foodsArray at module load — O(1) food lookup for eatIfHungry, avoids per-call array search
- [02-02] initChestMemory is explicit call pattern — matches init<Subsystem> convention; chest memory at agent/data/{agentName}/chests.json

### Critical Pitfalls (from research)

- Pathfinder hang: wrap `goto()` in wall-clock timeout — required in Phase 1 before any skill is built on nav
- Silent dig/place: verify block state changed with `bot.blockAt()` after every dig and place
- Item name normalization: prerequisite for every skill — port v1 normalizer before writing any skill
- Context overflow: use graduated trimming when context gets large (summarize oldest turns), but do NOT preemptively cap at a fixed number
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
- 2026-03-22: Completed 01-01 — body/bot.js, body/interrupt.js, body/normalizer.js created; mineflayer-pathfinder + mineflayer-tool installed
- 2026-03-22: Completed 01-02 — body/navigate.js, body/dig.js, body/place.js created; all three action primitives with safety wrappers
- 2026-03-22: Completed 01-03 — body/skills/gather.js and body/skills/mine.js created; Phase 1 complete (3/3 plans done)
- 2026-03-22: Completed 02-01 — body/crafter.js (BFS solver) and body/skills/craft.js (craft skill) created; SKILL-03 complete
- 2026-03-22: Completed 02-02 — body/skills/smelt.js, body/skills/chest.js, body/skills/inventory.js created; SKILL-04, SKILL-07, SKILL-08 complete; Phase 2 complete
