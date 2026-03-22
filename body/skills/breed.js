// breed.js — Feed two nearby animals to trigger breeding

import { navigateTo } from '../navigate.js'
import { isInterrupted } from '../interrupt.js'

// Breeding food map: animal entity name → required food item name
const BREED_FOOD = {
  cow: 'wheat',
  sheep: 'wheat',
  pig: 'carrot',
  chicken: 'wheat_seeds',
  rabbit: 'carrot',
  horse: 'golden_apple',
  wolf: 'cooked_beef',   // bones tame wolves; any meat breeds them — cooked_beef is most common
  cat: 'raw_cod',
}

/**
 * Feed two nearby animals of the given type to initiate breeding.
 *
 * Cooperative interrupt: checks bot.interrupt_code after every await.
 * Requires the correct breeding food in inventory and 2 animals within 16 blocks.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string} animalType - entity name, e.g. 'cow', 'pig', 'sheep'
 * @returns {Promise<{success: boolean, reason: string}>}
 */
export async function breed(bot, animalType) {
  const type = animalType.toLowerCase().trim()

  // Find all nearby entities matching the animal type
  const nearby = Object.values(bot.entities).filter(
    e => e.name === type && e.position.distanceTo(bot.entity.position) < 16
  )

  if (nearby.length < 2) {
    return { success: false, reason: `need 2 ${type} nearby, found ${nearby.length}` }
  }

  // Determine required breeding food
  const foodName = BREED_FOOD[type]
  if (!foodName) {
    return { success: false, reason: `no breeding food known for ${type}` }
  }

  // Check inventory for the food item
  const foodItem = bot.inventory.items().find(i => i.name === foodName)
  if (!foodItem) {
    return { success: false, reason: `no ${foodName} in inventory for breeding ${type}` }
  }

  // Feed the first two animals found
  const targets = nearby.slice(0, 2)

  for (const entity of targets) {
    if (isInterrupted(bot)) break

    // Navigate close to the animal
    const nav = await navigateTo(
      bot,
      Math.round(entity.position.x),
      Math.round(entity.position.y),
      Math.round(entity.position.z),
      2,
      10000
    )
    if (isInterrupted(bot)) break
    if (!nav.success) {
      return { success: false, reason: `could not reach ${type}` }
    }

    // Equip the food — re-fetch from inventory in case it was consumed
    const freshFood = bot.inventory.items().find(i => i.name === foodName)
    if (!freshFood) {
      return { success: false, reason: `ran out of ${foodName} while breeding` }
    }

    try {
      await bot.equip(freshFood, 'hand')
    } catch (err) {
      return { success: false, reason: `equip failed: ${err.message}` }
    }
    if (isInterrupted(bot)) break

    // Activate (right-click) the entity to feed it
    try {
      await bot.activateEntity(entity)
    } catch (err) {
      return { success: false, reason: `activate entity failed: ${err.message}` }
    }
    if (isInterrupted(bot)) break

    console.log(`[breed] fed ${type} with ${foodName}`)
  }

  return { success: true, reason: `bred 2 ${type}` }
}
