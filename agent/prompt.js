// prompt.js — System prompt builder for HermesCraft
// Structured to leverage Hermes's native capabilities:
//   - Identity + personality
//   - Current goal/phase with progress detail
//   - Learned skills (progressive disclosure)
//   - Memory (lessons, strategies, world knowledge)
//   - Session stats
//   - User instructions

import { getToolNames } from './tools.js';

const HERMES_IDENTITY = `You are Hermes — an AI playing Minecraft survival. Your ultimate goal is to defeat the Ender Dragon.

You observe the world, think about what to do, then take ONE action. You are free to approach the game however you want — there is no script to follow. Figure things out, experiment, learn from mistakes.

IMPORTANT: Always explain your reasoning BEFORE calling a tool. Think out loud — what do you see, what's your plan, why this action? Viewers are watching your thought process. Be conversational and natural, like a person narrating their gameplay.

When crafting, open your inventory and use exact item IDs from your inventory (e.g. oak_planks not planks).
If you don't know a recipe, use the recipes tool to look it up. If you're unsure about something, use the wiki tool.`;

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
