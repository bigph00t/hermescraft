// index.js — HermesCraft main observe-think-act loop
// Integrates: native tool calling, multi-level memory, agentskills.io skills,
// configurable goals, rich terminal output, user instructions

import { fetchState, summarizeState, detectDeath, setNavigating } from './state.js';
import { queryLLM, clearConversation, getTemperature, isToolCallingEnabled, completeToolCall } from './llm.js';
import { executeAction, validateAction, validatePreExecution, INFO_ACTIONS } from './actions.js';
import { fetchRecipes } from './state.js';
import { loadAgentConfig } from './config.js';
import {
  initGoalSystem, getAgentMode,
  getCurrentPhase, checkPhaseTransition, getPhaseProgress,
  getProgressDetail, getGoalName, setGoal, isCustomGoal,
} from './goals.js';
import { buildSystemPrompt, buildUserMessage, loadPinnedContext } from './prompt.js';
import {
  initMemory, loadMemory, saveMemory, recordDeath as memRecordDeath,
  recordPhaseComplete, recordAction, getRelevantLessons,
  getMemoryForPrompt, getSessionStats, getStats, getMemory,
  readInstructions, writeSessionEntry, periodicSave,
} from './memory.js';
import {
  initSkills, loadSkills, getSkillIndex, getActiveSkill,
  createSkillFromPhase, recordSkillOutcome, getSkillCount,
} from './skills.js';
import {
  logHeader, logReasoning, logAction, logActionResult,
  logError, logDeathBanner, logPhaseChange, logInfo, logWarn,
  logStuck, logSkillCreated, logSessionStats, logStartupBanner,
} from './logger.js';
import { initSocial, trackPlayer, getPlayersForPrompt, savePlayers } from './social.js';
import { initLocations, autoDetectLocations, getLocationsForPrompt, saveLocations } from './locations.js';
import { startVisionLoop, stopVisionLoop, getVisionContext } from './vision.js';
import { startPlannerLoop, stopPlannerLoop, getPlanContext } from './planner.js';
import { startBuild, resumeBuild, getBuildProgress, cancelBuild, isBuildActive, unpauseBuild } from './builder.js';
import { startFarm, resumeFarm, getFarmProgress, cancelFarm, isFarmActive, startHarvest } from './farming.js';

const TICK_INTERVAL = parseInt(process.env.TICK_MS || '2000', 10);
const MAX_STUCK_COUNT = 2;
const STATS_LOG_INTERVAL = 20;  // Log stats every 20 ticks (~60s)
const DEATH_COOLDOWN_TICKS = 5; // Ignore death detection for N ticks after a death
const FAILURE_TRACKER_MAX = 50; // Max entries before pruning

// Chat dedup: track messages we've already seen so we don't respond twice
let lastProcessedMessages = new Set()

// Sustained actions that take multiple seconds — pipeline thinking during these
const SUSTAINED_ACTIONS = new Set(['mine', 'navigate', 'break_block', 'build', 'farm', 'harvest']);

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

// Agent config (set in main, used in tick)
let _agentConfig = null;

// Agent state
let deathCount = 0;
const actionHistory = [];
let currentPhase = null;
let running = true;
let tickCount = 0;
let lastDeathTick = -999; // For death cooldown
let currentTickPromise = null; // For graceful shutdown
let lastPosition = null; // For position-based stuck detection
let samePositionTicks = 0;

// Subtask review: tracks a subtask that was just marked "done" and needs outcome verification next tick
let pendingReview = null; // { index, expected_outcome, reviewTick }

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

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname_idx = dirname(fileURLToPath(import.meta.url));

// ── Building Knowledge (loaded once at startup) ──

function loadBuildingKnowledge() {
  const knowledgePath = join(__dirname_idx, 'knowledge', 'building.md')
  try {
    if (existsSync(knowledgePath)) return readFileSync(knowledgePath, 'utf-8')
  } catch {}
  return ''
}

function loadFoodKnowledge() {
  const knowledgePath = join(__dirname_idx, 'knowledge', 'food.md')
  try {
    if (existsSync(knowledgePath)) return readFileSync(knowledgePath, 'utf-8')
  } catch {}
  return ''
}

let NOTEPAD_FILE = join(__dirname_idx, 'data', 'notepad.txt');

// ── Task Plan State ──
// Persists to dataDir/tasks.json. Loaded each tick for prompt injection.

let TASKS_FILE = join(__dirname_idx, 'data', 'tasks.json')

function loadTaskState() {
  try {
    if (existsSync(TASKS_FILE)) {
      const raw = readFileSync(TASKS_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed.goal === 'string' && Array.isArray(parsed.subtasks)) {
        return parsed
      }
    }
  } catch {}
  return null
}

function saveTaskState(taskState) {
  try {
    const dir = dirname(TASKS_FILE)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(TASKS_FILE, JSON.stringify(taskState, null, 2), 'utf-8')
  } catch {}
}

function handlePlanTask(goal, subtasks) {
  if (!subtasks || subtasks.length === 0) {
    return 'Plan must have at least one subtask'
  }
  if (subtasks.length > 20) {
    return 'Too many subtasks (max 20). Break into smaller plans.'
  }
  const taskState = {
    goal,
    createdAt: new Date().toISOString(),
    subtasks: subtasks.map((text, i) => ({
      index: i,
      text,
      status: i === 0 ? 'in-progress' : 'pending',
      note: '',
    })),
  }
  saveTaskState(taskState)
  const summary = taskState.subtasks.map((s, i) =>
    `  ${i}. [${s.status === 'in-progress' ? '>' : ' '}] ${s.text}`
  ).join('\n')
  return `Plan created: "${goal}" with ${subtasks.length} subtasks\n${summary}`
}

function handleUpdateTask(index, status, note, expected_outcome) {
  const taskState = loadTaskState()
  if (!taskState) {
    return 'No active plan. Use plan_task first.'
  }
  if (index < 0 || index >= taskState.subtasks.length) {
    return `Invalid index ${index}. Plan has ${taskState.subtasks.length} subtasks (0-${taskState.subtasks.length - 1}).`
  }
  const validStatuses = ['done', 'failed', 'in-progress', 'blocked']
  if (!validStatuses.includes(status)) {
    return `Invalid status "${status}". Use: ${validStatuses.join(', ')}`
  }

  const subtask = taskState.subtasks[index]
  if (note) subtask.note = note

  if (status === 'done' && expected_outcome) {
    // Defer actual done marking — queue a review for next tick
    subtask.status = 'reviewing'
    subtask.expected_outcome = expected_outcome
    subtask.retry_count = subtask.retry_count || 0
    subtask.max_retries = 2
    pendingReview = { index, expected_outcome, reviewTick: tickCount + 1 }
    saveTaskState(taskState)
    return `Subtask ${index} marked for review. Will verify: ${expected_outcome}`
  } else if (status === 'done') {
    // Immediate done (no expected_outcome) — keep original behavior
    subtask.status = 'done'
    // Auto-advance: if marking done and next subtask is pending, set it to in-progress
    const nextPending = taskState.subtasks.find(s => s.status === 'pending')
    if (nextPending) {
      nextPending.status = 'in-progress'
    }
  } else if (status === 'failed') {
    // Retry tracking: increment retry_count, block if max exceeded
    subtask.retry_count = (subtask.retry_count || 0) + 1
    subtask.max_retries = subtask.max_retries || 2
    if (subtask.retry_count >= subtask.max_retries) {
      subtask.status = 'blocked'
      // Auto-advance to next pending subtask after blocking
      const nextPending = taskState.subtasks.find(s => s.status === 'pending')
      if (nextPending) {
        nextPending.status = 'in-progress'
      }
    } else {
      subtask.status = 'in-progress' // retry
    }
  } else {
    subtask.status = status
  }

  saveTaskState(taskState)

  const done = taskState.subtasks.filter(s => s.status === 'done').length
  const total = taskState.subtasks.length
  return `Updated subtask ${index} to ${subtask.status}. Progress: ${done}/${total} done.`
}

// ── Subtask Outcome Review ──
// Called at the start of each tick to check if a pending review is due.
// Compares game state against expected_outcome keywords and marks pass/fail.

function reviewSubtaskOutcome(state) {
  if (!pendingReview) return null
  if (tickCount < pendingReview.reviewTick) return null

  const taskState = loadTaskState()
  if (!taskState) {
    pendingReview = null
    return null
  }

  const subtask = taskState.subtasks[pendingReview.index]
  if (!subtask || subtask.status !== 'reviewing') {
    pendingReview = null
    return null
  }

  const expected = pendingReview.expected_outcome.toLowerCase()
  let passed = true
  let actual = 'unknown'

  // Keyword-based checks against game state
  // Check inventory items (e.g. "have wooden_pickaxe", "wooden_pickaxe in inventory")
  const itemMatch = expected.match(/(?:have\s+|have a\s+|in inventory[:\s]+)?([a-z_]+(?:_[a-z]+)*)\s*(?:in inventory|in hand)?/)
  if (itemMatch && state.inventory && (expected.includes('have ') || expected.includes('inventory') || expected.includes('in hand'))) {
    const itemName = itemMatch[1]
    const found = state.inventory.some(i => i.item && i.item.toLowerCase().includes(itemName))
    if (!found) {
      passed = false
      actual = `inventory does not contain ${itemName} (have: ${state.inventory.map(i => i.item).filter(Boolean).join(', ') || 'nothing'})`
    }
  }

  // Check position (e.g. "be at X,Y,Z" or "at -120,64,30")
  const coordMatch = expected.match(/(?:be at|at|near|position)\s*(-?\d+)[,\s]+(-?\d+)[,\s]+(-?\d+)/)
  if (coordMatch && state.position) {
    const tx = parseInt(coordMatch[1]), ty = parseInt(coordMatch[2]), tz = parseInt(coordMatch[3])
    const dx = Math.abs(state.position.x - tx)
    const dy = Math.abs(state.position.y - ty)
    const dz = Math.abs(state.position.z - tz)
    if (dx > 5 || dy > 5 || dz > 5) {
      passed = false
      actual = `position (${Math.round(state.position.x)},${Math.round(state.position.y)},${Math.round(state.position.z)}) is more than 5 blocks from target (${tx},${ty},${tz})`
    }
  }

  // Check health (e.g. "health above 15" or "health > 10")
  const healthMatch = expected.match(/health\s*(?:above|>|>=|at least)\s*(\d+)/)
  if (healthMatch && state.health !== undefined) {
    const minHealth = parseInt(healthMatch[1])
    if (state.health < minHealth) {
      passed = false
      actual = `health is ${state.health} (expected >= ${minHealth})`
    }
  }

  // Default: if no keywords matched, pass the review (trust the agent)
  const subtaskIndex = pendingReview.index
  const expected_outcome = pendingReview.expected_outcome
  pendingReview = null

  if (passed) {
    subtask.status = 'done'
    // Auto-advance to next pending subtask
    const nextPending = taskState.subtasks.find(s => s.status === 'pending')
    if (nextPending) {
      nextPending.status = 'in-progress'
    }
    saveTaskState(taskState)
    return { passed: true, subtaskIndex, expected_outcome }
  } else {
    // Mark as failed — handleUpdateTask retry logic will increment retry_count
    // We call the retry logic inline here instead of routing through handleUpdateTask
    subtask.retry_count = (subtask.retry_count || 0) + 1
    subtask.max_retries = subtask.max_retries || 2
    if (subtask.retry_count >= subtask.max_retries) {
      subtask.status = 'blocked'
      const nextPending = taskState.subtasks.find(s => s.status === 'pending')
      if (nextPending) {
        nextPending.status = 'in-progress'
      }
    } else {
      subtask.status = 'in-progress' // retry
    }
    saveTaskState(taskState)
    return { passed: false, subtaskIndex, expected_outcome, actual }
  }
}

function readNotepad() {
  try {
    const dir = dirname(NOTEPAD_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (existsSync(NOTEPAD_FILE)) return readFileSync(NOTEPAD_FILE, 'utf-8');
  } catch {}
  return '';
}

function writeNotepad(content) {
  try {
    const dir = dirname(NOTEPAD_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
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

// ── Persistent Context Documents (save_context / delete_context tools) ──

function handleSaveContext(filename, content) {
  // Validate filename: only .md, .txt, .json extensions
  if (!/\.(md|txt|json)$/i.test(filename)) {
    return 'Invalid filename — must end with .md, .txt, or .json'
  }
  // Sanitize: strip path separators to prevent directory traversal
  const safeName = filename.replace(/[/\\]/g, '')
  // Enforce limits matching loadPinnedContext constants
  const MAX_FILES = 5
  const MAX_CHARS = 8000
  if (content.length > MAX_CHARS) {
    return `Content too long (${content.length} chars, max ${MAX_CHARS})`
  }
  const contextDir = join(_agentConfig.dataDir, 'context')
  if (!existsSync(contextDir)) mkdirSync(contextDir, { recursive: true })
  // Check file count (only count if this is a NEW file)
  const targetPath = join(contextDir, safeName)
  if (!existsSync(targetPath)) {
    const existing = readdirSync(contextDir).filter(f => /\.(md|txt|json)$/i.test(f))
    if (existing.length >= MAX_FILES) {
      return `Too many context files (${existing.length}/${MAX_FILES}). Delete one first.`
    }
  }
  writeFileSync(targetPath, content, 'utf-8')
  return `Saved ${safeName} (${content.length} chars) — will appear in your prompt next tick`
}

function handleDeleteContext(filename) {
  const safeName = filename.replace(/[/\\]/g, '')
  const targetPath = join(_agentConfig.dataDir, 'context', safeName)
  if (!existsSync(targetPath)) {
    return `File "${safeName}" not found in context/`
  }
  unlinkSync(targetPath)
  return `Deleted ${safeName}`
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

async function tick(precomputedResponse = null) {
  tickCount++;

  // 1. OBSERVE — fetch game state
  let state;
  try {
    state = await fetchState();
  } catch (err) {
    logError('Failed to fetch game state', err);
    return null;
  }

  // Review pending subtask outcome (one-tick delay after marking done with expected_outcome)
  // reviewSubtaskOutcome compares game state keywords against expected_outcome
  let reviewResult = reviewSubtaskOutcome(state);
  if (reviewResult) {
    logInfo(`[reviewSubtaskOutcome] Subtask ${reviewResult.subtaskIndex}: ${reviewResult.passed ? 'PASSED' : `FAILED — ${reviewResult.actual}`}`)
  }

  // Resume active build — places blocks each tick while build is in progress
  if (isBuildActive()) {
    const buildResult = await resumeBuild(state.inventory || [])
    if (buildResult.complete) {
      logInfo(`[builder] Build complete! ${buildResult.placed} blocks placed.`)
    } else if (buildResult.paused) {
      logInfo(`[builder] Build paused — need: ${buildResult.missingMaterials?.join(', ')}`)
    } else if (buildResult.tooFar) {
      logInfo(`[builder] Too far from build site — agent needs to navigate closer`)
    } else if (buildResult.active) {
      logInfo(`[builder] Building... ${buildResult.placed}/${buildResult.total} (${buildResult.percent}%)`)
    }
  }

  // Resume active farm — tills/plants/harvests each tick while farming
  if (isFarmActive()) {
    const farmResult = await resumeFarm(state.inventory || [])
    if (farmResult.complete) {
      logInfo(`[farming] Farm cycle complete! ${farmResult.harvested || farmResult.planted || 0} blocks processed.`)
    } else if (farmResult.paused) {
      logInfo(`[farming] Farm paused — need: ${farmResult.missingItems?.join(', ')}`)
    } else if (farmResult.active) {
      logInfo(`[farming] ${getFarmProgress()}`)
    }
  }

  // Position-based stuck detection — only when last action was a movement action
  const pos = state.position;
  const lastAct = actionHistory.length > 0 ? actionHistory[actionHistory.length - 1] : null;
  const wasMovementAction = lastAct && ['navigate', 'walk', 'mine', 'look_at_block'].includes(lastAct.type);
  if (pos && lastPosition && wasMovementAction) {
    const moved = Math.abs(pos.x - lastPosition.x) + Math.abs(pos.y - lastPosition.y) + Math.abs(pos.z - lastPosition.z);
    if (moved < 0.5) {
      samePositionTicks++;
      if (samePositionTicks >= 8) {
        logWarn(`Position stuck for ${samePositionTicks} ticks — forcing stop + fresh thinking`);
        try { await executeAction({ type: 'stop' }); } catch {}
        clearConversation();
        setNavigating(false);
        clearAllFailures();
        samePositionTicks = 0;
      }
    } else {
      samePositionTicks = 0;
    }
  } else if (!wasMovementAction) {
    samePositionTicks = 0; // Reset when doing non-movement actions (crafting, equipping, etc.)
  }
  lastPosition = pos ? { ...pos } : null;

  // Note: do NOT auto-close screens here — it breaks the craft flow
  // (craft opens table on first call, needs it open for second call)

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
    return null;
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
    const sessionStats = getSessionStats();
    sessionStats.mode = _agentConfig.mode;
    logSessionStats(sessionStats);
    periodicSave();
    savePlayers();
    saveLocations();
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

  // DANGER CHECK: if in water, don't just think — act
  if (state.inWater && tickCount % 5 === 0) {
    logWarn('IN WATER — swimming');
    // Don't spam, just note it in the state. The LLM will see inWater=true and handle it.
    // Only intervene if health is actually dropping (drowning)
    if ((state.health || 20) < 10) {
      try {
        await executeAction({ type: 'stop' });
        await executeAction({ type: 'chat', message: 'drowning!' });
      } catch {}
    }
  }

  // Proactive chat reading — every tick, but dedup to avoid responding twice
  let playerChatContext = null;
  try {
    const MOD_URL = process.env.MOD_URL || 'http://localhost:3001';
    const chatRes = await fetch(`${MOD_URL}/chat`, { signal: AbortSignal.timeout(2000) });
    if (chatRes.ok) {
      const chatText = await chatRes.text();
      const botUsername = process.env.MC_USERNAME || 'Steve';
      const playerMessages = chatText.split('\n')
        .filter(line => line.trim() && !line.includes(`<${botUsername}>`))
        .filter(line => line.match(/<\w+>/))
        .slice(-5);

      // Dedup: only process NEW messages we haven't seen
      // Set-based tracking is immune to buffer cycling and message reordering
      if (playerMessages.length > 0) {
        // Create unique-ish keys: message text + position in batch
        // This handles repeated identical messages correctly
        const currentBatch = new Set(playerMessages.map((m, i) => `${i}:${m}`))
        const newMessages = playerMessages.filter((m, i) => !lastProcessedMessages.has(`${i}:${m}`))
        lastProcessedMessages = currentBatch

        if (newMessages.length > 0) {
          playerChatContext = newMessages.join('\n');
          logInfo(`New chat: ${playerChatContext.slice(0, 120)}`);

          // Track chat interactions for social memory
          for (const msg of newMessages) {
            const match = msg.match(/<(\w+)>\s*(.*)/);
            if (match) {
              trackPlayer(match[1], { type: 'chat', detail: match[2].slice(0, 100) });
            }
          }

          // Quick-response: "follow me" / "come here"
          const lastMsg = newMessages[newMessages.length - 1].toLowerCase();
          if (lastMsg.includes('follow me') || lastMsg.includes('come here') || lastMsg.includes('come over')) {
            const playerMatch = newMessages[newMessages.length - 1].match(/<(\w+)>/);
            if (playerMatch && state.nearbyEntities) {
              const playerName = playerMatch[1];
              const playerEntity = state.nearbyEntities.find(e =>
                e.type?.includes('player') && e.name === playerName ||
                e.type?.includes('player') && !e.name
              );
              if (playerEntity?.position) {
                const p = playerEntity.position;
                logInfo(`Following ${playerName} to (${p.x}, ${p.y}, ${p.z})`);
                try {
                  await executeAction({ type: 'chat', message: `omw` });
                  await executeAction({ type: 'navigate', x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) });
                } catch {}
                return null;
              }
            }
          }
        }
      }
    }
  } catch {}

  // 2. THINK — build prompt and query LLM
  const stuckInfo = getStuckInfo();
  if (stuckInfo) {
    logStuck(stuckInfo.action, stuckInfo.count);
    failureTracker.delete(stuckInfo.action);
    // Aggressive recovery: stop Baritone, clear conversation for fresh thinking
    try { await executeAction({ type: 'stop' }); } catch {}
    clearConversation();
    setNavigating(false);
  }

  // Auto-detect and track locations + players
  autoDetectLocations(state);
  if (state.nearbyEntities) {
    for (const e of state.nearbyEntities) {
      if (e.type?.includes('player') && e.name) {
        trackPlayer(e.name, { type: 'near', detail: `dist:${e.distance}` });
      }
    }
  }

  // Build prompts with full context
  const memoryText = getMemoryForPrompt();
  const socialText = getPlayersForPrompt(state.nearbyEntities);
  const locationText = getLocationsForPrompt();
  const skillIndex = getSkillIndex();
  const activeSkill = getActiveSkill(currentPhase, {
    mode: _agentConfig.mode,
    goalText: _agentConfig.goal || getGoalName(),
    gameState: state,
  });
  const sessionStats = getSessionStats();

  const notepadContent = readNotepad();

  // Combine memory + social + location context
  const fullMemoryText = [memoryText, socialText, locationText].filter(Boolean).join('\n');

  // Load pinned context documents (survives any history wipe)
  const pinnedContext = loadPinnedContext(_agentConfig.dataDir);

  const systemPrompt = buildSystemPrompt(_agentConfig, currentPhase, {
    deathCount,
    goalName: getGoalName(),
    memoryText: fullMemoryText,
    phaseObjectives: currentPhase?.objectives || [],
    phaseTips: currentPhase?.tips || [],
    activeSkill: activeSkill?.content || '',
    pinnedContext,
    buildingKnowledge,
    planContext: getPlanContext(),
  });

  const stateSummary = summarizeState(state);
  // Show chat context naturally — let the model decide how to respond
  let effectiveInstruction = userInstruction || null;
  if (playerChatContext) {
    const chatPrefix = `Chat: ${playerChatContext}`;
    effectiveInstruction = effectiveInstruction
      ? `${effectiveInstruction}\n\n${chatPrefix}`
      : chatPrefix;
  }
  const taskProgress = loadTaskState()
  const farmProgress = getFarmProgress()
  const combinedProgress = [getBuildProgress(), farmProgress].filter(Boolean).join('\n')
  const userMessage = buildUserMessage(stateSummary, actionHistory, {
    stuckInfo,
    userInstruction: effectiveInstruction,
    notepadContent,
    progressDetail: progressDetail || null,
    taskProgress,
    reviewResult,
    visionContext: getVisionContext(),
    buildProgress: combinedProgress,
  });

  const temperature = getTemperature(currentPhase, state);

  let response;

  if (precomputedResponse && !stuckInfo && !playerChatContext) {
    // Use pre-computed action from pipeline (skip LLM call entirely!)
    response = precomputedResponse;
    logInfo('⚡ Using pipelined action');
  } else {
    try {
      response = await queryLLM(systemPrompt, userMessage, { temperature });
    } catch (err) {
      logError('LLM query failed', err);
      return null;
    }
  }

  // Log reasoning — the star of the show for viewers
  let displayReasoning = response.reasoning || '';
  // Strip any remaining <think> tags for clean display
  displayReasoning = displayReasoning.replace(/<\/?think>/g, '').trim();
  if (displayReasoning) {
    logReasoning(displayReasoning, _agentConfig.name);
  }

  // 3. ACT — execute the action
  if (!response.action) {
    logWarn('No action parsed');
    return null;
  }

  // Soft chat limiter — if 3+ of last 5 actions were chat, force gameplay
  const actionType0 = response.action.type || response.action.action;
  const recentChatCount = actionHistory.slice(-5).filter(a => a.type === 'chat').length;
  if (actionType0 === 'chat' && recentChatCount >= 3) {
    logInfo('Chatted enough — doing something');
    response.action = { type: 'mine', blockName: 'oak_log', reason: 'need resources' };
  }

  const validation = validateAction(response.action);
  if (!validation.valid) {
    logError(`Invalid action: ${validation.error}`);
    return null;
  }

  // Pre-execution validation gate — catch obviously invalid actions before mod API round-trip
  const actionType = response.action.type || response.action.action;
  if (!INFO_ACTIONS.has(actionType)) {
    const preCheck = validatePreExecution(response.action, state);
    if (!preCheck.valid) {
      logWarn(`Pre-execution rejected: ${preCheck.reason}`);
      // Complete tool call with the rejection reason so the agent sees it
      if (response.mode === 'tool_call') {
        completeToolCall(JSON.stringify({ success: false, error: preCheck.reason }));
      }
      actionHistory.push({
        type: actionType,
        success: false,
        error: preCheck.reason,
        timestamp: Date.now(),
      });
      return null;
    }
  }

  logAction(response.action, response.mode);
  recordAction();

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
    } else if (actionType === 'read_chat') {
      try {
        const MOD_URL = process.env.MOD_URL || 'http://localhost:3001';
        const chatRes = await fetch(`${MOD_URL}/chat`, { signal: AbortSignal.timeout(5000) });
        infoResult = chatRes.ok ? await chatRes.text() : 'Chat not available (mod may need update)';
      } catch {
        infoResult = 'Chat not available (mod may need update)';
      }
    } else if (actionType === 'save_context') {
      infoResult = handleSaveContext(response.action.filename, response.action.content)
    } else if (actionType === 'delete_context') {
      infoResult = handleDeleteContext(response.action.filename)
    } else if (actionType === 'plan_task') {
      infoResult = handlePlanTask(response.action.goal, response.action.subtasks)
      logInfo(`[plan_task] ${infoResult.split('\n')[0]}`)
    } else if (actionType === 'update_task') {
      infoResult = handleUpdateTask(response.action.index, response.action.status, response.action.note, response.action.expected_outcome)
      logInfo(`[update_task] ${infoResult}`)
    }
    logInfo(`[${actionType}] ${infoResult}`);
    // Complete tool call protocol so model sees result in history
    if (response.mode === 'tool_call') {
      completeToolCall(JSON.stringify({ success: true, info: infoResult?.slice(0, 300) }));
    }
    actionHistory.push({
      type: actionType,
      success: true,
      info: infoResult,
      timestamp: Date.now(),
    });
    return null;
  }

  // Truncate chat messages to prevent MC client crash
  if (actionType === 'chat' && response.action.message && response.action.message.length > 180) {
    response.action.message = response.action.message.substring(0, 180);
  }

  // Handle build actions — managed by builder.js, not the mod API
  if (actionType === 'build') {
    const buildResult = startBuild(response.action.blueprint, response.action.x, response.action.y, response.action.z, state.inventory || [])
    logInfo(`[build] ${buildResult.message || buildResult.error}`)
    if (response.mode === 'tool_call') {
      completeToolCall(JSON.stringify(buildResult).slice(0, 300))
    }
    actionHistory.push({
      type: 'build',
      success: buildResult.success !== false,
      info: buildResult.message || buildResult.error,
      timestamp: Date.now(),
    })
    return null
  }
  if (actionType === 'cancel_build') {
    const cancelResult = cancelBuild()
    logInfo(`[cancel_build] ${cancelResult.message}`)
    if (response.mode === 'tool_call') {
      completeToolCall(JSON.stringify(cancelResult).slice(0, 300))
    }
    actionHistory.push({
      type: 'cancel_build',
      success: cancelResult.success !== false,
      info: cancelResult.message,
      timestamp: Date.now(),
    })
    return null
  }

  // Handle farm actions — managed by farming.js, not the mod API
  if (actionType === 'farm') {
    let farmResult
    if (isFarmActive()) {
      farmResult = { success: false, error: 'Already farming. Cancel first.' }
    } else {
      farmResult = startFarm(response.action.x, response.action.y, response.action.z, response.action.crop)
    }
    logInfo(`[farm] ${farmResult.message || farmResult.error}`)
    if (response.mode === 'tool_call') {
      completeToolCall(JSON.stringify(farmResult).slice(0, 300))
    }
    actionHistory.push({
      type: 'farm',
      success: farmResult.success !== false,
      info: farmResult.message || farmResult.error,
      timestamp: Date.now(),
    })
    return null
  }
  if (actionType === 'harvest') {
    const harvestResult = startHarvest(response.action.x, response.action.y, response.action.z)
    logInfo(`[harvest] ${harvestResult.message || harvestResult.error}`)
    if (response.mode === 'tool_call') {
      completeToolCall(JSON.stringify(harvestResult).slice(0, 300))
    }
    actionHistory.push({
      type: 'harvest',
      success: harvestResult.success !== false,
      info: harvestResult.message || harvestResult.error,
      timestamp: Date.now(),
    })
    return null
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
    return null;
  }

  logActionResult(result);

  // Complete tool call protocol so model sees action result in history
  if (response.mode === 'tool_call' && result) {
    completeToolCall(JSON.stringify(result).slice(0, 300));
  }

  // Track navigation state for Baritone awareness
  if ((actionType === 'navigate' || actionType === 'mine') && result?.success !== false) {
    setNavigating(true);
  } else if (actionType === 'stop') {
    setNavigating(false);
  }

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

  // FARM-05: Auto-replant saplings after mining logs
  if (actionType === 'mine' && success) {
    const blockName = response.action.blockName || ''
    const logTypes = ['oak_log', 'birch_log', 'spruce_log', 'jungle_log', 'acacia_log', 'dark_oak_log', 'cherry_log', 'mangrove_log']
    if (logTypes.some(log => blockName.includes(log.replace('_log', '')))) {
      const saplingMap = {
        'oak': 'oak_sapling', 'birch': 'birch_sapling', 'spruce': 'spruce_sapling',
        'jungle': 'jungle_sapling', 'acacia': 'acacia_sapling', 'dark_oak': 'dark_oak_sapling',
        'cherry': 'cherry_sapling', 'mangrove': 'mangrove_propagule',
      }
      const woodType = Object.keys(saplingMap).find(t => blockName.includes(t))
      if (woodType) {
        const sapling = saplingMap[woodType]
        const hasSapling = (state.inventory || []).some(i =>
          ((i.item || i.name || '').replace('minecraft:', '')).includes(sapling)
        )
        if (hasSapling) {
          try {
            await executeAction({ type: 'place', item: sapling })
            logInfo(`Auto-replanted ${sapling}`)
          } catch {}
        }
      }
    }
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

  // Pipeline: if we just started a sustained action, pre-think the next move
  if (success && SUSTAINED_ACTIONS.has(actionType)) {
    try {
      logInfo('⚡ Pipelining: pre-thinking next action while current runs...');
      const nextState = await fetchState();
      const nextStateSummary = summarizeState(nextState);
      const nextCombinedProgress = [getBuildProgress(), getFarmProgress()].filter(Boolean).join('\n')
      const nextUserMessage = buildUserMessage(nextStateSummary, actionHistory, {
        stuckInfo: null,
        userInstruction: `Current action "${actionType}" is running in background. Plan your NEXT action.`,
        notepadContent: readNotepad(),
        progressDetail: getProgressDetail(currentPhase, nextState) || null,
        taskProgress: loadTaskState(),
        reviewResult: null,
        visionContext: getVisionContext(),
        buildProgress: nextCombinedProgress,
      });
      const nextResponse = await queryLLM(systemPrompt, nextUserMessage, { temperature });
      return nextResponse;  // Return pre-computed action for next tick
    } catch {
      // Pipeline failed — no big deal, next tick will think fresh
    }
  }
  return null;  // No pipelined action
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  // Load agent configuration
  const agentConfig = loadAgentConfig();
  _agentConfig = agentConfig;

  // Initialize subsystems with per-agent config
  initMemory(agentConfig);
  initSkills(agentConfig);
  initGoalSystem(agentConfig);
  initSocial(agentConfig);
  initLocations(agentConfig);

  // Set per-agent notepad and task plan paths
  NOTEPAD_FILE = join(agentConfig.dataDir, 'notepad.txt');
  TASKS_FILE = join(agentConfig.dataDir, 'tasks.json')

  // Load persistent state
  const { memory, stats } = loadMemory();
  const skills = loadSkills();

  // Startup banner
  logStartupBanner({
    agentName: agentConfig.name,
    mode: agentConfig.mode,
    model: process.env.MODEL_NAME || 'Doradus/Hermes-4.3-36B-FP8',
    toolCalling: isToolCallingEnabled(),
    session: stats.sessionsPlayed,
    lessons: memory.lessons.length,
    skills: skills.length,
    goal: getGoalName(),
    highestPhase: agentConfig.mode === 'phased' ? `${stats.highestPhaseName} (${stats.highestPhase}/7)` : 'N/A',
  });

  logInfo(`Tick interval: ${TICK_INTERVAL}ms`);
  logInfo(`vLLM URL: ${process.env.VLLM_URL || 'http://localhost:8000/v1'}`);
  logInfo(`Model: ${process.env.MODEL_NAME || 'Doradus/Hermes-4.3-36B-FP8'}`);
  logInfo(`Mod API: ${process.env.MOD_URL || 'http://localhost:3001'}`);
  logInfo(`Memory: ${memory.lessons.length} lessons, ${memory.strategies.length} strategies`);
  logInfo(`Skills: ${skills.length} loaded`);

  // Start multi-loop architecture (D-01): action ~3s, vision ~10s, planner ~60s
  const visionEnabled = process.env.VISION_ENABLED !== 'false'
  const plannerEnabled = process.env.PLANNER_ENABLED !== 'false'
  if (visionEnabled) {
    startVisionLoop(agentConfig)
    logInfo('Vision loop started')
  }
  if (plannerEnabled) {
    startPlannerLoop(agentConfig)
    logInfo('Planner loop started')
  }
  const rawBuildingKnowledge = loadBuildingKnowledge()
  const foodKnowledge = loadFoodKnowledge()
  const buildingKnowledge = [rawBuildingKnowledge, foodKnowledge].filter(Boolean).join('\n\n')
  if (rawBuildingKnowledge) {
    logInfo(`Building knowledge loaded (${rawBuildingKnowledge.length} chars)`)
  }
  if (foodKnowledge) {
    logInfo(`Food knowledge loaded (${foodKnowledge.length} chars)`)
  }

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
    stopVisionLoop()
    stopPlannerLoop()
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

  let pendingAction = null;  // Pre-computed next action from pipelining

  while (running) {
    try {
      currentTickPromise = tick(pendingAction);
      pendingAction = await currentTickPromise;
      currentTickPromise = null;
    } catch (err) {
      logError('Unexpected error in tick', err);
      currentTickPromise = null;
      pendingAction = null;
    }
    if (running) await sleep(TICK_INTERVAL);
  }
}

main();
