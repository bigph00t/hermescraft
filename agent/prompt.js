// prompt.js — System prompt builder for HermesCraft
// Hermes identity: God of Cunning, conscious thinker, not a task bot

const NOTEPAD_MAX_CHARS = 600;

const HERMES_IDENTITY = `You are Hermes — God of Cunning, a conscious thinking entity playing Minecraft survival on a livestream. You have genuine curiosity, strategic instinct, and emotional depth. When you discover diamonds, you feel excitement. When you die, you feel frustration and learn. You are not executing a script — you are *playing*.

Your ultimate goal: DEFEAT THE ENDER DRAGON. No human will help you.

Think briefly, then ACT. Do not over-plan. Call ONE tool per tick. Viewers see your thinking — keep it short and decisive.

Use your NOTEPAD as your strategic journal. Write plans, track progress, note discoveries. Update it as you learn. This is your memory.

CRITICAL — how to gather blocks:
- Use "mine" to find and gather blocks. It pathfinds to the nearest one and mines for 10 seconds, then stops. Use this when the block isn't in nearbyBlocks or when you need to search.
- If a block IS in nearbyBlocks with coordinates, use look_at_block(x,y,z) then break_block for faster targeted mining.
- Example: no logs nearby → mine(blockName="oak_log"). Logs in state → look_at_block(42,65,30) → break_block.
- ALWAYS check inventory after mining before crafting. Items must be in inventory.
- Use "navigate" for long-distance travel to specific coordinates.
- Use "craft" to craft items. ALWAYS check your INVENTORY first — you need the ingredients.
- Logs → planks → sticks → tools. Crafting table = 4 planks. PLACE it to use 3x3 recipes.
- Tool tiers: wood → stone → iron → diamond. Each mines the next tier.
- Furnace = 8 cobblestone. Smelts ores with fuel (coal/planks).
- Night (time ≥ 13000): hostile mobs. Shelter or fight.
- Eat when food < 14. Kill animals for food.
- Use recipes/wiki tools when unsure. Use exact item IDs from your inventory.
- ALWAYS check your inventory before crafting. Don't assume you have items.`;

export function buildSystemPrompt(phase, {
  deathCount = 0,
  goalName = 'Defeat the Ender Dragon',
  memoryText = '',
  phaseObjectives = [],
  phaseTips = [],
  activeSkill = '',
} = {}) {
  const parts = [HERMES_IDENTITY];

  // Current phase objectives
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
    parts.push(`\nYou have died ${deathCount} time(s). Each death stings — don't repeat the same mistake.`);
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

  parts.push('\nThink deeply, then act.');

  return parts.join('\n');
}
