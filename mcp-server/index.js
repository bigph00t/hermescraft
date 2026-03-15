#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BRIDGE_URL = process.env.HERMESCRAFT_BRIDGE_URL || 'http://localhost:3001';

// --- HTTP helpers ---

async function getJSON(path) {
  const res = await fetch(`${BRIDGE_URL}${path}`);
  if (!res.ok) throw new Error(`Bridge error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function postAction(body) {
  const res = await fetch(`${BRIDGE_URL}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Bridge error ${res.status}: ${await res.text()}`);
  return res.json();
}

// --- State formatting ---

function formatState(s) {
  const lines = [];

  // Position — HermesBridge returns s.position = {x, y, z}
  const pos = s.position || {};
  lines.push(`Position: ${fmt(pos.x)}, ${fmt(pos.y)}, ${fmt(pos.z)} (${s.dimension || 'overworld'})`);

  // Vitals
  lines.push(`Health: ${s.health ?? '?'}/${s.maxHealth ?? 20}  Food: ${s.food ?? '?'}/20  Armor: ${s.armor ?? 0}`);

  // XP
  const xp = s.experience;
  if (xp && typeof xp === 'object') {
    lines.push(`XP: level ${xp.level}, total ${xp.total}`);
  }

  // Holding
  lines.push(`Holding: ${s.currentItem || 'empty'} (slot ${s.selectedSlot ?? '?'})`);

  // Time
  const time = s.time;
  const isDay = s.isDay;
  lines.push(`Time: ${time ?? '?'} (${isDay ? 'Day' : 'Night'})  Biome: ${(s.biome || '').replace('minecraft:', '')}`);

  // Status flags
  const flags = [];
  if (s.onFire) flags.push('ON FIRE');
  if (s.inWater) flags.push('in water');
  if (s.isSneaking) flags.push('sneaking');
  if (s.isSprinting) flags.push('sprinting');
  if (s.isPathing) flags.push('pathing');
  if (flags.length > 0) lines.push(`Status: ${flags.join(', ')}`);

  // Effects
  if (s.effects && s.effects.length > 0) {
    lines.push(`Effects: ${s.effects.map(e => e.name || e.type || e).join(', ')}`);
  }

  // Inventory — HermesBridge returns s.inventory = [{slot, item, count, durability?}]
  const inv = s.inventory || [];
  if (inv.length > 0) {
    const items = inv.map(i => {
      const name = (i.item || i.name || '?').replace('minecraft:', '');
      return i.count > 1 ? `${name}x${i.count}` : name;
    });
    lines.push(`Inventory: ${items.join(', ')}`);
  } else {
    lines.push('Inventory: empty');
  }

  // Armor items
  if (s.armor_items && s.armor_items.length > 0) {
    const armor = s.armor_items.map(i => (i.item || '').replace('minecraft:', '')).filter(Boolean);
    if (armor.length > 0) lines.push(`Armor: ${armor.join(', ')}`);
  }

  // Nearby blocks — [{block, x, y, z, distance}]
  const blocks = s.nearbyBlocks || [];
  if (blocks.length > 0) {
    // Deduplicate by block type, keep closest of each
    const seen = new Set();
    const deduped = [];
    const sorted = [...blocks].sort((a, b) => (a.distance || 99) - (b.distance || 99));
    for (const b of sorted) {
      const name = (b.block || b.name || '?').replace('minecraft:', '');
      if (!seen.has(name)) {
        seen.add(name);
        deduped.push(`${name}(${b.x},${b.y},${b.z} d:${fmt(b.distance)})`);
        if (deduped.length >= 15) break;
      }
    }
    lines.push(`Nearby blocks: ${deduped.join(', ')}`);
  }

  // Nearby entities — [{type, distance, position, health, maxHealth}]
  const entities = s.nearbyEntities || [];
  if (entities.length > 0) {
    const es = entities.map(e => {
      const name = (e.type || e.name || '?').replace('minecraft:', '');
      const hp = e.health != null ? ` hp:${e.health}` : '';
      const dist = e.distance != null ? ` (${fmt(e.distance)}m)` : '';
      return `${name}${hp}${dist}`;
    });
    lines.push(`Nearby entities: ${es.join(', ')}`);
  }

  // Crosshair target
  if (s.lookingAt) {
    lines.push(`Looking at: ${s.lookingAt} (${fmt(s.lookingAtDist)}m)`);
  }

  // Open screen (crafting table, furnace, etc.)
  if (s.openScreen) {
    const scr = s.openScreen;
    let screenInfo = scr.type || 'unknown';
    if (scr.outputItem) screenInfo += ` → output: ${scr.outputItem}x${scr.outputCount || 1}`;
    if (scr.craftingGrid && scr.craftingGrid.length > 0) {
      screenInfo += ` grid: ${scr.craftingGrid.map(g => g.item).join(',')}`;
    }
    lines.push(`Open screen: ${screenInfo}`);
  }

  return lines.join('\n');
}

function fmt(v) {
  return typeof v === 'number' ? Math.round(v * 10) / 10 : v ?? '?';
}

// --- Tool result helpers ---

function ok(text) {
  return { content: [{ type: 'text', text: typeof text === 'string' ? text : JSON.stringify(text, null, 2) }] };
}

async function actionTool(body) {
  try {
    const result = await postAction(body);
    return ok(result.message || result.status || JSON.stringify(result));
  } catch (e) {
    return ok(`Error: ${e.message}`);
  }
}

// --- Server setup ---

const server = new McpServer({
  name: 'hermescraft-mcp',
  version: '1.0.0',
});

// ============ OBSERVATION ============

server.tool('mc_observe', 'Get condensed game state summary (position, health, inventory, nearby blocks/entities, etc.)', {}, async () => {
  try {
    const state = await getJSON('/state');
    return ok(formatState(state));
  } catch (e) {
    return ok(`Error: ${e.message}`);
  }
});

server.tool('mc_observe_full', 'Get raw full JSON game state from the bridge', {}, async () => {
  try {
    const state = await getJSON('/state');
    return ok(JSON.stringify(state, null, 2));
  } catch (e) {
    return ok(`Error: ${e.message}`);
  }
});

server.tool('mc_recipes', 'Look up crafting recipes for an item', { item: z.string().describe('Item name to look up recipes for') }, async ({ item }) => {
  try {
    const recipes = await getJSON(`/recipes?item=${encodeURIComponent(item)}`);
    return ok(JSON.stringify(recipes, null, 2));
  } catch (e) {
    return ok(`Error: ${e.message}`);
  }
});

// ============ MOVEMENT ============

server.tool('mc_navigate', 'Navigate to coordinates using Baritone pathfinding', {
  x: z.number().describe('X coordinate'),
  y: z.number().describe('Y coordinate'),
  z: z.number().describe('Z coordinate'),
}, async ({ x, y, z }) => actionTool({ type: 'navigate', x, y, z }));

server.tool('mc_walk', 'Walk forward for N ticks (max 200)', {
  ticks: z.number().min(1).max(200).describe('Number of ticks to walk forward'),
}, async ({ ticks }) => actionTool({ type: 'walk', ticks }));

server.tool('mc_jump', 'Jump once', {}, async () => actionTool({ type: 'jump' }));

server.tool('mc_look', 'Look in a direction (set yaw and pitch)', {
  yaw: z.number().describe('Yaw angle (0=south, 90=west, 180=north, 270=east)'),
  pitch: z.number().describe('Pitch angle (-90=up, 0=forward, 90=down)'),
}, async ({ yaw, pitch }) => actionTool({ type: 'look', yaw, pitch }));

server.tool('mc_look_at_block', 'Walk to and face a specific block', {
  x: z.number().describe('Block X coordinate'),
  y: z.number().describe('Block Y coordinate'),
  z: z.number().describe('Block Z coordinate'),
}, async ({ x, y, z }) => actionTool({ type: 'look_at_block', x, y, z }));

server.tool('mc_sneak', 'Toggle sneaking', {
  enabled: z.boolean().describe('Whether to enable or disable sneaking'),
}, async ({ enabled }) => actionTool({ type: 'sneak', enabled }));

server.tool('mc_sprint', 'Toggle sprinting', {
  enabled: z.boolean().describe('Whether to enable or disable sprinting'),
}, async ({ enabled }) => actionTool({ type: 'sprint', enabled }));

server.tool('mc_stop', 'Cancel all current pathfinding and mining operations', {}, async () => actionTool({ type: 'stop' }));

// ============ MINING ============

server.tool('mc_mine', 'Auto-find and mine a block type using Baritone (searches ~10s)', {
  blockName: z.string().describe('Block name to mine (e.g. oak_log, iron_ore, cobblestone)'),
}, async ({ blockName }) => actionTool({ type: 'mine', blockName }));

server.tool('mc_break_block', 'Mine/break the block at crosshair', {}, async () => actionTool({ type: 'break_block' }));

server.tool('mc_pickup_items', 'Walk to and collect nearby item drops', {}, async () => actionTool({ type: 'pickup_items' }));

// ============ CRAFTING ============

server.tool('mc_craft', 'Craft an item (auto-opens nearby crafting table if needed)', {
  item: z.string().describe('Item to craft (e.g. crafting_table, wooden_pickaxe, sticks)'),
}, async ({ item }) => actionTool({ type: 'craft', item }));

server.tool('mc_smelt', 'Smelt an item in a nearby furnace', {
  item: z.string().describe('Item to smelt (e.g. iron_ore, raw_iron, sand)'),
}, async ({ item }) => actionTool({ type: 'smelt', item }));

// ============ COMBAT ============

server.tool('mc_attack', 'Attack the nearest entity or a specific target', {
  target: z.string().optional().describe('Optional target entity name (e.g. zombie, skeleton). If omitted, attacks nearest.'),
}, async ({ target }) => {
  const body = { type: 'attack' };
  if (target) body.target = target;
  return actionTool(body);
});

server.tool('mc_eat', 'Eat the best available food item', {}, async () => actionTool({ type: 'eat' }));

// ============ INVENTORY ============

server.tool('mc_equip', 'Select/equip an item in the hotbar', {
  item: z.string().describe('Item name to equip (e.g. wooden_pickaxe, torch, diamond_sword)'),
}, async ({ item }) => actionTool({ type: 'equip', item }));

server.tool('mc_drop', 'Drop the currently held item', {
  count: z.number().optional().describe('Number of items to drop. Omit to drop entire stack.'),
}, async ({ count }) => {
  const body = { type: 'drop' };
  if (count != null) body.count = count;
  return actionTool(body);
});

server.tool('mc_swap_hands', 'Swap items between main hand and off hand', {}, async () => actionTool({ type: 'swap_hands' }));

// ============ INTERACTION ============

server.tool('mc_place', 'Place a block or item', {
  item: z.string().describe('Item/block to place'),
  x: z.number().optional().describe('Optional X coordinate to place at'),
  y: z.number().optional().describe('Optional Y coordinate to place at'),
  z: z.number().optional().describe('Optional Z coordinate to place at'),
}, async ({ item, x, y, z }) => {
  const body = { type: 'place', item };
  if (x != null) { body.x = x; body.y = y; body.z = z; }
  return actionTool(body);
});

server.tool('mc_interact_block', 'Right-click/interact with a block (open chest, door, lever, etc.)', {
  x: z.number().describe('Block X coordinate'),
  y: z.number().describe('Block Y coordinate'),
  z: z.number().describe('Block Z coordinate'),
}, async ({ x, y, z }) => actionTool({ type: 'interact_block', x, y, z }));

server.tool('mc_use_item', 'Right-click/use the currently held item', {}, async () => actionTool({ type: 'use_item' }));

server.tool('mc_close_screen', 'Close any open screen/GUI (inventory, chest, crafting table, etc.)', {}, async () => actionTool({ type: 'close_screen' }));

// ============ UTILITY ============

server.tool('mc_chat', 'Send a chat message or command (prefix commands with /)', {
  message: z.string().describe('Chat message or command to send'),
}, async ({ message }) => actionTool({ type: 'chat', message }));

server.tool('mc_wait', 'Do nothing for a moment (useful to wait for game events)', {}, async () => actionTool({ type: 'wait' }));

// --- Start server ---

const transport = new StdioServerTransport();
await server.connect(transport);
