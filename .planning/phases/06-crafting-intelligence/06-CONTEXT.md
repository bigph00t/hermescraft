# Phase 6: Crafting Intelligence - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Build a BFS crafting chain solver using minecraft-data 3.105.0 so the agent can resolve full dependency trees (oak_log → planks → sticks → wooden_pickaxe) at plan time. Declare minecraft-data as a direct dependency. Handle the two-call pattern for 3x3 crafting table recipes.

</domain>

<decisions>
## Implementation Decisions

### Recipe Database
- Use minecraft-data 3.105.0 for MC 1.21.1 recipe data (782 recipe output types, 1333 items)
- Declare minecraft-data explicitly in package.json (already in node_modules via mineflayer)
- Load recipe data at agent startup, not on every craft call
- When shaped recipes have multiple variants (e.g. wooden_pickaxe has 11 variants — one per plank type), prefer the variant whose ingredients the agent already has in inventory

### Chain Solver (crafter.js)
- New agent/crafter.js module — approximately 60 lines of BFS dependency traversal
- Given a target item + current inventory, output an ordered list of gather/craft steps
- BFS from target → recursively resolve missing ingredients → output topological-sorted action sequence
- Each step in the chain specifies: action type (gather or craft), item name, quantity, ingredients needed
- Use normalizeItemName() from Phase 5 on all ingredient names

### Crafting Table Two-Call Pattern
- 3x3 recipes (crafting table required) need two craft calls: first opens the table, second executes the craft
- crafter.js must expand 3x3 recipes into two queue entries
- 2x2 recipes (player inventory) need only one craft call
- Recipe metadata from minecraft-data includes inShape dimensions to distinguish

### Planner Integration
- Expand abstract `craft X` queue entries into dependency-ordered action steps at plan time
- Planner calls crafter.js to resolve the chain before writing to the action queue
- The action loop remains dumb — it just pops and executes

### Claude's Discretion
All implementation details within the above constraints are at Claude's discretion — pure infrastructure phase

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- agent/normalizer.js (Phase 5) — normalizeItemName() for all item name inputs
- minecraft-data 3.105.0 in node_modules — mcData.recipes, mcData.itemsByName, mcData.items
- agent/actions.js — executeAction() with normalizer integration
- agent/index.js — handleRecipeLookup() uses RecipeLookup.java via /recipes?item=X endpoint
- agent/planner.js — parseQueueFromPlan() builds action queue from planner LLM output

### Established Patterns
- Module pattern: flat camelCase.js with named exports, init<Subsystem>() at startup
- Action queue: planner writes, action loop pops and executes
- INFO_ACTIONS for agent-side-only operations (don't hit the mod API)

### Integration Points
- crafter.js hooks into planner.js parseQueueFromPlan() — expand craft actions
- crafter.js uses normalizer.js for ingredient name validation
- crafter.js reads inventory from game state for variant selection
- Existing /recipes endpoint in mod can supplement for edge cases

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Research (STACK.md, ARCHITECTURE.md) provides all implementation guidance.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
