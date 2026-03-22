// gather.js — Collect N of a resource (find + navigate + dig loop)

import minecraftData from 'minecraft-data'
import { navigateToBlock } from '../navigate.js'
import { digBlock } from '../dig.js'
import { normalizeBlockName } from '../normalizer.js'
import { isInterrupted } from '../interrupt.js'

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
  let collected = 0

  while (collected < count) {
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
      try { await bot.tool.equipForBlock(target) } catch {}

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

  return { success: collected >= count, collected, requested: count, blockName: normalized }
}
