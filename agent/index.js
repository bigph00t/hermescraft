// index.js — HermesCraft main observe-think-act loop
// Integrates: native tool calling, multi-level memory, agentskills.io skills,
// configurable goals, rich terminal output, user instructions

import { fetchState, summarizeState, detectDeath } from './state.js';
import { queryLLM, clearConversation, getTemperature, isToolCallingEnabled } from './llm.js';
import { executeAction, validateAction, INFO_ACTIONS } from './actions.js';
import { fetchRecipes } from './state.js';
import {
  getCurrentPhase, checkPhaseTransition, getPhaseProgress,
  getProgressDetail, getGoalName, setGoal, isCustomGoal,
} from './goals.js';
import { buildSystemPrompt, buildUserMessage } from './prompt.js';
import {
  loadMemory, saveMemory, recordDeath as memRecordDeath,
  recordPhaseComplete, recordAction, getRelevantLessons,
  getMemoryForPrompt, getSessionStats, getStats, getMemory,
  readInstructions, writeSessionEntry, periodicSave,
} from './memory.js';
import {
  loadSkills, getSkillIndex, getActiveSkill,
  createSkillFromPhase, recordSkillOutcome, getSkillCount,
} from './skills.js';
import {
  logHeader, logReasoning, logAction, logActionResult,
  logError, logDeathBanner, logPhaseChange, logInfo, logWarn,
  logStuck, logSkillCreated, logSessionStats, logStartupBanner,
} from './logger.js';

const TICK_INTERVAL = parseInt(process.env.TICK_MS || '3000', 10);
const MAX_STUCK_COUNT = 3;
const STATS_LOG_INTERVAL = 20;  // Log stats every 20 ticks (~60s)
const DEATH_COOLDOWN_TICKS = 5; // Ignore death detection for N ticks after a death
const FAILURE_TRACKER_MAX = 50; // Max entries before pruning

// ── Global crash handlers — CRITICAL for 24/7 operation ──
process.on('unhandledRejection', (err) => {
  logError('Unhandled promise rejection (non-fatal)', err instanceof Error ? err : new Error(String(err)));
});
process.on('uncaughtException', (err) => {
  logError('Uncaught exception', err);
  // Save state and attempt to continue — only exit on truly unrecoverable errors
  try { periodicSave(); } catch {}
  // Don't exit — let the loop continue if possible
});

// Agent state
let deathCount = 0;
const actionHistory = [];
let currentPhase = null;
let running = true;
let tickCount = 0;
let lastDeathTick = -999; // For death cooldown
let currentTickPromise = null; // For graceful shutdown
let pathingTickCount = 0; // Baritone pathing timeout counter
const MAX_PATHING_TICKS = 60; // Auto-stop Baritone after ~3 minutes

// Stuck detection
const failureTracker = new Map();

function getActionKey(action) {
  if (!action) return 'null';
  const type = action.type || action.action || 'unknown';
  if (action.x !== undefined) return `${type}@${action.x},${action.y},${action.z}`;
  if (action.item) return `${type}:${action.item}`;
  if (action.target) return `${type}:${action.target}`;
  if (action.blockName) return `${type}:${action.blockName}`;
  return type;
}

function trackFailure(action) {
  const key = getActionKey(action);
  const count = (failureTracker.get(key) || 0) + 1;
  failureTracker.set(key, count);
  return count;
}

function clearFailures(action) {
  const key = getActionKey(action);
  failureTracker.delete(key);
}

function getStuckInfo() {
  for (const [key, count] of failureTracker) {
    if (count >= MAX_STUCK_COUNT) {
      return { action: key, count };
    }
  }
  return null;
}

function clearAllFailures() {
  failureTracker.clear();
}

function pruneFailureTracker() {
  // Prevent unbounded growth — remove lowest-count entries if too large
  if (failureTracker.size > FAILURE_TRACKER_MAX) {
    const entries = [...failureTracker.entries()].sort((a, b) => a[1] - b[1]);
    const toRemove = entries.slice(0, entries.length - FAILURE_TRACKER_MAX / 2);
    for (const [key] of toRemove) {
      failureTracker.delete(key);
    }
  }
}

// ── Info Action Handlers (recipes, wiki) ──

async function handleRecipesLookup(item) {
  try {
    const data = await fetchRecipes(item);
    if (!data || !data.recipes || data.recipes.length === 0) {
      return `No recipe found for "${item}". Check the item ID — use exact names from your inventory.`;
    }
    const lines = [`Recipes for ${data.item} (${data.count} found):`];
    for (const recipe of data.recipes.slice(0, 3)) {
      const ingredients = recipe.ingredients
        ? recipe.ingredients.map(i => i.item || i).join(', ')
        : JSON.stringify(recipe);
      lines.push(`  ${ingredients}`);
    }
    return lines.join('\n');
  } catch (err) {
    return `Recipe lookup failed: ${err.message}`;
  }
}

async function handleWikiLookup(query) {
  // Convert query to wiki page title format
  const title = query.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('_');
  try {
    const url = `https://minecraft.wiki/api.php?action=query&prop=extracts&titles=${encodeURIComponent(title)}&exintro=true&explaintext=true&exchars=600&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return `Wiki lookup failed: HTTP ${res.status}`;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return `No wiki results for "${query}"`;
    const page = Object.values(pages)[0];
    if (page.missing !== undefined) {
      // Try search instead
      const searchUrl = `https://minecraft.wiki/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=3&format=json`;
      const searchRes = await fetch(searchUrl, { signal: AbortSignal.timeout(5000) });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData[1] && searchData[1].length > 0) {
          return `No exact page for "${query}". Did you mean: ${searchData[1].join(', ')}?`;
        }
      }
      return `No wiki page found for "${query}"`;
    }
    return `${page.title}: ${page.extract || 'No summary available.'}`;
  } catch (err) {
    return `Wiki lookup failed: ${err.message}`;
  }
}

// ── Notepad (persistent plan) ──

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname_idx = dirname(fileURLToPath(import.meta.url));
const NOTEPAD_FILE = join(__dirname_idx, 'data', 'notepad.txt');

function readNotepad() {
  try {
    if (!existsSync(join(__dirname_idx, 'data'))) mkdirSync(join(__dirname_idx, 'data'), { recursive: true });
    if (existsSync(NOTEPAD_FILE)) return readFileSync(NOTEPAD_FILE, 'utf-8');
  } catch {}
  return '';
}

function writeNotepad(content) {
  try {
    if (!existsSync(join(__dirname_idx, 'data'))) mkdirSync(join(__dirname_idx, 'data'), { recursive: true });
    writeFileSync(NOTEPAD_FILE, content, 'utf-8');
  } catch {}
}

function handleNotepad(action, content) {
  if (action === 'read') {
    const text = readNotepad();
    return text || '(notepad is empty)';
  } else if (action === 'write') {
    writeNotepad(content || '');
    return `Notepad updated (${(content || '').length} chars)`;
  }
  return 'Invalid notepad action. Use read or write.';
}

// ── Baritone Overlay Removal ──

async function disableBaritoneOverlays() {
  const settings = [
    '#set renderPath false',
    '#set renderGoal false',
    '#set renderSelectionBoxes false',
    '#set renderGoalXZ false',
    '#set renderGoalAnimated false',
  ];
  for (const cmd of settings) {
    try {
      await executeAction({ type: 'chat', message: cmd });
      await sleep(200);
    } catch {}
  }
  logInfo('Baritone overlays disabled');
}

// ── Main Tick ──

async function tick() {
  tickCount++;

  // 1. OBSERVE — fetch game state
  let state;
  try {
    state = await fetchState();
  } catch (err) {
    logError('Failed to fetch game state', err);
    return;
  }

  // Check for death (with cooldown to prevent infinite re-detection)
  if (detectDeath(state) && (tickCount - lastDeathTick) > DEATH_COOLDOWN_TICKS) {
    deathCount++;
    lastDeathTick = tickCount;

    // Rich death analysis via memory system
    const phase = currentPhase || getCurrentPhase(state);
    const { progress } = getPhaseProgress(state);
    const deathRecord = memRecordDeath(state, actionHistory, phase, progress);

    // Update skill outcome (failure)
    recordSkillOutcome(phase, false);

    // Rich death banner for stream viewers
    logDeathBanner(deathCount, deathRecord);

    // Clear conversation — fresh start after death
    clearConversation();
    clearAllFailures();

    // Write session log
    writeSessionEntry({
      type: 'death_processed',
      timestamp: new Date().toISOString(),
      deathCount,
      lesson: deathRecord.lesson,
    });

    await sleep(5000);
    return;
  }

  // Determine phase
  const phase = getCurrentPhase(state);
  if (!currentPhase) {
    currentPhase = phase;
  }

  // Check phase transition
  const transition = checkPhaseTransition(currentPhase, state);
  if (transition.transitioned) {
    // Only log "PHASE UP" if actually progressing forward
    if (transition.to.id > currentPhase.id) {
      logPhaseChange(currentPhase.name, transition.to.name);

      // Record phase completion in memory
      recordPhaseComplete(currentPhase, state, actionHistory);

      // Create/update skill from successful phase completion
      const lessonsLearned = getRelevantLessons(currentPhase);
      const skillResult = createSkillFromPhase(currentPhase, actionHistory, deathCount, lessonsLearned);
      logSkillCreated(skillResult);

      // Update skill outcome (success)
      recordSkillOutcome(currentPhase, true);
    } else {
      // Phase regression (e.g. died and lost items) — just note it
      logInfo(`Phase regressed: ${currentPhase.name} -> ${transition.to.name} (lost items)`);
    }

    currentPhase = transition.to;
    clearAllFailures();
    clearConversation();  // Fresh context for new phase
  }

  const { progress } = getPhaseProgress(state);
  const progressDetail = getProgressDetail(phase, state);

  // Log header with progress
  logHeader(currentPhase, state, {
    progress,
    deathCount,
    skillCount: getSkillCount(),
    actionCount: getStats().totalActions,
  });

  // Periodic stats + failure tracker cleanup
  if (tickCount % STATS_LOG_INTERVAL === 0) {
    logSessionStats(getSessionStats());
    periodicSave();
    pruneFailureTracker();
  }

  // Read user instructions
  const userInstruction = readInstructions();
  if (userInstruction) {
    logInfo(`User instruction received: ${userInstruction}`);

    // Check for goal change
    if (userInstruction.toUpperCase().startsWith('GOAL:')) {
      setGoal(userInstruction);
      logInfo(`Goal changed to: ${getGoalName()}`);
    }
  }

  // Skip LLM if Baritone is actively working and we're not in danger
  if (state.isPathing && state.health > 6 && state.food > 3) {
    pathingTickCount++;
    if (pathingTickCount >= MAX_PATHING_TICKS) {
      logWarn(`Baritone stuck for ${pathingTickCount} ticks (~${Math.round(pathingTickCount * TICK_INTERVAL / 1000 / 60)}min) — forcing stop`);
      try { await executeAction({ type: 'stop' }); } catch {}
      pathingTickCount = 0;
    } else {
      logInfo(`Baritone pathing — waiting (${pathingTickCount}/${MAX_PATHING_TICKS})`);
      return;
    }
  } else {
    pathingTickCount = 0;
  }

  // 2. THINK — build prompt and query LLM
  const stuckInfo = getStuckInfo();
  if (stuckInfo) {
    logStuck(stuckInfo.action, stuckInfo.count);
    failureTracker.delete(stuckInfo.action);
  }

  // Build prompts with full Hermes ecosystem context
  const memoryText = getMemoryForPrompt();
  const skillIndex = getSkillIndex();
  const activeSkill = getActiveSkill(currentPhase);
  const sessionStats = getSessionStats();

  const notepadContent = readNotepad();

  const systemPrompt = buildSystemPrompt(currentPhase, {
    deathCount,
    goalName: getGoalName(),
    memoryText,
    notepadContent,
  });

  const stateSummary = summarizeState(state);
  const userMessage = buildUserMessage(stateSummary, actionHistory, {
    stuckInfo,
    userInstruction,
    notepadContent,
  });

  const temperature = getTemperature(currentPhase, state);

  let response;
  try {
    response = await queryLLM(systemPrompt, userMessage, { temperature });
  } catch (err) {
    logError('LLM query failed', err);
    return;
  }

  // Log reasoning — the star of the show for viewers
  let displayReasoning = response.reasoning || '';
  if (!displayReasoning && response.raw && typeof response.raw === 'string') {
    displayReasoning = response.raw.slice(0, 800);
  }
  // Strip any remaining <think> tags for clean display
  displayReasoning = displayReasoning.replace(/<\/?think>/g, '').trim();
  if (displayReasoning) {
    logReasoning(displayReasoning);
  }

  // 3. ACT — execute the action
  if (!response.action) {
    logWarn('No action parsed from LLM response');
    if (response.raw) {
      logInfo(`Raw: ${typeof response.raw === 'string' ? response.raw.slice(0, 200) : JSON.stringify(response.raw).slice(0, 200)}`);
    }
    return;
  }

  const validation = validateAction(response.action);
  if (!validation.valid) {
    logError(`Invalid action: ${validation.error}`);
    return;
  }

  logAction(response.action, response.mode);
  recordAction();

  const actionType = response.action.type || response.action.action;

  // Handle info actions (recipes, wiki) — return data to LLM, no game state change
  if (INFO_ACTIONS.has(actionType)) {
    let infoResult;
    if (actionType === 'notepad') {
      infoResult = handleNotepad(response.action.action, response.action.content);
      if (response.action.action === 'write') {
        logInfo(`[notepad] Plan updated`);
      }
    } else if (actionType === 'recipes') {
      infoResult = await handleRecipesLookup(response.action.item);
    } else if (actionType === 'wiki') {
      infoResult = await handleWikiLookup(response.action.query);
    }
    logInfo(`[${actionType}] ${infoResult}`);
    actionHistory.push({
      type: actionType,
      success: true,
      info: infoResult,
      timestamp: Date.now(),
    });
    return;
  }

  let result;
  try {
    result = await executeAction(response.action);
  } catch (err) {
    logError('Action execution failed', err);
    trackFailure(response.action);
    actionHistory.push({
      type: actionType,
      success: false,
      error: err.message,
      timestamp: Date.now(),
    });
    return;
  }

  logActionResult(result);

  // Track result
  const success = result && result.success !== false;
  actionHistory.push({
    type: actionType,
    success,
    error: success ? null : (result?.error || result?.message || 'failed'),
    timestamp: Date.now(),
  });

  // Auto-close crafting screen on craft/smelt failure to prevent items stuck in grid
  if (!success && (actionType === 'craft' || actionType === 'smelt')) {
    try { await executeAction({ type: 'close_screen' }); } catch {}
  }

  // Keep history bounded
  if (actionHistory.length > 50) {
    actionHistory.splice(0, actionHistory.length - 50);
  }

  // Track failures for stuck detection
  if (success) {
    clearFailures(response.action);
  } else {
    trackFailure(response.action);
  }

  // Write to session log
  writeSessionEntry({
    type: 'tick',
    timestamp: new Date().toISOString(),
    tickCount,
    reasoning: response.reasoning?.slice(0, 200),
    action: response.action,
    success,
    mode: response.mode,
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  // Load persistent state
  const { memory, stats } = loadMemory();
  const skills = loadSkills();

  // Startup banner
  logStartupBanner({
    model: process.env.MODEL_NAME || 'Doradus/Hermes-4.3-36B-FP8',
    toolCalling: isToolCallingEnabled(),
    session: stats.sessionsPlayed,
    lessons: memory.lessons.length,
    skills: skills.length,
    goal: getGoalName(),
    highestPhase: `${stats.highestPhaseName} (${stats.highestPhase}/7)`,
  });

  logInfo(`Tick interval: ${TICK_INTERVAL}ms`);
  logInfo(`vLLM URL: ${process.env.VLLM_URL || 'http://localhost:8000/v1'}`);
  logInfo(`Model: ${process.env.MODEL_NAME || 'Doradus/Hermes-4.3-36B-FP8'}`);
  logInfo(`Mod API: ${process.env.MOD_URL || 'http://localhost:3001'}`);
  logInfo(`Memory: ${memory.lessons.length} lessons, ${memory.strategies.length} strategies`);
  logInfo(`Skills: ${skills.length} loaded`);
  logInfo('Starting observe-think-act loop...\n');

  // Disable Baritone overlays for clean stream visuals
  try {
    await disableBaritoneOverlays();
  } catch (err) {
    logWarn(`Could not disable Baritone overlays: ${err.message}`);
  }

  // Graceful shutdown — wait for current tick to finish
  const shutdown = async () => {
    logInfo('Shutting down...');
    running = false;
    // Wait for in-flight tick to finish (max 15s)
    if (currentTickPromise) {
      try {
        await Promise.race([currentTickPromise, sleep(15000)]);
      } catch {}
    }
    periodicSave();
    const finalStats = getSessionStats();
    logInfo(`Session complete. Deaths: ${deathCount}. Actions: ${finalStats.totalActions}. Farewell, traveler.`);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  while (running) {
    try {
      currentTickPromise = tick();
      await currentTickPromise;
      currentTickPromise = null;
    } catch (err) {
      logError('Unexpected error in tick', err);
      currentTickPromise = null;
    }
    if (running) await sleep(TICK_INTERVAL);
  }
}

main();
