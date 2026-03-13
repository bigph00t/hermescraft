// memory.js — Multi-level persistent memory for HermesCraft
// Mirrors Hermes Agent's memory architecture:
//   L1: Session memory (conversation history — handled in llm.js)
//   L2: Curated memory (MEMORY.md — lessons, strategies, world knowledge)
//   L3: Session transcripts (JSONL per session)
//   L4: Skills (agentskills.io format — handled in skills.js)

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const MEMORY_FILE = join(DATA_DIR, 'MEMORY.md');
const STATS_FILE = join(DATA_DIR, 'stats.json');
const INSTRUCTIONS_FILE = join(DATA_DIR, 'instructions.txt');

const HOSTILE_MOBS = [
  'zombie', 'skeleton', 'spider', 'creeper', 'witch', 'enderman',
  'blaze', 'ghast', 'piglin', 'piglin_brute', 'hoglin', 'wither_skeleton',
  'magma_cube', 'slime', 'drowned', 'husk', 'stray', 'phantom',
  'pillager', 'vindicator', 'evoker', 'ravager', 'warden',
  'guardian', 'elder_guardian', 'zombified_piglin', 'silverfish',
  'cave_spider', 'breeze', 'bogged', 'shulker', 'endermite',
];

let memory = {
  lessons: [],
  strategies: [],
  worldKnowledge: [],
};

let stats = {
  totalDeaths: 0,
  totalActions: 0,
  totalTicks: 0,
  sessionsPlayed: 0,
  highestPhase: 1,
  highestPhaseName: 'First Night',
  totalPlayTimeMs: 0,
};

let sessionStart = Date.now();
let lastSaveTime = Date.now();
let sessionLogFile = null;

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const sessionsDir = join(DATA_DIR, 'sessions');
  if (!existsSync(sessionsDir)) mkdirSync(sessionsDir, { recursive: true });
}

// ── Load / Save ──

export function loadMemory() {
  ensureDataDir();

  // Load MEMORY.md
  if (existsSync(MEMORY_FILE)) {
    const content = readFileSync(MEMORY_FILE, 'utf-8');
    memory = parseMemoryMd(content);
  }

  // Load stats
  if (existsSync(STATS_FILE)) {
    try {
      stats = JSON.parse(readFileSync(STATS_FILE, 'utf-8'));
    } catch {}
  }

  // New session
  stats.sessionsPlayed++;
  sessionStart = Date.now();

  // Create session log file
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  sessionLogFile = join(DATA_DIR, 'sessions', `session-${ts}.jsonl`);

  saveStats();

  return { memory, stats };
}

export function saveMemory() {
  ensureDataDir();
  writeFileSync(MEMORY_FILE, renderMemoryMd(memory), 'utf-8');
}

function saveStats() {
  ensureDataDir();
  writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');
}

// ── MEMORY.md parsing / rendering ──

function parseMemoryMd(content) {
  const result = { lessons: [], strategies: [], worldKnowledge: [] };
  let currentSection = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## Lessons')) currentSection = 'lessons';
    else if (trimmed.startsWith('## Strategies')) currentSection = 'strategies';
    else if (trimmed.startsWith('## World Knowledge')) currentSection = 'worldKnowledge';
    else if (trimmed.startsWith('## ')) currentSection = null;
    else if (currentSection && trimmed.startsWith('- ')) {
      result[currentSection].push(trimmed.slice(2));
    }
  }

  return result;
}

function renderMemoryMd(mem) {
  const parts = ['# Hermes Memory\n'];

  parts.push('## Lessons\n');
  for (const lesson of mem.lessons.slice(-20)) {
    parts.push(`- ${lesson}`);
  }

  parts.push('\n## Strategies\n');
  for (const strategy of mem.strategies.slice(-10)) {
    parts.push(`- ${strategy}`);
  }

  parts.push('\n## World Knowledge\n');
  for (const knowledge of mem.worldKnowledge.slice(-10)) {
    parts.push(`- ${knowledge}`);
  }

  parts.push(`\n## Stats\n`);
  parts.push(`- Sessions: ${stats.sessionsPlayed} | Total deaths: ${stats.totalDeaths} | Highest phase: ${stats.highestPhaseName} (${stats.highestPhase}/7)`);

  return parts.join('\n') + '\n';
}

// ── Death Recording ──

function getEntityType(entity) {
  const name = entity.type || entity.name || '';
  return name.replace('minecraft:', '').toLowerCase();
}

function generateCountermeasure(cause, factors) {
  // Generate tactical advice based on death context
  if (cause.includes('skeleton')) return 'Build shelter or craft shield before exploring at night.';
  if (cause.includes('zombie')) return 'Craft a sword and fight at range. Zombies are slow — kite them.';
  if (cause.includes('spider')) return 'Spiders jump. Fight in open areas with a sword. They are neutral during day.';
  if (cause.includes('creeper')) return 'Sprint away when you hear hissing. Hit and retreat. Never let them get close.';
  if (cause.includes('blaze')) return 'Use shield to block fireballs. Attack between volleys. Snowballs are effective.';
  if (cause.includes('enderman')) return 'Do not look at enderman faces. Fight near water — they take damage and teleport away.';
  if (cause.includes('burned') || cause.includes('fire') || cause.includes('lava')) return 'Always carry a water bucket near lava. Be careful of hidden lava at deep levels.';
  if (cause.includes('drowned') || cause.includes('water')) return 'Watch air bubbles when underwater. Surface regularly.';
  if (cause.includes('fell') || cause.includes('void')) return 'Place blocks carefully near edges. Use sneak on ledges.';
  if (factors.includes('no armor')) return 'Prioritize crafting armor before dangerous activities.';
  if (factors.includes('during night')) return 'Build shelter before nightfall (time 13000). Mine underground at night.';
  return 'Be more cautious. Assess threats before acting.';
}

export function recordDeath(state, actionHistory, phase, progress) {
  stats.totalDeaths++;

  const nearbyEntities = state.nearbyEntities || [];
  const hostiles = nearbyEntities
    .filter(e => HOSTILE_MOBS.some(m => getEntityType(e).includes(m)));
  const isNight = (state.time || 0) >= 13000;
  const armorItems = state.armor_items || [];
  const hasArmor = armorItems.some(a => a && a.item);
  const hasWeapon = (state.currentItem || '').includes('sword');

  // Determine cause
  let cause = 'unknown cause';
  if (hostiles.length > 0) {
    const killer = hostiles[0];
    cause = `killed by ${getEntityType(killer)} (${Math.round(killer.distance || 0)}m away)`;
  } else if (state.onFire) cause = 'burned to death';
  else if (state.inWater) cause = 'drowned';
  else if (state.position && state.position.y < -50) cause = 'fell into the void or lava';

  // Context factors
  const factors = [];
  if (isNight) factors.push('during night');
  if (!hasArmor) factors.push('no armor');
  if (!hasWeapon) factors.push('no weapon ready');
  if (state.biome) factors.push(`in ${state.biome.replace('minecraft:', '')}`);
  factors.push(`phase ${phase.name} at ${progress}%`);

  const lastActions = (actionHistory || []).slice(-5).map(a => a.type || 'unknown');

  const countermeasure = generateCountermeasure(cause, factors);
  const lesson = `${cause} ${factors.join(', ')}. ${countermeasure}`;

  // Add to memory (deduplicate similar lessons)
  const isDuplicate = memory.lessons.some(l =>
    l.includes(cause.split(' ')[2] || '') && l.includes(countermeasure.split('.')[0])
  );
  if (!isDuplicate) {
    memory.lessons.push(lesson);
    // Keep max 20 lessons
    if (memory.lessons.length > 20) memory.lessons.shift();
  }

  // Update highest phase
  if (phase.id > stats.highestPhase) {
    stats.highestPhase = phase.id;
    stats.highestPhaseName = phase.name;
  }

  saveMemory();
  saveStats();

  // Write to session log
  writeSessionEntry({
    type: 'death',
    timestamp: new Date().toISOString(),
    deathNumber: stats.totalDeaths,
    cause,
    factors,
    lastActions,
    lesson,
    phase: { id: phase.id, name: phase.name, progress },
    position: state.position,
    dimension: state.dimension,
  });

  return { cause, factors, lesson, lastActions };
}

// ── Phase Completion ──

export function recordPhaseComplete(phase, state, actionHistory) {
  const strategy = `Phase ${phase.name} completed. Key actions: ${
    (actionHistory || []).slice(-10).map(a => a.type).join(' -> ')
  }`;

  // Only add if meaningfully different from existing strategies
  if (!memory.strategies.some(s => s.startsWith(`Phase ${phase.name}`))) {
    memory.strategies.push(strategy);
  }

  if (phase.id > stats.highestPhase) {
    stats.highestPhase = phase.id;
    stats.highestPhaseName = phase.name;
  }

  saveMemory();
  saveStats();

  writeSessionEntry({
    type: 'phase_complete',
    timestamp: new Date().toISOString(),
    phase: { id: phase.id, name: phase.name },
    inventorySnapshot: (state.inventory || []).map(i => ({
      item: (i.item || i.name || '').replace('minecraft:', ''),
      count: i.count,
    })),
  });
}

// ── Action Recording ──

export function recordAction() {
  stats.totalActions++;
  stats.totalTicks++;
  // Don't save on every action — too expensive. Save periodically.
}

// ── Queries ──

export function getRelevantLessons(phase, limit = 7) {
  // Return all lessons — they're already curated and deduplicated
  // Phase-specific lessons first, then general ones
  const phaseSpecific = memory.lessons.filter(l =>
    l.toLowerCase().includes(phase.name.toLowerCase())
  );
  const general = memory.lessons.filter(l =>
    !l.toLowerCase().includes(phase.name.toLowerCase())
  );

  return [...phaseSpecific, ...general].slice(0, limit);
}

export function getMemoryForPrompt() {
  const parts = [];

  if (memory.lessons.length > 0) {
    parts.push('Lessons learned:');
    memory.lessons.slice(-7).forEach(l => parts.push(`  - ${l}`));
  }

  if (memory.strategies.length > 0) {
    parts.push('Successful strategies:');
    memory.strategies.slice(-5).forEach(s => parts.push(`  - ${s}`));
  }

  if (memory.worldKnowledge.length > 0) {
    parts.push('World knowledge:');
    memory.worldKnowledge.slice(-5).forEach(k => parts.push(`  - ${k}`));
  }

  return parts.join('\n');
}

export function getSessionStats() {
  const uptimeMs = Date.now() - sessionStart;
  const uptimeMin = Math.round(uptimeMs / 60000);
  const successRate = stats.totalActions > 0
    ? Math.round(((stats.totalActions - stats.totalDeaths) / stats.totalActions) * 100)
    : 100;

  return {
    ...stats,
    uptimeMin,
    successRate,
    sessionStart,
    lessonsCount: memory.lessons.length,
  };
}

export function getStats() {
  return stats;
}

export function getMemory() {
  return memory;
}

// ── World Knowledge ──

export function addWorldKnowledge(knowledge) {
  if (!memory.worldKnowledge.includes(knowledge)) {
    memory.worldKnowledge.push(knowledge);
    if (memory.worldKnowledge.length > 10) memory.worldKnowledge.shift();
    saveMemory();
  }
}

// ── Session Logging ──

export function writeSessionEntry(entry) {
  if (!sessionLogFile) return;
  try {
    appendFileSync(sessionLogFile, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {}
}

// ── User Instructions ──

export function readInstructions() {
  ensureDataDir();
  if (!existsSync(INSTRUCTIONS_FILE)) return null;
  try {
    const content = readFileSync(INSTRUCTIONS_FILE, 'utf-8').trim();
    if (content) {
      // Clear after reading
      writeFileSync(INSTRUCTIONS_FILE, '', 'utf-8');
      return content;
    }
  } catch {}
  return null;
}

// ── Periodic Save ──

export function periodicSave() {
  const now = Date.now();
  stats.totalPlayTimeMs = (stats.totalPlayTimeMs || 0) + (now - lastSaveTime);
  lastSaveTime = now;
  saveStats();
  saveMemory();  // Persist lessons/strategies so OOM kills don't lose progress
  pruneSessionLogs();
}

// Keep only the last 10 session log files to prevent disk exhaustion on multi-day runs
function pruneSessionLogs() {
  try {
    const sessionsDir = join(DATA_DIR, 'sessions');
    if (!existsSync(sessionsDir)) return;
    const files = readdirSync(sessionsDir)
      .filter(f => f.startsWith('session-') && f.endsWith('.jsonl'))
      .sort();
    const MAX_SESSION_FILES = 10;
    if (files.length > MAX_SESSION_FILES) {
      for (const old of files.slice(0, files.length - MAX_SESSION_FILES)) {
        try { unlinkSync(join(sessionsDir, old)); } catch {}
      }
    }
  } catch {}
}
