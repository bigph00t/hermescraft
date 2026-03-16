// state.js — Read and summarize game state from the Fabric mod HTTP API

const MOD_URL = process.env.MOD_URL || 'http://localhost:3001';

const stateHistory = [];
const MAX_HISTORY = 10;

// Navigation tracking — since Baritone isPathing is broken, we track it ourselves
let navigateActive = false;
let navigateTicksStill = 0;

export function setNavigating(active) {
  navigateActive = active;
  navigateTicksStill = 0;
}

export async function fetchState() {
  const res = await fetch(`${MOD_URL}/state`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`GET /state returned ${res.status}`);
  const state = await res.json();

  stateHistory.push(state);
  if (stateHistory.length > MAX_HISTORY) stateHistory.shift();

  return state;
}

export async function fetchRecipes(item) {
  const res = await fetch(`${MOD_URL}/recipes?item=${encodeURIComponent(item)}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) return null;
  return res.json();
}

export function getStateHistory() {
  return stateHistory;
}

export function summarizeState(state) {
  const lines = [];

  // Position and dimension
  const p = state.position;
  if (p) lines.push(`Position: ${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`);
  if (state.dimension) lines.push(`Dimension: ${state.dimension}`);
  if (state.time !== undefined) lines.push(`Time: ${state.time}`);

  // Vitals
  lines.push(`Health: ${state.health ?? '?'}/20  Food: ${state.food ?? '?'}/20`);
  if (state.experience !== undefined) lines.push(`XP Level: ${state.experience?.level ?? state.experience}`);

  // Current item
  if (state.currentItem) lines.push(`Holding: ${state.currentItem}`);

  // Inventory
  if (state.inventory && state.inventory.length > 0) {
    const inv = state.inventory.map(i => `${(i.item || i.name || '?').replace('minecraft:','')}x${i.count}`).join(', ');
    lines.push(`Inventory: ${inv}`);
  } else {
    lines.push('Inventory: empty');
  }

  // Nearby blocks (closest instance of each type with coordinates for look_at_block)
  if (state.nearbyBlocks && state.nearbyBlocks.length > 0) {
    const seen = new Set();
    const blockList = [];
    // Sort by distance, then show closest of each type
    const sorted = [...state.nearbyBlocks].sort((a, b) => (a.distance || 99) - (b.distance || 99));
    for (const b of sorted) {
      const name = (b.block || b.name || b).replace('minecraft:', '');
      if (!seen.has(name)) {
        seen.add(name);
        const d = Math.round((b.distance || 0) * 10) / 10;
        blockList.push(`${name}(${b.x},${b.y},${b.z} d:${d})`);
        if (blockList.length >= 12) break;
      }
    }
    lines.push(`Nearby blocks: ${blockList.join(', ')}`);
  }

  // Nearby entities
  if (state.nearbyEntities && state.nearbyEntities.length > 0) {
    const ents = state.nearbyEntities.map(e => {
      const name = e.name || e.type || 'unknown';
      const dist = e.distance ? ` (${Math.round(e.distance)}m)` : '';
      const hp = e.health !== undefined ? ` hp:${e.health}` : '';
      return `${name}${hp}${dist}`;
    });
    lines.push(`Nearby entities: ${ents.join(', ')}`);
  }

  // Detect changes from last state
  if (stateHistory.length >= 2) {
    const prev = stateHistory[stateHistory.length - 2];
    const diffs = [];
    if (prev.health !== undefined && state.health !== undefined && state.health < prev.health) {
      diffs.push(`took ${prev.health - state.health} damage`);
    }
    if (prev.health !== undefined && state.health !== undefined && state.health > prev.health) {
      diffs.push(`healed ${state.health - prev.health}`);
    }
    if (prev.food !== undefined && state.food !== undefined && state.food !== prev.food) {
      diffs.push(`food ${prev.food}->${state.food}`);
    }
    if (diffs.length > 0) {
      lines.push(`Changes: ${diffs.join(', ')}`);
    }
  }

  // Crosshair — what the player is aiming at
  if (state.lookingAt) {
    lines.push(`Looking at: ${state.lookingAt} (dist: ${state.lookingAtDist || '?'})`);
  }

  // Recent chat messages
  if (state.recentChat && state.recentChat.length > 0) {
    lines.push('Recent chat:');
    for (const msg of state.recentChat.slice(-5)) {
      lines.push(`  <${msg.sender || 'Player'}> ${msg.text}`);
    }
  }

  // Navigation status — detect movement to infer Baritone is working
  if (navigateActive) {
    if (stateHistory.length >= 2) {
      const prev = stateHistory[stateHistory.length - 2];
      const pp = prev.position;
      if (p && pp) {
        const moved = Math.abs(p.x - pp.x) + Math.abs(p.y - pp.y) + Math.abs(p.z - pp.z);
        if (moved > 0.5) {
          lines.push('Status: NAVIGATING — Baritone is pathfinding. Use wait or stop to interrupt.');
        } else {
          // Not moving — Baritone may have finished or gotten stuck
          navigateTicksStill++;
          if (navigateTicksStill >= 3) {
            navigateActive = false;
            navigateTicksStill = 0;
            lines.push('Status: Navigation appears complete (stopped moving).');
          } else {
            lines.push('Status: NAVIGATING — waiting for movement...');
          }
        }
      }
    } else {
      lines.push('Status: NAVIGATING — Baritone pathfinding started.');
    }
  }

  return lines.join('\n');
}

export function detectDeath(state) {
  // Only detect transition TO death (health dropped to 0 from positive)
  // Avoids firing repeatedly while health stays at 0 on death screen
  if (stateHistory.length >= 2) {
    const prev = stateHistory[stateHistory.length - 2];
    if (prev.health > 0 && state.health !== undefined && state.health <= 0) return true;
  }
  // First tick ever with health 0 — likely death screen on startup
  if (stateHistory.length === 1 && state.health !== undefined && state.health <= 0) return true;
  return false;
}
