// logger.js — Rich terminal output for HermesCraft agent
// Designed for livestream viewers — showcases AI thinking prominently

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';
const GRAY = '\x1b[90m';

const BG_RED = '\x1b[41m';
const BG_GREEN = '\x1b[42m';
const BG_YELLOW = '\x1b[43m';
const BG_BLUE = '\x1b[44m';
const BG_MAGENTA = '\x1b[45m';
const BG_CYAN = '\x1b[46m';

function timestamp() {
  return `${GRAY}[${new Date().toLocaleTimeString()}]${RESET}`;
}

function progressBar(value, max = 100, width = 20) {
  const filled = Math.round((value / max) * width);
  const empty = width - filled;
  let color = GREEN;
  if (value <= 25) color = RED;
  else if (value <= 50) color = YELLOW;
  return `${color}${'\u2588'.repeat(filled)}${DIM}${'\u2591'.repeat(empty)}${RESET}`;
}

function healthBar(health, maxHealth = 20) {
  const filled = Math.round((health / maxHealth) * 20);
  const empty = 20 - filled;
  let color = GREEN;
  if (health <= 6) color = RED;
  else if (health <= 12) color = YELLOW;
  return `${color}${'#'.repeat(filled)}${DIM}${'.'.repeat(empty)}${RESET} ${health}/${maxHealth}`;
}

function foodBar(food, maxFood = 20) {
  const filled = Math.round((food / maxFood) * 10);
  const empty = 10 - filled;
  let color = GREEN;
  if (food <= 6) color = RED;
  else if (food <= 12) color = YELLOW;
  return `${color}${'~'.repeat(filled)}${DIM}${'.'.repeat(empty)}${RESET} ${food}/${maxFood}`;
}

// ── Header with Progress Bar ──

export function logHeader(phase, state, { progress = 0, deathCount = 0, skillCount = 0, actionCount = 0 } = {}) {
  const line = '\u2550'.repeat(62);
  const phaseName = phase ? phase.name : 'Unknown';
  const pBar = progressBar(progress);

  console.log(`\n${BOLD}${MAGENTA}\u2554${line}\u2557${RESET}`);
  console.log(`${BOLD}${MAGENTA}\u2551${RESET}  ${BOLD}${WHITE}HERMES${RESET}  Phase: ${YELLOW}${phaseName}${RESET}  ${pBar} ${WHITE}${progress}%${RESET}  ${GRAY}Deaths: ${deathCount}${RESET}`);
  console.log(`${BOLD}${MAGENTA}\u255A${line}\u255D${RESET}`);

  if (state) {
    const hp = state.health ?? 20;
    const fd = state.food ?? 20;
    const pos = state.position;
    const posStr = pos ? `(${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)})` : '(?)';
    const dim = (state.dimension ?? 'overworld').replace('minecraft:', '');
    const time = state.time ?? '?';
    const timeLabel = typeof time === 'number' ? (time < 13000 ? 'day' : 'night') : '';

    console.log(`  ${WHITE}HP: ${healthBar(hp)}  Food: ${foodBar(fd)}${RESET}`);
    console.log(`  ${BLUE}Pos: ${posStr}  Dim: ${dim}  Time: ${time} ${timeLabel ? `(${timeLabel})` : ''}${RESET}`);

    if (state.inventory && state.inventory.length > 0) {
      const items = state.inventory
        .slice(0, 8)
        .map(i => `${(i.item || i.name || '?').replace('minecraft:','')}x${i.count}`)
        .join(', ');
      const more = state.inventory.length > 8 ? ` +${state.inventory.length - 8} more` : '';
      console.log(`  ${GRAY}Inv: ${items}${more}${RESET}`);
    }

    console.log(`  ${GRAY}Deaths: ${deathCount} | Actions: ${actionCount} | Skills: ${skillCount}${RESET}`);
  }
}

// ── Reasoning (the star of the show for viewers) ──

export function logReasoning(text) {
  console.log(`${timestamp()} ${CYAN}${BOLD}THINK:${RESET} ${CYAN}${text}${RESET}`);
}

// ── Action ──

export function logAction(action, mode = 'tool_call') {
  const type = action.type ?? action.action ?? 'unknown';
  const params = { ...action };
  delete params.type;
  delete params.action;
  const paramStr = Object.keys(params).length > 0 ? ` ${JSON.stringify(params)}` : '';
  const modeTag = mode === 'tool_call' ? `${DIM}${GREEN}[fn]${RESET}` : `${DIM}${YELLOW}[txt]${RESET}`;
  console.log(`${timestamp()} ${GREEN}${BOLD}ACT:${RESET} ${modeTag} ${GREEN}${type}${paramStr}${RESET}`);
}

export function logActionResult(result) {
  if (result && result.success === false) {
    console.log(`${timestamp()} ${RED}RESULT: ${result.error || result.message || 'action failed'}${RESET}`);
  } else if (result) {
    const msg = result.message || result.result || 'ok';
    console.log(`${timestamp()} ${DIM}${GREEN}RESULT: ${msg}${RESET}`);
  }
}

// ── Rich Death Banner ──

export function logDeathBanner(deathCount, deathRecord) {
  const w = 60;
  const line = '\u2550'.repeat(w);
  const pad = (s, len = w) => s + ' '.repeat(Math.max(0, len - s.length));

  console.log(`\n${RED}${BOLD}\u2554${line}\u2557${RESET}`);
  console.log(`${RED}${BOLD}\u2551${RESET}${BG_RED}${WHITE}${BOLD}${pad(`                     DEATH #${deathCount}`, w)}${RESET}${RED}${BOLD}\u2551${RESET}`);
  console.log(`${RED}${BOLD}\u2560${line}\u2563${RESET}`);

  if (deathRecord) {
    const lines = [
      `Cause: ${deathRecord.cause || 'unknown'}`,
      `Phase: ${deathRecord.factors?.find(f => f.includes('phase'))?.replace('phase ', '') || 'unknown'}`,
      `Context: ${deathRecord.factors?.filter(f => !f.includes('phase')).join(', ') || 'none'}`,
      `Last actions: ${(deathRecord.lastActions || []).join(' -> ')}`,
      '',
      `Lesson: ${deathRecord.lesson?.split('. ').slice(-1)[0] || 'unknown'}`,
    ];

    for (const l of lines) {
      console.log(`${RED}${BOLD}\u2551${RESET}  ${RED}${pad(l, w - 2)}${RESET}${RED}${BOLD}\u2551${RESET}`);
    }
  }

  console.log(`${RED}${BOLD}\u255A${line}\u255D${RESET}\n`);
}

// ── Skill Creation Banner ──

export function logSkillCreated(skillResult) {
  const w = 60;
  const line = '\u2550'.repeat(w);
  const pad = (s, len = w) => s + ' '.repeat(Math.max(0, len - s.length));

  const verb = skillResult.updated ? 'SKILL UPDATED' : 'NEW SKILL LEARNED';
  const color = skillResult.updated ? YELLOW : GREEN;

  console.log(`\n${color}${BOLD}\u2554${line}\u2557${RESET}`);
  console.log(`${color}${BOLD}\u2551${RESET}  ${color}${BOLD}${pad(verb + ': ' + skillResult.name, w - 2)}${RESET}${color}${BOLD}\u2551${RESET}`);
  console.log(`${color}${BOLD}\u255A${line}\u255D${RESET}\n`);
}

// ── Phase Change ──

export function logPhaseChange(oldPhase, newPhase) {
  console.log(`\n${timestamp()} ${BG_GREEN}${WHITE}${BOLD}  PHASE UP!  ${RESET}`);
  console.log(`  ${YELLOW}${oldPhase} ${WHITE}-> ${GREEN}${BOLD}${newPhase}${RESET}\n`);
}

// ── Session Stats Line ──

export function logSessionStats(stats) {
  const parts = [
    `Session: ${stats.sessionsPlayed}`,
    `Deaths: ${stats.totalDeaths}`,
    `Actions: ${stats.totalActions}`,
    `Phase: ${stats.highestPhase}/7`,
    `Skills: ${stats.lessonsCount || 0}`,
    `${stats.uptimeMin}m`,
  ];
  console.log(`${GRAY}\u2500\u2500\u2500 ${parts.join(' \u2502 ')} \u2500\u2500\u2500${RESET}`);
}

// ── Startup Banner ──

export function logStartupBanner(config) {
  const model = config.model || 'Hermes';
  const mode = config.toolCalling ? 'Native Tool Calling' : 'Text Fallback';
  const session = config.session || 1;
  const lessons = config.lessons || 0;
  const skills = config.skills || 0;
  const goal = config.goal || 'Defeat the Ender Dragon';
  const highestPhase = config.highestPhase || 'First Night (1/7)';

  console.log(`\n${BOLD}${MAGENTA}`);
  console.log('  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('  \u2551         HERMESCRAFT  AGENT           \u2551');
  console.log('  \u2551   God of Cunning Plays Minecraft     \u2551');
  console.log(`  \u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563${RESET}`);
  console.log(`  ${MAGENTA}\u2551${RESET}  Model: ${CYAN}${model}${RESET}`);
  console.log(`  ${MAGENTA}\u2551${RESET}  Mode:  ${mode === 'Native Tool Calling' ? GREEN : YELLOW}${mode}${RESET}`);
  console.log(`  ${MAGENTA}\u2551${RESET}  Session: ${WHITE}${session}${RESET}`);
  console.log(`  ${MAGENTA}\u2551${RESET}  Memory: ${WHITE}${lessons} lessons, ${skills} skills${RESET}`);
  console.log(`  ${MAGENTA}\u2551${RESET}  Goal: ${YELLOW}${goal}${RESET}`);
  console.log(`  ${MAGENTA}\u2551${RESET}  Highest: ${GREEN}${highestPhase}${RESET}`);
  console.log(`  ${BOLD}${MAGENTA}\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D${RESET}\n`);
}

// ── Standard Logging ──

export function logError(message, err) {
  console.log(`${timestamp()} ${RED}${BOLD}ERROR:${RESET} ${RED}${message}${RESET}`);
  if (err && err.message) {
    console.log(`  ${DIM}${RED}${err.message}${RESET}`);
  }
}

export function logDeath(deathCount, message) {
  // Simple one-liner for backward compat — logDeathBanner is the rich version
  console.log(`\n${timestamp()} ${BG_RED}${WHITE}${BOLD}  DEATH #${deathCount}  ${RESET} ${RED}${message || 'You died!'}${RESET}\n`);
}

export function logInfo(message) {
  console.log(`${timestamp()} ${BLUE}${message}${RESET}`);
}

export function logWarn(message) {
  console.log(`${timestamp()} ${YELLOW}WARN: ${message}${RESET}`);
}

export function logStuck(action, count) {
  console.log(`${timestamp()} ${BG_YELLOW}${WHITE}${BOLD} STUCK ${RESET} ${YELLOW}Action "${action}" failed ${count}x \u2014 forcing reassessment${RESET}`);
}
