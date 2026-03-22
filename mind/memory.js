// memory.js -- Persistent memory: lessons, strategies, world knowledge, session transcripts

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'

let DATA_DIR = ''
let MEMORY_FILE = ''
let STATS_FILE = ''

let memory = {
  lessons: [],
  strategies: [],
  worldKnowledge: [],
}

let stats = {
  totalDeaths: 0,
  totalActions: 0,
  totalTicks: 0,
  sessionsPlayed: 0,
  totalPlayTimeMs: 0,
}

let sessionStart = Date.now()
let lastSaveTime = Date.now()
let sessionLogFile = null

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  const sessionsDir = join(DATA_DIR, 'sessions')
  if (!existsSync(sessionsDir)) mkdirSync(sessionsDir, { recursive: true })
}

// ── Init ──

export function initMemory(config) {
  DATA_DIR = config.dataDir
  MEMORY_FILE = join(DATA_DIR, 'MEMORY.md')
  STATS_FILE = join(DATA_DIR, 'stats.json')
}

// ── Load / Save ──

export function loadMemory() {
  ensureDataDir()

  // Load MEMORY.md
  if (existsSync(MEMORY_FILE)) {
    const content = readFileSync(MEMORY_FILE, 'utf-8')
    memory = parseMemoryMd(content)
  }

  // Load stats
  if (existsSync(STATS_FILE)) {
    try {
      const loaded = JSON.parse(readFileSync(STATS_FILE, 'utf-8'))
      // Merge loaded stats, dropping v1 phase fields if present
      stats = {
        totalDeaths: loaded.totalDeaths || 0,
        totalActions: loaded.totalActions || 0,
        totalTicks: loaded.totalTicks || 0,
        sessionsPlayed: loaded.sessionsPlayed || 0,
        totalPlayTimeMs: loaded.totalPlayTimeMs || 0,
      }
    } catch {}
  }

  // New session
  stats.sessionsPlayed++
  sessionStart = Date.now()

  // Create session log file
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  sessionLogFile = join(DATA_DIR, 'sessions', `session-${ts}.jsonl`)

  saveStats()

  return { memory, stats }
}

export function saveMemory() {
  ensureDataDir()
  writeFileSync(MEMORY_FILE, renderMemoryMd(memory), 'utf-8')
}

function saveStats() {
  ensureDataDir()
  writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8')
}

// ── MEMORY.md parsing / rendering ──

function parseMemoryMd(content) {
  const result = { lessons: [], strategies: [], worldKnowledge: [] }
  let currentSection = null

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('## Lessons')) currentSection = 'lessons'
    else if (trimmed.startsWith('## Strategies')) currentSection = 'strategies'
    else if (trimmed.startsWith('## World Knowledge')) currentSection = 'worldKnowledge'
    else if (trimmed.startsWith('## ')) currentSection = null
    else if (currentSection && trimmed.startsWith('- ')) {
      result[currentSection].push(trimmed.slice(2))
    }
  }

  return result
}

function renderMemoryMd(mem) {
  const parts = ['# Agent Memory\n']

  parts.push('## Lessons\n')
  for (const lesson of mem.lessons.slice(-20)) {
    parts.push(`- ${lesson}`)
  }

  parts.push('\n## Strategies\n')
  for (const strategy of mem.strategies.slice(-10)) {
    parts.push(`- ${strategy}`)
  }

  parts.push('\n## World Knowledge\n')
  for (const knowledge of mem.worldKnowledge.slice(-10)) {
    parts.push(`- ${knowledge}`)
  }

  // Stats section: no phase-specific fields
  parts.push(`\n## Stats\n`)
  parts.push(`- Sessions: ${stats.sessionsPlayed} | Deaths: ${stats.totalDeaths}`)

  return parts.join('\n') + '\n'
}

// ── Death Recording ──

export function recordDeath(deathMessage) {
  stats.totalDeaths++

  const msg = typeof deathMessage === 'string' ? deathMessage : 'unknown cause'
  const lesson = `Died: ${msg}. Be more careful.`

  // Deduplicate similar lessons
  const isDuplicate = memory.lessons.some(l => l.includes(msg.slice(0, 20)))
  if (!isDuplicate) {
    memory.lessons.push(lesson)
    if (memory.lessons.length > 20) memory.lessons.shift()
  }

  saveMemory()
  saveStats()

  writeSessionEntry({
    type: 'death',
    timestamp: new Date().toISOString(),
    deathNumber: stats.totalDeaths,
    message: msg,
    lesson,
  })
}

// ── Queries ──

export function getMemoryForPrompt() {
  const parts = []

  if (memory.lessons.length > 0) {
    parts.push('Lessons learned:')
    memory.lessons.slice(-7).forEach(l => parts.push(`  - ${l}`))
  }

  if (memory.strategies.length > 0) {
    parts.push('Successful strategies:')
    memory.strategies.slice(-5).forEach(s => parts.push(`  - ${s}`))
  }

  if (memory.worldKnowledge.length > 0) {
    parts.push('World knowledge:')
    memory.worldKnowledge.slice(-5).forEach(k => parts.push(`  - ${k}`))
  }

  return parts.join('\n')
}

// ── World Knowledge ──

export function addWorldKnowledge(knowledge) {
  if (!memory.worldKnowledge.includes(knowledge)) {
    memory.worldKnowledge.push(knowledge)
    if (memory.worldKnowledge.length > 10) memory.worldKnowledge.shift()
    saveMemory()
  }
}

// ── Session Logging ──

export function writeSessionEntry(entry) {
  if (!sessionLogFile) return
  try {
    appendFileSync(sessionLogFile, JSON.stringify(entry) + '\n', 'utf-8')
  } catch {}
}

// ── Periodic Save ──

export function periodicSave() {
  const now = Date.now()
  stats.totalPlayTimeMs = (stats.totalPlayTimeMs || 0) + (now - lastSaveTime)
  lastSaveTime = now
  saveStats()
  saveMemory()
  pruneSessionLogs()
}

// Keep only the last 10 session log files
function pruneSessionLogs() {
  try {
    const sessionsDir = join(DATA_DIR, 'sessions')
    if (!existsSync(sessionsDir)) return
    const files = readdirSync(sessionsDir)
      .filter(f => f.startsWith('session-') && f.endsWith('.jsonl'))
      .sort()
    const MAX_SESSION_FILES = 10
    if (files.length > MAX_SESSION_FILES) {
      for (const old of files.slice(0, files.length - MAX_SESSION_FILES)) {
        try { unlinkSync(join(sessionsDir, old)) } catch {}
      }
    }
  } catch {}
}
