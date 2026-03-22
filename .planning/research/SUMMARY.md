# Project Research Summary

**Project:** HermesCraft v1.1 — Tool Quality & Building Intelligence
**Domain:** Minecraft AI agent — HTTP-bridge architecture, tool execution layer, building systems
**Researched:** 2026-03-21
**Confidence:** HIGH — all research based on direct codebase inspection, live execution tests, and source analysis of comparable projects (Mindcraft, Voyager, GITM)

## Executive Summary

HermesCraft v1.1 is a targeted hardening milestone for a Minecraft AI agent whose tool execution layer is fundamentally broken at the block placement and crafting primitives. Every serious MC bot project (Mindcraft, Voyager, GITM, Odyssey) treats block placement, crafting, and item equipping as **atomic, correct primitives** — the LLM never guesses coordinates or assumes inventory state. HermesCraft v1.0's `place` action inverts this model by requiring the LLM to supply a destination air coordinate rather than a support block plus face direction, producing a 90% failure rate. The crafting system lacks dependency resolution, causing trial-and-error loops where a 3-step chain takes 20+ ticks instead of 4. Fixing these primitives is the critical path for all building and collaboration features.

The recommended approach for v1.1 is bottom-up: fix the foundational tool layer first (smart place, item name normalization, mine action removal), then build reliable higher-order systems on top (crafting chain solver, chest interaction), then unlock building intelligence (freestyle building, block placement tracking, spatial memory). No new npm dependencies are needed beyond formally declaring `minecraft-data` 3.105.0 (already in node_modules via mineflayer). Mod rebuilds should be batched — only smart place and chest interaction require a Java rebuild; all other features are Node.js-only and deploy via process restart.

The key risk is building higher-order features before the primitives are solid. The dependency graph is strict: freestyle building depends on smart place, the crafting chain solver depends on item name normalization, task verification depends on block placement tracking. Shipping in dependency order is not optional — it is the only build order that produces testable increments. The secondary risk is a live bug in ActionExecutor.java where a sustained action timeout does not clear `currentSustained`, permanently blocking the mod. This must be fixed in Phase 1 before chest interaction or any other sustained action is trusted.

## Key Findings

### Recommended Stack

All v1.1 features are implementable with the existing stack. `minecraft-data` 3.105.0 is already in node_modules and confirmed working for 1.21.1 item lookups, recipe data (782 recipe output types, 1333 items), and ingredient resolution. The crafting chain solver is approximately 60 lines of recursive JS in a new `agent/crafter.js` — no external crafting library is warranted (none are maintained for 1.21.1). Item name normalization is a hardcoded alias map in `agent/normalizer.js` — prompt engineering alone cannot solve this; live testing confirmed the LLM keeps outputting wrong names even after correction in the system prompt. Block placement tracking and spatial memory follow the existing JSON-file pattern used by `chests.js` and `locations.js` — no spatial index library is needed at the under-2000-block scale.

**Core technologies:**
- `minecraft-data` 3.105.0 (declare in package.json): recipe DB and item registry — already in node_modules, ESM import confirmed working, ecosystem standard per Mindcraft
- Native Node.js file I/O (JSON files): all persistent state — existing pattern throughout codebase
- Fabric mod HTTP bridge (existing): all MC client operations — smart place and chest interaction require Java changes only, no new Fabric dependencies
- Java `GenericContainerScreenHandler` (existing Fabric API): chest slot manipulation — stable in 1.21.1

**Critical version requirement:** `minecraft-data` must load the 1.21.1 dataset specifically. Do not alias to 1.21 or 1.20.x — item names diverged (e.g., `raw_iron` vs `iron_ore` changed in 1.18).

### Expected Features

Research validated against Mindcraft, Voyager, GITM, MrSteve, Odyssey, and T2BM (2024).

**Must have (table stakes) — without these the agent cannot function:**
- Smart place (auto-equip from full inventory, surface+face coordinate model) — every serious MC bot implements this as an atomic primitive; the broken version is the root cause of 90% place failures
- Item name normalization at dispatch layer — LLM outputs wrong names constantly; mineflayer handles this implicitly via registry lookups, HermesCraft's mod bridge does not
- Remove mine action — Baritone routes underground regardless of surface intent; all live tests confirm agents disappear into caves
- Chest deposit/withdraw — Mindcraft `putInChest`/`takeFromChest` is table stakes for any collaborative or storage-aware agent
- Crafting prerequisite resolution — GITM's sub-goal tree achieved 99.2% tech tree coverage; without it, agents fail most multi-step crafting
- Human message response guarantee — agent ignoring player messages is a basic usability failure

**Should have (differentiators):**
- Crafting chain solver (BFS from minecraft-data) — resolves full dependency trees before attempting craft, eliminates trial-and-error loops
- Freestyle building (LLM-designed structures via context file plan) — replaces hardcoded blueprint system; T2BM 2024 validated this pattern
- Block placement tracking (persistent placed-blocks log) — enables task verification and build progress display
- Spatial memory expansion (typed resource patches in locations.js) — MrSteve 2024 showed Place Event Memory as the single biggest improvement to task completion
- Base tether (distance check in tick loop, auto-navigate home) — prevents 300-block wanders observed in live testing
- Task completion verification (wire existing pendingReview variable in index.js) — Voyager's self-verification caused 73% performance drop when removed

**Defer to v1.2+:**
- AuraSkills PlaceholderAPI integration (skill levels showing as 0 — not blocking gameplay)
- ServerTap Docker exposure (monitoring nicety)
- Multi-agent cooperation tasks (agents must be individually functional first)
- Real-time voxel world map grid (enormous memory cost for marginal gain over named POI map)

### Architecture Approach

The architecture has two layers that are cleanly separated: the Fabric mod (Java) owns all direct MC API access — inventory slots, block placement, screen handlers, Baritone — and the Node.js agent owns all persistence, reasoning, and multi-tick coordination. This boundary is correct and must be maintained. The key v1.1 architectural decisions: (1) batch mod rebuilds so smart place + chest interaction ship together in one rebuild, (2) embed state changes in action response JSON rather than polling via separate GET /state calls (response-driven state updates), (3) the planner expands abstract actions into concrete dependency-ordered steps at queue-write time keeping the action loop dumb, and (4) each new agent-side module owns exactly one JSON file in `data/{name}/`.

**Major components:**
1. `agent/normalizer.js` (NEW) — item name canonicalization, called from executeAction() before any dispatch
2. `agent/crafter.js` (NEW) — recipe chain solver using minecraft-data; called by planner.js parseQueueFromPlan() to expand `craft X` into ordered steps
3. `agent/freestyle.js` (NEW) — parses LLM markdown building plan into smart_place action sequence
4. `agent/placement-tracker.js` (NEW) — persists placed-blocks log; updated from smart_place response `placed` field
5. `agent/chat-queue.js` (NEW) — shared human message pending queue for planner and action loop
6. `ActionExecutor.java` (MODIFIED) — smart place (full 36-slot inventory search + crosshair mode + placement event in response) + chest_deposit + chest_withdraw sustained actions
7. `agent/locations.js` (EXTENDED) — add `resources` section with typed resource patches, proximity-filtered prompt injection with hard cap

### Critical Pitfalls

1. **Place action uses wrong coordinate model (free-space vs surface+face)** — Change handlePlace to accept support block coords + face direction; let mod compute destination offset. The LLM reasons in "place on top of this block" terms, not "place at air coordinate." Fix in Phase 1 before any building work.

2. **Hotbar-only item selection silently fails** — Current `selectHotbarItem` only scans slots 0-8. Items crafted mid-session land in main inventory slots 9-35 and silently fail equip/place. Always call the full 36-slot equip path before any placement. Same Phase 1 fix, same mod rebuild.

3. **Sustained action lock on HTTP timeout** — `currentSustained` is not cleared when `execute()` times out, permanently blocking all subsequent actions. Fix: `tickSustainedAction` must check `sa.future.isDone()` at the start of each tick and self-clear. Must be verified in Phase 1 before chest interaction is trusted.

4. **Crafting chain attempted without prerequisites** — LLM calls `craft(wooden_pickaxe)` with no planks or sticks, discovers missing ingredients through failure, and takes 20+ ticks per simple chain. Agent-side chain solver must resolve the full dependency tree at plan time. Address in Phase 2.

5. **Freestyle build LLM designs with blocks not in inventory** — The planner's CREATIVE_BEHAVIOR encourages aesthetic choices that conflict with inventory constraints. The freestyle build prompt must receive canonical inventory names and explicitly restrict design to inventory-only blocks. Designs requiring more than 10% non-inventory materials should be rejected before queuing. Address in Phase 3 design step.

## Implications for Roadmap

The dependency graph dictates a strict build order. Features cannot be safely shuffled across phases — each phase unlocks the next.

### Phase 1: Foundation — Tool Primitives

**Rationale:** Everything downstream depends on basic tools working. The place action's 90% failure rate, the hotbar-only equip bug, and the sustained action lock all block every subsequent feature. Within the phase, the safe sub-order is: (a) normalizer.js + mine removal (agent-only, zero risk, test immediately), (b) ActionExecutor.java changes (requires rebuild + client restart), (c) chat-queue.js (agent-only).
**Delivers:** Agents that reliably place blocks, interact with chests, respond to players, and don't get stuck on sustained action lockouts.
**Addresses:** Item name normalization, smart place, remove mine action, chest deposit/withdraw, human message guarantee
**Avoids:** Pitfall 1 (wrong coordinate model), Pitfall 2 (hotbar-only equip), Pitfall 4 (item name mismatch), Pitfall 6 (chest toggle bug), Pitfall 9 (sustained action lock)
**Mod rebuild required:** Yes — batch smart place and chest interaction into one rebuild.

### Phase 2: Crafting Intelligence

**Rationale:** The crafting chain solver depends on normalizer.js (Phase 1) for correct ingredient name matching. With reliable place and equip actions in place, crafting failures are the next bottleneck for complex tasks. This phase is entirely agent-side (no mod rebuild) and can ship as soon as Phase 1 is verified.
**Delivers:** Agent that can execute `craft wooden_pickaxe` from `oak_log` in a single plan step without trial-and-error.
**Addresses:** Crafting prerequisite resolution, crafting chain solver
**Uses:** minecraft-data 3.105.0 recipe database, BFS dependency traversal in crafter.js
**Avoids:** Pitfall 3 (crafting without prerequisites), hardcoded validatePreExecution tech debt
**Note:** The craft two-call pattern for 3x3 recipes (first call opens crafting table, second actually crafts) must be built into crafter.js queue expansion — this is a known integration gotcha from PITFALLS.md.

### Phase 3: Building Intelligence

**Rationale:** Freestyle building requires smart place to work (Phase 1) and correct item names (Phase 1). Block placement tracking enables the task verification that makes building measurable. The existing builder.js double-place race condition (builder loop + planner queue both active simultaneously) must be resolved before the freestyle builder is trusted. Highest-complexity phase.
**Delivers:** Agent that can generate and execute LLM-designed building plans with progress tracking and post-build verification.
**Addresses:** Freestyle building, block placement tracking, task completion verification
**Avoids:** Pitfall 5 (builder + planner double-place race), Pitfall 8 (blueprint silent material substitution), Pitfall 10 (LLM designs with unavailable materials)
**Note:** The `parseFreestylePlan()` markdown contract is the one gap not fully specified in research — define this format explicitly before writing code.

### Phase 4: Spatial Memory and Navigation

**Rationale:** Spatial memory and base tether are independent of building features but benefit from them being stable. The unbounded growth problem in locations.json must be designed in at inception with a proximity-filtered prompt injection — it cannot be retrofitted after sessions have accumulated hundreds of locations. This phase is entirely agent-side.
**Delivers:** Agent with persistent world knowledge (typed resource patches, build sites, POIs), proximity-filtered prompt injection, and automatic home navigation.
**Addresses:** Spatial memory expansion, base tether
**Avoids:** Pitfall 7 (locations.json grows unbounded), chest prompt unbounded growth (apply same proximity cap to getChestsForPrompt)

### Phase 5: Server-Side Enhancements

**Rationale:** Skript wrappers are independent of all agent-side work and can be developed in parallel or deferred. Hot-reload via `/skript reload all` means no MC restart required. Lowest risk, lowest priority.
**Delivers:** `/where`, `/nearbyplayers`, `/checkblock` server commands; command-parser.js extensions for new output formats.
**Addresses:** New Skript wrappers

### Phase Ordering Rationale

- Phases 1 through 3 are strictly dependency-ordered: normalization → smart place → crafting chain → freestyle building. Reordering any of these creates integration risk.
- Phase 4 (spatial memory) has no hard dependency on Phases 2-3 but is placed after building features so the spatial memory can track build sites from the beginning.
- Phase 5 (server commands) is independent and can run in parallel with any phase.
- The mod rebuild happens exactly once, in Phase 1. All other phases are Node.js-only.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Freestyle Building):** The `parseFreestylePlan()` markdown format contract has no established HermesCraft precedent. T2BM validates the overall pattern but not the specific format. Define the plan text syntax as the first deliverable of Phase 3 planning before any code is written.
- **Phase 3 (Task Verification):** The `pendingReview` wiring exists in index.js but the prompt injection wording for self-verification has not been tested. May require iteration to avoid false-positives (LLM confirming success incorrectly).

Phases with standard patterns (skip research):
- **Phase 1 (Normalization, Mine Removal):** Trivial agent-side changes with known patterns.
- **Phase 1 (Smart Place mod changes):** Java change is a coordination wrapper around existing ActionExecutor infrastructure. Pattern is fully specified in ARCHITECTURE.md.
- **Phase 2 (Crafter.js):** BFS recipe traversal on minecraft-data is a solved pattern. Implementation is approximately 60 lines per STACK.md analysis.
- **Phase 4 (Spatial Memory):** Extend locations.js with types and proximity filter. All patterns established in STACK.md and ARCHITECTURE.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | minecraft-data verified via live execution against 1.21.1 dataset; all other dependencies are existing; no new libraries required |
| Features | HIGH | Table stakes validated against Mindcraft, Voyager, GITM source and papers; differentiators validated via MrSteve, T2BM; priority order backed by live testing diagnosis |
| Architecture | HIGH | Based on direct codebase inspection of all relevant files; build order is dependency-derived |
| Pitfalls | HIGH | 9 of 10 pitfalls identified from direct code inspection with confirmed reproduction patterns; 1 from code plus behavioral observation |

**Overall confidence:** HIGH

### Gaps to Address

- **Freestyle plan format contract:** The exact markdown syntax that `parseFreestylePlan()` will accept is unspecified. Must be defined and documented before Phase 3 implementation to avoid LLM-generated plans that the parser silently rejects.
- **Chest screen-handler detection timing:** ARCHITECTURE.md notes the mod must wait for `player.currentScreenHandler` to become `GenericContainerScreenHandler` before slot manipulation. The exact tick-wait pattern needs careful implementation review during Phase 1 to avoid the toggle bug (Pitfall 6).
- **`minecraft-data` not declared in package.json:** It is in node_modules via mineflayer transitive dependency but is not a direct dependency. `npm install minecraft-data` is required as a first step. If mineflayer is ever removed or updated, this dependency could be silently lost.
- **Craft two-call pattern:** PITFALLS.md documents that 3x3 crafting table recipes require two `craft` calls (first opens the table, second executes the craft). The crafter.js queue expansion must account for this — it cannot enqueue one `craft` action per dependency step.

## Sources

### Primary (HIGH confidence)
- `ActionExecutor.java` (direct inspection) — handlePlace coordinate model, startCraft two-call pattern, AtomicReference timeout behavior, selectHotbarItem hotbar-only scope
- `actions.js`, `tools.js`, `builder.js`, `blueprints.js`, `chests.js`, `locations.js`, `planner.js`, `index.js` (direct inspection) — validatePreExecution hardcoded checks, builder race condition, unbounded growth patterns
- `minecraft-data` 3.105.0 (live execution) — 1333 items, 782 recipe types, ESM import confirmed for 1.21.1
- Mindcraft `skills.js` source — `placeBlock`, `putInChest`, `takeFromChest` implementation patterns
- Voyager paper (arXiv 2305.16291) — self-verification mechanism; 73% item discovery drop without it
- GITM paper (OpenGVLab) — crafting sub-goal tree; 99.2% tech tree coverage

### Secondary (MEDIUM confidence)
- MrSteve paper (arXiv 2411.06736) — Place Event Memory as primary improvement over STEVE-1
- T2BM paper (arXiv 2406.08751) — LLM building via JSON interlayer + repair module; item normalization patterns; 38% GPT-4 success rate
- v1.0 live testing post-mortem (project_v11_diagnosis.md) — confirmed failure modes, tool error rates

### Tertiary (LOW confidence)
- Mineflayer issue #2320 — equip-before-place requirement (community bug report; different architecture but pattern is clear)
- Plancraft LLM crafting evaluation (colm.pdf) — LLMs struggle with multi-step crafting dependency resolution; hallucinated item names confirmed

---
*Research completed: 2026-03-21*
*Ready for roadmap: yes*
