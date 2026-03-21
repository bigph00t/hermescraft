// planner.js — Planner loop: periodic LLM call for strategy and reflection

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import OpenAI from 'openai'
import { fetchState, summarizeState } from './state.js'
import { getVisionContext } from './vision.js'

const __dirname_planner = dirname(fileURLToPath(import.meta.url))

const PLANNER_INTERVAL_MS = parseInt(process.env.PLANNER_INTERVAL_MS || '60000', 10)
const PLANNER_MODEL = process.env.PLANNER_MODEL || process.env.MODEL_NAME || 'Doradus/Hermes-4.3-36B-FP8'

// Separate OpenAI client for planner — prevents interference with action loop's conversation state
const VLLM_URL = process.env.VLLM_URL || 'http://localhost:8000/v1'
const rawKey = process.env.VLLM_API_KEY || process.env.ANTHROPIC_API_KEY || 'not-needed'
const isOAuth = rawKey.startsWith('sk-ant-oat')
const plannerClient = new OpenAI({
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

let _plannerInterval = null
let _lastPlanText = ''
let _running = false
let _agentConfig = null

// ── Building Knowledge ──

function loadBuildingKnowledge() {
  const knowledgePath = join(__dirname_planner, 'knowledge', 'building.md')
  try {
    if (existsSync(knowledgePath)) return readFileSync(knowledgePath, 'utf-8')
  } catch {}
  return ''
}

// ── Core Planner Tick ──

async function plannerTick() {
  try {
    // 1. Fetch current game state
    const state = await fetchState()
    const stateSummary = summarizeState(state)

    // 2. Read the agent's notepad and vision context
    let notepadContent = ''
    try {
      const notepadPath = join(_agentConfig.dataDir, 'notepad.txt')
      if (existsSync(notepadPath)) notepadContent = readFileSync(notepadPath, 'utf-8')
    } catch {}

    const visionContext = getVisionContext()

    // 3. Read building knowledge
    const buildingKnowledge = loadBuildingKnowledge()

    // 4. Build planner prompt
    const systemPrompt = `You are the strategic planner for ${_agentConfig.name}. Analyze the current situation and decide what to focus on next. Consider:
- What resources do we have? What do we need?
- Is it a good time to build something? What and where?
- Are there any threats or urgent needs?
- What's the most impactful thing to do right now?

Available building blueprints: small-cabin (5x5 house), animal-pen (fenced area), crop-farm (tilled rows with water).

${buildingKnowledge ? '## Building Reference\n' + buildingKnowledge : ''}

Write a concise strategy (5-8 sentences). Be specific about coordinates, items, and next steps.`

    let userContent = `== GAME STATE ==\n${stateSummary}`
    if (visionContext) {
      userContent += `\n\n${visionContext}`
    }
    if (notepadContent) {
      userContent += `\n\n== AGENT NOTEPAD ==\n${notepadContent}`
    }

    // 5. Call LLM
    const response = await plannerClient.chat.completions.create({
      model: PLANNER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 300,
      temperature: 0.5,
    })

    const planText = response.choices?.[0]?.message?.content?.trim()
    if (!planText) {
      console.log('[Planner] Empty response from planner model')
      return
    }

    // 6. Write to file and update cached state
    const timestamp = new Date().toISOString()
    const fileContent = `Strategy (updated ${timestamp}):\n${planText}\n`
    const filePath = join(_agentConfig.dataDir, 'plan-context.txt')
    mkdirSync(_agentConfig.dataDir, { recursive: true })
    writeFileSync(filePath, fileContent, 'utf-8')

    _lastPlanText = planText

    console.log('[Planner] Updated: ' + planText.slice(0, 80) + '...')

  } catch (err) {
    // Planner failures are non-fatal — log and continue
    const msg = err?.message || String(err)
    if (msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
      console.log('[Planner] Service not reachable, skipping: ' + msg.slice(0, 60))
    } else {
      console.log('[Planner] Error: ' + msg.slice(0, 120))
    }
  }
}

// ── Exported Functions ──

/**
 * Start the planner loop. Runs plannerTick every PLANNER_INTERVAL_MS.
 * Non-blocking — uses setInterval with async tick function.
 */
export function startPlannerLoop(agentConfig) {
  if (_running) {
    console.log('[Planner] Already running, ignoring duplicate start')
    return
  }

  _agentConfig = agentConfig
  _running = true

  console.log(`[Planner] Starting planner loop (interval: ${PLANNER_INTERVAL_MS}ms, model: ${PLANNER_MODEL})`)

  // Load any existing plan context from disk
  try {
    const filePath = join(agentConfig.dataDir, 'plan-context.txt')
    if (existsSync(filePath)) {
      const existing = readFileSync(filePath, 'utf-8')
      // Extract the plan text after the header line
      const lines = existing.split('\n')
      _lastPlanText = lines.slice(1).join('\n').trim()
      console.log('[Planner] Loaded existing plan context from disk')
    }
  } catch {}

  // Run first tick after a short delay (let mod server start)
  setTimeout(() => {
    if (_running) plannerTick()
  }, 5000)

  // Schedule repeating interval
  _plannerInterval = setInterval(() => {
    if (_running) plannerTick()
  }, PLANNER_INTERVAL_MS)
}

/**
 * Stop the planner loop.
 */
export function stopPlannerLoop() {
  if (_plannerInterval) {
    clearInterval(_plannerInterval)
    _plannerInterval = null
  }
  _running = false
  console.log('[Planner] Stopped')
}

/**
 * Get the last plan context text (for direct access without file I/O).
 * Returns the raw strategy from the last successful planner analysis,
 * or empty string if no plan data is available yet.
 */
export function getPlanContext() {
  return _lastPlanText
}
