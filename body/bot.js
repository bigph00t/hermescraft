// bot.js — Bot creation, plugin loading, spawn lifecycle, reconnect logic

import mineflayer from 'mineflayer'
import { pathfinder, Movements } from 'mineflayer-pathfinder'
import { plugin as toolPlugin } from 'mineflayer-tool'

const SPAWN_TIMEOUT_MS = 30000

/**
 * Create a headless mineflayer bot connected to the Paper 1.21.1 server.
 * Loads pathfinder and tool plugins, sets movements on spawn, initializes
 * the cooperative interrupt flag.
 *
 * @param {object} options
 * @param {string} [options.host]
 * @param {number} [options.port]
 * @param {string} [options.username]
 * @returns {Promise<import('mineflayer').Bot>} resolves on first spawn event
 */
export async function createBot(options = {}) {
  const host = options.host || process.env.MC_HOST || 'localhost'
  const port = options.port || parseInt(process.env.MC_PORT || '25565')
  const username = options.username || process.env.MC_USERNAME || 'jeffrey'

  const bot = mineflayer.createBot({
    host,
    port,
    username,
    auth: 'offline',
    version: '1.21.1',
    checkTimeoutInterval: 120000,  // 2min keepalive timeout (default 30s too aggressive)
  })

  // Load plugins immediately after createBot — before spawn
  bot.loadPlugin(pathfinder)
  bot.loadPlugin(toolPlugin)

  // Register error/disconnect handlers
  bot.on('error', (err) => console.error('[bot] error:', err.message))
  bot.on('kicked', (reason) => console.error('[bot] kicked:', reason))
  bot.on('end', () => console.log('[bot] disconnected'))

  // Return a Promise that resolves on spawn or rejects on timeout
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('spawn_timeout'))
    }, SPAWN_TIMEOUT_MS)

    bot.once('spawn', () => {
      clearTimeout(timer)

      // Set movements in spawn handler — Movements requires initialized world state
      const movements = new Movements(bot)
      movements.allowSprinting = true
      bot.pathfinder.setMovements(movements)

      // Initialize cooperative interrupt flag
      bot.interrupt_code = false

      resolve(bot)
    })
  })
}
