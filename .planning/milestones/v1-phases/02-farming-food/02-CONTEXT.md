# Phase 2: Farming & Food Production - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents sustainably feed themselves through farming, fishing, and animal husbandry. All farming mechanics use the script-executor pattern from Phase 1: LLM decides what/where, procedural code handles block-level execution.

</domain>

<decisions>
## Implementation Decisions

### Crop Farming
- **D-01:** New `farm` sustained action tool. LLM says "start a farm here", script handles till/plant/harvest rows procedurally.
- **D-02:** Farm requires flat ground near water source. Agent validates site before building (no farms on cliffs, overlapping structures, or in water).
- **D-03:** Vision system from Phase 1 helps identify good farm locations.
- **D-04:** Crop cycle: till → plant → wait (time-based, not tick-based) → harvest → replant.

### Animal Breeding
- **D-05:** New `breed` tool. Agent finds nearby animals of specified type, feeds them appropriate food (wheat for cows, seeds for chickens).
- **D-06:** Animals need a pen first (from Phase 1 blueprint system). Agent should build pen before breeding.

### Fishing
- **D-07:** New `fish` sustained action tool. Agent navigates to water, casts rod, waits for bite, collects. Runs as sustained action like mining.
- **D-08:** Agent auto-crafts fishing rod if it has materials and no rod in inventory.

### Food Cooking
- **D-09:** Existing `smelt` tool already handles furnace operations. Add food items (raw beef, raw chicken, raw porkchop) to agent's cooking knowledge.
- **D-10:** No new tool needed — just knowledge update in building.md or new food.md knowledge file.

### Auto-Replanting
- **D-11:** After mining logs, agent auto-plants sapling at the same spot. Implemented as post-mine hook in the action loop.

### Site Validation (CRITICAL)
- **D-12:** ALL structure/farm placement must validate: flat ground (no more than 1 block height difference), near water for farms, not overlapping existing builds, not on cliff edges, not in water.
- **D-13:** Planner loop + vision system from Phase 1 determines locations. Agent doesn't blindly pick coordinates.

### Claude's Discretion
- Exact crop growth timing detection
- Fishing animation/wait duration
- How many crops per farm plot

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

### Phase 1 Dependencies
- `agent/builder.js` — Blueprint executor (farm blueprint uses this)
- `agent/blueprints/crop-farm.json` — Farm blueprint from Phase 1
- `agent/vision.js` — Vision loop for site selection
- `agent/planner.js` — Planner loop decides when to farm
- `agent/knowledge/building.md` — Building knowledge (extend with farming)

</canonical_refs>

<specifics>
## Specific Ideas

- Farms must look natural — not floating, not on top of structures, not in weird locations
- Agent should use vision to verify farm site looks reasonable before building
- Planner loop detects low food → triggers farming behavior in action loop

</specifics>

<deferred>
## Deferred Ideas

- Automatic crop replanting on harvest (v2 — start with manual harvest)
- Complex farm designs (multi-level, greenhouse) — future
- Animal pen auto-expansion when overpopulated — future

</deferred>

---

*Phase: 02-farming-food*
*Context gathered: 2026-03-21 via smart discuss*
