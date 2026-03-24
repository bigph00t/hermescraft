// backgroundBrain.js — Background brain: memory keeper that watches conversation and extracts important facts

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
const BACKGROUND_MAX_TOKENS = parseInt(process.env.BACKGROUND_MAX_TOKENS || '512', 10)
const BACKGROUND_INTERVAL_MS = parseInt(process.env.BACKGROUND_INTERVAL_MS || '15000', 10)
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

// Fact type → memoryDB event_type mapping
const FACT_TYPE_MAP = {
  location:   'discovery',
  commitment: 'social',
  event:      'observation',
  social:     'social',
  danger:     'combat',
  craft:      'craft',
  build:      'build',
}

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

  console.log(`[background-brain] initialized as memory keeper — first cycle in ${STARTUP_DELAY_MS / 1000}s, interval ${BACKGROUND_INTERVAL_MS / 1000}s`)
}

// getBrainHooks() — returns actionable hooks from brain state for programmatic use.
// Memory keeper only provides urgentWarning (danger patterns detected in conversation).
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
      urgentWarning: state.urgentWarning || null,
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
  // Apply ring buffer cap for extracted facts
  if (state.extractedFacts) {
    while (state.extractedFacts.length > 50) state.extractedFacts.shift()
  }

  const content = JSON.stringify(state, null, 2)
  writeFileSync(BRAIN_STATE_TMP, content, 'utf-8')
  renameSync(BRAIN_STATE_TMP, BRAIN_STATE_FILE)  // atomic on POSIX local disk
}

// parseLLMJson(raw) — strips <think> blocks and markdown fences, then parses JSON.
// Handles both arrays and objects. Returns parsed value or null on failure — never throws.
function parseLLMJson(raw) {
  // Strip <think>...</think> reasoning blocks
  let text = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  // First try: direct parse
  try {
    return JSON.parse(text)
  } catch {
    // Second try: extract outermost [...] array
    const arrMatch = text.match(/\[[\s\S]*\]/)
    if (arrMatch) {
      try {
        return JSON.parse(arrMatch[0])
      } catch {}
    }
    // Third try: extract outermost {...} object
    const objMatch = text.match(/\{[\s\S]*\}/)
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0])
      } catch {}
    }
    return null  // parse failed — caller keeps existing state
  }
}

// buildMemoryPrompt(recentHistory, existingFacts) — prompt for the memory keeper.
// Watches conversation and extracts important facts for long-term recall.
function buildMemoryPrompt(recentHistory, existingFacts) {
  const historyText = recentHistory.length > 0
    ? recentHistory.map(m => `${m.role}: ${typeof m.content === 'string' ? m.content.slice(0, 200) : '[content]'}`).join('\n')
    : '(no recent history yet)'

  const factsText = existingFacts.length > 0
    ? existingFacts.slice(-15).map(f => `[${f.type}] ${f.text}`).join('\n')
    : '(no facts yet)'

  return `You are the memory system for ${_agentName}. Review the recent conversation and extract important facts worth remembering.

Recent conversation:
${historyText}

Already known facts:
${factsText}

Extract NEW facts only — do not repeat facts already known. Types: location, commitment, event, social, danger, craft, build.

Output valid JSON array:
[
  { "type": "location", "text": "iron ore found at 45,32,90", "importance": 7 },
  { "type": "commitment", "text": "luna is building the market, john mining stone", "importance": 5 },
  { "type": "event", "text": "built first house - The Forge", "importance": 8 },
  { "type": "social", "text": "john asked for help with the wall", "importance": 4 }
]

importance: 1-10 (10=critical like death, 1=trivial).
Output [] if nothing new to extract. ONLY valid JSON array, nothing else.`
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
// Memory keeper: extracts facts from conversation, logs them to memoryDB, maintains brain-state.json.
// Sets _bgRunning in try/finally to prevent overlapping calls.
async function runBackgroundCycle(bot, config) {
  _bgRunning = true
  try {
    // Get the most recent conversation history (live reference — respects clearConversation())
    const history = getHistory()
    const recentHistory = history.slice(-20)  // last 20 messages

    // Load existing brain state to preserve ring buffer continuity
    let existingState = null
    try {
      if (existsSync(BRAIN_STATE_FILE)) {
        existingState = JSON.parse(readFileSync(BRAIN_STATE_FILE, 'utf-8'))
      }
    } catch {}

    const existingFacts = existingState?.extractedFacts || []

    // Build memory extraction prompt and call model
    const prompt = buildMemoryPrompt(recentHistory, existingFacts)

    const response = await bgClient.chat.completions.create({
      model: BACKGROUND_MODEL,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'Extract new facts from the conversation now. Output JSON array only.' },
      ],
      max_tokens: BACKGROUND_MAX_TOKENS,
      temperature: 0.2,  // low temperature for factual extraction
    })

    const raw = response.choices?.[0]?.message?.content || ''
    const parsed = parseLLMJson(raw)

    // Validate: must be an array
    const newFacts = Array.isArray(parsed) ? parsed : []

    // Filter valid facts — each must have type and text
    const validFacts = newFacts.filter(f =>
      f && typeof f.type === 'string' && typeof f.text === 'string' && f.text.length > 3
    )

    // Log each extracted fact to memoryDB
    for (const fact of validFacts) {
      const eventType = FACT_TYPE_MAP[fact.type] || 'observation'
      const importance = Math.min(10, Math.max(1, fact.importance || 3))
      logEvent(bot, eventType, fact.text, {
        source: 'memory_keeper',
        factType: fact.type,
        extractedImportance: importance,
      })
    }

    // Check for danger patterns — set urgentWarning if any high-importance danger facts
    const dangerFacts = validFacts.filter(f => f.type === 'danger' && (f.importance || 0) >= 7)
    const urgentWarning = dangerFacts.length > 0
      ? dangerFacts.map(f => f.text).join('; ')
      : null

    // Add timestamps to facts for the ring buffer
    const timestampedFacts = validFacts.map(f => ({
      ...f,
      ts: Date.now(),
    }))

    // Merge into brain state
    const mergedState = {
      ...(existingState || {}),
      extractedFacts: [
        ...existingFacts,
        ...timestampedFacts,
      ],
      urgentWarning,
      updated_at: Date.now(),
      schema_version: 3,
    }

    writeBrainState(mergedState)

    // Invalidate TTL cache so next getBrainStateForPrompt() reads the fresh file
    _cachedState = null
    _cacheTime = 0

    if (validFacts.length > 0) {
      console.log(`[background-brain] extracted ${validFacts.length} facts: ${validFacts.map(f => f.type).join(', ')}`)
    }

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
    try {
      const visionResult = await captureAndAnalyze(bot, DATA_DIR, 'terrain, structures, threats, and surroundings')
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

// formatBrainState(state) — compact prompt-injection format, capped at 1500 chars (~300 tokens).
// Returns null if state is falsy.
function formatBrainState(state) {
  if (!state) return null

  const age = Math.round((Date.now() - (state.updated_at || 0)) / 1000)
  const lines = [`## Memory Notes (${age}s ago)`]

  // Urgent warning goes first — most important signal
  if (state.urgentWarning) {
    lines.push(`WARNING: ${state.urgentWarning}`)
  }

  // Show last 10 extracted facts grouped by type
  const facts = (state.extractedFacts || []).slice(-10)
  if (facts.length > 0) {
    for (const fact of facts) {
      const factAge = Math.round((Date.now() - (fact.ts || 0)) / 1000)
      lines.push(`- [${fact.type}] ${fact.text} (${factAge}s ago)`)
    }
  }

  if (state.visionNote?.text) {
    const vAge = Math.round((Date.now() - (state.visionNote.ts || 0)) / 1000)
    lines.push(`Vision (${vAge}s ago): ${state.visionNote.text.slice(0, 200)}`)
  }

  const text = lines.join('\n')
  return text.length > 1500 ? text.slice(0, 1500) : text
}
