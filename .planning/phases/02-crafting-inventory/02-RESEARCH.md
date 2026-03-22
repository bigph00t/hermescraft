# Phase 2: Crafting + Inventory - Research

**Researched:** 2026-03-22
**Domain:** Mineflayer crafting API, furnace API, chest/container API, inventory management
**Confidence:** HIGH (all API surfaces read directly from installed mineflayer 4.35.0 source + prismarine-windows + prismarine-recipe; minecraft-data 1.21.1 recipes verified at runtime)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key constraints from PROJECT.md and STATE.md:
- Mind + Body split: these are body/ skill functions — no LLM calls
- Cooperative interrupt: every skill checks `bot.interrupt_code` after every `await`
- Existing v1 crafter.js has BFS crafting chain solver using minecraft-data — port/adapt to new body/ structure
- Item name normalization via body/normalizer.js (created in Phase 1)
- All skills use Phase 1 primitives (navigate, dig, place) from body/

### Claude's Discretion
All implementation choices (function signatures, error handling, chest memory format) are at Claude's discretion within the constraints above.

### Deferred Ideas (OUT OF SCOPE)
None — infrastructure phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SKILL-03 | Craft skill — resolve full dependency chain and craft (BFS solver) | v1 `agent/crafter.js` BFS solver is a direct port candidate; `bot.recipesFor()` selects only craftable recipes; `bot.craft(recipe, count, craftingTable)` executes; crafting table must be found/placed for 3x3 recipes |
| SKILL-04 | Smelt skill — place/find furnace, load fuel + input, wait for output | `bot.openFurnace(block)` returns furnace window; `furnace.putInput()` / `furnace.putFuel()` / `furnace.takeOutput()`; poll `furnace.outputItem()` or listen to `furnace.on('update')` for progress |
| SKILL-07 | Chest skill — deposit/withdraw items from chests, remember chest locations | `bot.openChest(block)` returns chest window; `chest.deposit(itemId, null, count)` / `chest.withdraw(itemId, null, count)`; chest location persistence is file-backed JSON (no existing lib — straightforward) |
| SKILL-08 | Inventory management — equip best tools/armor, eat when hungry without being told | `bot.equip(item, destination)` where destination is 'hand'/'head'/'torso'/'legs'/'feet'; `bot.consume()` requires food in hand + hunger below 20; `bot.food` property; `bot.on('health')` event for hunger triggers |
</phase_requirements>

---

## Summary

Phase 2 adds four skills on top of the Phase 1 `body/` primitives. All four APIs are built into mineflayer 4.35.0 — no additional npm packages are needed. The key distinction is that mineflayer exposes two separate recipe systems: `minecraft-data` raw recipes (used by the existing v1 BFS solver in `agent/crafter.js`) and `prismarine-recipe` objects (used by `bot.craft()`). These are different shapes — the planner must understand the bridge between them.

The v1 `agent/crafter.js` BFS solver is the correct starting point for SKILL-03. It already handles: recipe variant selection (oak-first heuristic), `needsCraftingTable` detection, ingredient extraction, and simulation of the inventory through the crafting chain. The only thing missing is the execution layer: translating solved steps into `bot.recipesFor()` + `bot.craft()` calls, finding/placing a crafting table when needed, and interrupt checking after each step.

For SKILL-04, the `bot.openFurnace()` API is complete — slots 0 (input), 1 (fuel), 2 (output) are well-documented. The smelting wait must poll via event listener rather than a fixed sleep, since smelt time varies (coal smelts 8 items, wood smelts 1.5). For SKILL-07, `bot.openChest()` directly provides `chest.deposit()` and `chest.withdraw()`. Chest location memory is a simple JSON file; no library is needed. For SKILL-08, `bot.equip()` handles tool and armor placement; `bot.consume()` handles eating; the hunger threshold pattern (eat below food=14) is straightforward.

**Primary recommendation:** Port v1 crafter.js BFS solver to `body/crafter.js` (module-level utility, not a skill itself), then build `body/skills/craft.js` on top of it using `bot.recipesFor()` + `bot.craft()`. Write `body/skills/smelt.js`, `body/skills/chest.js`, and `body/skills/inventory.js` as thin wrappers over the mineflayer built-in APIs. All four are interrupt-checkable.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mineflayer | 4.35.0 (installed) | `bot.craft`, `bot.openFurnace`, `bot.openChest`, `bot.equip`, `bot.consume` | All crafting/inventory APIs are built-in plugins in the installed version |
| minecraft-data | (installed, transitive) | Recipe lookup for BFS solver in `body/crafter.js` | Already used by v1 crafter.js; `mcData.recipes[id]`, `mcData.itemsByName` |
| prismarine-recipe | (installed, transitive via mineflayer) | `Recipe.find(itemType)` → prismarine Recipe objects for `bot.craft()` | Required by mineflayer craft.js plugin internally; `bot.recipesFor()` wraps this |
| prismarine-windows | (installed, transitive via mineflayer) | `window.count(itemType, metadata)`, `window.items()`, `window.deposit()`, `window.withdraw()` | Window methods are the only inventory query API |

No new npm packages required for Phase 2. All APIs exist in installed mineflayer 4.35.0.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `bot.recipesFor()` + `bot.craft()` | Direct `bot.clickWindow()` slot manipulation | `bot.craft()` handles the full click sequence internally; hand-rolling window clicks is brittle and error-prone |
| `furnace.on('update')` polling | Fixed `sleep()` wait for smelt time | Fixed sleep breaks if fuel runs out or is interrupted; event polling is correct |
| JSON file for chest memory | In-memory Map | In-memory Map is lost on crash; file-backed JSON survives session restarts (matches MEMORY.md philosophy) |

---

## Architecture Patterns

### Recommended Project Structure
```
body/
├── bot.js           # Phase 1 — createBot, plugins, spawn lifecycle
├── navigate.js      # Phase 1 — goto() with wall-clock timeout
├── dig.js           # Phase 1 — dig() with post-dig verification
├── place.js         # Phase 1 — placeBlock() with post-place verification
├── interrupt.js     # Phase 1 — interrupt flag management
├── normalizer.js    # Phase 1 — item/block name normalization
├── crafter.js       # Phase 2 — BFS dependency solver (ported from agent/crafter.js)
└── skills/
    ├── gather.js    # Phase 1
    ├── mine.js      # Phase 1
    ├── craft.js     # Phase 2 — resolve + execute full crafting chain
    ├── smelt.js     # Phase 2 — furnace: put input/fuel, wait, take output
    ├── chest.js     # Phase 2 — deposit/withdraw, remember chest positions
    └── inventory.js # Phase 2 — equip best tool/armor, eat when hungry
```

`body/crafter.js` is a utility module (not a skill). Skills import it. It is not exported as a skill entry point.

### Pattern 1: Two Recipe Systems — BFS Solver vs bot.craft()

**What:** There are two separate recipe objects in the stack:
1. **minecraft-data recipes** (`mcData.recipes[itemId]`) — raw JSON shapes with numeric ingredient IDs. Used by the BFS solver for dependency resolution. Already fully implemented in `agent/crafter.js`.
2. **prismarine-recipe Recipe objects** — created by `Recipe.find(itemType)` or accessed via `bot.recipesFor(itemType, null, count, craftingTable)`. These are what `bot.craft(recipe, count, craftingTable)` consumes.

**Bridge:** After the BFS solver resolves a step, use `bot.recipesFor(itemId, null, 1, craftingTableBlock)` to get the craftable Recipe object and pass it to `bot.craft()`. Do NOT pass raw minecraft-data recipe objects to `bot.craft()`.

**When to use:** Always. Never pass a raw `mcData.recipes[id]` element to `bot.craft()`.

```javascript
// Source: mineflayer/lib/plugins/craft.js (read from source)
// After BFS solver says "craft wooden_pickaxe":
const itemId = mcData.itemsByName['wooden_pickaxe'].id
// Find a craftable recipe (checks inventory has enough ingredients)
const recipes = bot.recipesFor(itemId, null, 1, craftingTableBlock || null)
if (recipes.length === 0) {
  return { success: false, reason: 'no_craftable_recipe' }
}
await bot.craft(recipes[0], 1, craftingTableBlock || null)
```

### Pattern 2: Crafting Table — Find or Place

**What:** Recipes where `needsCraftingTable` is true (detected in v1 crafter.js by `rows >= 3 || cols >= 3`) require passing a `craftingTable` Block to `bot.craft()`. The block must be adjacent and bot must be within reach.

**How:**
1. Check bot inventory for `crafting_table` item.
2. Search nearby for existing crafting_table block (`bot.findBlock`).
3. If none found and inventory has one, place it using `body/place.js` primitives.
4. Navigate to within reach of the crafting table.
5. Pass the Block object to `bot.craft()`.

**When to use:** Every time the BFS step has `needsTable: true`.

```javascript
// Source: body/place.js + mineflayer API docs
let craftingTable = bot.findBlock({ matching: mcData.blocksByName['crafting_table'].id, maxDistance: 8 })
if (!craftingTable) {
  // place from inventory
  const ref = bot.blockAt(bot.entity.position.offset(0, -1, 0))  // ground below
  await placeBlock(bot, ref, FACE.TOP)
  craftingTable = bot.findBlock({ matching: mcData.blocksByName['crafting_table'].id, maxDistance: 8 })
}
await navigateToBlock(bot, craftingTable)
```

### Pattern 3: Furnace Smelt with Event-Driven Wait

**What:** After placing input and fuel in the furnace, wait for the output slot to become non-null using the furnace `update` event rather than sleeping. This correctly handles variable smelt times and fuel depletion.

**API verified from source** (`mineflayer/lib/plugins/furnace.js`):
- `bot.openFurnace(furnaceBlock)` → returns furnace window
- `furnace.putInput(itemType, metadata, count)` — loads slot 0
- `furnace.putFuel(itemType, metadata, count)` — loads slot 1
- `furnace.takeOutput()` — collects from slot 2
- `furnace.outputItem()` → current item in output slot (null if empty)
- `furnace.on('update')` → fires on every `craft_progress_bar` packet
- `furnace.fuel` / `furnace.progress` (0.0–1.0 ratios)

```javascript
// Source: mineflayer/lib/plugins/furnace.js (read from source)
const furnace = await bot.openFurnace(furnaceBlock)
if (isInterrupted(bot)) { furnace.close(); return { success: false, reason: 'interrupted' } }
await furnace.putFuel(fuelItemType, null, fuelCount)
if (isInterrupted(bot)) { furnace.close(); return { success: false, reason: 'interrupted' } }
await furnace.putInput(inputItemType, null, inputCount)

// Wait for output with timeout
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('smelt_timeout')), timeoutMs)
  const check = () => {
    if (furnace.outputItem()) {
      clearTimeout(timer)
      furnace.removeListener('update', check)
      resolve()
    }
  }
  furnace.on('update', check)
  check() // check immediately in case already done
})

await furnace.takeOutput()
furnace.close()
```

**Smelt times (from minecraft wiki, HIGH confidence):**
- Coal: smelts 8 items (80 seconds total)
- Charcoal: smelts 8 items
- Wood planks: smelts 1.5 items
- A single raw iron smelts in 10 seconds

### Pattern 4: Chest Deposit/Withdraw

**API verified from source** (`mineflayer/lib/plugins/chest.js`, `prismarine-windows/lib/Window.js`):
- `bot.openChest(chestBlock)` → returns chest window (same as `openContainer`)
- `chest.deposit(itemType, metadata, count)` — moves items from bot inventory to chest
- `chest.withdraw(itemType, metadata, count)` — moves items from chest to bot inventory
- `chest.items()` → array of items currently in the chest
- `chest.count(itemType, metadata)` → count of a specific item in the chest's container slots
- `chest.close()` → closes the window

`itemType` is the numeric item ID (use `mcData.itemsByName[name].id`).

```javascript
// Source: mineflayer/lib/plugins/chest.js + prismarine-windows/lib/Window.js
await navigateToBlock(bot, chestBlock)
if (isInterrupted(bot)) return { success: false, reason: 'interrupted' }
const chest = await bot.openChest(chestBlock)
if (isInterrupted(bot)) { chest.close(); return { success: false, reason: 'interrupted' } }

// deposit
await chest.deposit(mcData.itemsByName['oak_log'].id, null, 32)
// or withdraw
await chest.withdraw(mcData.itemsByName['oak_log'].id, null, 16)

chest.close()
```

**Chest location memory:** Persist as JSON file at `agent/data/{agentName}/chests.json`. Format: array of `{ x, y, z, label, contents_snapshot }`. Label is human-readable (LLM provides). Load on init, save on every write.

### Pattern 5: Equip Best Tool / Armor

**API verified from source** (`mineflayer/lib/plugins/simple_inventory.js`):
- `bot.equip(item, destination)` — item is an Item object from `bot.inventory.findInventoryItem(itemId)`, or a numeric ID
- destinations: `'hand'`, `'head'`, `'torso'`, `'legs'`, `'feet'`, `'off-hand'`
- For tools: equip to `'hand'`. For armor: equip to the appropriate slot.
- `bot.tool.equipForBlock(block)` (from Phase 1, mineflayer-tool) handles tool selection for digging; this is already used by gather/mine skills.
- For armor selection: check each armor slot via `bot.inventory.slots[5]` (head), `[6]` (torso), `[7]` (legs), `[8]` (feet). Compare item names to tier order.

**Armor tier order** (HIGH confidence, from minecraft-data):
```
leather < gold < chainmail < iron < diamond < netherite
```

**Auto-equip pattern:**
```javascript
// Source: mineflayer/lib/plugins/simple_inventory.js
const armorPieces = bot.inventory.items().filter(item =>
  item.name.endsWith('_helmet') ||
  item.name.endsWith('_chestplate') ||
  item.name.endsWith('_leggings') ||
  item.name.endsWith('_boots')
)
for (const piece of armorPieces) {
  const dest = destForArmorPiece(piece.name)  // 'head'/'torso'/'legs'/'feet'
  await bot.equip(piece, dest)
  if (isInterrupted(bot)) break
}
```

### Pattern 6: Eat When Hungry

**API verified from source** (`mineflayer/lib/plugins/inventory.js`):
- `bot.food` — current food level (0–20); 20 = full
- `bot.foodSaturation` — saturation level
- `bot.on('health')` — fires on every `update_health` packet (both health and food changes)
- `bot.consume()` — eats the currently held item; throws if `bot.food === 20` (not hungry in survival) or item is not consumable
- Must `bot.equip(foodItem, 'hand')` before calling `bot.consume()`

**Hunger threshold (SKILL-08 requirement):** eat below food < 14 (standard survival threshold — below this, sprint is disabled).

```javascript
// Source: mineflayer/lib/plugins/inventory.js
async function eatIfHungry(bot) {
  if (bot.food >= 14) return { success: true, reason: 'not_hungry' }
  // Find a food item in inventory
  const foodItem = bot.inventory.items().find(item => mcData.foodsByName[item.name])
  if (!foodItem) return { success: false, reason: 'no_food' }
  await bot.equip(foodItem, 'hand')
  if (isInterrupted(bot)) return { success: false, reason: 'interrupted' }
  await bot.consume()
  return { success: true }
}
```

**Event-driven eat trigger for SKILL-08:** The `inventory.js` skill will expose a function `maybeEat(bot)` called by the skill runner. It does NOT register a persistent event listener — that is a Mode concern (MODE-01, Phase 4). SKILL-08 only provides the reactive function; it does not self-trigger.

### Anti-Patterns to Avoid
- **Passing raw minecraft-data recipe to bot.craft():** `bot.craft()` expects a prismarine-recipe Recipe object (from `bot.recipesFor()`), not a raw `mcData.recipes[id]` element. Using the wrong type causes silent failure or throws.
- **bot.consume() without equipping food first:** `bot.consume()` acts on `bot.heldItem`. If no food is in hand, it throws. Always `bot.equip(foodItem, 'hand')` first.
- **bot.consume() when food=20:** Throws `'Food is full'`. Always check `bot.food < 20` before calling.
- **Not closing chest/furnace window after use:** Failing to call `chest.close()` / `furnace.close()` leaves the window open, which blocks the bot from opening other windows and may desync server state.
- **Fixed sleep for smelt wait:** Smelt time depends on fuel type and item count. Use event-driven polling on `furnace.on('update')` with a wall-clock timeout fallback.
- **BFS solver without craftingTable pass to bot.craft():** `bot.craft()` throws `'Recipe requires craftingTable, but one was not supplied'` if the recipe has `requiresTable: true` and no Block is provided.
- **Crafting table navigation range too large:** The crafting table must be within reach. Use `navigateToBlock()` with range=2 before opening. If bot stands too far, `bot.activateBlock()` silently fails.
- **chest.deposit() when bot has zero of that item:** The `transfer()` call will simply do nothing (no error), making it look like a silent success. Always verify count before calling.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recipe lookup (craftable?) | Custom inventory-to-recipe check | `bot.recipesFor(itemId, null, count, table)` | Checks inventory delta correctly; handles metadata, outShape residuals |
| Recipe execution (clicking slots) | Manual `bot.clickWindow()` slot manipulation | `bot.craft(recipe, count, craftingTable)` | Handles the full crafting GUI click sequence including result collection |
| Furnace slot interaction | Manual window slot clicks | `furnace.putInput()` / `furnace.putFuel()` / `furnace.takeOutput()` | Slot indices differ per window type; the mineflayer furnace plugin encapsulates this |
| Chest slot interaction | Manual `bot.transfer()` calls | `chest.deposit()` / `chest.withdraw()` | Same API surface, window-scoped source/dest ranges computed correctly |
| Item consumption | Manual `bot._client.write('use_item')` | `bot.equip(food, 'hand')` + `bot.consume()` | `consume()` handles the `entity_status` 9 completion event with a 2.5s timeout already |
| Armor type detection by name | String parsing for material | Filter `bot.inventory.items()` by name suffix + tier map | Just string suffix matching is sufficient; material tier order is a constant |

**Key insight:** Phase 2 is almost entirely thin wrappers over built-in mineflayer APIs. The only non-trivial logic is the BFS crafting chain solver (already written in v1) and the crafting table find/place logic. Don't re-implement what mineflayer already handles.

---

## Common Pitfalls

### Pitfall 1: bot.craft() Expects prismarine-recipe, Not minecraft-data Raw Recipe
**What goes wrong:** Passing a raw `mcData.recipes[id][0]` object to `bot.craft()` — it will either throw or behave unexpectedly because the object shapes are different.
**Why it happens:** The v1 crafter.js BFS solver uses `mcData.recipes` directly (correct for dependency resolution). But execution must go through `bot.recipesFor()` which returns prismarine Recipe objects.
**How to avoid:** Always bridge through `bot.recipesFor(itemId, null, 1, craftingTable)` before calling `bot.craft()`. Only call `mcData.recipes` for the BFS planning step.
**Warning signs:** `TypeError: Cannot read property 'id' of undefined` inside mineflayer's craft.js.

### Pitfall 2: Crafting Table Window Type Check
**What goes wrong:** `bot.craft()` internally checks `windowCraftingTable.type.startsWith('minecraft:crafting')` and throws `'non craftingTable used as craftingTable'` if the block passed isn't actually a crafting table.
**Why it happens:** Passing the wrong block object (e.g., a chest block found nearby).
**How to avoid:** Only use `bot.findBlock({ matching: mcData.blocksByName['crafting_table'].id, ... })` to locate the crafting table. Verify the block name after finding.

### Pitfall 3: Furnace openFurnace() Requires a furnace Block, Not blast_furnace
**What goes wrong:** `bot.openFurnace()` works for `furnace`, `blast_furnace`, and `smoker` blocks, but passing a `stonecutter` or `smithing_table` block will throw `'This is not a furnace-like window'`.
**Why it happens:** The allowed window type check in furnace.js is explicit.
**How to avoid:** Always verify block name before calling `bot.openFurnace()`. The smelt skill should only accept `furnace`, `blast_furnace`, `smoker`.

### Pitfall 4: chest.withdraw() Throws When Bot Inventory Is Full
**What goes wrong:** `chest.withdraw()` throws `'Unable to withdraw, Bot inventory is full.'` before attempting the transfer.
**Why it happens:** `bot.inventory.emptySlotCount() === 0` check at the top of the `withdraw` method.
**How to avoid:** Check `bot.inventory.emptySlotCount() > 0` before calling `withdraw()`. Return `{ success: false, reason: 'inventory_full' }` rather than letting the throw propagate.

### Pitfall 5: bot.consume() Throws When Not Hungry or Wrong Item in Hand
**What goes wrong:** `bot.consume()` throws `'Food is full'` when `bot.food === 20`.
**Why it happens:** Explicit guard in inventory.js: `if (bot.game.gameMode !== 'creative' && !ALWAYS_CONSUMABLES.includes(bot.heldItem.name) && bot.food === 20)`.
**How to avoid:** Always check `bot.food < 20` before calling. Additionally check the held item is actually consumable (in `mcData.foodsByName`).

### Pitfall 6: Smelting With No Fuel Produces No Output
**What goes wrong:** `putInput()` loads the raw material but nothing smelts — `furnace.on('update')` never shows progress.
**Why it happens:** The furnace has no fuel. Progress property stays 0.
**How to avoid:** Always call `putFuel()` before `putInput()`. Check `furnace.fuelItem()` after putting fuel to confirm it registered. Default fuel: charcoal (8 items per piece), or wood planks (1.5 items per piece).

### Pitfall 7: Smelt Timeout Too Short for Multiple Items
**What goes wrong:** Smelt skill times out before all items complete.
**Why it happens:** Each item takes 10 seconds (200 ticks). Smelting 8 raw iron takes 80 seconds. Default 30s nav timeout is too short.
**How to avoid:** Calculate smelt timeout as `inputCount * 10_000 + 10_000` ms buffer. Pass this to the wait timer rather than a fixed constant.

### Pitfall 8: BFS Solver visited Set Prevents Multi-Craft Quantities
**What goes wrong:** Crafting `wooden_pickaxe` x3 only plans for 1 because `visited.has('wooden_pickaxe')` short-circuits on the second pass.
**Why it happens:** The v1 `resolve()` function marks `normalized` as visited before computing `craftTimesNeeded`. For count > 1, `craftTimesNeeded = ceil((neededCount - available) / outputCount)` correctly handles this in a single call — the issue only appears if `resolve` is called twice for the same item.
**How to avoid:** The v1 solver's single-call design handles quantity correctly (it computes `craftTimesNeeded` based on `neededCount`). Just call `resolve(target, desiredCount)` once. Do not call it in a loop.

---

## Code Examples

Verified patterns from official sources (all read directly from node_modules):

### Craft Skill — Bridge BFS Steps to bot.craft()
```javascript
// Source: mineflayer/lib/plugins/craft.js + prismarine-recipe/lib/recipe.js
import { solveCraft } from '../crafter.js'
import { navigateToBlock } from '../navigate.js'
import { placeBlock, FACE } from '../place.js'
import { isInterrupted } from '../interrupt.js'
import minecraftData from 'minecraft-data'
const mcData = minecraftData('1.21.1')

export async function craft(bot, itemName, count = 1) {
  const inv = {}
  for (const item of bot.inventory.items()) {
    inv[item.name] = (inv[item.name] || 0) + item.count
  }
  const { steps, missing } = solveCraft(itemName, inv)
  if (missing.length > 0) {
    return { success: false, reason: 'missing_materials', missing }
  }
  for (const step of steps) {
    if (isInterrupted(bot)) return { success: false, reason: 'interrupted' }
    const itemEntry = mcData.itemsByName[step.item]
    if (!itemEntry) return { success: false, reason: `unknown_item: ${step.item}` }

    let tableBlock = null
    if (step.needsTable) {
      tableBlock = bot.findBlock({ matching: mcData.blocksByName['crafting_table'].id, maxDistance: 8 })
      if (!tableBlock) {
        // place crafting table from inventory
        const ctItem = bot.inventory.findInventoryItem(mcData.itemsByName['crafting_table'].id)
        if (!ctItem) return { success: false, reason: 'no_crafting_table' }
        const ground = bot.blockAt(bot.entity.position.offset(1, -1, 0))
        await placeBlock(bot, ground, FACE.TOP)
        if (isInterrupted(bot)) return { success: false, reason: 'interrupted' }
        tableBlock = bot.findBlock({ matching: mcData.blocksByName['crafting_table'].id, maxDistance: 8 })
      }
      if (tableBlock) await navigateToBlock(bot, tableBlock)
      if (isInterrupted(bot)) return { success: false, reason: 'interrupted' }
    }

    // Bridge: get prismarine-recipe object for bot.craft()
    const recipes = bot.recipesFor(itemEntry.id, null, step.count, tableBlock)
    if (recipes.length === 0) return { success: false, reason: `no_craftable_recipe: ${step.item}` }
    await bot.craft(recipes[0], step.count, tableBlock)
    if (isInterrupted(bot)) return { success: false, reason: 'interrupted' }
  }
  return { success: true, item: itemName, count }
}
```

### Smelt Skill — Event-Driven Wait
```javascript
// Source: mineflayer/lib/plugins/furnace.js (read from source)
export async function smelt(bot, inputName, fuelName, count = 1, options = {}) {
  const timeoutMs = options.timeoutMs ?? (count * 12_000 + 5_000)
  const inputId = mcData.itemsByName[normalizeItemName(inputName)]?.id
  const fuelId = mcData.itemsByName[normalizeItemName(fuelName)]?.id
  if (!inputId || !fuelId) return { success: false, reason: 'unknown_item' }

  let furnaceBlock = bot.findBlock({ matching: mcData.blocksByName['furnace'].id, maxDistance: 32 })
  if (!furnaceBlock) return { success: false, reason: 'no_furnace_nearby' }

  const nav = await navigateToBlock(bot, furnaceBlock)
  if (!nav.success) return { success: false, reason: nav.reason }
  if (isInterrupted(bot)) return { success: false, reason: 'interrupted' }

  const furnace = await bot.openFurnace(furnaceBlock)
  try {
    await furnace.putFuel(fuelId, null, Math.ceil(count / 8) + 1)
    if (isInterrupted(bot)) return { success: false, reason: 'interrupted' }
    await furnace.putInput(inputId, null, count)
    if (isInterrupted(bot)) return { success: false, reason: 'interrupted' }

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('smelt_timeout')), timeoutMs)
      const check = () => {
        if (furnace.outputItem()) { clearTimeout(timer); furnace.removeListener('update', check); resolve() }
      }
      furnace.on('update', check)
      check()
    })
    await furnace.takeOutput()
    return { success: true, item: inputName, count }
  } finally {
    furnace.close()
  }
}
```

### Chest Deposit/Withdraw
```javascript
// Source: mineflayer/lib/plugins/chest.js + prismarine-windows/lib/Window.js
export async function depositToChest(bot, chestBlock, itemName, count) {
  const itemId = mcData.itemsByName[normalizeItemName(itemName)]?.id
  if (!itemId) return { success: false, reason: 'unknown_item' }

  const nav = await navigateToBlock(bot, chestBlock)
  if (!nav.success) return { success: false, reason: nav.reason }
  if (isInterrupted(bot)) return { success: false, reason: 'interrupted' }

  const chest = await bot.openChest(chestBlock)
  try {
    const available = bot.inventory.count(itemId, null)
    const toDeposit = Math.min(count, available)
    if (toDeposit === 0) return { success: false, reason: 'no_items_to_deposit' }
    await chest.deposit(itemId, null, toDeposit)
    if (isInterrupted(bot)) return { success: false, reason: 'interrupted' }
    return { success: true, item: itemName, deposited: toDeposit }
  } finally {
    chest.close()
  }
}
```

### Inventory Management — Equip Best + Eat
```javascript
// Source: mineflayer/lib/plugins/simple_inventory.js + inventory.js
const ARMOR_TIER = ['leather', 'golden', 'chainmail', 'iron', 'diamond', 'netherite']
const ARMOR_SLOT = { helmet: 'head', chestplate: 'torso', leggings: 'legs', boots: 'feet' }

function armorTier(itemName) {
  for (let i = ARMOR_TIER.length - 1; i >= 0; i--) {
    if (itemName.startsWith(ARMOR_TIER[i])) return i
  }
  return -1
}

export async function equipBestArmor(bot) {
  const armorSlotNums = { head: 5, torso: 6, legs: 7, feet: 8 }
  for (const [suffix, dest] of Object.entries(ARMOR_SLOT)) {
    if (isInterrupted(bot)) return { success: false, reason: 'interrupted' }
    const candidates = bot.inventory.items().filter(i => i.name.endsWith('_' + suffix))
    if (candidates.length === 0) continue
    const best = candidates.sort((a, b) => armorTier(b.name) - armorTier(a.name))[0]
    const currentSlotNum = armorSlotNums[dest]
    const current = bot.inventory.slots[currentSlotNum]
    if (!current || armorTier(best.name) > armorTier(current.name)) {
      await bot.equip(best, dest)
    }
  }
  return { success: true }
}

export async function eatIfHungry(bot, threshold = 14) {
  if (bot.food >= threshold) return { success: true, reason: 'not_hungry' }
  const foodItem = bot.inventory.items().find(i => mcData.foodsByName[i.name])
  if (!foodItem) return { success: false, reason: 'no_food' }
  await bot.equip(foodItem, 'hand')
  if (isInterrupted(bot)) return { success: false, reason: 'interrupted' }
  try {
    await bot.consume()
  } catch (err) {
    return { success: false, reason: err.message }
  }
  return { success: true }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1 crafter.js lives in `agent/` (LLM-side) | Port BFS solver to `body/crafter.js` (body-side utility) | Phase 2 (now) | Correct Mind+Body boundary; body never calls LLM |
| v1 chest skill used HTTP bridge + Baritone | Direct `bot.openChest()` + `chest.deposit()` / `chest.withdraw()` | v2.0 | No bridge latency, Promise-based, interruptible |
| v1 smelting via Baritone chat commands | `bot.openFurnace()` + `furnace.putInput()` / `furnace.putFuel()` | v2.0 | Direct API, event-driven completion, no chat round-trip |

**Deprecated/outdated:**
- `agent/crafter.js` import from `./normalizer.js`: the v1 crafter imports from its own agent/ normalizer. When porting to `body/crafter.js`, update the import to `body/normalizer.js`.
- `agent/crafter.js` `initCrafter()`: the init pattern is fine but the Phase 1 body/ files use module-level init (no explicit `init*` call needed for minecraft-data). The port should follow the same pattern as other body/ files.

---

## Open Questions

1. **Crafting table placement — bot standing in the way**
   - What we know: `placeBlock(bot, ref, FACE.TOP)` places a block on top of a reference block. If bot is standing directly above the reference block, placement will fail with `'placement_failed'` (post-verify check).
   - What's unclear: The exact offset to use for `ref` when placing a crafting table adjacent to the bot without colliding.
   - Recommendation: Place at `bot.entity.position.offset(1, -1, 0)` (one block forward at floor level) rather than directly below. If that fails, try other cardinal offsets. Return `{ success: false, reason: 'cant_place_crafting_table' }` after exhausting 4 offsets.

2. **bot.recipesFor() with count > output batch**
   - What we know: `bot.recipesFor(itemId, null, minResultCount, craftingTable)` only returns recipes where the bot has enough ingredients for `minResultCount` items. `count` param to `craft()` is the number of times to repeat the recipe, not the total output count.
   - What's unclear: If wooden pickaxe recipe outputs 1 and we want 3, we must call `bot.craft(recipe, 3, table)` which repeats the craft 3 times. The BFS step already computes `craftTimesNeeded`.
   - Recommendation: Pass `step.count` as the `count` argument to `bot.craft()`. Verify after craft that inventory count increased by the expected amount.

3. **Chest memory and multi-agent coordination**
   - What we know: Phase 2 builds SKILL-07 as a single-agent skill. Multi-agent coordination is SOUL-04 (Phase 5).
   - What's unclear: Whether a shared chests.json is needed now or just per-agent.
   - Recommendation: Per-agent JSON at `agent/data/{agentName}/chests.json` for Phase 2. Shared memory is Phase 5 concern.

---

## Sources

### Primary (HIGH confidence)
- `node_modules/mineflayer/lib/plugins/craft.js` — `bot.craft()`, `bot.recipesFor()`, `bot.recipesAll()` API read from source
- `node_modules/mineflayer/lib/plugins/furnace.js` — `bot.openFurnace()`, `furnace.putInput()`, `furnace.putFuel()`, `furnace.takeOutput()`, `furnace.on('update')` read from source
- `node_modules/mineflayer/lib/plugins/chest.js` — `bot.openChest()` / `bot.openContainer()`, allowed window types read from source
- `node_modules/mineflayer/lib/plugins/simple_inventory.js` — `bot.equip(item, destination)`, armor slot numbers, armor destination names read from source
- `node_modules/mineflayer/lib/plugins/inventory.js` — `bot.consume()`, `bot.food`, `bot.on('health')`, `window.deposit()`, `window.withdraw()` read from source
- `node_modules/prismarine-windows/lib/Window.js` — `window.count()`, `window.items()`, `window.containerItems()`, `window.emptySlotCount()`, `window.findInventoryItem()` read from source
- `node_modules/prismarine-recipe/lib/recipe.js` — `Recipe.find()`, `recipe.requiresTable`, `recipe.delta` read from source
- `agent/crafter.js` — v1 BFS solver read from source; fully reusable with import path update
- minecraft-data 1.21.1 runtime — verified: `wooden_pickaxe` recipe (last variant = oak planks), `stick` recipe (last variant = oak planks), `oak_planks` recipe (ingredient = oak_log id 132), `foodsArray`, window definitions for furnace/chest/workbench

### Secondary (MEDIUM confidence)
- minecraft.wiki Food page — smelt times (10s per item), hunger threshold logic (sprint disabled below 6 food points; practical eat threshold is 14)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all APIs read directly from installed node_modules source files
- Architecture: HIGH — BFS solver verified working from v1; mineflayer APIs verified from source
- Pitfalls: HIGH — identified from direct source code reading (bot.craft() throws, chest.withdraw() throws, consume() throws are explicit guards in source)

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (mineflayer 4.35.0 is stable; prismarine-windows/recipe are internal transitive deps unlikely to change)
