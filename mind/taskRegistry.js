// taskRegistry.js — Shared task registry: claim/release tasks to prevent duplicate work across agents

import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

// ── Module State ──

let _sharedDir = ''
let _registryFile = ''
let _agentName = ''

// ── Internal Helpers ──

// _loadRegistry() — read and parse registry file; returns empty registry on ENOENT or parse error
function _loadRegistry() {
  try {
    return JSON.parse(readFileSync(_registryFile, 'utf-8'))
  } catch {
    // ENOENT on cold start, or JSON parse error — return empty registry
    return { tasks: [], lastUpdated: null }
  }
}

// _writeRegistry(data) — atomic write: set lastUpdated, write tmp, renameSync to target
function _writeRegistry(data) {
  data.lastUpdated = new Date().toISOString()
  const tmp = _registryFile + '.tmp'
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  renameSync(tmp, _registryFile)
}

// _isStale(claimedAt) — returns true if claimedAt timestamp is older than 10 minutes
function _isStale(claimedAt) {
  if (!claimedAt) return true
  return (Date.now() - new Date(claimedAt).getTime()) > 10 * 60 * 1000
}

// _releaseStaleOwn() — on startup, clear any claims this agent held from a previous crashed session
function _releaseStaleOwn() {
  const data = _loadRegistry()
  let changed = 0
  for (const task of data.tasks) {
    if (task.claimedBy === _agentName && _isStale(task.claimedAt)) {
      task.claimedBy = null
      task.claimedAt = null
      task.status = 'pending'
      changed++
    }
  }
  if (changed > 0) {
    _writeRegistry(data)
    console.log(`[task-registry] released ${changed} stale claims from previous session`)
  }
}

// ── Exported Functions ──

// initTaskRegistry(config) — sets module state, creates shared dir, releases stale own claims
export function initTaskRegistry(config) {
  _agentName = config.name
  // shared dir is a sibling of the agent's data dir — e.g. data/shared/ alongside data/luna/
  _sharedDir = join(dirname(config.dataDir), 'shared')
  mkdirSync(_sharedDir, { recursive: true })
  _registryFile = join(_sharedDir, 'task-registry.json')
  // On startup, release any stale claims from previous crashed session
  _releaseStaleOwn()
}

// registerTask(taskId, description, meta) — add a new pending task to the registry
export function registerTask(taskId, description, meta = {}) {
  const data = _loadRegistry()
  const task = {
    id: taskId,
    description,
    claimedBy: null,
    claimedAt: null,
    status: 'pending',
    meta,
    createdAt: new Date().toISOString(),
  }
  data.tasks.push(task)
  _writeRegistry(data)
  return task
}

// claimTask(agentName, taskId) — attempt to claim a task; returns boolean success
// Uses optimistic concurrency: re-reads after write to verify claim survived
export function claimTask(agentName, taskId) {
  const data = _loadRegistry()
  const task = data.tasks.find(t => t.id === taskId)

  if (!task) return false

  // Allow claiming if unclaimed, or if existing claim is stale (crash recovery)
  const alreadyClaimed = task.claimedBy !== null && !_isStale(task.claimedAt)
  if (alreadyClaimed && task.claimedBy !== agentName) return false

  task.claimedBy = agentName
  task.claimedAt = new Date().toISOString()
  task.status = 'active'
  _writeRegistry(data)

  // Optimistic concurrency check — re-read and verify claim survived
  const verify = _loadRegistry()
  const claimed = verify.tasks.find(t => t.id === taskId)
  return claimed?.claimedBy === agentName
}

// releaseTask(agentName, taskId) — release a task back to pending
export function releaseTask(agentName, taskId) {
  const data = _loadRegistry()
  const task = data.tasks.find(t => t.id === taskId && t.claimedBy === agentName)
  if (!task) return
  task.claimedBy = null
  task.claimedAt = null
  task.status = 'pending'
  _writeRegistry(data)
}

// completeTask(agentName, taskId) — mark a task as done
export function completeTask(agentName, taskId) {
  const data = _loadRegistry()
  const task = data.tasks.find(t => t.id === taskId && t.claimedBy === agentName)
  if (!task) return
  task.status = 'done'
  _writeRegistry(data)
}

// listTasks(filter) — return tasks optionally filtered by status or claimedBy
export function listTasks(filter = {}) {
  const data = _loadRegistry()
  let tasks = data.tasks
  if (filter.status !== undefined) {
    tasks = tasks.filter(t => t.status === filter.status)
  }
  if (filter.claimedBy !== undefined) {
    tasks = tasks.filter(t => t.claimedBy === filter.claimedBy)
  }
  return tasks
}
