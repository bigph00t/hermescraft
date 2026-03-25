// coordination.js — Activity broadcasting: each agent writes its status, reads partner's

import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

// ── Module State ──

let _activityFile = ''
let _activityTmp = ''
let _partnerFile = ''
let _agentName = ''

// ── Exported Functions ──

// initCoordination(config) — sets up shared dir and file paths for activity broadcast
export function initCoordination(config) {
  _agentName = config.name
  // shared dir is a sibling of the agent's data dir — e.g. data/shared/ alongside data/luna/
  const sharedDir = join(dirname(config.dataDir), 'shared')
  mkdirSync(sharedDir, { recursive: true })
  _activityFile = join(sharedDir, 'activity-' + config.name + '.json')
  _activityTmp = _activityFile + '.tmp'
  _partnerFile = join(sharedDir, 'activity-' + (config.partnerName || '') + '.json')
}

// broadcastActivity(command, args, status) — atomically write current agent activity to shared file
export function broadcastActivity(command, args = {}, status = 'running', buildProject = null) {
  const payload = {
    agent: _agentName,
    command,
    args,
    status,
    ts: Date.now(),
    buildProject,
  }
  writeFileSync(_activityTmp, JSON.stringify(payload, null, 2), 'utf-8')
  renameSync(_activityTmp, _activityFile)
}

// getPartnerActivityForPrompt() — read partner activity; returns null if missing or stale (>120s)
export function getPartnerActivityForPrompt() {
  try {
    const raw = readFileSync(_partnerFile, 'utf-8')
    const data = JSON.parse(raw)
    const ageS = Math.round((Date.now() - data.ts) / 1000)

    // Stale check — partner is offline if last broadcast was >120s ago
    if (ageS > 120) return null

    const partner = data.agent || 'partner'
    const truncatedArgs = Object.keys(data.args || {}).length > 0
      ? ' ' + JSON.stringify(data.args).slice(0, 80)
      : ''

    if (data.status === 'idle') {
      return `${partner} is idle (${ageS}s ago)`
    }

    // Flag long-running operations so the other agent knows not to expect a reply
    const LONG_OPS = new Set(['build', 'plan', 'road', 'clear'])
    const isBusy = LONG_OPS.has(data.command) && data.status === 'running'
    const busyNote = isBusy ? ' — busy building, won\'t respond to chat until done' : ''
    const isDesigning = data.command === 'design' && data.status === 'running'
    const designNote = isDesigning ? ' — designing a blueprint (~15s), will respond after' : ''

    if (data.buildProject) {
      return `${partner} is ${data.status}: ${data.command} — working on "${data.buildProject.name}" (${data.buildProject.progress || 0}%)${busyNote}${designNote} (${ageS}s ago)`
    }
    return `${partner} is ${data.status}: ${data.command}${truncatedArgs}${busyNote}${designNote} (${ageS}s ago)`
  } catch {
    // ENOENT (partner not yet active), or JSON parse error — return null
    return null
  }
}
