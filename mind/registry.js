// registry.js -- Command name to body/ skill dispatch bridge
// The ONLY file in mind/ that imports from body/. Mind boundary enforced here.

import { gather } from '../body/skills/gather.js'
import { mine } from '../body/skills/mine.js'
import { craft } from '../body/skills/craft.js'
import { smelt } from '../body/skills/smelt.js'
import { navigateTo } from '../body/navigate.js'
import { requestInterrupt, clearInterrupt } from '../body/interrupt.js'
import { combatLoop, HOSTILE_MOBS } from '../body/skills/combat.js'
import { build, updatePalette } from '../body/skills/build.js'
import { scanArea } from '../body/skills/scan.js'
import { depositToChest, withdrawFromChest } from '../body/skills/chest.js'
import { farm } from '../body/skills/farm.js'
import { breed } from '../body/skills/breed.js'
import { harvest } from '../body/skills/harvest.js'
import { hunt } from '../body/skills/hunt.js'
import { explore } from '../body/skills/explore.js'
import { mountBoat, dismountBoat } from '../body/skills/boat.js'
import { lookChest, lookInventory, lookHorizon, lookPlayers } from '../body/skills/look.js'
import { give } from '../body/skills/give.js'
import { clear } from '../body/skills/clear.js'
import { buildRoad } from '../body/skills/road.js'

// REGISTRY maps !command names to async handler functions.
// Args come in as strings from parseCommand — registry must parseInt() numeric args.
// The body/ skills handle their own item name normalization internally.
const REGISTRY = new Map([
  ['gather',   (bot, args) => gather(bot, args.item, parseInt(args.count) || 1, { maxCycles: 1 })],
  ['mine',     (bot, args) => mine(bot, args.item, parseInt(args.count) || 1, { maxCycles: 1 })],
  ['craft',    (bot, args) => craft(bot, args.item, parseInt(args.count) || 1)],
  ['smelt',    (bot, args) => smelt(bot, args.item, args.fuel || 'coal', parseInt(args.count) || 1)],
  ['navigate', (bot, args) => navigateTo(bot, parseInt(args.x), parseInt(args.y), parseInt(args.z))],
  ['chat',     (bot, args) => {
    const msg = args.message || ''
    bot.chat(msg)
    return { success: true }
  }],
  ['drop',     async (bot, args) => {
    const name = args.item
    const count = parseInt(args.count) || 1
    if (!name) return { success: false, reason: 'specify item name. Usage: !drop item:oak_log count:1' }
    const item = bot.inventory.items().find(i => i.name === name || i.name.includes(name))
    if (!item) return { success: false, reason: `no ${name} in inventory` }
    const toDrop = Math.min(count, item.count)
    try {
      await bot.toss(item.type, null, toDrop)
      console.log(`[drop] dropped ${toDrop}x ${item.name}`)
      return { success: true, reason: `dropped ${toDrop}x ${item.name}` }
    } catch (err) {
      return { success: false, reason: err.message }
    }
  }],
  ['idle',     (_bot, _args) => Promise.resolve({ success: true, reason: 'idle' })],
  ['combat',   (bot, _args) => {
    const target = bot.nearestEntity(e =>
      e.type === 'mob' &&
      HOSTILE_MOBS.has(e.name) &&
      e.position.distanceTo(bot.entity.position) < 16
    )
    if (!target) return Promise.resolve({ success: false, reason: 'no_hostile_nearby' })
    console.log(`[combat] engaging ${target.name} at distance ${target.position.distanceTo(bot.entity.position).toFixed(1)}`)
    return combatLoop(bot, target)
  }],
  ['deposit',  (bot, args) => {
    const block = bot.findBlock({ matching: b => b.name === 'chest' || b.name === 'trapped_chest' || b.name === 'barrel', maxDistance: 64 })
    if (!block) return Promise.resolve({ success: false, reason: 'no chest/barrel found within 32 blocks' })
    return depositToChest(bot, block, args.item, parseInt(args.count) || 1)
  }],
  ['withdraw', (bot, args) => {
    const block = bot.findBlock({ matching: b => b.name === 'chest' || b.name === 'trapped_chest' || b.name === 'barrel', maxDistance: 64 })
    if (!block) return Promise.resolve({ success: false, reason: 'no chest/barrel found within 32 blocks' })
    return withdrawFromChest(bot, block, args.item, parseInt(args.count) || 1)
  }],
  ['build',    (bot, args) => {
    const name = args.blueprint || args.blueprintName || args.name
    const x = parseInt(args.x)
    const y = parseInt(args.y)
    const z = parseInt(args.z)
    if (!name) return Promise.resolve({ success: false, reason: 'missing blueprint name. Usage: !build blueprint:small_cabin x:N y:N z:N' })
    if (isNaN(x) || isNaN(y) || isNaN(z)) return Promise.resolve({ success: false, reason: 'missing coordinates. Usage: !build blueprint:small_cabin x:N y:N z:N' })
    return build(bot, name, x, y, z)
  }],
  // !design is handled in mind/index.js think() BEFORE dispatch is called (like !sethome).
  // This entry ensures listCommands() includes 'design' for help text and acts as a safety net.
  ['design',   (_bot, _args) => {
    return Promise.resolve({ success: false, reason: 'design must be handled by the Mind loop — description:"your idea here"' })
  }],
  // !plan is handled in mind/index.js think() BEFORE dispatch is called (like !design).
  // This entry ensures listCommands() includes 'plan' for help text.
  ['plan',     (_bot, _args) => {
    return Promise.resolve({ success: false, reason: 'plan must be handled by the Mind loop — description:"your idea here"' })
  }],
  // !builds is handled in mind/index.js think() BEFORE dispatch is called.
  ['builds',   (_bot, _args) => {
    return Promise.resolve({ success: false, reason: 'builds must be handled by the Mind loop' })
  }],
  // !survey is handled in mind/index.js think() BEFORE dispatch is called.
  ['survey',   (_bot, _args) => {
    return Promise.resolve({ success: false, reason: 'survey must be handled by the Mind loop' })
  }],
  // !wiki is handled in mind/index.js respondToChat() BEFORE dispatch is called.
  // This entry ensures listCommands() includes 'wiki' for command documentation.
  ['wiki',     (_bot, _args) => {
    return Promise.resolve({ success: false, reason: 'wiki is handled by chat response — use !wiki query in chat' })
  }],
  // !see is handled in mind/index.js think() BEFORE dispatch is called.
  // This entry ensures listCommands() includes 'see' for help text and acts as a safety net.
  ['see',      (_bot, _args) => {
    return Promise.resolve({ success: false, reason: 'see must be handled by the Mind loop — use focus:"what to look for"' })
  }],
  ['scan', (bot, args) => {
    const pos = bot.entity.position
    // Default: 16x8x16 box centered on bot if no coords given
    const x1 = parseInt(args.x1) || Math.round(pos.x) - 8
    const y1 = parseInt(args.y1) || Math.round(pos.y) - 4
    const z1 = parseInt(args.z1) || Math.round(pos.z) - 8
    const x2 = parseInt(args.x2) || Math.round(pos.x) + 8
    const y2 = parseInt(args.y2) || Math.round(pos.y) + 4
    const z2 = parseInt(args.z2) || Math.round(pos.z) + 8
    return Promise.resolve(scanArea(bot, x1, y1, z1, x2, y2, z2))
  }],
  ['farm',     (bot, args) => farm(bot, args.seed || args.item || 'wheat_seeds', parseInt(args.count) || 4, { maxCycles: 1 })],
  ['breed',    (bot, args) => breed(bot, args.animal || args.type || 'cow')],
  ['harvest',  (bot, args) => harvest(bot, args.crop || args.item || 'wheat', parseInt(args.count) || 8, { maxCycles: 1 })],
  ['hunt',     (bot, args) => hunt(bot, args.target || args.mob || null)],
  ['explore',  (bot, args) => explore(bot, args.direction || args.dir || null, parseInt(args.distance) || 32)],
  ['mount',    (bot, _args) => mountBoat(bot)],
  ['dismount', (bot, _args) => dismountBoat(bot)],
  ['look',     (bot, args) => {
    const target = args.target || args.at || 'inventory'
    if (target === 'chest') return lookChest(bot)
    if (target === 'horizon' || target === 'far') return Promise.resolve(lookHorizon(bot, args.direction || args.dir))
    if (target === 'players' || target === 'entities' || target === 'around') return Promise.resolve(lookPlayers(bot))
    return lookInventory(bot)
  }],
  ['give',     (bot, args) => give(bot, args.player || args.to, args.item, parseInt(args.count) || 1)],
  ['clear',    (bot, args) => clear(bot, parseInt(args.width) || 10, parseInt(args.depth) || 10)],
  ['road',     (bot, args) => buildRoad(bot, parseInt(args.x), parseInt(args.z), args.material || 'cobblestone')],
  ['material', (_bot, args) => {
    const oldBlock = args.old || args.from
    const newBlock = args.new || args.to
    if (!oldBlock || !newBlock) {
      return Promise.resolve({ success: false, reason: 'Usage: !material old:oak_planks new:stone' })
    }
    return Promise.resolve(updatePalette(oldBlock, newBlock))
  }],
])

// Command aliases — map common LLM hallucinations to real commands
const ALIASES = {
  dig: 'mine',
  flatten: 'clear',
  path: 'road',
  break: 'mine',
  chop: 'gather',
  collect: 'gather',
  pickup: 'gather',
  attack: 'combat',
  fight: 'combat',
  kill: 'combat',
  walk: 'navigate',
  move: 'navigate',
  go: 'navigate',
  run: 'navigate',
  say: 'chat',
  tell: 'chat',
  talk: 'chat',
  cook: 'smelt',
  make: 'craft',
  place: 'build',
  store: 'deposit',
  take: 'withdraw',
  sleep: 'idle',
  wait: 'idle',
  projects: 'builds',
  list: 'builds',
  resume: 'build',
}

// Dispatch a !command to the corresponding body/ skill.
//
// Protocol:
//   1. requestInterrupt — cancels any in-flight skill cooperatively
//   2. clearInterrupt   — resets the interrupt flag for the new skill
//   3. Await the skill handler
//   4. Return the result (always { success, reason? })
//
// Unknown commands return { success: false, reason: 'unknown command: !name' }.
// Errors are caught and returned as { success: false, reason: err.message }.
//
// NOTE: skillRunning state is managed by mind/index.js (Plan 02), not here.
// This keeps the registry as a pure lookup + dispatch bridge.
export async function dispatch(bot, command, args) {
  const resolved = ALIASES[command] || command
  const fn = REGISTRY.get(resolved)
  if (!fn) {
    return { success: false, reason: `unknown command: !${command}` }
  }

  try {
    requestInterrupt(bot)  // Cancel any in-flight skill
    clearInterrupt(bot)    // Reset flag for the new skill
    const result = await fn(bot, args)
    return result
  } catch (err) {
    return { success: false, reason: err.message }
  }
}

// Returns array of registered command name strings.
export function listCommands() {
  return Array.from(REGISTRY.keys())
}
