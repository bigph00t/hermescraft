// build.js — Build structures from blueprint JSON plans with verified placement

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import minecraftData from 'minecraft-data'
import { Vec3 } from 'vec3'
import { placeBlock } from '../place.js'
import { navigateTo } from '../navigate.js'
import { isInterrupted } from '../interrupt.js'

const mcData = minecraftData('1.21.1')
const __dirname = dirname(fileURLToPath(import.meta.url))
const BLUEPRINTS_DIR = join(__dirname, '..', 'blueprints')

// ── Module State ──

let _stateFile = ''
let _activeBuild = null
// Full block queue for the current build — needed by updatePalette to remap remaining entries
let _buildQueue = []

// ── Helpers ──

function _saveState() {
  try {
    writeFileSync(_stateFile, JSON.stringify(_activeBuild, null, 2))
  } catch (err) {
    console.log(`[build] warn: failed to save state: ${err.message}`)
  }
}

// ── Exports ──

/**
 * Initialize the build skill. Must be called before any other build function.
 * Loads any persisted build state from disk so cross-session resume works.
 *
 * @param {{ dataDir: string }} config
 */
export function initBuild(config) {
  _stateFile = join(config.dataDir, 'build_state.json')
  if (existsSync(_stateFile)) {
    try {
      _activeBuild = JSON.parse(readFileSync(_stateFile, 'utf-8'))
      console.log(`[build] Resumed build state: ${_activeBuild?.blueprintName}`)
    } catch {
      _activeBuild = null
    }
  }
}

/**
 * List all available blueprints with their name, description, and size.
 *
 * @returns {{ name: string, description: string, size: object }[]}
 */
export function listBlueprints() {
  try {
    const files = readdirSync(BLUEPRINTS_DIR)
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const bp = JSON.parse(readFileSync(join(BLUEPRINTS_DIR, f), 'utf-8'))
          return { name: bp.name, description: bp.description, size: bp.size }
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Returns the current active build state, or null if no build is in progress.
 *
 * @returns {object|null}
 */
export function getActiveBuild() {
  return _activeBuild
}

/**
 * Returns a human-readable string for prompt injection describing build progress.
 * Empty string if no active build.
 *
 * @returns {string}
 */
export function getBuildProgress() {
  if (!_activeBuild) return ''
  const { blueprintName, completedIndex, totalBlocks, paused, missingMaterials } = _activeBuild
  if (paused) {
    const missing = (missingMaterials || []).join(', ')
    return `BUILD PAUSED: ${blueprintName} (${completedIndex}/${totalBlocks}). Need: ${missing}`
  }
  const percent = totalBlocks > 0 ? Math.round(100 * completedIndex / totalBlocks) : 0
  return `BUILDING: ${blueprintName} (${completedIndex}/${totalBlocks}, ${percent}%)`
}

/**
 * Build a structure from a named blueprint starting at the given world coordinates.
 * Executes the entire placement queue in a cooperative interrupt loop.
 *
 * Supports cross-session resume: if a previous build for the same blueprint and
 * origin exists in state, picks up from where it left off.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {string} blueprintName — name key (e.g. 'small_cabin', 'watchtower')
 * @param {number} originX
 * @param {number} originY
 * @param {number} originZ
 * @param {string} [blueprintPath] — optional direct file path (used by buildPlanner section execution)
 * @returns {Promise<{success: boolean, placed?: number, total?: number, blueprintName?: string, reason?: string, missing?: string[], message?: string, failedPlacements?: object[]}>}
 */
export async function build(bot, blueprintName, originX, originY, originZ, blueprintPath, options = {}) {
  // options.skipOnMissing: boolean  — skip blocks with missing materials instead of stopping
  // options.onBlockPlaced: (x, y, z, block, builder) => void  — callback after each successful placement
  // options.getPlacedBlocks: () => Set<string>  — returns "x,y,z" keys already placed (for ledger resume)
  // options.maxBlocks: number — max blocks to place per call (0 = unlimited). Enables atomic build loop.
  const { skipOnMissing = false, onBlockPlaced = null, getPlacedBlocks = null, maxBlocks = 0 } = options
  // ── Resume check ──
  // If there's an active paused build, resume it instead of starting fresh.
  // Prevents building the same structure multiple times at different offsets.
  let isResume = false
  if (_activeBuild && _activeBuild.paused && _activeBuild.completedIndex > 0
      && _activeBuild.completedIndex < _activeBuild.totalBlocks) {
    console.log(`[build] resuming paused build: ${_activeBuild.blueprintName} at ${_activeBuild.completedIndex}/${_activeBuild.totalBlocks}`)
    blueprintName = _activeBuild.blueprintName
    originX = _activeBuild.origin.x
    originY = _activeBuild.origin.y
    originZ = _activeBuild.origin.z
    isResume = true
  } else if (_activeBuild && !_activeBuild.paused) {
    // Previous build completed — clear it so new builds aren't blocked
    _activeBuild = null
    _buildQueue = []
    console.log('[build] cleared completed build state')
  }

  // ── Load Blueprint ──
  // If a direct blueprint path is provided (from buildPlanner section execution),
  // use it instead of resolving against BLUEPRINTS_DIR
  let blueprintFile
  if (blueprintPath && existsSync(blueprintPath)) {
    blueprintFile = blueprintPath
  } else {
    // Try both with and without underscores since callers may use either form
    blueprintFile = join(BLUEPRINTS_DIR, blueprintName + '.json')
    if (!existsSync(blueprintFile)) {
      // Try converting name to kebab-case filename (small_cabin -> small-cabin)
      const kebab = blueprintName.replace(/_/g, '-')
      blueprintFile = join(BLUEPRINTS_DIR, kebab + '.json')
    }
  }

  let blueprint
  try {
    blueprint = JSON.parse(readFileSync(blueprintFile, 'utf-8'))
  } catch {
    return { success: false, reason: 'unknown_blueprint', message: `Blueprint "${blueprintName}" not found in ${BLUEPRINTS_DIR}` }
  }

  // ── Resolve Palette ──
  // For each palette key, find first preferred block the bot has in inventory.
  // Fallback to first preferred, then 'cobblestone'.
  const resolvedPalette = {}
  for (const [char, entry] of Object.entries(blueprint.palette)) {
    const preferred = entry.preferred || []
    let resolved = null
    for (const name of preferred) {
      const itemMeta = mcData.itemsByName[name]
      if (itemMeta && bot.inventory.findInventoryItem(itemMeta.id, null)) {
        resolved = name
        break
      }
    }
    resolvedPalette[char] = resolved || preferred[0] || 'cobblestone'
  }

  // ── Build Block Queue ──
  // Sort layers by y ascending (bottom-to-top), then row (z), then col (x).
  const sortedLayers = [...blueprint.layers].sort((a, b) => a.y - b.y)
  const queue = []
  for (const layer of sortedLayers) {
    for (let row = 0; row < layer.grid.length; row++) {
      const line = layer.grid[row]
      for (let col = 0; col < line.length; col++) {
        const char = line[col]
        if (char === '.' || char === ' ') continue
        if (!resolvedPalette[char]) continue
        queue.push({
          x: originX + col,
          y: originY + layer.y,
          z: originZ + row,
          block: resolvedPalette[char],
        })
      }
    }
  }

  if (queue.length === 0) {
    return { success: false, reason: 'empty_queue', message: 'Blueprint has no blocks to place after palette resolution' }
  }

  // Store full queue in module state so updatePalette can remap remaining entries
  _buildQueue = queue

  // ── Resume Support ──
  // If we have a saved state matching this blueprint+origin, resume from completedIndex.
  // Filter queue entries already present in the world.
  let startIndex = 0
  if (
    _activeBuild &&
    _activeBuild.blueprintName === blueprintName &&
    _activeBuild.origin?.x === originX &&
    _activeBuild.origin?.y === originY &&
    _activeBuild.origin?.z === originZ
  ) {
    startIndex = _activeBuild.completedIndex || 0
    console.log(`[build] Resuming "${blueprintName}" from block ${startIndex}/${queue.length}`)
  }

  // Also skip already-placed blocks in the remaining queue.
  // When ledger-backed (getPlacedBlocks provided), filter against the shared placed set
  // so partner's placements are skipped even if they happened out of order.
  const placedSet = getPlacedBlocks ? getPlacedBlocks() : null
  const remainingQueue = queue.slice(startIndex).filter(entry => {
    // Check ledger first (shared across agents)
    if (placedSet) {
      const key = `${entry.x},${entry.y},${entry.z}`
      if (placedSet.has(key)) return false
    }
    // Then check world state
    const existing = bot.blockAt(new Vec3(entry.x, entry.y, entry.z))
    return !existing || existing.name === 'air'
  })

  // ── Save Initial State ──
  _activeBuild = {
    blueprintName,
    origin: { x: originX, y: originY, z: originZ },
    totalBlocks: queue.length,
    completedIndex: startIndex,
    paused: false,
    missingMaterials: [],
    startedAt: Date.now(),
    // resolvedPalette stored so updatePalette can remap mid-build material changes
    resolvedPalette,
  }
  _saveState()

  // ── Placement Loop ──
  let totalPlaced = startIndex
  let saveCounter = 0
  const failedPlacements = []
  const skippedBlocks = []  // blocks skipped due to missing materials

  let blocksThisCall = 0
  for (let i = 0; i < remainingQueue.length; i++) {
    // Check interrupt before every block
    if (isInterrupted(bot)) {
      _activeBuild.completedIndex = totalPlaced
      _saveState()
      return { success: false, reason: 'interrupted', placed: totalPlaced, total: queue.length }
    }
    // Atomic build: place maxBlocks then return with progress so agent can think/chat
    if (maxBlocks > 0 && blocksThisCall >= maxBlocks) {
      _activeBuild.completedIndex = totalPlaced
      _activeBuild.paused = true  // MUST be true so next call resumes instead of clearing
      _saveState()
      const pct = Math.round(100 * totalPlaced / queue.length)
      return { success: true, placed: totalPlaced, total: queue.length, partial: true, reason: `placed ${blocksThisCall} blocks (${totalPlaced}/${queue.length} = ${pct}%) — use !build to continue` }
    }

    const entry = remainingQueue[i]

    // ── Inventory Check ──
    const itemMeta = mcData.itemsByName[entry.block]
    const inInventory = itemMeta ? bot.inventory.findInventoryItem(itemMeta.id, null) : null
    if (!inInventory) {
      if (skipOnMissing) {
        // Skip this block — agent will gather materials and resume later
        skippedBlocks.push(entry)
        continue
      }
      // Legacy behavior: stop on first missing material
      const missingSet = new Set()
      for (let j = i; j < remainingQueue.length; j++) {
        const rem = remainingQueue[j]
        const meta = mcData.itemsByName[rem.block]
        if (!meta || !bot.inventory.findInventoryItem(meta.id, null)) {
          missingSet.add(rem.block)
        }
      }
      _activeBuild.completedIndex = totalPlaced
      _activeBuild.paused = true
      _activeBuild.missingMaterials = [...missingSet]
      _saveState()
      return {
        success: false,
        reason: 'missing_material',
        missing: [...missingSet],
        placed: totalPlaced,
        total: queue.length,
        message: `Need: ${[...missingSet].join(', ')}`,
      }
    }

    // ── Navigate to Block Position ──
    const nav = await navigateTo(bot, entry.x, entry.y, entry.z, 3, 15000)

    if (isInterrupted(bot)) {
      _activeBuild.completedIndex = totalPlaced
      _saveState()
      return { success: false, reason: 'interrupted', placed: totalPlaced, total: queue.length }
    }

    if (!nav.success) {
      // Block unreachable — skip and continue (terrain may block)
      console.log(`[build] nav failed for (${entry.x},${entry.y},${entry.z}): ${nav.reason}, skipping`)
      failedPlacements.push({ x: entry.x, y: entry.y, z: entry.z, block: entry.block, reason: 'nav_failed' })
      totalPlaced++
      _activeBuild.completedIndex = totalPlaced
      continue
    }

    // ── Equip Block in Hand ──
    // Re-fetch Item object from inventory — equipping by Item is more reliable than by ID
    // because mineflayer matches the exact slot, avoiding stale-reference issues.
    const blockItem = bot.inventory.findInventoryItem(itemMeta.id, null)
    try {
      await bot.equip(blockItem || itemMeta.id, 'hand')
    } catch (err) {
      console.log(`[build] equip failed for ${entry.block}: ${err.message}`)
    }

    if (isInterrupted(bot)) {
      _activeBuild.completedIndex = totalPlaced
      _saveState()
      return { success: false, reason: 'interrupted', placed: totalPlaced, total: queue.length }
    }

    // ── Find Reference Block ──
    // Check adjacent positions for a solid block to place against.
    const adjacents = [
      { rx: entry.x, ry: entry.y - 1, rz: entry.z },  // below (most common)
      { rx: entry.x - 1, ry: entry.y, rz: entry.z },   // west
      { rx: entry.x + 1, ry: entry.y, rz: entry.z },   // east
      { rx: entry.x, ry: entry.y, rz: entry.z - 1 },   // north
      { rx: entry.x, ry: entry.y, rz: entry.z + 1 },   // south
    ]

    let refBlock = null
    let faceVector = null
    for (const adj of adjacents) {
      const candidate = bot.blockAt(new Vec3(adj.rx, adj.ry, adj.rz))
      if (candidate && candidate.name !== 'air') {
        refBlock = candidate
        faceVector = new Vec3(entry.x - adj.rx, entry.y - adj.ry, entry.z - adj.rz)
        break
      }
    }

    if (!refBlock) {
      // No solid neighbor — skip this block (floating, will be placed when neighbors exist)
      console.log(`[build] no reference block for (${entry.x},${entry.y},${entry.z}), skipping`)
      failedPlacements.push({ x: entry.x, y: entry.y, z: entry.z, block: entry.block, reason: 'no_reference_block' })
      totalPlaced++
      _activeBuild.completedIndex = totalPlaced
      continue
    }

    // ── Place Block ── (face the reference block first — ensures directional blocks orient correctly)
    await bot.lookAt(refBlock.position, true)
    const placed = await placeBlock(bot, refBlock, faceVector)

    if (isInterrupted(bot)) {
      _activeBuild.completedIndex = totalPlaced
      _saveState()
      return { success: false, reason: 'interrupted', placed: totalPlaced, total: queue.length }
    }

    if (placed.success) {
      totalPlaced++
      blocksThisCall++
      _activeBuild.completedIndex = totalPlaced
      saveCounter++
      // Save state every 5 blocks to reduce disk writes
      if (saveCounter % 5 === 0) {
        _saveState()
      }
      // Notify ledger of placement (if callback provided)
      if (onBlockPlaced) {
        try { onBlockPlaced(entry.x, entry.y, entry.z, entry.block, bot.username) } catch {}
      }
      console.log(`[build] ${totalPlaced}/${queue.length} ${entry.block} at (${entry.x},${entry.y},${entry.z})`)
    } else {
      console.log(`[build] place failed at (${entry.x},${entry.y},${entry.z}): ${placed.reason}, skipping`)
      failedPlacements.push({ x: entry.x, y: entry.y, z: entry.z, block: entry.block, reason: placed.reason || 'place_failed' })
      totalPlaced++
      _activeBuild.completedIndex = totalPlaced
    }
  }

  // ── Partial Completion (skip-on-missing mode) ──
  // If blocks were skipped due to missing materials, return partial result
  if (skippedBlocks.length > 0) {
    const missingSet = new Set(skippedBlocks.map(b => b.block))
    _activeBuild.completedIndex = totalPlaced
    _activeBuild.paused = true
    _activeBuild.missingMaterials = [...missingSet]
    _saveState()
    return {
      success: true,
      partial: true,
      placed: totalPlaced,
      remaining: skippedBlocks.length,
      total: queue.length,
      missingMaterials: [...missingSet],
      blueprintName,
      failedPlacements,
      message: `Placed ${totalPlaced - startIndex} blocks. ${skippedBlocks.length} remaining — need: ${[...missingSet].join(', ')}`,
    }
  }

  // ── Auto-Torch Interior ──
  try {
    const torchMeta = mcData.itemsByName['torch']
    const torchItem = torchMeta ? bot.inventory.findInventoryItem(torchMeta.id, null) : null
    if (torchItem && blueprint.size) {
      let torchesPlaced = 0
      for (let dx = 1; dx < blueprint.size.x - 1; dx += 4) {
        for (let dz = 1; dz < blueprint.size.z - 1; dz += 4) {
          const tx = originX + dx, ty = originY + 1, tz = originZ + dz
          const floor = bot.blockAt(new Vec3(tx, ty - 1, tz))
          const spot = bot.blockAt(new Vec3(tx, ty, tz))
          const above = bot.blockAt(new Vec3(tx, ty + 1, tz))
          if (floor && floor.name !== 'air' && spot && spot.name === 'air' && above && above.name === 'air') {
            try {
              const t = bot.inventory.findInventoryItem(torchMeta.id, null)
              if (!t) break
              await bot.equip(t, 'hand')
              await bot.lookAt(floor.position, true)
              await placeBlock(bot, floor, new Vec3(0, 1, 0))
              torchesPlaced++
            } catch { /* non-fatal */ }
          }
          if (torchesPlaced >= 8) break
        }
        if (torchesPlaced >= 8) break
      }
      if (torchesPlaced > 0) console.log(`[build] placed ${torchesPlaced} torches inside`)
    }
  } catch { /* torch placement is non-fatal */ }

  // ── Completion ──
  _activeBuild = null
  _buildQueue = []
  try {
    if (existsSync(_stateFile)) unlinkSync(_stateFile)
  } catch {}

  return { success: true, placed: totalPlaced, total: queue.length, blueprintName, failedPlacements }
}

/**
 * Swap one block material for another in the remaining build queue mid-build.
 *
 * Remaps every remaining queue entry whose .block matches oldBlock to newBlock.
 * Also updates the resolvedPalette in _activeBuild so the change is reflected
 * in saved state and future getBuildProgress() calls.
 *
 * @param {string} oldBlock - current block name in active palette (e.g. 'cobblestone')
 * @param {string} newBlock - replacement block name (e.g. 'stone_bricks')
 * @returns {{ success: true, old: string, new: string }
 *         | { success: false, reason: string }}
 */
export function updatePalette(oldBlock, newBlock) {
  if (!_activeBuild) return { success: false, reason: 'no_active_build' }
  if (!_activeBuild.resolvedPalette) return { success: false, reason: 'no_palette_data' }

  // Validate newBlock exists in minecraft-data
  if (!mcData.blocksByName[newBlock]) {
    return { success: false, reason: `unknown_block: ${newBlock}` }
  }

  // Find palette char(s) that map to oldBlock and remap to newBlock
  let found = false
  for (const [char, blockName] of Object.entries(_activeBuild.resolvedPalette)) {
    if (blockName === oldBlock) {
      _activeBuild.resolvedPalette[char] = newBlock
      found = true
      // Don't break — multiple chars might use the same block
    }
  }
  if (!found) return { success: false, reason: `"${oldBlock}" not found in active build palette` }

  // Remap remaining queue entries (from completedIndex onward)
  const startIdx = _activeBuild.completedIndex || 0
  for (let i = startIdx; i < _buildQueue.length; i++) {
    if (_buildQueue[i].block === oldBlock) {
      _buildQueue[i].block = newBlock
    }
  }

  _saveState()
  return { success: true, old: oldBlock, new: newBlock }
}
