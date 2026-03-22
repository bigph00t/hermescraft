// chest.js — Deposit/withdraw items from chests, remember chest locations

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import minecraftData from 'minecraft-data'
import { normalizeItemName } from '../normalizer.js'
import { navigateToBlock } from '../navigate.js'
import { isInterrupted } from '../interrupt.js'

const mcData = minecraftData('1.21.1')

// Module-level chest memory — loaded on initChestMemory(), persisted on every write
let _chestMemory = []
let _chestMemoryPath = null

/**
 * Compute the path to the agent's chest memory JSON file.
 *
 * @param {string} agentName
 * @returns {string}
 */
function getChestMemoryPath(agentName) {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  return join(__dirname, '..', '..', 'data', agentName, 'chests.json')
}

/**
 * Initialize chest memory for the given agent.
 * Loads existing chest locations from disk if available.
 * Must be called once on agent start before using deposit/withdraw.
 *
 * @param {string} agentName
 */
export function initChestMemory(agentName) {
  _chestMemoryPath = getChestMemoryPath(agentName)
  mkdirSync(dirname(_chestMemoryPath), { recursive: true })
  try {
    _chestMemory = JSON.parse(readFileSync(_chestMemoryPath, 'utf8'))
  } catch {
    _chestMemory = []
  }
  console.log(`[chest] loaded ${_chestMemory.length} remembered chests`)
}

/**
 * Return a shallow copy of all remembered chest locations.
 *
 * @returns {Array<{x: number, y: number, z: number, label: string, remembered_at: number}>}
 */
export function getChestMemory() {
  return [..._chestMemory]
}

/**
 * Remember a chest at the given world coordinates.
 * Deduplicates by position — updates label if already known.
 * Persists to disk immediately.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {string} [label='']
 */
export function rememberChest(x, y, z, label = '') {
  const existing = _chestMemory.find(c => c.x === x && c.y === y && c.z === z)
  if (existing) {
    if (label) existing.label = label
  } else {
    _chestMemory.push({ x, y, z, label, remembered_at: Date.now() })
  }
  if (_chestMemoryPath) {
    writeFileSync(_chestMemoryPath, JSON.stringify(_chestMemory, null, 2))
  }
}

/**
 * Find the nearest chest, trapped_chest, or barrel within maxDistance blocks.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {object} [options={}]
 * @param {number} [options.maxDistance=32]
 * @returns {import('mineflayer').Block | null}
 */
export function findChest(bot, options = {}) {
  const maxDistance = options.maxDistance || 32
  const containerTypes = ['chest', 'trapped_chest', 'barrel']
  for (const name of containerTypes) {
    const blockDef = mcData.blocksByName[name]
    if (!blockDef) continue
    const found = bot.findBlock({ matching: blockDef.id, maxDistance })
    if (found) return found
  }
  return null
}

/**
 * Deposit `count` of `itemName` from bot inventory into a chest.
 * Navigates to the chest, opens it, deposits, closes it, and remembers location.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {import('mineflayer').Block} chestBlock
 * @param {string} itemName - raw item name (will be normalized)
 * @param {number} count
 * @returns {Promise<{success: boolean, item?: string, deposited?: number, reason?: string}>}
 */
export async function depositToChest(bot, chestBlock, itemName, count) {
  const normalized = normalizeItemName(itemName)
  const itemId = mcData.itemsByName[normalized]?.id
  if (itemId === undefined) {
    return { success: false, reason: 'unknown_item', item: normalized }
  }

  const nav = await navigateToBlock(bot, chestBlock)
  if (!nav.success) {
    return { success: false, reason: nav.reason || 'nav_failed', item: normalized }
  }

  if (isInterrupted(bot)) {
    return { success: false, reason: 'interrupted', item: normalized }
  }

  // Check inventory has the item before opening chest
  const available = bot.inventory.count(itemId, null)
  const toDeposit = Math.min(count, available)
  if (toDeposit === 0) {
    return { success: false, reason: 'no_items_to_deposit', item: normalized }
  }

  // Use openContainer (mineflayer 4.x) with fallback to deprecated openChest
  const chest = typeof bot.openContainer === 'function'
    ? await bot.openContainer(chestBlock)
    : await bot.openChest(chestBlock)
  try {
    await chest.deposit(itemId, null, toDeposit)

    if (isInterrupted(bot)) {
      return { success: false, reason: 'interrupted', item: normalized }
    }

    const pos = chestBlock.position
    rememberChest(pos.x, pos.y, pos.z, 'deposit')
    console.log(`[chest] deposited ${toDeposit}x ${normalized}`)
    return { success: true, item: normalized, deposited: toDeposit }
  } catch (err) {
    return { success: false, reason: err.message, item: normalized }
  } finally {
    chest.close()
  }
}

/**
 * Withdraw `count` of `itemName` from a chest into bot inventory.
 * Checks bot inventory is not full before attempting (Pitfall 4).
 * Navigates to the chest, opens it, withdraws, closes it, and remembers location.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {import('mineflayer').Block} chestBlock
 * @param {string} itemName - raw item name (will be normalized)
 * @param {number} count
 * @returns {Promise<{success: boolean, item?: string, withdrawn?: number, reason?: string}>}
 */
export async function withdrawFromChest(bot, chestBlock, itemName, count) {
  const normalized = normalizeItemName(itemName)
  const itemId = mcData.itemsByName[normalized]?.id
  if (itemId === undefined) {
    return { success: false, reason: 'unknown_item', item: normalized }
  }

  const nav = await navigateToBlock(bot, chestBlock)
  if (!nav.success) {
    return { success: false, reason: nav.reason || 'nav_failed', item: normalized }
  }

  if (isInterrupted(bot)) {
    return { success: false, reason: 'interrupted', item: normalized }
  }

  // Guard: bot inventory must have room (Pitfall 4 — chest.withdraw throws if full)
  if (bot.inventory.emptySlotCount() === 0) {
    return { success: false, reason: 'inventory_full', item: normalized }
  }

  // Use openContainer (mineflayer 4.x) with fallback to deprecated openChest
  const chest = typeof bot.openContainer === 'function'
    ? await bot.openContainer(chestBlock)
    : await bot.openChest(chestBlock)
  try {
    // Check chest actually has the item before attempting withdraw
    const available = chest.count(itemId, null)
    const toWithdraw = Math.min(count, available)
    if (toWithdraw === 0) {
      return { success: false, reason: 'item_not_in_chest', item: normalized }
    }

    await chest.withdraw(itemId, null, toWithdraw)

    if (isInterrupted(bot)) {
      return { success: false, reason: 'interrupted', item: normalized }
    }

    const pos = chestBlock.position
    rememberChest(pos.x, pos.y, pos.z, 'withdraw')
    console.log(`[chest] withdrew ${toWithdraw}x ${normalized}`)
    return { success: true, item: normalized, withdrawn: toWithdraw }
  } catch (err) {
    return { success: false, reason: err.message, item: normalized }
  } finally {
    chest.close()
  }
}
