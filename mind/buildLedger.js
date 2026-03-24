// buildLedger.js — Shared build project registry with block-level coordinate tracking
// Both agents read/write the same ledger directory so they can collaborate on builds,
// track every placed block by exact coordinates, and resume builds incrementally.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import { randomUUID } from 'crypto'
import { Vec3 } from 'vec3'

// ── Module State ──

let _buildsDir = ''
let _indexFile = ''
let _index = []  // lightweight project listing
let _projectCache = new Map()  // id -> full project (write-through cache)
let _dirty = new Set()  // project IDs that need writing

// ── Internal Helpers ──

function _atomicWrite(filePath, data) {
  const tmp = filePath + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  renameSync(tmp, filePath)
}

function _saveIndex() {
  if (!_indexFile) return
  _atomicWrite(_indexFile, _index)
}

function _saveProject(project) {
  if (!_buildsDir) return
  const filePath = join(_buildsDir, `${project.id}.json`)
  _atomicWrite(filePath, project)
  _dirty.delete(project.id)
}

function _updateIndex(project) {
  const existing = _index.findIndex(p => p.id === project.id)
  const entry = {
    id: project.id,
    name: project.name,
    status: project.status,
    origin: project.origin,
    totalBlocks: project.totalBlocks,
    placedCount: Object.keys(project.placedBlocks || {}).length,
    builders: project.builders,
    updatedAt: project.updatedAt,
  }
  if (existing >= 0) {
    _index[existing] = entry
  } else {
    _index.push(entry)
  }
}

// Expand a blueprint into a map of "x,y,z" -> "block_name"
function _expandBlueprint(blueprint, origin) {
  const expected = {}
  if (!blueprint?.layers || !blueprint?.palette) return expected

  // Resolve palette — use first preferred block from each entry
  const resolvedPalette = {}
  for (const [char, entry] of Object.entries(blueprint.palette)) {
    const preferred = Array.isArray(entry?.preferred) ? entry.preferred : []
    resolvedPalette[char] = preferred[0] || 'cobblestone'
  }

  const sortedLayers = [...blueprint.layers].sort((a, b) => a.y - b.y)

  for (const layer of sortedLayers) {
    for (let row = 0; row < (layer.grid || []).length; row++) {
      const line = layer.grid[row]
      for (let col = 0; col < line.length; col++) {
        const char = line[col]
        if (char === '.' || char === ' ') continue
        if (!resolvedPalette[char]) continue
        const x = origin.x + col
        const y = origin.y + layer.y
        const z = origin.z + row
        expected[`${x},${y},${z}`] = resolvedPalette[char]
      }
    }
  }

  return expected
}

// ── Exported Functions ──

export function initBuildLedger(config) {
  _buildsDir = join(dirname(config.dataDir), 'shared', 'builds')
  _indexFile = join(_buildsDir, 'index.json')
  mkdirSync(_buildsDir, { recursive: true })

  // Load index
  if (existsSync(_indexFile)) {
    try {
      _index = JSON.parse(readFileSync(_indexFile, 'utf-8'))
    } catch {
      _index = []
    }
  }
  console.log(`[ledger] initialized — ${_index.length} projects`)
}

export function createProject(name, description, origin, blueprint, builder) {
  const id = randomUUID().slice(0, 8)
  const expectedBlocks = _expandBlueprint(blueprint, origin)
  const now = new Date().toISOString()

  const project = {
    id,
    name: name || 'unnamed',
    description: description || '',
    origin: { x: origin.x, y: origin.y, z: origin.z },
    blueprint,
    status: 'in_progress',
    builders: [builder],
    createdAt: now,
    updatedAt: now,
    totalBlocks: Object.keys(expectedBlocks).length,
    expectedBlocks,
    placedBlocks: {},
  }

  _projectCache.set(id, project)
  _updateIndex(project)
  _saveProject(project)
  _saveIndex()

  console.log(`[ledger] created project ${id}: "${name}" (${project.totalBlocks} blocks)`)
  return project
}

export function getProject(id) {
  if (!id) return null

  // Check cache first
  if (_projectCache.has(id)) return _projectCache.get(id)

  // Load from disk
  if (!_buildsDir) return null
  const filePath = join(_buildsDir, `${id}.json`)
  try {
    const project = JSON.parse(readFileSync(filePath, 'utf-8'))
    _projectCache.set(id, project)
    return project
  } catch {
    return null
  }
}

export function listProjects(statusFilter) {
  if (statusFilter) {
    return _index.filter(p => p.status === statusFilter)
  }
  return _index
}

export function recordPlacement(id, x, y, z, block, builder) {
  const project = getProject(id)
  if (!project) return

  const key = `${x},${y},${z}`
  project.placedBlocks[key] = { block, by: builder, ts: Date.now() }
  project.updatedAt = new Date().toISOString()
  _dirty.add(id)

  // Save every 5 placements to reduce disk writes
  const placedCount = Object.keys(project.placedBlocks).length
  if (placedCount % 5 === 0) {
    _saveProject(project)
    _updateIndex(project)
    _saveIndex()
  }
}

export function getRemaining(id) {
  const project = getProject(id)
  if (!project) return []

  const remaining = []
  for (const [key, block] of Object.entries(project.expectedBlocks)) {
    if (!project.placedBlocks[key]) {
      const [x, y, z] = key.split(',').map(Number)
      remaining.push({ x, y, z, block })
    }
  }
  return remaining
}

export function getMissingMaterials(id, inventory) {
  const remaining = getRemaining(id)
  if (remaining.length === 0) return {}

  // Count needed blocks
  const needed = {}
  for (const { block } of remaining) {
    needed[block] = (needed[block] || 0) + 1
  }

  // Count inventory
  const have = {}
  for (const item of (inventory || [])) {
    if (item.name && item.count > 0) {
      have[item.name] = (have[item.name] || 0) + item.count
    }
  }

  // Compute gap
  const gap = {}
  for (const [block, count] of Object.entries(needed)) {
    const deficit = count - (have[block] || 0)
    if (deficit > 0) gap[block] = deficit
  }

  return gap
}

export function isCoordClaimed(x, y, z) {
  const key = `${x},${y},${z}`
  for (const entry of _index) {
    if (entry.status === 'complete') continue
    const project = getProject(entry.id)
    if (project?.expectedBlocks?.[key]) return entry.id
  }
  return null
}

export function joinProject(id, agentName) {
  const project = getProject(id)
  if (!project) return
  if (!project.builders.includes(agentName)) {
    project.builders.push(agentName)
    project.updatedAt = new Date().toISOString()
    _updateIndex(project)
    _saveProject(project)
    _saveIndex()
    console.log(`[ledger] ${agentName} joined project ${id}`)
  }
}

export function completeProject(id) {
  const project = getProject(id)
  if (!project) return
  project.status = 'complete'
  project.updatedAt = new Date().toISOString()
  _updateIndex(project)
  _saveProject(project)
  _saveIndex()
  console.log(`[ledger] project ${id} "${project.name}" marked complete`)
}

export function getLedgerForPrompt() {
  const active = _index.filter(p => p.status !== 'complete')
  const complete = _index.filter(p => p.status === 'complete')
  if (active.length === 0 && complete.length === 0) return ''

  const lines = ['## Active Build Projects']

  for (const p of active) {
    const pct = p.totalBlocks > 0 ? Math.round(100 * p.placedCount / p.totalBlocks) : 0
    const builders = p.builders.join('+')
    lines.push(`- ${p.name} (id:${p.id}) at ${p.origin.x},${p.origin.y},${p.origin.z} — ${pct}% (${builders})`)
  }

  if (complete.length > 0) {
    const recent = complete.slice(-5)
    lines.push(`Completed: ${recent.map(p => p.name).join(', ')}`)
  }

  return lines.join('\n')
}

export function saveLedger() {
  // Flush all dirty projects
  for (const id of _dirty) {
    const project = _projectCache.get(id)
    if (project) _saveProject(project)
  }
  _dirty.clear()

  // Rebuild index from cache to ensure consistency
  for (const [id, project] of _projectCache) {
    _updateIndex(project)
  }
  _saveIndex()
}

// ── Terrain Survey ──

// Scan the build site terrain and return structured data for the design prompt.
// Uses bot.blockAt() which reads from mineflayer's chunk cache — fast, no HTTP.
export function surveyBuildSite(bot, originX, originZ, width, depth) {
  width = Math.min(width || 16, 20)
  depth = Math.min(depth || 16, 20)

  const heightmap = []
  const surfaceCounts = {}
  const features = []
  let minY = 256, maxY = -64, totalY = 0, count = 0

  for (let dx = 0; dx < width; dx++) {
    const row = []
    for (let dz = 0; dz < depth; dz++) {
      const wx = originX + dx
      const wz = originZ + dz

      // Find surface: scan down from Y=100 to find first non-air block
      let surfaceY = 64
      let surfaceBlock = 'grass_block'
      for (let y = 100; y >= 0; y--) {
        const block = bot.blockAt(new Vec3(wx, y, wz))
        if (block && block.name !== 'air' && block.name !== 'void_air' && block.name !== 'cave_air') {
          surfaceY = y
          surfaceBlock = block.name
          break
        }
      }

      row.push(surfaceY)
      surfaceCounts[surfaceBlock] = (surfaceCounts[surfaceBlock] || 0) + 1
      if (surfaceY < minY) minY = surfaceY
      if (surfaceY > maxY) maxY = surfaceY
      totalY += surfaceY
      count++

      // Detect features at this position
      // Trees: log block with leaves above
      const above1 = bot.blockAt(new Vec3(wx, surfaceY + 1, wz))
      const above3 = bot.blockAt(new Vec3(wx, surfaceY + 3, wz))
      if (above1?.name?.includes('log') || (above1?.name?.includes('log') && above3?.name?.includes('leaves'))) {
        features.push({ type: 'tree', x: wx, z: wz, description: `tree at +${dx},+${dz}` })
      }
      // Water
      if (surfaceBlock === 'water') {
        features.push({ type: 'water', x: wx, z: wz, description: `water at +${dx},+${dz}` })
      }
    }
    heightmap.push(row)
  }

  const avgY = Math.round(totalY / count)
  const elevation = maxY - minY

  let slope = 'flat'
  if (elevation >= 8) slope = 'cliff'
  else if (elevation >= 4) slope = 'steep'
  else if (elevation >= 2) slope = 'gentle'

  // Deduplicate features (only keep unique types per 4x4 area)
  const uniqueFeatures = []
  const seen = new Set()
  for (const f of features) {
    const areaKey = `${f.type}-${Math.floor(f.x / 4)}-${Math.floor(f.z / 4)}`
    if (!seen.has(areaKey)) {
      seen.add(areaKey)
      uniqueFeatures.push(f)
    }
  }

  // Build compact summary for LLM
  const surfaceTop3 = Object.entries(surfaceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, cnt]) => `${name}*${cnt}`)
    .join(', ')

  const featureStr = uniqueFeatures.length > 0
    ? uniqueFeatures.slice(0, 5).map(f => f.description).join(', ')
    : 'none'

  const summary = `Terrain: ${slope} (Y ${minY}-${maxY}, avg ${avgY}). Surface: ${surfaceTop3}. Features: ${featureStr}. Area: ${width}x${depth}.`

  return {
    heightmap,
    surfaceBlocks: surfaceCounts,
    features: uniqueFeatures,
    slopeAssessment: { minY, maxY, avgY, slope, elevation },
    summary,
  }
}
