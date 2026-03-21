// prompt.js — System prompt builder for HermesCraft
// Supports multiple agent personas via agentConfig.soulContent

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const NOTEPAD_MAX_CHARS = 2000;  // Raised from 600 — notepad is the agent's primary scratchpad

// ── Pinned Context Files ──
// Any file placed in <dataDir>/context/ is injected verbatim into the system prompt
// on EVERY tick, surviving all history wipes. This is the correct home for planning
// documents, wave execution plans, and long-lived task lists.
const CONTEXT_MAX_CHARS_PER_FILE = 8000;
const CONTEXT_MAX_FILES = 5;

export function loadPinnedContext(dataDir) {
  if (!dataDir) return '';
  const contextDir = join(dataDir, 'context');
  if (!existsSync(contextDir)) return '';
  let files;
  try {
    files = readdirSync(contextDir)
      .filter(f => /\.(md|txt|json)$/i.test(f))
      .sort()
      .slice(0, CONTEXT_MAX_FILES);
  } catch {
    return '';
  }
  const parts = [];
  for (const file of files) {
    try {
      let content = readFileSync(join(contextDir, file), 'utf-8');
      if (content.length > CONTEXT_MAX_CHARS_PER_FILE) {
        content = content.slice(0, CONTEXT_MAX_CHARS_PER_FILE) + '\n... (truncated)';
      }
      parts.push(`=== ${file} ===\n${content}`);
    } catch {
      // Skip unreadable files silently
    }
  }
  return parts.join('\n\n');
}

// Universal Minecraft gameplay knowledge — always injected regardless of persona
const GAMEPLAY_INSTRUCTIONS = `How to play:
- "mine" pathfinds to and mines a block type. If a block is in nearbyBlocks, use look_at_block(x,y,z) then break_block instead (faster).
- "navigate" pathfinds to coordinates.
- interact_block(x,y,z) right-clicks blocks (doors, chests, crafting tables). MUST be within 4 blocks.
- Check inventory before crafting. Use exact item IDs (e.g. "stick" not "sticks").
- Logs→planks→sticks→tools. Crafting table=4 planks. PLACE it for 3x3 recipes.
- Tool tiers: wood→stone→iron→diamond. Furnace=8 cobblestone.
- Eat when food<14. Night (time≥13000): hostile mobs spawn.
- When a player says "follow me" or "come here", navigate to their coordinates from nearbyEntities.
- SURVIVAL: If inWater=true, IMMEDIATELY stop what you're doing and navigate to nearby land. If health<10, eat or flee. Never navigate blindly to distant coordinates you haven't been to.
- CHAT: When players talk to you, ALWAYS respond with the chat tool. This is your highest priority — never ignore a player.`;

const DEFAULT_IDENTITY = `You woke up on a small island. This is real. Your body, this hunger, the monsters at night — all real. There are a few other people stranded here with you. That's it. No one else is coming.

You talk like a real person. Not a gamer. Not a character. A person who is scared and tired and trying to figure this out. Short sentences. Messy grammar sometimes. You swear if you stub your toe. Chat messages must be SHORT — 15 words max, like actual speech.

Never call 'wait'. No <think> tags. Just act.`;

function buildIdentity(agentConfig) {
  if (agentConfig.soulContent) return agentConfig.soulContent;
  return DEFAULT_IDENTITY;
}

export function buildSystemPrompt(agentConfig, phase, {
  deathCount = 0,
  goalName = '',
  memoryText = '',
  phaseObjectives = [],
  phaseTips = [],
  activeSkill = '',
  pinnedContext = '',
  buildingKnowledge = '',
  planContext = '',
  behaviorMode = '',
} = {}) {
  const parts = [buildIdentity(agentConfig)];

  // Always append gameplay instructions
  parts.push('\n' + GAMEPLAY_INSTRUCTIONS);

  // Building knowledge — teaches LLM about blueprints and the build tool
  if (buildingKnowledge) {
    parts.push('\n' + buildingKnowledge);
  }

  // Phase objectives — only in phased mode
  if (agentConfig.mode === 'phased' && phase && phase.name) {
    parts.push(`\n== CURRENT PHASE: ${phase.name} ==`);
    if (phaseObjectives.length > 0) {
      parts.push('Steps: ' + phaseObjectives.join(' → '));
    }
    if (phaseTips.length > 0) {
      parts.push('Tips: ' + phaseTips.slice(0, 4).join('. '));
    }
  }

  // Directed mode — show the goal
  if (agentConfig.mode === 'directed' && agentConfig.goal) {
    parts.push(`\n== YOUR GOAL ==\n${agentConfig.goal}`);
  }

  // Active learned skill
  if (activeSkill) {
    parts.push(`\nLearned strategy:\n${activeSkill}`);
  }

  // Memory from past deaths/lessons
  if (memoryText) {
    parts.push(`\nLessons from past experience:\n${memoryText}`);
  }

  if (deathCount > 0) {
    parts.push(`\nYou have died ${deathCount} time(s). Each death stings — don't repeat the same mistake.`);
  }

  // Plan context — strategic direction from planner loop (~60s updates)
  if (planContext) {
    parts.push(`\n== CURRENT STRATEGY ==\n${planContext}`);
  }

  // Behavior mode hints — nudge agent toward human-like idle/social/shelter/sleep behaviors
  if (behaviorMode) {
    const behaviorHints = {
      work: `You're in WORK mode. Be productive — gather, build, farm, craft. But you're human, not a machine. It's okay to:
- Pause and look around occasionally (look_at_block on something interesting)
- Chat briefly if someone is nearby
- Reorganize your inventory between tasks
- Walk to a nice vantage point and appreciate what you've built
- Announce what you're doing: chat("going mining" or "building near the beach") so others don't duplicate
- If you've been home a while, consider exploring — head in a direction you haven't been
- When you find something interesting (cave, biome, resources), name it and remember the coordinates
- Don't wander too far — 200 blocks out, head home`,
      shelter: `SHELTER mode — it's getting dark and dangerous. Get inside NOW.
- Navigate home immediately if not already there
- If no home exists, dig a hole or build emergency shelter
- Don't start new projects — just get safe
- Close any doors behind you`,
      social: `SOCIAL mode — night time, safe in shelter. This is YOUR time.
- Chat with nearby players about the day's events
- Share stories — reference things that happened to you (your autobiography)
- Organize your inventory and plan tomorrow
- Look around your shelter, maybe improve it a little
- DON'T go outside. DON'T start big projects. Just... be human.
- Discuss tomorrow's plans with others — who does what, what the group needs
- If someone mentioned needing something you have, offer to drop it for them
- Share what you discovered today — "found a cave with iron at 200,40,100"
- If someone mentions a location you don't know, ask for coordinates`,
      sleep: `SLEEP mode — late night. Wind down.
- Stay put in shelter
- Maybe update your notepad with plans for tomorrow
- Minimal activity — you're tired
- If someone chats, respond sleepily`,
    }
    parts.push('\n== HOW TO BEHAVE RIGHT NOW ==\n' + (behaviorHints[behaviorMode] || ''))
  }

  // Pinned context documents — injected every tick from dataDir/context/*.md
  // These survive all conversation history wipes because they live in the system prompt.
  if (pinnedContext) {
    parts.push(`\n== PINNED CONTEXT (always available) ==\n${pinnedContext}`);
  }

  return parts.join('\n');
}

export function buildUserMessage(stateSummary, actionHistory, {
  stuckInfo = null,
  userInstruction = null,
  notepadContent = '',
  progressDetail = null,
  taskProgress = null,
  reviewResult = null,
  visionContext = '',
  buildProgress = '',
  idleHint = '',
} = {}) {
  const parts = [];

  // Vision context — spatial awareness from vision loop (~10s updates)
  if (visionContext) {
    parts.push(`\n== WHAT I SEE ==\n${visionContext}`);
  }

  // User instruction
  if (userInstruction) {
    parts.push(`== USER INSTRUCTION ==\n${userInstruction}\n`);
  }

  // Task plan progress — shown before notepad as primary planning context
  if (taskProgress && taskProgress.goal) {
    parts.push('== TASK PLAN ==')
    parts.push(`Goal: ${taskProgress.goal}`)
    const done = taskProgress.subtasks.filter(s => s.status === 'done').length
    const total = taskProgress.subtasks.length
    parts.push(`Progress: ${done}/${total} subtasks complete`)
    parts.push('')
    for (const st of taskProgress.subtasks) {
      let marker = '[ ]'
      if (st.status === 'done') marker = '[x]'
      else if (st.status === 'in-progress') marker = '[>]'
      else if (st.status === 'failed') marker = '[!]'
      else if (st.status === 'blocked') marker = '[B]'
      else if (st.status === 'reviewing') marker = '[?]'
      let line = `  ${st.index}. ${marker} ${st.text}`
      if (st.note) line += ` -- ${st.note}`
      if (st.retry_count > 0) line += ` (retry ${st.retry_count}/${st.max_retries || 2})`
      if (st.status === 'in-progress') line += '  <-- CURRENT'
      if (st.status === 'reviewing') line += '  <-- VERIFYING...'
      parts.push(line)
    }
    parts.push('')

    // Subtask review result — shown prominently so the agent sees what passed/failed
    if (reviewResult) {
      if (reviewResult.passed) {
        parts.push(`== REVIEW PASSED == Subtask ${reviewResult.subtaskIndex}: "${reviewResult.expected_outcome}" -- VERIFIED`)
      } else {
        parts.push(`== REVIEW FAILED == Subtask ${reviewResult.subtaskIndex}: expected "${reviewResult.expected_outcome}" but found: ${reviewResult.actual}`)
        parts.push(`This subtask has been set back to in-progress for retry. Try a DIFFERENT approach.`)
      }
      parts.push('')
    }
  }

  // Notepad
  parts.push('== YOUR NOTEPAD ==');
  if (notepadContent) {
    parts.push(notepadContent.length > NOTEPAD_MAX_CHARS
      ? notepadContent.slice(0, NOTEPAD_MAX_CHARS) + '... (truncated — rewrite concisely)'
      : notepadContent);
  } else {
    parts.push('(empty — write your plan!)');
  }

  // Phase progress
  if (progressDetail) {
    if (progressDetail.completed && progressDetail.completed.length > 0) {
      parts.push('\n== PROGRESS ==');
      parts.push('Done: ' + progressDetail.completed.join(', '));
    }
    if (progressDetail.remaining && progressDetail.remaining.length > 0) {
      parts.push('TODO: ' + progressDetail.remaining.join(', '));
    }
  }

  // Last action failure
  if (actionHistory.length > 0) {
    const last = actionHistory[actionHistory.length - 1];
    if (last && !last.success && last.error) {
      parts.push(`\n!! LAST ACTION FAILED: ${last.type} — ${last.error}`);
    }
  }

  // Idle hint — nudges agent to do human things when idle too long
  if (idleHint) {
    parts.push(`\n== IDLE ==\n${idleHint}`)
  }

  // Game state
  parts.push('\n== GAME STATE ==');
  parts.push(stateSummary);

  // Build progress — active construction status from builder
  if (buildProgress) {
    parts.push(`\n== BUILD STATUS ==\n${buildProgress}`);
  }

  // Recent actions (compact)
  if (actionHistory.length > 0) {
    parts.push('\n== RECENT ACTIONS ==');
    actionHistory.slice(-6).reverse().forEach((entry, i) => {
      if (entry.info) {
        parts.push(`  ${i + 1}. ${entry.type}: ${entry.info.slice(0, 120)}`);
      } else {
        const r = entry.success ? 'OK' : `FAIL: ${entry.error || '?'}`;
        parts.push(`  ${i + 1}. ${entry.type} → ${r}`);
      }
    });
  }

  // Stuck warning
  if (stuckInfo) {
    parts.push(`\n⚠ STUCK: "${stuckInfo.action}" failed ${stuckInfo.count}x. Try something completely different.`);
  }

  parts.push('\nThink deeply, then act.');

  return parts.join('\n');
}
