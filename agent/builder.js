// builder.js — Blueprint execution engine: loads blueprints and places blocks layer-by-layer via mod API

import { loadBlueprint, resolvePalette, getBlueprintMaterials } from './blueprints.js'
import { fetchState } from './state.js'

const MOD_URL = process.env.MOD_URL || 'http://localhost:3001'

// ── Module State ──

let _activeBuild = null

// ── Helpers ──

// Strip minecraft: prefix for comparison
function stripPrefix(name) {
  return (name || '').replace(/^minecraft:/, '')
}

// Check if agent has a block in inventory, handling minecraft: prefix
function inventoryHas(inventory, blockName) {
  const stripped = stripPrefix(blockName)
  return inventory.some(i => stripPrefix(i.item || i.name || '') === stripped)
}

// Check if agent is close enough to the build origin to place blocks
async function isNearBuildSite() {
  try {
    const state = await fetchState()
    if (!state.position || !_activeBuild) return true // assume close if we can't check
    const p = state.position
    const o = _activeBuild.origin
    const dist = Math.sqrt((p.x - o.x) ** 2 + (p.y - o.y) ** 2 + (p.z - o.z) ** 2)
    return dist <= 8
  } catch {
    return true // assume close on error
  }
}

// ── Exports ──

export function startBuild(blueprintName, originX, originY, originZ, inventory) {
  if (_activeBuild) {
    return { success: false, error: `Already building ${_activeBuild.blueprintName}. Cancel first.` }
  }

  const blueprint = loadBlueprint(blueprintName)
  if (!blueprint) {
    return { success: false, error: `Unknown blueprint: "${blueprintName}". Use listBlueprints to see available options.` }
  }

  // Extract available block names from inventory
  const availableBlocks = (inventory || []).map(i => stripPrefix(i.item || i.name || ''))

  // Resolve palette — picks best available block for each palette key
  const palette = resolvePalette(blueprint, availableBlocks)

  // Build the block queue: iterate layers bottom-to-top, then row by row (z), then column (x)
  const queue = []
  // Sort layers by y to ensure bottom-to-top
  const sortedLayers = [...blueprint.layers].sort((a, b) => a.y - b.y)

  for (const layer of sortedLayers) {
    for (let row = 0; row < layer.grid.length; row++) {
      const line = layer.grid[row]
      for (let col = 0; col < line.length; col++) {
        const char = line[col]
        // Skip air blocks
        if (char === ' ' || char === '.') continue
        // Skip unknown palette entries
        if (!palette[char]) continue

        queue.push({
          x: originX + col,
          y: originY + layer.y,
          z: originZ + row,
          block: palette[char],
        })
      }
    }
  }

  const totalBlocks = queue.length
  if (totalBlocks === 0) {
    return { success: false, error: 'Blueprint has no blocks to place.' }
  }

  _activeBuild = {
    blueprintName,
    blueprint,
    origin: { x: originX, y: originY, z: originZ },
    palette,
    totalBlocks,
    placedBlocks: 0,
    queue,
    startedAt: Date.now(),
    paused: false,
    missingMaterials: [],
  }

  const materials = Object.fromEntries(getBlueprintMaterials(blueprint))

  return {
    success: true,
    message: `Started building ${blueprintName}. ${totalBlocks} blocks to place.`,
    totalBlocks,
    materials,
  }
}

export async function resumeBuild(inventory) {
  if (!_activeBuild) return { active: false }

  // Check proximity — agent must be within ~8 blocks of build site
  const nearSite = await isNearBuildSite()
  if (!nearSite) {
    _activeBuild.tooFar = true
    const o = _activeBuild.origin
    return {
      active: true,
      paused: false,
      tooFar: true,
      placed: _activeBuild.placedBlocks,
      total: _activeBuild.totalBlocks,
      message: `Too far from build site. Navigate to ${o.x}, ${o.y}, ${o.z} first.`,
    }
  }
  _activeBuild.tooFar = false

  // If paused, re-check inventory — auto-unpause if materials now available
  if (_activeBuild.paused) {
    const stillMissing = _activeBuild.missingMaterials.filter(m => !inventoryHas(inventory, m))
    if (stillMissing.length > 0) {
      _activeBuild.missingMaterials = stillMissing
      return {
        active: true,
        paused: true,
        missingMaterials: stillMissing,
        placed: _activeBuild.placedBlocks,
        total: _activeBuild.totalBlocks,
      }
    }
    // Materials available — unpause
    _activeBuild.paused = false
    _activeBuild.missingMaterials = []
  }

  // Place up to 3 blocks per tick
  const BLOCKS_PER_TICK = 3
  for (let i = 0; i < BLOCKS_PER_TICK; i++) {
    if (_activeBuild.queue.length === 0) {
      // Build complete
      const placed = _activeBuild.totalBlocks
      _activeBuild = null
      return { active: false, complete: true, placed }
    }

    const block = _activeBuild.queue[0]

    // Check if agent has the required block
    if (!inventoryHas(inventory, block.block)) {
      _activeBuild.paused = true
      // Compute all missing materials from remaining queue
      const needed = new Set()
      for (const b of _activeBuild.queue) {
        if (!inventoryHas(inventory, b.block)) {
          needed.add(b.block)
        }
      }
      _activeBuild.missingMaterials = [...needed]
      return {
        active: true,
        paused: true,
        missingMaterials: _activeBuild.missingMaterials,
        placed: _activeBuild.placedBlocks,
        total: _activeBuild.totalBlocks,
      }
    }

    // Send place action to mod
    try {
      const res = await fetch(`${MOD_URL}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'place',
          item: block.block,
          x: block.x,
          y: block.y,
          z: block.z,
        }),
        signal: AbortSignal.timeout(3000),
      })

      if (!res.ok) {
        // Place failed — don't remove from queue, retry next tick
        console.log(`[builder] Place failed at (${block.x},${block.y},${block.z}): HTTP ${res.status}`)
        break
      }

      // Success — remove from queue
      _activeBuild.queue.shift()
      _activeBuild.placedBlocks++
    } catch (err) {
      // Timeout or network error — retry next tick
      console.log(`[builder] Place error at (${block.x},${block.y},${block.z}): ${err.message}`)
      break
    }
  }

  // Check if build completed after placing
  if (_activeBuild && _activeBuild.queue.length === 0) {
    const placed = _activeBuild.totalBlocks
    _activeBuild = null
    return { active: false, complete: true, placed }
  }

  if (!_activeBuild) return { active: false }

  return {
    active: true,
    paused: false,
    placed: _activeBuild.placedBlocks,
    total: _activeBuild.totalBlocks,
    percent: Math.round(100 * _activeBuild.placedBlocks / _activeBuild.totalBlocks),
  }
}

export function getBuildProgress() {
  if (!_activeBuild) return ''
  if (_activeBuild.paused) {
    return `BUILD PAUSED: ${_activeBuild.blueprintName} (${_activeBuild.placedBlocks}/${_activeBuild.totalBlocks} blocks). Need: ${_activeBuild.missingMaterials.join(', ')}. Gather materials and I'll resume automatically.`
  }
  const percent = Math.round(100 * _activeBuild.placedBlocks / _activeBuild.totalBlocks)
  return `BUILDING: ${_activeBuild.blueprintName} (${_activeBuild.placedBlocks}/${_activeBuild.totalBlocks} blocks, ${percent}%). Do not interrupt.`
}

export function cancelBuild() {
  if (!_activeBuild) {
    return { success: false, message: 'No active build to cancel.' }
  }
  const summary = {
    success: true,
    message: `Cancelled building ${_activeBuild.blueprintName}. Placed ${_activeBuild.placedBlocks}/${_activeBuild.totalBlocks} blocks.`,
    placed: _activeBuild.placedBlocks,
    total: _activeBuild.totalBlocks,
  }
  _activeBuild = null
  return summary
}

export function isBuildActive() {
  if (!_activeBuild) return false
  // Paused (need materials) or too far — planner needs to generate actions to fix it
  if (_activeBuild.paused) return false
  if (_activeBuild.tooFar) return false
  return true
}

export function unpauseBuild() {
  if (_activeBuild && _activeBuild.paused) {
    _activeBuild.paused = false
    _activeBuild.missingMaterials = []
  }
}
