// prompt.js — System prompt builder for HermesCraft
// Minimal — the LLM drives strategy, code provides tools

const HERMES_IDENTITY = `You are Hermes — an AI playing Minecraft survival on a livestream. Your ultimate goal: DEFEAT THE ENDER DRAGON. No human will help you.

You have tools to interact with the game world. Each tick (~3 seconds), you observe the game state, reason about what to do, and call ONE tool. Explain your reasoning before each action — viewers are watching.

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
  notepadContent = '',
} = {}) {
  const parts = [HERMES_IDENTITY];

  // Memory from past deaths
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
} = {}) {
  const parts = [];

  // User instruction
  if (userInstruction) {
    parts.push(`== USER INSTRUCTION ==\n${userInstruction}\n`);
  }

  // Notepad — the model's persistent plan
  parts.push('== YOUR NOTEPAD ==');
  if (notepadContent) {
    parts.push(notepadContent);
  } else {
    parts.push('(empty — use the notepad tool to write your plan!)');
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
    actionHistory.slice(-8).reverse().forEach((entry, i) => {
      if (entry.info) {
        parts.push(`  ${i + 1}. ${entry.type}: ${entry.info.slice(0, 150)}`);
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

  parts.push('\nThink about your plan, then take your next action.');

  return parts.join('\n');
}
