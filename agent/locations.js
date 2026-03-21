// locations.js — Named location memory
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

let LOCATIONS_FILE = '';
let locations = {};

export function initLocations(agentConfig) {
  LOCATIONS_FILE = join(agentConfig.dataDir, 'locations.json');
  const dir = dirname(LOCATIONS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (existsSync(LOCATIONS_FILE)) {
    try { locations = JSON.parse(readFileSync(LOCATIONS_FILE, 'utf-8')); } catch { locations = {}; }
  }
}

export function saveLocation(name, x, y, z, type = 'custom') {
  locations[name] = { x: Math.round(x), y: Math.round(y), z: Math.round(z), type, saved: new Date().toISOString() };
}

export function setHome(x, y, z) {
  locations['home'] = {
    x: Math.round(x),
    y: Math.round(y),
    z: Math.round(z),
    type: 'home',
    saved: new Date().toISOString(),
  };
  saveLocations();
}

export function getHome() {
  const home = locations['home'];
  if (!home) return null;
  return { x: home.x, y: home.y, z: home.z };
}

export function autoDetectLocations(state) {
  // Auto-save significant locations from nearby blocks
  const blocks = state.nearbyBlocks || [];
  const pos = state.position;
  if (!pos) return;

  for (const b of blocks) {
    const blockName = (b.block || '').replace('minecraft:', '');
    if (blockName === 'bed' && !locations['bed']) {
      saveLocation('bed', b.x, b.y, b.z, 'bed');
    }
    // Auto-detect home on first bed (D-08)
    if (blockName === 'bed' && !locations['home']) {
      setHome(b.x, b.y, b.z);
      console.log(`[Locations] Auto-detected home at (${b.x}, ${b.y}, ${b.z})`);
    }
    // Auto-detect home on first door (shelter indicator)
    if (blockName.endsWith('_door') && !locations['home']) {
      setHome(b.x, b.y, b.z);
      console.log(`[Locations] Auto-detected home at (${b.x}, ${b.y}, ${b.z})`);
    }
    if (blockName === 'chest' && !locations['storage']) {
      saveLocation('storage', b.x, b.y, b.z, 'chest');
    }
  }
}

export function getLocationsForPrompt() {
  const entries = Object.entries(locations);
  if (entries.length === 0) return '';
  const lines = entries.map(([name, loc]) => `${name}: (${loc.x}, ${loc.y}, ${loc.z})`);
  return 'Known locations: ' + lines.join(', ');
}

export function recordDeathLocation(x, y, z, cause, lesson) {
  // Find existing danger entries
  const dangerKeys = Object.keys(locations).filter(k => k.startsWith('danger-'))

  // Cap at 10 — remove oldest if at limit
  if (dangerKeys.length >= 10) {
    const oldest = dangerKeys
      .map(k => ({ key: k, saved: locations[k].saved || '' }))
      .sort((a, b) => a.saved.localeCompare(b.saved))
    delete locations[oldest[0].key]
  }

  // Determine next danger index
  const existingNums = Object.keys(locations)
    .filter(k => k.startsWith('danger-'))
    .map(k => parseInt(k.split('-')[1], 10))
    .filter(n => !isNaN(n))
  const nextN = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1

  locations[`danger-${nextN}`] = {
    x: Math.round(x),
    y: Math.round(y),
    z: Math.round(z),
    type: 'danger',
    cause,
    lesson,
    saved: new Date().toISOString(),
  }

  saveLocations()
}

export function getNearbyDangers(position, radius = 30) {
  if (!position) return []

  const results = []
  for (const [name, loc] of Object.entries(locations)) {
    if (loc.type !== 'danger') continue
    const dx = position.x - loc.x
    const dy = position.y - loc.y
    const dz = position.z - loc.z
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (distance <= radius) {
      results.push({ name, x: loc.x, y: loc.y, z: loc.z, cause: loc.cause, lesson: loc.lesson, distance })
    }
  }
  return results
}

export function saveLocations() {
  try { writeFileSync(LOCATIONS_FILE, JSON.stringify(locations, null, 2)); } catch {}
}
