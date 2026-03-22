// start.js -- v2 entry point: create bot + init mind

import { createBot } from './body/bot.js'
import { initMind } from './mind/index.js'

async function main() {
  console.log('[hermescraft] v2 starting...')

  const bot = await createBot()
  console.log('[hermescraft] bot spawned as', bot.username, 'at', bot.entity.position)

  await initMind(bot)
  console.log('[hermescraft] mind initialized — agent is live')

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
