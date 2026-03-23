// knowledge.js — Minecraft knowledge corpus builder for RAG retrieval

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import minecraftData from 'minecraft-data'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mcData = minecraftData('1.21.1')

let KNOWLEDGE_DIR = ''
let chunks = []

// ── Init ──

export function initKnowledge(config) {
  KNOWLEDGE_DIR = join(__dirname, '..', 'knowledge')
  // config accepted for future use (e.g. dataDir, agentName)
}

// ── Load ──

export function loadKnowledge() {
  chunks = [
    ...buildRecipeChunks(),
    // ...buildFactChunks(),      — Plan 03
    // ...buildStrategyChunks(),   — Plan 03
    // ...buildCommandChunks(),    — Plan 03
  ]
  return chunks
}

export function getAllChunks() {
  return chunks
}

// ── Recipe Chain Generator ──

// Hardcoded smelting table — minecraft-data has NO furnace recipe data
// Keyed by PRODUCT, value is the input (what you smelt to get the key)
const SMELT_FROM = {
  iron_ingot: 'raw_iron',
  gold_ingot: 'raw_gold',
  copper_ingot: 'raw_copper',
  glass: 'sand',
  stone: 'cobblestone',
  smooth_stone: 'stone',
  brick: 'clay_ball',
  terracotta: 'clay',
  charcoal: 'oak_log',
  nether_brick: 'netherrack',
  netherite_scrap: 'ancient_debris',
  cooked_beef: 'raw_beef',
  cooked_porkchop: 'raw_porkchop',
  cooked_chicken: 'raw_chicken',
  cooked_mutton: 'raw_mutton',
  cooked_rabbit: 'raw_rabbit',
  cooked_cod: 'raw_cod',
  cooked_salmon: 'raw_salmon',
  baked_potato: 'potato',
  dried_kelp: 'kelp',
}

// flattenRecipe — extract unique ingredient item IDs from a recipe object.
// Handles both shaped (inShape) and shapeless (ingredients) recipe formats.
function flattenRecipe(recipe) {
  const ids = []
  if (recipe.inShape) {
    for (const row of recipe.inShape) {
      for (const id of row) {
        if (id !== null && id !== undefined) ids.push(id)
      }
    }
  } else if (recipe.ingredients) {
    for (const id of recipe.ingredients) {
      if (id !== null && id !== undefined) ids.push(id)
    }
  }
  // Return unique IDs only
  return [...new Set(ids)]
}

// resolveIngredients — recursive DFS to resolve an item to its raw material chain.
// visited: Set of item names already being resolved in the current branch (cycle guard).
// Uses a COPY of visited for each branch so siblings don't block each other.
function resolveIngredients(itemId, visited) {
  const item = mcData.items[itemId]
  if (!item) return null

  const name = item.name

  // Cycle guard — prevents infinite recursion on circular recipes (iron_ingot <-> iron_nugget)
  if (visited.has(name)) return `${name} (cycle)`
  visited = new Set(visited)
  visited.add(name)

  // Smelting shortcut — show the smelting path instead of the nugget-craft path
  // This is the primary fix for iron_ingot: "smelt raw_iron" instead of "craft from iron_nuggets"
  if (SMELT_FROM[name]) {
    const input = SMELT_FROM[name]
    return `${name} (smelt ${input})`
  }

  const recipes = mcData.recipes[itemId]
  if (!recipes || recipes.length === 0) {
    return `${name} (gather/mine)`
  }

  // Pick simplest recipe: fewest unique ingredient types
  // Tiebreak priority: (1) prefer oak_* for wood items, (2) prefer cobblestone over deepslate/blackstone variants
  const PREFERRED_INGREDIENTS = ['oak_planks', 'oak_log', 'cobblestone']

  const recipe = recipes.reduce((best, candidate) => {
    const bestIds = flattenRecipe(best)
    const candIds = flattenRecipe(candidate)
    const bestNames = [...new Set(bestIds.map(id => mcData.items[id]?.name).filter(Boolean))]
    const candNames = [...new Set(candIds.map(id => mcData.items[id]?.name).filter(Boolean))]
    if (candNames.length < bestNames.length) return candidate
    if (candNames.length === bestNames.length) {
      // Tiebreak: prefer recipes that use a "preferred" base material
      const candScore = PREFERRED_INGREDIENTS.filter(p => candNames.some(n => n && n.includes(p))).length
      const bestScore = PREFERRED_INGREDIENTS.filter(p => bestNames.some(n => n && n.includes(p))).length
      if (candScore > bestScore) return candidate
    }
    return best
  })

  const ingIds = flattenRecipe(recipe)
  const ingNames = [...new Set(ingIds.map(id => mcData.items[id]?.name).filter(Boolean))]

  // Recursively resolve each ingredient with an independent copy of visited
  const subChains = ingNames.map(ingName => {
    const ingItem = mcData.itemsByName[ingName]
    if (!ingItem) return `${ingName} (unknown)`
    return resolveIngredients(ingItem.id, new Set(visited))
  }).filter(Boolean)

  return `${name} (craft from: ${ingNames.join(', ')}) -- ${subChains.join('; ')}`
}

export function buildRecipeChunks() {
  const result = []

  for (const itemIdStr of Object.keys(mcData.recipes)) {
    const itemId = parseInt(itemIdStr, 10)
    const item = mcData.items[itemId]
    if (!item) continue

    const chainText = resolveIngredients(itemId, new Set())
    if (!chainText) continue

    // Cap chain text to ~600 chars (~150 tokens) to fit embedding model window
    const text = `Recipe: ${item.displayName}\n${chainText.length > 600 ? chainText.substring(0, 600) + '...' : chainText}`

    result.push({
      id: `recipe_${item.name}`,
      text,
      type: 'recipe',
      tags: ['recipe', item.name],
      source: 'minecraft-data',
    })
  }

  return result
}
