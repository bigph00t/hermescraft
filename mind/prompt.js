// prompt.js — System prompt builder, game state summary, and blueprint design prompt for v2 Mind layer

import { buildSpatialAwareness } from './spatial.js'

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
export function buildDesignPrompt(description, referenceBlueprints) {
  // Reference examples section — each blueprint inline in the prompt
  const refExamples = (referenceBlueprints || []).map(ref => {
    return `=== ${ref.name} ===\n${ref.json}`
  }).join('\n\n')

  return `You are a Minecraft blueprint designer. Given a structure description, output ONLY valid JSON matching this exact schema:

{
  "name": "snake_case_name",
  "description": "human-readable description",
  "size": { "x": width, "y": height, "z": depth },
  "palette": {
    "CHAR": { "preferred": ["minecraft_block_name", "alt1", "alt2"], "tag": "semantic_label" }
  },
  "layers": [
    { "y": 0, "comment": "layer description", "grid": ["ROW...", ...] },
    { "y": 1, "comment": "layer description", "grid": ["ROW...", ...] }
  ]
}

Rules:
- Layers MUST be in ascending y order (y:0 = ground floor, then y:1, y:2, ...)
- '.' in grid means air/empty space
- Every non-'.' character in grid MUST be a key in palette
- Every grid row must have exactly size.x characters
- Every layer must have exactly size.z rows
- palette preferred[] must contain valid Minecraft 1.21.1 block names
- Keep structures modest: max 10x10 footprint, max 8 blocks tall
- Floor before walls before roof — build bottom-up
- Provide 2-3 material alternatives in each preferred[] list

Here are reference examples:

${refExamples}

Now design: ${description}

Output ONLY the JSON. No explanation, no markdown fencing, no text before or after.`
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
      lines.push(`Active build: ${activeBuild.blueprintName} — PAUSED at ${activeBuild.completedIndex}/${activeBuild.totalBlocks} blocks (${pct}%). Need: ${activeBuild.missingMaterials.join(', ')}. Gather the missing materials, then use !build to resume (it will automatically continue where you left off — do NOT start a new build at different coordinates).`)
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

  // Check tiers from best to worst
  if (names.has('netherite_pickaxe') || names.has('netherite_sword')) {
    return 'Gear: NETHERITE — you have endgame gear. Focus on building, enchanting, and exploring.'
  }
  if (names.has('diamond_pickaxe') || names.has('diamond_sword')) {
    return 'Gear: DIAMOND — pursue enchanting (need enchanting table + 15 bookshelves + lapis). Consider nether expedition for netherite.'
  }
  if (names.has('iron_pickaxe') || names.has('iron_sword')) {
    return 'Gear: IRON — mine below Y=16 for diamonds (need 3 for pickaxe, 2 for sword). Craft iron armor if you have 24+ iron ingots.'
  }
  if (names.has('stone_pickaxe') || names.has('stone_sword')) {
    return 'Gear: STONE — mine at Y=16-64 for iron ore. Smelt raw_iron with !smelt. Craft iron pickaxe + iron sword.'
  }
  if (names.has('wooden_pickaxe') || names.has('wooden_sword')) {
    return 'Gear: WOOD — mine cobblestone immediately. Craft stone pickaxe (3 cobblestone + 2 sticks).'
  }
  return 'Gear: NONE — craft a wooden pickaxe immediately (3 planks + 2 sticks). Punch a tree first for logs.'
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

  // Part 2: Grounding — this is your body, this is your world
  const partnerList = options.partnerNames?.length > 0
    ? options.partnerNames.join(', ')
    : 'others'
  parts.push(`## How this works

This is your body. You live in this world. The game state below is what you see right now. You act by choosing one !command per turn.

You're here with: ${partnerList}. Talk to them with !chat. Use @name to talk to someone specific, @all to address everyone. If someone's nearby, say hi. Chat while you work — it's natural.

Only mention what's in your game state. If a !command fails, try something else — don't talk about errors or game mechanics.

## RESPONSE FORMAT (strict)

One short thought, then exactly ONE !command on its own line. Nothing after the command.

GOOD example:
I need wood to make tools.
!gather item:oak_log count:5

GOOD example:
I should say hi to Luna.
!chat message:"@luna Hey, want to help me build a shelter?"

BAD — no command, or command buried in text, or multiple commands.
BAD — !chat without @name or @all prefix in the message.

ALWAYS use key:value format for arguments. ALWAYS start chat messages with @name or @all.`)

  // Part 3: Essential game knowledge — only things they can't figure out from playing
  parts.push(`## Things you need to know

Tool tiers matter: WOODEN picks mine stone/coal. STONE mines iron. IRON mines diamond/gold/redstone. DIAMOND mines obsidian. Wrong tier = the block breaks but you get NOTHING.

Logs → planks → sticks. You need a pickaxe before you can mine anything useful.

Hostile mobs will kill you if you ignore them. Fight with !combat if you have a weapon, run if you don't. Creepers explode — back away from those.

Never dig straight down. Cook meat before eating. Lava destroys your items permanently.`)


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

  // Part 6: !command reference
  parts.push(`## Commands

!gather item:name count:N — collect blocks (trees, dirt, sand)
!mine item:name count:N — mine ores (iron_ore, coal, diamond_ore)
!craft item:name count:N — craft from inventory
!smelt item:name fuel:name count:N — smelt in furnace
!navigate x:N y:N z:N — walk somewhere
!chat message:"@name text" — say something (MUST start with @name or @all)
!design description:"text" — build a small structure (<100 blocks)
!plan description:"text" — plan a large structure (100+ blocks)
!build — continue building an active plan
!material old:block new:block — swap material in active build
!scan — scan blocks around you
!give player:name item:name count:N — hand items to someone
!drop item:name count:N — drop items on ground
!farm seed:name count:N — till and plant
!harvest crop:name count:N — harvest and replant
!breed animal:type — breed nearby animals
!hunt target:mobtype — seek and kill hostile mobs
!combat — fight nearest hostile mob
!explore direction:north distance:N — explore, find villages/temples
!look target:inventory — check inventory
!look target:horizon direction:north — survey terrain
!look target:chest — check nearest chest
!see focus:"text" — screenshot + describe what you see
!deposit item:name count:N — store in chest
!withdraw item:name count:N — take from chest
!sethome — mark home base
!mount — get in boat
!dismount — leave vehicle
!idle — wait and observe

Your response: one thought + one !command with key:value args. Nothing else.`)

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
      if (dist > 16) continue
      if (entity.type === 'player') {
        playerNames.push(entity.username || entity.name || 'unknown')
      } else if (entity.type === 'mob' && HOSTILE_MOBS.has(entity.name)) {
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
  if (playerNames.length > 0) {
    lines.push(`nearby: ${playerNames.join(', ')}`)
  }
  if (hostileMobs.length > 0) {
    lines.push(`⚠ HOSTILE MOBS: ${hostileMobs.join(', ')} — fight or flee!`)
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
    parts.push(`[${sender} is talking to you: "${message}"] — Reply with !chat. Someone spoke to you directly — respond before doing anything else.`)
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
      const detail = extras.length > 0 ? ` | ${extras.join(' | ')}` : ''
      parts.push(`[skill complete: ${skillName} — ${status}${detail}]`)
    } else {
      parts.push(`[skill complete: ${skillName}]`)
    }
  } else if (trigger === 'idle') {
    const idleMs = options.idleMs || 0
    parts.push(`[idle for ${idleMs}ms]`)
  }

  // Partner chat context — inject partner's last message if available (no forcing)
  if (options.partnerChat) {
    parts.push(`[${options.partnerChat.sender} said: "${options.partnerChat.message}"]`)
  }

  // Current game state
  parts.push(buildStateText(bot))

  return parts.join('\n')
}
