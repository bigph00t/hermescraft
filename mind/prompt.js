// prompt.js — System prompt builder, game state summary, and blueprint design prompt for v2 Mind layer

import { buildSpatialAwareness } from './spatial.js'
import { getHome } from './locations.js'
import { getPartnerLastChat } from './social.js'

// ── Design Prompt ──

// Build a dedicated system prompt for blueprint generation — used only in the !design LLM call.
// This is NOT the regular game prompt. It drives a SEPARATE LLM call whose sole purpose is to
// produce blueprint JSON. The caller (mind/index.js designAndBuild) passes the references.
//
// Parameters:
//   description        — natural language structure description from the user/game command
//   referenceBlueprints — array of { name: string, json: string } objects (typically 3)
//
// Returns a string prompt that instructs the model to output ONLY valid blueprint JSON.
export function buildDesignPrompt(description, referenceBlueprints, terrainSurvey) {
  // Select up to 2 reference examples (fewer = less copying, more creativity)
  const refs = (referenceBlueprints || []).slice(0, 2)
  const refExamples = refs.map(ref => {
    return `=== ${ref.name} ===\n${ref.json}`
  }).join('\n\n')

  return `You are a creative Minecraft architect. Design an ORIGINAL structure — not a copy of any example.

OUTPUT FORMAT — valid JSON only:
{
  "name": "snake_case_name",
  "description": "human-readable description",
  "size": { "x": width, "y": height, "z": depth },
  "palette": {
    "CHAR": { "preferred": ["block_name", "alt1", "alt2"], "tag": "label" }
  },
  "layers": [
    { "y": 0, "comment": "layer purpose", "grid": ["ROW...", ...] }
  ]
}

JSON RULES:
- Layers ascending y order (y:0=ground). '.' means air. Every non-'.' char must be in palette.
- Every row must have exactly size.x characters. Every layer must have exactly size.z rows.
- palette preferred[] must be valid Minecraft 1.21.1 block names. Provide 2-3 alternatives.
- Max footprint: 12x12. Max height: 10. Build bottom-up: foundation → walls → roof.

ARCHITECTURE GUIDELINES — make it look REAL, not like a box:
- ROOFS: Use stairs (oak_stairs, stone_brick_stairs, spruce_stairs) for peaked/sloped roofs. Flat slab roofs are boring — only use for tiny utility sheds. A good roof overhangs the walls by 1 block.
- MATERIALS: Always mix 2-3 block types. Stone base + wood upper is classic. Use logs at corners as pillars. Glass_pane for windows, not solid glass.
- SHAPE: Not everything is a rectangle. Try L-shapes, add porches, recessed doorways, overhanging second floors, or bump-outs.
- INTERIOR: Place torches (T) every 4-5 blocks inside for mob-proofing. Add detail — a building should feel lived-in.
- PROPORTIONS: Wall height = floor width/2 + 1. Doors at y=1 only. Windows at y=2 (eye level).
- VARIETY: A blacksmith looks different from a library. A market has open fronts. A tower is tall and narrow. Let the function drive the form.

DO NOT copy the reference examples. They show the JSON format, not your design. YOUR structure should have a unique shape, creative material palette, and interesting architectural details that match its purpose.

TERRAIN ADAPTATION: If terrain data is provided below, adapt your design to the landscape. If the ground slopes, use stilts, terracing, or step the foundation. If there are trees or water, incorporate them or design around them. Do NOT assume flat ground unless the terrain says "flat".

Format references:
${refExamples}
${terrainSurvey ? `
TERRAIN AT BUILD SITE:
${terrainSurvey.summary}
Ground elevation range: Y ${terrainSurvey.slopeAssessment.minY} to Y ${terrainSurvey.slopeAssessment.maxY} (${terrainSurvey.slopeAssessment.slope} slope)
${terrainSurvey.features.length > 0 ? 'Features: ' + terrainSurvey.features.slice(0, 5).map(f => f.description).join(', ') : 'No notable features'}

ADAPT your y:0 layer to this terrain. If slope is gentle/steep, add support columns or step the foundation.` : ''}

Design this: ${description}

Output ONLY valid JSON. No explanation, no markdown, no text before or after.`
}

// ── Build Context ──

// Pure formatting function — takes data, no body/ imports.
// Called from mind/index.js which passes getActiveBuild() and listBlueprints() results.
//
// activeBuild — result of getActiveBuild() from body/skills/build.js (or null)
// blueprintCatalog — result of listBlueprints() from body/skills/build.js
export function getBuildContextForPrompt(activeBuild, blueprintCatalog) {
  const lines = []
  if (activeBuild) {
    const pct = Math.round(100 * activeBuild.completedIndex / activeBuild.totalBlocks)
    if (activeBuild.paused) {
      lines.push(`Active build: ${activeBuild.blueprintName} — PAUSED at ${activeBuild.completedIndex}/${activeBuild.totalBlocks} blocks (${pct}%). Need: ${activeBuild.missingMaterials.join(', ')}. Use !build to continue placing available materials, or gather more materials first.`)
    } else {
      lines.push(`Active build: ${activeBuild.blueprintName} — ${activeBuild.completedIndex}/${activeBuild.totalBlocks} blocks placed (${pct}%).`)
    }
  }
  // Blueprint catalog removed — agents should use !design for creative builds only
  return lines.length > 0 ? lines.join('\n') : ''
}

// ── Time Label ──

// Rich time-of-day label with shelter guidance.
// Minecraft day cycle: 0=sunrise, 6000=noon, 12000=sunset, 18000=midnight, 24000=next sunrise
function timeLabel(timeOfDay) {
  if (timeOfDay < 1000) return 'dawn -- new day starting'
  if (timeOfDay < 6000) return 'morning'
  if (timeOfDay < 12000) return 'afternoon'
  if (timeOfDay < 13000) return 'dusk'
  if (timeOfDay < 18000) return 'night'
  if (timeOfDay < 23000) return 'late night'
  return 'pre-dawn'
}

// ── Progression Hint ──

// Dynamic gear tier detection from bot inventory — injected into system prompt Part 2.
// Pure JS, zero LLM cost. Inspects inventory for best tool tier and suggests next upgrade.
export function buildProgressionHint(bot) {
  const items = bot.inventory?.items() || []
  const names = new Set(items.map(i => i.name))
  const totalCount = items.reduce((sum, i) => sum + i.count, 0)

  // Detect best tool tier
  const hasDiamond = names.has('diamond_pickaxe') || names.has('diamond_sword') || names.has('diamond_axe')
  const hasIron = names.has('iron_pickaxe') || names.has('iron_sword') || names.has('iron_axe')
  const hasStone = names.has('stone_pickaxe') || names.has('stone_sword')
  const hasWood = names.has('wooden_pickaxe') || names.has('wooden_sword')

  // High-tier tools = focus on BUILDING, not gathering
  if (hasDiamond || hasIron) {
    if (totalCount > 64) {
      return 'You have great tools and plenty of materials. FOCUS ON BUILDING — design structures, place blocks, build the city. Don\'t waste time gathering basic resources.'
    }
    return 'You have good tools. Gather specific building materials you need (sand for glass, clay for bricks, stone for stone_bricks) then BUILD.'
  }
  if (hasStone) {
    return 'Stone tools — mine iron ore to upgrade. Smelt raw_iron → iron_ingot → iron pickaxe.'
  }
  if (hasWood) {
    return 'Wooden tools — mine stone to upgrade. 3 cobblestone + 2 sticks = stone pickaxe.'
  }
  return 'No tools — punch a tree for logs, craft planks, craft sticks, craft wooden pickaxe.'
}

// ── System Prompt ──

// System prompt for the Mind layer — identity + grounding + memory + social + locations + !command reference.
// options.soul         — SOUL file content (string) for personality identity; falls back to generic if absent
// options.memory       — output of getMemoryForPrompt() from memory.js
// options.players      — output of getPlayersForPrompt() from social.js
// options.locations    — output of getLocationsForPrompt() from locations.js
// options.partnerNames — array of all other agent names in the group (for YOUR GROUP section)
export function buildSystemPrompt(bot, options = {}) {
  const parts = []

  // Part 1: Identity — the SOUL drives personality and motivation
  if (options.soul) {
    parts.push(options.soul)
  } else {
    parts.push(`You are ${bot.username}, a Minecraft player. You observe the world and take actions using !commands.`)
  }

  // Part 2: Game context — you're playing Minecraft, build a city together
  const partnerList = options.partnerNames?.length > 0
    ? options.partnerNames.join(', ')
    : 'your partner'
  parts.push(`## The Game

You're playing Minecraft with ${partnerList}. You see the game state below and pick one !command per turn.

Your goal: build an amazing city together. Talk to each other about what to build, who does what, what materials you need. Discuss game mechanics, strategy, coordinates — whatever helps. You're a team.

Use names when you talk — say "hey Luna" or "Rust, can you check east?" so people know who you're talking to. Otherwise everyone might try to respond at once.

### How Commands Work

Each command does ONE step of work, then you think again and decide what's next. You're in control of every decision.

Gathering 5 logs looks like: !gather → got 1 → !gather → got 2 → (see partner chatting) → !chat → (respond) → !gather → got 3...

You can change your mind between any two steps. React to chat, danger, opportunities. You're never locked into a long task.

If a !command fails, try something else.

## RESPONSE FORMAT

Think briefly, then ONE !command.

Example:
Got 3 oak logs so far. Need 2 more for planks.
!gather item:oak_log

Example:
Luna's asking about the build plan. Let me respond.
!chat message:"hey I've got 15 cobblestone, thinking we put the forge near the river — what do you think?"

Example:
Time to design our first real building.
!design description:"8x6 stone and oak blacksmith workshop with chimney, anvil inside, large doorway, stone brick walls, spruce roof"`)



  // Part 3: Essential game knowledge + city building knowledge
  parts.push(`## Things you need to know

Tool tiers: WOODEN picks mine stone/coal. STONE mines iron. IRON mines diamond/gold. DIAMOND mines obsidian. Wrong tier = drops NOTHING.
Mining STONE drops COBBLESTONE. ANY wood type works for any wood recipe. Use !craft — it auto-resolves chains.

!design — describe what you want to build. Be specific and creative with materials and features.
!build — resume an active build project. !builds — list all projects.`)


  // Part 3: Memory — lessons, strategies, world knowledge from previous sessions
  if (options.memory) {
    parts.push(options.memory)
  }

  // Part 4: Known players — social context for nearby and remembered players
  if (options.players) {
    parts.push(options.players)
  }

  // Part 5: Known locations — named waypoints within 500 blocks
  if (options.locations) {
    parts.push(options.locations)
  }

  // Part 5.5: Build context — active build progress and available blueprints
  if (options.buildContext) {
    parts.push(options.buildContext)
  }

  // Part 5.6: Build history — what the bot has built in prior sessions
  if (options.buildHistory) {
    parts.push(options.buildHistory)
  }

  // Part 5.7: RAG context — dynamically retrieved knowledge relevant to current activity
  if (options.ragContext) {
    parts.push(options.ragContext)
  }

  // Part 5.75: Memory context — retrieved past experiences from SQLite event log (Phase 18 — MEM-02)
  if (options.memoryContext) {
    parts.push(options.memoryContext)
  }

  // Part 5.8: Background brain state — plan, insights, hazards from background cycle
  if (options.brainState) {
    parts.push(options.brainState)
  }

  // Part 5.9: Vision context — most recent !see result (consume-once, capped at 400 chars)
  if (options.visionContext) {
    parts.push(options.visionContext)
  }

  // Part 5.10: Minimap terrain summary — lightweight area awareness (no VLM needed)
  if (options.minimapContext) {
    parts.push(`## Area Overview\n${options.minimapContext}`)
  }

  // Part 5.11: Post-build scan result — one-time verification feedback after !build
  if (options.postBuildScan) {
    parts.push(`## Build Verification\n${options.postBuildScan}`)
  }

  // Part 5.12: Build plan context — active build plan progress, material gaps, next section (BLD-01/02/03)
  if (options.buildPlanContext) {
    parts.push(`## Build Plan\n${options.buildPlanContext}`)
  }

  // Part 5.13: Partner activity — what the other agent is currently doing (COO-04)
  if (options.partnerActivity) {
    parts.push(`## Partner Activity\n${options.partnerActivity}`)
  }

  // Part 5.14: Build ledger — shared project registry with block-level tracking
  if (options.buildLedger) {
    parts.push(options.buildLedger)
  }

  // Part 6: !command reference — grouped by speed (atomic vs pipeline)
  parts.push(`## Commands (each does ONE step, then you decide what's next)

Quick actions (2-10s):
!gather item:name — find and collect 1 nearby block
!mine item:name — find and mine 1 nearby ore
!craft item:name count:N — craft recipe (auto-chains dependencies)
!navigate x:N y:N z:N — walk to coordinates
!chat message:"text" — talk to your partner
!look target:inventory — check what you have
!look target:horizon direction:north — survey terrain ahead
!scan — scan nearby blocks
!explore direction:north — move ~30 blocks in a direction and scan
!combat — fight nearest hostile mob
!farm seed:name — till and plant 1 plot
!harvest crop:name — harvest 1 mature crop
!withdraw item:name count:N — take items FROM a nearby chest into your inventory
!deposit item:name count:N — put items from your inventory INTO a nearby chest
!give player:name item:name count:N — hand items to partner
!drop item:name count:N — drop items
!eat — eat food
!place item:name — place a block from inventory (torch, planks, etc.)
!equip item:name — equip tool/weapon
!sethome — save current location as home
!look target:chest — see what's inside a nearby chest

Building (runs until done):
!design description:"detailed text" — design + auto-build a structure
!build — resume active build project
!build id:X — help with a specific project
!builds — list all projects
!road x:N z:N — build road to coordinates
!clear width:N depth:N — flatten area for building

One !command per turn.`)

  return parts.join('\n')
}

// ── Game State Summary ──

// Compact representation of current bot state for the user message.
// Reads directly from mineflayer bot properties — no HTTP bridge needed.
export function buildStateText(bot) {
  const pos = bot.entity?.position
  const health = bot.health ?? '?'
  const food = bot.food ?? '?'

  const items = bot.inventory.items()
    .map(i => `${i.count}x ${i.name}`)
    .join(', ') || 'empty'

  // Time of day with rich label (dawn/morning/afternoon/dusk/night)
  const timeOfDay = bot.time?.timeOfDay ?? 0
  const timeLbl = timeLabel(timeOfDay)

  // Nearby entities — count players and hostile mobs within 16 blocks
  const HOSTILE_MOBS = new Set([
    'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider', 'enderman',
    'blaze', 'witch', 'pillager', 'vindicator', 'phantom', 'drowned',
    'husk', 'stray', 'slime', 'magma_cube', 'ghast', 'wither_skeleton',
  ])
  const selfPos = bot.entity?.position
  const playerNames = []
  const hostileMobs = []
  if (selfPos) {
    for (const entity of Object.values(bot.entities)) {
      if (entity === bot.entity) continue
      const dist = entity.position?.distanceTo(selfPos) ?? Infinity
      if (entity.type === 'player') {
        const name = entity.username || entity.name || 'unknown'
        playerNames.push(`${name} (${Math.round(dist)} blocks away)`)
      } else if (entity.type === 'mob' && HOSTILE_MOBS.has(entity.name) && dist <= 16) {
        hostileMobs.push(`${entity.name} ${Math.round(dist)}b`)
      }
    }
  }

  // Spatial awareness — terrain, blocks, hazards, stuck detection
  const spatial = buildSpatialAwareness(bot)

  const lines = [
    pos ? `pos: ${Math.round(pos.x)},${Math.round(pos.y)},${Math.round(pos.z)}` : 'pos: unknown',
    spatial,  // terrain, ground, hazards, nearby blocks — injected automatically
    `health: ${health}/20  food: ${food}/20`,
    `time: ${timeLbl} (${timeOfDay})`,
    `inventory: ${items}`,
  ].filter(Boolean)
  // Always show partner status — even if entity not visible (underground, far away)
  if (playerNames.length > 0) {
    lines.push(`partner: ${playerNames.join(', ')}`)
  }
  // Find partner from bot.players (server-side, always accurate) and show chat status
  const partnerName = Object.keys(bot.players || {}).find(n => n !== bot.username)
  if (partnerName) {
    if (playerNames.length === 0) {
      lines.push(`partner: ${partnerName} (online, not visible)`)
    }
    const lastChat = getPartnerLastChat(partnerName)
    if (lastChat) {
      const agoMs = Date.now() - new Date(lastChat.timestamp).getTime()
      const agoStr = agoMs < 60000 ? 'just now' : `${Math.round(agoMs / 60000)}min ago`
      lines.push(`last chat: "${lastChat.message?.slice(0, 50)}" (${agoStr})`)
    } else {
      lines.push(`last chat with ${partnerName}: never — you two haven't spoken yet!`)
    }
  }
  if (hostileMobs.length > 0) {
    lines.push(`⚠ HOSTILE MOBS: ${hostileMobs.join(', ')} — fight or flee!`)
  }
  // Show distance from home (informational, no restrictions)
  const home = getHome()
  if (home && pos) {
    const homeDist = Math.round(Math.sqrt((pos.x - home.x) ** 2 + (pos.z - home.z) ** 2))
    if (homeDist > 30) {
      lines.push(`home: ${homeDist} blocks away (${home.x},${home.y},${home.z})`)
    }
  }

  return lines.join('\n')
}

// ── User Message Builder ──

// Build the user message for each LLM call.
// trigger: 'chat' | 'skill_complete' | 'idle'
// options:
//   sender      — username string (chat trigger)
//   message     — chat text (chat trigger)
//   skillName   — name of the completed skill (skill_complete trigger)
//   skillResult — { success, reason } from the completed skill (skill_complete trigger)
//   idleMs      — milliseconds idle (idle trigger)
//   partnerChat — { sender, message, timestamp } from getPartnerLastChat() (optional)
export function buildUserMessage(bot, trigger, options = {}) {
  const parts = []

  // Trigger context — what caused this LLM call
  if (trigger === 'chat') {
    const sender = options.sender || 'unknown'
    const message = options.message || ''
    parts.push(`[${sender} says: "${message}"]`)
  } else if (trigger === 'skill_complete') {
    const skillName = options.skillName || 'skill'
    const result = options.skillResult
    if (result) {
      const status = result.success ? 'done' : `failed: ${result.reason || 'unknown'}`
      // Include extra result data so LLM sees what happened (chest contents, scan results, etc.)
      const extras = []
      if (result.items) extras.push(`contents: ${result.items}`)
      if (result.blocks) extras.push(`blocks: ${JSON.stringify(result.blocks)}`)
      if (result.tilled) extras.push(`tilled: ${result.tilled}`)
      if (result.planted) extras.push(`planted: ${result.planted}`)
      if (result.missing) extras.push(`missing: ${result.missing.join(', ')}`)
      if (result.placed !== undefined) extras.push(`placed: ${result.placed}`)
      if (result.harvested !== undefined) extras.push(`harvested: ${result.harvested}`)
      if (result.replanted !== undefined) extras.push(`replanted: ${result.replanted}`)
      if (result.discoveries) extras.push(`discoveries: ${result.discoveries.length}`)
      if (result.target) extras.push(`target: ${result.target}`)
      if (result.searched) extras.push(`searched: ${result.searched}b radius`)
      // Progress nudge — let LLM know if there's more to do
      if (result.collected !== undefined && result.requested && result.collected < result.requested) {
        extras.push(`got ${result.collected}/${result.requested} — keep going or change plan?`)
      }
      if (result.mined !== undefined && result.requested && result.mined < result.requested) {
        extras.push(`mined ${result.mined}/${result.requested} — keep going or change plan?`)
      }
      if (!result.success && result.reason === 'no_harvestable_blocks') {
        extras.push(`none found nearby — try !explore or a different resource`)
      }
      if (!result.success && (result.reason === 'nav_timeout' || result.reason?.includes('Took to long'))) {
        extras.push(`couldn't reach target — try different coords or !explore`)
      }
      const detail = extras.length > 0 ? ` | ${extras.join(' | ')}` : ''
      parts.push(`[skill complete: ${skillName} — ${status}${detail}]`)
    } else {
      parts.push(`[skill complete: ${skillName}]`)
    }
  } else if (trigger === 'idle') {
    const idleMs = options.idleMs || 0
    parts.push(`[idle for ${idleMs}ms]`)
  }

  // Design status — async blueprint worker
  if (options.designNotification) {
    parts.push(`[BLUEPRINT READY: ${options.designNotification}]`)
  } else if (options.designInProgress) {
    parts.push(`[A blueprint is being designed in the background. Do NOT use !design again — gather materials, chat, or explore while waiting.]`)
  }

  // Partner chat context — inject partner's last message if available
  if (options.partnerChat) {
    parts.push(`[${options.partnerChat.sender} said: "${options.partnerChat.message}"]`)
  }

  // Strong chat nudge — if partner is online but no chat history exists, make it obvious
  const partnerName = Object.keys(bot.players || {}).find(n => n !== bot.username)
  if (partnerName && trigger !== 'chat') {
    const partnerLastChat = getPartnerLastChat(partnerName)
    if (!partnerLastChat) {
      parts.push(`[${partnerName} is online and you haven't said a word to each other yet. Say hello! Coordinate your plan! Use !chat]`)
    } else {
      const agoMs = Date.now() - new Date(partnerLastChat.timestamp).getTime()
      if (agoMs > 120000) {  // 2+ minutes since last chat
        parts.push(`[It's been ${Math.round(agoMs / 60000)} minutes since you talked to ${partnerName}. Check in — what are they doing? Do they need anything?]`)
      }
    }
  }

  // Current game state
  parts.push(buildStateText(bot))

  return parts.join('\n')
}
