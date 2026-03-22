// interrupt.js — Cooperative interrupt flag management helpers

/**
 * Clear the interrupt flag — call at the start of each new skill dispatch
 * to reset cancellation state from any prior skill.
 *
 * @param {import('mineflayer').Bot} bot
 */
export function clearInterrupt(bot) {
  bot.interrupt_code = false
}

/**
 * Check whether the interrupt flag is set.
 * Skills should call this after every await inside loops.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {boolean}
 */
export function isInterrupted(bot) {
  return !!bot.interrupt_code
}

/**
 * Request cancellation of the currently running skill.
 * The skill will detect this on its next interrupt check and exit cleanly.
 *
 * @param {import('mineflayer').Bot} bot
 */
export function requestInterrupt(bot) {
  bot.interrupt_code = true
}
