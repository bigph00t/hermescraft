// scan.js — Scan a 3D region and report block inventory

import { Vec3 } from 'vec3'

const MAX_SCAN_VOLUME = 32 * 32 * 32  // 32768 blocks

/**
 * Scan a 3D axis-aligned bounding box and return a block inventory.
 *
 * Coordinates are auto-sorted so passing x1 > x2 works correctly.
 * Air blocks are counted under the key "air".
 * Blocks in unloaded chunks (bot.blockAt returns null) are counted as "unloaded".
 * `total` in the result excludes air and unloaded — it represents solid/fluid blocks only.
 * Maximum scan volume is 32*32*32 = 32768 to prevent lag.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {number} x1
 * @param {number} y1
 * @param {number} z1
 * @param {number} x2
 * @param {number} y2
 * @param {number} z2
 * @returns {{ success: true, blocks: Record<string,number>, total: number, volume: number }
 *         | { success: false, reason: 'invalid_coordinates' | 'scan_too_large' }}
 */
export function scanArea(bot, x1, y1, z1, x2, y2, z2) {
  // Validate coordinates
  if ([x1, y1, z1, x2, y2, z2].some(c => typeof c !== 'number' || isNaN(c))) {
    return { success: false, reason: 'invalid_coordinates' }
  }

  // Normalize so min <= max on every axis
  const minX = Math.min(x1, x2)
  const maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2)
  const maxY = Math.max(y1, y2)
  const minZ = Math.min(z1, z2)
  const maxZ = Math.max(z1, z2)

  const volume = (maxX - minX + 1) * (maxY - minY + 1) * (maxZ - minZ + 1)
  if (volume > MAX_SCAN_VOLUME) {
    return { success: false, reason: 'scan_too_large' }
  }

  const counts = new Map()
  let solidCount = 0

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        const block = bot.blockAt(new Vec3(x, y, z))
        let name
        if (block === null || block === undefined) {
          name = 'unloaded'
        } else {
          name = block.name
        }
        counts.set(name, (counts.get(name) || 0) + 1)
        if (name !== 'air' && name !== 'unloaded') {
          solidCount++
        }
      }
    }
  }

  return {
    success: true,
    blocks: Object.fromEntries(counts),
    total: solidCount,
    volume,
  }
}
