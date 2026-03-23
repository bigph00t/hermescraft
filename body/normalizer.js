// normalizer.js — Canonicalize LLM item/block names to MC 1.21.1 registry IDs

import minecraftData from 'minecraft-data'

const mcData = minecraftData('1.21.1')

// Shorthand references for registry identity comparison in _normalize
const BLOCK_REGISTRY = mcData.blocksByName
const ITEM_REGISTRY = mcData.itemsByName

// Known LLM hallucination corrections — common wrong names the model generates.
// These aliases apply to BOTH item and block normalization.
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
  // NOTE: iron_ore/gold_ore are item-only aliases — see ITEM_ONLY_ALIASES below
}

// Aliases that only apply when normalizing item names (crafting, smelting, inventory).
// iron_ore and gold_ore ARE valid block names in MC 1.21.1 (blocksByName has them).
// raw_iron and raw_gold are NOT valid block names — only in itemsByName.
// Applying these aliases during block normalization would break !mine and !gather.
const ITEM_ONLY_ALIASES = {
  'iron_ore': 'raw_iron',
  'gold_ore': 'raw_gold',
}

// Block-only aliases: map drop names to the mineable block name.
// LLMs say "mine cobblestone" but the actual block is "stone" (which drops cobblestone).
const BLOCK_ONLY_ALIASES = {
  'cobblestone': 'stone',
  'raw_iron': 'iron_ore',
  'raw_gold': 'gold_ore',
  'raw_copper': 'copper_ore',
  'charcoal': 'oak_log',
  'flint': 'gravel',
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
  // COMMON_ALIASES apply to both items and blocks
  if (ALIASES[result]) {
    return ALIASES[result]
  }
  // ITEM_ONLY_ALIASES apply only when normalizing items (iron_ore → raw_iron, etc.)
  // When normalizing block names, iron_ore IS a valid block — do not remap it
  if (registry === ITEM_REGISTRY && ITEM_ONLY_ALIASES[result]) {
    return ITEM_ONLY_ALIASES[result]
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
  // Apply block-only aliases first (cobblestone → stone, raw_iron → iron_ore)
  const lower = (name || '').toLowerCase().trim()
  if (BLOCK_ONLY_ALIASES[lower]) {
    return _normalize(BLOCK_ONLY_ALIASES[lower], mcData.blocksByName)
  }
  return _normalize(name, mcData.blocksByName)
}
