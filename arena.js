#!/usr/bin/env node
/**
 * HermesCraft Arena Coordinator
 * 
 * Manages team battles between AI agents.
 * Coordinates bot servers, assigns teams, tracks scores, manages match lifecycle.
 * 
 * Usage:
 *   node arena.js                          # Interactive mode
 *   node arena.js --teams 5                # 5v5 match
 *   node arena.js --teams 10 --duration 15 # 10v10, 15 min match
 *   node arena.js --status                 # Check running match
 * 
 * Environment:
 *   MC_HOST          Minecraft server (default: localhost)
 *   MC_PORT          Minecraft server port (default: 25565)
 *   ARENA_PORT       Arena coordinator port (default: 3100)
 *   BASE_BOT_PORT    Starting port for bot servers (default: 3001)
 */

import http from 'http';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  mcHost: process.env.MC_HOST || 'localhost',
  mcPort: parseInt(process.env.MC_PORT || '25565'),
  arenaPort: parseInt(process.env.ARENA_PORT || '3100'),
  baseBotPort: parseInt(process.env.BASE_BOT_PORT || '3001'),
};

// Parse CLI args
let teamSize = 5;
let matchDuration = 15; // minutes
let scoreLimit = 50;
let showStatus = false;

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  const next = process.argv[i + 1];
  if ((arg === '--teams' || arg === '-t') && next) { teamSize = parseInt(next); i++; }
  if ((arg === '--duration' || arg === '-d') && next) { matchDuration = parseInt(next); i++; }
  if ((arg === '--score' || arg === '-s') && next) { scoreLimit = parseInt(next); i++; }
  if (arg === '--status') { showStatus = true; }
}

// ═══════════════════════════════════════════════════════════════
// Team Configuration
// ═══════════════════════════════════════════════════════════════

function generateTeams(size) {
  const roles = (n) => {
    const r = [];
    r.push('commander');
    const warriors = Math.floor(n * 0.4);
    const rangers = Math.floor(n * 0.3);
    const support = n - 1 - warriors - rangers;
    for (let i = 0; i < warriors; i++) r.push('warrior');
    for (let i = 0; i < rangers; i++) r.push('ranger');
    for (let i = 0; i < support; i++) r.push('support');
    return r;
  };

  const redRoles = roles(size);
  const blueRoles = roles(size);

  function namePlayer(team, roles, i) {
    const role = roles[i];
    const roleCount = roles.filter((r, j) => j <= i && r === role).length;
    const totalOfRole = roles.filter(r => r === role).length;
    const suffix = totalOfRole > 1 ? roleCount : '';
    return `${team}_${role}${suffix}`.replace(/\s/g, '');
  }

  const red = redRoles.map((role, i) => ({
    username: namePlayer('Red', redRoles, i),
    team: 'red',
    role,
    port: config.baseBotPort + i,
  }));

  const blue = blueRoles.map((role, i) => ({
    username: namePlayer('Blue', blueRoles, i),
    team: 'blue',
    role,
    port: config.baseBotPort + size + i,
  }));

  return { red, blue };
}

// ═══════════════════════════════════════════════════════════════
// Match State
// ═══════════════════════════════════════════════════════════════

let match = {
  status: 'idle', // idle, setup, pre_match, battle, post_match
  teams: null,
  scores: { red: 0, blue: 0 },
  kills: [], // [{ killer, victim, weapon, time }]
  startTime: null,
  endTime: null,
  duration: matchDuration,
  scoreLimit,
  botProcesses: [],
  agentProcesses: [],
};

const MATCH_HISTORY_FILE = path.join(__dirname, 'data', 'match_history.json');

function loadHistory() {
  try { return JSON.parse(fs.readFileSync(MATCH_HISTORY_FILE, 'utf8')); }
  catch { return []; }
}

function saveHistory(entry) {
  const dir = path.dirname(MATCH_HISTORY_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const history = loadHistory();
  history.push(entry);
  fs.writeFileSync(MATCH_HISTORY_FILE, JSON.stringify(history, null, 2));
}

// ═══════════════════════════════════════════════════════════════
// Bot Management
// ═══════════════════════════════════════════════════════════════

async function apiCall(port, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function startBotServer(player) {
  const env = {
    ...process.env,
    MC_HOST: config.mcHost,
    MC_PORT: config.mcPort.toString(),
    MC_USERNAME: player.username,
    MC_AUTH: 'offline',
    API_PORT: player.port.toString(),
    FAIR_PLAY: 'true',
  };

  const proc = spawn('node', [path.join(__dirname, 'bot', 'server.js')], {
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
  });

  proc.stdout.on('data', (data) => {
    const line = data.toString().trim();
    if (line) console.log(`  [${player.username}:${player.port}] ${line}`);
  });
  proc.stderr.on('data', (data) => {
    const line = data.toString().trim();
    if (line) console.error(`  [${player.username}:${player.port}] ERR: ${line}`);
  });

  match.botProcesses.push({ proc, player });
  
  // Wait for server to be ready
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const health = await apiCall(player.port, 'GET', '/health');
      if (health.ok) {
        console.log(`  ✓ ${player.username} connected on port ${player.port}`);
        return true;
      }
    } catch {}
  }
  console.error(`  ✗ ${player.username} failed to connect`);
  return false;
}

async function configureTeam(players, allPlayers) {
  for (const player of players) {
    const teammates = players
      .filter(p => p.username !== player.username)
      .map(p => p.username);

    try {
      await apiCall(player.port, 'POST', '/action/set_team', {
        team: player.team,
        role: player.role,
        teammates,
      });
    } catch (err) {
      console.error(`  Failed to configure ${player.username}: ${err.message}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Match Lifecycle
// ═══════════════════════════════════════════════════════════════

async function setupMatch() {
  match.status = 'setup';
  match.teams = generateTeams(teamSize);
  match.scores = { red: 0, blue: 0 };
  match.kills = [];
  match.startTime = null;
  
  const allPlayers = [...match.teams.red, ...match.teams.blue];
  console.log(`\n═══════════════════════════════════════`);
  console.log(`  HermesCraft Arena — ${teamSize}v${teamSize}`);
  console.log(`═══════════════════════════════════════`);
  console.log(`\nRED TEAM:`);
  match.teams.red.forEach(p => console.log(`  ${p.role.padEnd(12)} ${p.username} (port ${p.port})`));
  console.log(`\nBLUE TEAM:`);
  match.teams.blue.forEach(p => console.log(`  ${p.role.padEnd(12)} ${p.username} (port ${p.port})`));
  
  console.log(`\nStarting ${allPlayers.length} bot servers...`);
  
  // Start all bot servers
  const results = [];
  for (const player of allPlayers) {
    results.push(await startBotServer(player));
  }
  
  const connected = results.filter(r => r).length;
  console.log(`\n${connected}/${allPlayers.length} bots connected.`);
  
  if (connected < allPlayers.length * 0.5) {
    console.error('Too many bots failed to connect. Aborting.');
    await cleanup();
    return false;
  }
  
  // Configure teams
  console.log('\nConfiguring teams...');
  await configureTeam(match.teams.red, allPlayers);
  await configureTeam(match.teams.blue, allPlayers);
  
  match.status = 'pre_match';
  console.log('\n✓ Match ready! POST /start to begin battle phase.');
  return true;
}

async function startBattle() {
  match.status = 'battle';
  match.startTime = Date.now();
  match.endTime = Date.now() + match.duration * 60 * 1000;
  
  console.log(`\n⚔️  BATTLE STARTED! ${match.duration} minutes, first to ${match.scoreLimit} kills.`);
  
  // Announce to all bots
  const allPlayers = [...match.teams.red, ...match.teams.blue];
  for (const player of allPlayers) {
    try {
      await apiCall(player.port, 'POST', '/action/chat', {
        message: `⚔️ BATTLE STARTED! You are ${player.team.toUpperCase()} ${player.role}. Fight the enemy team!`
      });
    } catch {}
  }
  
  // Start score monitoring
  monitorMatch();
}

async function monitorMatch() {
  let monitoring = false;
  const checkInterval = setInterval(async () => {
    if (match.status !== 'battle') {
      clearInterval(checkInterval);
      return;
    }
    if (monitoring) return; // prevent overlapping checks
    monitoring = true;
    try {
    
    // Check time limit
    if (Date.now() > match.endTime) {
      console.log('\n⏱  TIME UP!');
      await endMatch('time');
      clearInterval(checkInterval);
      return;
    }
    
    // Check score limit
    if (match.scores.red >= match.scoreLimit || match.scores.blue >= match.scoreLimit) {
      const winner = match.scores.red >= match.scoreLimit ? 'RED' : 'BLUE';
      console.log(`\n🏆 ${winner} WINS by score limit!`);
      await endMatch('score');
      clearInterval(checkInterval);
      return;
    }
    
    // Poll stats from all bots
    const allPlayers = [...match.teams.red, ...match.teams.blue];
    for (const player of allPlayers) {
      try {
        const stats = await apiCall(player.port, 'GET', '/stats');
        if (stats.ok && stats.data) {
          // Stats are tracked per-bot; aggregate here if needed
        }
      } catch {}
    }
    } finally { monitoring = false; }
  }, 5000);
}

async function endMatch(reason) {
  match.status = 'post_match';
  
  const winner = match.scores.red > match.scores.blue ? 'RED' :
                 match.scores.blue > match.scores.red ? 'BLUE' : 'TIE';
  
  const result = {
    date: new Date().toISOString(),
    teamSize,
    duration: Math.round((Date.now() - match.startTime) / 1000),
    reason,
    winner,
    scores: match.scores,
    kills: match.kills,
  };
  
  console.log(`\n═══════════════════════════════════════`);
  console.log(`  MATCH OVER — ${winner === 'TIE' ? "IT'S A TIE!" : winner + ' WINS!'}`);
  console.log(`  RED: ${match.scores.red} | BLUE: ${match.scores.blue}`);
  console.log(`  Duration: ${Math.round(result.duration / 60)}m ${result.duration % 60}s`);
  console.log(`  Reason: ${reason}`);
  console.log(`═══════════════════════════════════════\n`);
  
  // Announce result to all bots
  const allPlayers = [...(match.teams?.red || []), ...(match.teams?.blue || [])];
  for (const player of allPlayers) {
    try {
      await apiCall(player.port, 'POST', '/action/chat', {
        message: `🏆 MATCH OVER! ${winner} wins! Red: ${match.scores.red} Blue: ${match.scores.blue}`
      });
    } catch {}
  }
  
  saveHistory(result);
}

async function cleanup() {
  console.log('\nCleaning up...');
  for (const { proc, player } of match.botProcesses) {
    try { proc.kill('SIGTERM'); } catch {}
    console.log(`  Stopped ${player.username}`);
  }
  for (const proc of match.agentProcesses) {
    try { proc.kill('SIGTERM'); } catch {}
  }
  match.botProcesses = [];
  match.agentProcesses = [];
  match.status = 'idle';
}

// ═══════════════════════════════════════════════════════════════
// HTTP API — Arena Control
// ═══════════════════════════════════════════════════════════════

function respond(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data, null, 2));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${config.arenaPort}`);
  const p = url.pathname;

  try {
    if (req.method === 'GET') {
      if (p === '/' || p === '/status') {
        return respond(res, 200, {
          status: match.status,
          teams: match.teams ? {
            red: match.teams.red.map(p => ({ username: p.username, role: p.role, port: p.port })),
            blue: match.teams.blue.map(p => ({ username: p.username, role: p.role, port: p.port })),
          } : null,
          scores: match.scores,
          elapsed: match.startTime ? Math.round((Date.now() - match.startTime) / 1000) + 's' : null,
          remaining: match.endTime ? Math.max(0, Math.round((match.endTime - Date.now()) / 1000)) + 's' : null,
          kills: match.kills.length,
          recentKills: match.kills.slice(-5),
        });
      }
      if (p === '/history') {
        return respond(res, 200, loadHistory().slice(-10));
      }
      if (p === '/scoreboard') {
        return respond(res, 200, {
          red: match.scores.red,
          blue: match.scores.blue,
          kills: match.kills,
        });
      }
    }

    if (req.method === 'POST') {
      let body = '';
      await new Promise((resolve) => {
        req.on('data', c => body += c);
        req.on('end', resolve);
      });
      const data = body ? JSON.parse(body) : {};

      if (p === '/setup') {
        if (data.teamSize) teamSize = data.teamSize;
        if (data.duration) matchDuration = data.duration;
        if (data.scoreLimit) scoreLimit = data.scoreLimit;
        match.duration = matchDuration;
        match.scoreLimit = scoreLimit;
        const ok = await setupMatch();
        return respond(res, ok ? 200 : 500, { ok, status: match.status });
      }

      if (p === '/start') {
        if (match.status !== 'pre_match') {
          return respond(res, 400, { error: `Can't start — status is ${match.status}. POST /setup first.` });
        }
        await startBattle();
        return respond(res, 200, { ok: true, status: 'battle', endTime: match.endTime });
      }

      if (p === '/kill') {
        // Record a kill (can be called by external observers or chat parser)
        const { killer, victim, weapon } = data;
        if (!killer || !victim) return respond(res, 400, { error: 'Need killer and victim' });
        
        const killerTeam = match.teams?.red.find(p => p.username === killer)?.team ||
                          match.teams?.blue.find(p => p.username === killer)?.team;
        
        if (killerTeam) {
          match.scores[killerTeam]++;
          match.kills.push({ killer, victim, weapon: weapon || 'unknown', time: Date.now() });
          console.log(`  ⚔️ ${killer} killed ${victim} (${weapon || '?'}) — Red: ${match.scores.red} Blue: ${match.scores.blue}`);
        }
        return respond(res, 200, { ok: true, scores: match.scores });
      }

      if (p === '/stop' || p === '/end') {
        if (match.status === 'battle') await endMatch('manual');
        await cleanup();
        return respond(res, 200, { ok: true, status: 'idle' });
      }
    }

    respond(res, 404, { error: 'Not found' });
  } catch (err) {
    respond(res, 500, { error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// Startup
// ═══════════════════════════════════════════════════════════════

if (showStatus) {
  // Just check status and exit
  http.get(`http://localhost:${config.arenaPort}/status`, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
      console.log(JSON.parse(data));
      process.exit(0);
    });
  }).on('error', () => {
    console.log('Arena coordinator not running.');
    process.exit(1);
  });
} else {
  server.listen(config.arenaPort, () => {
    console.log(`╔═══════════════════════════════════════╗`);
    console.log(`║    HermesCraft Arena Coordinator     ║`);
    console.log(`╠═══════════════════════════════════════╣`);
    console.log(`║  API:    http://localhost:${config.arenaPort}         ║`);
    console.log(`║  MC:     ${config.mcHost}:${config.mcPort}               ║`);
    console.log(`║  Teams:  ${teamSize}v${teamSize}                        ║`);
    console.log(`╚═══════════════════════════════════════╝`);
    console.log(`\nEndpoints:`);
    console.log(`  POST /setup       — Generate teams + start bot servers`);
    console.log(`  POST /start       — Begin battle phase`);
    console.log(`  POST /kill        — Record a kill {killer, victim, weapon}`);
    console.log(`  POST /stop        — End match + cleanup`);
    console.log(`  GET  /status      — Current match state`);
    console.log(`  GET  /scoreboard  — Scores + kill feed`);
    console.log(`  GET  /history     — Past matches\n`);
  });

  process.on('SIGINT', async () => {
    console.log('\nShutting down arena...');
    await cleanup();
    process.exit(0);
  });
}
