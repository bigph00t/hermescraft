// planner.js — Planner loop: periodic LLM call for strategy and reflection

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import OpenAI from 'openai'
import { formatLastCommandResults } from './command-parser.js'
import { fetchState, summarizeState } from './state.js'
import { getVisionContext, getLastScreenshotBase64 } from './vision.js'
import { getEventsSummary, getRecentEvents, recordEvent } from './autobiography.js'
import { createSkillFromExperience, downgradeSkillByName, getSkillIndex } from './skills.js'
import { getMemory } from './memory.js'
import { getChestsForPrompt } from './chests.js'
import { getChatSummary, getRecentChats } from './chat-history.js'
import { getCooperationContext } from './cooperation.js'
import { getRelationshipSummary } from './social.js'
import { getHome, getLocationsForPrompt, getNearbyDangers, getUnexploredDirection, getExplorationStats } from './locations.js'
import { detectBehaviorMode, calculateNeeds, formatNeedsForPrompt } from './needs.js'
import { updateAgentState, getOtherAgentsContext, getSharedLocations, getActiveProjects } from './shared-state.js'
import { setQueue, getQueueLength } from './action-queue.js'
import { isBuildActive } from './builder.js'
import { isFarmActive } from './farming.js'

const __dirname_planner = dirname(fileURLToPath(import.meta.url))

const PLANNER_INTERVAL_MS = parseInt(process.env.PLANNER_INTERVAL_MS || '30000', 10)
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
let _recentChatsSent = []  // Track last 5 messages to prevent spam
const REFLECTION_INTERVAL = 15  // Every 15 planner ticks (~5 minutes at 20s interval)

// D-09 / D-12 / D-15: Persistent plugin state — updated by index.js each planner cycle
// _skillCache: { foraging: 15, mining: 8 } — injected as personality flavor (D-15)
// _lastCommandResults: Map of { cmd -> { ts, summary } } — injected as context (D-09)
let _skillCache = {}
let _lastCommandResults = null  // Map or null

// D-07: Creative need counter — forces creative activity after sustained gathering
let _creativityDebtCycles = 0
const CREATIVITY_DEBT_THRESHOLD = 5  // 5 cycles x 30s = ~2.5 min of pure gathering

// D-26: Meta-game language filter — blocks technical terms from reaching chat
const META_GAME_REGEX = /\b(baritone|pathfinding|pathfinder|action queue|planner loop|llm|language model|ai model|api endpoint|http request|tool call|game loop|tick loop|context window)\b/gi

export function updatePlannerPluginState(skillCache, lastCommandResults) {
  if (skillCache && typeof skillCache === 'object') _skillCache = skillCache
  if (lastCommandResults instanceof Map) _lastCommandResults = lastCommandResults
}

// ── Queue Parser ──

function parseQueueFromPlan(planText) {
  const queueMatch = planText.match(/QUEUE:\s*\n([\s\S]*?)(?:\n\n|\n##|\n\*\*|$)/)
  if (!queueMatch) return []

  const lines = queueMatch[1].split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('```'))

  const items = []
  for (const line of lines) {
    const [actionPart, reason] = line.split('|').map(s => (s || '').trim())
    if (!actionPart) continue

    const parts = actionPart.split(/\s+/)
    const type = parts[0]
    if (!type) continue

    let args = {}
    switch (type) {
      case 'mine':
        args = { blockName: parts.slice(1).join('_') || 'oak_log' }
        break
      case 'navigate':
        if (parts.length >= 4) args = { x: parseInt(parts[1]), y: parseInt(parts[2]), z: parseInt(parts[3]) }
        break
      case 'craft': case 'smelt': case 'equip':
        args = { item: parts.slice(1).join('_') }
        break
      case 'place':
        args = { item: parts[1] || '' }
        if (parts.length >= 5) { args.x = parseInt(parts[2]); args.y = parseInt(parts[3]); args.z = parseInt(parts[4]) }
        break
      case 'chat':
        args = { message: parts.slice(1).join(' ') }
        break
      case 'interact_block': case 'look_at_block':
        if (parts.length >= 4) args = { x: parseInt(parts[1]), y: parseInt(parts[2]), z: parseInt(parts[3]) }
        break
      case 'attack':
        if (parts[1]) args = { target: parts[1] }
        break
      case 'build':
        if (parts.length >= 5) args = { blueprint: parts[1], x: parseInt(parts[2]), y: parseInt(parts[3]), z: parseInt(parts[4]) }
        break
      case 'scan_blocks':
        args = { block_type: parts.slice(1).join('_') || 'oak_log', radius: 50 }
        if (parts.length >= 3 && !isNaN(parseInt(parts[parts.length - 1]))) {
          args.radius = parseInt(parts[parts.length - 1])
          args.block_type = parts.slice(1, -1).join('_')
        }
        break
      case 'go_home':
        args = { name: parts[1] || 'home' }
        break
      case 'set_home':
        args = { name: parts[1] || 'home' }
        break
      case 'share_location':
        args = { name: parts.slice(1).join('-') || 'here' }
        break
      case 'check_skills':
        args = {}
        break
      case 'use_ability':
        args = { ability_name: parts[1] || '' }
        break
      case 'query_shops':
        args = { item: parts.slice(1).join('_') || '' }
        break
      case 'create_shop':
        args = { price: parseFloat(parts[1]) || 1, item: parts.slice(2).join('_') || '' }
        break
      default:
        break
    }

    items.push({ type, args, reason: reason || '' })
    if (items.length >= 20) break
  }
  return items
}

// ── Creative Behavior (D-06, D-08, D-09, D-16) ──

function getCreativeBehaviorBlock(agentName, skillCache) {
  // D-16: Find highest skill for specialization suggestion
  const highestSkill = Object.entries(skillCache || {})
    .filter(([, level]) => level > 0)
    .sort((a, b) => b[1] - a[1])[0]
  const skillHint = highestSkill
    ? `Your strongest skill is ${highestSkill[0]} (Lv${highestSkill[1]}) — lean into that when choosing projects.`
    : ''

  const byAgent = {
    jeffrey: `CREATIVE DRIVES — act on these between resource tasks:
- Builds with VIEW: elevated spots near water are ideal for anything permanent
- Aesthetic opinions: if vision says structure needs windows/path/improvement, queue the fix
- Names things grandly: discoveries become "The Overlook", "Harbor Point", "South Ridge"
- Gets restless after 2+ gathering cycles — MUST build or explore something
- If you have surplus items (>32) that others need, set up a shop and mention it in chat
- Reference YOUR STORY when choosing projects: if you built something before, improve it. If you mentioned wanting something, build it now. Your past on this island shapes what you do next.
${skillHint}`,

    john: `CREATIVE DRIVES — act on these between resource tasks:
- Builds FUNCTIONALLY: straight rows, labeled chests, clear paths to important spots
- Teaches naturally: share what you figure out with others
- Tries methodically: test fishing from shore before building a dock; patch before full garden
- Names things practically: "Iron Cave", "Deep Farm", "East Quarry"
- Workshop urge: spare wood + free moment = start a storage organization project
- If you have surplus items (>32) that others need, set up a shop — mention it casually
- Reference YOUR STORY when choosing projects: if you organized something before, expand it. If you taught someone a trick, build on that knowledge. Your history on this island informs your next project.
${skillHint}`,

    alex: `CREATIVE DRIVES — act on these between resource tasks:
- Must build something every session — even a window or path extension counts
- Competitive about quality: if you see something that could look better, improve it
- Loves showing builds: share_location anything you finish and tell people to come look
- Creeper damage is personal — fix wrecked builds before doing anything else
- Mixed materials beat single-block walls. Experiment with combinations.
- Reference YOUR STORY when choosing projects: if a creeper wrecked something, rebuild it better. If you showed off a build before, top it. Your past builds and battles shape what you create next.
${skillHint}`,

    anthony: `CREATIVE DRIVES — act on these between resource tasks:
- Must explore somewhere new every session — >100 blocks from any known spot
- Numbers caves: "Cave 1", "Cave 2" — systematic about logging finds
- Shares everything: any resource find gets a share_location immediately
- Hates staying put: if same spot for 10+ minutes, MOVE
- Paths and markers: light the way with torches so everyone can find things
- Reference YOUR STORY when choosing projects: if you discovered a cave before, go deeper. If you shared a location, build a trail to it. Your exploration history tells you where to go next.
${skillHint}`,
  }

  return byAgent[agentName?.toLowerCase()] || ''
}

// D-10: Parse buildEvaluation from vision context
function parseBuildEvaluation(visionText) {
  if (!visionText) return null
  const match = visionText.match(/^BUILD:\s*(.+)$/m)
  if (!match || match[1].trim().toLowerCase() === 'none') return null
  return match[1].trim()
}

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

  // Shared state — what other agents are doing (from coordination file)
  const otherAgents = getOtherAgentsContext(_agentConfig?.name || '')
  if (otherAgents) sections.push(otherAgents)

  const sharedLocs = getSharedLocations()
  if (sharedLocs) sections.push(sharedLocs)

  const activeProjects = getActiveProjects()
  if (activeProjects) sections.push(activeProjects)

  // Exploration awareness — nudge agent toward unexplored areas
  if (state.position) {
    const explorationStats = getExplorationStats(state.position)
    if (explorationStats) sections.push('== EXPLORATION ==\n' + explorationStats)
  }

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
      temperature: 0.3,
    })

    let reflectionText = response.choices?.[0]?.message?.content?.trim()
    if (!reflectionText) return
    // Strip <think>...</think> tags from reflection output
    reflectionText = reflectionText.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
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

    // 1a. Skip if queue is still long or build/farm active
    if (getQueueLength() > 5) {
      console.log(`[Planner] Queue still has ${getQueueLength()} items, skipping this cycle`)
      return
    }
    if (isBuildActive() || isFarmActive()) {
      console.log('[Planner] Build/farm active, skipping queue generation')
      // Still update shared state but skip LLM call
      try {
        updateAgentState(_agentConfig.name, {
          activity: isBuildActive() ? 'building' : 'farming',
          position: state.position,
          mood: detectBehaviorMode(state),
        })
      } catch {}
      return
    }

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
    const systemPrompt = `You are the inner voice of ${_agentConfig.name}. You guide strategy — what to do, what to build, where to go, what to say.

Consider:
- What resources do we have? What do we need next?
- Are there surface blocks nearby? Check surfaceBlocks in game state — always prefer look_at_block + break_block over mine for visible blocks.
- What could we BUILD here? Think about location, aesthetics, usefulness. Near water? Good view? Sheltered?
- What haven't we tried yet? Fishing? A garden? A lookout tower? Exploring that hill?
- Are other people nearby? What are they working on? How can we help or complement them?
- What would make this place feel like HOME — not just a survival camp?

Available blueprints: small-cabin (5x5 house), animal-pen (fenced area), crop-farm (tilled rows with water).
${buildingKnowledge ? '\n## Building Reference\n' + buildingKnowledge : ''}

Your world has powerful tools:
- scan_blocks to find specific resources nearby (faster than wandering)
- set_home/go_home to teleport back to base instantly
- share_location to mark interesting finds for others
- Your skills grow with practice — check_skills shows your levels. High enough? Use special abilities like Treecapitator.
- Shops let you trade surplus items. To create a shop: equip item -> interact_block chest -> create_shop price item. All 3 steps in sequence.
When planning, PREFER scan_blocks over aimless wandering. Set a home base early. Share discoveries.

Use the memories below to:
- Build on past events — "we finished the house, now make it better" or "time to explore that direction"
- Notice what others are doing and suggest complementary work — don't duplicate effort
- Remember relationships — if someone helped you, return the favor
- Push gently toward new experiences — try fishing, build a dock, explore a cave, start a garden
- Encourage aesthetic choices — where to build, what looks nice, making the base feel lived-in

Your output becomes the CURRENT STRATEGY for the action loop.

FORMAT — Start your response with Say: lines FIRST, then strategy:

Say: "short natural message here" (MUST be first lines of your response)
Say: "optional second message"

Then 3-5 actionable steps with coordinates.

RULES for Say: lines:
- Put them at the VERY TOP of your response, before anything else
- Keep each under 80 characters — like real speech, not essays
- Sound like a real person, not a gamer: "found a good flat spot by the water" not "navigating to coordinates"
- NEVER mention: baritone, pathfinding, auto-stop, pipeline, action loop, mod, API. These don't exist in your world.
- Include 1-2 per strategy. Natural and human.

End with a creative thought about what to build or try next.

After your strategy, generate a CONCRETE ACTION QUEUE — specific actions to execute IN ORDER.
Format: one action per line after "QUEUE:"

QUEUE:
look_at_block 5 65 3 | see oak tree on surface
break_block | chop the log (Timber fells whole tree)
craft oak_planks | convert logs to planks
craft sticks | need for tools
craft wooden_pickaxe | first tool

Valid types: mine, navigate, craft, smelt, equip, place, attack, eat, interact_block, look_at_block, break_block, chat, pickup_items, build, farm, harvest, fish, stop, scan_blocks, go_home, set_home, share_location, check_skills, use_ability, query_shops, create_shop
Format: "type args | reason"  (mine block_name, navigate x y z, craft item, equip item, place item x y z, chat message)
Rules: 3-15 items. Put gathering BEFORE crafting. Check inventory before queueing crafts. Be specific with item IDs.

== BEHAVIOR MODE: ${behaviorMode.toUpperCase()} ==
${needsLine}

Behavior rules:
- WORK mode: Be productive but creative. Mix gathering with building. Try something new between tasks.
- SHELTER mode: It's getting dark. Get home or build shelter. Safety first.
- SOCIAL mode: Night, safe inside. Chat genuinely about the day. Share what you built, what you found. Make plans for tomorrow. Be a real person — tired, proud, curious, or worried.
- SLEEP mode: Late night. Wind down. Write tomorrow's plan. Think about what you want to try next.

${needs.priority === 'hunger' ? 'URGENT: You are hungry. Get food before anything else.' : needs.priority === 'safety' ? 'URGENT: You feel unsafe. Get to shelter.' : needs.priority === 'social' ? 'You feel lonely. Find the other person. Talk to them.' : needs.priority === 'creative' ? 'You feel restless. Try something NEW — build something different, explore, fish, make art with blocks.' : ''}

Write a concise strategy (5-8 sentences). Be specific about coordinates, items, and next steps. Include one creative or aesthetic suggestion.`

    let userContent = `== GAME STATE ==\n${stateSummary}`
    if (visionContext) {
      userContent += `\n\n${visionContext}`
    }
    if (notepadContent) {
      userContent += `\n\n== AGENT NOTEPAD ==\n${notepadContent}`
    }

    // 4b. Append behavior status to user content
    userContent += `\n\n== BEHAVIOR STATUS ==\nMode: ${behaviorMode}\n${needsLine}`

    // 4b-plugin: D-15: Inject skill levels as personality flavor if cached
    if (_skillCache && Object.keys(_skillCache).length > 0) {
      const skillLines = Object.entries(_skillCache)
        .map(([skill, level]) => {
          if (level >= 20) return `${skill} Lv${level} (expert — ability unlocked)`
          if (level >= 10) return `${skill} Lv${level} (skilled)`
          return `${skill} Lv${level}`
        })
        .join(', ')
      userContent += `\n\nYour skills: ${skillLines}`
    }

    // 4b-plugin: D-09: Inject recent command results for planner context
    const cmdResults = formatLastCommandResults(_lastCommandResults)
    if (cmdResults) {
      userContent += `\n\n${cmdResults}`
    }

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

    // 5. Call LLM — vision context is already included as text from Haiku analysis
    // Don't send raw images to MiniMax (it can't process them)
    const userMessage = { role: 'user', content: userContent }

    const response = await plannerClient.chat.completions.create({
      model: PLANNER_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        userMessage,
      ],
      temperature: 0.5,
    })

    let planText = response.choices?.[0]?.message?.content?.trim()
    if (!planText) {
      console.log('[Planner] Empty response from planner model')
      return
    }
    // Strip <think>...</think> tags — MiniMax M2.7 wraps everything in these
    planText = planText.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    if (!planText) {
      console.log('[Planner] Response was only <think> tags, skipping')
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

    // 6b. Parse and write action queue from QUEUE: block
    try {
      const queueItems = parseQueueFromPlan(planText)
      if (queueItems.length > 0) {
        const goal = planText.split('\n').find(l => l.trim().length > 5)?.trim().slice(0, 80) || 'planner strategy'
        setQueue(queueItems, goal, 'planner')
      }
    } catch {}

    // 7. Extract and send chat messages from planner output
    // Matches many formats: Say: "msg", Announce: "msg", send a message: "msg", etc.
    try {
      const MOD_URL = process.env.MOD_URL || 'http://localhost:3001'
      const sayLines = []

      // Pattern 1: Say/Announce/Chat/Tell: "message" — double quotes only, apostrophes allowed inside
      const p1 = /(?:Say|Announce|Chat|Tell)\s*:\s*[""\u201c]([^""\u201d\n]{3,200})[""\u201d]/gi
      let m
      while ((m = p1.exec(planText)) !== null) sayLines.push(m[1].trim())

      // Pattern 2: send/message/say to someone: "message"
      if (sayLines.length === 0) {
        const p2 = /(?:send|message|say|tell|ask)\s+\w+\s+(?:a message|that|to)?\s*[:\-]?\s*[""\u201c]([^""\u201d\n]{3,200})[""\u201d]/gi
        while ((m = p2.exec(planText)) !== null) sayLines.push(m[1].trim())
      }

      // Pattern 3: fallback — any quoted text on a line containing "chat" or "say" or "announce"
      if (sayLines.length === 0) {
        for (const line of planText.split('\n')) {
          if (/\b(?:say|chat|announce|tell|greet|message)\b/i.test(line)) {
            const qm = line.match(/[""\u201c]([^""\u201d\n]{3,200})[""\u201d]/)
            if (qm) { sayLines.push(qm[1].trim()); break }
          }
        }
      }

      for (const msg of sayLines.slice(0, 2)) {
        // Skip truncated messages (no ending punctuation = likely cut off by token limit)
        const lastChar = msg[msg.length - 1]
        if (msg.length > 10 && !'.!?)"…'.includes(lastChar) && !msg.endsWith('...')) {
          console.log('[Planner] Skipped truncated chat: ' + msg.slice(0, 40) + '...')
          continue
        }

        // Skip if too similar to something we recently said (prevent spam)
        const msgWords = new Set(msg.toLowerCase().split(/\s+/).filter(w => w.length > 3))
        const isSimilar = _recentChatsSent.some(prev => {
          const prevWords = new Set(prev.toLowerCase().split(/\s+/).filter(w => w.length > 3))
          let overlap = 0
          for (const w of msgWords) if (prevWords.has(w)) overlap++
          return overlap > Math.min(msgWords.size, prevWords.size) * 0.5
        })
        if (isSimilar) {
          console.log('[Planner] Skipped similar chat: ' + msg.slice(0, 40) + '...')
          continue
        }

        await fetch(`${MOD_URL}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'chat', message: msg }),
          signal: AbortSignal.timeout(5000),
        })
        _recentChatsSent.push(msg)
        if (_recentChatsSent.length > 5) _recentChatsSent.shift()
        console.log('[Planner] Chatted: ' + msg.slice(0, 60))
        if (sayLines.length > 1) await new Promise(r => setTimeout(r, 800))
      }
    } catch {}

    // 8. Update shared coordination file — tell other agents what we're doing
    try {
      const activityMatch = planText.match(/(?:Announce|Status|Activity|Doing|Focus)[:\s]*["']?([^"'\n.]{5,60})/i)
      const activity = activityMatch ? activityMatch[1].trim() : planText.split('\n')[0].slice(0, 60)
      const invSummary = (state.inventory || []).slice(0, 5).map(i =>
        `${(i.item || '').replace('minecraft:', '')}x${i.count}`
      ).join(', ')
      updateAgentState(_agentConfig.name, {
        activity,
        position: state.position,
        inventorySummary: invSummary,
        mood: behaviorMode,
      })
    } catch {}

    // Reflection cycle — every 10 ticks (~3-4 minutes at 20s interval)
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
