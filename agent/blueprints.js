// blueprints.js — Blueprint loader and palette resolver for building system

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BLUEPRINTS_DIR = join(__dirname, 'blueprints')

// ── Blueprint Loading ──

export function loadBlueprint(name) {
  try {
    const filePath = join(BLUEPRINTS_DIR, `${name}.json`)
    const raw = readFileSync(filePath, 'utf-8')
    const bp = JSON.parse(raw)

    // Basic validation
    if (!bp.name || !bp.palette || !bp.layers || !bp.size) {
      return null
    }

    return bp
  } catch {
    return null
  }
}

export function listBlueprints() {
  try {
    const files = readdirSync(BLUEPRINTS_DIR)
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
  } catch {
    return []
  }
}

// ── Palette Resolution ──

export function resolvePalette(blueprint, availableBlocks) {
  const resolved = {}
  const available = new Set(availableBlocks || [])

  for (const [key, entry] of Object.entries(blueprint.palette)) {
    const preferred = entry.preferred || []
    // Find first preferred block the agent actually has
    const match = preferred.find(b => available.has(b))
    // Use match if found, otherwise fall back to first preferred (agent will need to gather)
    resolved[key] = match || preferred[0] || 'cobblestone'
  }

  return resolved
}

// ── Material Counting ──

export function getBlueprintMaterials(blueprint) {
  const counts = new Map()

  for (const layer of blueprint.layers) {
    for (const row of layer.grid) {
      for (const char of row) {
        // Skip air blocks
        if (char === ' ' || char === '.') continue

        const entry = blueprint.palette[char]
        if (!entry) continue

        // Use first preferred block as the canonical name for counting
        const blockName = entry.preferred[0] || char
        counts.set(blockName, (counts.get(blockName) || 0) + 1)
      }
    }
  }

  return counts
}
