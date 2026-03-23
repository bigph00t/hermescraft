// harvest.js — Detect and harvest mature crops, then replant

import { navigateTo } from '../navigate.js'
import { isInterrupted } from '../interrupt.js'

// CROP_CONFIG maps crop block names to their mature age and seed item
// Pitfall 3: must use lambda block state check (getProperties().age) not block id
const CROP_CONFIG = {
  wheat:     { matureAge: 7, seedItem: 'wheat_seeds' },
  carrots:   { matureAge: 7, seedItem: 'carrot' },
  potatoes:  { matureAge: 7, seedItem: 'potato' },
  beetroots: { matureAge: 3, seedItem: 'beetroot_seeds' },
}

// Normalize crop name input to canonical crop block name
// e.g. 'wheat_seeds' -> 'wheat', 'carrot' -> 'carrots', 'beetroot' -> 'beetroots'
function normalizeCropName(name) {
  if (!name) return 'wheat'
  const n = name.toLowerCase()
  if (n === 'wheat' || n === 'wheat_seeds') return 'wheat'
  if (n === 'carrot' || n === 'carrots') return 'carrots'
  if (n === 'potato' || n === 'potatoes') return 'potatoes'
  if (n === 'beetroot' || n === 'beetroots' || n === 'beetroot_seeds') return 'beetroots'
  // If the name matches a known crop block directly, use it
  if (CROP_CONFIG[n]) return n
  return 'wheat'
}

/**
 * Detect mature crops of the given type, harvest them, and replant.
 *
 * Cooperative interrupt: checks bot.interrupt_code after every await.
 * Crops that fail navigation are skipped rather than aborting the whole skill.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string} [cropName='wheat'] - crop name (e.g. 'wheat', 'carrots', 'wheat_seeds')
 * @param {number} [count=8] - max number of crops to harvest
 * @returns {Promise<{success: boolean, harvested: number, replanted: number, reason?: string}>}
 */
export async function harvest(bot, cropName = 'wheat', count = 8) {
  try {
    const cropBlockName = normalizeCropName(cropName)
    const config = CROP_CONFIG[cropBlockName]
    if (!config) {
      return { success: false, harvested: 0, replanted: 0, reason: `unknown_crop: ${cropName}` }
    }
    const { matureAge, seedItem } = config

    // Find mature crop blocks using lambda form to check block state age (Pitfall 3)
    const cropPositions = bot.findBlocks({
      matching: block => block.name === cropBlockName && block.getProperties().age === matureAge,
      maxDistance: 32,
      count,
    })

    if (cropPositions.length === 0) {
      return { success: false, harvested: 0, replanted: 0, reason: 'no_mature_crops_nearby' }
    }

    let harvested = 0
    let replanted = 0

    for (const cropPos of cropPositions) {
      if (isInterrupted(bot)) break

      // Navigate to within 3 blocks of the crop
      const nav = await navigateTo(bot, cropPos.x, cropPos.y, cropPos.z, 3, 15000)
      if (isInterrupted(bot)) break
      if (!nav.success) continue

      // Re-check block is still a mature crop — another bot or game tick may have changed it
      const block = bot.blockAt(cropPos)
      if (!block || block.name !== cropBlockName || block.getProperties().age !== matureAge) {
        continue
      }

      try {
        await bot.dig(block)
        harvested++
        console.log(`[harvest] harvested ${cropBlockName} at ${cropPos.x},${cropPos.y},${cropPos.z} (${harvested}/${count})`)
      } catch (err) {
        console.log(`[harvest] dig failed at ${cropPos.x},${cropPos.y},${cropPos.z}: ${err.message}`)
        continue
      }

      if (isInterrupted(bot)) break

      // Attempt to replant — find seed item in inventory and plant on farmland below
      const seedInv = bot.inventory.items().find(i => i.name === seedItem)
      if (seedInv) {
        try {
          await bot.equip(seedInv, 'hand')
          if (isInterrupted(bot)) break
          // Plant on the farmland block directly below the crop position
          const farmland = bot.blockAt(cropPos.offset(0, -1, 0))
          if (farmland && farmland.name === 'farmland') {
            await bot.activateBlock(farmland)
            replanted++
            console.log(`[harvest] replanted ${seedItem} at ${cropPos.x},${cropPos.y},${cropPos.z}`)
          }
        } catch {
          // Replanting failed — count harvest, not replant
        }
        if (isInterrupted(bot)) break
      }
    }

    return { success: harvested > 0, harvested, replanted }
  } catch (err) {
    return { success: false, harvested: 0, replanted: 0, reason: err.message }
  }
}
