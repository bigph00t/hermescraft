// crafter.js — BFS recipe chain solver using minecraft-data 1.21.1

import minecraftData from 'minecraft-data'
import { normalizeItemName } from './normalizer.js'

const mcData = minecraftData('1.21.1')
console.log(`[crafter] Loaded ${Object.keys(mcData.recipes).length} recipe types`)

// ── Helpers ──

/**
 * Determine if a recipe requires a crafting table.
 * 3x3 shaped recipes need a table; 2x2 and shapeless do not.
 */
function needsCraftingTable(recipe) {
  if (recipe.inShape) {
    const rows = recipe.inShape.length
    const cols = recipe.inShape.reduce((max, row) => Math.max(max, row.length), 0)
    return rows >= 3 || cols >= 3
  }
  // Shapeless: >4 ingredients would need a table but is vanilla-impossible
  if (recipe.ingredients) {
    return recipe.ingredients.length > 4
  }
  return false
}

/**
 * Extract ingredient counts from a recipe.
 * Returns array of { item: string (normalized name), count: number }
 */
function getIngredients(recipe) {
  const idCounts = {}

  if (recipe.inShape) {
    // Flatten the 2D shape array, ignore nulls
    for (const row of recipe.inShape) {
      for (const id of row) {
        if (id !== null && id !== undefined) {
          idCounts[id] = (idCounts[id] || 0) + 1
        }
      }
    }
  } else if (recipe.ingredients) {
    for (const id of recipe.ingredients) {
      if (id !== null && id !== undefined) {
        idCounts[id] = (idCounts[id] || 0) + 1
      }
    }
  }

  return Object.entries(idCounts).map(([idStr, count]) => {
    const id = Number(idStr)
    const itemEntry = mcData.items[id]
    const rawName = itemEntry ? itemEntry.name : String(id)
    const normalizedName = normalizeItemName(rawName)
    return { item: normalizedName, count }
  })
}

/**
 * Select the best recipe variant for a target item based on what's already in inventory.
 * Scores each variant by how many distinct ingredient types the inventory has.
 * Tie-breaks by preferring variants at the END of the array (oak variants last = most common early-game).
 */
function selectBestVariant(recipes, inventory) {
  let bestScore = -1
  let bestVariant = recipes[recipes.length - 1] // default: last (oak variant)

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i]
    const ingredients = getIngredients(recipe)

    // Count how many distinct ingredient types are in inventory
    let score = 0
    for (const ing of ingredients) {
      const have = inventory[ing.item] || 0
      if (have > 0) score++
    }

    // Prefer higher score; tie-break: prefer end of array (i closer to length-1)
    if (score > bestScore || (score === bestScore && i >= recipes.indexOf(bestVariant))) {
      bestScore = score
      bestVariant = recipe
    }
  }

  return bestVariant
}

// ── Main export ──

/**
 * Solve the full crafting dependency chain for a target item.
 *
 * @param {string} targetItem - Normalized item name (e.g. 'wooden_pickaxe')
 * @param {Object} inventory - { itemName: count, ... } current inventory
 * @param {number} [targetCount=1] - how many of the target item to craft
 * @returns {{ steps: Array, missing: Array }}
 *   steps: ordered leaf-to-root craft operations
 *   missing: raw materials not in inventory
 */
export function solveCraft(targetItem, inventory, targetCount = 1) {
  const steps = []
  const missing = []

  // Cycle detection: tracks items currently being resolved in the call stack.
  // Unlike the old 'visited' set, this is cleared when a resolve() completes,
  // so the SAME item CAN be resolved again by a different consumer.
  // This is critical for multi-consumer dependencies like wooden_pickaxe
  // (needs planks directly + planks via sticks).
  const inProgress = new Set()

  // Working copy of a simulated inventory — tracks available counts.
  // Consumption is deducted immediately on entry; production is credited on exit.
  const simInventory = Object.assign({}, inventory)

  /**
   * Recursively resolve a craft step for 'item'.
   * Returns true if resolvable, false if it's a raw material we don't have.
   */
  function resolve(itemName, neededCount, depth = 0) {
    if (depth > 20) return false  // prevent infinite recursion

    const normalized = normalizeItemName(itemName)

    // Consume what we can from simulated inventory immediately.
    // This ensures sibling ingredients see reduced availability.
    const available = simInventory[normalized] || 0
    const fromInventory = Math.min(available, neededCount)
    simInventory[normalized] = available - fromInventory
    const deficit = neededCount - fromInventory

    // If we have enough after reservation, no crafting needed
    if (deficit <= 0) return true

    // Cycle guard: if this item is already being resolved up the call stack,
    // we have a circular dependency. Return true to avoid infinite recursion.
    if (inProgress.has(normalized)) return true

    // Look up item in minecraft-data
    const itemEntry = mcData.itemsByName[normalized]
    if (!itemEntry) {
      if (!missing.includes(itemName)) {
        missing.push(itemName)
      }
      return false
    }

    // Look up recipes for this item
    const recipes = mcData.recipes[itemEntry.id]
    if (!recipes || recipes.length === 0) {
      // Raw material — not craftable; report missing
      if (!missing.includes(normalized)) {
        missing.push(normalized)
      }
      return false
    }

    // Select best recipe variant based on current simulated inventory
    const recipe = selectBestVariant(recipes, simInventory)
    const outputCount = (recipe.result && recipe.result.count) ? recipe.result.count : 1
    const craftTimesNeeded = Math.ceil(deficit / outputCount)

    // Mark in-progress BEFORE recursing to detect cycles
    inProgress.add(normalized)

    // Recursively resolve each ingredient
    const ingredients = getIngredients(recipe)
    for (const ing of ingredients) {
      const totalIngNeeded = ing.count * craftTimesNeeded
      resolve(ing.item, totalIngNeeded, depth + 1)
    }

    // Clear in-progress — this item is resolved, other consumers can re-enter
    inProgress.delete(normalized)

    // Check if this exact item+count step already exists — merge to avoid duplicates
    const existingStep = steps.find(s => s.item === normalized)
    if (existingStep) {
      existingStep.count += craftTimesNeeded
    } else {
      const needsTable = needsCraftingTable(recipe)
      steps.push({
        action: 'craft',
        item: normalized,
        count: craftTimesNeeded,
        ingredients,
        needsTable,
      })
    }

    // Credit surplus production to simulated inventory
    const surplus = (craftTimesNeeded * outputCount) - deficit
    if (surplus > 0) {
      simInventory[normalized] = (simInventory[normalized] || 0) + surplus
    }

    return true
  }

  const normalizedTarget = normalizeItemName(targetItem)
  resolve(normalizedTarget, Math.max(1, targetCount))

  return { steps, missing }
}
