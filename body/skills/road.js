// road.js — Build a 3-wide road from current position to target coordinates

import minecraftData from 'minecraft-data'
import { Vec3 } from 'vec3'
import { navigateTo } from '../navigate.js'
import { placeBlock } from '../place.js'
import { isInterrupted } from '../interrupt.js'

const mcData = minecraftData('1.21.1')

const REPLACEABLE = new Set([
  'air', 'short_grass', 'tall_grass', 'fern', 'large_fern',
  'dead_bush', 'dandelion', 'poppy', 'blue_orchid', 'allium',
  'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip',
  'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'sweet_berry_bush',
  'snow', 'snow_layer',
])

/**
 * Build a 3-wide road from bot's current position to target x,z coordinates.
 * Places road material at ground level, replacing grass/dirt.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {number} toX - target x coordinate
 * @param {number} toZ - target z coordinate
 * @param {string} [material='cobblestone'] - block to use for road surface
 * @returns {Promise<{success: boolean, placed: number, from: object, to: object, reason?: string}>}
 */
export async function buildRoad(bot, toX, toZ, material = 'cobblestone') {
  if (isNaN(toX) || isNaN(toZ)) {
    return { success: false, placed: 0, reason: 'missing target coordinates' }
  }

  const itemMeta = mcData.itemsByName[material]
  if (!itemMeta) {
    return { success: false, placed: 0, reason: `unknown material: ${material}` }
  }

  const pos = bot.entity.position.floored()
  const fromX = pos.x
  const fromZ = pos.z
  const fromY = pos.y

  // Calculate road positions — straight line from here to target
  const dx = toX - fromX
  const dz = toZ - fromZ
  const length = Math.max(Math.abs(dx), Math.abs(dz))

  if (length === 0) {
    return { success: false, placed: 0, reason: 'target is current position' }
  }
  if (length > 100) {
    return { success: false, placed: 0, reason: 'road too long (max 100 blocks)' }
  }

  const stepX = dx / length
  const stepZ = dz / length
  let placed = 0

  for (let i = 0; i <= length; i++) {
    if (isInterrupted(bot)) {
      return { success: false, placed, from: { x: fromX, z: fromZ }, to: { x: toX, z: toZ }, reason: 'interrupted' }
    }

    const cx = Math.round(fromX + stepX * i)
    const cz = Math.round(fromZ + stepZ * i)

    // 3-wide: place center + 1 block on each side (perpendicular to direction)
    const perpX = Math.abs(stepZ) > Math.abs(stepX) ? 1 : 0
    const perpZ = Math.abs(stepX) > Math.abs(stepZ) ? 1 : 0

    for (let offset = -1; offset <= 1; offset++) {
      const bx = cx + perpX * offset
      const bz = cz + perpZ * offset

      // Find ground level — search down from fromY+2 for first solid block
      let groundY = fromY
      for (let sy = fromY + 2; sy >= fromY - 3; sy--) {
        const b = bot.blockAt(new Vec3(bx, sy, bz))
        if (b && b.name !== 'air' && !REPLACEABLE.has(b.name)) {
          groundY = sy
          break
        }
      }

      // Check if block at ground level is already road material
      const existing = bot.blockAt(new Vec3(bx, groundY, bz))
      if (existing && existing.name === material) continue

      // Check inventory for material
      const inInventory = bot.inventory.findInventoryItem(itemMeta.id, null)
      if (!inInventory) {
        return { success: false, placed, from: { x: fromX, z: fromZ }, to: { x: toX, z: toZ }, reason: `out of ${material}` }
      }

      // Navigate close if needed
      const targetVec = new Vec3(bx, groundY, bz)
      if (targetVec.distanceTo(bot.entity.position) > 4) {
        await navigateTo(bot, bx, groundY, bz, 3, 10000)
        if (isInterrupted(bot)) break
      }

      // Clear any vegetation above the road position
      const above = bot.blockAt(new Vec3(bx, groundY + 1, bz))
      if (above && REPLACEABLE.has(above.name) && above.name !== 'air') {
        try { await bot.dig(above) } catch {}
      }

      // Place road block — find reference block below
      const refBlock = bot.blockAt(new Vec3(bx, groundY - 1, bz))
      if (refBlock && refBlock.name !== 'air') {
        try {
          await bot.equip(inInventory, 'hand')
          const faceVec = new Vec3(0, 1, 0) // place on top of reference
          await bot.lookAt(refBlock.position, true)
          const result = await placeBlock(bot, refBlock, faceVec)
          if (result.success) placed++
        } catch {
          // Skip this position
        }
      }
    }
  }

  return { success: true, placed, from: { x: fromX, z: fromZ }, to: { x: toX, z: toZ } }
}
