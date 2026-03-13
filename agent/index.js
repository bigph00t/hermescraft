// index.js — HermesCraft main observe-think-act loop
// Integrates: native tool calling, multi-level memory, agentskills.io skills,
// configurable goals, rich terminal output, user instructions

import { fetchState, summarizeState, detectDeath } from './state.js';
import { queryLLM, clearConversation, getTemperature, isToolCallingEnabled } from './llm.js';
import { executeAction, validateAction } from './actions.js';
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

// Agent state
let deathCount = 0;
const actionHistory = [];
let currentPhase = null;
let running = true;
let tickCount = 0;

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

  // Check for death
  if (detectDeath(state)) {
    deathCount++;

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
    logPhaseChange(currentPhase.name, transition.to.name);

    // Record phase completion in memory
    recordPhaseComplete(currentPhase, state, actionHistory);

    // Create/update skill from successful phase completion
    const lessonsLearned = getRelevantLessons(currentPhase);
    const skillResult = createSkillFromPhase(currentPhase, actionHistory, deathCount, lessonsLearned);
    logSkillCreated(skillResult);

    // Update skill outcome (success)
    recordSkillOutcome(currentPhase, true);

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

  // Periodic stats line
  if (tickCount % STATS_LOG_INTERVAL === 0) {
    logSessionStats(getSessionStats());
    periodicSave();
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
    logInfo('Baritone pathing — waiting for completion');
    return;
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

  const systemPrompt = buildSystemPrompt(currentPhase, {
    deathCount,
    progress,
    progressDetail,
    goalName: getGoalName(),
    memoryText,
    skillIndex,
    activeSkill,
    sessionStats,
  });

  const stateSummary = summarizeState(state);
  const userMessage = buildUserMessage(stateSummary, actionHistory, {
    stuckInfo,
    userInstruction,
    activeSkill,
  });

  const temperature = getTemperature(currentPhase, state);

  let response;
  try {
    response = await queryLLM(systemPrompt, userMessage, { temperature });
  } catch (err) {
    logError('LLM query failed', err);
    return;
  }

  // Log reasoning (the star of the show for viewers)
  if (response.reasoning) {
    logReasoning(response.reasoning);
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

  let result;
  try {
    result = await executeAction(response.action);
  } catch (err) {
    logError('Action execution failed', err);
    const failCount = trackFailure(response.action);
    actionHistory.push({
      type: response.action.type || response.action.action,
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
    type: response.action.type || response.action.action,
    success,
    error: success ? null : (result?.error || result?.message || 'failed'),
    timestamp: Date.now(),
  });

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
    model: process.env.MODEL_NAME || 'Hermes 4.3 36B',
    toolCalling: isToolCallingEnabled(),
    session: stats.sessionsPlayed,
    lessons: memory.lessons.length,
    skills: skills.length,
    goal: getGoalName(),
    highestPhase: `${stats.highestPhaseName} (${stats.highestPhase}/7)`,
  });

  logInfo(`Tick interval: ${TICK_INTERVAL}ms`);
  logInfo(`vLLM URL: ${process.env.VLLM_URL || 'http://localhost:8000/v1'}`);
  logInfo(`Model: ${process.env.MODEL_NAME || 'solidrust/Hermes-3-Llama-3.1-8B-AWQ'}`);
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

  // Graceful shutdown
  process.on('SIGINT', () => {
    logInfo('Shutting down...');
    periodicSave();
    running = false;
  });
  process.on('SIGTERM', () => {
    logInfo('Shutting down...');
    periodicSave();
    running = false;
  });

  while (running) {
    try {
      await tick();
    } catch (err) {
      logError('Unexpected error in tick', err);
    }
    if (running) await sleep(TICK_INTERVAL);
  }

  periodicSave();
  const finalStats = getSessionStats();
  logInfo(`Session complete. Deaths: ${deathCount}. Actions: ${finalStats.totalActions}. Farewell, traveler.`);
}

main();
