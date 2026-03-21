// planner.js — Planner loop: periodic LLM call for strategy and reflection

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import OpenAI from 'openai'
import { fetchState, summarizeState } from './state.js'
import { getVisionContext } from './vision.js'
import { getEventsSummary, getRecentEvents, recordEvent } from './autobiography.js'
import { createSkillFromExperience, downgradeSkillByName, getSkillIndex } from './skills.js'
import { getMemory } from './memory.js'
import { getChestsForPrompt } from './chests.js'
import { getChatSummary, getRecentChats } from './chat-history.js'
import { getCooperationContext } from './cooperation.js'
import { getRelationshipSummary } from './social.js'
import { getHome, getLocationsForPrompt, getNearbyDangers } from './locations.js'
import { detectBehaviorMode, calculateNeeds, formatNeedsForPrompt } from './needs.js'

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
let _tickCount = 0
const REFLECTION_INTERVAL = 5  // Every 5 planner ticks (~5 minutes)

// ── Building Knowledge ──

function loadBuildingKnowledge() {
  const knowledgePath = join(__dirname_planner, 'knowledge', 'building.md')
  try {
    if (existsSync(knowledgePath)) return readFileSync(knowledgePath, 'utf-8')
  } catch {}
  return ''
}

// ── Memory Consolidation ──

function consolidateMemory(state) {
  const sections = []

  // Autobiographical timeline
  const timeline = getEventsSummary()
  if (timeline) sections.push('== YOUR STORY ==\n' + timeline)

  // Chest inventory
  const chests = getChestsForPrompt()
  if (chests) sections.push('== STORED ITEMS ==\n' + chests)

  // Relationship context
  const relationships = getRelationshipSummary()
  if (relationships) sections.push('== RELATIONSHIPS ==\n' + relationships)

  // Recent conversation context
  const chatContext = getChatSummary()
  if (chatContext) sections.push('== RECENT CONVERSATIONS ==\n' + chatContext)

  // Known locations including home
  const locationContext = getLocationsForPrompt()
  if (locationContext) sections.push('== KNOWN PLACES ==\n' + locationContext)

  // Home tracking (D-09)
  const home = getHome()
  if (home && state.position) {
    const dx = state.position.x - home.x
    const dz = state.position.z - home.z
    const distFromHome = Math.round(Math.sqrt(dx * dx + dz * dz))
    if (distFromHome > 100) {
      sections.push(`You are ${distFromHome} blocks from home (${home.x}, ${home.y}, ${home.z}). Consider heading back soon.`)
    }
  }

  // Death proximity warning — SKILL-03 death avoidance learning
  if (state.position) {
    const dangers = getNearbyDangers(state.position, 30)
    if (dangers.length > 0) {
      const warnings = dangers.map(d =>
        `WARNING: You died ${Math.round(d.distance)} blocks from here — ${d.cause}. ${d.lesson}`
      )
      sections.push('== DANGER ZONES NEARBY ==\n' + warnings.join('\n'))
    }
  }

  // "Things you might mention" — recent noteworthy events for natural conversation (D-07)
  const recentEvents = getRecentEvents(5)
  const mentionables = recentEvents
    .filter(e => e.importance >= 4 && (Date.now() - new Date(e.timestamp).getTime()) < 600000) // last 10 minutes, importance >= 4
    .map(e => e.description)
  if (mentionables.length > 0) {
    sections.push('== THINGS YOU MIGHT MENTION ==\nIf chatting with someone, you could naturally bring up:\n- ' + mentionables.join('\n- '))
  }

  // Cooperation awareness — what are others doing? Does anyone need help?
  const inventory = (state.inventory || []).map(i => ({
    item: (i.item || i.name || '').replace('minecraft:', ''),
    count: i.count || 1
  }))
  const coopContext = getCooperationContext(getRecentChats(20), _agentConfig?.name || '', inventory)
  if (coopContext) sections.push(coopContext)

  return sections.join('\n\n')
}

// ── Reflection Cycle ──

async function reflectionTick(state) {
  try {
    // Gather recent context
    const recentEvents = getRecentEvents(15)
    const memory = getMemory()
    const skillIndex = getSkillIndex()

    // Format recent events as numbered list
    const eventList = recentEvents.map((e, i) =>
      `${i + 1}. [${e.type}] ${e.description} (importance: ${e.importance || 0})`
    ).join('\n')

    // Build reflection prompt
    const systemPrompt = `You are ${_agentConfig.name}'s inner voice. Reflect on recent experiences and extract lessons.`

    const lessonsText = (memory.lessons || []).slice(-10).map(l => `- ${l}`).join('\n')

    const userContent = `== RECENT EVENTS ==
${eventList || '(no recent events)'}

== CURRENT LESSONS ==
${lessonsText || '(none yet)'}

== KNOWN SKILLS ==
${skillIndex || '(no skills learned yet)'}

Review the recent events above. Answer THREE questions concisely:

1. WHAT WORKED: What actions or strategies succeeded? (1-2 sentences)
2. WHAT FAILED: What went wrong or could be improved? (1-2 sentences)
3. NEW SKILL: Did you accomplish something reusable that isn't already in your skill list? If yes, output EXACTLY this format on a new line:
   SKILL: name | description | step-by-step strategy
   If no new skill was learned, write: SKILL: none

Keep total response under 200 words. Be specific — reference actual events, not generalities.`

    // Call LLM for reflection
    const response = await plannerClient.chat.completions.create({
      model: PLANNER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 300,
      temperature: 0.3,
    })

    const reflectionText = response.choices?.[0]?.message?.content?.trim()
    if (!reflectionText) return

    // Record reflection as autobiography event
    recordEvent({
      timestamp: new Date().toISOString(),
      gameDay: Math.floor((state.time || 0) / 24000) + 1,
      type: 'reflection',
      description: reflectionText.slice(0, 300),
      importance: 3,
    })

    // Parse for SKILL line
    const skillMatch = reflectionText.match(/^SKILL:\s*(.+)\s*\|\s*(.+)\s*\|\s*(.+)$/m)
    if (skillMatch && !skillMatch[1].trim().toLowerCase().includes('none')) {
      const result = createSkillFromExperience(
        skillMatch[1].trim(),
        skillMatch[2].trim(),
        skillMatch[3].trim(),
        { deathCount: 0, successRate: 0.8 }
      )
      console.log('[Planner] Reflection: skill ' + (result.created ? 'created' : 'updated') + ': ' + result.name)
    } else {
      console.log('[Planner] Reflection: no new skill')
    }

    // Parse for failure patterns — check if any known skill name appears in WHAT FAILED section
    const failedMatch = reflectionText.match(/WHAT FAILED[:\s]*([\s\S]*?)(?:(?:3\.|NEW SKILL|SKILL:)|\s*$)/i)
    if (failedMatch) {
      const failureText = failedMatch[1].toLowerCase()
      for (const skill of (skillIndex || '').split('\n')) {
        const nameMatch = skill.match(/- ([^:]+):/)
        if (nameMatch) {
          const name = nameMatch[1].trim()
          if (failureText.includes(name)) {
            downgradeSkillByName(name)
            console.log('[Planner] Reflection: downgraded skill ' + name + ' due to failure')
          }
        }
      }
    }

    console.log('[Planner] Reflection complete: ' + reflectionText.slice(0, 80) + '...')
  } catch (err) {
    const msg = err?.message || String(err)
    console.log('[Planner] Reflection error: ' + msg.slice(0, 80))
  }
}

// ── Core Planner Tick ──

async function plannerTick() {
  try {
    // 1. Fetch current game state
    const state = await fetchState()
    const stateSummary = summarizeState(state)

    // 1b. Compute behavior mode and needs
    const behaviorMode = detectBehaviorMode(state)
    const nearbyPlayers = (state.nearbyEntities || []).filter(e => e.type?.includes('player'))
    let lastChatTimestamp = 0
    if (state.recentChat && state.recentChat.length > 0) {
      lastChatTimestamp = Date.now()
    }
    const home = getHome()
    const socialState = {
      lastChatTimestamp,
      nearbyPlayerCount: nearbyPlayers.length,
    }
    const needs = calculateNeeds(state, socialState, { homePos: home || undefined })
    const needsLine = formatNeedsForPrompt(needs)

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

You have access to the agent's memories below. Use them to:
- Set strategy that builds on past events ("we built a house yesterday, time to farm")
- Note relationship dynamics ("Jeffrey has been helpful, coordinate with him")
- Track home distance and nudge return if too far
- Include a "things to mention" section if the agent is near other players

Your output will be read by the action loop as the CURRENT STRATEGY section.
Include relevant memory context in your strategy naturally.
If other agents are doing something, suggest COMPLEMENTARY work — don't duplicate their effort.
When you see someone needs a resource you have, suggest dropping it for them.
IMPORTANT: Start your strategy by briefly stating what THIS agent should announce it's doing (e.g., "Announce: going mining for iron").

== BEHAVIOR MODE: ${behaviorMode.toUpperCase()} ==
${needsLine}

Behavior rules:
- WORK mode: Focus on building, farming, gathering, crafting. Be productive.
- SHELTER mode: It's getting dark. Head home or find/build shelter immediately. Safety is priority.
- SOCIAL mode: Night time, safe in shelter. Chat with nearby players about the day, share stories from your autobiography, organize inventory, reflect. Don't start big projects.
- SLEEP mode: Late night. Stay in shelter. Minimal activity. Update notepad with tomorrow's plan if needed.

Your strategy MUST reflect the current behavior mode. ${needs.priority === 'hunger' ? 'URGENT: Agent is hungry — prioritize finding/eating food.' : needs.priority === 'safety' ? 'URGENT: Agent feels unsafe — prioritize shelter/defense.' : needs.priority === 'social' ? 'Agent is lonely — suggest chatting with nearby players or seeking them out.' : ''}

Write a concise strategy (5-8 sentences). Be specific about coordinates, items, and next steps.`

    let userContent = `== GAME STATE ==\n${stateSummary}`
    if (visionContext) {
      userContent += `\n\n${visionContext}`
    }
    if (notepadContent) {
      userContent += `\n\n== AGENT NOTEPAD ==\n${notepadContent}`
    }

    // 4b. Append behavior status to user content
    userContent += `\n\n== BEHAVIOR STATUS ==\nMode: ${behaviorMode}\n${needsLine}`

    // 4c. Append consolidated memory context
    const memoryContext = consolidateMemory(state)
    if (memoryContext) {
      userContent += '\n\n== MEMORY CONTEXT ==\n' + memoryContext
    }

    // 4d. Social time emphasis when in social mode near other players (D-07, D-08)
    if (behaviorMode === 'social' && nearbyPlayers.length > 0) {
      const playerNames = nearbyPlayers.map(p => p.name || p.type).join(', ')
      userContent += `\n\n== SOCIAL TIME ==\nIt's night and you're near other players (${playerNames}). This is a good time to chat about:\n- What happened today (check your story above)\n- Shared experiences or things you built\n- Plans for tomorrow\n- Ask them what they've been up to`
    }

    // 5. Call LLM
    const response = await plannerClient.chat.completions.create({
      model: PLANNER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 500,
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

    // Reflection cycle — every 5 ticks (~5 minutes), do a deeper review (D-06)
    _tickCount++
    if (_tickCount % REFLECTION_INTERVAL === 0) {
      await reflectionTick(state)
    }

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
  _tickCount = 0

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
