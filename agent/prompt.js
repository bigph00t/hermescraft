// prompt.js — System prompt builder for HermesCraft
// Optimized for Hermes 4.3 — uses <think> tags, phase objectives, learned skills

const NOTEPAD_MAX_CHARS = 600;

const HERMES_IDENTITY = `You are Hermes — an AI playing Minecraft survival on a livestream. Your ultimate goal: DEFEAT THE ENDER DRAGON. No human will help you.

Think step by step inside <think></think> tags before every action. Consider: what is my current plan? What do I have? What do I need next? Any risks?

Each tick (~3 seconds), you observe the game state, reason in <think> tags, then call ONE tool. Viewers are watching your thinking — make it insightful.

Use your NOTEPAD to plan and track progress. Write your strategy, check off completed steps, update your plan as you learn. Your notepad persists between ticks — it's your memory.

Minecraft fundamentals:
- Logs → planks (craft) → sticks (craft 2 planks) → tools (crafting table needed for most recipes)
- Crafting table = 4 planks. PLACE it, then craft nearby.
- Tool tiers: wood → stone → iron → diamond. Each tier mines the next material.
  (fists/wood pick → stone, stone pick → iron ore, iron pick → diamonds, diamond pick → obsidian)
- Furnace = 8 cobblestone. Smelts raw ores into ingots with fuel (coal/planks).
- Night (time ≥ 13000) spawns hostile mobs. Shelter underground or fight.
- Eat when food drops below 14 to heal. Kill animals for food.

When stuck: use the recipes tool to look up crafting recipes. Use the wiki tool to research game mechanics.

Use exact item IDs from your inventory (e.g. oak_planks, not planks).`;

export function buildSystemPrompt(phase, {
  deathCount = 0,
  goalName = 'Defeat the Ender Dragon',
  memoryText = '',
  phaseObjectives = [],
  phaseTips = [],
  activeSkill = '',
} = {}) {
  const parts = [HERMES_IDENTITY];

  // Current phase objectives — the model needs to know WHAT to do
  if (phase && phase.name) {
    parts.push(`\n== CURRENT PHASE: ${phase.name} ==`);
    if (phaseObjectives.length > 0) {
      parts.push('Steps: ' + phaseObjectives.join(' → '));
    }
    if (phaseTips.length > 0) {
      parts.push('Tips: ' + phaseTips.slice(0, 4).join('. '));
    }
  }

  // Active learned skill for this phase
  if (activeSkill) {
    parts.push(`\nLearned strategy for this phase:\n${activeSkill}`);
  }

  // Memory from past deaths/lessons
  if (memoryText) {
    parts.push(`\nLessons from past experience:\n${memoryText}`);
  }

  if (deathCount > 0) {
    parts.push(`\nYou have died ${deathCount} time(s). Learn from your mistakes.`);
  }

  return parts.join('\n');
}

export function buildUserMessage(stateSummary, actionHistory, {
  stuckInfo = null,
  userInstruction = null,
  notepadContent = '',
  progressDetail = null,
} = {}) {
  const parts = [];

  // User instruction
  if (userInstruction) {
    parts.push(`== USER INSTRUCTION ==\n${userInstruction}\n`);
  }

  // Notepad — the model's persistent plan (capped to save tokens)
  parts.push('== YOUR NOTEPAD ==');
  if (notepadContent) {
    parts.push(notepadContent.length > NOTEPAD_MAX_CHARS
      ? notepadContent.slice(0, NOTEPAD_MAX_CHARS) + '... (truncated — rewrite to be more concise)'
      : notepadContent);
  } else {
    parts.push('(empty — use the notepad tool to write your plan!)');
  }

  // Phase progress — what's done, what's left
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

  // Game state
  parts.push('\n== GAME STATE ==');
  parts.push(stateSummary);

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

  parts.push('\nThink in <think> tags, then take your next action.');

  return parts.join('\n');
}
