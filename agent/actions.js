// actions.js — Translate LLM decisions to Fabric mod API calls

import { normalizeItemName } from './normalizer.js'
import { trackChest } from './chests.js'
import { recordPlacement } from './placement-tracker.js'

const MOD_URL = process.env.MOD_URL || 'http://localhost:3001';

const VALID_ACTIONS = new Set([
  'navigate', 'look_at_block', 'interact_block', 'pickup_items',
  'craft', 'smelt', 'attack', 'eat', 'place', 'equip', 'chat',
  'stop', 'break_block', 'close_screen',
  'smart_place', 'chest_deposit', 'chest_withdraw',
  'build', 'cancel_build', 'farm', 'harvest', 'breed', 'fish', 'interact_entity',
  // Keep these for backward compat but they're not in the tool list:
  'look', 'use_item', 'drop', 'swap_hands', 'jump', 'sneak', 'sprint', 'walk',
  'recipes', 'wiki', 'notepad', 'read_chat',
  'save_context', 'delete_context',
  'plan_task', 'update_task',
  'scan_blocks', 'go_home', 'set_home', 'share_location',
  'check_skills', 'use_ability', 'query_shops', 'create_shop',
  // 'wait' deliberately removed — force real actions
]);

// Info actions return data to the LLM — they don't execute in the game world
// scan_blocks and check_skills are INFO_ACTIONS: results arrive via chat and the LLM must see them before deciding next action
export const INFO_ACTIONS = new Set(['recipes', 'wiki', 'notepad', 'read_chat', 'save_context', 'delete_context', 'plan_task', 'update_task', 'scan_blocks', 'check_skills']);

// Schema validators per action type
const ACTION_SCHEMAS = {
  recipes:      (a) => typeof a.item === 'string',
  wiki:         (a) => typeof a.query === 'string',
  notepad:      (a) => a.action === 'read' || (a.action === 'write' && typeof a.content === 'string'),
  navigate:     (a) => a.x !== undefined && a.y !== undefined && a.z !== undefined,
  look_at_block: (a) => a.x !== undefined && a.y !== undefined && a.z !== undefined,
  interact_block: (a) => a.x !== undefined && a.y !== undefined && a.z !== undefined,
  pickup_items: () => true,
  craft:        (a) => typeof a.item === 'string',
  smelt:        (a) => typeof a.item === 'string',
  attack:       () => true,
  eat:          () => true,
  place:        (a) => typeof a.item === 'string',
  smart_place:  (a) => typeof a.item === 'string',
  chest_deposit: (a) => typeof a.item === 'string' && a.x !== undefined && a.y !== undefined && a.z !== undefined,
  chest_withdraw: (a) => typeof a.item === 'string' && a.x !== undefined && a.y !== undefined && a.z !== undefined,
  equip:        (a) => typeof a.item === 'string',
  look:         (a) => a.yaw !== undefined || a.pitch !== undefined,
  chat:         (a) => typeof a.message === 'string',
  use_item:     () => true,
  drop:         () => true,
  swap_hands:   () => true,
  stop:         () => true,
  jump:         () => true,
  sneak:        () => true,
  sprint:       () => true,
  wait:         () => true,
  close_screen: () => true,
  build:        (a) => typeof a.blueprint === 'string' && a.x !== undefined && a.y !== undefined && a.z !== undefined,
  cancel_build: () => true,
  farm: (a) => a.x !== undefined && a.y !== undefined && a.z !== undefined,
  harvest: (a) => a.x !== undefined && a.y !== undefined && a.z !== undefined,
  breed: (a) => typeof a.animal === 'string',
  fish: () => true,
  interact_entity: (a) => typeof a.target === 'string',
  break_block:  () => true,
  walk:         () => true,
  read_chat:    () => true,
  save_context: (a) => typeof a.filename === 'string' && typeof a.content === 'string',
  delete_context: (a) => typeof a.filename === 'string',
  plan_task:    (a) => typeof a.goal === 'string' && Array.isArray(a.subtasks) && a.subtasks.length > 0,
  update_task:  (a) => typeof a.index === 'number' && typeof a.status === 'string',
  scan_blocks:    (a) => typeof (a.block_type || a.blockType) === 'string',
  go_home:        () => true,
  set_home:       () => true,
  share_location: (a) => typeof a.name === 'string',
  check_skills:   () => true,
  use_ability:    (a) => typeof a.ability_name === 'string',
  query_shops:    (a) => typeof a.item === 'string',
  create_shop:    (a) => typeof a.price === 'number' && typeof a.item === 'string',
};

// ── Ability Cooldown Tracking (D-14) ──
// Records last activation timestamp per ability. Conservative 60s default.
// AuraSkills actual cooldowns vary by ability and level, but 60s is safe.
const _abilityCooldowns = new Map()
const ABILITY_COOLDOWN_MS = 60000

export function isAbilityOnCooldown(abilityName) {
  const lastUsed = _abilityCooldowns.get(abilityName)
  if (!lastUsed) return false
  const remaining = ABILITY_COOLDOWN_MS - (Date.now() - lastUsed)
  return remaining > 0 ? remaining : false
}

const actionQueue = [];

export function getAvailableActions() {
  return [...VALID_ACTIONS];
}

export function validateAction(action) {
  if (!action || typeof action !== 'object') return { valid: false, error: 'action must be an object' };

  const type = action.type || action.action;
  if (!type) return { valid: false, error: 'action must have a "type" field' };
  if (!VALID_ACTIONS.has(type)) return { valid: false, error: `unknown action type: ${type}` };

  const validator = ACTION_SCHEMAS[type];
  if (validator && !validator(action)) {
    return { valid: false, error: `invalid params for action "${type}"` };
  }

  return { valid: true };
}

/**
 * Pre-execution validation — catches obviously invalid actions before they hit the mod API.
 * Unlike validateAction (schema check), this checks game state feasibility.
 * Returns { valid: true } or { valid: false, reason: string }.
 */
export function validatePreExecution(action, state) {
  if (!action || !state) return { valid: true }; // Defensive — don't block if state unavailable

  // Normalize item names before game state checks
  if (action.item) action.item = normalizeItemName(action.item)
  if (action.blockName) action.blockName = normalizeItemName(action.blockName)

  const type = action.type || action.action;
  const inventory = state.inventory || [];

  // Helper: check if item (or partial match) exists in inventory
  const hasItem = (name) => inventory.some(i => {
    const itemId = (i.item || i.name || '').replace('minecraft:', '');
    return itemId === name || itemId.includes(name);
  });

  // Helper: count of a specific item
  const itemCount = (name) => {
    const slot = inventory.find(i => {
      const itemId = (i.item || i.name || '').replace('minecraft:', '');
      return itemId === name || itemId.includes(name);
    });
    return slot ? (slot.count || 0) : 0;
  };

  switch (type) {
    case 'craft': {
      // Can't craft with empty inventory (need at least SOMETHING)
      if (inventory.length === 0) {
        return { valid: false, reason: `Cannot craft "${action.item}" — inventory is empty. Gather materials first.` };
      }
      // Specific known recipe checks — catch the most common mistakes
      const item = action.item || '';
      if (item.includes('planks') && !hasItem('log') && !hasItem('wood')) {
        return { valid: false, reason: `Cannot craft "${item}" — no logs in inventory. Mine oak_log or similar first.` };
      }
      if (item === 'stick' && !hasItem('planks')) {
        return { valid: false, reason: `Cannot craft sticks — no planks in inventory. Craft planks from logs first.` };
      }
      if (item === 'crafting_table' && !hasItem('planks')) {
        return { valid: false, reason: `Cannot craft crafting_table — need 4 planks. Craft planks from logs first.` };
      }
      if (item === 'furnace' && itemCount('cobblestone') < 8) {
        return { valid: false, reason: `Cannot craft furnace — need 8 cobblestone (have ${itemCount('cobblestone')}). Mine more stone.` };
      }
      if ((item === 'wooden_pickaxe' || item === 'wooden_axe' || item === 'wooden_sword' || item === 'wooden_shovel' || item === 'wooden_hoe') && (!hasItem('planks') || !hasItem('stick'))) {
        return { valid: false, reason: `Cannot craft "${item}" — need planks AND sticks. Check inventory.` };
      }
      if ((item === 'stone_pickaxe' || item === 'stone_axe' || item === 'stone_sword' || item === 'stone_shovel' || item === 'stone_hoe') && (!hasItem('cobblestone') || !hasItem('stick'))) {
        return { valid: false, reason: `Cannot craft "${item}" — need cobblestone AND sticks. Check inventory.` };
      }
      if ((item === 'iron_pickaxe' || item === 'iron_axe' || item === 'iron_sword' || item === 'iron_shovel') && (!hasItem('iron_ingot') || !hasItem('stick'))) {
        return { valid: false, reason: `Cannot craft "${item}" — need iron_ingot AND sticks. Smelt raw_iron first.` };
      }
      break;
    }

    case 'equip': {
      if (!hasItem(action.item)) {
        return { valid: false, reason: `Cannot equip "${action.item}" — not in inventory. Available: ${inventory.map(i => (i.item || i.name || '').replace('minecraft:', '')).slice(0, 8).join(', ')}` };
      }
      break;
    }

    case 'eat': {
      const FOOD_ITEMS = new Set([
        'bread', 'apple', 'cooked_beef', 'cooked_porkchop', 'cooked_chicken',
        'cooked_mutton', 'cooked_rabbit', 'cooked_salmon', 'cooked_cod',
        'baked_potato', 'beetroot', 'carrot', 'melon_slice', 'sweet_berries',
        'golden_apple', 'golden_carrot', 'mushroom_stew', 'rabbit_stew',
        'suspicious_stew', 'pumpkin_pie', 'cookie', 'dried_kelp',
        'beef', 'porkchop', 'chicken', 'mutton', 'rabbit', 'salmon', 'cod',
        'potato', 'rotten_flesh', 'spider_eye',
      ]);
      const hasFood = inventory.some(i => {
        const itemId = (i.item || i.name || '').replace('minecraft:', '');
        return FOOD_ITEMS.has(itemId);
      });
      if (!hasFood) {
        return { valid: false, reason: `Cannot eat — no food in inventory. Kill animals or find crops first.` };
      }
      break;
    }

    case 'navigate': {
      const MAX_COORD = 30000;
      if (Math.abs(action.x) > MAX_COORD || Math.abs(action.z) > MAX_COORD) {
        return { valid: false, reason: `Navigate target (${action.x}, ${action.y}, ${action.z}) is too far (max ${MAX_COORD}). Stay within the island.` };
      }
      if (action.y !== undefined && (action.y < -64 || action.y > 320)) {
        return { valid: false, reason: `Navigate Y=${action.y} is outside valid range (-64 to 320).` };
      }
      break;
    }

    case 'smelt': {
      if (!hasItem(action.item)) {
        return { valid: false, reason: `Cannot smelt "${action.item}" — not in inventory. Mine the ore first.` };
      }
      // Check for fuel (any wood/coal/charcoal)
      const hasFuel = hasItem('coal') || hasItem('charcoal') || hasItem('log') || hasItem('planks') || hasItem('stick') || hasItem('wood');
      if (!hasFuel) {
        return { valid: false, reason: `Cannot smelt — no fuel in inventory. Need coal, charcoal, or wood items.` };
      }
      break;
    }

    case 'place': {
      if (!hasItem(action.item)) {
        return { valid: false, reason: `Cannot place "${action.item}" — not in inventory.` };
      }
      break;
    }

    case 'smart_place': {
      if (!hasItem(action.item)) {
        return { valid: false, reason: `Cannot place "${action.item}" — not in inventory.` };
      }
      break;
    }

    case 'breed': {
      const breedFood = {
        'cow': 'wheat', 'sheep': 'wheat', 'chicken': 'seeds',
        'pig': 'carrot', 'rabbit': 'carrot',
      };
      const animal = (action.animal || '').toLowerCase();
      const food = breedFood[animal];
      if (!food) {
        return { valid: false, reason: `Unknown animal "${animal}". Try: cow, sheep, chicken, pig, rabbit.` };
      }
      if (!hasItem(food)) {
        return { valid: false, reason: `Cannot breed ${animal} — need ${food} in inventory.` };
      }
      break;
    }

    case 'fish': {
      if (!hasItem('fishing_rod')) {
        return { valid: false, reason: 'Cannot fish — no fishing_rod in inventory. Craft one: 3 sticks + 2 string.' };
      }
      break;
    }
  }

  return { valid: true };
}

// ── Chat Message Splitting ──

function splitMessage(msg, maxLen) {
  const chunks = []
  let remaining = msg
  while (remaining.length > maxLen) {
    // Try to split at sentence boundary first
    let splitIdx = -1
    for (const delim of ['. ', '! ', '? ', ', ', ' — ', ' - ', ' ']) {
      const idx = remaining.lastIndexOf(delim, maxLen)
      if (idx > maxLen * 0.4) {
        splitIdx = idx + delim.length
        break
      }
    }
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf(' ', maxLen)
    if (splitIdx === -1 || splitIdx < maxLen * 0.4) splitIdx = maxLen
    chunks.push(remaining.slice(0, splitIdx).trim())
    remaining = remaining.slice(splitIdx).trim()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

async function sendSingleAction(payload) {
  const res = await fetch(`${MOD_URL}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return { success: false, error: `HTTP ${res.status}: ${text}` }
  }
  return await res.json().catch(() => ({ success: true }))
}

export async function executeAction(action) {
  const type = action.type || action.action;

  // Normalize item names before any dispatch
  if (action.item) action.item = normalizeItemName(action.item)
  if (action.blockName) action.blockName = normalizeItemName(action.blockName)

  // Normalize: always send "type" field
  const payload = { ...action, type };
  delete payload.action;

  // Auto-split chat messages that exceed MC's limit into natural chunks
  if (type === 'chat' && payload.message && payload.message.length > 200) {
    const chunks = splitMessage(payload.message, 200)
    let lastResult = { success: true }
    for (const chunk of chunks) {
      lastResult = await sendSingleAction({ type: 'chat', message: chunk, reason: payload.reason })
      if (chunks.length > 1) await new Promise(r => setTimeout(r, 600))
    }
    return lastResult
  }

  // ── Plugin Command Handlers ──

  if (type === 'scan_blocks') {
    const blockType = action.block_type || action.blockType || 'oak_log'
    const radius = Math.min(Math.max(parseInt(action.radius) || 50, 1), 100)
    return sendSingleAction({ type: 'chat', message: `/scan ${blockType} ${radius}` })
  }

  if (type === 'go_home') {
    const homeName = action.name || 'home'
    return sendSingleAction({ type: 'chat', message: `/home ${homeName}` })
  }

  if (type === 'set_home') {
    const homeName = action.name || 'home'
    return sendSingleAction({ type: 'chat', message: `/sethome ${homeName}` })
  }

  if (type === 'share_location') {
    const locName = (action.name || 'here').replace(/\s+/g, '-')
    return sendSingleAction({ type: 'chat', message: `/share-location ${locName}` })
  }

  if (type === 'check_skills') {
    return sendSingleAction({ type: 'chat', message: '/myskills' })
  }

  if (type === 'use_ability') {
    const ability = (action.ability_name || '').toLowerCase()
    const toolMap = {
      'treecapitator': 'axe',
      'speed_mine': 'pickaxe',
      'terraform': 'shovel',
    }
    const tool = toolMap[ability]
    if (!tool) return { success: false, error: `Unknown ability: ${ability}. Available: treecapitator, speed_mine, terraform` }

    // D-14: Check cooldown before activating
    const remaining = isAbilityOnCooldown(ability)
    if (remaining) {
      const secs = Math.ceil(remaining / 1000)
      return { success: false, error: `${ability} is on cooldown — ${secs}s remaining. Try again later.` }
    }

    // Record activation timestamp (D-14)
    _abilityCooldowns.set(ability, Date.now())

    return { success: true, message: `Equip your ${tool} and right-click, then break a block — ${ability} activates automatically when ready` }
  }

  if (type === 'query_shops') {
    const item = action.item || ''
    return sendSingleAction({ type: 'chat', message: `/qs find ${item}` })
  }

  if (type === 'create_shop') {
    const price = action.price || 1
    // QuickShop requires: 1) chest placed, 2) item equipped, 3) interact_block chest
    // Then /qs create <price>. The planner must queue the full 3-step sequence:
    //   equip <item> -> interact_block <chest_x> <chest_y> <chest_z> -> create_shop <price> <item>
    // StopSpam 5s cooldown applies — planner should not chain multiple shop commands rapidly.
    return sendSingleAction({ type: 'chat', message: `/qs create ${price}` })
  }

  const result = await sendSingleAction(payload)

  // Auto-update chest memory from chest action responses
  if ((type === 'chest_deposit' || type === 'chest_withdraw') && result.success && result.chest_contents !== undefined) {
    try {
      const contents = result.chest_contents.split(', ').map(entry => {
        const match = entry.match(/^(.+?) x(\d+)$/)
        if (match) return { item: match[1], count: parseInt(match[2]) }
        return null
      }).filter(Boolean)
      trackChest(result.chest_x, result.chest_y, result.chest_z, contents)
    } catch (e) {
      // Non-critical — don't fail the action if chest tracking fails
    }
  }

  // Auto-track placed blocks from smart_place responses
  if (type === 'smart_place' && result.success && result.placed) {
    try {
      recordPlacement(result.placed)
    } catch (e) {
      // Non-critical — don't fail the action if tracking fails
    }
  }

  return result
}

export function queueActions(actions) {
  actionQueue.push(...actions);
}

export async function processQueue() {
  if (actionQueue.length === 0) return null;
  const next = actionQueue.shift();
  return executeAction(next);
}

export function clearQueue() {
  actionQueue.length = 0;
}

export function queueLength() {
  return actionQueue.length;
}
