// skills.js — agentskills.io compatible skill system for HermesCraft
// Skills are procedural memory: strategies the agent learns from gameplay
// Format follows the agentskills.io specification (SKILL.md with YAML frontmatter)

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, 'skills');

let skills = [];  // Loaded skill objects

// ── Load Skills ──

export function loadSkills() {
  skills = [];

  if (!existsSync(SKILLS_DIR)) {
    mkdirSync(SKILLS_DIR, { recursive: true });
    return skills;
  }

  const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const dir of dirs) {
    const skillFile = join(SKILLS_DIR, dir, 'SKILL.md');
    if (!existsSync(skillFile)) continue;

    try {
      const content = readFileSync(skillFile, 'utf-8');
      const skill = parseSkillMd(content, dir);
      if (skill) skills.push(skill);
    } catch {}
  }

  return skills;
}

// ── Parse SKILL.md ──

function parseSkillMd(content, dirName) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) return null;

  const frontmatter = parseFrontmatter(frontmatterMatch[1]);
  const body = frontmatterMatch[2].trim();

  return {
    name: frontmatter.name || dirName,
    description: frontmatter.description || '',
    metadata: frontmatter.metadata || {},
    phase: parseInt(frontmatter.metadata?.phase) || null,
    body,
    path: join(SKILLS_DIR, dirName, 'SKILL.md'),
  };
}

function parseFrontmatter(text) {
  const result = { metadata: {} };
  let inMetadata = false;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === 'metadata:') {
      inMetadata = true;
      continue;
    }

    if (inMetadata && line.startsWith('    ')) {
      const [key, ...rest] = trimmed.split(':');
      if (key && rest.length > 0) {
        result.metadata[key.trim()] = rest.join(':').trim().replace(/^["']|["']$/g, '');
      }
    } else {
      inMetadata = false;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        const value = trimmed.slice(colonIdx + 1).trim();
        if (key !== 'metadata') {
          result[key] = value.replace(/^["']|["']$/g, '');
        }
      }
    }
  }

  return result;
}

// ── Skill Index (for system prompt — progressive disclosure) ──

export function getSkillIndex() {
  if (skills.length === 0) return '';

  const lines = ['Available learned skills:'];
  for (const skill of skills) {
    lines.push(`  - ${skill.name}: ${skill.description}`);
  }
  return lines.join('\n');
}

// ── Active Skill (for user message — full content) ──

export function getActiveSkill(phase) {
  if (!phase) return null;

  // Find skill matching current phase
  const phaseSkill = skills.find(s => s.phase === phase.id);

  // Also include general skills (phase 0) — core knowledge
  const generalSkills = skills.filter(s => s.phase === 0);

  const parts = [];
  if (phaseSkill) {
    parts.push(`[${phaseSkill.name}]\n${phaseSkill.body}`);
  }
  // Only include 1 general skill to save tokens
  if (generalSkills.length > 0) {
    parts.push(`[${generalSkills[0].name}]\n${generalSkills[0].body}`);
  }

  if (parts.length === 0) return null;

  return {
    name: phaseSkill?.name || generalSkills[0]?.name || 'general',
    content: parts.join('\n\n'),
  };
}

// ── Create Skill from Phase Completion ──

export function createSkillFromPhase(phase, actionHistory, deathCount, lessonsLearned) {
  const skillName = `minecraft-${phase.name.toLowerCase().replace(/\s+/g, '-')}`;
  const skillDir = join(SKILLS_DIR, skillName);

  // Don't overwrite existing skills — update instead
  if (existsSync(join(skillDir, 'SKILL.md'))) {
    updateSkill(skillName, { deathCount, lessonsLearned });
    return { name: skillName, created: false, updated: true };
  }

  mkdirSync(skillDir, { recursive: true });

  // Build strategy from action history
  const keyActions = extractKeyActions(actionHistory);
  const lessons = lessonsLearned || [];

  const content = renderSkillMd({
    name: skillName,
    description: `${phase.description} Use when in phase ${phase.id} (${phase.name}).`,
    phase: phase.id,
    deathCount,
    keyActions,
    objectives: phase.objectives || [],
    tips: phase.tips || [],
    lessons,
  });

  writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8');

  // Reload skills
  loadSkills();

  return { name: skillName, created: true, updated: false };
}

// ── Update Existing Skill ──

export function updateSkill(skillName, updates) {
  const skill = skills.find(s => s.name === skillName);
  if (!skill) return false;

  let content;
  try {
    content = readFileSync(skill.path, 'utf-8');
  } catch {
    return false; // Skill file was deleted externally
  }

  // Add new lessons
  if (updates.lessonsLearned && updates.lessonsLearned.length > 0) {
    const lessonsSection = updates.lessonsLearned
      .map(l => `- ${l}`)
      .join('\n');

    if (content.includes('## Lessons Learned')) {
      // Append to existing lessons section
      content = content.replace(
        /(## Lessons Learned\n)([\s\S]*?)(\n## |\n*$)/,
        (match, header, existing, tail) => {
          // Deduplicate
          const existingLessons = existing.trim().split('\n').filter(l => l.startsWith('- '));
          const newLessons = updates.lessonsLearned
            .filter(l => !existingLessons.some(el => el.includes(l.split('.')[0])))
            .map(l => `- ${l}`);
          return header + existing.trim() + '\n' + newLessons.join('\n') + tail;
        }
      );
    } else {
      content += `\n## Lessons Learned\n\n${lessonsSection}\n`;
    }
  }

  // Update metadata counters
  if (updates.deathCount !== undefined) {
    content = content.replace(
      /deaths_before_mastery: "\d+"/,
      `deaths_before_mastery: "${updates.deathCount}"`
    );
  }

  writeFileSync(skill.path, content, 'utf-8');
  loadSkills();  // Reload
  return true;
}

// ── Record Skill Outcome ──

export function recordSkillOutcome(phase, success) {
  const skillName = `minecraft-${phase.name.toLowerCase().replace(/\s+/g, '-')}`;
  const skill = skills.find(s => s.name === skillName);
  if (!skill) return;

  // Update success rate in metadata
  const currentRate = parseFloat(skill.metadata.success_rate || '0.5');
  const newRate = success
    ? Math.min(1, currentRate + 0.1)
    : Math.max(0, currentRate - 0.1);

  try {
    let content = readFileSync(skill.path, 'utf-8');
    content = content.replace(
      /success_rate: "[^"]*"/,
      `success_rate: "${newRate.toFixed(1)}"`
    );
    writeFileSync(skill.path, content, 'utf-8');
  } catch {
    // Skill file missing or unwritable — skip update
  }
}

// ── Helpers ──

function extractKeyActions(actionHistory) {
  if (!actionHistory || actionHistory.length === 0) return [];

  // Extract unique successful action types in order
  const seen = new Set();
  const key = [];
  for (const entry of actionHistory) {
    if (entry.success && !seen.has(entry.type)) {
      seen.add(entry.type);
      key.push(entry.type);
    }
  }
  return key;
}

function renderSkillMd({ name, description, phase, deathCount, keyActions, objectives, tips, lessons }) {
  const lines = [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    'license: MIT',
    'metadata:',
    `    author: hermescraft`,
    `    version: "1.0"`,
    `    phase: "${phase}"`,
    `    deaths_before_mastery: "${deathCount || 0}"`,
    `    success_rate: "1.0"`,
    '---',
    '',
    '## Strategy',
    '',
  ];

  // Add objectives as numbered steps
  objectives.forEach((obj, i) => {
    lines.push(`${i + 1}. ${obj}`);
  });

  if (tips.length > 0) {
    lines.push('', '## Tips', '');
    tips.forEach(tip => lines.push(`- ${tip}`));
  }

  if (lessons.length > 0) {
    lines.push('', '## Lessons Learned', '');
    lessons.forEach(lesson => lines.push(`- ${lesson}`));
  }

  if (keyActions.length > 0) {
    lines.push('', '## Key Actions Used', '');
    lines.push(`Action sequence: ${keyActions.join(' -> ')}`);
  }

  lines.push('');
  return lines.join('\n');
}

export function getSkillCount() {
  return skills.length;
}
