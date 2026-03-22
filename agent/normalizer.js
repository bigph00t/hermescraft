// normalizer.js — Canonicalize LLM item names to MC 1.21.1 registry IDs

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
 * Normalize an LLM-generated item name to a valid MC 1.21.1 registry ID.
 * Pipeline:
 *   1. Falsy → return empty string
 *   2. Lowercase + trim
 *   3. Strip minecraft: prefix
 *   4. Strip trailing _N numeric suffix (only if base without suffix is a valid item)
 *   5. Check ALIASES map
 *   6. Try plural stripping (trailing 's')
 *   7. Validate against mcData.itemsByName — if valid, return
 *   8. Try prefix search in itemsByName
 *   9. Return input unchanged (let downstream fail with a clear error)
 */
export function normalizeItemName(name) {
  if (!name) return ''

  // Step 2: lowercase + trim
  let result = name.toLowerCase().trim()

  // Step 3: strip minecraft: prefix
  if (result.startsWith('minecraft:')) {
    result = result.slice('minecraft:'.length)
  }

  // Step 4: strip trailing _N numeric suffix — only if base is a valid item
  const suffixMatch = result.match(/^(.+?)_(\d+)$/)
  if (suffixMatch) {
    const base = suffixMatch[1]
    if (mcData.itemsByName[base]) {
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
    if (mcData.itemsByName[singular]) {
      return singular
    }
  }

  // Step 7: validate against registry — exact match
  if (mcData.itemsByName[result]) {
    return result
  }

  // Step 8: prefix search — find first item whose key starts with result
  const prefix = result
  const match = Object.keys(mcData.itemsByName).find(k => k.startsWith(prefix))
  if (match) {
    return match
  }

  // Step 9: return unchanged — let it fail downstream with a clear error
  return name
}
