// place.js — Place blocks with post-place verification
import { Vec3 } from 'vec3'

/**
 * Standard face direction vectors for placeBlock().
 * The faceVector indicates which face of the reference block to place on.
 * The new block appears at referenceBlock.position.plus(faceVector).
 */
export const FACE = {
  TOP:    new Vec3(0, 1, 0),
  BOTTOM: new Vec3(0, -1, 0),
  NORTH:  new Vec3(0, 0, -1),
  SOUTH:  new Vec3(0, 0, 1),
  EAST:   new Vec3(1, 0, 0),
  WEST:   new Vec3(-1, 0, 0),
}

/**
 * Place a block on the specified face of a reference block, then verify
 * the placement actually took effect on the server.
 *
 * Post-place verification detects failures from protection plugins or
 * positioning issues where placeBlock() resolves without actually placing.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {import('mineflayer').Block} referenceBlock — existing solid block to place against
 * @param {Vec3} faceVector — which face of the reference block to place on
 * @returns {Promise<{success: boolean, placedBlock?: string, reason?: string}>}
 */
export async function placeBlock(bot, referenceBlock, faceVector) {
  // Compute where the new block will appear
  const targetPos = referenceBlock.position.plus(faceVector)

  try {
    await bot.placeBlock(referenceBlock, faceVector)
  } catch (err) {
    return { success: false, reason: err.message }
  }

  // Post-place verification: confirm a non-air block now exists at the target
  const placed = bot.blockAt(targetPos)
  if (!placed || placed.name === 'air') {
    return { success: false, reason: 'placement_failed' }
  }

  return { success: true, placedBlock: placed.name }
}

/**
 * Place a block on top of a base block.
 * Convenience wrapper for the most common placement direction (building upward).
 *
 * @param {import('mineflayer').Bot} bot
 * @param {import('mineflayer').Block} baseBlock — existing block to place on top of
 * @returns {Promise<{success: boolean, placedBlock?: string, reason?: string}>}
 */
export async function placeBlockOnTop(bot, baseBlock) {
  return placeBlock(bot, baseBlock, new Vec3(0, 1, 0))
}
