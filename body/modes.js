// modes.js -- 300ms autonomous body tick: survival, combat, unstuck, pickup, idle

import { attackTarget, HOSTILE_MOBS } from './skills/combat.js'
import { eatIfHungry, equipBestArmor } from './skills/inventory.js'
import { navigateTo } from './navigate.js'
import { requestInterrupt } from './interrupt.js'
import minecraftData from 'minecraft-data'

const mcData = minecraftData('1.21.1')

// ── Constants ──

const TICK_MS = 300
const FIRE_BLOCKS = new Set(['fire', 'soul_fire', 'lava', 'campfire', 'soul_campfire'])
const HAZARD_FLEE_HEALTH = 16    // flee environmental hazards when < 8 hearts
const EAT_THRESHOLD = 14         // eat when food < 14 (sprint disabled)
const STUCK_TICK_THRESHOLD = 10  // 10 x 300ms = 3 seconds
const ITEM_PICKUP_RANGE = 8      // scan radius for dropped items
const IDLE_LOOK_RANGE = 16       // scan radius for entities to look at
const COMBAT_ENGAGE_RANGE = 8    // engage hostiles within 8 blocks

// ── Module-level Mutable State ──

let _lastPos = null        // stuck detection: last recorded position
let _stuckTicks = 0        // stuck detection: consecutive ticks without movement
let _lastLookTime = 0      // idle look cooldown — once per 3s, not every 300ms
let _lastArmorCheck = 0    // armor equip cooldown — once per 30s
let _tickBusy = false      // guard against overlapping async ticks

// ── Helpers ──

/**
 * Check if the bot is in an environmental hazard.
 * Returns hazard type string ('fire', 'lava', 'drowning') or null.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {string|null}
 */
function isInHazard(bot) {
  const feetPos = bot.entity.position.floored()
  const feetBlock = bot.blockAt(feetPos)
  if (feetBlock && FIRE_BLOCKS.has(feetBlock.name)) return 'fire'

  // Also check body level for lava
  const bodyBlock = bot.blockAt(feetPos.offset(0, 1, 0))
  if (bodyBlock && bodyBlock.name === 'lava') return 'lava'

  if (bot.oxygenLevel <= 3) return 'drowning'
  return null
}

// ── Priority Behavior Checks ──

/**
 * Priority 0: Night shelter — navigate home at dusk/night when far from home.
 * Only fires when no skill is running (does NOT interrupt active skills).
 * Reads home coordinates from bot.homeLocation (set by start.js and !sethome).
 * No mind/ imports — home is passed via bot property, preserving mind/body boundary.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {Function} getSkillRunning
 * @returns {Promise<boolean>} true if navigation to shelter was initiated
 */
async function checkNightShelter(bot, getSkillRunning) {
  if (getSkillRunning()) return false
  const timeOfDay = bot.time?.timeOfDay ?? 0
  // Seek shelter starting at dusk (12500) through night, skip pre-dawn (>23000)
  if (timeOfDay < 12500 || timeOfDay > 23000) return false
  const home = bot.homeLocation
  if (!home) return false
  const pos = bot.entity.position
  const dist = Math.sqrt((pos.x - home.x) ** 2 + (pos.z - home.z) ** 2)
  if (dist < 10) return false  // already near home
  console.log('[modes] night shelter -- navigating home')
  await navigateTo(bot, home.x, home.y, home.z, 3, 30000)
  return true
}

/**
 * Priority 1: Self-preservation — eat if hungry, flee hazards.
 * Always fires, even during active skills (starvation and fire override).
 * Interrupts active skill if critical hazard detected.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {Function} getSkillRunning
 * @returns {Promise<boolean>} true if any action was taken
 */
async function checkSurvival(bot, getSkillRunning) {
  // Auto-eat: starvation override fires even during skills
  if (bot.food <= 2) {
    // Critical starvation — eat regardless of active skill
    await eatIfHungry(bot, EAT_THRESHOLD)
    return true
  }
  if (bot.food < EAT_THRESHOLD && !getSkillRunning()) {
    await eatIfHungry(bot, EAT_THRESHOLD)
    return true
  }

  // Auto-equip best armor (every 30s when idle)
  const now = Date.now()
  if (now - _lastArmorCheck > 30000 && !getSkillRunning()) {
    _lastArmorCheck = now
    await equipBestArmor(bot)
  }

  // Water detection — swim up immediately if underwater, regardless of health
  if (bot.entity.isInWater && bot.oxygenLevel < 15) {
    if (getSkillRunning()) requestInterrupt(bot)
    // Jump repeatedly to swim up — more reliable than pathfinder in water
    bot.setControlState('jump', true)
    bot.setControlState('forward', true)
    // Also try to find land and navigate there
    const pos = bot.entity.position
    const landSearch = bot.findBlock({
      matching: b => b.name !== 'water' && b.name !== 'air' && b.boundingBox === 'block',
      maxDistance: 16,
      count: 1,
    })
    if (landSearch) {
      console.log('[modes] underwater — swimming toward land at', landSearch.position.x, landSearch.position.z)
      await navigateTo(bot, landSearch.position.x, landSearch.position.y + 1, landSearch.position.z, 2, 8000)
    } else {
      // No land found — just swim up for 3 seconds
      console.log('[modes] underwater — swimming up')
      await new Promise(r => setTimeout(r, 3000))
    }
    bot.setControlState('jump', false)
    bot.setControlState('forward', false)
    return true
  }

  // Hazard flee: check environmental hazards
  const hazard = isInHazard(bot)
  if (hazard && bot.health < HAZARD_FLEE_HEALTH) {
    // Interrupt any active skill cooperatively before fleeing
    if (getSkillRunning()) {
      requestInterrupt(bot)
    }

    if (hazard === 'drowning') {
      // Navigate upward to surface — jump + navigate combo
      bot.setControlState('jump', true)
      const up = bot.entity.position.offset(0, 5, 0)
      await navigateTo(bot, Math.floor(up.x), Math.floor(up.y), Math.floor(up.z), 1, 5000)
      bot.setControlState('jump', false)
    } else {
      // Fire/lava: run in the opposite direction from the hazard source
      // Use the bot's current velocity direction (inverted) or fall back to +X
      const vel = bot.entity.velocity
      const hasVelocity = Math.abs(vel.x) + Math.abs(vel.z) > 0.01
      const fleeDir = hasVelocity
        ? bot.entity.position.offset(-vel.x * 20, 0, -vel.z * 20)
        : bot.entity.position.offset(5, 0, 0)
      await navigateTo(
        bot,
        Math.floor(fleeDir.x),
        Math.floor(fleeDir.y),
        Math.floor(fleeDir.z),
        1,
        5000,
      )
    }
    console.log(`[modes] hazard flee — type: ${hazard}`)
    return true
  }

  return false
}

/**
 * Priority 2: Combat — attack nearest hostile mob within engage range.
 * Only fires when no skill is running (P2 is gated).
 * Calls attackTarget (single hit per tick, non-blocking) not combatLoop.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {Promise<boolean>} true if attack was attempted
 */
async function checkCombat(bot) {
  const target = bot.nearestEntity(e =>
    e.type === 'mob' &&
    HOSTILE_MOBS.has(e.name) &&
    e.position.distanceTo(bot.entity.position) < COMBAT_ENGAGE_RANGE
  )
  if (!target) return false

  await attackTarget(bot, target)
  return true
}

/**
 * Priority 3: Unstuck detection — halt pathfinder if bot is moving but not progressing.
 * Only fires when no skill is running (P3 is gated).
 * Threshold: 10 ticks (3s) of isMoving() with position delta < 0.5 blocks.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {boolean} true if stuck recovery was triggered
 */
function checkStuck(bot) {
  const pos = bot.entity.position
  const isMoving = bot.pathfinder.isMoving()

  if (!isMoving) {
    _stuckTicks = 0
    _lastPos = null
    return false
  }

  if (_lastPos && pos.distanceTo(_lastPos) < 0.5) {
    _stuckTicks++
    if (_stuckTicks >= STUCK_TICK_THRESHOLD) {
      bot.pathfinder.setGoal(null)
      _stuckTicks = 0
      _lastPos = null
      console.log('[modes] stuck detected — halting pathfinder')
      return true
    }
  } else {
    _stuckTicks = 0
  }

  _lastPos = pos.clone()
  return false
}

/**
 * Priority 4: Item auto-pickup — navigate to nearest dropped item within range.
 * Only fires when no skill is running AND bot is not already moving.
 * Uses entity.name === 'item' (NOT entity.type per Pitfall 3).
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {Promise<boolean>} true if pickup navigation was started
 */
async function checkItemPickup(bot) {
  const botPos = bot.entity.position

  // Scan for dropped items (entity.name === 'item', NOT entity.type)
  const items = Object.values(bot.entities).filter(e =>
    e.name === 'item' &&
    e.position.distanceTo(botPos) < ITEM_PICKUP_RANGE
  )

  if (items.length === 0) return false

  // Sort by distance ascending, pick closest
  items.sort((a, b) =>
    a.position.distanceTo(botPos) - b.position.distanceTo(botPos)
  )
  const item = items[0]

  // Navigate to within 1 block — server sends playerCollect automatically on proximity
  await navigateTo(
    bot,
    Math.floor(item.position.x),
    Math.floor(item.position.y),
    Math.floor(item.position.z),
    1,
    3000,
  )
  return true
}

/**
 * Priority 5: Idle look-at — look at a nearby entity when idle.
 * Only fires when no skill is running AND bot is not moving.
 * Rate-limited to once per 3s to avoid spam.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {Promise<boolean>} true if looked at something
 */
async function checkIdleLook(bot) {
  // Rate limit: look at something at most every 3s
  if (Date.now() - _lastLookTime < 3000) return false

  const entity = bot.nearestEntity(e =>
    e !== bot.entity &&
    e.position.distanceTo(bot.entity.position) < IDLE_LOOK_RANGE
  )
  if (!entity) return false

  await bot.lookAt(entity.position.offset(0, entity.height / 2, 0))
  _lastLookTime = Date.now()
  return true
}

/**
 * Priority 5: Torch placement — place torch when light level is dangerously low.
 * Prevents mob spawns and helps visibility in caves/night.
 * Only places if bot has torches in inventory and light < 7 at feet.
 * Rate-limited to once per 10s to avoid spamming.
 *
 * @param {import('mineflayer').Bot} bot
 * @returns {Promise<boolean>} true if a torch was placed
 */
let _lastTorchTime = 0
async function checkTorchPlacement(bot) {
  if (Date.now() - _lastTorchTime < 10000) return false

  const feetPos = bot.entity.position.floored()
  const block = bot.blockAt(feetPos)
  if (!block || block.light >= 7) return false  // bright enough

  const torch = bot.inventory.items().find(i => i.name === 'torch' || i.name === 'soul_torch')
  if (!torch) return false

  // Find a solid block below to place torch on
  const belowPos = feetPos.offset(0, -1, 0)
  const belowBlock = bot.blockAt(belowPos)
  if (!belowBlock || belowBlock.name === 'air' || belowBlock.name === 'water') return false

  try {
    await bot.equip(torch, 'hand')
    await bot.placeBlock(belowBlock, { x: 0, y: 1, z: 0 })
    console.log('[modes] torch placed — light was', block.light)
    _lastTorchTime = Date.now()
    return true
  } catch {
    return false
  }
}

// ── Main Tick Function ──

/**
 * bodyTick(bot, getSkillRunning) — runs every 300ms.
 * Priority cascade: night shelter > survival > combat > stuck > item pickup > idle look.
 * _tickBusy guard prevents overlapping async ticks.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {Function} getSkillRunning
 */
async function bodyTick(bot, getSkillRunning) {
  if (_tickBusy) return  // previous tick still running
  _tickBusy = true
  try {
    // Priority 0: Night shelter — go home at dusk/night if far from home (gated on no skill)
    if (await checkNightShelter(bot, getSkillRunning)) return

    // Priority 1: Survival — fires even during active skills
    if (await checkSurvival(bot, getSkillRunning)) return

    // Priorities 2-5 gated on no active skill
    if (getSkillRunning()) return

    // Priority 2: Combat
    if (await checkCombat(bot)) return

    // Priority 3: Unstuck (synchronous)
    if (checkStuck(bot)) return

    // Priorities 4-6 only when not already moving
    if (!bot.pathfinder.isMoving()) {
      if (await checkItemPickup(bot)) return
      if (await checkTorchPlacement(bot)) return
      await checkIdleLook(bot)
    }
  } catch (err) {
    // Body tick must never crash — log and continue
    console.error('[modes] tick error:', err.message)
  } finally {
    _tickBusy = false
  }
}

// ── Exported Init ──

/**
 * initModes(bot, getSkillRunning) — start the 300ms autonomous body tick.
 *
 * Accepts a getter function for skillRunning so body/ never imports from mind/.
 * start.js owns the bridge: it passes isSkillRunning from mind/index.js here.
 *
 * @param {import('mineflayer').Bot} bot
 * @param {Function} getSkillRunning — returns boolean, true if a skill is active
 * @returns {NodeJS.Timeout} interval ID (can be cleared in tests or shutdown)
 */
export function initModes(bot, getSkillRunning) {
  const intervalId = setInterval(() => bodyTick(bot, getSkillRunning), TICK_MS)
  console.log('[modes] body tick started — 300ms interval')
  return intervalId
}
