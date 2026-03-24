// vision.js — Continuous vision: block-data rendering + unified VLM analysis
// Generates composite views (front elevation + top-down map) from Mineflayer block data,
// sends to the main model (Qwen3.5 — natively multimodal) for scene description and build feedback.
// No screenshots needed — works with headless Mineflayer bots.
// No separate VLM process needed — Qwen3.5 handles text + images natively.

import OpenAI from 'openai'
import { renderCompositeViewSync } from './minimap.js'

// ── Environment Variables ──
// Uses main model endpoint — Qwen3.5 is natively multimodal, no separate VLM needed.
// VISION_URL/VISION_MODEL kept for override flexibility but default to main endpoint.

const VISION_URL = process.env.VISION_URL || process.env.VLLM_URL || 'http://localhost:8000/v1'
const VISION_MODEL = process.env.VISION_MODEL || process.env.MODEL_NAME || 'Qwen3.5-35B-A3B'
const VISION_MAX_TOKENS = parseInt(process.env.VISION_MAX_TOKENS || '200', 10)

// ── VLM Client ──

const vlmClient = new OpenAI({
  baseURL: VISION_URL,
  apiKey: process.env.VLLM_API_KEY || 'not-needed',
  timeout: 30000,
})

// ── Vision Prompts ──

const GENERAL_VISION_PROMPT = `You see a Minecraft world rendered from block data. The top image shows what's AHEAD of the player (front elevation — blocks are colored by type). The bottom image shows a TOP-DOWN map of the area around the player (red dot = player position, red line = facing direction, N = north).

Describe in 2-3 concise sentences:
1. What terrain and structures are visible (trees, water, hills, buildings, farms)
2. Any player-built structures — describe their shape, completeness, and what they need
3. Notable resources or hazards

If you see a player-built structure, end with "BUILD:" followed by ONE specific improvement suggestion (e.g. "BUILD: walls only 2 blocks tall, needs roof" or "BUILD: farm has no water source nearby"). If no structures, write "BUILD: none".`

const BUILD_VISION_PROMPT = `You see a Minecraft area rendered from block data. The top image is the FRONT VIEW (blocks ahead of the player colored by type). The bottom image is a TOP-DOWN map (red dot = player).

Focus on the player-built structure visible. Describe:
1. What type of structure it is (house, farm, wall, storage, etc.)
2. Its current state — how complete it looks, dimensions, materials used
3. What's missing or wrong — gaps in walls, no roof, no door, poor layout

Give ONE specific actionable fix. Be concise (2-3 sentences total).`

// ── Exported Functions ──

// captureScreenshot(bot, dataDir) — generates a composite view from block data.
// Returns base64 JPEG string, or null on any failure.
// Replaces the old scrot-based capture. Works with headless Mineflayer bots.
// NEVER throws.
export async function captureScreenshot(dataDir, displayNum, bot) {
  // bot may be passed as 3rd arg (new API) or not at all (legacy calls)
  if (!bot?.entity?.position) return null
  return renderCompositeViewSync(bot, dataDir)
}

// queryVLM(base64Image, focusHint) — sends base64 image to the local VLM.
// Returns description string, or null if VLM is unavailable.
// NEVER throws.
export async function queryVLM(base64Image, focusHint = '') {
  if (!base64Image) return null

  try {
    const isBuildFocus = focusHint.toLowerCase().includes('build') ||
                         focusHint.toLowerCase().includes('structure')
    const prompt = isBuildFocus ? BUILD_VISION_PROMPT : GENERAL_VISION_PROMPT

    const response = await vlmClient.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64Image}` },
            },
            {
              type: 'text',
              text: focusHint
                ? `${prompt}\n\nAdditional focus: ${focusHint}`
                : prompt,
            },
          ],
        },
      ],
      max_tokens: VISION_MAX_TOKENS,
      temperature: 0.3,
    })

    return response.choices?.[0]?.message?.content?.trim() || null
  } catch (err) {
    const msg = err?.message || ''
    if (msg.includes('ECONNREFUSED') || msg.includes('timeout')) {
      // VLM not running — expected during startup
    } else {
      console.log('[vision] VLM error:', msg.slice(0, 100))
    }
    return null
  }
}

// captureAndAnalyze(bot, dataDir, focusHint) — full pipeline: render + analyze.
// Convenience function for background brain and !see command.
// Returns { image: base64, description: string } or null.
// NEVER throws.
export async function captureAndAnalyze(bot, dataDir, focusHint = '') {
  const image = renderCompositeViewSync(bot, dataDir)
  if (!image) return null

  const description = await queryVLM(image, focusHint)
  return { image, description }
}

// buildVisionForPrompt(description) — formats a VLM description for injection into the agent prompt.
// Returns null if description is falsy. Caps at 600 chars for token budget.
export function buildVisionForPrompt(description) {
  if (!description) return null
  return '## What I See\n' + description.slice(0, 600)
}
