// registry.js -- Command name to body/ skill dispatch bridge
// The ONLY file in mind/ that imports from body/. Mind boundary enforced here.

import { gather } from '../body/skills/gather.js'
import { mine } from '../body/skills/mine.js'
import { craft } from '../body/skills/craft.js'
import { smelt } from '../body/skills/smelt.js'
import { navigateTo } from '../body/navigate.js'
import { requestInterrupt, clearInterrupt } from '../body/interrupt.js'

// REGISTRY maps !command names to async handler functions.
// Args come in as strings from parseCommand — registry must parseInt() numeric args.
// The body/ skills handle their own item name normalization internally.
const REGISTRY = new Map([
  ['gather',   (bot, args) => gather(bot, args.item, parseInt(args.count) || 1)],
  ['mine',     (bot, args) => mine(bot, args.item, parseInt(args.count) || 1)],
  ['craft',    (bot, args) => craft(bot, args.item, parseInt(args.count) || 1)],
  ['smelt',    (bot, args) => smelt(bot, args.item, args.fuel || 'coal', parseInt(args.count) || 1)],
  ['navigate', (bot, args) => navigateTo(bot, parseInt(args.x), parseInt(args.y), parseInt(args.z))],
  ['chat',     (bot, args) => { bot.chat(args.message || ''); return { success: true } }],
  ['idle',     (_bot, _args) => Promise.resolve({ success: true, reason: 'idle' })],
])

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
  const fn = REGISTRY.get(command)
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
