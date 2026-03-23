// minimap.js — Top-down minimap from block data + text terrain summary (no VLM needed)

import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// ── Block color map for minimap rendering ──

const BLOCK_COLORS = {
  grass_block: '#5A8E3A', stone: '#888888', water: '#3A7BD5',
  sand: '#DCB96A', gravel: '#888070', dirt: '#9A6B4B',
  oak_log: '#7A5C2E', birch_log: '#C8C8A0', spruce_log: '#5C3A1E',
  snow: '#F0F0F0', ice: '#A0D0F0', lava: '#FF6000',
  obsidian: '#222222', bedrock: '#444444', netherrack: '#8B3030',
  default: '#808080',
}

// ── Exported Functions ──

// renderMinimap(bot, dataDir, radius) — renders a top-down PNG minimap from block data.
// Returns absolute file path of written PNG, or null on any failure (no bot position, canvas error, etc.)
// NEVER throws.
export function renderMinimap(bot, dataDir, radius = 32) {
  if (!bot?.entity?.position) return null

  try {
    const pos = bot.entity.position.floored()
    const size = radius * 2
    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d')

    for (let dx = -radius; dx < radius; dx++) {
      for (let dz = -radius; dz < radius; dz++) {
        // Walk y from top of range downward to find first non-air surface block
        // Start from bot y + 64 (capped at 320) and walk down to -64
        const startY = Math.min(pos.y + 64, 320)
        let color = BLOCK_COLORS.default

        for (let dy = startY; dy >= -64; dy--) {
          const block = bot.blockAt({ x: pos.x + dx, y: dy, z: pos.z + dz })
          if (!block || block.name === 'air' || block.name === 'cave_air' || block.name === 'void_air') continue
          color = BLOCK_COLORS[block.name] || BLOCK_COLORS.default
          break
        }

        ctx.fillStyle = color
        ctx.fillRect(dx + radius, dz + radius, 1, 1)
      }
    }

    // Mark bot position as 3x3 red dot at center
    ctx.fillStyle = '#FF0000'
    ctx.fillRect(radius - 1, radius - 1, 3, 3)

    // Save to data/<agent>/screenshots/minimap.png
    const screenshotsDir = join(dataDir, 'screenshots')
    mkdirSync(screenshotsDir, { recursive: true })
    const outPath = join(screenshotsDir, 'minimap.png')
    writeFileSync(outPath, canvas.toBuffer('image/png'))

    return outPath
  } catch {
    // Canvas errors, bot position undefined mid-call, file write errors — return null
    return null
  }
}

// getMinimapSummary(bot, radius) — scans terrain in a 2*radius x 2*radius area and returns
// a compact text summary of the top 5 block types by count. No VLM needed — pure block data.
// Returns summary string, or null on any failure.
// NEVER throws.
export function getMinimapSummary(bot, radius = 32) {
  if (!bot?.entity?.position) return null

  try {
    const pos = bot.entity.position.floored()
    const counts = {}

    for (let dx = -radius; dx < radius; dx++) {
      for (let dz = -radius; dz < radius; dz++) {
        const startY = Math.min(pos.y + 64, 320)
        for (let dy = startY; dy >= -64; dy--) {
          const block = bot.blockAt({ x: pos.x + dx, y: dy, z: pos.z + dz })
          if (!block || block.name === 'air' || block.name === 'cave_air' || block.name === 'void_air') continue
          counts[block.name] = (counts[block.name] || 0) + 1
          break
        }
      }
    }

    const top5 = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name}*${count}`)
      .join(', ')

    const areaSize = radius * 2
    return `Terrain (${areaSize}x${areaSize} area): ${top5}`
  } catch {
    // Block read error, position undefined mid-call — return null
    return null
  }
}
