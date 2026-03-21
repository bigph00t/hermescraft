// shared-state.js — Shared coordination file for multi-agent cooperation
// Both agents read/write agent/shared/coordination.json
// Used by planner loop for task claiming, location sharing, activity awareness

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SHARED_DIR = join(__dirname, 'shared')
const COORD_FILE = join(SHARED_DIR, 'coordination.json')

// ── Read/Write ──

function readCoordination() {
  try {
    if (existsSync(COORD_FILE)) {
      return JSON.parse(readFileSync(COORD_FILE, 'utf-8'))
    }
  } catch {}
  return { agents: {}, locations: {}, projects: [] }
}

function writeCoordination(data) {
  try {
    mkdirSync(SHARED_DIR, { recursive: true })
    writeFileSync(COORD_FILE, JSON.stringify(data, null, 2))
  } catch (err) {
    console.log('[Shared] Write failed: ' + (err?.message || '').slice(0, 60))
  }
}

// ── Agent State Updates ──

/**
 * Update this agent's state in the shared coordination file.
 * Called by planner on each tick.
 */
export function updateAgentState(agentName, { activity, position, inventorySummary, mood, lastCreativeActivity }) {
  const data = readCoordination()
  if (!data.agents) data.agents = {}

  data.agents[agentName] = {
    activity: activity || 'idle',
    position: position || null,
    inventory: inventorySummary || '',
    mood: mood || '',
    updatedAt: new Date().toISOString(),
    ...(lastCreativeActivity ? { lastCreativeActivity } : {}),
  }

  writeCoordination(data)
}

/**
 * Get what other agents are doing (excludes self).
 * Returns formatted string for planner/action prompt injection.
 */
export function getOtherAgentsContext(selfName) {
  const data = readCoordination()
  if (!data.agents) return ''

  const others = Object.entries(data.agents)
    .filter(([name]) => name !== selfName)
    .filter(([, state]) => {
      // Only include if updated within last 5 minutes
      const age = Date.now() - new Date(state.updatedAt).getTime()
      return age < 300000
    })

  if (others.length === 0) return ''

  const lines = ['== OTHER AGENTS ==']
  for (const [name, state] of others) {
    const ago = Math.round((Date.now() - new Date(state.updatedAt).getTime()) / 1000)
    let line = `${name}: ${state.activity}`
    if (state.position) {
      line += ` at (${Math.round(state.position.x)}, ${Math.round(state.position.y)}, ${Math.round(state.position.z)})`
    }
    if (state.mood) line += ` [${state.mood}]`
    if (state.lastCreativeActivity) {
      const creativeMinsAgo = Math.round((Date.now() - new Date(state.lastCreativeActivity).getTime()) / 60000)
      if (creativeMinsAgo > 3) line += ` (gathering for ${creativeMinsAgo}min)`
    }
    line += ` (${ago}s ago)`
    lines.push(line)
  }

  return lines.join('\n')
}

// ── Shared Locations ──

/**
 * Share a discovered location with all agents.
 */
export function shareLocation(name, x, y, z, discoveredBy, description) {
  const data = readCoordination()
  if (!data.locations) data.locations = {}

  data.locations[name] = {
    x, y, z,
    discoveredBy,
    description: description || '',
    sharedAt: new Date().toISOString(),
  }

  writeCoordination(data)
}

/**
 * Get all shared locations as formatted string.
 */
export function getSharedLocations() {
  const data = readCoordination()
  if (!data.locations || Object.keys(data.locations).length === 0) return ''

  const lines = ['== SHARED MAP ==']
  for (const [name, loc] of Object.entries(data.locations)) {
    let line = `${name}: (${loc.x}, ${loc.y}, ${loc.z})`
    if (loc.description) line += ` — ${loc.description}`
    if (loc.discoveredBy) line += ` [found by ${loc.discoveredBy}]`
    lines.push(line)
  }

  return lines.join('\n')
}

// ── Project Coordination ──

/**
 * Claim a project so other agents know you're working on it.
 */
export function claimProject(agentName, projectName, location, description) {
  const data = readCoordination()
  if (!data.projects) data.projects = []

  // Check if already claimed
  const existing = data.projects.find(p => p.name === projectName)
  if (existing) {
    existing.workers = existing.workers || []
    if (!existing.workers.includes(agentName)) {
      existing.workers.push(agentName)
    }
    existing.updatedAt = new Date().toISOString()
  } else {
    data.projects.push({
      name: projectName,
      workers: [agentName],
      location,
      description: description || '',
      status: 'in_progress',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  writeCoordination(data)
}

/**
 * Get active projects as formatted string.
 */
export function getActiveProjects() {
  const data = readCoordination()
  if (!data.projects || data.projects.length === 0) return ''

  const active = data.projects.filter(p => p.status === 'in_progress')
  if (active.length === 0) return ''

  const lines = ['== ACTIVE PROJECTS ==']
  for (const p of active) {
    let line = `${p.name}: ${p.workers?.join(', ') || 'unclaimed'}`
    if (p.location) line += ` at (${p.location.x}, ${p.location.y}, ${p.location.z})`
    if (p.description) line += ` — ${p.description}`
    lines.push(line)
  }

  return lines.join('\n')
}
