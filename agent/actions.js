// actions.js — Translate LLM decisions to Fabric mod API calls

const MOD_URL = process.env.MOD_URL || 'http://localhost:3001';

const VALID_ACTIONS = new Set([
  'navigate', 'mine', 'look_at_block', 'craft', 'smelt', 'attack', 'eat', 'place',
  'equip', 'look', 'chat', 'use_item', 'drop', 'swap_hands',
  'stop', 'jump', 'sneak', 'sprint', 'wait', 'close_screen',
  'break_block', 'walk', 'recipes', 'wiki', 'notepad',
]);

// Info actions return data to the LLM — they don't execute in the game world
export const INFO_ACTIONS = new Set(['recipes', 'wiki', 'notepad']);

// Schema validators per action type
const ACTION_SCHEMAS = {
  recipes:      (a) => typeof a.item === 'string',
  wiki:         (a) => typeof a.query === 'string',
  notepad:      (a) => a.action === 'read' || (a.action === 'write' && typeof a.content === 'string'),
  navigate:     (a) => a.x !== undefined && a.y !== undefined && a.z !== undefined,
  mine:         (a) => typeof a.blockName === 'string',
  look_at_block: (a) => a.x !== undefined && a.y !== undefined && a.z !== undefined,
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
