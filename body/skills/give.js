// give.js — Toss items from bot inventory to a nearby player

import { Vec3 } from 'vec3'
import minecraftData from 'minecraft-data'
import { normalizeItemName } from '../normalizer.js'
import { navigateTo } from '../navigate.js'
import { isInterrupted } from '../interrupt.js'

const mcData = minecraftData('1.21.1')

/**
 * Give `count` of `itemName` to a nearby player by tossing the items toward them.
 *
 * Steps:
 *   1. Locate the player entity in bot.players
 *   2. Verify they are within 6 blocks (or navigate if close enough to try)
 *   3. Navigate to within 3 blocks of the player
 *   4. Find the item in bot inventory
 *   5. Toss toward the player with bot.toss()
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string} playerName - exact Minecraft username
 * @param {string} itemName - raw item name (will be normalized)
 * @param {number} [count=1] - number of items to give
 * @returns {Promise<{success: boolean, reason: string}>}
 */
export async function give(bot, playerName, itemName, count = 1) {
  if (isInterrupted(bot)) {
    return { success: false, reason: 'interrupted' }
  }

  // Locate the player entity
  const playerEntry = bot.players[playerName]
  const playerEntity = playerEntry?.entity

  if (!playerEntity) {
    return { success: false, reason: `${playerName} not nearby` }
  }

  // Check distance — only approach if within reasonable range to avoid wandering forever
  const dist = bot.entity.position.distanceTo(playerEntity.position)
  if (dist > 32) {
    return { success: false, reason: `${playerName} not nearby` }
  }

  // Navigate within 3 blocks of the player
  const pos = playerEntity.position
  const nav = await navigateTo(bot, pos.x, pos.y, pos.z, 3, 15000)
  if (!nav.success) {
    return { success: false, reason: `could not reach ${playerName}: ${nav.reason}` }
  }

  if (isInterrupted(bot)) {
    return { success: false, reason: 'interrupted' }
  }

  // Normalize item name and look it up in the registry
  const normalized = normalizeItemName(itemName)
  const itemEntry = mcData.itemsByName[normalized]
  if (!itemEntry) {
    return { success: false, reason: `unknown item: ${itemName}` }
  }

  // Find the item in bot inventory
  const invItem = bot.inventory.findInventoryItem(itemEntry.id, null)
  if (!invItem) {
    return { success: false, reason: `no ${normalized} in inventory` }
  }

  const toGive = Math.min(count, invItem.count)

  try {
    await bot.toss(itemEntry.id, null, toGive)
  } catch (err) {
    return { success: false, reason: err.message || 'toss_failed' }
  }

  console.log(`[give] tossed ${toGive}x ${normalized} toward ${playerName}`)
  return { success: true, reason: `gave ${toGive} ${normalized} to ${playerName}` }
}
