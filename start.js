// start.js -- v2 entry point: create bot + init mind

import { createBot } from './body/bot.js'
import { initMind, isSkillRunning } from './mind/index.js'
import { initModes } from './body/modes.js'

async function main() {
  console.log('[hermescraft] v2 starting...')

  const bot = await createBot()
  console.log('[hermescraft] bot spawned as', bot.username, 'at', bot.entity.position)

  await initMind(bot)
  console.log('[hermescraft] mind initialized — agent is live')

  initModes(bot, isSkillRunning)
  console.log('[hermescraft] body modes started — survival tick active')

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
