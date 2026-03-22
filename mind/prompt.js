// prompt.js — System prompt builder and game state summary formatter for v2 Mind layer

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
      lines.push(`Active build: ${activeBuild.blueprintName} — PAUSED at ${activeBuild.completedIndex}/${activeBuild.totalBlocks} blocks (${pct}%). Need: ${activeBuild.missingMaterials.join(', ')}. Gather materials then !build again to resume.`)
    } else {
      lines.push(`Active build: ${activeBuild.blueprintName} — ${activeBuild.completedIndex}/${activeBuild.totalBlocks} blocks placed (${pct}%).`)
    }
  }
  if (blueprintCatalog && blueprintCatalog.length > 0) {
    lines.push('Available blueprints:')
    for (const bp of blueprintCatalog) {
      lines.push(`  ${bp.name} — ${bp.description} (${bp.size.x}x${bp.size.z}, ${bp.size.y} tall)`)
    }
    lines.push('To build: !build blueprint:name x:N y:N z:N')
  }
  return lines.length > 0 ? lines.join('\n') : ''
}

// ── Time Label ──

// Rich time-of-day label with shelter guidance.
// Minecraft day cycle: 0=sunrise, 6000=noon, 12000=sunset, 18000=midnight, 24000=next sunrise
function timeLabel(timeOfDay) {
  if (timeOfDay < 1000) return 'dawn -- new day starting'
  if (timeOfDay < 6000) return 'morning'
  if (timeOfDay < 12000) return 'afternoon'
  if (timeOfDay < 13000) return 'dusk -- seek shelter soon'
  if (timeOfDay < 18000) return 'night -- stay in shelter'
  if (timeOfDay < 23000) return 'late night -- stay in shelter'
  return 'pre-dawn'
}

// ── System Prompt ──

// System prompt for the Mind layer — identity + grounding + memory + social + locations + !command reference.
// options.soul     — SOUL file content (string) for personality identity; falls back to generic if absent
// options.memory   — output of getMemoryForPrompt() from memory.js
// options.players  — output of getPlayersForPrompt() from social.js
// options.locations — output of getLocationsForPrompt() from locations.js
export function buildSystemPrompt(bot, options = {}) {
  const parts = []

  // Part 1: Identity section — use provided soul or default persona
  if (options.soul) {
    parts.push(options.soul)
  } else {
    parts.push(`You are ${bot.username}, a Minecraft player. You observe the world and take actions using !commands.`)
  }

  // Part 2: Anti-hallucination constraint — ground the bot in what it can actually see
  parts.push(`Never mention items you don't have, places you haven't been, or events that didn't happen.
Only reference what appears in the game state below. If uncertain, stay silent or say so briefly.
Keep chat brief and natural -- you only speak when you have something real to say.`)

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

  // Part 6: !command reference — all available commands with argument syntax
  parts.push(`
When you decide to act, respond with a SINGLE line in this exact format:

  !command arg:value

Available commands:
  !gather item:name count:N            — collect blocks from the world (trees, dirt, sand)
  !mine item:name count:N              — mine ores requiring a pickaxe (iron_ore, coal, etc.)
  !craft item:name count:N             — craft an item using inventory materials
  !smelt item:name fuel:name count:N   — smelt items in a furnace
  !navigate x:N y:N z:N               — walk to coordinates
  !chat message:"text"                 — say something in chat
  !build blueprint:name x:N y:N z:N   — build a structure from a blueprint at coordinates
  !sethome                             -- mark current position as home base
  !combat                              -- attack nearest hostile mob
  !idle                                — wait and observe; do nothing this turn`)

  // Part 7: Few-shot examples (Pitfall 5 mitigation: MiniMax M2.7 needs concrete examples)
  parts.push(`
Examples:
  !gather item:oak_log count:5
  !mine item:iron_ore count:3
  !craft item:crafting_table
  !craft item:wooden_pickaxe count:1
  !smelt item:raw_iron fuel:coal count:5
  !navigate x:100 y:64 z:200
  !chat message:"I'm going to get some wood"
  !build blueprint:small_cabin x:120 y:64 z:200
  !sethome
  !idle`)

  // Part 8: Format instruction — explicit single-command constraint
  parts.push(`
Your response must contain exactly one !command line. Write your reasoning, then end with the !command on its own line. Nothing else after the !command.`)

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
  let nearbyPlayers = 0
  let nearbyHostile = 0
  const playerNames = []
  if (selfPos) {
    for (const entity of Object.values(bot.entities)) {
      if (entity === bot.entity) continue
      const dist = entity.position?.distanceTo(selfPos) ?? Infinity
      if (dist > 16) continue
      if (entity.type === 'player') {
        nearbyPlayers++
        playerNames.push(entity.username || entity.name || 'unknown')
      } else if (entity.type === 'mob' && HOSTILE_MOBS.has(entity.name)) nearbyHostile++
    }
  }

  const lines = [
    pos ? `pos: ${Math.round(pos.x)},${Math.round(pos.y)},${Math.round(pos.z)}` : 'pos: unknown',
    `health: ${health}/20  food: ${food}/20`,
    `time: ${timeLbl} (${timeOfDay})`,
    `inventory: ${items}`,
  ]
  if (nearbyPlayers > 0 || nearbyHostile > 0) {
    const playersStr = playerNames.length > 0 ? playerNames.join(', ') : nearbyPlayers
    lines.push(`nearby: ${playersStr} (players), ${nearbyHostile} hostile mob(s)`)
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
    parts.push(`[chat from ${sender}: ${message}]`)
  } else if (trigger === 'skill_complete') {
    const skillName = options.skillName || 'skill'
    const result = options.skillResult
    if (result) {
      const status = result.success ? 'done' : `failed: ${result.reason || 'unknown'}`
      parts.push(`[skill complete: ${skillName} — ${status}]`)
    } else {
      parts.push(`[skill complete: ${skillName}]`)
    }
  } else if (trigger === 'idle') {
    const idleMs = options.idleMs || 0
    parts.push(`[idle for ${idleMs}ms — what should I do?]`)
  }

  // Partner chat context — inject partner's last message if available
  if (options.partnerChat) {
    parts.push(`[${options.partnerChat.sender} said: "${options.partnerChat.message}"]`)
  }

  // Current game state
  parts.push(buildStateText(bot))

  return parts.join('\n')
}
