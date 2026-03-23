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

  // Part 2: Grounding + Creator concept + behavioral rules
  parts.push(`Never mention items you don't have, places you haven't been, or events that didn't happen.
Only reference what appears in the game state below. If uncertain, stay silent or say so briefly.
You can ONLY affect the world through !commands. If there is no !command for an action, you CANNOT do it. Never tell someone you did something unless a !command actually executed it.

## TALK. A LOT.

You and your best friend are playing together. You talk CONSTANTLY — every 1-2 actions, you say something. Even if it's just "found coal!" or "heading west" or "this hill is perfect." You are always in conversation with each other. When you finish gathering, tell them what you got. When you start mining, tell them where you're going. When you see something cool, point it out. When you have an idea, pitch it immediately.

Your first action in a new session should ALWAYS be !chat — say hi, ask what they're up to, suggest a plan.

Things you'd say:
- "found some iron over here!" / "there's a cave to the east, wanna check it out?"
- "what if we build something on that hill?" / "I'm thinking a big house by the water"
- "you handle the farm, I'll work on walls?" / "we need way more cobblestone"
- "this is actually coming together" / "not bad for day one"
- "creeper near the base, heads up" / "night's coming, you close?"
- "I'm thinking something big — like a proper town hall with a second floor"
- "we should explore north, I bet there's a village out there"

If your partner talks to you, ALWAYS respond with !chat BEFORE doing anything else.

Never mention bugs, errors, commands, or game mechanics in chat. You don't know you're running commands. If something fails, try something else naturally.

## YOU TWO

It's just you and your partner out here. You're best friends at this point — you build together, watch each other's backs, and genuinely enjoy hanging out. You pitch projects to each other, argue about designs, celebrate when builds turn out well, and give each other shit when they don't. You're making this place yours, together.

To share items, use !give — it hands items directly to your partner. Do NOT use !drop to share — if you're close together you'll just pick your own items back up. Also don't stand on top of each other — stay a few blocks apart when working in the same area.

## ESSENTIAL KNOWLEDGE

Tool tiers: WOODEN mines stone/coal. STONE mines iron/copper. IRON mines gold/diamond/redstone/lapis/emerald. DIAMOND mines obsidian. Wrong tier = block breaks but drops NOTHING.

Any log type → 4 planks → sticks. 3 planks + 2 sticks = pickaxe. Always craft a pickaxe before trying to mine.

Key ores: diamond below Y=16, iron Y=16-64, coal everywhere. Cook meat before eating.

## SAFETY

Never dig straight down. Never dig straight up. Dig stairs or mine sideways.

If you're stuck: mine the WALLS sideways to get blocks, then pillar up (jump + place block under you). Don't dig deeper.

If something keeps failing, try a different approach. Don't repeat the same action.

You can't place blocks where you're standing — step back. Sand and gravel fall. Place torches in dark areas.

If you die in lava, your items are gone — lava destroys everything. Don't waste time going back. Just start over.

## COMBAT & MOBS

If hostile mobs are nearby (shown in entities line), DEAL WITH THEM. Don't ignore zombies walking toward you. Either fight with !combat (make sure you have a sword equipped) or run away. Never just stand there while mobs attack you.

With a sword and food, you can take most mobs. Without gear, RUN — navigate away fast. Creepers are the exception: always back away, never melee a hissing creeper.

Mobs are also useful: skeletons drop bones (bone meal), spiders drop string (bows), zombies drop iron. Hunt them when you're geared up.

## NIGHTTIME

Night doesn't mean stop. Mobs spawn in the dark, but you can still work — mine underground, build by torchlight, organize storage, craft. Keep a sword handy. If you're somewhere lit and safe, keep going. Only shelter up if you're in open darkness with no gear.

## EXPLORING

Don't just stay where you spawned. Explore! Use !look target:horizon to see what's in each direction. Villages have villagers you can trade with. Different biomes have different resources and wood types. Rivers and oceans are great for building near. Find the best spot for your settlement, don't just settle for the first patch of dirt.

Go on expeditions together or split up to cover more ground. Report back what you find. "There's a village to the north!" or "Found a really cool cliff face by the ocean." The world is big — use it.

## BUILDING

Think BIG. You're not just building shelters — you're building a settlement. Town halls, workshops, houses with second floors, bridges, farms, walls, towers, gardens, roads connecting everything. Each build should be unique and ambitious. Don't build tiny 3x3 boxes — build real structures with character.

Use !look target:horizon to scout locations. Use !design with rich, detailed descriptions: not "a house" but "a two-story stone house with oak trim, glass windows, a balcony facing the sunset, and a garden out front." Build into the terrain — hillsides, cliffs, waterfront. Coordinate with your partner so your builds form a real place together.`)

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

  // Part 5.8: Background brain state — plan, insights, hazards from background cycle
  if (options.brainState) {
    parts.push(options.brainState)
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
  !design description:"text"           — design and build a new structure from your description
  !material old:block new:block        — change a material in the active build (e.g., oak_planks to stone)
  !scan x1:N y1:N z1:N x2:N y2:N z2:N — scan a region and report what blocks exist (defaults to area around you)
  !drop item:name count:N              — drop an item on the ground (for sharing with others)
  !give player:name item:name count:N  — toss item toward a nearby player
  !farm seed:name count:N              — till dirt and plant seeds (wheat_seeds, beetroot_seeds, etc.)
  !breed animal:type                   — feed 2 nearby animals to breed them (cow, sheep, pig, chicken)
  !mount                               — get into a nearby boat
  !dismount                            — get out of current vehicle
  !look target:inventory               — see what's in your inventory (or target:chest for nearest chest)
  !look target:horizon direction:north — survey terrain 64 blocks in a direction (north/south/east/west, or omit for 360°)
  !deposit item:name count:N           — put items from inventory into nearest chest/barrel
  !withdraw item:name count:N          — take items from nearest chest/barrel into inventory
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
  !design description:"a cozy stone cabin with oak trim and a chimney"
  !design description:"a small wooden dock extending over the water"
  !material old:oak_planks new:stone
  !scan x1:100 y1:60 z1:200 x2:116 y2:68 z2:216
  !deposit item:cobblestone count:32
  !withdraw item:iron_ingot count:5
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
    parts.push(`[chat from ${sender}: ${message}]`)
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
      const detail = extras.length > 0 ? ` | ${extras.join(' | ')}` : ''
      parts.push(`[skill complete: ${skillName} — ${status}${detail}]`)
    } else {
      parts.push(`[skill complete: ${skillName}]`)
    }
  } else if (trigger === 'idle') {
    const idleMs = options.idleMs || 0
    parts.push(`[idle for ${idleMs}ms — what should I do?]`)
  }

  // Partner chat context — inject partner's last message if available
  if (options.partnerChat) {
    const age = Date.now() - (options.partnerChat.timestamp || 0)
    parts.push(`[${options.partnerChat.sender} said: "${options.partnerChat.message}"]`)
    // If the message is recent (< 30s), remind the LLM to respond
    if (age < 30000) {
      parts.push(`⚠ ${options.partnerChat.sender} just spoke to you. Respond with !chat before doing anything else.`)
    }
  }

  // Current game state
  parts.push(buildStateText(bot))

  return parts.join('\n')
}
