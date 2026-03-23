// hunt.js — Seek hostile mobs within expanded radius and engage in combat

import { HOSTILE_MOBS, combatLoop } from './combat.js'
import { navigateTo } from '../navigate.js'
import { isInterrupted } from '../interrupt.js'

// HUNT_RADIUS is wider than the reactive 16b combat radius — proactive mob seeking
const HUNT_RADIUS = 48

/**
 * Find a hostile mob within HUNT_RADIUS blocks, navigate toward it, and engage in combat.
 *
 * Cooperative interrupt: checks bot.interrupt_code after navigation.
 * If the target despawns during navigation, returns cleanly without error.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string|null} [targetType=null] - specific mob name to hunt, or null for any hostile
 * @returns {Promise<{success: boolean, reason?: string, target?: string, searched?: number}>}
 */
export async function hunt(bot, targetType = null) {
  try {
    const botPos = bot.entity.position

    // Collect all hostile mobs within HUNT_RADIUS, optionally filtered by type
    const candidates = Object.values(bot.entities).filter(e => {
      if (e.type !== 'mob') return false
      if (!HOSTILE_MOBS.has(e.name)) return false
      const dist = e.position.distanceTo(botPos)
      if (dist >= HUNT_RADIUS) return false
      if (targetType && e.name !== targetType) return false
      return true
    })

    if (candidates.length === 0) {
      return { success: false, reason: 'no_hostile_nearby', searched: HUNT_RADIUS }
    }

    // Sort by distance — engage the closest first
    candidates.sort((a, b) =>
      a.position.distanceTo(botPos) - b.position.distanceTo(botPos)
    )

    const target = candidates[0]
    const dist = target.position.distanceTo(botPos)
    console.log(`[hunt] seeking ${target.name} at distance ${dist.toFixed(1)}`)

    // Navigate toward target — range=4 puts bot in melee range
    await navigateTo(bot, target.position.x, target.position.y, target.position.z, 4, 20000)

    if (isInterrupted(bot)) {
      return { success: false, reason: 'interrupted', target: target.name }
    }

    // Verify target is still valid — it may have despawned or died during navigation
    if (!target.isValid || target.health <= 0) {
      return { success: false, reason: 'target_despawned', target: target.name }
    }

    const combatResult = await combatLoop(bot, target)
    return { ...combatResult, target: target.name }
  } catch (err) {
    return { success: false, reason: err.message }
  }
}
