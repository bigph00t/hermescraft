// tools.js — Shared tool utility functions for body/ skills

/**
 * Check whether the currently held item can harvest a block at full-drop tier.
 * Uses block.harvestTools from minecraft-data.
 * If block.harvestTools is undefined, any tool works (wood, dirt, sand, etc.)
 * If block.harvestTools exists but heldItemType is null, bare hands can't harvest it.
 *
 * @param {import('mineflayer').Block} block
 * @param {number|null} heldItemType - bot.heldItem.type, or null if empty hand
 * @returns {boolean}
 */
export function canHarvestWith(block, heldItemType) {
  if (!block.harvestTools) return true       // no restriction
  if (heldItemType === null) return false    // block requires tool, hands = fail
  return !!block.harvestTools[heldItemType]
}
