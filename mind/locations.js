// locations.js -- Named location memory: home, waypoints, prompt injection

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

let LOCATIONS_FILE = ''
let locations = {}

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

export function initLocations(config) {
  LOCATIONS_FILE = join(config.dataDir, 'locations.json')
  const dir = dirname(LOCATIONS_FILE)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  if (existsSync(LOCATIONS_FILE)) {
    try {
      locations = JSON.parse(readFileSync(LOCATIONS_FILE, 'utf-8'))
    } catch {
      locations = {}
    }
  }
}

export function setHome(x, y, z) {
  locations['home'] = {
    x: Math.round(x),
    y: Math.round(y),
    z: Math.round(z),
    type: 'home',
    saved: new Date().toISOString(),
  }
  saveLocations()
}

export function getHome() {
  const home = locations['home']
  if (!home) return null
  return { x: home.x, y: home.y, z: home.z }
}

export function saveLocation(name, x, y, z, type = 'custom') {
  locations[name] = {
    x: Math.round(x),
    y: Math.round(y),
    z: Math.round(z),
    type,
    saved: new Date().toISOString(),
  }
}

export function getLocationsForPrompt(botPosition) {
  const entries = Object.entries(locations)
  if (entries.length === 0) return ''

  if (!botPosition) {
    const lines = entries.map(([name, loc]) => `  ${name}: ${loc.x},${loc.y},${loc.z}`)
    return 'Known locations:\n' + lines.join('\n')
  }

  // Filter to within 500 blocks, sort by distance
  const nearby = entries
    .map(([name, loc]) => {
      const dist = horizDist(botPosition.x, botPosition.z, loc.x, loc.z)
      return { name, loc, dist }
    })
    .filter(e => e.dist <= 500)
    .sort((a, b) => a.dist - b.dist)

  if (nearby.length === 0) return ''

  const lines = nearby.map(({ name, loc, dist }) => {
    const dx = loc.x - botPosition.x
    const dz = loc.z - botPosition.z
    const dir = cardinalDir(dx, dz)
    return `  ${name}: ${loc.x},${loc.y},${loc.z} (${Math.round(dist)} blocks ${dir})`
  })

  return 'Known locations:\n' + lines.join('\n')
}

export function saveLocations() {
  try {
    writeFileSync(LOCATIONS_FILE, JSON.stringify(locations, null, 2))
  } catch {}
}
