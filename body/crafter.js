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
 * @returns {{ steps: Array, missing: Array }}
 *   steps: ordered leaf-to-root craft operations
 *   missing: raw materials not in inventory
 */
export function solveCraft(targetItem, inventory) {
  const steps = []
  const missing = []

  // Track what we've added to steps to avoid duplicates
  const visited = new Set()

  // Working copy of a simulated inventory (includes what we'll produce by crafting)
  // Keys are normalized names, values are counts available (real + will-produce)
  const simInventory = Object.assign({}, inventory)

  /**
   * Recursively resolve a craft step for 'item'.
   * Returns true if resolvable, false if it's a raw material we don't have.
   */
  function resolve(itemName, neededCount, depth = 0) {
    if (depth > 20) return false  // prevent infinite recursion

    const normalized = normalizeItemName(itemName)

    // If already have enough, skip
    const available = simInventory[normalized] || 0
    if (available >= neededCount) return true

    // Avoid re-processing the same item twice in the same chain
    if (visited.has(normalized)) return true

    // Look up item in minecraft-data
    const itemEntry = mcData.itemsByName[normalized]
    if (!itemEntry) {
      // Unknown item — add to missing if not already tracked
      if (!missing.includes(itemName)) {
        missing.push(itemName)
      }
      return false
    }

    // Look up recipes for this item
    const recipes = mcData.recipes[itemEntry.id]
    if (!recipes || recipes.length === 0) {
      // Raw material — check if we have it
      if (available < neededCount) {
        if (!missing.includes(normalized)) {
          missing.push(normalized)
        }
      }
      return available >= neededCount
    }

    // Select best recipe variant based on current simulated inventory
    const recipe = selectBestVariant(recipes, simInventory)
    const outputCount = (recipe.result && recipe.result.count) ? recipe.result.count : 1
    const craftTimesNeeded = Math.ceil(Math.max(0, neededCount - available) / outputCount)

    // Mark as visited BEFORE recursing to prevent circular dependencies
    visited.add(normalized)

    // Recursively resolve each ingredient
    const ingredients = getIngredients(recipe)
    for (const ing of ingredients) {
      const totalIngNeeded = ing.count * craftTimesNeeded
      resolve(ing.item, totalIngNeeded, depth + 1)
    }

    // Add this craft step (leaves-first order due to recursion)
    const needsTable = needsCraftingTable(recipe)
    steps.push({
      action: 'craft',
      item: normalized,
      count: craftTimesNeeded,
      ingredients,
      needsTable,
    })

    // Update simulated inventory to reflect production
    simInventory[normalized] = (simInventory[normalized] || 0) + (craftTimesNeeded * outputCount)

    return true
  }

  const normalizedTarget = normalizeItemName(targetItem)
  resolve(normalizedTarget, 1)

  return { steps, missing }
}
