// farming.js — Crop farming orchestration module with farm sustained action
// Composes existing mod actions (interact_block, place, break_block) into
// higher-level farming behaviors: till, plant, wait, harvest.

import { executeAction } from './actions.js'

// ── Module State ──

let _activeFarm = null

// ── Helpers ──

// Generate the 72 farmland positions for a 9x9 farm grid, excluding water channel at col 4
function generateFarmPositions(originX, originY, originZ) {
  const positions = []
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (col === 4) continue // water channel
      positions.push({
        x: originX + col,
        y: originY,
        z: originZ + row,
      })
    }
  }
  return positions
}

// Scan inventory for any hoe item
function findHoe(inventory) {
  if (!inventory || !Array.isArray(inventory)) return null
  for (const slot of inventory) {
    const itemId = (slot.item || slot.name || '').replace('minecraft:', '')
    if (itemId.includes('hoe')) return itemId
  }
  return null
}

// Check if inventory has a specific item (partial match)
function hasItem(inventory, itemName) {
  if (!inventory || !Array.isArray(inventory)) return false
  const stripped = itemName.replace('minecraft:', '')
  return inventory.some(slot => {
    const id = (slot.item || slot.name || '').replace('minecraft:', '')
    return id === stripped || id.includes(stripped)
  })
}

const VALID_CROPS = new Set(['wheat_seeds', 'beetroot_seeds', 'carrot', 'potato'])

// ── Exports ──

export function startFarm(originX, originY, originZ, cropType = 'wheat_seeds') {
  if (_activeFarm) {
    return { success: false, error: 'Already farming. Cancel first.' }
  }

  if (!VALID_CROPS.has(cropType)) {
    return { success: false, error: `Invalid crop type: "${cropType}". Use: wheat_seeds, beetroot_seeds, carrot, potato` }
  }

  const positions = generateFarmPositions(originX, originY, originZ)

  _activeFarm = {
    origin: { x: originX, y: originY, z: originZ },
    phase: 'tilling',
    queue: positions.map(p => ({ ...p })),
    startedAt: Date.now(),
    cropType,
    totalBlocks: positions.length,
    stats: { tilled: 0, planted: 0, harvested: 0 },
  }

  return {
    success: true,
    message: `Started farming. ${positions.length} blocks to till.`,
    totalBlocks: positions.length,
  }
}

export async function resumeFarm(inventory) {
  if (!_activeFarm) return { active: false }

  const farm = _activeFarm

  // ── Tilling phase ──
  if (farm.phase === 'tilling') {
    const hoe = findHoe(inventory)
    if (!hoe) {
      return {
        active: true,
        paused: true,
        phase: 'tilling',
        missingItems: ['wooden_hoe'],
        tilled: farm.stats.tilled,
        total: farm.totalBlocks,
      }
    }

    // Process up to 2 blocks per tick (equip + interact is heavier)
    const TILL_PER_TICK = 2
    for (let i = 0; i < TILL_PER_TICK; i++) {
      if (farm.queue.length === 0) break

      const pos = farm.queue[0]

      try {
        // Equip hoe then interact to till dirt into farmland
        await executeAction({ type: 'equip', item: hoe })
        const result = await executeAction({ type: 'interact_block', x: pos.x, y: pos.y, z: pos.z })
        if (result && result.success !== false) {
          farm.queue.shift()
          farm.stats.tilled++
        } else {
          // Skip this block on failure — might already be farmland
          farm.queue.shift()
          farm.stats.tilled++
        }
      } catch {
        // Network error — retry next tick
        break
      }
    }

    // Transition to planting when tilling queue exhausted
    if (farm.queue.length === 0) {
      farm.phase = 'planting'
      farm.queue = generateFarmPositions(farm.origin.x, farm.origin.y, farm.origin.z)
    }

    return {
      active: true,
      paused: false,
      phase: farm.phase,
      tilled: farm.stats.tilled,
      total: farm.totalBlocks,
    }
  }

  // ── Planting phase ──
  if (farm.phase === 'planting') {
    if (!hasItem(inventory, farm.cropType)) {
      return {
        active: true,
        paused: true,
        phase: 'planting',
        missingItems: [farm.cropType],
        planted: farm.stats.planted,
        total: farm.totalBlocks,
      }
    }

    // Process up to 3 blocks per tick
    const PLANT_PER_TICK = 3
    for (let i = 0; i < PLANT_PER_TICK; i++) {
      if (farm.queue.length === 0) break

      const pos = farm.queue[0]

      try {
        // Place crop on farmland — place handler targets above the block
        const result = await executeAction({ type: 'place', item: farm.cropType, x: pos.x, y: pos.y, z: pos.z })
        if (result && result.success !== false) {
          farm.queue.shift()
          farm.stats.planted++
        } else {
          // Skip on failure — might be an issue with this particular block
          farm.queue.shift()
          farm.stats.planted++
        }
      } catch {
        break
      }
    }

    // Transition to waiting when planting queue exhausted
    if (farm.queue.length === 0) {
      farm.phase = 'waiting'
      // Farm cycle complete — agent can do other things while crops grow
      _activeFarm = null
      return {
        active: false,
        complete: true,
        phase: 'waiting',
        message: 'Crops planted. Growing... Check back later.',
        planted: farm.stats.planted,
        total: farm.totalBlocks,
      }
    }

    return {
      active: true,
      paused: false,
      phase: farm.phase,
      planted: farm.stats.planted,
      total: farm.totalBlocks,
    }
  }

  // ── Harvesting phase ──
  if (farm.phase === 'harvesting') {
    const HARVEST_PER_TICK = 3
    for (let i = 0; i < HARVEST_PER_TICK; i++) {
      if (farm.queue.length === 0) break

      const pos = farm.queue[0]

      try {
        // Look at crop block then break it
        await executeAction({ type: 'look_at_block', x: pos.x, y: pos.y, z: pos.z })
        const result = await executeAction({ type: 'break_block' })
        if (result && result.success !== false) {
          farm.queue.shift()
          farm.stats.harvested++
        } else {
          farm.queue.shift()
          farm.stats.harvested++
        }
      } catch {
        break
      }
    }

    if (farm.queue.length === 0) {
      const harvested = farm.stats.harvested
      _activeFarm = null
      return { active: false, complete: true, harvested }
    }

    return {
      active: true,
      paused: false,
      phase: 'harvesting',
      harvested: farm.stats.harvested,
      total: farm.totalBlocks,
    }
  }

  return { active: false }
}

export function startHarvest(originX, originY, originZ) {
  if (_activeFarm) {
    return { success: false, error: 'Already farming/harvesting. Cancel first.' }
  }

  // Harvest queue targets crop blocks at y+1 above farmland
  const positions = generateFarmPositions(originX, originY, originZ).map(p => ({
    x: p.x,
    y: p.y + 1,
    z: p.z,
  }))

  _activeFarm = {
    origin: { x: originX, y: originY, z: originZ },
    phase: 'harvesting',
    queue: positions,
    startedAt: Date.now(),
    cropType: 'unknown',
    totalBlocks: positions.length,
    stats: { tilled: 0, planted: 0, harvested: 0 },
  }

  return { success: true, message: 'Harvesting crops.' }
}

export function getFarmProgress() {
  if (!_activeFarm) return ''

  const farm = _activeFarm
  const done = farm.totalBlocks - farm.queue.length

  if (farm.phase === 'tilling') {
    return `FARMING: tilling (${done}/${farm.totalBlocks} blocks)`
  }
  if (farm.phase === 'planting') {
    return `FARMING: planting ${farm.cropType} (${done}/${farm.totalBlocks})`
  }
  if (farm.phase === 'waiting') {
    return 'Crops planted. Growing...'
  }
  if (farm.phase === 'harvesting') {
    return `HARVESTING: ${done}/${farm.totalBlocks} crops collected`
  }
  return ''
}

export function cancelFarm() {
  if (!_activeFarm) {
    return { success: false, message: 'No active farm to cancel.' }
  }
  const summary = {
    success: true,
    message: `Cancelled farming. Phase: ${_activeFarm.phase}. Stats: tilled=${_activeFarm.stats.tilled}, planted=${_activeFarm.stats.planted}, harvested=${_activeFarm.stats.harvested}.`,
  }
  _activeFarm = null
  return summary
}

export function isFarmActive() {
  return _activeFarm !== null
}
