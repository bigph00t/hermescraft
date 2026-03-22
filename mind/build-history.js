// build-history.js -- Persistent build history: init, record, load, prompt injection

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

let HISTORY_FILE = ''
let history = []

// ── Init ──

export function initBuildHistory(config) {
  // Shared build history — all agents read/write the same file so they know
  // about each other's builds. Stored one level up from per-agent data dirs.
  const sharedDir = join(config.dataDir, '..')
  HISTORY_FILE = join(sharedDir, 'shared_build_history.json')
  if (!existsSync(sharedDir)) mkdirSync(sharedDir, { recursive: true })
}

// ── Load / Save ──

export function loadBuildHistory() {
  if (!HISTORY_FILE) return []
  if (existsSync(HISTORY_FILE)) {
    try {
      history = JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'))
    } catch {
      history = []
    }
  } else {
    history = []
  }
  return history
}

export function saveBuildHistory() {
  if (!HISTORY_FILE) return
  try {
    writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8')
  } catch (err) {
    console.log('[build-history] warning: could not save build history:', err.message)
  }
}

// ── Record ──

export function recordBuild({ name, origin, dimensions, blockCount, builder }) {
  const record = {
    name,
    origin: { x: origin.x, y: origin.y, z: origin.z },
    dimensions: { x: dimensions.x, y: dimensions.y, z: dimensions.z },
    blockCount,
    builder,
    date: new Date().toISOString(),
  }
  history.push(record)
  if (history.length > 20) history.shift()
  saveBuildHistory()
}

// ── Prompt Injection ──

export function getBuildHistoryForPrompt() {
  if (history.length === 0) return ''
  const lines = ['Previous builds:']
  for (const entry of history) {
    const dateShort = entry.date ? entry.date.slice(0, 10) : 'unknown'
    const dim = entry.dimensions
    const who = entry.builder ? ` by ${entry.builder}` : ''
    lines.push(`  ${entry.name} at ${entry.origin.x},${entry.origin.y},${entry.origin.z} (${entry.blockCount} blocks${who}) -- ${dateShort}`)
  }
  return lines.join('\n')
}
