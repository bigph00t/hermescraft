// memoryDB.js -- SQLite persistent event log with importance scoring and spatial tagging

import Database from 'better-sqlite3'
import { join } from 'path'
import { mkdirSync, existsSync } from 'fs'

// ── Module-level state ──

let db = null
let _agentName = ''
let _insertStmt = null

// Importance score table — Stanford Generative Agents pattern (locked in CONTEXT.md)
// death=10, discovery=8, combat=7, build=6, social=5, craft=4, observation=3, movement=2
const IMPORTANCE = {
  death:       10,
  reflection:   9,  // Phase 18 — LLM-authored strategy journals from background brain
  discovery:    8,
  combat:       7,
  build:        6,
  social:       5,
  craft:        4,
  observation:  3,
  movement:     2,
}

// ── Init ──

export function initMemoryDB(config) {
  if (!existsSync(config.dataDir)) mkdirSync(config.dataDir, { recursive: true })
  _agentName = config.name

  const dbPath = join(config.dataDir, 'memory.db')
  db = new Database(dbPath)

  // WAL mode for crash safety — single writer, fast reads, no journal thrash
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')

  // Idempotent schema creation — safe to run on every startup, handles first-run and upgrades
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      agent       TEXT    NOT NULL,
      ts          INTEGER NOT NULL,
      event_type  TEXT    NOT NULL,
      importance  INTEGER NOT NULL DEFAULT 2,
      x           REAL,
      z           REAL,
      dimension   TEXT    DEFAULT 'overworld',
      description TEXT    NOT NULL,
      metadata    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_agent_ts ON events(agent, ts DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_type ON events(agent, event_type);
    CREATE INDEX IF NOT EXISTS idx_importance ON events(importance DESC);
  `)

  // Prepared insert stored at module level (NOT recreated in logEvent per call)
  _insertStmt = db.prepare(`
    INSERT INTO events (agent, ts, event_type, importance, x, z, dimension, description, metadata)
    VALUES (@agent, @ts, @event_type, @importance, @x, @z, @dimension, @description, @metadata)
  `)

  // Prune on startup to keep event count below cap
  pruneOldEvents(config.name)
}

// ── Write ──

export function logEvent(bot, eventType, description, metadata = null) {
  if (!db) return
  const pos = bot?.entity?.position
  const dim = (bot?.game?.dimension || 'overworld').replace('minecraft:', '')
  _insertStmt.run({
    agent:       _agentName,
    ts:          Date.now(),
    event_type:  eventType,
    importance:  IMPORTANCE[eventType] ?? 2,
    x:           pos ? Math.round(pos.x) : null,
    z:           pos ? Math.round(pos.z) : null,
    dimension:   dim,
    description,
    metadata:    metadata ? JSON.stringify(metadata).slice(0, 500) : null,
  })
}

// ── Read ──

export function queryRecent(agentName, limit = 20) {
  if (!db) return []
  return db.prepare(`
    SELECT id, ts, event_type, importance, x, z, dimension, description
    FROM events
    WHERE agent = ?
    ORDER BY ts DESC
    LIMIT ?
  `).all(agentName, limit)
}

export function queryNearby(agentName, x, z, radius = 50, limit = 10) {
  if (!db) return []
  return db.prepare(`
    SELECT id, ts, event_type, importance, x, z, dimension, description
    FROM events
    WHERE agent = ?
      AND x BETWEEN ? AND ?
      AND z BETWEEN ? AND ?
    ORDER BY importance DESC, ts DESC
    LIMIT ?
  `).all(agentName, x - radius, x + radius, z - radius, z + radius, limit)
}

// ── Maintenance ──

export function pruneOldEvents(agentName, maxEvents = 10000) {
  if (!db) return
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM events WHERE agent = ?').get(agentName)
  if (countRow.cnt > maxEvents) {
    // Delete oldest (lowest ts) beyond the cap — keep newest maxEvents rows
    db.prepare(`
      DELETE FROM events WHERE agent = ? AND id NOT IN (
        SELECT id FROM events WHERE agent = ? ORDER BY ts DESC LIMIT ?
      )
    `).run(agentName, agentName, maxEvents)
  }
}
