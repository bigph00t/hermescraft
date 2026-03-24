// clear.js — Flatten an area by removing non-ground blocks (trees, flowers, grass)

import { Vec3 } from 'vec3'
import { isInterrupted } from '../interrupt.js'

const KEEP_BLOCKS = new Set([
  'air', 'cave_air', 'void_air', 'bedrock',
  'stone', 'granite', 'diorite', 'andesite', 'deepslate',
  'dirt', 'grass_block', 'coarse_dirt', 'podzol', 'mycelium', 'mud',
  'sand', 'red_sand', 'gravel', 'clay',
  'cobblestone', 'stone_bricks', 'mossy_cobblestone',
  'water', 'lava',
])

/**
 * Clear a rectangular area starting at bot position.
 * Removes all non-ground blocks above ground level (trees, flowers, tall grass).
 *
 * @param {import('mineflayer').Bot} bot
 * @param {number} [width=10] - x-axis extent (clamped 1-20)
 * @param {number} [depth=10] - z-axis extent (clamped 1-20)
 * @returns {Promise<{success: boolean, cleared: number, width: number, depth: number, reason?: string}>}
 */
export async function clear(bot, width = 10, depth = 10) {
  width = Math.max(1, Math.min(20, width))
  depth = Math.max(1, Math.min(20, depth))

  const pos = bot.entity.position.floored()
  const startX = pos.x - Math.floor(width / 2)
  const startZ = pos.z - Math.floor(depth / 2)
  let cleared = 0

  // Scan from top down — clear leaves/logs above before ground level
  for (let dy = 10; dy >= 0; dy--) {
    for (let dx = 0; dx < width; dx++) {
      for (let dz = 0; dz < depth; dz++) {
        if (isInterrupted(bot)) {
          return { success: false, cleared, width, depth, reason: 'interrupted' }
        }

        const bx = startX + dx
        const bz = startZ + dz
        const by = pos.y + dy

        const block = bot.blockAt(new Vec3(bx, by, bz))
        if (!block || block.name === 'air') continue
        if (KEEP_BLOCKS.has(block.name)) continue

        // Dig the block
        try {
          if (block.position.distanceTo(bot.entity.position) > 4.5) {
            // Walk closer if too far
            const goals = await import('mineflayer-pathfinder')
            const { GoalNear } = goals.pathfinder ? goals.pathfinder.goals : goals.goals || {}
            if (GoalNear) {
              bot.pathfinder.setGoal(new GoalNear(bx, by, bz, 3))
              await new Promise(r => {
                const check = () => {
                  if (block.position.distanceTo(bot.entity.position) <= 4.5 || isInterrupted(bot)) {
                    bot.pathfinder.setGoal(null)
                    r()
                  } else {
                    setTimeout(check, 200)
                  }
                }
                setTimeout(check, 200)
              })
            }
          }
          if (isInterrupted(bot)) break
          await bot.dig(block)
          cleared++
        } catch {
          // Can't dig — wrong tool, unbreakable, etc. Skip.
        }
      }
    }
  }

  return { success: true, cleared, width, depth }
}
