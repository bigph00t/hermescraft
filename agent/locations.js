// locations.js — Named location memory
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

let LOCATIONS_FILE = '';
let locations = {};

export function initLocations(agentConfig) {
  LOCATIONS_FILE = join(agentConfig.dataDir, 'locations.json');
  const dir = dirname(LOCATIONS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (existsSync(LOCATIONS_FILE)) {
    try { locations = JSON.parse(readFileSync(LOCATIONS_FILE, 'utf-8')); } catch { locations = {}; }
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
}

export function getLocationsForPrompt() {
  const entries = Object.entries(locations);
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
  try { writeFileSync(LOCATIONS_FILE, JSON.stringify(locations, null, 2)); } catch {}
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
