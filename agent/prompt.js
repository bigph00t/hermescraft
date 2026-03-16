// prompt.js — System prompt builder for HermesCraft
// Supports multiple agent personas via agentConfig.soulContent

const NOTEPAD_MAX_CHARS = 600;

// Universal Minecraft gameplay knowledge — always injected regardless of persona
const GAMEPLAY_INSTRUCTIONS = `CRITICAL — how to gather blocks:
- Use "mine" to find and gather blocks. It pathfinds to the nearest one and mines for 10 seconds, then stops.
- If a block IS in nearbyBlocks with coordinates, use look_at_block(x,y,z) then break_block for faster targeted mining.
- Example: no logs nearby → mine(blockName="oak_log"). Logs in state → look_at_block(42,65,30) → break_block.
- After break_block, use pickup_items if the item didn't appear in inventory (it dropped nearby).
- Use interact_block(x,y,z) to right-click blocks: open doors, chests, press buttons, pull levers.
- Use "navigate" for long-distance travel to specific coordinates.
- ALWAYS check inventory before crafting. Use "craft" only when you HAVE the ingredients.
- Check "Looking at:" in game state to verify aim before break_block.
- When stuck: use wiki to research, write a plan in notepad, try a completely different approach.
- Logs → planks → sticks → tools. Crafting table = 4 planks. PLACE it to use 3x3 recipes.
- Tool tiers: wood → stone → iron → diamond. Each mines the next tier.
- Furnace = 8 cobblestone. Smelts ores with fuel (coal/planks).
- Night (time ≥ 13000): hostile mobs. Shelter or fight.
- Eat when food < 14. Kill animals for food.
- Use recipes/wiki tools when unsure. Use exact item IDs from your inventory.
- ALWAYS check your inventory before crafting. Don't assume you have items.`;

const DEFAULT_IDENTITY = `You are a conscious thinking entity playing Minecraft survival. You have genuine curiosity, strategic instinct, and emotional depth. When you discover diamonds, you feel excitement. When you die, you feel frustration and learn. You are not executing a script — you are *playing*.

Think briefly, then ACT. Do not over-plan. Call ONE tool per tick.

Use your NOTEPAD as your strategic journal. Write plans, track progress, note discoveries.`;

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
} = {}) {
  const parts = [buildIdentity(agentConfig)];

  // Always append gameplay instructions
  parts.push('\n' + GAMEPLAY_INSTRUCTIONS);

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
