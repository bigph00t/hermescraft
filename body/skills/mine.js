// mine.js — Mine ore blocks with auto-best-tool selection

import minecraftData from 'minecraft-data'
import { navigateToBlock } from '../navigate.js'
import { digBlock } from '../dig.js'
import { normalizeBlockName } from '../normalizer.js'
import { isInterrupted } from '../interrupt.js'
import { canHarvestWith } from '../tools.js'

const mcData = minecraftData('1.21.1')

// ── Mine Skill ──

/**
 * Mine `count` ore blocks with automatic best-tool selection before each dig.
 *
 * Unlike gather, mine enforces a hard stop when no tool of sufficient tier is
 * available: wasting durability breaking iron_ore with a wooden pickaxe produces
 * no drop and is always wasteful.
 *
 * Cooperative interrupt: checks bot.interrupt_code after every await.
 * Unreachable blocks are skipped to the next nearest candidate.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string} oreName - raw ore block name (normalized via normalizeBlockName)
 * @param {number} [count=1] - number of ore blocks to mine
 * @param {object} [options={}]
 * @param {number} [options.maxDistance=64] - search radius in blocks
 * @param {number} [options.navTimeout=30000] - per-navigation timeout in ms
 * @returns {Promise<{success: boolean, mined: number, requested: number, oreName: string, reason?: string}>}
 */
export async function mine(bot, oreName, count = 1, options = {}) {
  const normalized = normalizeBlockName(oreName)

  // Validate ore block exists in registry
  const blockId = mcData.blocksByName[normalized]?.id
  if (blockId === undefined) {
    return { success: false, mined: 0, requested: count, oreName: normalized, reason: 'unknown_block' }
  }

  const maxDistance = options.maxDistance || 64
  const navTimeout = options.navTimeout || 30000
  let mined = 0

  while (mined < count) {
    // Check interrupt BEFORE doing any work
    if (isInterrupted(bot)) break

    const candidates = bot.findBlocks({ matching: blockId, maxDistance, count: 10 })

    if (candidates.length === 0) {
      // No more ore blocks in range
      break
    }

    let gotOne = false

    for (let i = 0; i < candidates.length; i++) {
      if (isInterrupted(bot)) break

      const target = bot.blockAt(candidates[i])
      if (!target || target.name === 'air') continue

      // Auto-select best tool that can actually harvest this ore tier
      // requireHarvest: true tells the plugin to prefer tools that meet the harvest requirement
      try { await bot.tool.equipForBlock(target, { requireHarvest: true }) } catch {}

      // Verify held tool can actually harvest this block tier.
      // For ores (iron, diamond, deepslate variants), this enforces the correct pickaxe tier.
      // Return early (hard stop) instead of continuing — mining ore with wrong tier produces
      // no drop and wastes the bot's time on every subsequent candidate as well.
      const heldType = bot.heldItem ? bot.heldItem.type : null
      const harvestable = canHarvestWith(target, heldType)
      if (!harvestable) {
        console.log(`[mine] cannot harvest ${normalized} with current tools`)
        return { success: false, mined, requested: count, oreName: normalized, reason: 'no_suitable_tool' }
      }

      if (isInterrupted(bot)) break

      // Navigate to the ore — unreachable candidates are skipped
      const nav = await navigateToBlock(bot, target, navTimeout)

      if (isInterrupted(bot)) break

      if (!nav.success) {
        continue
      }

      // Re-fetch after navigation — block may have been mined by someone else
      const fresh = bot.blockAt(candidates[i])
      if (!fresh || fresh.name === 'air') continue

      const dig = await digBlock(bot, fresh)

      if (isInterrupted(bot)) break

      if (dig.success) {
        mined++
        console.log(`[mine] ${mined}/${count} ${normalized}`)
        gotOne = true
        break
      }
    }

    // If inner loop exhausted all candidates without a successful mine, no more
    // reachable/diggable ore in range
    if (!gotOne) break
  }

  return { success: mined >= count, mined, requested: count, oreName: normalized }
}
