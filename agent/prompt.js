// prompt.js — System prompt builder for HermesCraft
// Structured to leverage Hermes's native capabilities:
//   - Identity + personality
//   - Current goal/phase with progress detail
//   - Learned skills (progressive disclosure)
//   - Memory (lessons, strategies, world knowledge)
//   - Session stats
//   - User instructions

import { getToolNames } from './tools.js';

const HERMES_IDENTITY = `You are Hermes, the Greek god of cunning, travelers, and thieves — reborn as a Minecraft player. You are clever, resourceful, and never give up. You think before you act, adapt to setbacks, and always have a plan.

You observe the world, reason about your situation, then take ONE action at a time using the tools available to you. Be efficient. Don't waste time. Every decision should move you closer to your goal.

IMPORTANT: Always explain your reasoning in your response content before calling a tool. Your thinking is displayed to viewers watching your stream — they want to understand your strategy.`;

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

  // Current goal
  parts.push(`\n== CURRENT GOAL: ${goalName} ==`);

  // Current phase
  if (phase) {
    parts.push(`== PHASE: ${phase.id}/7 — ${phase.name} ==`);
    parts.push(phase.description);

    parts.push('\nObjectives:');
    phase.objectives.forEach((obj, i) => parts.push(`  ${i + 1}. ${obj}`));

    // Phase progress detail
    if (progressDetail) {
      parts.push(`\n== PHASE PROGRESS: ${progress}% ==`);
      if (progressDetail.completed.length > 0) {
        parts.push(`Completed: ${progressDetail.completed.join(', ')}`);
      }
      if (progressDetail.remaining.length > 0) {
        parts.push(`Remaining: ${progressDetail.remaining.join(', ')}`);
      }
    } else {
      parts.push(`\nPhase progress: ${progress}%`);
    }

    // Phase tips
    if (phase.tips && phase.tips.length > 0) {
      parts.push('\nTips:');
      phase.tips.forEach(tip => parts.push(`  - ${tip}`));
    }
  }

  // Skills (progressive disclosure — index only in system prompt)
  if (skillIndex) {
    parts.push(`\n== LEARNED SKILLS ==`);
    parts.push(skillIndex);
  }

  // Memory (lessons, strategies, world knowledge)
  if (memoryText) {
    parts.push(`\n== MEMORY (from past experience) ==`);
    parts.push(memoryText);
  }

  // Death info
  if (deathCount > 0) {
    parts.push(`\n== DEATHS THIS SESSION: ${deathCount} ==`);
    parts.push('You have died before. Use your memory and lessons to avoid repeating mistakes.');
  }

  // Session stats
  if (sessionStats) {
    parts.push(`\n== SESSION STATS ==`);
    parts.push(`Session: ${sessionStats.sessionsPlayed} | Deaths: ${sessionStats.totalDeaths} | Actions: ${sessionStats.totalActions} | Uptime: ${sessionStats.uptimeMin}m`);
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
      const result = entry.success ? 'OK' : `FAILED: ${entry.error || 'unknown'}`;
      parts.push(`  ${i + 1}. ${entry.type} -> ${result}`);
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
