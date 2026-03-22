// look.js — Inspect chest contents or bot inventory and return a readable summary

import minecraftData from 'minecraft-data'
import { navigateToBlock } from '../navigate.js'
import { isInterrupted } from '../interrupt.js'

const mcData = minecraftData('1.21.1')

/**
 * Format an array of mineflayer Item objects into a human-readable summary string.
 * Groups by name and sums counts. Returns "empty" if no items.
 *
 * @param {Array} items - array of mineflayer Item objects
 * @returns {string}
 */
function formatItems(items) {
  if (!items || items.length === 0) return 'empty'
  const counts = {}
  for (const item of items) {
    if (!item) continue
    const name = item.name || `id:${item.type}`
    counts[name] = (counts[name] || 0) + item.count
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => `${name} x${count}`)
    .join(', ')
}

/**
 * Find the nearest chest, trapped_chest, or barrel within 32 blocks, navigate to it,
 * read its contents, and return a summary.
 *
 * Uses bot.openContainer() (mineflayer 4.x API) with a fallback to bot.openChest()
 * for older mineflayer versions.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {Promise<{success: boolean, items?: string, count?: number, reason?: string}>}
 */
export async function lookChest(bot) {
  // Find nearest chest/barrel within 32 blocks
  const containerIds = ['chest', 'trapped_chest', 'barrel']
    .map(name => mcData.blocksByName[name]?.id)
    .filter(id => id !== undefined)

  const chestBlock = bot.findBlock({
    matching: b => containerIds.includes(b.type),
    maxDistance: 32,
  })

  if (!chestBlock) {
    return { success: false, reason: 'no_chest_nearby' }
  }

  // Navigate to the chest
  const nav = await navigateToBlock(bot, chestBlock)
  if (!nav.success) {
    return { success: false, reason: nav.reason || 'nav_failed' }
  }

  if (isInterrupted(bot)) {
    return { success: false, reason: 'interrupted' }
  }

  // Open the container — mineflayer 4.x uses openContainer(), older versions used openChest()
  let chest
  try {
    if (typeof bot.openContainer === 'function') {
      chest = await bot.openContainer(chestBlock)
    } else {
      chest = await bot.openChest(chestBlock)
    }
  } catch (err) {
    return { success: false, reason: err.message || 'open_failed' }
  }

  try {
    // containerItems() returns only the chest's own slots (not bot's inventory side).
    // Fall back to items() for older window implementations.
    const items = typeof chest.containerItems === 'function'
      ? chest.containerItems()
      : chest.items()

    const summary = formatItems(items)
    const count = items ? items.reduce((sum, i) => sum + (i ? i.count : 0), 0) : 0
    console.log(`[look] chest at ${chestBlock.position}: ${summary}`)
    return { success: true, items: summary, count }
  } finally {
    chest.close()
  }
}

/**
 * Read the bot's own inventory and return a formatted summary.
 * No navigation needed — always instant.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {{ success: boolean, items: string, count: number }}
 */
export function lookInventory(bot) {
  const items = bot.inventory.items()
  const summary = formatItems(items)
  const count = items.length
  console.log(`[look] inventory: ${summary}`)
  return { success: true, items: summary, count }
}
