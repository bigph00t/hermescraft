// craft.js — Resolve full crafting dependency chain and execute each step

import minecraftData from 'minecraft-data'
import { solveCraft } from '../crafter.js'
import { normalizeItemName } from '../normalizer.js'
import { navigateToBlock } from '../navigate.js'
import { placeBlock, FACE } from '../place.js'
import { isInterrupted } from '../interrupt.js'

const mcData = minecraftData('1.21.1')

// ── Helpers ──

/**
 * Snapshot the bot's current inventory as a plain { itemName: count } map.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {Object.<string, number>}
 */
function getInventorySnapshot(bot) {
  const inv = {}
  for (const item of bot.inventory.items()) {
    inv[item.name] = (inv[item.name] || 0) + item.count
  }
  return inv
}

/**
 * Find an existing crafting table within 32 blocks, or place one from inventory.
 * Returns the crafting_table Block object on success, null if not available.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {Promise<import('mineflayer').Block | null>}
 */
async function findOrPlaceCraftingTable(bot) {
  // Check interrupt before starting
  if (isInterrupted(bot)) return null

  const tableId = mcData.blocksByName['crafting_table'].id
  const tableItemId = mcData.itemsByName['crafting_table'].id

  // Search for an existing crafting table nearby
  let tableBlock = bot.findBlock({ matching: tableId, maxDistance: 32 })

  if (tableBlock) {
    const nav = await navigateToBlock(bot, tableBlock)
    if (isInterrupted(bot)) return null
    if (nav.success) return tableBlock
    // Navigation failed — try placing one instead
  }

  // No reachable crafting table found — check inventory
  const tableItem = bot.inventory.findInventoryItem(tableItemId, null)
  if (!tableItem) {
    return null
  }

  // Try placing on 4 cardinal offsets below bot (ground level adjacent)
  const offsets = [
    [1, -1, 0],
    [-1, -1, 0],
    [0, -1, 1],
    [0, -1, -1],
  ]

  // Equip the crafting table before attempting placement
  try {
    await bot.equip(tableItem, 'hand')
  } catch {
    return null  // can't equip — bail
  }

  for (const [dx, dy, dz] of offsets) {
    if (isInterrupted(bot)) return null

    const refBlock = bot.blockAt(bot.entity.position.offset(dx, dy, dz))
    if (!refBlock || refBlock.name === 'air') continue

    const placed = await placeBlock(bot, refBlock, FACE.TOP)
    if (isInterrupted(bot)) return null

    if (placed.success) {
      // Re-find the crafting table — it should now be adjacent
      tableBlock = bot.findBlock({ matching: tableId, maxDistance: 8 })
      if (tableBlock) {
        const nav = await navigateToBlock(bot, tableBlock)
        if (isInterrupted(bot)) return null
        if (nav.success) return tableBlock
      }
      break
    }
  }

  return tableBlock || null
}

// ── Main export ──

/**
 * Resolve the full crafting dependency chain for an item and execute each step.
 *
 * Steps through the BFS-solved chain from leaves to root:
 *   - Finds or places a crafting table when a 3x3 recipe requires one
 *   - Bridges BFS solver steps through bot.recipesFor() -> bot.craft()
 *   - Checks bot.interrupt_code after every await (cooperative interrupt)
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string} itemName - raw item name (will be normalized)
 * @param {number} [count=1] - number of the final item to craft
 * @returns {Promise<{success: boolean, item: string, count?: number, reason?: string, missing?: string[]}>}
 */
export async function craft(bot, itemName, count = 1) {
  // Check interrupt at start
  if (isInterrupted(bot)) {
    return { success: false, item: itemName, reason: 'interrupted' }
  }

  const normalizedName = normalizeItemName(itemName)

  // Snapshot inventory and resolve the full dependency chain.
  // Pass `count` so the solver plans for the correct number of output items —
  // without this, solveCraft always plans for 1 regardless of what was requested.
  const inventory = getInventorySnapshot(bot)
  const { steps, missing } = solveCraft(normalizedName, inventory, count)

  if (missing.length > 0) {
    return { success: false, reason: 'missing_materials', missing, item: normalizedName }
  }

  if (steps.length === 0) {
    return { success: true, reason: 'already_have', item: normalizedName }
  }

  // Execute each step in BFS order (leaves first)
  for (const step of steps) {
    // Check interrupt before each step
    if (isInterrupted(bot)) {
      return { success: false, item: normalizedName, reason: 'interrupted' }
    }

    // Look up item in minecraft-data registry
    const itemEntry = mcData.itemsByName[step.item]
    if (!itemEntry) {
      return { success: false, reason: 'unknown_item', item: step.item }
    }

    let tableBlock = null

    if (step.needsTable) {
      // Try to find or place a crafting table
      tableBlock = await findOrPlaceCraftingTable(bot)

      if (isInterrupted(bot)) {
        return { success: false, item: normalizedName, reason: 'interrupted' }
      }

      if (!tableBlock) {
        // Try to craft a crafting_table first (4 oak_planks -> crafting_table)
        const planksId = mcData.itemsByName['oak_planks']?.id
        if (planksId !== undefined) {
          const planksItem = bot.inventory.findInventoryItem(planksId, null)
          if (planksItem && planksItem.count >= 4) {
            const tableItemId = mcData.itemsByName['crafting_table'].id
            const tableRecipes = bot.recipesFor(tableItemId, null, 1, null)
            if (tableRecipes.length > 0) {
              try {
                await bot.craft(tableRecipes[0], 1, null)
              } catch (err) {
                // ignore — will fail below if table still not available
              }
              if (isInterrupted(bot)) {
                return { success: false, item: normalizedName, reason: 'interrupted' }
              }
              tableBlock = await findOrPlaceCraftingTable(bot)
              if (isInterrupted(bot)) {
                return { success: false, item: normalizedName, reason: 'interrupted' }
              }
            }
          }
        }

        if (!tableBlock) {
          return { success: false, reason: 'no_crafting_table', item: step.item }
        }
      }
    }

    // Bridge to prismarine-recipe via bot.recipesFor() — do NOT pass raw mcData recipes to bot.craft()
    const recipes = bot.recipesFor(itemEntry.id, null, 1, tableBlock)
    if (recipes.length === 0) {
      return { success: false, reason: 'no_craftable_recipe', item: step.item }
    }

    // bot.craft(recipe, count, table) — 'count' is times to repeat the craft operation,
    // which is exactly what the BFS solver puts in step.count.
    // step.count is already Math.ceil(neededItems / outputPerCraft) from crafter.js.
    const craftTimes = step.count
    console.log(`[craft] attempting ${craftTimes}x craft of ${step.item} (recipe yields ${recipes[0].result?.count ?? 1} per craft)`)

    try {
      await bot.craft(recipes[0], craftTimes, tableBlock)
    } catch (err) {
      return { success: false, reason: err.message || 'craft_failed', item: step.item }
    }

    // Wait for the server to sync the inventory window — without this the next step's
    // inventory check may see stale slot data and incorrectly report missing materials.
    await bot.waitForTicks(2)

    // Check interrupt after craft
    if (isInterrupted(bot)) {
      return { success: false, item: normalizedName, reason: 'interrupted' }
    }

    const produced = (recipes[0].result?.count ?? 1) * craftTimes
    console.log(`[craft] crafted ${produced}x ${step.item} (${craftTimes} craft ops)`)
  }

  return { success: true, item: normalizedName, count }
}
