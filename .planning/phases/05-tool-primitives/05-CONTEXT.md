# Phase 5: Tool Primitives - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix every broken tool primitive in the agent execution layer. Smart place (support block + face model, full 36-slot equip), item name normalization, mine action removal, sustained action lock timeout fix, chest deposit/withdraw. One mod rebuild batches all Java changes. Agent-side normalizer and mine removal ship first (zero risk).

</domain>

<decisions>
## Implementation Decisions

### Smart Place (Mod-Side)
- Redesign handlePlace to accept support block coordinates + face direction (not air destination)
- Auto-equip: search all 36 inventory slots (not just hotbar 0-8), swap to hotbar before placing
- Look at the support block face before triggering placement physics
- Return placed block data in HTTP response (block type, position) for placement tracking in Phase 7
- Fix the face vector calculation: face normal points FROM support block TOWARD target position

### Item Name Normalization (Agent-Side)
- New normalizer.js module with normalizeItemName(name) function
- Hardcoded alias map for known LLM mistakes: sticks→stick, oak_planks_4→oak_planks, wood_pickaxe→wooden_pickaxe, log→oak_log
- Validate against minecraft-data itemsByName as ground truth
- Apply in executeAction() before any dispatch — covers all tool calls
- Strip minecraft: prefix, handle plurals→singular, count suffixes

### Mine Action Removal (Agent-Side)
- Delete mine from VALID_ACTIONS, GAME_TOOLS, and SUSTAINED_ACTIONS sets
- Remove mine-related tool description from tools.js
- Update GAMEPLAY_INSTRUCTIONS to explicitly say look_at_block + break_block only
- Keep Baritone navigate — only mine is removed

### Sustained Action Lock Fix (Mod-Side)
- In tickSustainedAction: check sa.future.isDone() at start of each tick, self-clear if done
- Add explicit timeout handling that clears currentSustained on future.get() timeout
- Prevent permanent stuck state where timed-out action blocks all subsequent actions

### Chest Interaction (Mod-Side)
- New chest_deposit and chest_withdraw action types in ActionExecutor
- Sustained action: walk to chest → open → wait for GenericContainerScreenHandler → manipulate slots → close
- chest_deposit: specify item name + count, find matching slots in player inventory, move to chest
- chest_withdraw: specify item name + count, find matching slots in chest, move to player inventory
- Return updated inventory state in response

### Claude's Discretion
- All detailed implementation choices within the above constraints are at Claude's discretion — pure infrastructure phase

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- ActionExecutor.java: existing selectHotbarItem(), lookAtPos(), BlockHitResult infrastructure
- handleEquip() already does full 36-slot inventory search + swap to hotbar — handlePlace must call it
- actions.js: validateAction() and executeAction() are the dispatch layer where normalizer hooks in
- tools.js: GAME_TOOLS array, VALID_ACTIONS/SUSTAINED_ACTIONS/INFO_ACTIONS sets
- minecraft-data 3.105.0 already in node_modules (via mineflayer transitive dep)

### Established Patterns
- HTTP POST /action with JSON body {type, ...params} → mod executes on next MC tick
- Action results return {success: true/false, error?: string} — extend with placed block data
- Module pattern: flat camelCase.js files with named exports, init<Subsystem>() pattern
- Error handling: structured return values from action execution (never throw)
- Sets as lookup tables: VALID_ACTIONS, INFO_ACTIONS, SUSTAINED_ACTIONS in SCREAMING_SNAKE_CASE

### Integration Points
- normalizer.js hooks into executeAction() in actions.js — before dispatch
- Mine removal: delete from sets in tools.js and actions.js
- Mod changes: ActionExecutor.java handlePlace(), new handleChestDeposit/handleChestWithdraw
- New chest tools need entries in GAME_TOOLS (tools.js) and action handlers (actions.js)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Research (ARCHITECTURE.md, PITFALLS.md, FEATURES.md) provides all implementation guidance.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
