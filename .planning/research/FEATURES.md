# Feature Research: Tool Quality & Building Intelligence

**Domain:** Minecraft AI agent tool execution layer — block placement, building, crafting, chest interaction, spatial memory, task verification
**Researched:** 2026-03-21
**Confidence:** HIGH for table stakes (validated against Mindcraft, Voyager, GITM source code and papers); MEDIUM for differentiators (patterns observed but not universally implemented)

---

## Context: What Other Projects Actually Do

Research covered Voyager (GPT-4 + mineflayer code generation), Mindcraft (parameterized skill library), GITM (hierarchical LLM decomposer), MrSteve (Place Event Memory), Odyssey (40 primitive + 183 compositional skills), and T2BM (LLM-to-building via JSON interlayer).

Key insight: every serious MC bot project implements block placement and crafting as **atomic, correct primitives** — the LLM never gets to guess coordinates or assume inventory state. Tools are designed to be hard to misuse. HermesCraft's existing `place` action requires the LLM to supply exact coordinates and assumes item is already in hotbar — this is the root cause of 90% failure rate.

---

## Table Stakes

Features that every functioning MC bot project treats as solved primitives. Missing = the LLM's good reasoning cannot be executed.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Auto-equip on place | All serious MC bots (Mindcraft, Voyager) do equip-then-place atomically | MEDIUM | Mod-side: find item in full inventory (not just hotbar), move to hotbar slot, then place. Pattern: `handleEquip` already exists; `handlePlace` must call it first |
| Look-at-surface before place | Player must face the surface to trigger MC placement physics correctly | LOW | Already have `lookAtPos()` in ActionExecutor; `handlePlace` must look at the support block face, not the target air block |
| Place-on-face (support block) | MC places blocks by clicking a face of an existing block, not by clicking empty air | MEDIUM | `handlePlace` partially does this — finds support block — but face vector calculation is wrong (points wrong direction) causing ~90% failure |
| Auto-deposit to nearest chest | Agents accumulate inventory overflow; all bot frameworks support chest deposit | MEDIUM | Mindcraft `putInChest`: navigate to nearest chest within 32 blocks, open container, deposit. HermesCraft has `chests.js` tracking but no deposit/withdraw action |
| Auto-withdraw from chest | Collaborative play requires agents to take items user placed in chest | MEDIUM | Mindcraft `takeFromChest`: finds matching items across slots, withdraws multiple stacks if needed |
| Correct item names | LLM outputs `sticks` (not `stick`), `oak_planks_4` (not `oak_planks`) | LOW | Normalization table: plurals → singular, count suffixes stripped, `minecraft:` prefix stripped, `wood` → `oak_log`. Run on ALL tool inputs before dispatch |
| Crafting prerequisite resolution | LLM tries `craft(wooden_pickaxe)` when it has no planks or sticks | HIGH | State machine: check recipe → check ingredients → if missing, check sub-recipes → queue gather/craft chain. Mindcraft does not solve this; GITM does via sub-goal tree. Must be custom |
| Remove `mine` action | Baritone pathfinder ignores surface intent, sends agents underground | LOW | Delete from VALID_ACTIONS, GAME_TOOLS, and INFO_ACTIONS. Replace with `look_at_block` + `break_block` pattern in tool descriptions |
| Human message response guarantee | Agent must always respond to direct human messages before doing anything else | LOW | Priority check in tick loop: if unresponded human message exists, inject chat obligation into prompt |

## Differentiators

Features that meaningfully improve "agent feels human" goal beyond what other projects implement.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Freestyle building (LLM-designed) | LLM generates building plan in markdown with named blocks; agent executes block-by-block | HIGH | Replaces hardcoded blueprint system. Pattern: planner writes building spec to context file, action loop executes one block per tick using place action. T2BM (2024) validated this works with JSON interlayer + repair module |
| Block placement tracking | Agent can see what it has built; enables "did I actually do that?" self-check | MEDIUM | Persistent `placed_blocks.json` in agentDir: `{x,y,z} → {block, timestamp}`. Write on every successful place. Diff against plan to compute progress |
| Item name normalization layer | Intercept ALL LLM-generated item names before they hit the mod | LOW | Single `normalizeItemName(name)` function applied in `validateAction` and before dispatch. Handles: plurals, count suffixes, incorrect styles (Red Bed → red_bed), mc: prefix |
| Crafting chain solver | Given target item, recursively resolve what needs to be gathered/crafted first | HIGH | Build dependency graph from `minecraft-data` recipes for 1.21. BFS from target item. Output ordered list of gather/craft steps. Most impactful feature — GITM unlocked 99.2% of tech tree this way |
| Spatial memory (world map) | Persistent record of discovered POIs: chests, veins, biomes, agent-built structures | MEDIUM | Extend `locations.js` with type-tagged entries. Add auto-detection: ore veins found during gathering, biome transitions, any placed crafting table. MrSteve (2024) validated Place Event Memory as the single biggest improvement to task completion |
| Base tether enforcement | Auto-navigate home when >150 blocks away; no prompt needed | LOW | Check in tick loop: `if distanceToHome > 150 and not on task: navigate(home)`. Prevents 300-block wanders observed in live testing |
| Task completion verification | After completing a build/task, check actual world state vs stated goal | HIGH | Post-task: call vision loop explicitly, inject "verify your work" prompt. For building: count placed_blocks matching plan. Voyager's self-verification was the highest-impact mechanism (73% item discovery drop without it) |
| Context-file building plan | Building plan lives in persistent context file (survives history wipe); action loop reads it | LOW | Use existing `save_context` / `delete_context` tool. Planner writes `build_plan.md`, action loop reads it each tick until done. Zero new infrastructure |

## Anti-Features

Features that seem like improvements but create more problems than they solve.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| Full mineflayer integration | Mineflayer has `placeBlock`, `chestContainer`, `craftRecipe` built-in | Mineflayer is listed in package.json but confirmed NOT used by custom agent. Adding it requires replacing the mod-based architecture or running a parallel mineflayer bot — major scope expansion | Fix the existing mod-side action primitives (handlePlace, add handleChest) |
| LLM-generated block coordinates | Let LLM decide where to place each block "freely" | LLM coordinate hallucination is the primary failure mode. T2BM found 38% success rate even with GPT-4 + repair modules | LLM generates high-level building plan (dimensions, style, materials); agent executes deterministically |
| Real-time world map grid | Maintain voxel grid of all blocks agent has ever seen | Memory usage and persistence cost is enormous for marginal gain | Named POI map (locations.js pattern) handles all practical use cases |
| Automatic recipe discovery | Agent searches for what it can craft dynamically | Makes the crafting system non-deterministic; debugging failures becomes hard | Static recipe database with explicit chain resolution |
| Chest auto-scan on every tick | Automatically read nearby chest contents each tick to keep memory fresh | Chest open/close causes visual glitch, server may rate-limit; disrupts other actions | Only scan chest on explicit `interact_chest` action or when agent actively deposits/withdraws |
| Baritone #mine command re-use | Baritone is fast at finding ores | Baritone pathfinder routes underground regardless of surface intent; agents disappear into caves | Commit to look_at_block + break_block as the only block-breaking primitive |

---

## Feature Dependencies

```
Smart Place (auto-equip + look-at + place-on-face)
    └── required by: Freestyle Building
    └── required by: Block Placement Tracking
    └── fixes: 90% of current place failure rate

Item Name Normalization
    └── required by: Smart Place (correct item lookup)
    └── required by: Crafting Chain Solver (ingredient names must match recipe DB)
    └── required by: Chest Interaction (item names must match chest contents)

Chest Interaction (deposit/withdraw)
    └── requires: Item Name Normalization (to match items correctly)
    └── enables: Collaborative play (user provides items via chest)

Crafting Chain Solver
    └── requires: Item Name Normalization
    └── requires: Recipe database (minecraft-data for 1.21)
    └── enables: Multi-step crafting without LLM guessing prerequisites

Block Placement Tracking
    └── requires: Smart Place (must succeed reliably to track)
    └── enables: Task Completion Verification
    └── enables: Freestyle Building progress display

Freestyle Building
    └── requires: Smart Place (place must work)
    └── requires: Block Placement Tracking (to know when done)
    └── replaces: hardcoded blueprint system

Task Completion Verification
    └── requires: Block Placement Tracking
    └── requires: Vision loop (already exists — Claude Haiku)
    └── enables: Agent self-correction on incomplete structures

Spatial Memory
    └── enhances: Base Tether (know where home is reliably)
    └── enhances: Chest Interaction (remember where chests are)
    └── enhances: Crafting Chain Solver (know where to find resources)

Base Tether
    └── requires: Spatial Memory (need home location)
    └── independent from all other new features
```

### Dependency Notes

- **Smart Place is the critical path**: everything building-related depends on place working reliably. Fix this first.
- **Item name normalization is zero-cost infrastructure**: implement it as a utility function that wraps all tool dispatch. No architectural change.
- **Crafting chain solver is high-value but independent**: can ship after smart place without blocking anything else.
- **Freestyle building replaces blueprints**: do not build on top of `blueprints.js` / `builder.js` — replace them with a context-file-driven planner.
- **Chest interaction is independent**: no dependency on building features.

---

## What MC Bot Projects Consider Essential vs Optional

Based on Mindcraft, Voyager, Odyssey, GITM source analysis:

### Universal (every serious project has these)
- Atomic equip-then-place (never split into two LLM decisions)
- Item name validation before dispatch
- Crafting with inventory check before attempting
- Navigate-to before interact (never assume proximity)
- Chest open/deposit/close as a single action sequence

### Common but not universal
- Crafting chain solver (GITM has it, Mindcraft does not — Mindcraft bots fail more at crafting)
- Spatial memory (MrSteve 2024 showed it as the key improvement; Voyager does not persist world state)
- Task self-verification (Voyager has it via GPT-4 critic; Mindcraft does not; removing it from Voyager caused 73% performance drop)

### Rare (differentiators)
- Block placement tracking (no surveyed project maintains a per-agent placed-block log)
- Freestyle LLM-designed building (T2BM 2024 research project; not in any production bot)
- Base tether behavior (implicit in some projects via "return home if wandering" curriculum; not a named primitive)

---

## MVP Definition for v1.1

### Launch With (v1.1 milestone)

- [ ] **Item name normalization** — normalizeItemName() applied at dispatch layer. Unblocks all other features. 1 day.
- [ ] **Smart place** — mod-side fix: auto-equip from full inventory, correct face vector, look-at-surface. Fixes 90% place failure. 2 days.
- [ ] **Remove mine action** — delete from VALID_ACTIONS and GAME_TOOLS. Update tool descriptions. 0.5 days.
- [ ] **Chest deposit/withdraw** — new mod-side `chest_deposit` / `chest_withdraw` actions + agent tools. 2 days.
- [ ] **Crafting chain solver** — recipe DB + BFS dependency resolver. Queue ordered gather/craft steps into planner. 3 days.
- [ ] **Freestyle building** — replace blueprints.js with context-file-based building plan; LLM writes plan, action loop places blocks. 3 days.
- [ ] **Block placement tracking** — write to placed_blocks.json on each successful place. 0.5 days.
- [ ] **Base tether** — distance check in tick loop, auto navigate-home. 0.5 days.
- [ ] **Human message guarantee** — priority check before tick loop LLM call. 0.5 days.

### Add After Core Is Working (v1.1.x)

- [ ] **Spatial memory expansion** — extend locations.js with resource vein tracking, biome detection. Trigger: agents keep re-discovering same spots.
- [ ] **Task completion verification** — vision-based post-task check. Trigger: agents report "done" on partial structures.
- [ ] **New Skript wrappers** — once core tools work, identify what still needs server-side assistance.

### Defer to v1.2+

- [ ] **AuraSkills PlaceholderAPI** — skill levels showing as 0. Not blocking gameplay.
- [ ] **ServerTap Docker exposure** — monitoring nicety. Not blocking agent behavior.
- [ ] **Multi-agent cooperation tasks** — agents need to be individually functional first.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Item name normalization | HIGH | LOW | P1 |
| Smart place | HIGH | MEDIUM | P1 |
| Remove mine action | HIGH | LOW | P1 |
| Chest deposit/withdraw | HIGH | MEDIUM | P1 |
| Crafting chain solver | HIGH | HIGH | P1 |
| Freestyle building | HIGH | HIGH | P1 |
| Block placement tracking | MEDIUM | LOW | P1 |
| Base tether | MEDIUM | LOW | P1 |
| Human message guarantee | MEDIUM | LOW | P1 |
| Spatial memory expansion | MEDIUM | MEDIUM | P2 |
| Task completion verification | HIGH | HIGH | P2 |
| New Skript wrappers | LOW | MEDIUM | P2 |

**Priority key:**
- P1: Ship in v1.1 milestone
- P2: Ship when P1 features are proven
- P3: Defer to v1.2+

---

## Competitor Feature Analysis

| Feature | Voyager | Mindcraft | GITM | HermesCraft v1.0 | HermesCraft v1.1 Plan |
|---------|---------|-----------|------|------------------|----------------------|
| Block placement | Code-gen (mineflayer placeBlock) | `placeBlock()` with auto-equip + face selection | Keyboard/mouse sim via MCP | Broken (wrong face vector, hotbar-only) | Fix mod-side + auto-equip from full inventory |
| Chest interaction | Code-gen `putInChest`/`takeFromChest` | `putInChest`/`takeFromChest` with navigation | Not a focus | None | New `chest_deposit`/`chest_withdraw` mod actions |
| Freestyle building | Code-gen (arbitrary mineflayer code) | `newAction` code generation mode | Not implemented | Hardcoded blueprints (3 patterns) | Context-file plan + block-by-block execution |
| Item normalization | Implicit in mineflayer registry lookups | No dedicated layer; common failure mode | Explicit repair module | None | normalizeItemName() at dispatch layer |
| Crafting prerequisites | Not automated; LLM generates gather code | Not automated; fails if missing ingredients | Sub-goal tree decomposition | Static pre-execution checks (partial) | BFS recipe chain solver |
| Spatial memory | No persistence; queries game state fresh | No persistence; `getNearestBlocks()` queries | Text-based knowledge base | locations.js (named POIs) | Extend locations.js + placed_blocks.json |
| Task verification | GPT-4 critic after each program | Not implemented | Sub-goal completion check | None | Post-task vision loop injection |
| Base tether | Curriculum-based (explore goals) | Not implemented | Not implemented | None | Distance check in tick loop |

---

## Sources

- [Mindcraft skills.js source](https://github.com/kolbytn/mindcraft/blob/main/src/agent/library/skills.js) — `placeBlock`, `craftRecipe`, `putInChest`, `takeFromChest` implementation patterns. HIGH confidence.
- [Mindcraft world.js source](https://github.com/kolbytn/mindcraft/blob/main/src/agent/library/world.js) — spatial query approach (reactive queries, no persistent spatial memory). HIGH confidence.
- [Voyager paper (arXiv 2305.16291)](https://arxiv.org/abs/2305.16291) — self-verification mechanism; 73% item discovery drop without it. HIGH confidence.
- [GITM paper (OpenGVLab)](https://github.com/OpenGVLab/GITM) — LLM Decomposer sub-goal tree for crafting prerequisite chains; 99.2% tech tree coverage. HIGH confidence.
- [MrSteve paper (arXiv 2411.06736)](https://arxiv.org/abs/2411.06736) — Place Event Memory as primary improvement over STEVE-1. MEDIUM confidence (paper findings, not source code).
- [T2BM paper (arXiv 2406.08751)](https://arxiv.org/html/2406.08751v1) — LLM building via JSON interlayer + repair module; item name normalization patterns; 38% GPT-4 success rate. MEDIUM confidence.
- [Mineflayer placeBlock API](https://github.com/PrismarineJS/mineflayer/blob/master/docs/api.md) — `referenceBlock` + `faceVector` pattern. HIGH confidence.
- [prismarine-recipe](https://github.com/PrismarineJS/prismarine-recipe) — Recipe lookup by item type; does not auto-resolve chains (must implement traversal). HIGH confidence.
- [HermesCraft v1.1 diagnosis](/.claude/projects/-home-bigphoot-Desktop-hermescraft/memory/project_v11_diagnosis.md) — Live testing root causes. HIGH confidence (first-hand observation).
- [HermesCraft ActionExecutor.java](../mod/src/main/java/hermescraft/ActionExecutor.java) — Current `handlePlace` bug: face vector direction is inverted incorrectly, hotbar-only item lookup. HIGH confidence.

---

*Feature research for: HermesCraft v1.1 Tool Quality & Building Intelligence*
*Researched: 2026-03-21*
