// explore.js — Navigate to unexplored areas and scan for notable features

import { navigateTo } from '../navigate.js'
import { isInterrupted } from '../interrupt.js'

// EXPLORE_DISTANCE default distance in blocks to travel per explore call
const EXPLORE_DISTANCE = 64

// NOTABLE_BLOCKS indicates villages, dungeons, or other structures worth remembering
const NOTABLE_BLOCKS = new Set([
  'chest', 'spawner', 'bookshelf', 'enchanting_table', 'anvil',
  'brewing_stand', 'beacon', 'end_portal_frame', 'nether_portal',
  'bell', 'lectern', 'fletching_table', 'smithing_table',
  'cartography_table', 'loom', 'barrel', 'blast_furnace',
  'smoker', 'composter', 'stonecutter',
])

const CARDINALS = ['north', 'south', 'east', 'west']

/**
 * Navigate to unexplored areas in a direction and scan for notable features.
 *
 * Cooperative interrupt: checks bot.interrupt_code after navigation.
 * Only logs discoveries if the bot actually moved (Pitfall 4).
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string|null} [direction=null] - 'north'|'south'|'east'|'west' or null for random
 * @param {number} [distance=64] - blocks to travel
 * @returns {Promise<{success: boolean, discoveries?: Array, newPos?: object, direction?: string, reason?: string}>}
 */
export async function explore(bot, direction = null, distance = 64) {
  try {
    const pos = bot.entity.position
    const startPos = pos.clone()

    // Pick direction — use provided or random cardinal
    const dirUsed = (direction && CARDINALS.includes(direction.toLowerCase()))
      ? direction.toLowerCase()
      : CARDINALS[Math.floor(Math.random() * CARDINALS.length)]

    // Compute target position from direction
    let targetX = pos.x
    let targetZ = pos.z
    const dist = distance || EXPLORE_DISTANCE

    if (dirUsed === 'north') targetZ -= dist
    else if (dirUsed === 'south') targetZ += dist
    else if (dirUsed === 'east') targetX += dist
    else if (dirUsed === 'west') targetX -= dist

    console.log(`[explore] heading ${dirUsed} to ${Math.round(targetX)},${Math.round(pos.y)},${Math.round(targetZ)}`)

    const navResult = await navigateTo(bot, targetX, pos.y, targetZ, 8, 45000)

    if (isInterrupted(bot)) {
      return { success: false, reason: 'interrupted', direction: dirUsed }
    }

    const newPos = bot.entity.position
    const moved = newPos.distanceTo(startPos)

    // Pitfall 4: don't log false discoveries if bot didn't actually move
    if (moved < 10) {
      return { success: false, reason: 'navigation_failed', direction: dirUsed }
    }

    // Scan for notable blocks within 16 blocks of new position
    const notablePositions = bot.findBlocks({
      matching: block => NOTABLE_BLOCKS.has(block.name),
      maxDistance: 16,
      count: 5,
    })

    const discoveries = []

    // Record notable blocks as structure discoveries
    for (const bPos of notablePositions) {
      const block = bot.blockAt(bPos)
      if (!block) continue
      discoveries.push({
        type: 'structure',
        name: block.name,
        x: Math.round(bPos.x),
        z: Math.round(bPos.z),
        description: `Found ${block.name} at ${Math.round(bPos.x)},${Math.round(bPos.z)}`,
      })
    }

    // Scan nearby entities for villagers, animals, and hostile mobs within 16b
    const currentPos = bot.entity.position
    for (const entity of Object.values(bot.entities)) {
      const eDist = entity.position.distanceTo(currentPos)
      if (eDist > 16) continue
      if (entity === bot.entity) continue

      if (entity.name === 'villager') {
        discoveries.push({
          type: 'entity',
          name: 'villager',
          x: Math.round(entity.position.x),
          z: Math.round(entity.position.z),
          description: `Villager at ${Math.round(entity.position.x)},${Math.round(entity.position.z)}`,
        })
      } else if (entity.type === 'mob' && entity.name) {
        discoveries.push({
          type: 'entity',
          name: entity.name,
          x: Math.round(entity.position.x),
          z: Math.round(entity.position.z),
          description: `${entity.name} at ${Math.round(entity.position.x)},${Math.round(entity.position.z)}`,
        })
      }
    }

    const newPosSnap = {
      x: Math.round(newPos.x),
      y: Math.round(newPos.y),
      z: Math.round(newPos.z),
    }

    console.log(`[explore] arrived at ${newPosSnap.x},${newPosSnap.y},${newPosSnap.z} — ${discoveries.length} discoveries`)

    return { success: true, discoveries, newPos: newPosSnap, direction: dirUsed }
  } catch (err) {
    return { success: false, reason: err.message }
  }
}
