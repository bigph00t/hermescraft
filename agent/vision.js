// vision.js — Vision loop: periodic screenshot capture + Claude Haiku analysis
// Uses Claude Haiku via Anthropic SDK for image understanding.
// MiniMax handles text (action loop, planner). Haiku handles vision only.

import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { join } from 'path'
import Anthropic from '@anthropic-ai/sdk'
import sharp from 'sharp'

const MOD_URL = process.env.MOD_URL || 'http://localhost:3001'

// ── Anthropic Vision Client ──

function getAnthropicKey() {
  // 1. Explicit VISION_API_KEY
  if (process.env.VISION_API_KEY) return process.env.VISION_API_KEY
  // 2. ANTHROPIC_API_KEY
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  // 3. Read from Claude CLI credentials
  try {
    const credPath = join(process.env.HOME || '/root', '.claude', '.credentials.json')
    const creds = JSON.parse(readFileSync(credPath, 'utf-8'))
    const token = creds?.claudeAiOauth?.accessToken
    if (token) return token
  } catch {}
  return ''
}

const anthropicKey = getAnthropicKey()
let visionClient = null
if (anthropicKey) {
  visionClient = new Anthropic({
    apiKey: anthropicKey,
    timeout: 20000,
  })
}

const VISION_MODEL = process.env.VISION_MODEL || 'claude-haiku-4-5-20251001'

// ── Module State ──

let _visionInterval = null
let _lastVisionText = ''
let _running = false
let _lastUpdateEpoch = 0
let _lastScreenshotB64 = ''

// ── Vision Prompt ──

const VISION_PROMPT = `Describe what you see in this Minecraft screenshot in 2-4 sentences. Focus on: trees and wood (critical for survival), terrain, water, mobs/animals, other players, structures, ores, and hazards. Be specific about directions (left, right, ahead, behind) and distances (close, medium, far).

Then on a new line starting with "BUILD:" — if you can see any player-built structure (house, wall, farm, path, chest arrangement), give ONE specific concrete observation about what it lacks or could improve. Examples: "no windows on north wall", "farm rows are uneven", "no door visible", "chests have no labels", "no path to the entrance". If no player structure is visible, write "BUILD: none".`

// ── Helpers ──

/** Resize screenshot to small JPEG for efficient API calls */
async function resizeScreenshot(rawBuffer) {
  try {
    const resized = await sharp(rawBuffer)
      .resize(512, 288, { fit: 'fill' })
      .jpeg({ quality: 60 })
      .toBuffer()
    return resized.toString('base64')
  } catch (err) {
    console.log('[Vision] Resize failed, using original: ' + (err?.message || '').slice(0, 60))
    return Buffer.from(rawBuffer).toString('base64')
  }
}

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

    // 2. Resize to 512x288 JPEG
    const buf = await res.arrayBuffer()
    const rawBuf = Buffer.from(buf)
    if (rawBuf.length < 100) {
      console.log('[Vision] Screenshot too small, skipping')
      return
    }

    const b64 = await resizeScreenshot(rawBuf)
    _lastScreenshotB64 = b64

    // 3. Send to Claude Haiku for vision analysis
    if (!visionClient) {
      // No Anthropic key — just capture screenshots silently
      return
    }

    const response = await visionClient.messages.create({
      model: VISION_MODEL,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: b64,
            },
          },
          {
            type: 'text',
            text: VISION_PROMPT,
          },
        ],
      }],
    })

    // 4. Extract description
    let description = response.content?.[0]?.text?.trim()
    if (!description) {
      console.log('[Vision] Empty response from Haiku')
      return
    }

    // 5. Update state and write file
    _lastUpdateEpoch = Date.now()
    _lastVisionText = description

    const fileContent = `== WHAT I SEE (updated 0s ago) ==\n${description}\n`
    const filePath = join(agentConfig.dataDir, 'vision-context.txt')
    mkdirSync(agentConfig.dataDir, { recursive: true })
    writeFileSync(filePath, fileContent, 'utf-8')

    console.log('[Vision] Updated: ' + description.slice(0, 80) + '...')

  } catch (err) {
    const msg = err?.message || String(err)
    if (msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
      console.log('[Vision] Mod not reachable: ' + msg.slice(0, 60))
    } else if (msg.includes('rate') || msg.includes('429')) {
      console.log('[Vision] Rate limited, will retry next tick')
    } else {
      console.log('[Vision] Error: ' + msg.slice(0, 120))
    }
  }
}

// ── Exported Functions ──

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

  if (visionClient) {
    console.log(`[Vision] Starting vision loop (interval: ${intervalMs}ms, model: ${VISION_MODEL})`)
  } else {
    console.log(`[Vision] Starting screenshot capture only (no Anthropic key found)`)
  }

  setTimeout(() => {
    if (_running) visionTick(agentConfig)
  }, 3000)

  _visionInterval = setInterval(() => {
    if (_running) visionTick(agentConfig)
  }, intervalMs)
}

export function stopVisionLoop() {
  if (_visionInterval) {
    clearInterval(_visionInterval)
    _visionInterval = null
  }
  _running = false
  console.log('[Vision] Stopped')
}

export function getVisionContext() {
  if (!_lastVisionText) return ''
  const secondsAgo = Math.round((Date.now() - _lastUpdateEpoch) / 1000)
  return `== WHAT I SEE (updated ${secondsAgo}s ago) ==\n${_lastVisionText}`
}

export function getLastScreenshotBase64() {
  return _lastScreenshotB64
}
