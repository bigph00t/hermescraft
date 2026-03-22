// locations.js — Named location memory
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

let LOCATIONS_FILE = '';
let locations = {};
// Resource patches: typed world features (ore veins, tree clusters, build sites, etc.)
let resources = {};

const VALID_RESOURCE_TYPES = new Set(['ore_vein', 'tree_cluster', 'build_site', 'chest', 'poi'])

// ── Helpers ──

function horizDist(ax, az, bx, bz) {
  const dx = ax - bx
  const dz = az - bz
  return Math.sqrt(dx * dx + dz * dz)
}

function cardinalDir(dx, dz) {
  if (Math.abs(dx) >= Math.abs(dz)) {
    return dx >= 0 ? 'E' : 'W'
  }
  return dz >= 0 ? 'S' : 'N'
}

export function initLocations(agentConfig) {
  LOCATIONS_FILE = join(agentConfig.dataDir, 'locations.json');
  const dir = dirname(LOCATIONS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (existsSync(LOCATIONS_FILE)) {
    try {
      const raw = JSON.parse(readFileSync(LOCATIONS_FILE, 'utf-8'));
      // Extract _resources sub-key before populating locations
      if (raw._resources && typeof raw._resources === 'object') {
        resources = raw._resources;
        delete raw._resources;
      } else {
        resources = {};
      }
      locations = raw;
    } catch {
      locations = {};
      resources = {};
    }
  }
}

export function saveLocation(name, x, y, z, type = 'custom') {
  locations[name] = { x: Math.round(x), y: Math.round(y), z: Math.round(z), type, saved: new Date().toISOString() };
}

export function setHome(x, y, z) {
  locations['home'] = {
    x: Math.round(x),
    y: Math.round(y),
    z: Math.round(z),
    type: 'home',
    saved: new Date().toISOString(),
  };
  saveLocations();
}

export function getHome() {
  const home = locations['home'];
  if (!home) return null;
  return { x: home.x, y: home.y, z: home.z };
}

export function autoDetectLocations(state) {
  // Auto-save significant locations from nearby blocks
  const blocks = state.nearbyBlocks || [];
  const pos = state.position;
  if (!pos) return;

  for (const b of blocks) {
    const blockName = (b.block || '').replace('minecraft:', '');
    if (blockName === 'bed' && !locations['bed']) {
      saveLocation('bed', b.x, b.y, b.z, 'bed');
    }
    // Auto-detect home on first bed (D-08)
    if (blockName === 'bed' && !locations['home']) {
      setHome(b.x, b.y, b.z);
      console.log(`[Locations] Auto-detected home at (${b.x}, ${b.y}, ${b.z})`);
    }
    // Auto-detect home on first door (shelter indicator)
    if (blockName.endsWith('_door') && !locations['home']) {
      setHome(b.x, b.y, b.z);
      console.log(`[Locations] Auto-detected home at (${b.x}, ${b.y}, ${b.z})`);
    }
    if (blockName === 'chest' && !locations['storage']) {
      saveLocation('storage', b.x, b.y, b.z, 'chest');
    }
  }

  // Auto-detect resource patches from surfaceBlocks
  const surface = state.surfaceBlocks || [];
  if (surface.length === 0) return;

  const ORE_BLOCKS = new Set([
    'iron_ore', 'coal_ore', 'gold_ore', 'diamond_ore',
    'copper_ore', 'lapis_ore', 'redstone_ore', 'emerald_ore',
    'deepslate_iron_ore', 'deepslate_coal_ore', 'deepslate_gold_ore',
    'deepslate_diamond_ore', 'deepslate_copper_ore', 'deepslate_lapis_ore',
    'deepslate_redstone_ore', 'deepslate_emerald_ore',
  ]);
  const LOG_SUFFIX = '_log';

  // Count block types in surfaceBlocks
  const oreCounts = {};
  const logCounts = {};
  for (const b of surface) {
    const bn = (b.block || '').replace('minecraft:', '');
    if (ORE_BLOCKS.has(bn)) {
      oreCounts[bn] = (oreCounts[bn] || 0) + 1;
    }
    if (bn.endsWith(LOG_SUFFIX)) {
      logCounts[bn] = (logCounts[bn] || 0) + 1;
    }
  }

  // Save ore veins (2+ of same ore type)
  for (const [blockType, count] of Object.entries(oreCounts)) {
    if (count < 2) continue;
    // Deduplicate: skip if a same-type resource entry already exists within 15 blocks
    const alreadyNear = Object.values(resources).some(r =>
      r.type === 'ore_vein' && r.metadata && r.metadata.blockType === blockType &&
      horizDist(pos.x, pos.z, r.x, r.z) <= 15
    );
    if (alreadyNear) continue;
    const base = blockType.replace('_ore', '').replace('deepslate_', '');
    const existingNums = Object.keys(resources)
      .filter(k => k.startsWith(`${base}_vein_`))
      .map(k => parseInt(k.split('_').pop(), 10))
      .filter(n => !isNaN(n));
    const nextN = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    saveResourcePatch(`${base}_vein_${nextN}`, 'ore_vein', pos.x, pos.y, pos.z, { blockType, count });
  }

  // Save tree clusters (3+ of same log type)
  for (const [blockType, count] of Object.entries(logCounts)) {
    if (count < 3) continue;
    const alreadyNear = Object.values(resources).some(r =>
      r.type === 'tree_cluster' && r.metadata && r.metadata.blockType === blockType &&
      horizDist(pos.x, pos.z, r.x, r.z) <= 15
    );
    if (alreadyNear) continue;
    const treeName = blockType.replace('_log', '');
    const existingNums = Object.keys(resources)
      .filter(k => k.startsWith(`${treeName}_cluster_`))
      .map(k => parseInt(k.split('_').pop(), 10))
      .filter(n => !isNaN(n));
    const nextN = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    saveResourcePatch(`${treeName}_cluster_${nextN}`, 'tree_cluster', pos.x, pos.y, pos.z, { blockType, count });
  }
}

export function getLocationsForPrompt(position) {
  let entries = Object.entries(locations);
  if (entries.length === 0) return '';

  if (position) {
    // Filter to within 150 blocks (horizontal), sort by distance, cap at 10
    entries = entries
      .map(([name, loc]) => {
        const dist = horizDist(position.x, position.z, loc.x, loc.z)
        return { name, loc, dist }
      })
      .filter(e => e.dist <= 150)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10)
      .map(e => [e.name, e.loc])
  }

  if (entries.length === 0) return '';
  const lines = entries.map(([name, loc]) => `${name}: (${loc.x}, ${loc.y}, ${loc.z})`);
  return 'Known locations: ' + lines.join(', ');
}

export function recordDeathLocation(x, y, z, cause, lesson) {
  // Find existing danger entries
  const dangerKeys = Object.keys(locations).filter(k => k.startsWith('danger-'))

  // Cap at 10 — remove oldest if at limit
  if (dangerKeys.length >= 10) {
    const oldest = dangerKeys
      .map(k => ({ key: k, saved: locations[k].saved || '' }))
      .sort((a, b) => a.saved.localeCompare(b.saved))
    delete locations[oldest[0].key]
  }

  // Determine next danger index
  const existingNums = Object.keys(locations)
    .filter(k => k.startsWith('danger-'))
    .map(k => parseInt(k.split('-')[1], 10))
    .filter(n => !isNaN(n))
  const nextN = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1

  locations[`danger-${nextN}`] = {
    x: Math.round(x),
    y: Math.round(y),
    z: Math.round(z),
    type: 'danger',
    cause,
    lesson,
    saved: new Date().toISOString(),
  }

  saveLocations()
}

export function getNearbyDangers(position, radius = 30) {
  if (!position) return []

  const results = []
  for (const [name, loc] of Object.entries(locations)) {
    if (loc.type !== 'danger') continue
    const dx = position.x - loc.x
    const dy = position.y - loc.y
    const dz = position.z - loc.z
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (distance <= radius) {
      results.push({ name, x: loc.x, y: loc.y, z: loc.z, cause: loc.cause, lesson: loc.lesson, distance })
    }
  }
  return results
}

export function saveLocations() {
  try {
    // Merge _resources into the JSON under _resources key
    const toWrite = Object.assign({}, locations, { _resources: resources })
    writeFileSync(LOCATIONS_FILE, JSON.stringify(toWrite, null, 2));
  } catch {}
}

// ── Exploration Tracking ──

/**
 * Determine which cardinal direction the agent has explored least.
 * Looks at all saved locations (excluding danger zones) and counts
 * locations per quadrant relative to home (or currentPos if no home).
 * Returns { direction: 'north'|'south'|'east'|'west', count: number }
 */
export function getUnexploredDirection(currentPos) {
  const home = locations['home']
  const origin = home || currentPos || { x: 0, z: 0 }

  const counts = { north: 0, south: 0, east: 0, west: 0 }

  for (const [name, loc] of Object.entries(locations)) {
    if (name === 'home' || loc.type === 'danger') continue
    const dx = loc.x - origin.x
    const dz = loc.z - origin.z
    // Determine dominant direction
    if (Math.abs(dx) >= Math.abs(dz)) {
      if (dx >= 0) counts.east++
      else counts.west++
    } else {
      if (dz >= 0) counts.south++
      else counts.north++
    }
  }

  // Find minimum count
  const minCount = Math.min(counts.north, counts.south, counts.east, counts.west)

  // Collect all directions tied at minimum
  const tied = Object.entries(counts).filter(([, c]) => c === minCount).map(([d]) => d)

  // Tie-break randomly
  const direction = tied[Math.floor(Math.random() * tied.length)]

  return { direction, count: minCount }
}

/**
 * Returns an exploration summary string for the planner.
 * Pure read of existing locations data.
 */
export function getExplorationStats(currentPos) {
  const home = locations['home']
  const nonDangerNonHome = Object.entries(locations).filter(
    ([name, loc]) => name !== 'home' && loc.type !== 'danger'
  )
  const knownCount = nonDangerNonHome.length

  const unexplored = getUnexploredDirection(currentPos)

  let farthestInfo = ''
  if (home) {
    let maxDist = 0
    let farthestName = ''
    for (const [name, loc] of nonDangerNonHome) {
      const dx = loc.x - home.x
      const dz = loc.z - home.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist > maxDist) {
        maxDist = dist
        farthestName = name
      }
    }
    if (farthestName) {
      farthestInfo = ` Farthest from home: ${Math.round(maxDist)} blocks (${farthestName}).`
    }
  }

  let result = `Explored: ${knownCount} known locations. Least explored: ${unexplored.direction} (${unexplored.count} locations).${farthestInfo}`

  if (knownCount < 2) {
    result += " You haven't explored much yet. Consider venturing out in a new direction."
  }

  return result
}

// ── Resource Patches ──

/**
 * Prune resource entries when total exceeds 500.
 * Removes oldest same-type duplicates within 10 blocks until under 500.
 */
function pruneResources() {
  const MAX_RESOURCES = 500
  const entries = Object.entries(resources)
  if (entries.length <= MAX_RESOURCES) return

  // Sort by timestamp ascending (oldest first)
  entries.sort((a, b) => (a[1].timestamp || '').localeCompare(b[1].timestamp || ''))

  let pruned = true
  while (Object.keys(resources).length > MAX_RESOURCES && pruned) {
    pruned = false
    const current = Object.entries(resources)
    for (let i = 0; i < current.length; i++) {
      const [nameA, entA] = current[i]
      for (let j = i + 1; j < current.length; j++) {
        const [nameB, entB] = current[j]
        if (entA.type !== entB.type) continue
        const dist = horizDist(entA.x, entA.z, entB.x, entB.z)
        if (dist > 10) continue
        // Both are same type within 10 blocks — delete the older one
        const older = (entA.timestamp || '') <= (entB.timestamp || '') ? nameA : nameB
        delete resources[older]
        pruned = true
        break
      }
      if (pruned) break
    }
  }
}

/**
 * Save a typed resource patch to persistent spatial memory.
 * @param {string} name - Unique name for this resource
 * @param {string} type - One of: ore_vein, tree_cluster, build_site, chest, poi
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {object} metadata - Optional extra data (e.g. { blockType, count })
 */
export function saveResourcePatch(name, type, x, y, z, metadata = {}) {
  const validType = VALID_RESOURCE_TYPES.has(type) ? type : 'poi'
  resources[name] = {
    name,
    type: validType,
    x: Math.round(x),
    y: Math.round(y),
    z: Math.round(z),
    dimension: 'overworld',
    timestamp: new Date().toISOString(),
    metadata,
  }
  if (Object.keys(resources).length > 500) pruneResources()
  saveLocations()
}

/**
 * Get nearby resource patches for prompt injection.
 * Filters to within 150 blocks (horizontal), sorted by distance, capped at 20.
 * @param {object} position - { x, y, z }
 * @returns {string}
 */
export function getResourcesForPrompt(position) {
  const entries = Object.entries(resources)
  if (entries.length === 0) return ''
  if (!position) {
    // Fallback: no position provided, return up to 20
    const parts = entries.slice(0, 20).map(([name, r]) => `${name} (${r.type})`)
    return 'Nearby resources: ' + parts.join(', ')
  }

  const nearby = entries
    .map(([name, r]) => {
      const dist = horizDist(position.x, position.z, r.x, r.z)
      return { name, r, dist }
    })
    .filter(e => e.dist <= 150)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 20)

  if (nearby.length === 0) return ''

  const parts = nearby.map(({ name, r, dist }) => {
    const dx = r.x - position.x
    const dz = r.z - position.z
    const dir = cardinalDir(dx, dz)
    return `${name} (${r.type}, ${Math.round(dist)} blocks ${dir})`
  })

  return 'Nearby resources: ' + parts.join(', ')
}

/**
 * Extract coordinates from chat messages like:
 * "found iron at 200,40,100" or "there's a cave at x=200 y=40 z=100" or "(200, 40, 100)"
 * Returns { x, y, z } or null.
 */
export function parseLocationFromChat(message) {
  if (!message) return null

  // Pattern 1: "at 200,40,100" or "at 200, 40, 100"
  let match = message.match(/at\s+(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/)
  if (match) return { x: parseInt(match[1], 10), y: parseInt(match[2], 10), z: parseInt(match[3], 10) }

  // Pattern 2: "at x=200 y=40 z=100" or "at x 200 y 40 z 100"
  match = message.match(/at\s+x\s*=?\s*(-?\d+)\s+y\s*=?\s*(-?\d+)\s+z\s*=?\s*(-?\d+)/i)
  if (match) return { x: parseInt(match[1], 10), y: parseInt(match[2], 10), z: parseInt(match[3], 10) }

  // Pattern 3: "(200, 40, 100)" parenthesized coordinates
  match = message.match(/\((-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\)/)
  if (match) return { x: parseInt(match[1], 10), y: parseInt(match[2], 10), z: parseInt(match[3], 10) }

  return null
}
