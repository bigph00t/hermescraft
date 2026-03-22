// config.js — Agent configuration loader: SOUL discovery, data dir, partner name

import { existsSync, readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Project root is one level up from mind/
const PROJECT_ROOT = dirname(__dirname)

export function loadAgentConfig() {
  const name = process.env.AGENT_NAME || 'jeffrey'
  const mcUsername = process.env.MC_USERNAME || name

  // Partner name derived from AGENT_NAME — jeffrey<->john, otherwise null
  let partnerName = process.env.PARTNER_NAME || null
  if (!partnerName) {
    if (name === 'jeffrey') partnerName = 'john'
    else if (name === 'john') partnerName = 'jeffrey'
  }

  // Data dir: data/<name>/ relative to project root — v1 put data under agent/, v2 uses top-level data/
  const dataDir = join(PROJECT_ROOT, 'data', name)
  mkdirSync(dataDir, { recursive: true })
  mkdirSync(join(dataDir, 'sessions'), { recursive: true })

  // SOUL file discovery: env path → SOUL-<name>.md → SOUL-minecraft.md
  let soulContent = null
  const soulCandidates = [
    process.env.AGENT_SOUL,
    join(PROJECT_ROOT, `SOUL-${name}.md`),
    join(PROJECT_ROOT, 'SOUL-minecraft.md'),
  ].filter(Boolean)

  for (const candidate of soulCandidates) {
    if (existsSync(candidate)) {
      try {
        soulContent = readFileSync(candidate, 'utf-8').trim()
      } catch {}
      break
    }
  }

  if (!soulContent) {
    console.warn('[config] SOUL file not found for', name, '-- using generic identity')
  }

  return { name, dataDir, soulContent, partnerName, mcUsername }
}
