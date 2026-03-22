// start.js -- v2 entry point: config -> bot -> memory -> social -> locations -> mind -> modes

import { createBot } from './body/bot.js'
import { loadAgentConfig } from './mind/config.js'
import { initMemory, loadMemory, periodicSave } from './mind/memory.js'
import { initSocial } from './mind/social.js'
import { initLocations, getHome } from './mind/locations.js'
import { initMind, isSkillRunning } from './mind/index.js'
import { initModes } from './body/modes.js'
import { initBuild } from './body/skills/build.js'

async function main() {
  console.log('[hermescraft] v2 starting...')

  // 1. Load per-agent config (SOUL file, data dir, partner)
  const config = loadAgentConfig()
  console.log('[hermescraft] agent:', config.name, '| partner:', config.partnerName || 'none', '| soul:', config.soulContent ? 'loaded' : 'generic')

  // 2. Create bot with agent's MC username
  const bot = await createBot({ username: config.mcUsername })
  console.log('[hermescraft] bot spawned as', bot.username, 'at', bot.entity.position)

  // 3. Init data subsystems (must happen before initMind)
  initMemory(config)
  loadMemory()
  initSocial(config)
  initLocations(config)

  // 3.5. Init build state (load any persisted build plan from prior session)
  initBuild(config)

  // 4. Set bot.homeLocation for body/modes.js night shelter (mind/body boundary: property on bot, not import)
  const home = getHome()
  if (home) {
    bot.homeLocation = home
    console.log('[hermescraft] home loaded:', home.x, home.y, home.z)
  }

  // 5. Init mind loop with config (SOUL, memory, social, locations flow through think())
  await initMind(bot, config)
  console.log('[hermescraft] mind initialized -- agent is live')

  // 6. Start body tick
  initModes(bot, isSkillRunning)
  console.log('[hermescraft] body modes started -- survival tick active')

  // 7. Periodic save every 60s — saves memory + stats to disk
  setInterval(() => periodicSave(), 60000)

  // Global error handlers — keep the process alive on unexpected errors.
  // The bot loop is resilient enough to recover from most failures.
  process.on('uncaughtException', (err) => {
    console.error('[hermescraft] uncaught exception:', err.message)
    // Don't exit — let the agent recover
  })
  process.on('unhandledRejection', (err) => {
    console.error('[hermescraft] unhandled rejection:', err?.message || err)
  })
}

main().catch(err => { console.error('[hermescraft] fatal:', err.message); process.exit(1) })
