// boat.js — Mount and dismount the nearest boat entity

import { navigateTo } from '../navigate.js'
import { isInterrupted } from '../interrupt.js'

/**
 * Find the nearest boat and mount it.
 *
 * Navigates to within 2 blocks of the boat before mounting.
 * Cooperative interrupt: checks bot.interrupt_code after every await.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {Promise<{success: boolean, reason: string}>}
 */
export async function mountBoat(bot) {
  // Find nearest boat — entity name varies by wood type (oak_boat, spruce_boat, etc.)
  const entity = bot.nearestEntity(e => e.name === 'boat' || e.name?.includes('boat'))
  if (!entity) {
    return { success: false, reason: 'no_boat_nearby' }
  }

  const nav = await navigateTo(
    bot,
    Math.round(entity.position.x),
    Math.round(entity.position.y),
    Math.round(entity.position.z),
    2,
    10000
  )
  if (isInterrupted(bot)) {
    return { success: false, reason: 'interrupted' }
  }
  if (!nav.success) {
    return { success: false, reason: `could not reach boat: ${nav.reason}` }
  }

  try {
    await bot.mount(entity)
  } catch (err) {
    return { success: false, reason: `mount failed: ${err.message}` }
  }

  return { success: true, reason: 'mounted boat' }
}

/**
 * Dismount from the current vehicle (boat or otherwise).
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {Promise<{success: boolean, reason: string}>}
 */
export async function dismountBoat(bot) {
  if (!bot.vehicle) {
    return { success: false, reason: 'not_in_vehicle' }
  }

  try {
    await bot.dismount()
  } catch (err) {
    return { success: false, reason: `dismount failed: ${err.message}` }
  }

  return { success: true, reason: 'dismounted' }
}
