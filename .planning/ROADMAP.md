# Roadmap: HermesCraft

## Milestones

- ✅ **v1.0 Paper Migration + Plugin-Enhanced Agents** — Phases 1-4 (shipped 2026-03-22)
- 🚧 **v1.1 Tool Quality & Building Intelligence** — Phases 5-8 (in progress)

## Phases

<details>
<summary>✅ v1.0 Paper Migration + Plugin-Enhanced Agents (Phases 1-4) — SHIPPED 2026-03-22</summary>

- [x] Phase 1: Paper Server + Plugin Stack (4/4 plans) — completed 2026-03-21
- [x] Phase 2: Spatial Awareness + Architecture Rework (4/4 plans) — completed 2026-03-21
- [x] Phase 3: Plugin Integration + Custom Commands (4/4 plans) — completed 2026-03-21
- [x] Phase 4: Personality + Creative Play (3/3 plans) — completed 2026-03-22

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Tool Quality & Building Intelligence (In Progress)

**Milestone Goal:** Fix every broken tool primitive and build real building ability so the LLM's good reasoning actually translates to successful in-game execution.

- [x] **Phase 5: Tool Primitives** — Fix place, equip, chest interaction, mine removal, and sustained action lock in one mod rebuild (completed 2026-03-22)
- [x] **Phase 6: Crafting Intelligence** — Full recipe chain solver so the agent can craft wooden_pickaxe from oak_log in a single plan step (completed 2026-03-22)
- [x] **Phase 7: Building Intelligence** — Freestyle building with LLM-designed plans, block placement tracking, and post-build verification (completed 2026-03-22)
- [ ] **Phase 8: Spatial Memory + Server Scripts** — Persistent typed world map, proximity-filtered prompt injection, new Skript server commands

## Phase Details

### Phase 5: Tool Primitives
**Goal**: Agents can place blocks reliably, interact with chests, break blocks only from the surface, and never get stuck from a sustained action lockout
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, CHEST-01, CHEST-02
**Success Criteria** (what must be TRUE):
  1. Agent places a block on a visible surface without the LLM needing to supply an air coordinate — place succeeds even when the item was crafted mid-session into main inventory slots 9-35
  2. Agent deposits items into a nearby chest and the chest contents update correctly; agent withdraws a specific item and it appears in inventory
  3. Agent never uses the mine action — all block breaking goes through look_at_block + break_block
  4. LLM-generated item names (e.g. "sticks", "oak_planks_4") are transparently normalized to valid 1.21.1 registry names before any dispatch, with no silent failures
  5. After a sustained action times out, the agent's next action dispatches immediately without a permanent stuck state
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — normalizer.js + mine action removal (agent-only, zero risk)
- [x] 05-02-PLAN.md — ActionExecutor.java: smart place + sustained action timeout fix + chest_deposit/chest_withdraw (single mod rebuild)
- [x] 05-03-PLAN.md — Agent-side smart_place/chest tool wiring + end-to-end verification

### Phase 6: Crafting Intelligence
**Goal**: Agent resolves full crafting dependency chains at plan time so complex recipes execute in the minimum number of ticks without trial-and-error
**Depends on**: Phase 5 (normalizer.js required for correct ingredient name matching)
**Requirements**: CRAFT-01, CRAFT-02
**Success Criteria** (what must be TRUE):
  1. Agent successfully crafts a wooden_pickaxe starting from only oak_log — the full chain (log → planks → sticks → pickaxe) executes without manual intervention or mid-chain failures
  2. Crafting a recipe that requires a crafting table issues two actions (open table, then craft) correctly — no single-call 3x3 recipe failure
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — crafter.js: BFS recipe chain solver using minecraft-data 3.105.0; declare minecraft-data in package.json
- [x] 06-02-PLAN.md — Planner integration: expand abstract `craft X` queue entries into dependency-ordered action steps via solveCraft

### Phase 7: Building Intelligence
**Goal**: Agent generates an LLM-designed building plan, executes it block-by-block, tracks every placed block, and verifies the result against the original design
**Depends on**: Phase 5 (smart place must work before building is attempted)
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04
**Success Criteria** (what must be TRUE):
  1. Agent writes a markdown building plan (structure name, dimensions, block list, placement sequence) to a context file and executes it block-by-block using smart place — no hardcoded blueprint required
  2. Building plan is rejected before queuing if it requires more than 10% non-inventory materials, preventing mid-build stalls
  3. Every block placed via smart place is appended to a persistent placed-blocks log (block type, position, timestamp) that survives agent restarts
  4. After completing a build, the agent uses vision output + placement log to confirm the structure matches the plan and logs a pass/fail result
**Plans**: 3 plans

Plans:
- [x] 07-01-PLAN.md — freestyle.js parser + placement-tracker.js module (new standalone modules)
- [x] 07-02-PLAN.md — Wire freestyle execution into planner + placement tracking into actions + startup init
- [x] 07-03-PLAN.md — Post-build verification: placed_count keyword in reviewSubtaskOutcome + prompt injection

### Phase 8: Spatial Memory + Server Scripts
**Goal**: Agent maintains a typed, proximity-filtered world map of resource patches and build sites, and new server commands give it richer environmental awareness
**Depends on**: Phase 5 (independent, but benefits from building features being stable so build sites are tracked from the start)
**Requirements**: SPACE-01, SPACE-02, SCRIPT-01
**Success Criteria** (what must be TRUE):
  1. Agent records typed resource patches (ore vein, tree cluster, build site) to persistent spatial memory and navigates back to them by name in a later session
  2. Spatial memory prompt injection only includes entries within a configurable proximity radius — a session with 100+ recorded locations does not produce a prompt larger than the cap
  3. `/where`, `/nearbyplayers`, and `/checkblock` server commands are available in-game and return correctly formatted output that command-parser.js can consume
**Plans**: 2 plans

Plans:
- [ ] 08-01-PLAN.md — Typed resource patches in locations.js, proximity-filtered prompt injection for locations/resources/chests
- [ ] 08-02-PLAN.md — Skript wrappers (where.sk, nearbyplayers.sk, checkblock.sk) + command-parser.js + tool wiring

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7 → 8

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Paper Server + Plugin Stack | v1.0 | 4/4 | Complete | 2026-03-21 |
| 2. Spatial Awareness + Architecture | v1.0 | 4/4 | Complete | 2026-03-21 |
| 3. Plugin Integration + Custom Commands | v1.0 | 4/4 | Complete | 2026-03-21 |
| 4. Personality + Creative Play | v1.0 | 3/3 | Complete | 2026-03-22 |
| 5. Tool Primitives | v1.1 | 3/3 | Complete   | 2026-03-22 |
| 6. Crafting Intelligence | v1.1 | 2/2 | Complete   | 2026-03-22 |
| 7. Building Intelligence | v1.1 | 3/3 | Complete   | 2026-03-22 |
| 8. Spatial Memory + Server Scripts | v1.1 | 0/2 | Not started | - |

---
*Roadmap created: 2026-03-21*
*v1.0 shipped: 2026-03-22*
*v1.1 roadmap added: 2026-03-21*
