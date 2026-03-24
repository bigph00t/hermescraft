// backgroundBrain.js — Background brain: periodic LLM analysis, atomic brain-state writes, TTL-cached reads

import OpenAI from 'openai'
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { getHistory } from './llm.js'
import { captureAndAnalyze } from './vision.js'
import { logEvent, queryRecent } from './memoryDB.js'
import { getPartnerActivityForPrompt } from './coordination.js'

// ── Environment Variables ──
// Uses main model endpoint — Qwen3.5 is natively multimodal, one model serves everything.

const BACKGROUND_BRAIN_URL = process.env.BACKGROUND_BRAIN_URL || process.env.VLLM_URL || 'http://localhost:8000/v1'
const BACKGROUND_MODEL = process.env.BACKGROUND_MODEL_NAME || process.env.MODEL_NAME || 'Qwen3.5-35B-A3B'
const BACKGROUND_MAX_TOKENS = parseInt(process.env.BACKGROUND_MAX_TOKENS || '1024', 10)
const BACKGROUND_INTERVAL_MS = parseInt(process.env.BACKGROUND_INTERVAL_MS || '30000', 10)
const STARTUP_DELAY_MS = 10000  // wait 10s before first cycle — gives main brain time for first tick
const REFLECTION_INTERVAL_MS = 30 * 60 * 1000  // 30 minutes between reflection journals

// ── Background Brain OpenAI Client (same endpoint as main brain — Qwen3.5 natively multimodal MoE) ──

const bgClient = new OpenAI({
  baseURL: BACKGROUND_BRAIN_URL,
  apiKey: process.env.VLLM_API_KEY || 'not-needed',
  timeout: 60000,
})

// ── Module State ──

let _bgRunning = false       // guard against overlapping background cycles
let DATA_DIR = ''            // set in initBackgroundBrain
let BRAIN_STATE_FILE = ''    // join(DATA_DIR, 'brain-state.json')
let BRAIN_STATE_TMP = ''     // BRAIN_STATE_FILE + '.tmp'
let _cachedState = null      // TTL cache value
let _cacheTime = 0           // TTL cache timestamp
const TTL_MS = 5000          // 5 second TTL — main brain reads at most once per 5s
let _agentName = ''          // for prompt personalization
let _bot = null              // bot reference for game state access

// ── Exported Functions ──

// initBackgroundBrain(bot, config) — sets up state, schedules first cycle, starts interval.
// Call once after initMind() in start.js.
export function initBackgroundBrain(bot, config) {
  DATA_DIR = config.dataDir
  BRAIN_STATE_FILE = join(DATA_DIR, 'brain-state.json')
  BRAIN_STATE_TMP = BRAIN_STATE_FILE + '.tmp'
  _agentName = config.name
  _bot = bot

  // Ensure data directory exists before any writes
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true })
  }

  // First cycle fires after startup delay — avoids GPU contention with main brain's first tick
  setTimeout(() => runBackgroundCycle(bot, config), STARTUP_DELAY_MS)

  // Recurring interval — skip if previous cycle still running
  setInterval(async () => {
    if (_bgRunning) return
    runBackgroundCycle(bot, config)
  }, BACKGROUND_INTERVAL_MS)

  console.log(`[background-brain] initialized — first cycle in ${STARTUP_DELAY_MS / 1000}s`)
}

// getBrainHooks() — returns actionable hooks from brain state for programmatic use.
// Main agent calls this to get avoidActions, urgentWarning, suggestedAction.
// NEVER throws — returns empty object on error.
export function getBrainHooks() {
  try {
    const now = Date.now()
    let state = _cachedState
    if (!state || (now - _cacheTime) >= TTL_MS) {
      if (existsSync(BRAIN_STATE_FILE)) {
        state = JSON.parse(readFileSync(BRAIN_STATE_FILE, 'utf-8'))
        _cachedState = state
        _cacheTime = now
      }
    }
    if (!state) return {}
    return {
      avoidActions: state.avoidActions || [],
      urgentWarning: state.urgentWarning || null,
      suggestedAction: state.suggestedAction || null,
    }
  } catch {
    return {}
  }
}

// getBrainStateForPrompt() — TTL-cached file read for main brain injection.
// Returns formatted string capped at 1500 chars, or null on cold start / error.
// NEVER throws — all reads wrapped in try/catch.
export function getBrainStateForPrompt() {
  const now = Date.now()

  // Return cached value if still fresh
  if (_cachedState && (now - _cacheTime) < TTL_MS) {
    return formatBrainState(_cachedState)
  }

  // Cache stale or empty — try to read from disk
  try {
    const raw = readFileSync(BRAIN_STATE_FILE, 'utf-8')
    _cachedState = JSON.parse(raw)
    _cacheTime = now
    return formatBrainState(_cachedState)
  } catch {
    // ENOENT (cold start), JSON parse error — return null, main brain runs without it
    return null
  }
}

// ── Internal Functions ──

// pushRingBuffer(arr, item, maxSize) — push item, evict oldest if over cap.
function pushRingBuffer(arr, item, maxSize) {
  arr.push(item)
  while (arr.length > maxSize) arr.shift()
  return arr
}

// writeBrainState(state) — applies ring buffer caps then atomically writes to disk.
// Uses tmp + rename for POSIX-atomic write — main brain never reads a partial file.
function writeBrainState(state) {
  // Apply ring buffer caps before writing
  if (state.insights) {
    while (state.insights.length > 20) state.insights.shift()
  }
  if (state.spatial) {
    while (state.spatial.length > 50) state.spatial.shift()
  }
  if (state.partnerObs) {
    while (state.partnerObs.length > 100) state.partnerObs.shift()
  }

  const content = JSON.stringify(state, null, 2)
  writeFileSync(BRAIN_STATE_TMP, content, 'utf-8')
  renameSync(BRAIN_STATE_TMP, BRAIN_STATE_FILE)  // atomic on POSIX local disk
}

// parseLLMJson(raw) — strips <think> blocks and markdown fences, then parses JSON.
// Returns parsed object or null on failure — never throws.
function parseLLMJson(raw) {
  // Strip <think>...</think> reasoning blocks
  let text = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  // First try: direct parse
  try {
    return JSON.parse(text)
  } catch {
    // Second try: extract outermost {...} object
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch {}
    }
    return null  // parse failed — caller keeps existing state
  }
}

// buildBackgroundPrompt(recentHistory, gameState, existingState, extraContext) — prompt for the background brain.
// Analyzes history + failures + partners, outputs structured JSON with actionable hooks.
function buildBackgroundPrompt(recentHistory, gameState, existingState, extraContext = {}) {
  const historyText = recentHistory.length > 0
    ? recentHistory.map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 200) : '[content]'}`).join('\n')
    : '(no recent history yet)'

  const existingPlan = existingState?.plan
    ? JSON.stringify(existingState.plan, null, 2)
    : '(no existing plan)'

  // Build extra context sections
  const sections = []
  if (extraContext.recentEvents) {
    sections.push(`Recent memory events (deaths, discoveries, crafts):\n${extraContext.recentEvents}`)
  }
  if (extraContext.partnerActivity) {
    sections.push(`Partner agents:\n${extraContext.partnerActivity}`)
  }
  if (extraContext.inventory) {
    sections.push(`Inventory:\n${extraContext.inventory}`)
  }
  const extraText = sections.length > 0 ? '\n\n' + sections.join('\n\n') : ''

  return `You are the strategic brain for a Minecraft agent named ${_agentName}.
You do NOT take actions. You analyze events and produce structured guidance for the action brain.

Tasks:
1. Maintain a coherent multi-step plan
2. Extract 1-3 insights from recent events
3. Note hazards and useful locations
4. Set urgentWarning if there's an immediate threat or critical need (low health, starvation, nearby danger)
5. List avoidActions — commands that keep failing and should be skipped (e.g. "craft:stone_pickaxe" if materials are missing)
6. Suggest a resourceNeeds list — what items to prioritize gathering based on current plan and inventory
7. If you notice the agent is idle or stuck, provide a suggestedAction

Recent history (last 20 exchanges):
${historyText}

Current game state:
${gameState}${extraText}

Existing plan (update if needed):
${existingPlan}

Output ONLY valid JSON:
{
  "plan": {
    "goal": "primary goal",
    "steps": [{"action": "step", "status": "todo|in_progress|done"}],
    "current_step": 0
  },
  "insights": ["lesson learned"],
  "spatial": [{"label": "name", "note": "what", "hazard": false}],
  "constraints": ["rule to follow"],
  "urgentWarning": null,
  "avoidActions": [],
  "suggestedAction": null,
  "resourceNeeds": [],
  "socialNotes": [],
  "updated_at": ${Date.now()},
  "schema_version": 2
}`
}

// generateReflectionJournal(recentHistory) — Phase 18 (MEM-04).
// Calls the background model to synthesize a 1-2 sentence tactical summary of recent activity.
// Stores the result via logEvent with event_type='reflection' (importance=9).
// Non-fatal: all errors caught and logged.
async function generateReflectionJournal(recentHistory) {
  if (!_bot?.entity) return  // bot not alive — skip
  const histText = recentHistory
    .map(m => typeof m.content === 'string' ? m.content.slice(0, 150) : '')
    .filter(Boolean)
    .join('\n')
    .slice(0, 1500)
  if (!histText) return  // no history to reflect on
  const prompt = `Summarize in 1-2 sentences what you learned or accomplished recently. Be specific and tactical — mention items, locations, strategies. Output ONLY the summary sentence. No JSON, no markdown, no extra text.`
  try {
    const res = await bgClient.chat.completions.create({
      model: BACKGROUND_MODEL,
      messages: [
        { role: 'system', content: `You are ${_agentName}, a Minecraft player reflecting on recent experiences.` },
        { role: 'user', content: `Recent activity:\n${histText}\n\n${prompt}` },
      ],
      max_tokens: 80,
      temperature: 0.4,
    })
    const summary = (res.choices?.[0]?.message?.content || '').trim().slice(0, 480)
    if (summary && summary.length > 10) {
      logEvent(_bot, 'reflection', summary, { source: 'background_brain' })
      console.log('[background-brain] reflection journal:', summary.slice(0, 80))
    }
  } catch (err) {
    console.log('[background-brain] reflection error (non-fatal):', err.message)
  }
}

// runBackgroundCycle(bot, config) — the main async background cycle.
// Sets _bgRunning in try/finally to prevent overlapping calls.
async function runBackgroundCycle(bot, config) {
  _bgRunning = true
  try {
    // Get the most recent conversation history (live reference — respects clearConversation())
    const history = getHistory()
    const recentHistory = history.slice(-20)  // last 20 messages

    // Build compact game state from bot
    const pos = bot?.entity?.position
    const gameState = [
      pos ? `Position: ${Math.round(pos.x)},${Math.round(pos.y)},${Math.round(pos.z)}` : 'Position: unknown',
      `Health: ${bot?.health ?? '?'}/20`,
      `Food: ${bot?.food ?? '?'}/20`,
      `Time: ${bot?.time?.timeOfDay ?? '?'}`,
      `Inventory: ${bot?.inventory?.items()?.length ?? 0} item types`,
    ].join(', ')

    // Gather extra context: recent memory events, partner activity, inventory details
    const extraContext = {}
    try {
      const events = queryRecent(_agentName, 15)
      if (events.length > 0) {
        extraContext.recentEvents = events
          .map(e => `[${e.event_type}] ${e.description}`)
          .join('\n')
      }
    } catch {}
    try {
      const partnerCtx = getPartnerActivityForPrompt()
      if (partnerCtx) extraContext.partnerActivity = partnerCtx
    } catch {}
    try {
      const items = bot?.inventory?.items() || []
      if (items.length > 0) {
        extraContext.inventory = items
          .map(i => `${i.name.replace('minecraft:', '')} x${i.count}`)
          .join(', ')
      }
    } catch {}

    // Load existing brain state to preserve ring buffer continuity
    let existingState = null
    try {
      if (existsSync(BRAIN_STATE_FILE)) {
        existingState = JSON.parse(readFileSync(BRAIN_STATE_FILE, 'utf-8'))
      }
    } catch {}

    // Build prompt and call model — include composite image for visual awareness
    const prompt = buildBackgroundPrompt(recentHistory, gameState, existingState, extraContext)

    // Render composite view for the background brain's strategic analysis.
    // Qwen3.5 is natively multimodal — pass image inline with the user message.
    let bgImage = null
    try {
      const { renderCompositeViewSync } = await import('./minimap.js')
      bgImage = renderCompositeViewSync(bot, DATA_DIR)
    } catch { /* vision render failure is non-fatal */ }

    // Build user message — multimodal if image available
    const userContent = bgImage
      ? [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${bgImage}` } },
          { type: 'text', text: 'Analyze the game state and your visual surroundings. Output the JSON plan now.' },
        ]
      : 'Analyze and output the JSON plan now.'

    const response = await bgClient.chat.completions.create({
      model: BACKGROUND_MODEL,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: BACKGROUND_MAX_TOKENS,
      temperature: 0.3,  // lower temperature for structured/deterministic JSON output
    })

    const raw = response.choices?.[0]?.message?.content || ''
    const parsed = parseLLMJson(raw)

    if (!parsed) {
      console.log('[background-brain] cycle: LLM output could not be parsed as JSON — keeping existing state')
      return
    }

    // Merge new fields into existing state (preserves ring buffer continuity)
    // Ring buffer fields (insights, spatial, partnerObs) append; hook fields replace each cycle
    const mergedState = {
      ...(existingState || {}),
      plan: parsed.plan || existingState?.plan || {},
      insights: [
        ...(existingState?.insights || []),
        ...(Array.isArray(parsed.insights) ? parsed.insights : []),
      ],
      spatial: [
        ...(existingState?.spatial || []),
        ...(Array.isArray(parsed.spatial) ? parsed.spatial : []),
      ],
      constraints: parsed.constraints || existingState?.constraints || [],
      partnerObs: [
        ...(existingState?.partnerObs || []),
        ...(Array.isArray(parsed.partnerObs) ? parsed.partnerObs : []),
      ],
      // Actionable hooks — replaced each cycle (not accumulated)
      urgentWarning: parsed.urgentWarning || null,
      avoidActions: Array.isArray(parsed.avoidActions) ? parsed.avoidActions : [],
      suggestedAction: parsed.suggestedAction || null,
      resourceNeeds: Array.isArray(parsed.resourceNeeds) ? parsed.resourceNeeds : [],
      socialNotes: Array.isArray(parsed.socialNotes) ? parsed.socialNotes : [],
      updated_at: Date.now(),
      schema_version: 2,
    }

    writeBrainState(mergedState)

    // Invalidate TTL cache so next getBrainStateForPrompt() reads the fresh file
    _cachedState = null
    _cacheTime = 0

    // Reflection journal generation (Phase 18 — MEM-04)
    // Only fire if enough time has passed since last reflection (30 min default)
    const lastReflection = mergedState.lastReflectionAt || 0
    if (Date.now() - lastReflection > REFLECTION_INTERVAL_MS) {
      await generateReflectionJournal(recentHistory)
      mergedState.lastReflectionAt = Date.now()
      writeBrainState(mergedState)  // persist the timestamp
    }

    // Dedicated vision analysis — renders composite view and gets focused VLM description.
    // This produces a text summary for the main brain's prompt injection (visionNote in brain-state.json).
    // Separate from the image sent inline above — this is a targeted "describe what you see" call.
    try {
      const visionResult = await captureAndAnalyze(bot, DATA_DIR, 'terrain, structures, threats, and building progress')
      if (visionResult?.description) {
        mergedState.visionNote = { text: visionResult.description, ts: Date.now() }
        writeBrainState(mergedState)
        _cachedState = null
        _cacheTime = 0
      }
    } catch { /* vision failure is non-fatal */ }

    console.log('[background-brain] cycle complete')
  } catch (err) {
    console.log(`[background-brain] cycle error: ${err.message}`)
    // Do NOT throw — background brain failure is non-fatal; main brain continues unaffected
  } finally {
    _bgRunning = false
  }
}

// formatBrainState(state) — compact prompt-injection format, capped at 1200 chars (~300 tokens).
// Returns null if state is falsy.
function formatBrainState(state) {
  if (!state) return null

  const age = Math.round((Date.now() - (state.updated_at || 0)) / 1000)
  const lines = [`## Background Brain (${age}s ago)`]

  // Urgent warning goes first — most important signal
  if (state.urgentWarning) {
    lines.push(`⚠ WARNING: ${state.urgentWarning}`)
  }

  if (state.plan?.goal) {
    lines.push(`Goal: ${state.plan.goal}`)
    const stepIdx = state.plan.current_step ?? 0
    const step = state.plan.steps?.[stepIdx]
    if (step) {
      lines.push(`Next step: ${step.action} (${step.status || 'todo'})`)
    }
  }

  if (state.suggestedAction) {
    lines.push(`Suggestion: ${state.suggestedAction}`)
  }

  if (state.resourceNeeds?.length) {
    lines.push(`Need: ${state.resourceNeeds.slice(0, 5).join(', ')}`)
  }

  if (state.avoidActions?.length) {
    lines.push(`Avoid (keeps failing): ${state.avoidActions.slice(0, 3).join(', ')}`)
  }

  if (state.constraints?.length) {
    lines.push(`Rules: ${state.constraints.slice(0, 2).join('. ')}`)
  }

  const insights = (state.insights || []).slice(-3)  // newest 3
  if (insights.length) {
    lines.push(`Insights: ${insights.join(' ')}`)
  }

  if (state.socialNotes?.length) {
    lines.push(`Social: ${state.socialNotes.slice(0, 2).join('. ')}`)
  }

  const hazards = (state.spatial || []).filter(s => s.hazard).slice(0, 2)
  if (hazards.length) {
    lines.push(`Hazards: ${hazards.map(h => h.note).join('. ')}`)
  }

  if (state.visionNote?.text) {
    const vAge = Math.round((Date.now() - (state.visionNote.ts || 0)) / 1000)
    lines.push(`Vision (${vAge}s ago): ${state.visionNote.text.slice(0, 200)}`)
  }

  const text = lines.join('\n')
  return text.length > 1500 ? text.slice(0, 1500) : text  // bumped cap slightly for new fields
}
