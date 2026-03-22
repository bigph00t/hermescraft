// normalizer.js — Canonicalize LLM item/block names to MC 1.21.1 registry IDs

import minecraftData from 'minecraft-data'

const mcData = minecraftData('1.21.1')

// Known LLM hallucination corrections — common wrong names the model generates
const ALIASES = {
  'sticks': 'stick',
  'oak_planks_4': 'oak_planks',
  'wooden_planks': 'oak_planks',
  'planks': 'oak_planks',
  'log': 'oak_log',
  'logs': 'oak_log',
  'wood': 'oak_log',
  'oak_log_1': 'oak_log',
  'wood_pickaxe': 'wooden_pickaxe',
  'wood_axe': 'wooden_axe',
  'wood_sword': 'wooden_sword',
  'wood_shovel': 'wooden_shovel',
  'wood_hoe': 'wooden_hoe',
  'wooden_door': 'oak_door',
  'oak_door_3': 'oak_door',
  'cobble': 'cobblestone',
  'iron_ore': 'raw_iron',
  'gold_ore': 'raw_gold',
}

/**
 * Shared normalization pipeline — used by both normalizeItemName and normalizeBlockName.
 * Steps:
 *   1. Falsy → return empty string
 *   2. Lowercase + trim
 *   3. Strip minecraft: prefix
 *   4. Strip trailing _N numeric suffix (only if base without suffix is valid in registry)
 *   5. Check ALIASES map
 *   6. Try plural stripping (trailing 's')
 *   7. Validate against registry — if valid, return
 *   8. Try prefix search in registry
 *   9. Return input unchanged (let downstream fail with a clear error)
 *
 * @param {string} name
 * @param {object} registry - mcData.itemsByName or mcData.blocksByName
 * @returns {string}
 */
function _normalize(name, registry) {
  if (!name) return ''

  // Step 2: lowercase + trim
  let result = name.toLowerCase().trim()

  // Step 3: strip minecraft: prefix
  if (result.startsWith('minecraft:')) {
    result = result.slice('minecraft:'.length)
  }

  // Step 4: strip trailing _N numeric suffix — only if base is valid in registry
  const suffixMatch = result.match(/^(.+?)_(\d+)$/)
  if (suffixMatch) {
    const base = suffixMatch[1]
    if (registry[base]) {
      result = base
    }
  }

  // Step 5: check ALIASES map
  if (ALIASES[result]) {
    return ALIASES[result]
  }

  // Step 6: try plural stripping
  if (result.endsWith('s') && result.length > 2) {
    const singular = result.slice(0, -1)
    if (registry[singular]) {
      return singular
    }
  }

  // Step 7: validate against registry — exact match
  if (registry[result]) {
    return result
  }

  // Step 8: prefix search — find first entry whose key starts with result
  const prefix = result
  const match = Object.keys(registry).find(k => k.startsWith(prefix))
  if (match) {
    return match
  }

  // Step 9: return unchanged — let it fail downstream with a clear error
  return name
}

/**
 * Normalize an LLM-generated item name to a valid MC 1.21.1 registry ID.
 * Validates against mcData.itemsByName.
 *
 * @param {string} name
 * @returns {string}
 */
export function normalizeItemName(name) {
  return _normalize(name, mcData.itemsByName)
}

/**
 * Normalize an LLM-generated block name to a valid MC 1.21.1 registry ID.
 * Validates against mcData.blocksByName — needed for gather, mine, and place skills
 * that operate on block names rather than item names.
 *
 * @param {string} name
 * @returns {string}
 */
export function normalizeBlockName(name) {
  return _normalize(name, mcData.blocksByName)
}
