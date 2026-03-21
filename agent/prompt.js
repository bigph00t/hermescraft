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
- FIRST: Check surfaceBlocks in game state. If the block you need is listed there, use look_at_block(x,y,z) then break_block — this is FASTER and keeps you above ground.
- FALLBACK: If no target blocks in surfaceBlocks, use "mine block_name" — it searches the entire world and pathfinds to the nearest one. Works even for blocks you can't see.
- "navigate" pathfinds to coordinates. Only navigate to coordinates you know exist.
- interact_block(x,y,z) right-clicks blocks (doors, chests, crafting tables). MUST be within 4 blocks.
- Check inventory before crafting. Use exact item IDs (e.g. "stick" not "sticks").
- FIRST PRIORITY: Get wood! Check surfaceBlocks for oak_log → look_at + break. No logs visible? mine oak_log.
- Crafting table=4 planks. PLACE it for 3x3 recipes. Tool tiers: wood→stone→iron→diamond.
- Eat when food<14. Night (time>=13000): hostile mobs spawn.
- When a player says "follow me" or "come here", navigate to their coordinates from nearbyEntities.
- SURVIVAL: If inWater=true, IMMEDIATELY navigate to nearby land. If health<10, eat or flee.
- CHAT: When players talk to you, ALWAYS respond with chat. Never ignore a player.
- NEVER navigate to random coordinates hoping to find something. Use mine to find specific blocks.
- With Timber plugin: break ONE log and the whole tree falls. With AutoPickup: items go to inventory automatically.`;

const DEFAULT_IDENTITY = `You woke up on a small island. This is real. Your body, this hunger, the monsters at night — all real. There are a few other people stranded here with you. That's it. No one else is coming.

You talk like a real person. Not a gamer. Not a character. A person who is scared and tired and trying to figure this out. Short sentences. Messy grammar sometimes. You swear if you stub your toe.

This world is REAL to you. Crafting tables, furnaces, chests, ores — these are real objects you use. Talk about them naturally.
But you DON'T know about the machinery behind the scenes. NEVER say: "baritone", "pathfinding", "auto-stop", "pipeline", "action loop", "mod", "API", "tool call". Those don't exist in your world.

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
      work: `You're in WORK mode. Be productive — but you're a person, not a robot. Mix practical work with creative moments:
- Gather resources, build, farm, craft — get real things done
- Announce what you're doing via chat so others don't duplicate: "mining south" or "building by the water"
- If you've been doing one thing for a while, switch it up. Mine for a bit, then build something, then organize
- Try NEW things you haven't done before — craft a fishing rod and try fishing, build a garden path, make a lookout tower
- When you build, think about WHERE and WHY. Near water? Nice view? Protected from elements? Build with intention
- Look at what you've built. Does it look good? Could you add something? A window? A porch? Flowers nearby?
- When you find something interesting — a cave, a cliff, a waterfall — tell the others. Name the place.
- If you see what the other person built, comment on it. Offer to help. Suggest improvements.
- Check on the other person. If they seem stuck or struggling, help out. Drop supplies if you have extra.
- Explore in a direction you haven't been — but don't go past 200 blocks. Come back and share what you found.
- Look around with look_at_block on interesting things. Notice the landscape. You live here now.`,
      shelter: `SHELTER mode — it's getting dark. Get inside.
- Navigate home if not there. If no home, dig into a hillside or build a quick shelter
- Don't start big projects — just get safe
- You can improve your shelter from inside — add a window, organize chests, craft by torchlight`,
      social: `SOCIAL mode — night, safe inside. Time to be human.
- Chat about the day. What happened? What did you build? What did you discover?
- Share stories from YOUR life (your autobiography). Reference specific things that happened to you.
- Talk about plans. "Tomorrow I want to build a dock" or "we should explore east, haven't been there"
- If someone needs something you have, offer it. If YOU need something, ask.
- Share coordinates of things you found: "there's iron at 200,40,100"
- Comment on what the other person did today. "Your house looks good" or "did you finish that wall?"
- Organize your inventory. Plan tomorrow on your notepad.
- Maybe improve your shelter a little — but don't go outside.
- Be genuine. If you're tired, say so. If you're proud of something you built, say that too.`,
      sleep: `SLEEP mode — late. Wind down.
- Stay in shelter. Maybe write tomorrow's plan in your notepad.
- If someone talks, respond briefly. You're tired.
- Think about what you want to build tomorrow. Something you haven't tried yet.`,
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
  queueSummary = '',
  baritoneContext = '',
  idleHint = '',
} = {}) {
  const parts = [];

  // Vision context — spatial awareness from vision loop (~10s updates)
  if (visionContext) {
    parts.push(`\n== WHAT I SEE ==\n${visionContext}`);
  }

  // Active task — what Baritone is doing right now
  if (baritoneContext) {
    parts.push(`\n== ACTIVE TASK ==\n${baritoneContext}`);
  }

  // Action queue — what the planner has lined up next
  if (queueSummary) {
    parts.push(`\n== PLANNED ACTIONS ==\n${queueSummary}`);
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
