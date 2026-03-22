// inventory.js — Equip best tools/armor and eat when hungry

import minecraftData from 'minecraft-data'
import { isInterrupted } from '../interrupt.js'

const mcData = minecraftData('1.21.1')

// Armor material tier order — index is tier rank (higher = better)
const ARMOR_TIER = ['leather', 'golden', 'chainmail', 'iron', 'diamond', 'netherite']

// Maps armor piece suffix to equip destination and inventory slot number
const ARMOR_SLOT = {
  helmet:     { dest: 'head',  slotNum: 5 },
  chestplate: { dest: 'torso', slotNum: 6 },
  leggings:   { dest: 'legs',  slotNum: 7 },
  boots:      { dest: 'feet',  slotNum: 8 },
}

// O(1) food lookup — built once from minecraft-data's food array
const FOOD_NAMES = new Set(mcData.foodsArray?.map(f => f.name) || [])

/**
 * Return the numeric tier rank of an armor item by its name prefix.
 * Higher is better. Returns -1 if not a recognized armor material.
 *
 * @param {string} itemName - e.g. 'iron_helmet'
 * @returns {number}
 */
function armorTier(itemName) {
  for (let i = ARMOR_TIER.length - 1; i >= 0; i--) {
    if (itemName.startsWith(ARMOR_TIER[i])) return i
  }
  return -1
}

/**
 * Equip the best available armor from inventory into each armor slot.
 * Only upgrades a slot if a better-tier item exists in the inventory.
 * Skips slots where the current armor is already the best available.
 *
 * Cooperative interrupt: checks bot.interrupt_code before each slot.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {Promise<{success: boolean}>}
 */
export async function equipBestArmor(bot) {
  for (const [suffix, { dest, slotNum }] of Object.entries(ARMOR_SLOT)) {
    if (isInterrupted(bot)) break

    // Find all inventory items that are this type of armor piece
    const candidates = bot.inventory.items().filter(i => i.name.endsWith('_' + suffix))
    if (candidates.length === 0) continue

    // Sort by tier descending — best first
    candidates.sort((a, b) => armorTier(b.name) - armorTier(a.name))
    const best = candidates[0]

    // Get currently equipped piece in this slot
    const current = bot.inventory.slots[slotNum]
    const currentTier = current ? armorTier(current.name) : -1
    const bestTier = armorTier(best.name)

    // Only equip if it's an upgrade (or slot is empty)
    if (bestTier > currentTier) {
      await bot.equip(best, dest)
      console.log(`[inventory] equipped ${best.name}`)
    }
  }

  return { success: true }
}

/**
 * Eat a food item from inventory if bot food level is below threshold.
 * Equips food to hand before consuming. bot.consume() is wrapped in try/catch
 * because it throws when food=20 or when a non-consumable item is held (Pitfall 5).
 *
 * Cooperative interrupt: checks bot.interrupt_code after equipping food.
 *
 * This function is reactive — it does NOT register persistent event listeners.
 * The Mind layer or Mode layer calls this at appropriate times.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {number} [threshold=14] - eat when bot.food < threshold (14 = sprint disabled)
 * @returns {Promise<{success: boolean, reason?: string, food_before?: number}>}
 */
export async function eatIfHungry(bot, threshold = 14) {
  if (bot.food >= threshold) {
    return { success: true, reason: 'not_hungry' }
  }

  // Find a food item in inventory using pre-built O(1) FOOD_NAMES set
  const foodItem = bot.inventory.items().find(item => FOOD_NAMES.has(item.name))
  if (!foodItem) {
    return { success: false, reason: 'no_food' }
  }

  const foodBefore = bot.food
  await bot.equip(foodItem, 'hand')

  if (isInterrupted(bot)) {
    return { success: false, reason: 'interrupted' }
  }

  try {
    await bot.consume()
    console.log(`[inventory] ate ${foodItem.name}`)
    return { success: true, food_before: foodBefore }
  } catch (err) {
    return { success: false, reason: err.message }
  }
}
