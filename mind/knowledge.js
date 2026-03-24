// knowledge.js — Minecraft knowledge corpus builder for RAG retrieval

import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import minecraftData from 'minecraft-data'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mcData = minecraftData('1.21.1')

let KNOWLEDGE_DIR = ''
let chunks = []

// ── Init ──

export function initKnowledge(config) {
  KNOWLEDGE_DIR = join(__dirname, '..', 'knowledge')
  // config accepted for future use (e.g. dataDir, agentName)
}

// ── Load ──

export function loadKnowledge() {
  chunks = [
    ...buildRecipeChunks(),
    ...buildFactChunks(),
    ...buildStrategyChunks(),
    ...buildCommandChunks(),
  ]
  console.log(`[knowledge] corpus loaded: ${chunks.length} chunks (${chunks.filter(c => c.type === 'recipe').length} recipes, ${chunks.filter(c => c.type === 'fact').length} facts, ${chunks.filter(c => c.type === 'strategy').length} strategy, ${chunks.filter(c => c.type === 'command').length} commands)`)
  return chunks
}

export function getAllChunks() {
  return chunks
}

// ── Recipe Chain Generator ──

// Hardcoded smelting table — minecraft-data has NO furnace recipe data
// Keyed by PRODUCT, value is the input (what you smelt to get the key)
const SMELT_FROM = {
  iron_ingot: 'raw_iron',
  gold_ingot: 'raw_gold',
  copper_ingot: 'raw_copper',
  glass: 'sand',
  stone: 'cobblestone',
  smooth_stone: 'stone',
  brick: 'clay_ball',
  terracotta: 'clay',
  charcoal: 'oak_log',
  nether_brick: 'netherrack',
  netherite_scrap: 'ancient_debris',
  cooked_beef: 'raw_beef',
  cooked_porkchop: 'raw_porkchop',
  cooked_chicken: 'raw_chicken',
  cooked_mutton: 'raw_mutton',
  cooked_rabbit: 'raw_rabbit',
  cooked_cod: 'raw_cod',
  cooked_salmon: 'raw_salmon',
  baked_potato: 'potato',
  dried_kelp: 'kelp',
}

// flattenRecipe — extract unique ingredient item IDs from a recipe object.
// Handles both shaped (inShape) and shapeless (ingredients) recipe formats.
function flattenRecipe(recipe) {
  const ids = []
  if (recipe.inShape) {
    for (const row of recipe.inShape) {
      for (const id of row) {
        if (id !== null && id !== undefined) ids.push(id)
      }
    }
  } else if (recipe.ingredients) {
    for (const id of recipe.ingredients) {
      if (id !== null && id !== undefined) ids.push(id)
    }
  }
  // Return unique IDs only
  return [...new Set(ids)]
}

// resolveIngredients — recursive DFS to resolve an item to its raw material chain.
// visited: Set of item names already being resolved in the current branch (cycle guard).
// Uses a COPY of visited for each branch so siblings don't block each other.
function resolveIngredients(itemId, visited) {
  const item = mcData.items[itemId]
  if (!item) return null

  const name = item.name

  // Cycle guard — prevents infinite recursion on circular recipes (iron_ingot <-> iron_nugget)
  if (visited.has(name)) return `${name} (cycle)`
  visited = new Set(visited)
  visited.add(name)

  // Smelting shortcut — show the smelting path instead of the nugget-craft path
  // This is the primary fix for iron_ingot: "smelt raw_iron" instead of "craft from iron_nuggets"
  if (SMELT_FROM[name]) {
    const input = SMELT_FROM[name]
    return `${name} (smelt ${input})`
  }

  const recipes = mcData.recipes[itemId]
  if (!recipes || recipes.length === 0) {
    return `${name} (gather/mine)`
  }

  // Pick simplest recipe: fewest unique ingredient types
  // Tiebreak priority: (1) prefer oak_* for wood items, (2) prefer cobblestone over deepslate/blackstone variants
  const PREFERRED_INGREDIENTS = ['oak_planks', 'oak_log', 'cobblestone']

  const recipe = recipes.reduce((best, candidate) => {
    const bestIds = flattenRecipe(best)
    const candIds = flattenRecipe(candidate)
    const bestNames = [...new Set(bestIds.map(id => mcData.items[id]?.name).filter(Boolean))]
    const candNames = [...new Set(candIds.map(id => mcData.items[id]?.name).filter(Boolean))]
    if (candNames.length < bestNames.length) return candidate
    if (candNames.length === bestNames.length) {
      // Tiebreak: prefer recipes that use a "preferred" base material
      const candScore = PREFERRED_INGREDIENTS.filter(p => candNames.some(n => n && n.includes(p))).length
      const bestScore = PREFERRED_INGREDIENTS.filter(p => bestNames.some(n => n && n.includes(p))).length
      if (candScore > bestScore) return candidate
    }
    return best
  })

  const ingIds = flattenRecipe(recipe)
  const ingNames = [...new Set(ingIds.map(id => mcData.items[id]?.name).filter(Boolean))]

  // Recursively resolve each ingredient with an independent copy of visited
  const subChains = ingNames.map(ingName => {
    const ingItem = mcData.itemsByName[ingName]
    if (!ingItem) return `${ingName} (unknown)`
    return resolveIngredients(ingItem.id, new Set(visited))
  }).filter(Boolean)

  return `${name} (craft from: ${ingNames.join(', ')}) -- ${subChains.join('; ')}`
}

export function buildRecipeChunks() {
  const result = []

  for (const itemIdStr of Object.keys(mcData.recipes)) {
    const itemId = parseInt(itemIdStr, 10)
    const item = mcData.items[itemId]
    if (!item) continue

    const chainText = resolveIngredients(itemId, new Set())
    if (!chainText) continue

    // Cap chain text to ~600 chars (~150 tokens) to fit embedding model window
    const text = `Recipe: ${item.displayName}\n${chainText.length > 600 ? chainText.substring(0, 600) + '...' : chainText}`

    result.push({
      id: `recipe_${item.name}`,
      text,
      type: 'recipe',
      tags: ['recipe', item.name],
      source: 'minecraft-data',
    })
  }

  return result
}

// ── Fact Chunk Generators ──

// buildBlockChunks — blocks from minecraft-data, filtered to gameplay-significant ones
function buildBlockChunks() {
  const seen = new Set()
  return mcData.blocksArray
    .filter(b => {
      if (seen.has(b.name)) return false
      seen.add(b.name)
      // Keep blocks that are: diggable, craftable (in items), or gameplay-significant
      return b.diggable || mcData.itemsByName[b.name] ||
        ['chest', 'furnace', 'crafting_table', 'anvil', 'enchanting_table',
         'brewing_stand', 'beacon', 'bed', 'door', 'fence', 'fence_gate',
         'torch', 'lantern', 'campfire', 'barrel', 'smoker', 'blast_furnace',
         'stonecutter', 'grindstone', 'loom', 'cartography_table',
         'smithing_table', 'lectern', 'composter', 'bell', 'respawn_anchor',
         'lodestone'].some(k => b.name.includes(k))
    })
    .map(b => {
      const toolNames = b.harvestTools
        ? Object.keys(b.harvestTools).map(id => mcData.items[parseInt(id)]?.name).filter(Boolean)
        : []
      const dropNames = (b.drops || []).map(id => mcData.items[id]?.name).filter(Boolean)
      let text = `Block: ${b.displayName}\nName: ${b.name}\nHardness: ${b.hardness}`
      if (toolNames.length > 0) text += `\nRequires: ${toolNames.join(' or ')}`
      if (dropNames.length > 0 && dropNames[0] !== b.name) text += `\nDrops: ${dropNames.join(', ')}`
      if (b.transparent) text += `\nTransparent: yes`
      if (b.emitLight > 0) text += `\nLight level: ${b.emitLight}`
      return {
        id: `block_${b.name}`,
        text,
        type: 'fact',
        tags: ['fact', 'block', b.name],
        source: 'minecraft-data',
      }
    })
}

// buildItemChunks — items that are NOT blocks (avoids duplication with block chunks)
function buildItemChunks() {
  const blockNames = new Set(mcData.blocksArray.map(b => b.name))
  return mcData.itemsArray
    .filter(item => !blockNames.has(item.name))
    .map(item => ({
      id: `item_${item.name}`,
      text: `Item: ${item.displayName}\nName: ${item.name}\nStack size: ${item.stackSize}`,
      type: 'fact',
      tags: ['fact', 'item', item.name],
      source: 'minecraft-data',
    }))
}

// buildFoodChunks — all food items with nutrition data
function buildFoodChunks() {
  return mcData.foodsArray.map(f => ({
    id: `food_${f.name}`,
    text: `Food: ${f.displayName}\nName: ${f.name}\nHunger restored: ${f.foodPoints}\nSaturation: ${f.saturation}\nEffective quality: ${f.effectiveQuality}`,
    type: 'fact',
    tags: ['fact', 'food', f.name],
    source: 'minecraft-data',
  }))
}

// buildMobChunks — mobs and hostile/passive entities
function buildMobChunks() {
  return mcData.entitiesArray
    .filter(e => e.type === 'mob' || e.type === 'hostile' || e.type === 'passive'
      || e.category === 'Hostile mobs' || e.category === 'Passive mobs'
      || e.category === 'Water creature' || e.category === 'Ambient')
    .map(e => ({
      id: `mob_${e.name}`,
      text: `Mob: ${e.displayName}\nName: ${e.name}\nCategory: ${e.category || 'unknown'}\nSize: ${e.width}x${e.height}`,
      type: 'fact',
      tags: ['fact', 'mob', e.name, (e.category || '').toLowerCase().includes('hostile') ? 'hostile' : 'passive'],
      source: 'minecraft-data',
    }))
}

// buildBiomeChunks — all biomes with climate/dimension data
function buildBiomeChunks() {
  return mcData.biomesArray.map(b => ({
    id: `biome_${b.name}`,
    text: `Biome: ${b.displayName}\nName: ${b.name}\nTemperature: ${b.temperature}\nPrecipitation: ${b.has_precipitation ? 'yes' : 'no'}\nDimension: ${b.dimension}`,
    type: 'fact',
    tags: ['fact', 'biome', b.name, b.dimension],
    source: 'minecraft-data',
  }))
}

// buildFactChunks — combines all 5 fact generators (RAG-02)
export function buildFactChunks() {
  return [
    ...buildBlockChunks(),
    ...buildItemChunks(),
    ...buildFoodChunks(),
    ...buildMobChunks(),
    ...buildBiomeChunks(),
  ]
}

// ── Command Chunk Generator ──

// COMMAND_SCHEMAS — static array matching prompt.js Part 6 arg syntax exactly (RAG-04)
const COMMAND_SCHEMAS = [
  {
    name: 'gather',
    usage: '!gather item:name count:N',
    purpose: 'Collect blocks from the world surface (trees, dirt, sand, flowers)',
    args: 'item — block name to gather (e.g. oak_log, dirt, sand). count — number to collect (default 1)',
    examples: ['!gather item:oak_log count:5', '!gather item:dirt count:16'],
    failures: 'Item not found nearby. No pathable route to target block. Wrong item name (use minecraft names like oak_log not "wood").',
  },
  {
    name: 'mine',
    usage: '!mine item:name count:N',
    purpose: 'Mine underground ores and stone requiring a pickaxe',
    args: 'item — ore/stone name (e.g. iron_ore, coal_ore, stone, deepslate). count — number to mine (default 1)',
    examples: ['!mine item:iron_ore count:3', '!mine item:coal_ore count:8'],
    failures: 'Wrong pickaxe tier — need stone pickaxe for iron, iron pickaxe for diamond. Ore not found at current depth. Pickaxe breaks mid-mining.',
  },
  {
    name: 'craft',
    usage: '!craft item:name count:N',
    purpose: 'Craft an item using materials in inventory at a crafting table',
    args: 'item — item name to craft (e.g. wooden_pickaxe, crafting_table, stick). count — number to craft (default 1)',
    examples: ['!craft item:crafting_table', '!craft item:wooden_pickaxe count:1'],
    failures: 'Missing ingredients in inventory. No crafting table nearby. Invalid item name.',
  },
  {
    name: 'smelt',
    usage: '!smelt item:name fuel:name count:N',
    purpose: 'Smelt items in a furnace (ores, raw food, sand → glass)',
    args: 'item — item to smelt (e.g. raw_iron, raw_beef). fuel — fuel item (e.g. coal, oak_log). count — number to smelt (default 1)',
    examples: ['!smelt item:raw_iron fuel:coal count:5', '!smelt item:raw_beef fuel:coal count:3'],
    failures: 'No furnace nearby. Fuel missing from inventory. Input item missing. Furnace already busy.',
  },
  {
    name: 'navigate',
    usage: '!navigate x:N y:N z:N',
    purpose: 'Walk to specific world coordinates using pathfinding',
    args: 'x — X coordinate. y — Y coordinate. z — Z coordinate. All must be integers.',
    examples: ['!navigate x:100 y:64 z:200', '!navigate x:-50 y:70 z:30'],
    failures: 'Path blocked by water/lava/cliffs. Coordinates underground or in air. Destination unreachable within timeout.',
  },
  {
    name: 'chat',
    usage: '!chat message:"text"',
    purpose: 'Say something in Minecraft chat. Use @name to direct at someone, @all for broadcasts',
    args: 'message — text to say, quoted string. Include @name or @all prefix',
    examples: ['!chat message:"@luna I\'m going to get some wood"', '!chat message:"@all found a village!"'],
    failures: 'Message too long. Special characters may need escaping.',
  },
  {
    name: 'drop',
    usage: '!drop item:name count:N',
    purpose: 'Drop an item on the ground (for sharing with others)',
    args: 'item — item name to drop. count — number to drop (default 1)',
    examples: ['!drop item:cobblestone count:32', '!drop item:stick count:4'],
    failures: 'Item not in inventory. Count exceeds inventory amount.',
  },
  {
    name: 'idle',
    usage: '!idle',
    purpose: 'Wait and observe; do nothing this turn',
    args: 'No arguments',
    examples: ['!idle'],
    failures: 'None — always succeeds.',
  },
  {
    name: 'combat',
    usage: '!combat',
    purpose: 'Attack the nearest hostile mob',
    args: 'No arguments',
    examples: ['!combat'],
    failures: 'No hostile mob nearby. Mob too far away. No weapon equipped.',
  },
  {
    name: 'deposit',
    usage: '!deposit item:name count:N',
    purpose: 'Put items from inventory into nearest chest or barrel',
    args: 'item — item name to deposit. count — number to deposit (default 1)',
    examples: ['!deposit item:cobblestone count:32', '!deposit item:iron_ingot count:10'],
    failures: 'No chest nearby. Item not in inventory. Chest full.',
  },
  {
    name: 'withdraw',
    usage: '!withdraw item:name count:N',
    purpose: 'Take items from nearest chest or barrel into inventory',
    args: 'item — item name to withdraw. count — number to withdraw (default 1)',
    examples: ['!withdraw item:iron_ingot count:5', '!withdraw item:coal count:16'],
    failures: 'No chest nearby. Item not in chest. Inventory full.',
  },
  {
    name: 'build',
    usage: '!build blueprint:name x:N y:N z:N',
    purpose: 'Build a structure from a saved blueprint at given coordinates',
    args: 'blueprint — blueprint name (see listBlueprints). x, y, z — starting corner coordinates',
    examples: ['!build blueprint:small_cabin x:120 y:64 z:200'],
    failures: 'Blueprint not found. Missing materials. Coordinates occupied or invalid.',
  },
  {
    name: 'design',
    usage: '!design description:"text"',
    purpose: 'Design a new structure from description — generates a blueprint and builds it',
    args: 'description — natural language description of what to build',
    examples: ['!design description:"a small wooden dock extending over the water"'],
    failures: 'LLM fails to parse description. Build location blocked. Materials missing.',
  },
  {
    name: 'scan',
    usage: '!scan x1:N y1:N z1:N x2:N y2:N z2:N',
    purpose: 'Scan a region and report what blocks exist (defaults to area around you)',
    args: 'x1,y1,z1 — first corner. x2,y2,z2 — opposite corner. Max volume 32768 blocks.',
    examples: ['!scan x1:100 y1:60 z1:200 x2:116 y2:68 z2:216'],
    failures: 'Region too large (>32768 blocks). Unloaded chunks return "unloaded" entries.',
  },
  {
    name: 'farm',
    usage: '!farm seed:name count:N',
    purpose: 'Till dirt and plant seeds (wheat, beetroot, carrot, potato)',
    args: 'seed — seed type (e.g. wheat_seeds, beetroot_seeds, carrot, potato). count — number of plots to plant (default 1)',
    examples: ['!farm seed:wheat_seeds count:8', '!farm seed:carrot count:4'],
    failures: 'No hoe in inventory. No dirt/farmland nearby. Seeds not in inventory.',
  },
  {
    name: 'breed',
    usage: '!breed animal:type',
    purpose: 'Feed 2 nearby animals to breed them',
    args: 'animal — animal type (e.g. cow, sheep, pig, chicken)',
    examples: ['!breed animal:cow', '!breed animal:sheep'],
    failures: 'No 2 animals of that type nearby. Missing food item for breeding. Animals not in love mode.',
  },
  {
    name: 'mount',
    usage: '!mount',
    purpose: 'Get into a nearby boat',
    args: 'No arguments',
    examples: ['!mount'],
    failures: 'No boat nearby. Already in a vehicle.',
  },
  {
    name: 'dismount',
    usage: '!dismount',
    purpose: 'Get out of current vehicle (boat)',
    args: 'No arguments',
    examples: ['!dismount'],
    failures: 'Not currently in a vehicle.',
  },
  {
    name: 'look',
    usage: '!look target:inventory',
    purpose: 'See what\'s in your inventory (or target:chest for nearest chest)',
    args: 'target — "inventory" to check own inventory, "chest" to look in nearest chest',
    examples: ['!look target:inventory', '!look target:chest'],
    failures: 'No chest nearby when target:chest. Chest out of range.',
  },
  {
    name: 'give',
    usage: '!give player:name item:name count:N',
    purpose: 'Toss item toward a nearby player',
    args: 'player — player name. item — item name to give. count — number to give (default 1)',
    examples: ['!give player:Jeffrey item:iron_ingot count:5'],
    failures: 'Player not nearby. Item not in inventory. Count exceeds available.',
  },
  {
    name: 'material',
    usage: '!material old:block new:block',
    purpose: 'Change a material in the active build (e.g., oak_planks to stone)',
    args: 'old — block name to replace. new — replacement block name',
    examples: ['!material old:oak_planks new:stone', '!material old:dirt new:grass_block'],
    failures: 'No active build in progress. Old material not used in blueprint. New material not in inventory.',
  },
  {
    name: 'sethome',
    usage: '!sethome',
    purpose: 'Mark current position as home base (handled by mind loop, not registry)',
    args: 'No arguments',
    examples: ['!sethome'],
    failures: 'None — always sets current position.',
  },
]

// buildCommandChunks — one chunk per command with arg syntax, purpose, examples, failures (RAG-04)
export function buildCommandChunks() {
  return COMMAND_SCHEMAS.map(cmd => ({
    id: `cmd_${cmd.name}`,
    text: `Command: !${cmd.name}\nUsage: ${cmd.usage}\nPurpose: ${cmd.purpose}\nArgs: ${cmd.args}\nExamples: ${cmd.examples.join(', ')}\nCommon failures: ${cmd.failures}`,
    type: 'command',
    tags: ['command', cmd.name],
    source: 'auto-generated',
  }))
}

// ── Strategy Chunk Generator ──

// buildStrategyChunks — parse knowledge/*.md files into one chunk per H2 section (RAG-03)
export function buildStrategyChunks() {
  if (!KNOWLEDGE_DIR || !existsSync(KNOWLEDGE_DIR)) return []

  const files = readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.md'))
  const allChunks = []

  for (const file of files) {
    const filePath = join(KNOWLEDGE_DIR, file)
    const content = readFileSync(filePath, 'utf-8')
    const fileType = file.replace('.md', '')  // e.g. 'mining', 'combat'

    // Split on H2 headings, keeping the heading with its section
    const sections = content.split(/(?=^## )/m).filter(s => s.trim())

    for (const section of sections) {
      // Skip H1 title sections (lines starting with # but not ##)
      if (section.startsWith('# ') && !section.startsWith('## ')) continue

      const lines = section.trim().split('\n')
      const heading = lines[0].replace(/^#+\s*/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
      const text = section.trim()

      // Skip sections with no actual content (just a heading)
      if (lines.length <= 1) continue

      allChunks.push({
        id: `strategy_${fileType}_${heading}`,
        text,
        type: 'strategy',
        tags: ['strategy', fileType, heading],
        source: 'hand-authored',
      })
    }
  }

  return allChunks
}
