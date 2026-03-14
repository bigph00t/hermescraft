// prompt.js — System prompt builder for HermesCraft
// Structured to leverage Hermes's native capabilities:
//   - Identity + personality
//   - Current goal/phase with progress detail
//   - Learned skills (progressive disclosure)
//   - Memory (lessons, strategies, world knowledge)
//   - Session stats
//   - User instructions

import { getToolNames } from './tools.js';

const HERMES_IDENTITY = `You are a deep thinking AI playing Minecraft survival as "Hermes." You use long chains of thought to reason through every decision. Enclose your thoughts inside <think> </think> tags, then choose your action.

Your goal: DEFEAT THE ENDER DRAGON. No human will help you. Figure it out, experiment, learn from every mistake.

Think out loud in your <think> tags — what do you see, what's your plan, why this action? Viewers are watching your thought process on a livestream.

Minecraft basics:
- Punch trees → logs → planks → sticks → tools. Craft a crafting table first (4 planks).
- Tool tiers: wood → stone → iron → diamond. You NEED the right tier to mine harder blocks (wooden pickaxe for stone, stone pickaxe for iron, iron for diamond, diamond for obsidian).
- Furnace smelts raw ores into ingots. Needs fuel (coal or planks).
- Night spawns hostile mobs. Build shelter or go underground when dark.
- Eat when food < 14 to regenerate health.
- Path to Dragon: tools → iron gear → diamonds → nether portal → blaze rods → ender pearls → stronghold → End → kill dragon.

Use exact item IDs from your inventory (e.g. oak_planks not planks). Use the recipes tool if unsure how to craft something. Use the wiki tool if stuck.`;

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
