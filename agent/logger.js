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
  return `${GRAY}${new Date().toLocaleTimeString()}${RESET}`;
}

function healthBar(health, maxHealth = 20) {
  const hearts = Math.ceil(health / 2);
  const maxHearts = Math.ceil(maxHealth / 2);
  let color = GREEN;
  if (health <= 6) color = RED;
  else if (health <= 12) color = YELLOW;
  return `${color}${'♥'.repeat(hearts)}${DIM}${'♡'.repeat(Math.max(0, maxHearts - hearts))}${RESET}`;
}

function foodBar(food, maxFood = 20) {
  const drumsticks = Math.ceil(food / 2);
  const maxDrumsticks = Math.ceil(maxFood / 2);
  let color = GREEN;
  if (food <= 6) color = RED;
  else if (food <= 12) color = YELLOW;
  return `${color}${'🍖'.repeat(Math.min(drumsticks, 5))}${DIM}${'·'.repeat(Math.max(0, Math.min(maxDrumsticks, 5) - Math.min(drumsticks, 5)))}${RESET}`;
}

// ── Tick Separator ──

function logTickDivider() {
  console.log(`${GRAY}${'─'.repeat(70)}${RESET}`);
}

// ── Header with Health/Food Bars ──

export function logHeader(phase, state, { progress = 0, deathCount = 0, skillCount = 0, actionCount = 0 } = {}) {
  if (!state) return;
  const hp = state.health ?? 20;
  const fd = state.food ?? 20;
  const pos = state.position;
  const posStr = pos ? `${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)}` : '?';
  const dim = (state.dimension ?? 'overworld').replace('minecraft:', '');
  const time = state.time ?? 0;
  const timeIcon = typeof time === 'number' ? (time < 13000 ? '☀' : '☾') : '';

  logTickDivider();
  console.log(`  ${healthBar(hp)} ${GRAY}HP:${hp}${RESET}  ${foodBar(fd)} ${GRAY}Food:${fd}${RESET}  ${GRAY}${timeIcon} ${dim} (${posStr})${RESET}  ${deathCount > 0 ? `${RED}☠${deathCount}${RESET}` : ''}`);
}

// ── Reasoning (the star of the show for viewers) ──

export function logReasoning(text) {
  console.log('');
  console.log(`  ${CYAN}${BOLD}💭 Hermes:${RESET}`);
  // Word-wrap at ~85 chars for readability, indented
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.length <= 85) {
      console.log(`  ${GRAY}│${RESET} ${WHITE}${line}${RESET}`);
    } else {
      const words = line.split(' ');
      let current = '';
      for (const word of words) {
        if (current.length + word.length + 1 > 85) {
          console.log(`  ${GRAY}│${RESET} ${WHITE}${current}${RESET}`);
          current = word;
        } else {
          current = current ? `${current} ${word}` : word;
        }
      }
      if (current) console.log(`  ${GRAY}│${RESET} ${WHITE}${current}${RESET}`);
    }
  }
  console.log('');
}

// ── Action ──

export function logAction(action, mode = 'tool_call') {
  const type = action.type ?? action.action ?? 'unknown';
  const params = { ...action };
  delete params.type;
  delete params.action;
  delete params.reason;
  delete params.reasoning;
  const paramStr = Object.keys(params).length > 0 ? ` ${GRAY}${JSON.stringify(params)}${RESET}` : '';
  console.log(`  ${GREEN}${BOLD}▶ ${type}${RESET}${paramStr}`);
}

export function logActionResult(result) {
  if (result && result.success === false) {
    console.log(`  ${RED}✗ ${result.error || result.message || 'failed'}${RESET}`);
  } else if (result) {
    const msg = result.message || result.result || 'ok';
    console.log(`  ${DIM}${GREEN}✓ ${msg}${RESET}`);
  }
}

// ── Rich Death Banner ──

export function logDeathBanner(deathCount, deathRecord) {
  const w = 60;
  const line = '═'.repeat(w);
  const pad = (s, len = w) => s + ' '.repeat(Math.max(0, len - s.length));

  console.log(`\n${RED}${BOLD}╔${line}╗${RESET}`);
  console.log(`${RED}${BOLD}║${RESET}${BG_RED}${WHITE}${BOLD}${pad(`                     ☠ DEATH #${deathCount}`, w)}${RESET}${RED}${BOLD}║${RESET}`);
  console.log(`${RED}${BOLD}╠${line}╣${RESET}`);

  if (deathRecord) {
    const lines = [
      `Cause: ${deathRecord.cause || 'unknown'}`,
      `Phase: ${deathRecord.factors?.find(f => f.includes('phase'))?.replace('phase ', '') || 'unknown'}`,
      `Context: ${deathRecord.factors?.filter(f => !f.includes('phase')).join(', ') || 'none'}`,
      `Last actions: ${(deathRecord.lastActions || []).join(' → ')}`,
      '',
      `Lesson: ${deathRecord.lesson?.split('. ').slice(-1)[0] || 'unknown'}`,
    ];

    for (const l of lines) {
      console.log(`${RED}${BOLD}║${RESET}  ${RED}${pad(l, w - 2)}${RESET}${RED}${BOLD}║${RESET}`);
    }
  }

  console.log(`${RED}${BOLD}╚${line}╝${RESET}\n`);
}

// ── Skill Creation Banner ──

export function logSkillCreated(skillResult) {
  const verb = skillResult.updated ? '📖 SKILL UPDATED' : '🧠 NEW SKILL LEARNED';
  const color = skillResult.updated ? YELLOW : GREEN;
  console.log(`\n  ${color}${BOLD}${verb}: ${skillResult.name}${RESET}\n`);
}

// ── Phase Change ──

export function logPhaseChange(oldPhase, newPhase, isRegression = false) {
  if (isRegression) {
    console.log(`\n  ${BG_YELLOW}${WHITE}${BOLD}  PHASE RESET  ${RESET}`);
    console.log(`  ${YELLOW}${oldPhase} ${WHITE}→ ${RED}${newPhase}${RESET}\n`);
  } else {
    console.log(`\n  ${BG_GREEN}${WHITE}${BOLD}  ⬆ PHASE UP!  ${RESET}`);
    console.log(`  ${YELLOW}${oldPhase} ${WHITE}→ ${GREEN}${BOLD}${newPhase}${RESET}\n`);
  }
}

// ── Session Stats Line ──

export function logSessionStats(stats) {
  const parts = [
    `Session ${stats.sessionsPlayed}`,
    `☠${stats.totalDeaths}`,
    `Actions: ${stats.totalActions}`,
    `Phase ${stats.highestPhase}/7`,
    `${stats.uptimeMin}m`,
  ];
  console.log(`${GRAY}  ${parts.join('  │  ')}${RESET}`);
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
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║         HERMESCRAFT  AGENT           ║');
  console.log('  ║   God of Cunning Plays Minecraft     ║');
  console.log(`  ╠══════════════════════════════════════╣${RESET}`);
  console.log(`  ${MAGENTA}║${RESET}  Model: ${CYAN}${model}${RESET}`);
  console.log(`  ${MAGENTA}║${RESET}  Mode:  ${mode === 'Native Tool Calling' ? GREEN : YELLOW}${mode}${RESET}`);
  console.log(`  ${MAGENTA}║${RESET}  Session: ${WHITE}${session}${RESET}`);
  console.log(`  ${MAGENTA}║${RESET}  Memory: ${WHITE}${lessons} lessons, ${skills} skills${RESET}`);
  console.log(`  ${MAGENTA}║${RESET}  Goal: ${YELLOW}${goal}${RESET}`);
  console.log(`  ${MAGENTA}║${RESET}  Highest: ${GREEN}${highestPhase}${RESET}`);
  console.log(`  ${BOLD}${MAGENTA}╚══════════════════════════════════════╝${RESET}\n`);
}

// ── Standard Logging ──

export function logError(message, err) {
  console.log(`  ${RED}${BOLD}✗ ERROR:${RESET} ${RED}${message}${RESET}`);
  if (err && err.message) {
    console.log(`    ${DIM}${RED}${err.message}${RESET}`);
  }
}

export function logDeath(deathCount, message) {
  console.log(`\n  ${BG_RED}${WHITE}${BOLD}  ☠ DEATH #${deathCount}  ${RESET} ${RED}${message || 'You died!'}${RESET}\n`);
}

export function logInfo(message) {
  console.log(`  ${BLUE}${message}${RESET}`);
}

export function logWarn(message) {
  console.log(`  ${YELLOW}⚠ ${message}${RESET}`);
}

export function logStuck(action, count) {
  console.log(`  ${BG_YELLOW}${WHITE}${BOLD} STUCK ${RESET} ${YELLOW}"${action}" failed ${count}x — reassessing${RESET}`);
}
