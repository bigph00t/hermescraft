// baritone-tracker.js — Centralized Baritone state tracking
// Replaces scattered navigateActive/setNavigating/_activeBaritoneAction

const BARITONE_TIMEOUT_MS = 30000   // Mod auto-stops mine after 30s
const STILLNESS_THRESHOLD = 0.5     // Blocks of movement to consider "still"
const STILLNESS_MAX_TICKS = 4       // 4 ticks (8s) of stillness = done

let _state = 'idle'  // 'idle' | 'active' | 'done'
let _type = null      // 'mine' | 'navigate'
let _args = null
let _startedAt = 0
let _startPos = null
let _lastPos = null
let _stillTicks = 0
let _doneReason = ''

// ── Public API ──

export function startBaritone(type, args = {}) {
  _state = 'active'
  _type = type
  _args = args
  _startedAt = Date.now()
  _startPos = null  // Set on first updatePosition
  _lastPos = null
  _stillTicks = 0
  _doneReason = ''
  console.log(`[Baritone] Started: ${type} ${JSON.stringify(args).slice(0, 60)}`)
}

export function updatePosition(pos) {
  if (_state !== 'active' || !pos) return getStatus()

  // Set start position on first call after startBaritone
  if (!_startPos) {
    _startPos = { x: pos.x, y: pos.y, z: pos.z }
    _lastPos = { x: pos.x, y: pos.y, z: pos.z }
    return getStatus()
  }

  // Check timeout
  const elapsed = Date.now() - _startedAt
  if (elapsed > BARITONE_TIMEOUT_MS) {
    _state = 'done'
    _doneReason = 'timeout'
    console.log(`[Baritone] Done: ${_type} timed out after ${Math.round(elapsed / 1000)}s`)
    return getStatus()
  }

  // Check movement
  const dx = Math.abs(pos.x - _lastPos.x)
  const dy = Math.abs(pos.y - _lastPos.y)
  const dz = Math.abs(pos.z - _lastPos.z)
  const displacement = dx + dy + dz

  _lastPos = { x: pos.x, y: pos.y, z: pos.z }

  if (displacement < STILLNESS_THRESHOLD) {
    _stillTicks++
    if (_stillTicks >= STILLNESS_MAX_TICKS) {
      _state = 'done'
      _doneReason = 'stillness'
      console.log(`[Baritone] Done: ${_type} — stopped moving for ${_stillTicks} ticks`)
    }
  } else {
    _stillTicks = 0  // Reset on movement
  }

  return getStatus()
}

export function getStatus() {
  if (_state === 'idle') return { state: 'idle' }

  const elapsed = Date.now() - _startedAt

  if (_state === 'done') {
    return { state: 'done', type: _type, args: _args, reason: _doneReason }
  }

  return {
    state: 'active',
    type: _type,
    args: _args,
    elapsed,
    moving: _stillTicks === 0,
  }
}

export function stopBaritone(reason = 'manual') {
  if (_state === 'active') {
    console.log(`[Baritone] Stopped: ${_type} (${reason})`)
  }
  _state = 'idle'
  _type = null
  _args = null
  _stillTicks = 0
  _doneReason = ''
}

export function isBaritoneActive() {
  return _state === 'active'
}

export function getBaritoneContext() {
  const status = getStatus()
  if (status.state === 'idle') return ''

  if (status.state === 'active') {
    const secs = Math.round(status.elapsed / 1000)
    const argStr = status.args?.blockName || status.args?.item || ''
    const movingStr = status.moving ? 'moving' : 'waiting'
    return `Currently ${status.type === 'mine' ? 'mining' : 'walking to'} ${argStr} (${secs}s, ${movingStr})`
  }

  if (status.state === 'done') {
    const argStr = status.args?.blockName || status.args?.item || ''
    return `Finished ${_type === 'mine' ? 'mining' : 'navigating to'} ${argStr} (${status.reason})`
  }

  return ''
}
