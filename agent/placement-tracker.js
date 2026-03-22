// placement-tracker.js — Persistent block placement log for build verification
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

// ── Module State ──

let _placedFile = ''
let _placedBlocks = []

// ── Init ──

export function initPlacementTracker(agentConfig) {
  _placedFile = join(agentConfig.dataDir, 'placed_blocks.json')
  mkdirSync(dirname(_placedFile), { recursive: true })

  if (existsSync(_placedFile)) {
    try {
      const data = JSON.parse(readFileSync(_placedFile, 'utf-8'))
      _placedBlocks = data.blocks || []
    } catch {
      _placedBlocks = []
    }
  }
}

// ── Record ──

export function recordPlacement({ block, x, y, z }) {
  _placedBlocks.push({ block, x, y, z, ts: new Date().toISOString() })
  // Truncate to last 1000 entries to prevent unbounded growth
  if (_placedBlocks.length > 1000) {
    _placedBlocks = _placedBlocks.slice(-1000)
  }
  _savePlacedBlocks()
}

// ── Queries ──

export function getPlacedBlocks() {
  return _placedBlocks
}

export function getPlacedBlockCount() {
  return _placedBlocks.length
}

export function getPlacedBlocksForPrompt() {
  if (_placedBlocks.length === 0) return ''
  const last = _placedBlocks.slice(-5)
  const parts = last.map(b => `${b.block} at (${b.x},${b.y},${b.z})`)
  return `Last ${last.length} placed: ${parts.join(', ')}`
}

// ── Reset ──

export function clearPlacedBlocks() {
  _placedBlocks = []
  _savePlacedBlocks()
}

// ── Internal ──

function _savePlacedBlocks() {
  if (!_placedFile) return
  try {
    writeFileSync(_placedFile, JSON.stringify({ blocks: _placedBlocks }, null, 2))
  } catch {}
}
