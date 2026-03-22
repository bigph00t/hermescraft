---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Mineflayer Rewrite
status: Phase complete — ready for verification
last_updated: "2026-03-22T19:50:51.814Z"
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 13
  completed_plans: 13
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Agents feel and play like real people — creative, emotional, able to interact with the world
**Current focus:** Phase 06 — creative-building

## Current Position

Phase: 06 (creative-building) — EXECUTING
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
| Phase 03-mind-loop-llm P03-01 | 2m 23s | 2 tasks | 3 files |
| Phase 03-mind-loop-llm P03-02 | 1m 30s | 2 tasks | 3 files |
| Phase 04-survival-modes P04-01 | 2min | 2 tasks | 2 files |
| Phase 04-survival-modes P04-02 | 2m 6s | 2 tasks | 3 files |
| Phase 05-personality-social P05-01 | 2min | 2 tasks | 4 files |
| Phase 05-personality-social P05-02 | 3min | 2 tasks | 4 files |
| Phase 06-creative-building P06-01 | 2m 12s | 2 tasks | 5 files |
| Phase 06-creative-building P06-02 | 4min | 2 tasks | 4 files |

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
- [03-01] Text mode only in queryLLM — no tool_choice; MiniMax M2.7 thinking model ignores brevity constraints and may not produce tool calls reliably; !command text is the resilient path
- [03-01] Mind boundary: only mind/registry.js imports from body/; mind/llm.js and mind/prompt.js are boundary-clean; enforced by code structure
- [03-01] parseCommand uses matchAll with capture groups for named/quoted args + positional fallback for bare !gather oak_log 10 style
- [03-01] registry.js parseInt() wraps all numeric args — parseCommand produces strings, body/ skills expect numbers
- [04-01] Two-export combat design: attackTarget (body tick, non-blocking single action) + combatLoop (LLM dispatch, blocking sustained loop) — separates reactive body behaviors from blocking LLM-dispatched skills
- [04-01] HOSTILE_MOBS exported from combat.js for body/modes.js reuse — single source of truth, 42 entries for MC 1.21.1
- [04-01] Registry !combat uses nearestEntity(e.type === 'mob') not HOSTILE_MOBS filter — LLM explicitly chose to attack, any nearby mob is valid
- [04-02] isSkillRunning exported as getter from mind/index.js — passed as callback from start.js so body/ never imports mind/
- [04-02] checkCombat in body tick uses attackTarget (single hit/tick, non-blocking) not combatLoop — prevents body tick from being blocked for full combat duration (Pitfall 2)
- [04-02] Survival Priority 1 fires even during active skills; starvation override at food<=2 eats unconditionally; hazard flee cooperatively interrupts running skill via requestInterrupt()
- [05-01] No history.json persistence in memory.js — stale conversation context does more harm than good; v2 starts clean each session
- [05-01] getPlayersForPrompt takes bot object directly — reads bot.players + bot.entities for nearby detection; no intermediate array needed
- [05-01] partner seeded at sentiment:3/acquaintance in social.js — jeffrey and john recognize each other from session 1, not treated as strangers
- [05-01] getLocationsForPrompt radius 500 blocks (v1: 150) — open world exploration warrants wider location awareness
- [05-02] bot.homeLocation as mind/body boundary — setHome() updates locations.json, start.js sets bot.homeLocation, modes.js reads it without any mind/ import
- [05-02] timeLabel() uses 7 rich labels — dusk/night/late-night labels include shelter guidance baked into the time string
- [05-02] Night shelter Priority 0, gated on !getSkillRunning() — shelter does not interrupt active skills; unlike starvation which overrides unconditionally
- [05-02] Anti-hallucination constraint injected as Part 2 of system prompt — immediately after SOUL identity, before memory/social/locations
- [06-01] Blueprint name lookup tries both snake_case and kebab-case filename forms — callers using 'small_cabin' or 'small-cabin' both resolve correctly
- [06-01] Build skill saves state every 5 blocks (not every block) — reduces disk write pressure while maintaining reasonable resume granularity
- [06-01] Nav failure on build block = skip-and-continue (not abort) — mirrors gather.js pattern; prevents permanent stall from terrain obstacles
- [06-02] getBuildContextForPrompt is a pure formatter in prompt.js (no body imports); mind/index.js passes data in — cleaner module boundary
- [06-02] mind/index.js imports getActiveBuild and listBlueprints from body/ directly — pure read-only getters, pragmatic wiring layer exception (same as start.js)
- [06-02] Build context injected as Part 5.5 (between locations and commands) so LLM sees blueprint catalog before command syntax

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
- 2026-03-22: Completed 03-01 — mind/llm.js, mind/prompt.js, mind/registry.js created; LLM client + history + !command parser + prompt builder + command dispatch bridge; MIND-02, MIND-03 complete
- 2026-03-22: Completed 04-01 — body/skills/combat.js created (attackTarget + combatLoop + HOSTILE_MOBS 42-entry Set); !combat wired into mind/registry.js; SKILL-06, MODE-02 complete
- 2026-03-22: Completed 04-02 — body/modes.js created (300ms body tick, 5-priority cascade: survival+flee, combat, unstuck, item pickup, idle look); isSkillRunning exported from mind/index.js; initModes wired in start.js; MODE-01, MODE-03, MODE-04, MODE-05 complete; Phase 04 complete
- 2026-03-22: Completed 05-01 — mind/config.js, mind/memory.js, mind/social.js, mind/locations.js created; SOUL discovery, per-agent data dirs, player sentiment tracking with partner pre-seeding, named waypoints; SOUL-01, SOUL-02, SOUL-04 complete
- 2026-03-22: Completed 05-02 — start.js + mind/index.js wired with config+memory+social+locations; mind/prompt.js extended with anti-hallucination grounding, rich time labels, memory/social/locations injection; body/modes.js night shelter Priority 0; all SOUL-01 through SOUL-05 complete; Phase 05 complete
- 2026-03-22: Completed 06-01 — body/blueprints/ directory with 4 JSONs (small-cabin, animal-pen, crop-farm, watchtower); body/skills/build.js with full placement loop, cooperative interrupt, cross-session persistence, inventory check; SKILL-05, BUILD-01 complete
- 2026-03-22: Completed 06-02 — !build wired in registry, initBuild in start.js, getBuildContextForPrompt in prompt.js, build context injected every tick, build completion records worldKnowledge + location; BUILD-02, BUILD-03, SKILL-05 complete; Phase 06 complete; v2.0 milestone DONE
