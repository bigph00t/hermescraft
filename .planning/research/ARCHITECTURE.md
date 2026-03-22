# Architecture Research

**Domain:** Minecraft AI agent — tool quality and building intelligence milestone
**Researched:** 2026-03-21
**Confidence:** HIGH (based on direct codebase inspection)

---

## Existing System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PAPER SERVER (Docker)                        │
│   EssentialsX (/home, /sethome)   Skript (/scan, /share-location)   │
│   AuraSkills (/myskills)          QuickShop (/qs)                    │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ TCP (Minecraft protocol)
┌───────────────────────────┴─────────────────────────────────────────┐
│                  FABRIC CLIENT (Xvfb per agent)                      │
│  ┌──────────────────────────┐   ┌────────────────────────────────┐  │
│  │    HermesBridge Mod      │   │       Baritone Mod              │  │
│  │  StateReader.java        │   │  navigate / mine actions        │  │
│  │  ActionExecutor.java     │   └────────────────────────────────┘  │
│  │  RecipeLookup.java       │                                        │
│  │  HTTP :3001              │                                        │
│  └────────────┬─────────────┘                                        │
└───────────────┼─────────────────────────────────────────────────────┘
                │ HTTP (fetchState, POST /action)
┌───────────────┴─────────────────────────────────────────────────────┐
│                      NODE.JS AGENT (ESM)                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ ACTION LOOP │  │ PLANNER LOOP │  │      VISION LOOP          │   │
│  │   (2s tick) │  │   (5s tick)  │  │       (10s tick)          │   │
│  │  index.js   │  │  planner.js  │  │      vision.js            │   │
│  └──────┬──────┘  └──────┬───────┘  └──────────────────────────┘   │
│         │                │                                           │
│         ▼                ▼                                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    action-queue.js (file-backed)              │   │
│  │           planner writes → action loop pops + executes        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  Per-agent files: data/{name}/                                        │
│    notepad.txt  locations.json  chests.json  action-queue.json       │
│    context/     MEMORY.md       stats.json   skills/                 │
│  Shared files: agent/shared/coordination.json                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities (Existing)

| Component | Responsibility | Side |
|-----------|---------------|------|
| `StateReader.java` | Reads MC world state every tick, caches JSON. Surfaces blocks, inventory, position, entities. | Mod |
| `ActionExecutor.java` | Receives POST /action, queues for client thread, executes instant or sustained actions. | Mod |
| `RecipeLookup.java` | Queries MC recipe manager for crafting/smelting recipes. Accessed via GET /recipes. | Mod |
| `HermesBridgeMod.java` | Registers tick events, HTTP server, chat listeners, auto-connect. | Mod |
| `index.js` | Main 2s action loop. Pops from queue or calls LLM directly. Death detection, stuck recovery. | Agent |
| `planner.js` | 5s LLM loop. Writes action-queue.json. Has own rolling conversation history (500 msg). | Agent |
| `vision.js` | 10s loop. Screenshots + Claude Haiku eval. Writes visionContext string injected into prompts. | Agent |
| `builder.js` | Blueprint execution engine. Places 3 blocks/tick from a blueprint queue. Pauses on missing materials. | Agent |
| `action-queue.js` | File-backed JSON queue. `setQueue()` from planner, `popAction()` from index. | Agent |
| `chests.js` | File-backed chest inventory memory. `trackChest()` / `getChestsForPrompt()`. | Agent |
| `locations.js` | Named location memory. Home, danger zones, POIs. Injected into every prompt. | Agent |
| `actions.js` | Schema validation, pre-execution checks, `executeAction()` dispatcher. Plugin command handlers. | Agent |
| `tools.js` | OpenAI-format tool definitions. All tools have injected `reason` field. | Agent |

---

## v1.1 Integration Architecture

### What Lives Where

The central question for each v1.1 feature is whether the logic belongs in the mod (Java, client-thread, direct MC API access) or the agent (Node.js, async, LLM-facing).

**Rule of thumb:**
- Anything requiring direct MC API calls (item slots, block placement, screen handling, inventory inspection) must be mod-side.
- Anything requiring persistence, LLM reasoning, or multi-tick coordination must be agent-side.
- Item name normalization is a pure string transformation — agent-side, no mod changes needed.

---

### Feature: Smart Place

**Problem:** Current `handlePlace` in ActionExecutor requires the item to already be in the hotbar (not just inventory) and requires exact coordinates known in advance. Real players equip from inventory and place against visible surfaces.

**Mod-side changes required (ActionExecutor.java — handlePlace):**
1. Auto-equip: search full inventory (all 36 slots), move matching item to hotbar slot via `SlotActionType.SWAP` if not in hotbar. The existing `selectHotbarItem` helper only searches the 9 hotbar slots — extend it to search all 36 and move the item.
2. Look-at-surface mode: when no coordinates are provided, use `client.crosshairTarget` (what the player is currently facing) as the placement surface. The agent calls `look_at_block` first to aim, then `smart_place` without coordinates.
3. Placement event in response: after successful placement, include `{"success":true,"placed":{"block":"oak_planks","x":10,"y":64,"z":20}}`.

**Agent-side changes (actions.js):**
- Add `smart_place` to VALID_ACTIONS and ACTION_SCHEMAS.
- `validatePreExecution` for `smart_place`: check item exists anywhere in inventory (all 36 slots), not just hotbar.

**New tool (tools.js):**
```javascript
{
  name: 'smart_place',
  description: 'Place a block. Auto-equips from full inventory, places against surface at crosshair or given coordinates. Use look_at_block first to aim.',
  parameters: {
    item: { type: 'string', description: 'Block to place, e.g. "oak_planks"' },
    x: { type: 'integer', description: 'Optional. Omit to place at crosshair.' },
    y: { type: 'integer' },
    z: { type: 'integer' },
  },
  required: ['item'],
}
```

**Retire:** `place` stays as an internal action type for backward compat in the queue but is removed from GAME_TOOLS (not shown to LLM). `smart_place` is the only placement tool the LLM sees.

---

### Feature: Chest Interaction

**Problem:** No deposit/withdraw actions exist. `interact_block` opens the chest GUI but there is no way to transfer items programmatically.

**Mod-side changes required (ActionExecutor.java — new sustained actions):**

Add two new sustained action types:

1. `chest_deposit` — navigate to chest at (x,y,z), open it, find item in player inventory, shift-click to transfer, close screen.
2. `chest_withdraw` — navigate to chest at (x,y,z), open it, find item in chest, shift-click to transfer to player inventory, close screen.

Both follow the existing sustained action pattern: HTTP thread queues the action, client tick picks it up, SustainedAction runs across multiple ticks.

The critical implementation detail: after sending `interactBlock`, the mod must wait until `player.currentScreenHandler` is a `GenericContainerScreenHandler` (not `PlayerScreenHandler`) before attempting slot manipulation. This requires a wait-tick in the sustained action loop.

**Response payload includes chest contents after transfer:**
```json
{"success":true, "transferred":"oak_log x8", "chest_contents":[...]}
```

**Agent-side (chests.js):** `trackChest()` is called with updated contents from the response. Auto-refreshes the persistent chest map without a separate scan.

**Agent-side (actions.js):** Add `chest_deposit` and `chest_withdraw` to VALID_ACTIONS and ACTION_SCHEMAS. Pre-execution check for `chest_deposit`: agent must have the item. Pre-execution check for `chest_withdraw`: chest must exist in known chests map.

**New tools (tools.js):**
```javascript
{ name: 'chest_deposit', params: { x, y, z, item, count } }
{ name: 'chest_withdraw', params: { x, y, z, item, count } }
```

Both require coordinates. The LLM gets chest locations from `getChestsForPrompt()` which is injected into every user message.

---

### Feature: Remove Mine Action

**Change is entirely agent-side:**
- Remove `mine` from GAME_TOOLS in tools.js.
- Remove `mine` from VALID_ACTIONS in actions.js.
- Remove `mine` case from planner.js `parseQueueFromPlan()`.
- The Java `handleMine` in ActionExecutor.java stays — unreachable from agent but harmless. No mod rebuild needed for this feature.

**Update tool descriptions:** `look_at_block` description must explicitly say "this is the primary way to mine — look at a surface block, then break_block".

---

### Feature: Item Name Normalization

**Entirely agent-side. No mod changes.**

New module: `agent/normalizer.js`

Two layers:

1. **Static map** for known wrong names:
   - `sticks` → `stick`
   - `oak_planks_4` → `oak_planks` (any `_{N}` suffix stripped)
   - `log` → `oak_log`
   - `wood` → `oak_log`
   - `planks` → `oak_planks`

2. **Pattern rules**: strip trailing `_\d+` (quantity suffix), strip `minecraft:` prefix.

Called from `executeAction()` before any other logic runs. Also called inside `validatePreExecution()` on the item field.

Single export: `normalizeItemName(name) → string`. Import in actions.js.

---

### Feature: Crafting Chain Solver with Recipe Database

**Entirely agent-side. No mod changes needed** — RecipeLookup.java already exists and serves `GET /recipes?item=X`.

New module: `agent/crafter.js`

**Recipe database:** Agent-side JSON file `agent/knowledge/recipes.json`, pre-populated with the ~50 most common early-game recipes. For unknown items, falls through to `GET /recipes?item=X`.

**Chain solver:**
```
solveCraft(item, inventory) → { steps: [...], missing: [...] }
```
- Looks up item recipe.
- For each ingredient, checks inventory count.
- If insufficient, recursively solves for the ingredient.
- Returns ordered steps (leaves first, target last) and list of truly missing raw materials.

**Integration with planner.js:** The planner's `parseQueueFromPlan()` calls `solveCraft()` when it encounters a `craft X` line and expands it into multiple queue items if prerequisites are missing:

```
craft wooden_pickaxe
→ [craft oak_planks (need oak_log x2), craft stick (need oak_planks x1), craft wooden_pickaxe]
```

Expansion happens at queue-write time, not execution time. The LLM says "craft wooden_pickaxe" and the planner silently handles the chain. The action loop stays simple.

---

### Feature: Freestyle Building

**The fundamental redesign of building.** The existing blueprint builder (builder.js) stays for predefined structures. Freestyle is for LLM-designed structures.

**New module: `agent/freestyle.js`**

Parses the LLM's markdown building plan into a concrete placement queue.

The LLM writes a design in its notepad or a context file:
```
BUILD 3x4 PLATFORM at (10, 64, 20):
oak_planks: fill y=64, rows 0-3, cols 0-2
oak_planks: wall y=65, north face
```

`freestyle.js` exports `parseFreestylePlan(text, originX, originY, originZ)` → `[{block, x, y, z}, ...]`.

Planner calls this when it detects a BUILD block in its plan output. Resulting array gets written to action-queue.json as a sequence of `smart_place` actions.

**New module: `agent/placement-tracker.js`**

Persists to `data/{name}/placement-log.json`:
```json
{
  "blocks": [
    {"block":"oak_planks","x":10,"y":64,"z":20,"ts":"2026-03-21T..."}
  ]
}
```

Truncates to the last 1000 blocks to prevent unbounded growth.

Updated whenever a `smart_place` response includes a `placed` field. In index.js, after `executeAction()` returns, if `result.placed` exists, call `recordPlacement(result.placed)`.

Used by task verification to confirm a build actually happened.

---

### Feature: Spatial Memory

**Extends `locations.js` rather than creating a new module.**

Current locations.js stores named points. For v1.1, add a `resources` section to `data/{name}/locations.json`:
```json
{
  "home": {...},
  "resources": {
    "oak_cluster_1": {"x":10,"y":64,"z":20,"blockType":"oak_log","count":8,"foundAt":"..."}
  }
}
```

New export in locations.js: `saveResourcePatch(blockType, x, y, z, count)`.

New export: `getResourcesForPrompt()` — formatted string injected into every user message alongside `getLocationsForPrompt()`.

**Integration:** command-parser.js already has `extractScanResults()`. Extend it to also call `saveResourcePatch()` when scan results arrive via chat.

No mod changes. Scan results arrive via the existing Skript /scan → chat → command-parser.js pipeline.

---

### Feature: Base Tether

**Agent-side only. No mod changes.**

New function in locations.js: `isWandering(currentPos, radiusBlocks)` — returns true if agent is more than N blocks from home.

In the index.js tick function, after fetching state:
- If `isWandering(state.position, 150)` AND no active build AND agent is not already navigating home:
  - Clear action queue.
  - Inject a navigate action to home coordinates as the next action.
  - Set a `_tethering` flag to prevent repeated triggers on the same wander event.

Tether clears when agent returns within radius.

---

### Feature: Task Completion Verification

**Agent-side only. No mod changes.**

The existing `pendingReview` variable in index.js already tracks a subtask just marked "done." Complete the wiring:

1. When `update_task` is called with `status: "done"` and an `expected_outcome`, set `pendingReview = { expected_outcome, reviewTick: tickCount + 1 }`.
2. On the next tick, before calling the LLM, inject: "You just completed a task. Expected outcome: [outcome]. Look at your current state. Did you actually succeed? If not, re-queue the task."
3. LLM either proceeds (success) or calls `update_task` with `status: "failed"` (failure).

This closes the existing gap where `pendingReview` is set but never acted on.

---

### Feature: Human Message Guaranteed Response

**Agent-side only. No mod changes.**

**Fix:** Single source of truth for unresponded human messages shared between planner and action loop.

New lightweight module `agent/chat-queue.js`:
- In-memory array of `{sender, message, receivedAt}`.
- Export: `enqueueHumanMessage(sender, message)`, `getPendingHumanMessages()`, `markResponded(sender)`.

Both planner.js and index.js import from chat-queue.js.

The action loop gets priority: if `getPendingHumanMessages().length > 0` and the action queue is otherwise idle, the next LLM call receives a mandatory injection: "IMPORTANT: [sender] said: [message]. You MUST respond to them in chat this turn."

A message is removed only after the agent issues a `chat` action in the same tick where the injection was active.

---

### Feature: New Skript Wrappers

**Server-side (Skript). No mod or agent changes except extending command-parser.js.**

Candidates:

1. `/where [player]` — broadcasts agent coordinates. Output format: `[Hermes] Jeffrey is at (10, 64, 20)`. Parsed by command-parser.js for spatial awareness.
2. `/nearbyplayers [radius]` — lists online players within radius. Helps agents find teammates.
3. `/checkblock <x> <y> <z>` — returns block type at coordinates. Agents verify specific block existence without a full scan. Supports task verification.

Each command follows the established pattern: chat output, extracted by command-parser.js.

---

## Mod-Side vs Agent-Side Summary

| Feature | Mod Changes | Agent Changes |
|---------|-------------|---------------|
| Smart place | ActionExecutor: full inventory search, crosshair mode, placement event in response | New `smart_place` action + tool, normalizer call |
| Chest deposit/withdraw | ActionExecutor: two new sustained action types | New action types, pre-execution checks, chests.js auto-update |
| Remove mine | None (keep Java, just unreachable) | Remove from VALID_ACTIONS, GAME_TOOLS, planner parser |
| Item name normalization | None | New `normalizer.js`, called from `executeAction()` |
| Recipe database | None (RecipeLookup.java already works) | New `crafter.js` + `knowledge/recipes.json` |
| Freestyle building | None (uses existing place endpoint via smart_place) | New `freestyle.js`, `placement-tracker.js` |
| Block placement tracking | Add placement data to handlePlace response | `placement-tracker.js` reads from response |
| Spatial memory | None | Extend `locations.js` + `command-parser.js` |
| Base tether | None | Extend `index.js` tick with tether check |
| Task verification | None | Complete `pendingReview` wiring in `index.js` |
| Human msg response | None | New `chat-queue.js`, shared between planner + action loop |
| Skript wrappers | New .sk commands on server | Extend `command-parser.js` for new output formats |

**Mod rebuild required:** Only for smart place and chest interaction. All other features are agent-side and deploy by restarting the Node.js process.

---

## Data Flow: Freestyle Building

```
Planner LLM generates plan text with BUILD block
                    |
         planner.js detects BUILD block
                    |
   freestyle.js parseFreestylePlan() -> [{block,x,y,z}]
                    |
        action-queue.js setQueue() with smart_place actions
                    |
     index.js 2s tick: popAction() -> smart_place {item, x, y, z}
                    |
   actions.js executeAction() -> normalizeItemName() -> POST /action
                    |
    ActionExecutor.java handlePlace() -> auto-equip -> look -> place
         response: {success:true, placed:{block, x, y, z}}
                    |
     index.js receives result -> placement-tracker.js recordPlacement()
                    |
  (after all blocks placed) planner verifies via vision.js BUILD: eval
```

---

## Data Flow: Crafting Chain Resolution

```
Planner writes: "craft wooden_pickaxe"
                    |
  planner.js parseQueueFromPlan() hits craft case
                    |
  crafter.js solveCraft("wooden_pickaxe", currentInventory)
  returns: [
    {craft:"oak_planks", need:{oak_log:2}},
    {craft:"stick", need:{oak_planks:1}},
    {craft:"wooden_pickaxe", need:{oak_planks:3, stick:2}}
  ]
                    |
  Queue expanded: [craft oak_planks, craft stick, craft wooden_pickaxe]
                    |
         action-queue.js setQueue() with expanded sequence
                    |
          index.js executes crafts in order
```

---

## New File Map

```
agent/
  normalizer.js             NEW — item name canonicalization
  crafter.js                NEW — recipe chain solver
  freestyle.js              NEW — LLM plan text → placement queue
  placement-tracker.js      NEW — persistent block placement log
  chat-queue.js             NEW — shared human message pending queue
  knowledge/
    recipes.json            NEW — pre-populated early-game recipe database (~50 items)
  data/{name}/
    placement-log.json      NEW — written by placement-tracker.js
    action-queue.json       existing
    locations.json          extended with resources section
    chests.json             existing, auto-updated by chest actions

mod/src/main/java/hermescraft/
  ActionExecutor.java       MODIFIED — smart place full-inv search + chest_deposit + chest_withdraw
  (all others unchanged)

server/plugins/skript/scripts/
  hermescraft.sk            MODIFIED — add /where, /nearbyplayers, /checkblock
```

---

## Build Order (Dependency-Aware)

1. **Item name normalization** (`normalizer.js`)
   - No dependencies. Unblocks everything that handles item names.
   - Agent-only, no rebuild.

2. **Remove mine action**
   - No dependencies. Safe cleanup.
   - Agent-only, no rebuild.

3. **Recipe database + crafter.js**
   - Depends on normalizer.js (uses normalized names as keys).
   - Agent-only, no rebuild. Unlocks reliable crafting chains.

4. **Smart place mod changes + chest interaction** (`ActionExecutor.java`)
   - Batch these into one mod rebuild.
   - Depends on: normalizer.js for item name matching on agent side.
   - Mod rebuild required. Unlock smart_place tool and chest tools.

5. **Freestyle building** (`freestyle.js` + `placement-tracker.js`)
   - Depends on: smart place (step 4), normalizer (step 1).
   - Agent-only, no rebuild.

6. **Spatial memory** (extend `locations.js` + `command-parser.js`)
   - No dependencies. Self-contained extension.
   - Agent-only, no rebuild.

7. **Base tether** (extend `index.js`)
   - Depends on: home location in locations.js (already exists).
   - Agent-only, no rebuild.

8. **Task verification** (complete `pendingReview` in `index.js`)
   - Benefits from placement-tracker.js (step 5) for build verification.
   - Agent-only, no rebuild.

9. **Human message guaranteed response** (`chat-queue.js`)
   - No dependencies.
   - Agent-only, no rebuild.

10. **New Skript wrappers**
    - No agent or mod dependencies.
    - Server-side only, hot-reloads with `/skript reload all`.

**Single mod rebuild required** if steps 4 are batched. Steps 1-3, 5-10 are all agent-side and deploy by restarting the Node.js process.

---

## Architectural Patterns to Follow

### Pattern: Response-Driven State Updates

Rather than polling the mod for state after every action, embed state changes in action responses. The mod already does this for inventory-affecting actions. Extend this pattern to placement events and chest contents.

**What:** Action response JSON carries the delta state (`placed`, `chest_contents`, `transferred`).
**When to use:** Any action that durably changes world state the agent needs to track.
**Trade-off:** Response payloads grow slightly larger. Worth it — avoids extra GET /state round trips per action.

### Pattern: Queue Expansion at Write Time

The planner expands abstract actions (craft wooden_pickaxe) into concrete steps at queue-write time, not at execution time. The action loop remains dumb — it just executes whatever is in the queue.

**What:** `parseQueueFromPlan()` in planner.js preprocesses high-level items into multi-step sequences via crafter.js and freestyle.js.
**When to use:** Any action with implicit prerequisites (crafting chains, equip-then-place sequences).
**Trade-off:** Queue can grow larger than 20 items if chain is deep. The existing 20-item cap in `setQueue()` is a safety valve.

### Pattern: Module-Owned Persistence

Each agent-side module owns exactly one JSON file in `data/{name}/`. The module is the only writer. Other modules call exported functions, never write the file directly.

**Existing:** chests.js owns chests.json, locations.js owns locations.json.
**New:** placement-tracker.js owns placement-log.json.
**Enforce:** index.js and planner.js never write these files directly.

---

## Anti-Patterns to Avoid

### Anti-Pattern: Keeping Both Place and Smart Place in Tool List

**What people do:** Keep both `place` and `smart_place` in GAME_TOOLS to avoid breaking old planner-generated queues.
**Why wrong:** The LLM will keep using the broken `place` tool — training inertia.
**Do this instead:** Remove `place` from GAME_TOOLS entirely. `smart_place` replaces it. `place` stays as an internal action type recognized by actions.js and the mod for backward compat in queued items.

### Anti-Pattern: Recursive Crafting at Execution Time

**What people do:** When a craft action fails (missing ingredient), immediately try to craft the ingredient in the same tick.
**Why wrong:** The action loop becomes recursive and unpredictable. The LLM loses track of position in task.
**Do this instead:** Solve the full chain at plan time in crafter.js. Execution is always linear — the queue contains only independent craft steps in dependency order.

### Anti-Pattern: Extra State Fetch After Each Placement

**What people do:** After smart_place, fetch full state to confirm the block is there.
**Why wrong:** Adds a second HTTP round-trip per block. Kills build speed (3 blocks/tick becomes 1 block per 2 ticks).
**Do this instead:** Trust the mod's success response with the `placed` field. If placement actually failed, the state read on the following tick will reveal it.

### Anti-Pattern: Scanning Inventory on Every Tick for Tether Check

**What people do:** Call `hasItem()` on every tick as a general state monitor.
**Why wrong:** Unnecessary CPU and prompts test that aren't failures.
**Do this instead:** Tether check only reads `state.position` (already fetched every tick). No extra inventory work.

---

## Sources

- Direct inspection: ActionExecutor.java, StateReader.java, RecipeLookup.java, actions.js, tools.js, builder.js, planner.js, action-queue.js, chests.js, locations.js, index.js
- Project diagnosis: memory file `project_v11_diagnosis.md`
- Project requirements: `.planning/PROJECT.md`

---

*Architecture research for: HermesCraft v1.1 Tool Quality & Building Intelligence*
*Researched: 2026-03-21*
