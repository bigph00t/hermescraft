// autobiography.js — Autobiographical event log for deep memory
import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'

let AUTOBIOGRAPHY_FILE = ''
let events = []

export function initAutobiography(agentConfig) {
  AUTOBIOGRAPHY_FILE = join(agentConfig.dataDir, 'autobiography.jsonl')
  const dir = dirname(AUTOBIOGRAPHY_FILE)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  // Load existing entries on startup
  if (existsSync(AUTOBIOGRAPHY_FILE)) {
    try {
      const lines = readFileSync(AUTOBIOGRAPHY_FILE, 'utf-8')
        .split('\n')
        .filter(l => l.trim())
      for (const line of lines) {
        try {
          events.push(JSON.parse(line))
        } catch {}
      }
      // Cap in-memory at 100 entries (keep most recent)
      if (events.length > 100) events = events.slice(-100)
    } catch {}
  }
}

export function recordEvent(event) {
  // Event shape: { timestamp, gameDay, type, description, location, importance }
  // Types: 'death' (10), 'build_complete' (8), 'new_player' (7),
  //        'found_resource' (5), 'chat_highlight' (4), 'routine' (1)
  if (!AUTOBIOGRAPHY_FILE) return

  events.push(event)
  // Cap in-memory at 100 entries
  if (events.length > 100) events.shift()

  try {
    appendFileSync(AUTOBIOGRAPHY_FILE, JSON.stringify(event) + '\n', 'utf-8')
  } catch {}
}

export function getRecentEvents(n = 10) {
  return events.slice(-n)
}

export function getEventsSummary() {
  if (events.length === 0) return ''

  // Group by gameDay, max 10 days, 3 events per day
  const byDay = {}
  for (const e of events) {
    const day = e.gameDay || 0
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(e)
  }

  const days = Object.keys(byDay)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, 10)
    .sort((a, b) => a - b)

  const lines = []
  for (const day of days) {
    const dayEvents = byDay[day]
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, 3)
      .map(e => e.description)
      .join(', ')
    lines.push(`Day ${day}: ${dayEvents}`)
  }

  return lines.join('. ') + '.'
}
