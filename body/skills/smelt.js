// smelt.js — Smelt items in a furnace with event-driven completion wait

import minecraftData from 'minecraft-data'
import { normalizeItemName } from '../normalizer.js'
import { navigateToBlock } from '../navigate.js'
import { isInterrupted } from '../interrupt.js'

const mcData = minecraftData('1.21.1')

// All furnace-like block types that bot.openFurnace() accepts
const FURNACE_BLOCKS = new Set(['furnace', 'blast_furnace', 'smoker'])

/**
 * Smelt `count` units of `inputName` using `fuelName` as fuel.
 * Finds the nearest furnace-like block, navigates to it, loads fuel then input,
 * waits for output via event-driven polling, collects the output, and closes cleanly.
 *
 * Cooperative interrupt: checks bot.interrupt_code after navigation and after each
 * furnace operation. Finally block always closes the furnace.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string} inputName - raw item name (will be normalized)
 * @param {string} fuelName - raw fuel item name (will be normalized)
 * @param {number} [count=1] - number of items to smelt
 * @param {object} [options={}]
 * @param {number} [options.timeoutMs] - override smelt timeout (default: count*12000+5000)
 * @returns {Promise<{success: boolean, item?: string, count?: number, reason?: string}>}
 */
export async function smelt(bot, inputName, fuelName, count = 1, options = {}) {
  const normalizedInput = normalizeItemName(inputName)
  const normalizedFuel = normalizeItemName(fuelName)

  const inputId = mcData.itemsByName[normalizedInput]?.id
  if (inputId === undefined) {
    return { success: false, reason: 'unknown_item', item: normalizedInput }
  }

  const fuelId = mcData.itemsByName[normalizedFuel]?.id
  if (fuelId === undefined) {
    return { success: false, reason: 'unknown_item', item: normalizedFuel }
  }

  // 12s per item (10s smelt + 2s buffer) + 5s global buffer
  const timeoutMs = options.timeoutMs ?? (count * 12_000 + 5_000)

  // Find nearest furnace-like block (furnace, blast_furnace, or smoker)
  let furnaceBlock = null
  for (const name of FURNACE_BLOCKS) {
    const blockDef = mcData.blocksByName[name]
    if (!blockDef) continue
    const found = bot.findBlock({ matching: blockDef.id, maxDistance: 32 })
    if (found) {
      furnaceBlock = found
      break
    }
  }

  if (!furnaceBlock) {
    return { success: false, reason: 'no_furnace_nearby', item: normalizedInput }
  }

  // Navigate to furnace before opening it
  const nav = await navigateToBlock(bot, furnaceBlock)
  if (!nav.success) {
    return { success: false, reason: nav.reason || 'nav_failed', item: normalizedInput }
  }

  if (isInterrupted(bot)) {
    return { success: false, reason: 'interrupted', item: normalizedInput }
  }

  // Coal/charcoal smelts 8 items; add +1 for partial fuel safety
  const fuelCount = Math.ceil(count / 8) + 1

  const furnace = await bot.openFurnace(furnaceBlock)
  try {
    // Put fuel BEFORE input — no fuel means nothing smelts (Pitfall 6)
    await furnace.putFuel(fuelId, null, fuelCount)

    if (isInterrupted(bot)) {
      return { success: false, reason: 'interrupted', item: normalizedInput }
    }

    await furnace.putInput(inputId, null, count)

    if (isInterrupted(bot)) {
      return { success: false, reason: 'interrupted', item: normalizedInput }
    }

    // Event-driven wait — poll furnace.outputItem() on every 'update' packet
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('smelt_timeout')), timeoutMs)
      const check = () => {
        if (furnace.outputItem()) {
          clearTimeout(timer)
          furnace.removeListener('update', check)
          resolve()
        }
      }
      furnace.on('update', check)
      check() // immediate check in case output is already present
    })

    await furnace.takeOutput()
    console.log(`[smelt] smelted ${count}x ${normalizedInput}`)
    return { success: true, item: normalizedInput, count }
  } catch (err) {
    if (err.message === 'smelt_timeout') {
      return { success: false, reason: 'smelt_timeout', item: normalizedInput }
    }
    return { success: false, reason: err.message, item: normalizedInput }
  } finally {
    furnace.close()
  }
}
