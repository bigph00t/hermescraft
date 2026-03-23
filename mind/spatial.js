// spatial.js — Spatial awareness for LLM prompt injection
// Gives agents "eyes" by reading blocks around them every think() call.
// Three tiers: immediate (6 adjacent, <1ms), near vision (8b radius, cached 3s), terrain context (<0.5ms)

import { Vec3 } from 'vec3'

// ── Block classification sets ──

const HAZARD_BLOCKS = new Set([
  'lava', 'fire', 'soul_fire', 'campfire', 'soul_campfire',
  'magma_block', 'cactus', 'sweet_berry_bush', 'wither_rose', 'powder_snow',
])

const WATER_BLOCKS = new Set(['water'])

const ORE_BLOCKS = new Set([
  'coal_ore', 'deepslate_coal_ore', 'iron_ore', 'deepslate_iron_ore',
  'copper_ore', 'deepslate_copper_ore', 'gold_ore', 'deepslate_gold_ore',
  'diamond_ore', 'deepslate_diamond_ore', 'redstone_ore', 'deepslate_redstone_ore',
  'emerald_ore', 'deepslate_emerald_ore', 'lapis_ore', 'deepslate_lapis_ore',
  'nether_gold_ore', 'nether_quartz_ore', 'ancient_debris',
])

const TREE_LOGS = new Set([
  'oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log',
  'dark_oak_log', 'cherry_log', 'mangrove_log', 'bamboo_block',
])

const CONTAINER_BLOCKS = new Set([
  'chest', 'trapped_chest', 'barrel', 'ender_chest',
  'furnace', 'blast_furnace', 'smoker',
])

const PASSABLE = new Set([
  'air', 'cave_air', 'void_air', 'tall_grass', 'short_grass',
  'fern', 'large_fern', 'dead_bush', 'water',
])

const INTERESTING = new Set([...HAZARD_BLOCKS, ...ORE_BLOCKS, ...TREE_LOGS, ...WATER_BLOCKS, ...CONTAINER_BLOCKS])

// ── Near vision cache ──

let _cachedNearVision = null
let _cachedNearVisionTime = 0
const NEAR_VISION_TTL = 3000

// ── Direction helpers ──

function cardinalDir(dx, dz) {
  // MC: +X=East, -X=West, +Z=South, -Z=North
  const angle = Math.atan2(dx, -dz) * 180 / Math.PI
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const idx = Math.round(((angle + 360) % 360) / 45) % 8
  return dirs[idx]
}

function describeRelative(botPos, targetPos) {
  const dx = targetPos.x - botPos.x
  const dz = targetPos.z - botPos.z
  const dy = targetPos.y - botPos.y
  const dist = Math.round(Math.sqrt(dx * dx + dz * dz))
  const dir = cardinalDir(dx, dz)
  let vertical = ''
  if (dy > 2) vertical = ' above'
  else if (dy < -2) vertical = ' below'
  return `${dist}b ${dir}${vertical}`
}

function isSolid(block) {
  if (!block) return false
  return !PASSABLE.has(block.name)
}

// ── Tier 1: Immediate awareness (<1ms) ──

function getImmediate(bot) {
  const pos = bot.entity.position.floored()

  const feet = bot.blockAt(pos)
  const ground = bot.blockAt(pos.offset(0, -1, 0))
  const head = bot.blockAt(pos.offset(0, 1, 0))
  const ceiling = bot.blockAt(pos.offset(0, 2, 0))

  // 4 cardinals at foot level
  const cardinals = [
    { dir: 'N', block: bot.blockAt(pos.offset(0, 0, -1)) },
    { dir: 'S', block: bot.blockAt(pos.offset(0, 0, 1)) },
    { dir: 'E', block: bot.blockAt(pos.offset(1, 0, 0)) },
    { dir: 'W', block: bot.blockAt(pos.offset(-1, 0, 0)) },
  ]

  // Stuck detection
  const wallCount = cardinals.filter(c => isSolid(c.block)).length
  const ceilingBlocked = isSolid(ceiling)
  const floorSolid = isSolid(ground)

  let trapped = null
  if (feet && isSolid(feet) && feet.name !== 'water') {
    trapped = 'buried in solid block — dig ANY direction immediately'
  } else if (wallCount >= 4 && ceilingBlocked && floorSolid) {
    trapped = 'walled in on all sides — dig sideways or pillar up'
  } else if (wallCount >= 3 && ceilingBlocked) {
    trapped = 'cornered — turn around or dig through a wall'
  }

  // Pit detection: check for drops in open directions
  const pits = []
  for (const c of cardinals) {
    if (!isSolid(c.block)) {
      // Check 3 blocks below in that direction
      const below1 = bot.blockAt(pos.offset(
        c.dir === 'E' ? 1 : c.dir === 'W' ? -1 : 0,
        -1,
        c.dir === 'S' ? 1 : c.dir === 'N' ? -1 : 0,
      ))
      const below2 = bot.blockAt(pos.offset(
        c.dir === 'E' ? 1 : c.dir === 'W' ? -1 : 0,
        -2,
        c.dir === 'S' ? 1 : c.dir === 'N' ? -1 : 0,
      ))
      if (!isSolid(below1) && !isSolid(below2)) {
        pits.push(c.dir)
      }
    }
  }

  // Hazard in adjacent blocks
  const hazards = []
  for (const c of cardinals) {
    if (c.block && HAZARD_BLOCKS.has(c.block.name)) {
      hazards.push(`${c.block.name} ${c.dir}`)
    }
  }
  // Check below too
  if (ground && HAZARD_BLOCKS.has(ground.name)) hazards.push(`${ground.name} below`)
  if (ceiling && HAZARD_BLOCKS.has(ceiling.name)) hazards.push(`${ceiling.name} above`)

  const lightLevel = feet?.light ?? head?.light ?? 0
  const headroom = bot.entity.isInWater ? 'water'
    : (head && HAZARD_BLOCKS.has(head.name)) ? head.name
    : (isSolid(head) || isSolid(ceiling)) ? 'blocked'
    : 'clear'

  return {
    ground: ground?.name || 'air',
    headroom,
    lightLevel,
    trapped,
    pits,
    hazards,
    inWater: bot.entity.isInWater || false,
  }
}

// ── Tier 2: Near vision (cached 3s, ~5ms) ──

function getNearVision(bot) {
  const botPos = bot.entity.position

  // Single findBlocks call for all interesting blocks within 16 blocks
  let positions
  try {
    positions = bot.findBlocks({
      matching: b => INTERESTING.has(b.name),
      maxDistance: 16,
      count: 40,
    })
  } catch {
    return { hazards: [], ores: [], trees: [], water: [], containers: [] }
  }

  const result = { hazards: [], ores: [], trees: [], water: [], containers: [] }

  for (const pos of positions) {
    const block = bot.blockAt(pos)
    if (!block) continue
    const name = block.name
    const desc = `${name} ${describeRelative(botPos, pos)}`

    if (HAZARD_BLOCKS.has(name)) result.hazards.push(desc)
    else if (ORE_BLOCKS.has(name)) result.ores.push(desc)
    else if (TREE_LOGS.has(name)) result.trees.push(desc)
    else if (WATER_BLOCKS.has(name)) result.water.push(`water ${describeRelative(botPos, pos)}`)
    else if (CONTAINER_BLOCKS.has(name)) result.containers.push(desc)
  }

  return result
}

// ── Tier 3: Terrain context (<0.5ms) ──

function getTerrainContext(bot) {
  const y = bot.entity.position.y
  const pos = bot.entity.position.floored()
  const dim = bot.game?.dimension || 'overworld'

  if (dim === 'the_nether') return 'nether'
  if (dim === 'the_end') return 'the end'

  if (bot.entity.isInWater) {
    const above = bot.blockAt(pos.offset(0, 2, 0))
    if (above && above.name === 'water') return 'underwater (drowning risk!)'
    return 'in water'
  }

  // Check if underground: solid blocks overhead
  const overhead1 = bot.blockAt(pos.offset(0, 3, 0))
  const overhead2 = bot.blockAt(pos.offset(0, 5, 0))

  if (y < 0) return 'deep underground'
  if (y < 56 && overhead1 && isSolid(overhead1)) return 'underground'
  if (y < 63 && overhead1 && isSolid(overhead1)) return 'in cave'
  if (y > 200) return 'high altitude'

  return 'surface'
}

// ── Main export ──

export function buildSpatialAwareness(bot) {
  if (!bot.entity?.position) return ''

  const imm = getImmediate(bot)
  const terrain = getTerrainContext(bot)

  // Near vision — cached
  const now = Date.now()
  let near = _cachedNearVision
  if (!near || (now - _cachedNearVisionTime) > NEAR_VISION_TTL) {
    near = getNearVision(bot)
    _cachedNearVision = near
    _cachedNearVisionTime = now
  }

  // ── Facing direction from yaw + pitch ──
  const yaw = bot.entity.yaw || 0
  const pitch = bot.entity.pitch || 0
  // MC yaw: 0=south, pi/2=west, pi=north, 3pi/2=east (increases counterclockwise)
  // Convert to degrees, normalize to 0-360, map to cardinal
  const yawDeg = (((-yaw * 180 / Math.PI) % 360) + 360) % 360
  const facingDirs = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']
  const facingDir = facingDirs[Math.round(yawDeg / 45) % 8]
  const pitchDesc = pitch > 0.5 ? 'looking down' : pitch < -0.5 ? 'looking up' : 'looking level'

  // ── Format output ──
  const lines = []

  // Line 1: terrain + light + facing
  lines.push(`terrain: ${terrain} | light: ${imm.lightLevel} | facing: ${facingDir} (${pitchDesc})`)

  // Line 2: ground + headroom
  lines.push(`ground: ${imm.ground} | headroom: ${imm.headroom}`)

  // Line 3: ALERTS (conditional)
  if (imm.trapped) {
    lines.push(`TRAPPED: ${imm.trapped}`)
  }
  if (imm.inWater && terrain.includes('underwater')) {
    lines.push('DANGER: underwater — swim up immediately')
  }
  if (near.hazards.length > 0 || imm.hazards.length > 0) {
    const allHazards = [...imm.hazards, ...near.hazards.slice(0, 3)]
    lines.push(`DANGER: ${allHazards.slice(0, 4).join(', ')}`)
  }
  if (imm.pits.length > 0) {
    lines.push(`PIT: drop to ${imm.pits.join(', ')}`)
  }

  // Line 4: nearby resources
  const around = [
    ...near.ores.slice(0, 3),
    ...near.trees.slice(0, 2),
    ...near.containers.slice(0, 2),
    ...(near.water.length > 0 ? [near.water[0]] : []),
  ].slice(0, 6)

  if (around.length > 0) {
    lines.push(`around: ${around.join(', ')}`)
  }

  return lines.join('\n')
}
