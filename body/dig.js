// dig.js — Dig blocks with post-dig verification
// Post-dig verification detects silent failures from server-side protection plugins
// (WorldGuard, CoreProtect, etc.) that prevent digs without throwing errors.

/**
 * Dig a block and verify the block state actually changed.
 *
 * Always wraps bot.dig() in try/catch — diggingAborted is a fatal error thrown
 * when dig() is called twice concurrently (Pitfall 3). Returning failure instead
 * of throwing keeps skill loops from crashing.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {import('mineflayer').Block} block — block object from bot.blockAt() or bot.findBlock()
 * @returns {Promise<{success: boolean, before?: string, after?: string, reason?: string}>}
 */
export async function digBlock(bot, block) {
  // Save position before dig — block object may become stale after dig resolves
  const pos = block.position.clone()
  const nameBefore = bot.blockAt(pos)?.name

  try {
    await bot.dig(block)
  } catch (err) {
    return { success: false, reason: err.message }
  }

  // Post-dig verification: confirm server actually removed the block.
  // If name is unchanged, server-side protection silently blocked the dig.
  const nameAfter = bot.blockAt(pos)?.name
  if (nameAfter === nameBefore) {
    return { success: false, reason: 'block_unchanged' }
  }

  return { success: true, before: nameBefore, after: nameAfter }
}
