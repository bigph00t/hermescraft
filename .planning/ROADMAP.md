# Roadmap: HermesCraft

## Milestones

- ✅ **v1.0 Paper Migration + Plugin-Enhanced Agents** — Phases 1-4 (shipped 2026-03-22)
- ✅ **v1.1 Tool Quality & Building Intelligence** — Phases 5-8 (shipped 2026-03-22)
- 🚧 **v2.0 Mineflayer Rewrite** — Phases 1-6 (in progress)

## Phases

<details>
<summary>✅ v1.0 Paper Migration + Plugin-Enhanced Agents (Phases 1-4) — SHIPPED 2026-03-22</summary>

- [x] Phase 1: Paper Server + Plugin Stack (4/4 plans) — completed 2026-03-21
- [x] Phase 2: Spatial Awareness + Architecture Rework (4/4 plans) — completed 2026-03-21
- [x] Phase 3: Plugin Integration + Custom Commands (4/4 plans) — completed 2026-03-21
- [x] Phase 4: Personality + Creative Play (3/3 plans) — completed 2026-03-22

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Tool Quality & Building Intelligence (Phases 5-8) — SHIPPED 2026-03-22</summary>

- [x] Phase 5: Tool Primitives (3/3 plans) — completed 2026-03-22
- [x] Phase 6: Crafting Intelligence (2/2 plans) — completed 2026-03-22
- [x] Phase 7: Building Intelligence (3/3 plans) — completed 2026-03-22
- [x] Phase 8: Spatial Memory + Server Scripts (2/2 plans) — completed 2026-03-22

Full details: `.planning/milestones/v1.1-ROADMAP.md`

</details>

### 🚧 v2.0 Mineflayer Rewrite (In Progress)

**Milestone Goal:** Replace Fabric mod + HTTP bridge with Mineflayer headless bots. Mind (LLM) + Body (skill functions) architecture. Agents that actually play the game smoothly — no crosshair drift, no HTTP races, no 1GB RAM per agent.

## Phase Checklist

- [x] **Phase 1: Bot Foundation + Core Skills** — Headless bot connects, navigates, digs, places; interrupt harness; gather and mine skills (completed 2026-03-22)
- [x] **Phase 2: Crafting + Inventory** — Craft chain solver, smelt, chest interaction, auto-eat and armor (completed 2026-03-22)
- [ ] **Phase 3: Mind Loop + LLM** — Event-driven self-prompter, command registry, rolling conversation history
- [ ] **Phase 4: Survival Modes** — Autonomous reactive behaviors that run without the LLM: self-preservation, self-defense, unstuck, idle, item collection
- [ ] **Phase 5: Personality + Social** — SOUL files, persistent memory, grounded chat, two-agent coordination, day/night routine
- [ ] **Phase 6: Creative Building** — Real structures from plans, personality-driven build choices, base expansion across sessions

## Phase Details

### Phase 1: Bot Foundation + Core Skills
**Goal**: A headless Mineflayer bot connects to Paper 1.21.1, navigates to coordinates, digs blocks, places blocks, and executes gather and mine skills — all with post-action verification and a cooperative interrupt harness so higher-level skills can safely cancel in-flight operations
**Depends on**: Nothing (first phase)
**Requirements**: BOT-01, BOT-02, BOT-03, BOT-04, BOT-05, SKILL-01, SKILL-02
**Success Criteria** (what must be TRUE):
  1. Bot spawns on Paper 1.21.1 in offline mode and maintains connection without disconnecting
  2. Bot pathfinds to any reachable coordinate and times out cleanly (no hang) when the goal is unreachable
  3. Bot digs a block and post-dig check confirms the block state changed; false success from server-side protection is detected
  4. Bot collects N of a named resource by finding, navigating to, and digging nearest sources until inventory count is met
  5. Bot mines ore with the best tool auto-selected from inventory
**Plans:** 3/3 plans complete
Plans:
- [x] 01-01-PLAN.md — Bot lifecycle, interrupt harness, normalizer (BOT-01, BOT-05)
- [x] 01-02-PLAN.md — Navigate, dig, place primitives with safety wrappers (BOT-02, BOT-03, BOT-04)
- [x] 01-03-PLAN.md — Gather and mine skills (SKILL-01, SKILL-02)

### Phase 2: Crafting + Inventory
**Goal**: Bot resolves full crafting dependency chains, smelts items in furnaces, deposits and withdraws from chests, auto-equips best tools and armor, and eats autonomously — the complete resource management loop
**Depends on**: Phase 1
**Requirements**: SKILL-03, SKILL-04, SKILL-07, SKILL-08
**Success Criteria** (what must be TRUE):
  1. Bot crafts a wooden pickaxe from raw oak logs by resolving the full dependency chain (logs -> planks -> sticks -> pickaxe) without manual recipe decomposition
  2. Bot smelts raw iron by placing it in a furnace with fuel and collecting the output when done
  3. Bot deposits items into a chest and later withdraws them, remembering the chest's location
  4. Bot equips best available tool before digging and eats food when hunger drops below threshold without being told to
**Plans:** 2/2 plans complete
Plans:
- [x] 02-01-PLAN.md — BFS crafting chain solver + craft skill (SKILL-03)
- [x] 02-02-PLAN.md — Smelt, chest, and inventory management skills (SKILL-04, SKILL-07, SKILL-08)

### Phase 3: Mind Loop + LLM
**Goal**: The LLM layer fires on events (chat received, skill complete, idle timeout), outputs !commands the Body executes, and maintains a 40-turn rolling history — the end-to-end Mind + Body pipeline is alive
**Depends on**: Phase 2
**Requirements**: MIND-01, MIND-02, MIND-03, MIND-04
**Success Criteria** (what must be TRUE):
  1. LLM fires when a player sends a chat message and its !command response is executed by the Body within one round-trip
  2. LLM fires after a skill completes and picks the next action without human intervention
  3. Bot re-evaluates and selects a new goal when idle for 2+ seconds with no active task
  4. Conversation history stays at or below 40 turns; oldest turns are compressed, not dropped, when the cap is reached
**Plans:** 1/2 plans executed
Plans:
- [x] 03-01-PLAN.md — LLM client, prompt builder, command registry (MIND-02, MIND-03)
- [ ] 03-02-PLAN.md — Event-driven Mind loop + v2 entry point (MIND-01, MIND-04)

### Phase 4: Survival Modes
**Goal**: Autonomous reactive behaviors run on a 300ms Body tick entirely independent of the LLM — the bot survives hostile mobs, avoids environmental hazards, recovers from stuck pathfinding, picks up nearby items, and feels alive between decisions
**Depends on**: Phase 3
**Requirements**: MODE-01, MODE-02, MODE-03, MODE-04, MODE-05, SKILL-06
**Success Criteria** (what must be TRUE):
  1. Bot eats, flees fire/lava/drowning hazards, and avoids death without the LLM making the decision
  2. Bot attacks hostile mobs that target it and retreats when health is critically low
  3. Bot detects pathfinder hang or wall-stuck state and recovers without human intervention
  4. Bot looks at nearby entities naturally when idle, giving the appearance of awareness
  5. Bot automatically collects dropped items in its vicinity
**Plans:** 1/2 plans executed
Plans:
- [x] 04-01-PLAN.md — Combat skill (attackTarget + combatLoop) and !combat registry wiring (SKILL-06, MODE-02)
- [x] 04-02-PLAN.md — 300ms body tick with 5-priority behavior cascade + start.js wiring (MODE-01, MODE-03, MODE-04, MODE-05)

### Phase 5: Personality + Social
**Goal**: Jeffrey and John load their SOUL personalities, remember lessons across sessions, speak only about what they have actually observed in the game world, coordinate with each other via natural chat, and follow a day/night routine
**Depends on**: Phase 4
**Requirements**: SOUL-01, SOUL-02, SOUL-03, SOUL-04, SOUL-05
**Success Criteria** (what must be TRUE):
  1. Jeffrey and John exhibit distinct personalities (Jeffrey's curiosity vs John's pragmatism) observable in how they choose actions and phrase chat
  2. Lessons and world knowledge from a previous session are present in the next session's behavior without manual loading
  3. Bot never references items, locations, or events it has not actually observed in the current game world
  4. Two bots on the same server exchange messages, cooperate on a task, and do not echo their own messages back as if from another player
  5. Bot goes to shelter at nightfall, reduces activity, and resumes normal behavior at dawn
**Plans**: TBD

### Phase 6: Creative Building
**Goal**: Agents build complete structures — walls, roof, floor — from structured plans, choose what to build based on their personality and the state of the world, and return across sessions to expand their base
**Depends on**: Phase 5
**Requirements**: BUILD-01, BUILD-02, BUILD-03, SKILL-05
**Success Criteria** (what must be TRUE):
  1. Bot places a complete set of blocks from a structured plan (floor, walls, roof) with each placement verified server-side
  2. Jeffrey decides to build something different than John would, driven by their respective personalities and the current game context, without the user scripting the choice
  3. A structure built in session one is recognizably extended or improved in a later session without the user providing instructions
**Plans**: TBD

## Progress

**Execution Order:**
v2.0 phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Bot Foundation + Core Skills | v2.0 | 3/3 | Complete   | 2026-03-22 |
| 2. Crafting + Inventory | v2.0 | 2/2 | Complete   | 2026-03-22 |
| 3. Mind Loop + LLM | v2.0 | 1/2 | In Progress|  |
| 4. Survival Modes | v2.0 | 1/2 | In Progress|  |
| 5. Personality + Social | v2.0 | 0/? | Not started | - |
| 6. Creative Building | v2.0 | 0/? | Not started | - |

---
*Roadmap created: 2026-03-21*
*v1.0 shipped: 2026-03-22*
*v1.1 shipped: 2026-03-22*
*v2.0 roadmap created: 2026-03-22*
