// vision.js — Vision loop: periodic screenshot capture, MiniMax vision analysis, spatial awareness output

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import OpenAI from 'openai'

const MOD_URL = process.env.MOD_URL || 'http://localhost:3001'
const VLLM_URL = process.env.VLLM_URL || 'http://localhost:8000/v1'
const rawKey = process.env.VLLM_API_KEY || process.env.ANTHROPIC_API_KEY || 'not-needed'

// Separate OpenAI client for vision — prevents interference with action loop's conversation state
const isOAuth = rawKey.startsWith('sk-ant-oat')
const visionClient = new OpenAI({
  baseURL: VLLM_URL,
  apiKey: rawKey,
  timeout: 30000,
  defaultHeaders: isOAuth ? {
    'Authorization': `Bearer ${rawKey}`,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'oauth-2025-04-20',
  } : {},
})

// ── Module State ──

let _visionInterval = null
let _lastVisionText = ''
let _running = false
let _lastUpdateEpoch = 0

// ── Vision Prompt ──

const VISION_PROMPT = 'Describe what you see in this Minecraft screenshot. Note: terrain features (water, cliffs, caves, flat areas), nearby structures or builds, mobs and animals, other players, resources (trees, ores), and any hazards. Be concise -- 3-5 sentences max.'

// ── Core Loop ──

async function visionTick(agentConfig) {
  try {
    // 1. Fetch screenshot from mod
    const res = await fetch(MOD_URL + '/screenshot', {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      console.log('[Vision] Screenshot fetch failed: HTTP ' + res.status)
      return
    }

    // 2. Convert to base64
    const buf = await res.arrayBuffer()
    const b64 = Buffer.from(buf).toString('base64')
    if (b64.length < 100) {
      console.log('[Vision] Screenshot too small, skipping')
      return
    }

    // 3. Send to vision model
    const visionModel = agentConfig.visionModel || process.env.VISION_MODEL || process.env.MODEL_NAME || 'Doradus/Hermes-4.3-36B-FP8'
    const visionRes = await visionClient.chat.completions.create({
      model: visionModel,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
          { type: 'text', text: VISION_PROMPT },
        ],
      }],
      max_tokens: 200,
      temperature: 0.3,
    })

    // 4. Extract text
    const description = visionRes.choices?.[0]?.message?.content?.trim()
    if (!description) {
      console.log('[Vision] Empty response from vision model')
      return
    }

    // 5. Update state and write file
    _lastUpdateEpoch = Date.now()
    _lastVisionText = description

    const secondsAgo = 0  // just updated
    const fileContent = `== WHAT I SEE (updated ${secondsAgo}s ago) ==\n${description}\n`
    const filePath = join(agentConfig.dataDir, 'vision-context.txt')
    mkdirSync(agentConfig.dataDir, { recursive: true })
    writeFileSync(filePath, fileContent, 'utf-8')

    console.log('[Vision] Updated: ' + description.slice(0, 80) + '...')

  } catch (err) {
    // Vision failures are non-fatal — log and continue
    const msg = err?.message || String(err)
    if (msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
      console.log('[Vision] Mod not reachable, skipping: ' + msg.slice(0, 60))
    } else {
      console.log('[Vision] Error: ' + msg.slice(0, 120))
    }
  }
}

// ── Exported Functions ──

/**
 * Start the vision loop. Runs visionTick every VISION_INTERVAL_MS.
 * Non-blocking — uses setInterval with async tick function.
 */
export function startVisionLoop(agentConfig) {
  if (_running) {
    console.log('[Vision] Already running, ignoring duplicate start')
    return
  }
  if (!agentConfig.visionEnabled) {
    console.log('[Vision] Disabled via config, not starting')
    return
  }

  const intervalMs = agentConfig.visionIntervalMs || 10000
  _running = true

  console.log(`[Vision] Starting vision loop (interval: ${intervalMs}ms, model: ${agentConfig.visionModel || 'default'})`)

  // Run first tick after a short delay (let mod server start)
  setTimeout(() => {
    if (_running) visionTick(agentConfig)
  }, 3000)

  // Schedule repeating interval
  _visionInterval = setInterval(() => {
    if (_running) visionTick(agentConfig)
  }, intervalMs)
}

/**
 * Stop the vision loop.
 */
export function stopVisionLoop() {
  if (_visionInterval) {
    clearInterval(_visionInterval)
    _visionInterval = null
  }
  _running = false
  console.log('[Vision] Stopped')
}

/**
 * Get the last vision context text (for direct access without file I/O).
 * Returns the raw description from the last successful vision analysis,
 * or empty string if no vision data is available yet.
 */
export function getVisionContext() {
  if (!_lastVisionText) return ''
  const secondsAgo = Math.round((Date.now() - _lastUpdateEpoch) / 1000)
  return `== WHAT I SEE (updated ${secondsAgo}s ago) ==\n${_lastVisionText}`
}
