// social.js — Player relationship tracking
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

let PLAYERS_FILE = '';
let players = {};

export function initSocial(agentConfig) {
  PLAYERS_FILE = join(agentConfig.dataDir, 'players.json');
  const dir = dirname(PLAYERS_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (existsSync(PLAYERS_FILE)) {
    try { players = JSON.parse(readFileSync(PLAYERS_FILE, 'utf-8')); } catch { players = {}; }
  }
}

export function trackPlayer(name, interaction) {
  // interaction: { type: 'chat'|'gave_item'|'attacked'|'near', detail: string }
  if (!name || name === 'HermesBridge') return;
  if (!players[name]) {
    players[name] = {
      first_met: new Date().toISOString(),
      interactions: [],
      notable_interactions: [],
      sentiment: 0,  // -10 to +10
      relationship: 'stranger',
    };
  }
  const p = players[name];

  // Apply sentiment decay before updating — stale relationships fade toward neutral
  if (p.last_seen) {
    const hoursSinceLastSeen = (Date.now() - new Date(p.last_seen).getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastSeen > 0) {
      const decay = Math.min(Math.abs(p.sentiment), hoursSinceLastSeen * 0.1);
      if (p.sentiment > 0) p.sentiment -= decay;
      else if (p.sentiment < 0) p.sentiment += decay;
    }
  }

  p.last_seen = new Date().toISOString();
  p.interactions.push({ ...interaction, timestamp: new Date().toISOString() });
  // Keep last 20 interactions
  if (p.interactions.length > 20) p.interactions = p.interactions.slice(-20);

  // Track notable interactions (gave_item, attacked) — max 5, used by planner
  if (!p.notable_interactions) p.notable_interactions = [];
  if (interaction.type === 'gave_item' || interaction.type === 'attacked') {
    p.notable_interactions.push({ ...interaction, timestamp: new Date().toISOString() });
    if (p.notable_interactions.length > 5) p.notable_interactions.shift();
  }

  // Update sentiment
  if (interaction.type === 'gave_item') p.sentiment = Math.min(10, p.sentiment + 2);
  if (interaction.type === 'attacked') p.sentiment = Math.max(-10, p.sentiment - 3);
  if (interaction.type === 'chat') p.sentiment = Math.min(10, p.sentiment + 0.5);

  // Update relationship level
  if (p.sentiment >= 5) p.relationship = 'friend';
  else if (p.sentiment >= 2) p.relationship = 'acquaintance';
  else if (p.sentiment <= -3) p.relationship = 'hostile';
  else p.relationship = 'stranger';
}

export function getPlayersForPrompt(nearbyEntities) {
  if (!nearbyEntities || Object.keys(players).length === 0) return '';
  const nearbyPlayers = (nearbyEntities || [])
    .filter(e => e.type?.includes('player'))
    .map(e => e.name || e.type);

  const lines = [];
  for (const [name, p] of Object.entries(players)) {
    const isNearby = nearbyPlayers.some(n => n?.includes(name));
    if (isNearby || p.relationship !== 'stranger') {
      const recentChat = p.interactions.filter(i => i.type === 'chat').slice(-1);
      const lastChat = recentChat.length > 0 ? ` Last said: "${recentChat[0].detail?.slice(0, 50)}"` : '';
      lines.push(`${name} (${p.relationship}, sentiment:${Math.round(p.sentiment)})${isNearby ? ' [NEARBY]' : ''}${lastChat}`);
    }
  }
  return lines.length > 0 ? 'Known players:\n' + lines.join('\n') : '';
}

export function getRelationshipSummary() {
  const entries = Object.entries(players);
  if (entries.length === 0) return '';

  const now = Date.now();
  const lines = [];

  for (const [name, p] of entries) {
    const metAgo = formatTimeSince(now - new Date(p.first_met).getTime());
    const recentChat = p.interactions.filter(i => i.type === 'chat').slice(-1);
    const lastChat = recentChat.length > 0 ? ` Last chat: '${recentChat[0].detail?.slice(0, 50)}'.` : '';
    const notables = (p.notable_interactions || []).slice(-2)
      .map(n => `${n.type === 'gave_item' ? 'gave' : 'attacked'}: ${n.detail}`)
      .join(', ');
    const notableStr = notables ? ` Notable: ${notables}.` : '';
    lines.push(`${name}: ${p.relationship} (sentiment ${p.sentiment > 0 ? '+' : ''}${Math.round(p.sentiment * 10) / 10}), met ${metAgo}.${lastChat}${notableStr}`);
  }

  return lines.join(' ');
}

function formatTimeSince(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export function isKnownPlayer(name) {
  return !!players[name]
}

export function savePlayers() {
  try { writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2)); } catch {}
}
