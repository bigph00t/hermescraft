// navigate.js — Wall-clock timeout wrapper around mineflayer-pathfinder goto()
// mineflayer-pathfinder is a CJS module — must import via default then destructure
import mpf from 'mineflayer-pathfinder'
const { goals } = mpf

/**
 * Navigate the bot to within `range` blocks of (x, y, z).
 * Wraps bot.pathfinder.goto() in a wall-clock timeout to guard against
 * Issue #222: pathfinder hangs indefinitely on truly unreachable goals.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} [range=1] — acceptable arrival distance in blocks
 * @param {number} [timeoutMs=30000] — wall-clock timeout in milliseconds
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export async function navigateTo(bot, x, y, z, range = 1, timeoutMs = 30000) {
  const goal = new goals.GoalNear(x, y, z, range)

  // Promise.race with wall-clock timeout — the only reliable defense against
  // pathfinder Issue #222 where goto() hangs forever on unreachable goals.
  let timerId
  const timer = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error('nav_timeout')), timeoutMs)
  })

  try {
    await Promise.race([bot.pathfinder.goto(goal), timer])
    clearTimeout(timerId)
    console.log(`[navigate] arrived at ${x},${y},${z}`)
    return { success: true }
  } catch (err) {
    clearTimeout(timerId)
    // setGoal(null) causes immediate halt — faster than pathfinder.stop()
    bot.pathfinder.setGoal(null)
    const reason = err.message === 'nav_timeout' ? 'nav_timeout' : err.message
    console.log(`[navigate] failed to reach ${x},${y},${z}: ${reason}`)
    return { success: false, reason }
  }
}

/**
 * Navigate to within reach distance of a block.
 * Convenience wrapper for the common pattern of approaching a block to dig/interact.
 * Uses range=2 so the bot stands adjacent rather than standing on the block.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {import('mineflayer').Block} block
 * @param {number} [timeoutMs=30000]
 * @returns {Promise<{success: boolean, reason?: string}>}
 */
export async function navigateToBlock(bot, block, timeoutMs = 30000) {
  return navigateTo(bot, block.position.x, block.position.y, block.position.z, 2, timeoutMs)
}
