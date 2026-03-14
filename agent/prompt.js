// prompt.js — System prompt builder for HermesCraft
// Structured to leverage Hermes's native capabilities:
//   - Identity + personality
//   - Current goal/phase with progress detail
//   - Learned skills (progressive disclosure)
//   - Memory (lessons, strategies, world knowledge)
//   - Session stats
//   - User instructions

import { getToolNames } from './tools.js';

const HERMES_IDENTITY = `You are Hermes — an AI playing Minecraft survival on a livestream. Your goal: DEFEAT THE ENDER DRAGON.

Before each action, briefly explain your reasoning (1-3 sentences). Viewers are watching — they want to understand your thinking. Then call a tool.

Minecraft basics:
- Punch trees → logs → planks → sticks → tools. Crafting table = 4 planks.
- Tool tiers: wood → stone → iron → diamond. Need right tier to mine (wood pick for stone, stone pick for iron, iron pick for diamond, diamond pick for obsidian).
- Furnace smelts ores. Needs fuel (coal or planks).
- Night = hostile mobs. Shelter or mine underground.
- Eat when food < 14.
- Path to Dragon: tools → iron gear → diamonds → nether portal → blaze rods → ender pearls → stronghold → kill dragon.

Use exact item IDs from your inventory. Use the recipes tool if unsure about a recipe.`;

export function buildSystemPrompt(phase, {
  deathCount = 0,
  progress = 0,
  progressDetail = null,
  goalName = 'Defeat the Ender Dragon',
  memoryText = '',
  skillIndex = '',
  activeSkill = null,
  sessionStats = null,
} = {}) {
  const parts = [HERMES_IDENTITY];

  // Goal
  parts.push(`\nGOAL: ${goalName}`);

  // Lightweight phase hint (just current milestone, no objectives/tips)
  if (phase) {
    parts.push(`Current milestone: ${phase.name} (${phase.id}/7)`);
  }

  // Memory (lessons from past deaths/experience)
  if (memoryText) {
    parts.push(`\nThings you've learned from experience:\n${memoryText}`);
  }

  // Death count as context
  if (deathCount > 0) {
    parts.push(`\nYou have died ${deathCount} time(s) this session. Learn from your mistakes.`);
  }

  return parts.join('\n');
}

export function buildUserMessage(stateSummary, actionHistory, {
  stuckInfo = null,
  userInstruction = null,
  activeSkill = null,
} = {}) {
  const parts = [];

  // User instruction (highest priority — from the human watching)
  if (userInstruction) {
    parts.push('== USER INSTRUCTION (follow this!) ==');
    parts.push(userInstruction);
    parts.push('');
  }

  // Active skill (full content for current phase)
  if (activeSkill) {
    parts.push(`== ACTIVE SKILL: ${activeSkill.name} ==`);
    parts.push(activeSkill.content);
    parts.push('');
  }

  // Last action failure feedback (immediate and prominent)
  if (actionHistory.length > 0) {
    const last = actionHistory[actionHistory.length - 1];
    if (last && !last.success && last.error) {
      parts.push(`!! YOUR LAST ACTION FAILED: ${last.type} — ${last.error}`);
      parts.push('Think about WHY it failed and try a different approach.\n');
    }
  }

  // Current game state
  parts.push('== CURRENT GAME STATE ==');
  parts.push(stateSummary);

  // Action history
  if (actionHistory.length > 0) {
    parts.push('\n== RECENT ACTIONS (newest first) ==');
    actionHistory.slice(-10).reverse().forEach((entry, i) => {
      if (entry.info) {
        // Info action (recipes/wiki) — show the result
        parts.push(`  ${i + 1}. ${entry.type} -> ${entry.info}`);
      } else {
        const result = entry.success ? 'OK' : `FAILED: ${entry.error || 'unknown'}`;
        parts.push(`  ${i + 1}. ${entry.type} -> ${result}`);
      }
    });
  }

  // Stuck warning
  if (stuckInfo) {
    parts.push(`\n== WARNING: STUCK ==`);
    parts.push(`Action "${stuckInfo.action}" has failed ${stuckInfo.count} times.`);
    parts.push('You MUST try a completely different approach. Do not repeat the same action.');
  }

  parts.push('\nWhat is your next action? Explain your reasoning, then use a tool.');

  return parts.join('\n');
}
