// freestyle.js — LLM-designed building plan parser and execution tracker
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'

// ── Module State ──

let _stateFile = ''
let _contextDir = ''
// Active build: { name, planFile, blocks: [{block,x,y,z}], completed: number }
let _activeFreestyle = null

// ── Init ──

export function initFreestyle(agentConfig) {
  _stateFile = join(agentConfig.dataDir, 'freestyle_state.json')
  _contextDir = join(agentConfig.dataDir, 'context')

  if (existsSync(_stateFile)) {
    try {
      _activeFreestyle = JSON.parse(readFileSync(_stateFile, 'utf-8'))
    } catch {
      _activeFreestyle = null
    }
  }

  // Validate that the plan context file still exists — if not, discard stale state
  if (_activeFreestyle) {
    const planPath = join(_contextDir, _activeFreestyle.planFile || '')
    if (!_activeFreestyle.planFile || !existsSync(planPath)) {
      console.log('[freestyle] Discarding stale build state — plan file missing:', _activeFreestyle.planFile)
      _activeFreestyle = null
    } else {
      const remaining = _activeFreestyle.blocks.length - _activeFreestyle.completed
      console.log(`[freestyle] Resuming build "${_activeFreestyle.name}" — ${remaining} blocks remaining`)
    }
  }
}

// ── Plan Parsing ──

export function parseFreestylePlan(text, originX, originY, originZ) {
  if (!text) return null

  // Require ## BUILD: header
  const headerMatch = text.match(/^##\s+BUILD:\s*(.+)$/m)
  if (!headerMatch) return null
  const name = headerMatch[1].trim()

  // Parse materials section
  const materials = {}
  const matSection = text.match(/###\s+Materials\n([\s\S]*?)(?:###|$)/)
  if (matSection) {
    for (const line of matSection[1].split('\n')) {
      const m = line.match(/^\s*([a-z_]+):\s*(\d+)/)
      if (m) materials[m[1]] = parseInt(m[2])
    }
  }

  // Parse placement section — lenient: supports period or ) after number, leading whitespace
  const placSection = text.match(/###\s+Placement\n([\s\S]*?)(?:###|$)/)
  const blocks = []
  if (placSection) {
    for (const line of placSection[1].split('\n')) {
      const m = line.match(/^\s*\d+[.)]\s+([a-z_]+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/)
      if (m) {
        blocks.push({
          block: m[1],
          x: originX + parseInt(m[2]),
          y: originY + parseInt(m[3]),
          z: originZ + parseInt(m[4]),
        })
      }
    }
    if (blocks.length === 0) {
      console.warn('[freestyle] WARNING: placement section found but 0 blocks parsed — check format')
    }
  }

  // Soft cap: warn and truncate if plan is unreasonably large
  if (blocks.length > 200) {
    console.warn(`[freestyle] WARNING: plan "${name}" has ${blocks.length} blocks — truncating to 200`)
    blocks.length = 200
  }

  return { name, materials, blocks }
}

// ── Execution Control ──

export function startFreestyle(name, planFile, blocks) {
  _activeFreestyle = { name, planFile, blocks, completed: 0 }
  _saveFreestyleState()
}

export function advanceFreestyle() {
  if (!_activeFreestyle) return
  _activeFreestyle.completed++
  if (_activeFreestyle.completed >= _activeFreestyle.blocks.length) {
    clearFreestyle()
  } else {
    _saveFreestyleState()
  }
}

export function getNextFreestyleBatch(batchSize = 20) {
  if (!_activeFreestyle) return []
  return _activeFreestyle.blocks.slice(
    _activeFreestyle.completed,
    _activeFreestyle.completed + batchSize,
  )
}

// ── Status Queries ──

export function isFreestyleActive() {
  return !!_activeFreestyle && _activeFreestyle.completed < _activeFreestyle.blocks.length
}

export function getFreestyleProgress() {
  if (!_activeFreestyle) return null
  return {
    name: _activeFreestyle.name,
    total: _activeFreestyle.blocks.length,
    completed: _activeFreestyle.completed,
    remaining: _activeFreestyle.blocks.length - _activeFreestyle.completed,
  }
}

// ── Cleanup ──

export function clearFreestyle() {
  _activeFreestyle = null
  if (existsSync(_stateFile)) {
    try { unlinkSync(_stateFile) } catch {}
  }
}

// ── Internal ──

function _saveFreestyleState() {
  if (!_stateFile) return
  try {
    const dir = dirname(_stateFile)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(_stateFile, JSON.stringify(_activeFreestyle, null, 2))
  } catch {}
}
