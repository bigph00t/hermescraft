// action-queue.js — File-backed action queue for brain-hands coordination
// Planner writes concrete action sequences. Action loop pops and executes.

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

let _queuePath = null
let _queue = { queue: [], goal: '', updatedAt: '', source: '' }

// ── Init ──

export function initQueue(agentConfig) {
  _queuePath = join(agentConfig.dataDir, 'action-queue.json')
  mkdirSync(agentConfig.dataDir, { recursive: true })
  try {
    const data = JSON.parse(readFileSync(_queuePath, 'utf-8'))
    if (data.queue && Array.isArray(data.queue)) {
      _queue = data
      console.log(`[Queue] Loaded ${data.queue.length} items from disk: "${data.goal || 'no goal'}"`)
    }
  } catch {
    _queue = { queue: [], goal: '', updatedAt: '', source: '' }
  }
}

// ── Write ──

function save() {
  if (!_queuePath) return
  try {
    writeFileSync(_queuePath, JSON.stringify(_queue, null, 2))
  } catch {}
}

export function setQueue(items, goal = '', source = 'planner') {
  _queue = {
    queue: items.slice(0, 20).map(item => ({
      type: item.type,
      args: item.args || {},
      reason: item.reason || '',
    })),
    goal,
    source,
    updatedAt: new Date().toISOString(),
  }
  save()
  console.log(`[Queue] Set ${_queue.queue.length} items: "${goal}"`)
}

export function clearQueue(reason = '') {
  const had = _queue.queue.length
  _queue.queue = []
  _queue.goal = ''
  _queue.updatedAt = new Date().toISOString()
  save()
  if (had > 0) console.log(`[Queue] Cleared (${reason || 'manual'}), had ${had} items`)
}

// ── Read ──

export function popAction() {
  if (_queue.queue.length === 0) return null
  const action = _queue.queue.shift()
  save()
  return action
}

export function peekAction() {
  return _queue.queue.length > 0 ? _queue.queue[0] : null
}

export function getQueueLength() {
  return _queue.queue.length
}

export function getQueueGoal() {
  return _queue.goal || ''
}

export function getQueueSummary() {
  if (_queue.queue.length === 0) return ''
  const items = _queue.queue.slice(0, 8).map(a => {
    const argStr = a.args?.blockName || a.args?.item || a.args?.message?.slice(0, 20) || ''
    return argStr ? `${a.type} ${argStr}` : a.type
  })
  let summary = `Queue (${_queue.queue.length} items): ${items.join(' → ')}`
  if (_queue.queue.length > 8) summary += ' → ...'
  if (_queue.goal) summary += `\nGoal: ${_queue.goal}`
  return summary
}
