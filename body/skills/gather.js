// gather.js — Collect N of a resource (find + navigate + dig loop)

import minecraftData from 'minecraft-data'
import { navigateToBlock } from '../navigate.js'
import { digBlock } from '../dig.js'
import { normalizeBlockName } from '../normalizer.js'
import { isInterrupted } from '../interrupt.js'
import { canHarvestWith } from '../tools.js'

const mcData = minecraftData('1.21.1')

/**
 * Collect `count` blocks of a named resource by finding nearest instances,
 * navigating to them, and digging until the target count is reached.
 *
 * Cooperative interrupt: checks bot.interrupt_code after every await.
 * Unreachable blocks are skipped to the next nearest candidate instead of failing.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string} blockName - raw block name (will be normalized via normalizeBlockName)
 * @param {number} [count=1] - number of blocks to successfully dig
 * @param {object} [options={}]
 * @param {number} [options.maxDistance=64] - search radius in blocks
 * @param {number} [options.navTimeout=30000] - per-navigation timeout in ms
 * @param {number} [options.maxCycles=Infinity] - max dig iterations before returning (stream-of-consciousness cap)
 * @returns {Promise<{success: boolean, collected: number, requested: number, blockName: string, reason?: string}>}
 */
export async function gather(bot, blockName, count = 1, options = {}) {
  const normalized = normalizeBlockName(blockName)

  // Validate block exists in registry before starting the loop
  const blockId = mcData.blocksByName[normalized]?.id
  if (blockId === undefined) {
    return { success: false, collected: 0, requested: count, blockName: normalized, reason: 'unknown_block' }
  }

  const maxDistance = options.maxDistance || 64
  const navTimeout = options.navTimeout || 30000
  const maxCycles = options.maxCycles || Infinity
  let collected = 0
  let cycles = 0

  while (collected < count && cycles < maxCycles) {
    // Check interrupt BEFORE doing any work in each iteration
    if (isInterrupted(bot)) break

    // Find up to 10 nearest candidates in one call — inner loop tries each
    const candidates = bot.findBlocks({ matching: blockId, maxDistance, count: 10 })

    if (candidates.length === 0) {
      // No more blocks of this type within range
      break
    }

    // Track whether any candidate in this batch succeeded — if not, outer loop breaks
    let gotOne = false

    for (let i = 0; i < candidates.length; i++) {
      if (isInterrupted(bot)) break

      const target = bot.blockAt(candidates[i])
      // Skip stale candidates — block may have been mined by another bot or
      // the world chunk hasn't loaded yet
      if (!target || target.name === 'air') continue

      // Equip best tool for this block type before navigating — silent catch
      // because failing to equip (no suitable tool) should not abort gather
      try {
        await bot.tool.equipForBlock(target, { requireHarvest: true })
      } catch (e) {
        // equipForBlock failed — try manual pickaxe equip as fallback
        const pickaxe = bot.inventory.items().find(i => i.name.includes('pickaxe'))
        if (pickaxe) {
          try { await bot.equip(pickaxe, 'hand') } catch {}
        }
      }

      // Verify held tool can harvest this block — skip candidate if not (unlike mine.js
      // which hard-stops, gather continues to next candidate since many gather targets
      // like wood/dirt have no tool restriction and can always be gathered bare-handed)
      const heldType = bot.heldItem ? bot.heldItem.type : null
      if (!canHarvestWith(target, heldType)) {
        console.log(`[gather] cannot harvest ${normalized} at tier — skipping block`)
        continue
      }

      if (isInterrupted(bot)) break

      // Navigate to block — unreachable blocks return success: false, skip to next
      const nav = await navigateToBlock(bot, target, navTimeout)

      if (isInterrupted(bot)) break

      if (!nav.success) {
        // Block unreachable — skip this candidate, don't fail the whole skill
        continue
      }

      // Re-fetch block after navigation — position may have changed or block gone
      const fresh = bot.blockAt(candidates[i])
      if (!fresh || fresh.name === 'air') continue

      const dig = await digBlock(bot, fresh)

      if (isInterrupted(bot)) break

      if (dig.success) {
        collected++
        cycles++
        console.log(`[gather] ${collected}/${count} ${normalized}`)
        gotOne = true
        // Break inner loop — go find the next nearest block fresh from findBlocks
        break
      }
    }

    // If inner loop exhausted all candidates without a successful dig, there are
    // no more reachable/diggable blocks in range — stop outer loop
    if (!gotOne) break
  }

  const success = collected >= count
  let reason
  if (!success) {
    if (collected === 0) {
      // Check if the issue was tool tier (all candidates were skipped due to canHarvestWith)
      const heldName = bot.heldItem?.name || 'bare hands'
      const needsPickaxe = normalized.includes('ore') || normalized === 'cobblestone' || normalized === 'stone'
      reason = needsPickaxe
        ? `no_harvestable_blocks — ${normalized} requires a pickaxe (you have ${heldName}). Craft a wooden_pickaxe first!`
        : 'no_harvestable_blocks'
    } else {
      reason = 'not_enough_found'
    }
  }
  return { success, collected, requested: count, blockName: normalized, reason }
}
