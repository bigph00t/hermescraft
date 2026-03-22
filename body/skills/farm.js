// farm.js — Till soil and plant seeds in nearby grass/dirt blocks

import minecraftData from 'minecraft-data'
import pkg from 'vec3'
import { navigateTo } from '../navigate.js'
import { normalizeItemName } from '../normalizer.js'
import { isInterrupted } from '../interrupt.js'

const Vec3 = pkg.Vec3 || pkg.default || pkg
const mcData = minecraftData('1.21.1')

/**
 * Till up to `count` nearby grass_block or dirt blocks and optionally plant seeds.
 *
 * Cooperative interrupt: checks bot.interrupt_code after every await.
 * Blocks that fail navigation are skipped rather than aborting the whole skill.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string} seedName - item name of seeds to plant (e.g. 'wheat_seeds'), or '' to only till
 * @param {number} [count=1] - number of blocks to till
 * @returns {Promise<{success: boolean, tilled: number, planted: number, reason?: string}>}
 */
export async function farm(bot, seedName, count = 1) {
  const normalizedSeed = seedName ? normalizeItemName(seedName) : ''

  // Require a hoe in inventory before starting — nothing to do without one
  const hoe = bot.inventory.items().find(i => i.name.includes('hoe'))
  if (!hoe) {
    return { success: false, tilled: 0, planted: 0, reason: 'no_hoe_in_inventory' }
  }

  // Collect candidate block positions: grass_block and dirt both become farmland when tilled
  const grassId = mcData.blocksByName['grass_block']?.id
  const dirtId = mcData.blocksByName['dirt']?.id

  const grassBlocks = grassId !== undefined
    ? bot.findBlocks({ matching: grassId, maxDistance: 16, count: 10 })
    : []
  const dirtBlocks = dirtId !== undefined
    ? bot.findBlocks({ matching: dirtId, maxDistance: 16, count: 10 })
    : []

  // Merge and deduplicate by string key — findBlocks returns Vec3-likes
  const seen = new Set()
  const candidates = []
  for (const pos of [...grassBlocks, ...dirtBlocks]) {
    const key = `${pos.x},${pos.y},${pos.z}`
    if (!seen.has(key)) {
      seen.add(key)
      candidates.push(pos)
    }
  }

  if (candidates.length === 0) {
    return { success: false, tilled: 0, planted: 0, reason: 'no_tillable_blocks_nearby' }
  }

  let tilled = 0
  let planted = 0

  for (let i = 0; i < candidates.length && tilled < count; i++) {
    if (isInterrupted(bot)) break

    const pos = candidates[i]

    // Navigate to within reach of the block
    const nav = await navigateTo(bot, pos.x, pos.y, pos.z, 2, 10000)
    if (isInterrupted(bot)) break
    if (!nav.success) continue

    // Equip hoe
    try {
      await bot.equip(hoe, 'hand')
    } catch (err) {
      // If equip fails, skip this block rather than abort
      continue
    }
    if (isInterrupted(bot)) break

    // Till the block — activateBlock on grass/dirt converts it to farmland
    const target = bot.blockAt(new Vec3(pos.x, pos.y, pos.z))
    if (!target || (target.name !== 'grass_block' && target.name !== 'dirt')) continue

    try {
      await bot.activateBlock(target)
    } catch {
      // Till failed (e.g. water block above, already farmland) — skip
      continue
    }
    if (isInterrupted(bot)) break

    tilled++
    console.log(`[farm] tilled ${tilled}/${count} at ${pos.x},${pos.y},${pos.z}`)

    // Attempt to plant seeds if requested
    if (normalizedSeed) {
      const seedItem = bot.inventory.items().find(i => i.name === normalizedSeed)
      if (seedItem) {
        try {
          await bot.equip(seedItem, 'hand')
          if (isInterrupted(bot)) break
          // Plant on the farmland surface (face = up = 0,1,0)
          const farmland = bot.blockAt(new Vec3(pos.x, pos.y, pos.z))
          if (farmland && farmland.name === 'farmland') {
            await bot.placeBlock(farmland, new Vec3(0, 1, 0))
            planted++
            console.log(`[farm] planted ${normalizedSeed} at ${pos.x},${pos.y},${pos.z}`)
          }
        } catch {
          // Planting failed (space above occupied, etc.) — count till, not plant
        }
        if (isInterrupted(bot)) break
      }
    }
  }

  return { success: tilled > 0, tilled, planted }
}
