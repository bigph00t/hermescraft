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

export function getChestsForPrompt() {
  const keys = Object.keys(chests)
  if (keys.length === 0) return ''

  const parts = keys.map(key => {
    const items = chests[key].contents
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
