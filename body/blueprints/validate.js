// validate.js — Blueprint validation: JSON schema, MC block names, layer ordering, palette consistency

import minecraftData from 'minecraft-data'

const mcData = minecraftData('1.21.1')

/**
 * Validate a blueprint JSON string as an LLM would produce it.
 *
 * Returns:
 *   { valid: true, blueprint: parsedObject } — all checks pass
 *   { valid: false, errors: string[] }       — one or more validation failures
 *
 * All errors are collected before returning — callers see the full picture.
 *
 * @param {string} jsonString
 * @returns {{ valid: true, blueprint: object } | { valid: false, errors: string[] }}
 */
export function validateBlueprint(jsonString) {
  const errors = []

  // ── 1. JSON parse ──
  let bp
  try {
    bp = JSON.parse(jsonString)
  } catch (err) {
    return { valid: false, errors: [`Invalid JSON: ${err.message}`] }
  }

  // ── 2. Required fields ──
  if (!bp.name || typeof bp.name !== 'string') {
    errors.push('Missing required field: name (must be a non-empty string)')
  }
  if (!bp.palette || typeof bp.palette !== 'object' || Array.isArray(bp.palette) || Object.keys(bp.palette).length === 0) {
    errors.push('Missing required field: palette (must be an object with at least one entry)')
  }
  if (!Array.isArray(bp.layers) || bp.layers.length === 0) {
    errors.push('Missing required field: layers (must be a non-empty array)')
  }

  // If fundamentals are missing, stop early — subsequent checks depend on them
  if (errors.length > 0) {
    return { valid: false, errors }
  }

  // ── 3. Size inference ──
  // If size is absent, infer from layers[0].grid: x = row length, z = row count, y = layer count
  if (!bp.size || typeof bp.size !== 'object') {
    const firstGrid = bp.layers[0]?.grid || []
    const inferredX = firstGrid[0]?.length ?? 0
    const inferredZ = firstGrid.length
    const inferredY = bp.layers.length
    bp = { ...bp, size: { x: inferredX, y: inferredY, z: inferredZ } }
  }

  const { x: sizeX, y: sizeY, z: sizeZ } = bp.size

  // ── 4. Palette block validation ──
  for (const [char, entry] of Object.entries(bp.palette)) {
    const preferred = Array.isArray(entry?.preferred) ? entry.preferred : []
    if (preferred.length === 0) {
      errors.push(`Palette '${char}': preferred[] is empty`)
      continue
    }
    const blockName = preferred[0]
    if (!mcData.blocksByName[blockName]) {
      errors.push(`Palette '${char}': unknown block '${blockName}'`)
    }
  }

  // ── 5. Layer y ordering ──
  for (let i = 1; i < bp.layers.length; i++) {
    const prev = bp.layers[i - 1]
    const curr = bp.layers[i]
    if (curr.y < prev.y) {
      errors.push(`Layer ${i} y=${curr.y} is not after layer ${i - 1} y=${prev.y} (layers must be in ascending y order)`)
    }
  }

  // ── 6, 7, 8. Grid dimension and palette key checks ──
  const paletteKeys = new Set(Object.keys(bp.palette))

  for (const layer of bp.layers) {
    const grid = layer.grid || []

    // Check row count (size.z)
    if (grid.length !== sizeZ) {
      errors.push(`Layer y=${layer.y}: ${grid.length} rows != expected ${sizeZ}`)
    }

    // Check each row
    for (let r = 0; r < grid.length; r++) {
      const row = grid[r]

      // Check row length (size.x)
      if (row.length !== sizeX) {
        errors.push(`Layer y=${layer.y} row ${r}: length ${row.length} != expected ${sizeX}`)
      }

      // Check each character: '.' and ' ' are air (skip), others must be in palette
      for (const char of row) {
        if (char === '.' || char === ' ') continue
        if (!paletteKeys.has(char)) {
          errors.push(`Layer y=${layer.y} row ${r}: unknown palette key '${char}'`)
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, blueprint: bp }
}
