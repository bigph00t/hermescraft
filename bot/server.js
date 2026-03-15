#!/usr/bin/env node
/**
 * HermesCraft Bot Server
 * 
 * A standalone HTTP server that controls a Mineflayer Minecraft bot.
 * Start this, then use the `mc` CLI or any HTTP client to control the bot.
 *
 * Usage:
 *   node server.js                              # defaults
 *   MC_HOST=localhost MC_PORT=25565 node server.js
 *   node server.js --port 3001 --mc-host localhost --mc-port 35901
 *
 * Environment:
 *   MC_HOST       Minecraft server host (default: localhost)
 *   MC_PORT       Minecraft server port (default: 25565)
 *   MC_USERNAME   Bot username (default: HermesBot)
 *   MC_AUTH       Auth type: offline|microsoft (default: offline)
 *   API_PORT      HTTP API port (default: 3001)
 */

import http from 'http';
import { URL } from 'url';
import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pathfinderPkg;
// pvp plugin disabled — its deprecated physicTick event breaks pathfinder
// import pvpPkg from 'mineflayer-pvp';
// const pvpPlugin = pvpPkg.plugin;
import armorManager from 'mineflayer-armor-manager';
import { loader as autoEatLoader } from 'mineflayer-auto-eat';
import collectBlockPkg from 'mineflayer-collectblock';
const collectBlock = collectBlockPkg.plugin;
import minecraftData from 'minecraft-data';
import { Vec3 } from 'vec3';

// ═══════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════

const config = {
  mc: {
    host: process.env.MC_HOST || 'localhost',
    port: parseInt(process.env.MC_PORT || '25565'),
    username: process.env.MC_USERNAME || 'HermesBot',
    auth: process.env.MC_AUTH || 'offline',
  },
  api: {
    port: parseInt(process.env.API_PORT || '3001'),
  },
};

// Parse CLI args
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  const next = process.argv[i + 1];
  if (arg === '--port' && next) { config.api.port = parseInt(next); i++; }
  if (arg === '--mc-host' && next) { config.mc.host = next; i++; }
  if (arg === '--mc-port' && next) { config.mc.port = parseInt(next); i++; }
  if (arg === '--username' && next) { config.mc.username = next; i++; }
  if (arg === '--auth' && next) { config.mc.auth = next; i++; }
}

// ═══════════════════════════════════════════════════════════════════
// Bot Manager
// ═══════════════════════════════════════════════════════════════════

let bot = null;
let mcData = null;
let botReady = false;
let chatLog = [];
let deathLog = [];
let commandQueue = []; // complex commands for Hermes to process
let currentTask = null; // background task state
let lastHealth = 20;
const MAX_LOG = 100;
const MAX_QUEUE = 20;

// ═══════════════════════════════════════════════════════════════════
// Chat Handling — ALL decisions made by the AI, not the bot
// ═══════════════════════════════════════════════════════════════════

const HERMES_NAMES = ['hermes', 'hermesbot', 'bot'];

function isAddressedToBot(message) {
  const lower = message.toLowerCase().trim();
  return HERMES_NAMES.some(name => lower.startsWith(name));
}

function stripBotName(message) {
  const lower = message.toLowerCase().trim();
  for (const name of HERMES_NAMES) {
    if (lower.startsWith(name)) {
      let rest = message.trim().slice(name.length).trim();
      rest = rest.replace(/^[,!.:\s]+/, '').trim();
      return rest;
    }
  }
  return message.trim();
}

// No reactive commands — the AI handles EVERYTHING.
// Bot just logs chat and queues messages addressed to it.
async function handleChat(username, message) {
  if (!isAddressedToBot(message)) return;

  const command = stripBotName(message);
  if (!command) return;

  log(`[Command] <${username}> ${command}`);

  // Queue for the AI to handle
  commandQueue.push({
    time: Date.now(),
    from: username,
    command: command,
    originalMessage: message,
    status: 'pending',
  });
  if (commandQueue.length > MAX_QUEUE) commandQueue.shift();
  log(`[Queued] ${username}: ${command}`);
}

function log(msg) {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] ${msg}`);
}

async function createBot() {
  if (bot) {
    try { bot.quit(); } catch {}
    bot = null;
    botReady = false;
    await sleep(1000);
  }

  return new Promise((resolve, reject) => {
    log(`Connecting to ${config.mc.host}:${config.mc.port} as ${config.mc.username}...`);
    
    bot = mineflayer.createBot({
      host: config.mc.host,
      port: config.mc.port,
      username: config.mc.username,
      auth: config.mc.auth,
    });

    const timeout = setTimeout(() => {
      reject(new Error(`Connection timeout — couldn't reach ${config.mc.host}:${config.mc.port}`));
    }, 30000);

    bot.once('spawn', () => {
      clearTimeout(timeout);
      mcData = minecraftData(bot.version);

      // Load plugins
      bot.loadPlugin(pathfinder);
      // bot.loadPlugin(pvpPlugin); // disabled — breaks pathfinder
      bot.loadPlugin(armorManager);
      bot.loadPlugin(autoEatLoader);
      bot.loadPlugin(collectBlock);

      // Configure pathfinder
      const moves = new Movements(bot);
      moves.allowSprinting = true;
      moves.canDig = true;
      moves.allowParkour = true;
      bot.pathfinder.setMovements(moves);

      // Configure auto-eat
      bot.autoEat.options = {
        priority: 'foodPoints',
        startAt: 14,
        bannedFood: [],
      };

      // ── Reactive Events ──────────────────────────────

      // Chat listener — reactive responses + logging
      bot.on('chat', (username, message) => {
        if (username === bot.username) return;
        chatLog.push({ time: Date.now(), from: username, message });
        if (chatLog.length > MAX_LOG) chatLog.shift();
        log(`[Chat] <${username}> ${message}`);
        // Handle commands addressed to the bot
        handleChat(username, message).catch(e => log(`Chat handler error: ${e.message}`));
      });

      bot.on('whisper', (username, message) => {
        if (username === bot.username) return;
        chatLog.push({ time: Date.now(), from: username, message, whisper: true });
        if (chatLog.length > MAX_LOG) chatLog.shift();
        log(`[Whisper] <${username}> ${message}`);
        // Whispers are always addressed to us
        handleChat(username, `hermes ${message}`).catch(e => log(`Whisper handler error: ${e.message}`));
      });

      // Health tracking
      bot.on('health', () => {
        if (bot.health < lastHealth) {
          const damage = lastHealth - bot.health;
          log(`Took ${damage.toFixed(1)} damage (HP: ${bot.health.toFixed(1)})`);
        }
        lastHealth = bot.health;
      });

      // Death tracking
      bot.on('death', () => {
        const entry = { time: Date.now(), position: posObj() };
        deathLog.push(entry);
        log('DIED! Respawning...');
      });

      // Kicked / disconnect — auto-reconnect
      bot.on('kicked', (reason) => {
        log(`Kicked: ${JSON.stringify(reason)}`);
        botReady = false;
      });

      bot.on('end', (reason) => {
        log(`Disconnected: ${reason}`);
        botReady = false;
        // Auto-reconnect after 5 seconds
        setTimeout(() => {
          log('Attempting reconnect...');
          createBot().catch(e => log(`Reconnect failed: ${e.message}`));
        }, 5000);
      });

      botReady = true;
      log(`Connected! Spawned at ${fmt(bot.entity.position.x)}, ${fmt(bot.entity.position.y)}, ${fmt(bot.entity.position.z)}`);
      resolve(bot);
    });

    bot.on('error', (err) => {
      log(`Bot error: ${err.message}`);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function fmt(v) { return typeof v === 'number' ? Math.round(v * 10) / 10 : v; }

function posObj(pos) {
  const p = pos || bot?.entity?.position;
  if (!p) return null;
  return { x: fmt(p.x), y: fmt(p.y), z: fmt(p.z) };
}

function itemStr(item) {
  if (!item) return null;
  return { name: item.name, count: item.count };
}

function ensureBot() {
  if (!bot || !botReady || !bot.entity) {
    throw new Error('Bot not connected. POST /connect to retry.');
  }
  return bot;
}

// Brief state snapshot (included in action responses)
// Includes any new chat messages so the AI sees them after every action
function briefState() {
  if (!bot || !botReady) return null;

  // Grab recent chat (last 30s) so AI sees messages that arrived during action
  const now = Date.now();
  const recentChat = chatLog
    .filter(m => now - m.time < 30000 && m.from !== bot.username)
    .map(m => ({ from: m.from, message: m.message, ago: Math.round((now - m.time) / 1000) + 's' }));

  // Grab pending commands
  const pending = commandQueue.filter(c => c.status === 'pending');

  const state = {
    health: fmt(bot.health),
    food: bot.food,
    position: posObj(),
    holding: bot.heldItem?.name || 'empty',
    time: bot.time.timeOfDay,
    isDay: bot.time.timeOfDay < 12000,
  };

  if (recentChat.length > 0) state.new_chat = recentChat;
  if (pending.length > 0) state.pending_commands = pending.length;
  if (currentTask && currentTask.status === 'running') {
    state.task = { action: currentTask.action, elapsed: Math.round((Date.now() - currentTask.started) / 1000) + 's' };
  } else if (currentTask && currentTask.status === 'done') {
    state.task_done = currentTask.result?.result || 'completed';
  } else if (currentTask && currentTask.status === 'error') {
    state.task_error = currentTask.error;
  }

  return state;
}

// ═══════════════════════════════════════════════════════════════════
// State Collection
// ═══════════════════════════════════════════════════════════════════

function getFullState() {
  const b = ensureBot();
  const pos = b.entity.position;
  const inv = b.inventory.items();
  const time = b.time.timeOfDay;

  // Nearby entities
  const entities = Object.values(b.entities)
    .filter(e => e !== b.entity && e.position.distanceTo(pos) < 24)
    .sort((a, c) => a.position.distanceTo(pos) - c.position.distanceTo(pos))
    .slice(0, 15)
    .map(e => ({
      type: e.name || e.mobType || e.displayName || 'unknown',
      distance: fmt(e.position.distanceTo(pos)),
      position: posObj(e.position),
      health: e.health ?? undefined,
    }));

  // Nearby blocks (scan 5-block radius, aggregate by type)
  const blockCounts = {};
  const notableBlocks = []; // specific blocks worth calling out
  for (let dx = -5; dx <= 5; dx++) {
    for (let dy = -3; dy <= 4; dy++) {
      for (let dz = -5; dz <= 5; dz++) {
        const block = b.blockAt(pos.offset(dx, dy, dz));
        if (block && block.name !== 'air' && block.name !== 'cave_air') {
          blockCounts[block.name] = (blockCounts[block.name] || 0) + 1;
          // Note ores and interesting blocks with positions
          if (block.name.includes('ore') || block.name === 'crafting_table' || 
              block.name === 'furnace' || block.name === 'chest' ||
              block.name.includes('log') || block.name === 'water' ||
              block.name === 'lava') {
            if (notableBlocks.length < 20) {
              notableBlocks.push({
                name: block.name,
                position: { x: block.position.x, y: block.position.y, z: block.position.z },
              });
            }
          }
        }
      }
    }
  }

  const nearbyBlocks = Object.entries(blockCounts)
    .sort((a, c) => c[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));

  // What we're looking at
  const target = b.blockAtCursor?.(5);
  const lookingAt = target ? { name: target.name, position: posObj(target.position) } : null;

  // Biome
  const biome = b.blockAt(pos)?.biome?.name || 'unknown';

  // Unread chat
  const unreadChat = chatLog.length > 0 ? chatLog.slice(-5).map(m => ({
    from: m.from, message: m.message,
    ago: Math.round((Date.now() - m.time) / 1000) + 's',
  })) : [];

  return {
    health: fmt(b.health),
    maxHealth: 20,
    food: b.food,
    saturation: fmt(b.foodSaturation),
    position: posObj(),
    dimension: b.game?.dimension?.replace('minecraft:', '') || 'overworld',
    biome,
    time: time,
    isDay: time < 12000,
    timePhase: time < 6000 ? 'morning' : time < 12000 ? 'afternoon' : time < 18000 ? 'evening' : 'night',
    holding: bot.heldItem ? itemStr(bot.heldItem) : 'empty',
    experience: { level: b.experience?.level || 0 },
    inventory: inv.map(i => ({ name: i.name, count: i.count })),
    inventoryCount: inv.length,
    nearbyBlocks,
    notableBlocks,
    nearbyEntities: entities,
    lookingAt,
    unreadChat: unreadChat.length > 0 ? unreadChat : undefined,
    deaths: deathLog.length,
    onGround: b.entity.onGround,
    isRaining: b.isRaining,
  };
}

function getInventory() {
  const b = ensureBot();
  const items = b.inventory.items();
  if (items.length === 0) return { items: [], summary: 'empty' };

  const categories = {};
  items.forEach(item => {
    const n = item.name;
    let cat = 'other';
    if (n.includes('pickaxe') || n.includes('_axe') || n.includes('shovel') || n.includes('hoe') || n === 'shears' || n === 'flint_and_steel') cat = 'tools';
    else if (n.includes('sword') || n.includes('bow') || n === 'crossbow' || n === 'trident') cat = 'weapons';
    else if (n.includes('helmet') || n.includes('chestplate') || n.includes('leggings') || n.includes('boots') || n === 'shield') cat = 'armor';
    else if (n.includes('cooked') || n.includes('bread') || n.includes('apple') || n.includes('steak') || n.includes('porkchop') || n.includes('chicken') || n.includes('salmon') || n.includes('potato') || n === 'mushroom_stew') cat = 'food';
    else if (n.includes('ingot') || n.includes('diamond') || n.includes('coal') || n.includes('redstone') || n.includes('lapis') || n.includes('stick') || n.includes('string') || n.includes('flint') || n.includes('blaze') || n.includes('ender_pearl')) cat = 'materials';
    else if (mcData?.blocksByName[n]) cat = 'blocks';

    if (!categories[cat]) categories[cat] = [];
    categories[cat].push({ name: n, count: item.count });
  });

  return { categories, totalSlots: items.length };
}

function getNearby(radius = 32) {
  const b = ensureBot();
  const pos = b.entity.position;

  // Entities
  const entities = Object.values(b.entities)
    .filter(e => e !== b.entity && e.position.distanceTo(pos) < radius)
    .sort((a, c) => a.position.distanceTo(pos) - c.position.distanceTo(pos))
    .slice(0, 20)
    .map(e => ({
      type: e.name || e.mobType || 'unknown',
      distance: fmt(e.position.distanceTo(pos)),
      position: posObj(e.position),
      health: e.health,
      kind: e.type, // 'mob', 'player', 'object', etc.
    }));

  // Notable blocks in wider radius
  const blockTypes = {};
  const scanR = Math.min(radius, 16); // block scan limited for performance
  for (let dx = -scanR; dx <= scanR; dx += 2) {
    for (let dy = -8; dy <= 8; dy++) {
      for (let dz = -scanR; dz <= scanR; dz += 2) {
        const block = b.blockAt(pos.offset(dx, dy, dz));
        if (block && block.name !== 'air' && block.name !== 'cave_air' && block.name !== 'stone' && block.name !== 'dirt' && block.name !== 'grass_block' && block.name !== 'deepslate') {
          if (!blockTypes[block.name]) blockTypes[block.name] = { count: 0, nearest: null, nearestDist: Infinity };
          blockTypes[block.name].count++;
          const dist = pos.distanceTo(block.position);
          if (dist < blockTypes[block.name].nearestDist) {
            blockTypes[block.name].nearest = posObj(block.position);
            blockTypes[block.name].nearestDist = dist;
          }
        }
      }
    }
  }

  const blocks = Object.entries(blockTypes)
    .sort((a, c) => c[1].count - a[1].count)
    .slice(0, 25)
    .map(([name, info]) => ({ name, count: info.count, nearest: info.nearest }));

  return { entities, blocks, scanRadius: scanR };
}

// ═══════════════════════════════════════════════════════════════════
// Actions
// ═══════════════════════════════════════════════════════════════════

const ACTIONS = {
  // ── Movement ─────────────────────────────────────
  async goto({ x, y, z }) {
    const b = ensureBot();
    const goal = new goals.GoalBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    await b.pathfinder.goto(goal);
    return { result: `Arrived at ${fmt(x)}, ${fmt(y)}, ${fmt(z)}` };
  },

  async goto_near({ x, y, z, range = 2 }) {
    const b = ensureBot();
    const goal = new goals.GoalNear(Math.floor(x), Math.floor(y), Math.floor(z), range);
    await b.pathfinder.goto(goal);
    return { result: `Arrived near ${fmt(x)}, ${fmt(y)}, ${fmt(z)}` };
  },

  async follow({ player }) {
    const b = ensureBot();
    const entity = Object.values(b.entities).find(e =>
      e !== b.entity && (
        (e.username || '').toLowerCase() === player.toLowerCase() ||
        (e.name || '').toLowerCase() === player.toLowerCase()
      )
    );
    if (!entity) throw new Error(`Player/entity "${player}" not found nearby.`);
    b.pathfinder.setGoal(new goals.GoalFollow(entity, 2), true);
    return { result: `Following ${player}. Use /action/stop to stop.` };
  },

  async look({ x, y, z }) {
    const b = ensureBot();
    await b.lookAt(new Vec3(x, y, z));
    return { result: `Looking at ${x}, ${y}, ${z}` };
  },

  async stop() {
    const b = ensureBot();
    b.pathfinder.setGoal(null);
    try { b.stopDigging(); } catch {}
    if (b.pvp) try { b.pvp.stop(); } catch {}
    return { result: 'Stopped all actions.' };
  },

  // ── Mining ───────────────────────────────────────
  async collect({ block, count = 1 }) {
    const b = ensureBot();
    const blockType = mcData.blocksByName[block];
    if (!blockType) throw new Error(`Unknown block "${block}". Check spelling (e.g. oak_log, iron_ore, cobblestone).`);

    // Cap at 20 per call — chat piggybacks on the response so AI sees it
    const batchSize = Math.min(count, 20);

    const found = b.findBlocks({
      matching: blockType.id,
      maxDistance: 64,
      count: batchSize,
    });

    if (found.length === 0) throw new Error(`No ${block} found within 64 blocks.`);

    let collected = 0;
    for (const pos of found.slice(0, batchSize)) {
      try {
        const target = b.blockAt(pos);
        if (!target || target.name !== block) continue;
        await b.tool.equipForBlock(target);
        if (b.entity.position.distanceTo(pos) > 4.5) {
          await b.pathfinder.goto(new goals.GoalNear(pos.x, pos.y, pos.z, 3));
        }
        await b.dig(target, true);
        collected++;
        await sleep(200);
      } catch {}
    }

    // Auto-pickup: walk through nearby drops to collect them
    await sleep(600);
    for (let attempt = 0; attempt < 3; attempt++) {
      const drops = Object.values(b.entities)
        .filter(e => (e.name === 'item' || e.displayName === 'Item') && e.position.distanceTo(b.entity.position) < 12)
        .sort((a, c) => a.position.distanceTo(b.entity.position) - c.position.distanceTo(b.entity.position));
      if (drops.length === 0) break;
      for (const drop of drops.slice(0, 6)) {
        try {
          await b.pathfinder.goto(new goals.GoalNear(drop.position.x, drop.position.y, drop.position.z, 1));
          await sleep(400);
        } catch {}
      }
    }

    // Report what we actually have now
    const invCount = b.inventory.items().filter(i => i.name === block).reduce((s, i) => s + i.count, 0);
    const remaining = count - collected;
    const msg = remaining > 0
      ? `Mined ${collected} ${block} (${remaining} more needed). Have ${invCount} ${block} in inventory.`
      : `Mined ${collected}/${count} ${block}. Have ${invCount} ${block} in inventory.`;
    return { result: msg };
  },

  async dig({ x, y, z }) {
    const b = ensureBot();
    const target = b.blockAt(new Vec3(x, y, z));
    if (!target || target.name === 'air') throw new Error(`No block at ${x}, ${y}, ${z}`);
    await b.tool.equipForBlock(target);
    if (b.entity.position.distanceTo(target.position) > 4.5) {
      await b.pathfinder.goto(new goals.GoalNear(x, y, z, 3));
    }
    await b.dig(target, true);
    return { result: `Mined ${target.name} at ${x}, ${y}, ${z}` };
  },

  async pickup() {
    const b = ensureBot();
    const invBefore = b.inventory.items().reduce((s, i) => s + i.count, 0);

    for (let attempt = 0; attempt < 3; attempt++) {
      const pos = b.entity.position;
      const drops = Object.values(b.entities)
        .filter(e => (e.name === 'item' || e.displayName === 'Item') && e.position.distanceTo(pos) < 16)
        .sort((a, c) => a.position.distanceTo(pos) - c.position.distanceTo(pos));

      if (drops.length === 0) break;

      for (const drop of drops.slice(0, 8)) {
        try {
          await b.pathfinder.goto(new goals.GoalNear(drop.position.x, drop.position.y, drop.position.z, 1));
          await sleep(400);
        } catch {}
      }
    }

    const invAfter = b.inventory.items().reduce((s, i) => s + i.count, 0);
    const gained = invAfter - invBefore;
    return { result: gained > 0 ? `Picked up ${gained} items.` : 'No items to pick up.' };
  },

  // ── Find blocks ──────────────────────────────────
  async find_blocks({ block, radius = 32, count = 10 }) {
    const b = ensureBot();
    const blockType = mcData.blocksByName[block];
    if (!blockType) throw new Error(`Unknown block "${block}".`);

    const found = b.findBlocks({
      matching: blockType.id,
      maxDistance: Math.min(radius, 64),
      count: count,
    });

    if (found.length === 0) return { result: `No ${block} found within ${radius} blocks.`, locations: [] };

    const locations = found.map(p => ({
      x: p.x, y: p.y, z: p.z,
      distance: fmt(b.entity.position.distanceTo(p)),
    }));

    return { result: `Found ${found.length} ${block}`, locations };
  },

  // ── Find entities ────────────────────────────────
  async find_entities({ type, radius = 32 }) {
    const b = ensureBot();
    const pos = b.entity.position;
    let entities = Object.values(b.entities)
      .filter(e => e !== b.entity && e.position.distanceTo(pos) < radius);

    if (type) {
      entities = entities.filter(e =>
        (e.name || '').toLowerCase().includes(type.toLowerCase()) ||
        (e.username || '').toLowerCase().includes(type.toLowerCase()) ||
        (e.displayName || '').toLowerCase().includes(type.toLowerCase())
      );
    }

    entities = entities
      .sort((a, c) => a.position.distanceTo(pos) - c.position.distanceTo(pos))
      .slice(0, 20)
      .map(e => ({
        type: e.username || e.name || e.displayName || 'unknown',
        distance: fmt(e.position.distanceTo(pos)),
        position: posObj(e.position),
        health: e.health ?? undefined,
      }));

    return {
      result: `Found ${entities.length} ${type || 'entities'}`,
      locations: entities.map(e => ({ ...e.position, distance: e.distance, type: e.type })),
      entities,
    };
  },

  // ── Command queue management ────────────────────
  async complete_command({ index = 0 }) {
    if (commandQueue.length === 0) return { result: 'No commands in queue.' };
    const pending = commandQueue.filter(c => c.status === 'pending');
    if (index >= pending.length) return { result: 'No pending command at that index.' };
    pending[index].status = 'completed';
    return { result: `Marked command as completed: "${pending[index].command}"` };
  },

  // ── Crafting ─────────────────────────────────────
  async craft({ item, count = 1 }) {
    const b = ensureBot();
    const itemType = mcData.itemsByName[item];
    if (!itemType) throw new Error(`Unknown item "${item}". Check spelling.`);

    // Find nearby crafting table
    const table = b.findBlock({
      matching: mcData.blocksByName.crafting_table?.id,
      maxDistance: 4,
    });

    // Try all recipe sources: without table, with table, all recipes
    let recipes = b.recipesFor(itemType.id, null, 1, null);
    if ((!recipes || recipes.length === 0) && table) {
      recipes = b.recipesFor(itemType.id, null, 1, table);
    }
    // Fallback: try getting all recipes regardless
    if (!recipes || recipes.length === 0) {
      recipes = b.recipesAll(itemType.id, null, 1);
    }
    if (!recipes || recipes.length === 0) {
      throw new Error(`Can't craft ${item}. ${table ? 'Missing ingredients.' : 'Need a crafting table nearby (place one within 4 blocks).'} Use /action/recipes to check.`);
    }

    const recipe = recipes[0];
    const craftTable = (recipe.requiresTable !== false) ? table : null;

    await b.craft(recipe, count, craftTable || undefined);
    const resultCount = count * (recipe.result?.count || 1);
    return { result: `Crafted ${item} x${resultCount}` };
  },

  async recipes({ item }) {
    const b = ensureBot();
    const itemType = mcData.itemsByName[item];
    if (!itemType) throw new Error(`Unknown item "${item}".`);

    // Try multiple recipe lookup methods
    let recipes = b.recipesFor(itemType.id);
    if (!recipes || recipes.length === 0) {
      // Try with crafting table
      const table = b.findBlock({
        matching: mcData.blocksByName.crafting_table?.id,
        maxDistance: 4,
      });
      if (table) recipes = b.recipesFor(itemType.id, null, 1, table);
    }
    if (!recipes || recipes.length === 0) {
      // Try recipesAll
      try { recipes = b.recipesAll(itemType.id, null, 1); } catch {}
    }
    if (!recipes || recipes.length === 0) {
      return { result: `No crafting recipe for ${item}.`, recipes: [] };
    }

    const formatted = recipes.slice(0, 3).map(r => {
      const ingredients = {};
      const slots = r.inShape ? r.inShape.flat() : r.ingredients?.flat() || [];
      slots.filter(id => id && id !== -1).forEach(id => {
        const name = mcData.items[id]?.name || `id:${id}`;
        ingredients[name] = (ingredients[name] || 0) + 1;
      });
      return {
        ingredients,
        needsTable: r.requiresTable !== false,
        makes: r.result?.count || 1,
      };
    });

    return { result: `${formatted.length} recipe(s) for ${item}`, recipes: formatted };
  },

  async smelt({ input, fuel, count = 1 }) {
    const b = ensureBot();
    const furnaceBlock = b.findBlock({
      matching: block => block.name === 'furnace' || block.name === 'lit_furnace',
      maxDistance: 4,
    });
    if (!furnaceBlock) throw new Error('No furnace within 4 blocks. Place one first.');

    const furnace = await b.openFurnace(furnaceBlock);
    const inputItem = b.inventory.items().find(i => i.name === input);
    if (!inputItem) { furnace.close(); throw new Error(`No ${input} in inventory.`); }

    await furnace.putInput(inputItem.type, null, Math.min(count, inputItem.count));

    if (!furnace.fuelItem()) {
      const fuelNames = ['coal', 'charcoal', 'oak_planks', 'birch_planks', 'spruce_planks', 'oak_log', 'birch_log', 'spruce_log', 'stick'];
      const fuelItem = fuel
        ? b.inventory.items().find(i => i.name === fuel)
        : b.inventory.items().find(i => fuelNames.includes(i.name));
      if (!fuelItem) { furnace.close(); throw new Error('No fuel. Need coal, planks, or logs.'); }
      await furnace.putFuel(fuelItem.type, null, Math.min(8, fuelItem.count));
    }

    // Wait briefly then check
    await sleep(Math.min(count * 10000, 30000));
    const output = furnace.outputItem();
    if (output) await furnace.takeOutput();
    furnace.close();

    return { result: output ? `Smelted ${output.name} x${output.count}` : `Smelting in progress. Check furnace later.` };
  },

  // ── Combat ───────────────────────────────────────
  async attack({ target }) {
    const b = ensureBot();
    const hostiles = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch', 'drowned', 'phantom', 'blaze', 'ghast', 'wither_skeleton', 'piglin_brute', 'cave_spider'];

    let entity;
    if (target) {
      entity = b.nearestEntity(e =>
        e !== b.entity && (e.name || '').toLowerCase().includes(target.toLowerCase())
      );
    } else {
      entity = b.nearestEntity(e =>
        e !== b.entity && hostiles.includes((e.name || '').toLowerCase())
      );
    }
    if (!entity) throw new Error(`No ${target || 'hostile mob'} found nearby.`);

    // Approach and attack
    if (entity.position.distanceTo(b.entity.position) > 3) {
      await b.pathfinder.goto(new goals.GoalNear(entity.position.x, entity.position.y, entity.position.z, 2));
    }
    await b.attack(entity);
    return { result: `Attacked ${entity.name || target} (${fmt(entity.position.distanceTo(b.entity.position))}m away)` };
  },

  async eat() {
    const b = ensureBot();
    const foods = b.inventory.items().filter(i => mcData.foodsByName?.[i.name]);
    if (foods.length === 0) throw new Error('No food in inventory.');
    foods.sort((a, c) => (mcData.foodsByName[c.name]?.foodPoints || 0) - (mcData.foodsByName[a.name]?.foodPoints || 0));
    await b.equip(foods[0], 'hand');
    await b.consume();
    return { result: `Ate ${foods[0].name}. Health: ${fmt(b.health)}, Food: ${b.food}` };
  },

  // ── Inventory ────────────────────────────────────
  async equip({ item, slot = 'hand' }) {
    const b = ensureBot();
    const invItem = b.inventory.items().find(i => i.name === item);
    if (!invItem) {
      const available = b.inventory.items().map(i => i.name);
      throw new Error(`No ${item} in inventory. Have: ${[...new Set(available)].join(', ')}`);
    }
    await b.equip(invItem, slot);
    return { result: `Equipped ${item} to ${slot}` };
  },

  async toss({ item, count }) {
    const b = ensureBot();
    const invItem = b.inventory.items().find(i => i.name === item);
    if (!invItem) throw new Error(`No ${item} in inventory.`);
    await b.tossStack(invItem);
    return { result: `Tossed ${item}` };
  },

  // ── Building ─────────────────────────────────────
  async place({ block: blockName, x, y, z }) {
    const b = ensureBot();
    const item = b.inventory.items().find(i => i.name === blockName);
    if (!item) throw new Error(`No ${blockName} in inventory.`);

    await b.equip(item, 'hand');
    const targetPos = new Vec3(x, y, z);

    // Approach if far
    if (b.entity.position.distanceTo(targetPos) > 4.5) {
      await b.pathfinder.goto(new goals.GoalNear(x, y, z, 3));
    }

    // Find reference block to place against
    const offsets = [[0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    for (const [dx, dy, dz] of offsets) {
      const ref = b.blockAt(targetPos.offset(dx, dy, dz));
      if (ref && ref.name !== 'air' && ref.name !== 'cave_air') {
        await b.placeBlock(ref, new Vec3(-dx, -dy, -dz));
        return { result: `Placed ${blockName} at ${x}, ${y}, ${z}` };
      }
    }
    throw new Error(`No solid block adjacent to ${x}, ${y}, ${z} to place against.`);
  },

  async interact({ x, y, z }) {
    const b = ensureBot();
    const block = b.blockAt(new Vec3(x, y, z));
    if (!block) throw new Error(`No block at ${x}, ${y}, ${z}`);
    if (b.entity.position.distanceTo(block.position) > 4.5) {
      await b.pathfinder.goto(new goals.GoalNear(x, y, z, 2));
    }
    await b.activateBlock(block);
    return { result: `Interacted with ${block.name} at ${x}, ${y}, ${z}` };
  },

  async close_screen() {
    const b = ensureBot();
    if (b.currentWindow) b.closeWindow(b.currentWindow);
    return { result: 'Closed screen.' };
  },

  // ── Utility ──────────────────────────────────────
  async chat({ message }) {
    const b = ensureBot();
    b.chat(message);
    return { result: `Sent: ${message}` };
  },

  async wait({ seconds = 5 }) {
    ensureBot();
    await sleep(Math.min(seconds, 60) * 1000);
    return { result: `Waited ${seconds}s` };
  },

  async use() {
    const b = ensureBot();
    await b.activateItem();
    return { result: `Used ${b.heldItem?.name || 'hand'}` };
  },

  async sleep_bed() {
    const b = ensureBot();
    const bed = b.findBlock({
      matching: block => block.name?.includes('bed'),
      maxDistance: 4,
    });
    if (!bed) throw new Error('No bed within 4 blocks.');
    await b.sleep(bed);
    return { result: 'Sleeping...' };
  },
};

// ═══════════════════════════════════════════════════════════════════
// HTTP Server
// ═══════════════════════════════════════════════════════════════════

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
  });
}

function respond(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

const httpServer = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${config.api.port}`);
  const path = url.pathname;

  try {
    // ── GET endpoints (observation) ──────────────
    if (req.method === 'GET') {
      if (path === '/health' || path === '/') {
        return respond(res, 200, {
          ok: true,
          connected: botReady,
          username: config.mc.username,
          server: `${config.mc.host}:${config.mc.port}`,
        });
      }

      if (path === '/status') {
        return respond(res, 200, { ok: true, data: getFullState() });
      }

      if (path === '/inventory') {
        return respond(res, 200, { ok: true, data: getInventory() });
      }

      if (path === '/nearby') {
        const radius = parseInt(url.searchParams.get('radius') || '32');
        return respond(res, 200, { ok: true, data: getNearby(radius) });
      }

      if (path === '/chat') {
        const count = parseInt(url.searchParams.get('count') || '20');
        const clear = url.searchParams.get('clear') !== 'false';
        const msgs = chatLog.slice(-count);
        if (clear) chatLog.length = 0;
        return respond(res, 200, { ok: true, data: { messages: msgs } });
      }

      if (path === '/commands') {
        // Get pending commands queued by in-game chat
        const pending = commandQueue.filter(c => c.status === 'pending');
        return respond(res, 200, { ok: true, data: { commands: pending } });
      }

      if (path === '/task') {
        // Check background task status
        if (!currentTask) return respond(res, 200, { ok: true, data: { task: null }, state: briefState() });
        const elapsed = Math.round((Date.now() - currentTask.started) / 1000);
        return respond(res, 200, { ok: true, data: { task: { ...currentTask, elapsed_s: elapsed } }, state: briefState() });
      }
    }

    // ── POST endpoints (actions) ────────────────
    if (req.method === 'POST') {
      const body = await parseBody(req);

      // Cancel current task
      if (path === '/task/cancel') {
        const b = ensureBot();
        b.pathfinder.setGoal(null);
        try { b.stopDigging(); } catch {}
        if (currentTask && currentTask.status === 'running') {
          currentTask.status = 'cancelled';
        }
        return respond(res, 200, { ok: true, result: 'Task cancelled.', state: briefState() });
      }

      // Background task system: POST /task/ACTION runs async, returns task_id
      const taskMatch = path.match(/^\/task\/(\w+)$/);
      if (taskMatch) {
        const actionName = taskMatch[1];
        const actionFn = ACTIONS[actionName];
        if (!actionFn) {
          const available = Object.keys(ACTIONS).join(', ');
          return respond(res, 400, { ok: false, error: `Unknown action "${actionName}". Available: ${available}` });
        }
        const taskId = `${actionName}_${Date.now()}`;
        currentTask = { id: taskId, action: actionName, status: 'running', started: Date.now(), result: null, error: null };
        // Fire and forget — runs in background
        actionFn(body).then(result => {
          if (currentTask && currentTask.id === taskId) {
            currentTask.status = 'done';
            currentTask.result = result;
          }
        }).catch(err => {
          if (currentTask && currentTask.id === taskId) {
            currentTask.status = 'error';
            currentTask.error = err.message;
          }
        });
        return respond(res, 200, { ok: true, task_id: taskId, status: 'started', state: briefState() });
      }

      // Synchronous action: POST /action/ACTION (still supported for quick stuff)
      const actionMatch = path.match(/^\/action\/(\w+)$/);
      if (!actionMatch) {
        // Special: /connect
        if (path === '/connect') {
          await createBot();
          return respond(res, 200, { ok: true, result: 'Connected', state: briefState() });
        }
        return respond(res, 404, { ok: false, error: `Unknown endpoint: ${path}` });
      }

      const actionName = actionMatch[1];
      const actionFn = ACTIONS[actionName];
      if (!actionFn) {
        const available = Object.keys(ACTIONS).join(', ');
        return respond(res, 400, { ok: false, error: `Unknown action "${actionName}". Available: ${available}` });
      }

      const result = await actionFn(body);
      return respond(res, 200, { ok: true, ...result, state: briefState() });
    }

    respond(res, 404, { ok: false, error: `Not found: ${req.method} ${path}` });

  } catch (err) {
    const status = err.message.includes('not connected') ? 503 : 400;
    respond(res, status, { ok: false, error: err.message, state: briefState() });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Startup
// ═══════════════════════════════════════════════════════════════════

httpServer.listen(config.api.port, () => {
  log(`╔═══════════════════════════════════════╗`);
  log(`║     HermesCraft Bot Server v3.0      ║`);
  log(`╠═══════════════════════════════════════╣`);
  log(`║  API:  http://localhost:${config.api.port}          ║`);
  log(`║  MC:   ${config.mc.host}:${config.mc.port}                ║`);
  log(`║  User: ${config.mc.username.padEnd(28)}║`);
  log(`╚═══════════════════════════════════════╝`);

  // Connect bot
  createBot().catch(e => {
    log(`Initial connection failed: ${e.message}`);
    log('Bot server is running — POST /connect when Minecraft is ready.');
  });
});

process.on('uncaughtException', (err) => {
  log(`Uncaught exception: ${err.message}`);
});
process.on('unhandledRejection', (err) => {
  log(`Unhandled rejection: ${err}`);
});
