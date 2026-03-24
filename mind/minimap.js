// minimap.js — Block-data rendering for VLM vision: top-down minimap + front elevation + composite

import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { Vec3 } from 'vec3'

// ── Block color map — expanded for richer renders ──

const BLOCK_COLORS = {
  // Natural terrain
  grass_block: '#5A8E3A', stone: '#888888', water: '#3A7BD5',
  sand: '#DCB96A', gravel: '#888070', dirt: '#9A6B4B',
  clay: '#9EA4B0', podzol: '#6B5A3A', mycelium: '#8B7A8B',
  mud: '#5C4A3A', moss_block: '#4A7A3A',
  // Wood
  oak_log: '#7A5C2E', birch_log: '#C8C8A0', spruce_log: '#5C3A1E',
  jungle_log: '#6A5A30', acacia_log: '#8A6A40', dark_oak_log: '#3A2A1A',
  cherry_log: '#D4A0A0', mangrove_log: '#6A3A2A',
  oak_planks: '#B8945A', spruce_planks: '#6A5030', birch_planks: '#D4C090',
  jungle_planks: '#A08050', acacia_planks: '#C87040', dark_oak_planks: '#4A3420',
  // Leaves
  oak_leaves: '#4A7A2A', spruce_leaves: '#3A5A2A', birch_leaves: '#5A8A3A',
  // Stone variants
  cobblestone: '#7A7A7A', stone_bricks: '#8A8A8A', mossy_cobblestone: '#6A7A5A',
  deepslate: '#4A4A4A', andesite: '#9A9A9A', diorite: '#C8C8C8', granite: '#A06848',
  // Ores
  coal_ore: '#404040', iron_ore: '#D8AF93', gold_ore: '#FCEE4B',
  diamond_ore: '#5DECF5', redstone_ore: '#FF0000', lapis_ore: '#1C3BAC',
  copper_ore: '#C87850', emerald_ore: '#17DD62',
  // Built blocks
  glass: '#C8E8FF', glass_pane: '#C8E8FF',
  torch: '#FFA500', lantern: '#FFD700',
  crafting_table: '#A07030', furnace: '#808080', chest: '#A07830',
  // Farming
  farmland: '#6A5030', wheat: '#D4B040',
  // Hazards
  snow: '#F0F0F0', ice: '#A0D0F0', lava: '#FF6000',
  obsidian: '#222222', bedrock: '#444444', netherrack: '#8B3030',
  // Decoration
  flower_pot: '#8A5A30',
  default: '#808080',
}

const AIR_BLOCKS = new Set(['air', 'cave_air', 'void_air'])

function getBlockColor(name) {
  if (!name || AIR_BLOCKS.has(name)) return null
  return BLOCK_COLORS[name] || BLOCK_COLORS.default
}

// ── Top-Down Minimap (enhanced) ──

// renderMinimap(bot, dataDir, radius) — renders a top-down PNG minimap from block data.
// Returns { path, buffer } with absolute file path and PNG Buffer, or null on any failure.
// NEVER throws.
export function renderMinimap(bot, dataDir, radius = 24) {
  if (!bot?.entity?.position) return null

  try {
    const p = bot.entity.position
    const pos = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) }
    const scale = 4  // 4px per block for better VLM readability
    const size = radius * 2 * scale
    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d')

    // Black background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, size, size)

    for (let dx = -radius; dx < radius; dx++) {
      for (let dz = -radius; dz < radius; dz++) {
        const startY = Math.min(pos.y + 32, 320)
        let color = null

        for (let dy = startY; dy >= Math.max(pos.y - 16, -64); dy--) {
          const block = bot.blockAt(new Vec3(pos.x + dx, dy, pos.z + dz))
          color = getBlockColor(block?.name)
          if (color) break
        }

        if (color) {
          ctx.fillStyle = color
          ctx.fillRect((dx + radius) * scale, (dz + radius) * scale, scale, scale)
        }
      }
    }

    // Mark bot position — red dot with direction indicator
    const centerX = radius * scale
    const centerZ = radius * scale
    ctx.fillStyle = '#FF0000'
    ctx.fillRect(centerX - 2, centerZ - 2, 5, 5)

    // Direction arrow based on yaw
    const yaw = bot.entity.yaw || 0
    const arrowLen = 8
    const ax = centerX + Math.round(-Math.sin(yaw) * arrowLen)
    const az = centerZ + Math.round(-Math.cos(yaw) * arrowLen)
    ctx.strokeStyle = '#FF4444'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(centerX, centerZ)
    ctx.lineTo(ax, az)
    ctx.stroke()

    // Label with "N" marker
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '10px sans-serif'
    ctx.fillText('N', size / 2 - 4, 12)

    // Save
    const screenshotsDir = join(dataDir, 'screenshots')
    mkdirSync(screenshotsDir, { recursive: true })
    const outPath = join(screenshotsDir, 'minimap.png')
    const buffer = canvas.toBuffer('image/png')
    writeFileSync(outPath, buffer)

    return { path: outPath, buffer }
  } catch {
    return null
  }
}

// ── Front Elevation View ──

// renderElevation(bot, dataDir) — renders a cross-section view of what's in front of the bot.
// Shows blocks from left-to-right and bottom-to-top, as seen from the bot's facing direction.
// Returns { path, buffer } or null.
// NEVER throws.
export function renderElevation(bot, dataDir) {
  if (!bot?.entity?.position) return null

  try {
    const p = bot.entity.position
    const pos = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) }
    const yaw = bot.entity.yaw || 0

    // Direction vectors from yaw (MC convention: yaw=0 is south, increases clockwise)
    const forwardX = -Math.sin(yaw)
    const forwardZ = -Math.cos(yaw)
    // Right vector (perpendicular to forward)
    const rightX = -forwardZ
    const rightZ = forwardX

    const viewWidth = 32   // blocks wide
    const viewHeight = 20  // blocks tall
    const viewDepth = 24   // blocks forward to scan
    const scale = 6        // px per block

    const canvas = createCanvas(viewWidth * scale, viewHeight * scale)
    const ctx = canvas.getContext('2d')

    // Sky gradient background
    const grad = ctx.createLinearGradient(0, 0, 0, viewHeight * scale)
    grad.addColorStop(0, '#87CEEB')   // sky blue
    grad.addColorStop(0.6, '#B0D8F0') // lighter
    grad.addColorStop(1, '#90B860')   // ground green
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, viewWidth * scale, viewHeight * scale)

    // Scan: for each column (left-right) and row (bottom-top), find the first non-air block
    // looking forward from the bot along the depth axis
    const baseY = pos.y - 4  // show 4 blocks below bot feet

    for (let col = 0; col < viewWidth; col++) {
      const lateralOffset = col - viewWidth / 2  // -16 to +15

      for (let row = 0; row < viewHeight; row++) {
        const blockY = baseY + row
        let foundColor = null

        // Scan forward along the depth axis to find the nearest block
        for (let depth = 1; depth <= viewDepth; depth++) {
          const bx = Math.round(pos.x + forwardX * depth + rightX * lateralOffset)
          const bz = Math.round(pos.z + forwardZ * depth + rightZ * lateralOffset)
          const block = bot.blockAt(new Vec3(bx, blockY, bz))
          const color = getBlockColor(block?.name)
          if (color) {
            // Darken by depth for pseudo-3D effect
            const darken = Math.max(0.4, 1 - depth / viewDepth * 0.6)
            foundColor = darkenColor(color, darken)
            break
          }
        }

        if (foundColor) {
          ctx.fillStyle = foundColor
          // Render bottom-to-top (row 0 = ground level, drawn at bottom)
          const py = (viewHeight - 1 - row) * scale
          ctx.fillRect(col * scale, py, scale, scale)
        }
      }
    }

    // Draw ground line at bot's Y level
    const groundRow = 4  // bot feet are 4 rows up from bottom
    const groundY = (viewHeight - 1 - groundRow) * scale
    ctx.strokeStyle = '#FFFFFF44'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(0, groundY)
    ctx.lineTo(viewWidth * scale, groundY)
    ctx.stroke()
    ctx.setLineDash([])

    // Direction label
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '10px sans-serif'
    const facing = yawToCardinal(yaw)
    ctx.fillText(`Facing ${facing}`, 4, 12)

    // Save
    const screenshotsDir = join(dataDir, 'screenshots')
    mkdirSync(screenshotsDir, { recursive: true })
    const outPath = join(screenshotsDir, 'elevation.png')
    const buffer = canvas.toBuffer('image/png')
    writeFileSync(outPath, buffer)

    return { path: outPath, buffer }
  } catch {
    return null
  }
}

// ── Composite View ──

// Synchronous composite — renders both views directly onto a single canvas.
// Renders both views directly onto a single canvas.
// Returns base64 JPEG string for VLM, or null on failure.
export function renderCompositeViewSync(bot, dataDir) {
  if (!bot?.entity?.position) return null

  try {
    const p = bot.entity.position
    const pos = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) }
    const yaw = bot.entity.yaw || 0

    const WIDTH = 256
    const ELEV_H = 140
    const MAP_H = 180
    const GAP = 20
    const TOTAL_H = ELEV_H + MAP_H + GAP * 3

    const canvas = createCanvas(WIDTH, TOTAL_H)
    const ctx = canvas.getContext('2d')

    // Dark background
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, WIDTH, TOTAL_H)

    // ── Section 1: Front elevation ──
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 11px sans-serif'
    ctx.fillText(`FRONT VIEW (facing ${yawToCardinal(yaw)})`, 4, 13)

    const forwardX = -Math.sin(yaw)
    const forwardZ = -Math.cos(yaw)
    const rightX = -forwardZ
    const rightZ = forwardX

    const viewW = 32
    const viewH = 18
    const viewDepth = 20
    const eScale = Math.floor(Math.min((WIDTH - 8) / viewW, ELEV_H / viewH))
    const eOffX = Math.round((WIDTH - viewW * eScale) / 2)
    const eOffY = GAP
    const baseY = pos.y - 3

    // Sky gradient
    const grad = ctx.createLinearGradient(eOffX, eOffY, eOffX, eOffY + viewH * eScale)
    grad.addColorStop(0, '#87CEEB')
    grad.addColorStop(0.7, '#B0D8F0')
    grad.addColorStop(1, '#6A9A50')
    ctx.fillStyle = grad
    ctx.fillRect(eOffX, eOffY, viewW * eScale, viewH * eScale)

    for (let col = 0; col < viewW; col++) {
      const lateralOffset = col - viewW / 2
      for (let row = 0; row < viewH; row++) {
        const blockY = baseY + row
        for (let depth = 1; depth <= viewDepth; depth++) {
          const bx = Math.round(pos.x + forwardX * depth + rightX * lateralOffset)
          const bz = Math.round(pos.z + forwardZ * depth + rightZ * lateralOffset)
          const block = bot.blockAt(new Vec3(bx, blockY, bz))
          const color = getBlockColor(block?.name)
          if (color) {
            const darken = Math.max(0.5, 1 - depth / viewDepth * 0.5)
            ctx.fillStyle = darkenColor(color, darken)
            ctx.fillRect(eOffX + col * eScale, eOffY + (viewH - 1 - row) * eScale, eScale, eScale)
            break
          }
        }
      }
    }

    // ── Section 2: Top-down minimap ──
    const mapY = ELEV_H + GAP * 2
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 11px sans-serif'
    ctx.fillText('TOP-DOWN MAP', 4, mapY + 11)

    const mRadius = 20
    const mScale = Math.floor(Math.min((WIDTH - 8) / (mRadius * 2), MAP_H / (mRadius * 2)))
    const mOffX = Math.round((WIDTH - mRadius * 2 * mScale) / 2)
    const mOffY = mapY + GAP

    // Black background for map
    ctx.fillStyle = '#000000'
    ctx.fillRect(mOffX, mOffY, mRadius * 2 * mScale, mRadius * 2 * mScale)

    for (let dx = -mRadius; dx < mRadius; dx++) {
      for (let dz = -mRadius; dz < mRadius; dz++) {
        const startY = Math.min(pos.y + 32, 320)
        for (let dy = startY; dy >= Math.max(pos.y - 16, -64); dy--) {
          const block = bot.blockAt(new Vec3(pos.x + dx, dy, pos.z + dz))
          const color = getBlockColor(block?.name)
          if (color) {
            ctx.fillStyle = color
            ctx.fillRect(mOffX + (dx + mRadius) * mScale, mOffY + (dz + mRadius) * mScale, mScale, mScale)
            break
          }
        }
      }
    }

    // Bot position marker
    const cx = mOffX + mRadius * mScale
    const cz = mOffY + mRadius * mScale
    ctx.fillStyle = '#FF0000'
    ctx.fillRect(cx - 2, cz - 2, 5, 5)

    // Direction arrow
    const arrowLen = 10
    const ax = cx + Math.round(-Math.sin(yaw) * arrowLen)
    const az = cz + Math.round(-Math.cos(yaw) * arrowLen)
    ctx.strokeStyle = '#FF4444'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx, cz)
    ctx.lineTo(ax, az)
    ctx.stroke()

    // North marker
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '9px sans-serif'
    ctx.fillText('N', mOffX + mRadius * mScale - 3, mOffY - 2)

    // Position text
    ctx.fillStyle = '#AAAAAA'
    ctx.font = '9px sans-serif'
    ctx.fillText(`${pos.x}, ${pos.y}, ${pos.z}`, 4, TOTAL_H - 4)

    // Output as JPEG for smaller size
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.80 })

    // Save to disk
    const screenshotsDir = join(dataDir, 'screenshots')
    mkdirSync(screenshotsDir, { recursive: true })
    writeFileSync(join(screenshotsDir, 'composite.jpg'), buffer)

    return buffer.toString('base64')
  } catch (err) {
    console.log('[minimap] composite render failed:', err.message)
    return null
  }
}

// ── Text Summary (unchanged) ──

export function getMinimapSummary(bot, radius = 32) {
  if (!bot?.entity?.position) return null

  try {
    const p = bot.entity.position
    const pos = { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) }
    const counts = {}

    for (let dx = -radius; dx < radius; dx++) {
      for (let dz = -radius; dz < radius; dz++) {
        const startY = Math.min(pos.y + 64, 320)
        for (let dy = startY; dy >= -64; dy--) {
          const block = bot.blockAt(new Vec3(pos.x + dx, dy, pos.z + dz))
          if (!block || AIR_BLOCKS.has(block.name)) continue
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
    return null
  }
}

// ── Helpers ──

function darkenColor(hex, factor) {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor)
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor)
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor)
  return `rgb(${r},${g},${b})`
}

function yawToCardinal(yaw) {
  // MC yaw: 0=south, pi/2=west, pi=north, 3pi/2=east (radians)
  const deg = ((yaw * 180 / Math.PI) % 360 + 360) % 360
  const dirs = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']
  return dirs[Math.round(deg / 45) % 8]
}
