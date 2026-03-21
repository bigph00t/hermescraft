// actions.js — Translate LLM decisions to Fabric mod API calls

const MOD_URL = process.env.MOD_URL || 'http://localhost:3001';

const VALID_ACTIONS = new Set([
  'navigate', 'mine', 'look_at_block', 'interact_block', 'pickup_items',
  'craft', 'smelt', 'attack', 'eat', 'place', 'equip', 'chat',
  'stop', 'break_block', 'close_screen',
  // Keep these for backward compat but they're not in the tool list:
  'look', 'use_item', 'drop', 'swap_hands', 'jump', 'sneak', 'sprint', 'walk',
  'recipes', 'wiki', 'notepad', 'read_chat',
  'save_context', 'delete_context',
  'plan_task', 'update_task',
  // 'wait' deliberately removed — force real actions
]);

// Info actions return data to the LLM — they don't execute in the game world
export const INFO_ACTIONS = new Set(['recipes', 'wiki', 'notepad', 'read_chat', 'save_context', 'delete_context', 'plan_task', 'update_task']);

// Schema validators per action type
const ACTION_SCHEMAS = {
  recipes:      (a) => typeof a.item === 'string',
  wiki:         (a) => typeof a.query === 'string',
  notepad:      (a) => a.action === 'read' || (a.action === 'write' && typeof a.content === 'string'),
  navigate:     (a) => a.x !== undefined && a.y !== undefined && a.z !== undefined,
  mine:         (a) => typeof a.blockName === 'string',
  look_at_block: (a) => a.x !== undefined && a.y !== undefined && a.z !== undefined,
  interact_block: (a) => a.x !== undefined && a.y !== undefined && a.z !== undefined,
  pickup_items: () => true,
  craft:        (a) => typeof a.item === 'string',
  smelt:        (a) => typeof a.item === 'string',
  attack:       () => true,
  eat:          () => true,
  place:        (a) => typeof a.item === 'string',
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
  break_block:  () => true,
  walk:         () => true,
  read_chat:    () => true,
  save_context: (a) => typeof a.filename === 'string' && typeof a.content === 'string',
  delete_context: (a) => typeof a.filename === 'string',
  plan_task:    (a) => typeof a.goal === 'string' && Array.isArray(a.subtasks) && a.subtasks.length > 0,
  update_task:  (a) => typeof a.index === 'number' && typeof a.status === 'string',
};

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
  }

  return { valid: true };
}

export async function executeAction(action) {
  const type = action.type || action.action;

  // Normalize: always send "type" field
  const payload = { ...action, type };
  delete payload.action;

  const res = await fetch(`${MOD_URL}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { success: false, error: `HTTP ${res.status}: ${text}` };
  }

  const result = await res.json().catch(() => ({ success: true }));
  return result;
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
