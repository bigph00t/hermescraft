// start.js -- v2 entry point: config -> bot -> memory -> social -> locations -> mind -> modes

import { createBot } from './body/bot.js'
import { loadAgentConfig } from './mind/config.js'
import { initMemory, loadMemory, periodicSave } from './mind/memory.js'
import { initSocial, savePlayers } from './mind/social.js'
import { initLocations, getHome, saveLocations } from './mind/locations.js'
import { initMind, isSkillRunning } from './mind/index.js'
import { initModes } from './body/modes.js'
import { initBuild } from './body/skills/build.js'
import { initChestMemory } from './body/skills/chest.js'
import { initBuildHistory, loadBuildHistory, saveBuildHistory } from './mind/build-history.js'
import { initKnowledge, loadKnowledge } from './mind/knowledge.js'
import { initKnowledgeStore } from './mind/knowledgeStore.js'
import { initBackgroundBrain } from './mind/backgroundBrain.js'

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

  // 3.5. Init chest memory + build state
  initChestMemory(config.name)
  initBuild(config)
  initBuildHistory(config)
  loadBuildHistory()

  // 3.6. Init knowledge corpus (build all chunks at startup)
  initKnowledge(config)
  const knowledgeChunks = loadKnowledge()

  // 3.7. Build retrieval indexes — BM25 + vector
  // If pre-built index exists on disk (from `node mind/knowledgeStore.js`), loads in ~1s.
  // Otherwise embeds all chunks (~30-60s) — run pre-embed first to avoid timeout.
  await initKnowledgeStore(knowledgeChunks)

  // 4. Set bot.homeLocation for body/modes.js night shelter (mind/body boundary: property on bot, not import)
  const home = getHome()
  if (home) {
    bot.homeLocation = home
    console.log('[hermescraft] home loaded:', home.x, home.y, home.z)
  }

  // 5. Init mind loop with config (SOUL, memory, social, locations flow through think())
  await initMind(bot, config)
  console.log('[hermescraft] mind initialized -- agent is live')

  // 5.5. Init background brain — secondary LLM for planning/reflection (Phase 15)
  initBackgroundBrain(bot, config)
  console.log('[hermescraft] background brain initialized')

  // 6. Start body tick
  initModes(bot, isSkillRunning)
  console.log('[hermescraft] body modes started -- survival tick active')

  // 7. Periodic save every 60s — saves memory, players, locations, build history to disk
  setInterval(() => {
    periodicSave()
    savePlayers()
    saveLocations()
    saveBuildHistory()
  }, 60000)

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
