// look.js — Inspect chest contents or bot inventory and return a readable summary

import minecraftData from 'minecraft-data'
import { navigateToBlock } from '../navigate.js'
import { isInterrupted } from '../interrupt.js'

const mcData = minecraftData('1.21.1')

/**
 * Format an array of mineflayer Item objects into a human-readable summary string.
 * Groups by name and sums counts. Returns "empty" if no items.
 *
 * @param {Array} items - array of mineflayer Item objects
 * @returns {string}
 */
function formatItems(items) {
  if (!items || items.length === 0) return 'empty'
  const counts = {}
  for (const item of items) {
    if (!item) continue
    const name = item.name || `id:${item.type}`
    counts[name] = (counts[name] || 0) + item.count
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, count]) => `${name} x${count}`)
    .join(', ')
}

/**
 * Find the nearest chest, trapped_chest, or barrel within 32 blocks, navigate to it,
 * read its contents, and return a summary.
 *
 * Uses bot.openContainer() (mineflayer 4.x API) with a fallback to bot.openChest()
 * for older mineflayer versions.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {Promise<{success: boolean, items?: string, count?: number, reason?: string}>}
 */
export async function lookChest(bot) {
  // Find nearest chest/barrel within 32 blocks
  const containerIds = ['chest', 'trapped_chest', 'barrel']
    .map(name => mcData.blocksByName[name]?.id)
    .filter(id => id !== undefined)

  const chestBlock = bot.findBlock({
    matching: b => containerIds.includes(b.type),
    maxDistance: 64,
  })

  if (!chestBlock) {
    return { success: false, reason: 'no_chest_nearby' }
  }

  // Navigate to the chest
  const nav = await navigateToBlock(bot, chestBlock)
  if (!nav.success) {
    return { success: false, reason: nav.reason || 'nav_failed' }
  }

  if (isInterrupted(bot)) {
    return { success: false, reason: 'interrupted' }
  }

  // Open the container — mineflayer 4.x uses openContainer(), older versions used openChest()
  let chest
  try {
    if (typeof bot.openContainer === 'function') {
      chest = await bot.openContainer(chestBlock)
    } else {
      chest = await bot.openChest(chestBlock)
    }
  } catch (err) {
    return { success: false, reason: err.message || 'open_failed' }
  }

  try {
    // containerItems() returns only the chest's own slots (not bot's inventory side).
    // Fall back to items() for older window implementations.
    const items = typeof chest.containerItems === 'function'
      ? chest.containerItems()
      : chest.items()

    const summary = formatItems(items)
    const count = items ? items.reduce((sum, i) => sum + (i ? i.count : 0), 0) : 0
    console.log(`[look] chest at ${chestBlock.position}: ${summary}`)
    return { success: true, items: summary, count }
  } finally {
    chest.close()
  }
}

/**
 * Read the bot's own inventory and return a formatted summary.
 * No navigation needed — always instant.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {{ success: boolean, items: string, count: number }}
 */
export function lookInventory(bot) {
  const items = bot.inventory.items()
  const summary = formatItems(items)
  const count = items.length
  console.log(`[look] inventory: ${summary}`)
  return { success: true, items: summary, count }
}

// ── Block category sets for horizon scanning ──

const TREE_LOGS = new Set([
  'oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log',
  'dark_oak_log', 'cherry_log', 'mangrove_log',
])
const ORES = new Set([
  'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'copper_ore',
  'deepslate_coal_ore', 'deepslate_iron_ore', 'deepslate_gold_ore',
  'deepslate_diamond_ore', 'deepslate_copper_ore',
])

/**
 * Farsight scan — survey terrain 64 blocks in one or all cardinal directions.
 * Returns natural-language terrain descriptions the LLM can use for planning.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string} [direction] - 'north'|'south'|'east'|'west' or omit for 360°
 * @returns {{ success: boolean, description: string }}
 */
export function lookHorizon(bot, direction) {
  const pos = bot.entity.position.floored()
  const { Vec3 } = require('vec3')

  // Direction vectors: MC +X=East, +Z=South, -Z=North
  const DIR_MAP = {
    north: { dx: 0, dz: -1 },
    south: { dx: 0, dz: 1 },
    east:  { dx: 1, dz: 0 },
    west:  { dx: -1, dz: 0 },
  }

  // Support 'forward' — use bot's actual facing direction
  let resolvedDirection = direction?.toLowerCase()
  if (resolvedDirection === 'forward' || resolvedDirection === 'ahead') {
    const yaw = bot.entity.yaw || 0
    const yawDeg = (((-yaw * 180 / Math.PI) % 360) + 360) % 360
    const cardinals = ['south', 'west', 'north', 'east']
    resolvedDirection = cardinals[Math.round(yawDeg / 90) % 4]
  }

  const dirs = resolvedDirection && DIR_MAP[resolvedDirection]
    ? [{ name: resolvedDirection, ...DIR_MAP[resolvedDirection] }]
    : Object.entries(DIR_MAP).map(([name, d]) => ({ name, ...d }))

  const results = []

  for (const dir of dirs) {
    const bands = [
      { label: '0-20b', blocks: [] },
      { label: '20-40b', blocks: [] },
      { label: '40-64b', blocks: [] },
    ]

    // Sample terrain in a corridor: 8 blocks wide, step every 2 blocks
    for (let dist = 2; dist <= 64; dist += 2) {
      for (let side = -4; side <= 4; side += 2) {
        const sampleX = pos.x + dir.dx * dist + (dir.dz !== 0 ? side : 0)
        const sampleZ = pos.z + dir.dz * dist + (dir.dx !== 0 ? side : 0)

        // Find surface: scan from Y+10 down to Y-20 to find first solid block
        let surfaceY = null
        for (let y = pos.y + 10; y >= pos.y - 20; y--) {
          const block = bot.blockAt(new Vec3(sampleX, y, sampleZ))
          if (block && block.name !== 'air' && block.name !== 'cave_air' && block.name !== 'void_air') {
            surfaceY = y
            const bandIdx = dist < 20 ? 0 : dist < 40 ? 1 : 2
            bands[bandIdx].blocks.push({ name: block.name, y, dist })
            break
          }
        }
      }
    }

    // Classify each band into a terrain description
    const bandDescs = bands.map(band => {
      if (band.blocks.length === 0) return `${band.label}: unloaded`

      const counts = {}
      let minY = Infinity, maxY = -Infinity
      let waterCount = 0, treeCount = 0, oreCount = 0

      for (const b of band.blocks) {
        counts[b.name] = (counts[b.name] || 0) + 1
        if (b.y < minY) minY = b.y
        if (b.y > maxY) maxY = b.y
        if (b.name === 'water') waterCount++
        if (TREE_LOGS.has(b.name)) treeCount++
        if (ORES.has(b.name)) oreCount++
      }

      // Top block types
      const topBlocks = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name)

      const parts = []

      // Terrain type
      if (waterCount > band.blocks.length * 0.4) parts.push('water/ocean')
      else if (treeCount > 2) parts.push(`forest (${topBlocks.find(b => TREE_LOGS.has(b)) || 'mixed'})`)
      else if (topBlocks.includes('sand') || topBlocks.includes('sandstone')) parts.push('desert/beach')
      else if (topBlocks.includes('grass_block')) parts.push('plains/grassland')
      else if (topBlocks.includes('stone') || topBlocks.includes('deepslate')) parts.push('exposed stone/cliffs')
      else if (topBlocks.includes('snow_block') || topBlocks.includes('powder_snow')) parts.push('snowy terrain')
      else parts.push(topBlocks.slice(0, 2).join('+'))

      // Elevation
      const elevDelta = maxY - minY
      if (elevDelta > 10) parts.push(`hilly (Y ${minY}-${maxY})`)
      else if (elevDelta > 5) parts.push(`rolling (Y ~${Math.round((minY + maxY) / 2)})`)
      else parts.push(`flat (Y ~${Math.round((minY + maxY) / 2)})`)

      // Notable features
      if (oreCount > 0) parts.push(`ores visible`)
      if (waterCount > 0 && waterCount <= band.blocks.length * 0.4) parts.push('water nearby')

      return `${band.label}: ${parts.join(', ')}`
    })

    const dirLabel = dir.name.charAt(0).toUpperCase() + dir.name.slice(1)
    results.push(`${dirLabel}: ${bandDescs.join(' | ')}`)
  }

  const description = results.join('\n')
  console.log(`[look] horizon scan:\n${description}`)
  return { success: true, description }
}
