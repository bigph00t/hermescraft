// vision.js — On-demand screenshot capture + VLM description for !see command

import { execSync } from 'child_process'
import { readFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import OpenAI from 'openai'

// ── Environment Variables ──

const VISION_URL = process.env.VISION_URL || 'http://localhost:8002/v1'
const VISION_MODEL = process.env.VISION_MODEL || 'Qwen/Qwen2.5-VL-7B-Instruct'
const VISION_MAX_TOKENS = parseInt(process.env.VISION_MAX_TOKENS || '256', 10)
const XVFB_DISPLAY = process.env.XVFB_DISPLAY || '1'

// ── VLM Client (separate port from background brain's 8001) ──

const vlmClient = new OpenAI({
  baseURL: VISION_URL,
  apiKey: 'not-needed',
  timeout: 30000,
})

// ── Exported Functions ──

// captureScreenshot(dataDir, displayNum) — grabs a screenshot from the Xvfb display using scrot.
// Returns base64 PNG string, or null on any failure (no display, scrot missing, write error, etc.)
// NEVER throws.
export async function captureScreenshot(dataDir, displayNum = XVFB_DISPLAY) {
  // Guard: DISPLAY env var must be set — indicates Xvfb is running
  if (!process.env.DISPLAY) return null

  try {
    const screenshotsDir = join(dataDir, 'screenshots')
    mkdirSync(screenshotsDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${timestamp}.png`
    const outPath = join(screenshotsDir, filename)

    execSync(`DISPLAY=:${displayNum} scrot -o "${outPath}"`, { timeout: 5000 })

    const buf = readFileSync(outPath)
    return buf.toString('base64')
  } catch {
    // scrot not available, Xvfb not running, file read failed — return null gracefully
    return null
  }
}

// queryVLM(base64Image, focusHint) — sends base64 PNG to the VLM and returns a text description.
// Returns description string, or null if image is missing or VLM is unavailable.
// NEVER throws — VLM unavailable is an expected state (optional service on port 8002).
export async function queryVLM(base64Image, focusHint = '') {
  if (!base64Image) return null

  try {
    const prompt = focusHint
      ? `Describe this Minecraft screenshot. Focus on: ${focusHint}. Be concise (2-3 sentences).`
      : 'Describe what you see in this Minecraft screenshot. Note terrain, mobs, structures, hazards. Be concise.'

    const response = await vlmClient.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${base64Image}` },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      max_tokens: VISION_MAX_TOKENS,
      temperature: 0.3,
    })

    return response.choices?.[0]?.message?.content || null
  } catch {
    // VLM unreachable, API error, network failure — return null gracefully
    return null
  }
}

// buildVisionForPrompt(description) — formats a VLM description for injection into the agent prompt.
// Returns null if description is falsy. Caps at 400 characters to stay within token budget.
export function buildVisionForPrompt(description) {
  if (!description) return null
  return '## Visual Observation\n' + description.slice(0, 400)
}
