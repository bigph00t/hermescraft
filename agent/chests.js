// chests.js — Chest inventory tracking for deep memory
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

let CHESTS_FILE = ''
let chests = {}

export function initChests(agentConfig) {
  CHESTS_FILE = join(agentConfig.dataDir, 'chests.json')
  const dir = dirname(CHESTS_FILE)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  if (existsSync(CHESTS_FILE)) {
    try { chests = JSON.parse(readFileSync(CHESTS_FILE, 'utf-8')) } catch { chests = {} }
  }
}

export function trackChest(x, y, z, contents) {
  // contents: array of { item: string, count: number }
  const key = `${x},${y},${z}`
  chests[key] = {
    contents,
    updated: new Date().toISOString(),
  }
  // Write to disk immediately (chests change infrequently)
  saveChests()
}

export function getChestContents(x, y, z) {
  const key = `${x},${y},${z}`
  const entry = chests[key]
  return entry ? entry.contents : null
}

export function getChestsForPrompt(position) {
  const keys = Object.keys(chests)
  if (keys.length === 0) return ''

  let filteredKeys = keys

  if (position) {
    // Parse "x,y,z" key and filter to within 150 blocks (horizontal), cap at 10
    filteredKeys = keys
      .map(key => {
        const parts = key.split(',')
        const cx = parseFloat(parts[0])
        const cz = parseFloat(parts[2])
        if (isNaN(cx) || isNaN(cz)) return { key, dist: Infinity }
        const dx = position.x - cx
        const dz = position.z - cz
        return { key, dist: Math.sqrt(dx * dx + dz * dz) }
      })
      .filter(e => e.dist <= 150)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10)
      .map(e => e.key)
  }

  if (filteredKeys.length === 0) return ''

  const parts = filteredKeys.map(key => {
    const entry = chests[key]
    if (!entry || !entry.contents) return `(${key}): empty`
    const items = entry.contents
      .map(i => `${i.item}x${i.count}`)
      .join(', ')
    return `(${key}): ${items}`
  })

  return 'Known chests: ' + parts.join(' | ')
}

export function saveChests() {
  if (!CHESTS_FILE) return
  try { writeFileSync(CHESTS_FILE, JSON.stringify(chests, null, 2)) } catch {}
}
