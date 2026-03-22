// combat.js -- Attack hostile mobs with health-gated retreat

import minecraftData from 'minecraft-data'
import { isInterrupted } from '../interrupt.js'
import { navigateTo } from '../navigate.js'
import mpf from 'mineflayer-pathfinder'
const { goals } = mpf

// Build hostile mob Set once at module load — O(1) lookups, 42 entries for MC 1.21.1
const mcData = minecraftData('1.21.1')
export const HOSTILE_MOBS = new Set(
  Object.values(mcData.entities)
    .filter(e => e.category === 'Hostile mobs')
    .map(e => e.name)
)

const COMBAT_RETREAT_HEALTH = 6   // flee at 3 hearts (6 HP)
const COMBAT_ATTACK_RANGE = 4     // blocks within which bot can melee attack
const ATTACK_COOLDOWN_MS = 600    // 600ms between attacks (~1.6 attacks/sec, safe for unarmed)

/**
 * One attack action — called by the body tick (one hit per tick cycle).
 * Non-blocking: closes distance with GoalFollow, or attacks if in range.
 * Returns immediately in all cases so the body tick is never blocked.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {import('prismarine-entity').Entity} target
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export async function attackTarget(bot, target) {
  try {
    // Validate target — may have despawned (Pitfall 4)
    if (!target.isValid || target.health <= 0) {
      return { success: false, reason: 'target_gone' }
    }

    // Health retreat check — flee before attacking
    if (bot.health <= COMBAT_RETREAT_HEALTH) {
      const away = bot.entity.position
        .minus(target.position)
        .normalize()
        .scaled(12)
        .plus(bot.entity.position)
      await navigateTo(bot, Math.floor(away.x), Math.floor(away.y), Math.floor(away.z), 1, 5000)
      return { success: false, reason: 'retreated_low_health' }
    }

    const dist = target.position.distanceTo(bot.entity.position)

    if (dist > COMBAT_ATTACK_RANGE) {
      // Close distance using GoalFollow — dynamic=true re-evaluates as mob moves
      bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true)
      return { success: true, reason: 'closing_distance' }
    }

    // In range — stop movement, look at target, attack
    bot.pathfinder.setGoal(null)
    await bot.lookAt(target.position.offset(0, target.height / 2, 0))
    bot.attack(target)
    return { success: true }
  } catch (err) {
    return { success: false, reason: err.message }
  }
}

/**
 * Sustained attack loop until target is dead, bot retreats, or interrupt.
 * Used by LLM dispatch via !combat. Blocks until combat concludes.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {import('prismarine-entity').Entity} target
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export async function combatLoop(bot, target) {
  try {
    while (target.isValid && target.health > 0) {
      // Cooperative interrupt check — LLM can cancel with !<other_command>
      if (isInterrupted(bot)) {
        return { success: false, reason: 'interrupted' }
      }

      // Health retreat check — survival overrides combat
      if (bot.health <= COMBAT_RETREAT_HEALTH) {
        const away = bot.entity.position
          .minus(target.position)
          .normalize()
          .scaled(12)
          .plus(bot.entity.position)
        await navigateTo(bot, Math.floor(away.x), Math.floor(away.y), Math.floor(away.z), 1, 5000)
        return { success: false, reason: 'retreated_low_health' }
      }

      const dist = target.position.distanceTo(bot.entity.position)

      if (dist > COMBAT_ATTACK_RANGE) {
        // Chase the mob — GoalFollow with dynamic=true tracks moving target
        bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true)
        await new Promise(r => setTimeout(r, 200))
        continue
      }

      // In melee range — stop movement, look, attack, wait cooldown
      bot.pathfinder.setGoal(null)
      await bot.lookAt(target.position.offset(0, target.height / 2, 0))
      bot.attack(target)
      await new Promise(r => setTimeout(r, ATTACK_COOLDOWN_MS))
    }

    return { success: true }
  } catch (err) {
    return { success: false, reason: err.message }
  }
}
