// skills.js — agentskills.io compatible skill system for HermesCraft
// Skills are procedural memory: strategies the agent learns from gameplay
// Format follows the agentskills.io specification (SKILL.md with YAML frontmatter)

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHARED_SKILLS_DIR = join(__dirname, 'skills');
let SKILLS_DIR = SHARED_SKILLS_DIR;

let skills = [];  // Loaded skill objects

let skillsAgentConfig = null;

export function initSkills(config) {
  skillsAgentConfig = config;
  SKILLS_DIR = join(config.dataDir, 'skills');
  if (!existsSync(SKILLS_DIR)) mkdirSync(SKILLS_DIR, { recursive: true });
}

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

  // Also load shared seed skills (read-only fallbacks)
  if (SKILLS_DIR !== SHARED_SKILLS_DIR && existsSync(SHARED_SKILLS_DIR)) {
    const loadedNames = new Set(skills.map(s => s.name));
    const sharedDirs = readdirSync(SHARED_SKILLS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const dir of sharedDirs) {
      const skillFile = join(SHARED_SKILLS_DIR, dir, 'SKILL.md');
      if (!existsSync(skillFile)) continue;

      try {
        const content = readFileSync(skillFile, 'utf-8');
        const skill = parseSkillMd(content, dir);
        if (skill && !loadedNames.has(skill.name)) {
          skills.push(skill);
        }
      } catch {}
    }
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

// ── Active Skill (multi-signal selection) ──

// Keyword banks for signal matching
const SKILL_KEYWORDS = {
  combat: ['fight', 'kill', 'attack', 'defend', 'mob', 'monster', 'zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'blaze', 'wither', 'dragon', 'hostile', 'sword', 'bow', 'shield', 'armor'],
  building: ['build', 'house', 'shelter', 'wall', 'roof', 'floor', 'door', 'window', 'tower', 'bridge', 'farm', 'base', 'structure', 'construct', 'place'],
  mining: ['mine', 'dig', 'ore', 'diamond', 'iron', 'gold', 'coal', 'stone', 'cave', 'tunnel', 'pickaxe', 'excavate', 'strip', 'branch'],
  crafting: ['craft', 'recipe', 'table', 'furnace', 'smelt', 'tool', 'armor', 'enchant', 'anvil', 'brew'],
  exploration: ['explore', 'find', 'discover', 'travel', 'navigate', 'nether', 'end', 'village', 'temple', 'fortress', 'stronghold', 'biome'],
  survival: ['survive', 'food', 'hunger', 'eat', 'farm', 'breed', 'cook', 'first-night', 'shelter', 'bed'],
  gathering: ['gather', 'collect', 'harvest', 'wood', 'log', 'resource', 'material', 'chop'],
}

function scoreSkill(skill, { phase, mode, goalText, gameState }) {
  let score = 0

  // Signal 1: Phase match (strongest for phased mode)
  if (mode === 'phased' && phase && skill.phase === phase.id) {
    score += 100
  }

  // Signal 2: Goal text keyword matching (strongest for directed mode)
  if (goalText) {
    const goalLower = goalText.toLowerCase()
    const skillText = `${skill.name} ${skill.description} ${skill.body}`.toLowerCase()
    for (const [category, keywords] of Object.entries(SKILL_KEYWORDS)) {
      const goalHasCategory = keywords.some(kw => goalLower.includes(kw))
      const skillHasCategory = keywords.some(kw => skillText.includes(kw))
      if (goalHasCategory && skillHasCategory) {
        score += 30
      }
    }
  }

  // Signal 3: Game state context
  if (gameState) {
    // Low health + combat skill = high priority
    if ((gameState.health || 20) < 10) {
      const isCombatSkill = skill.name.includes('combat') || skill.name.includes('survival') || skill.body?.includes('flee')
      if (isCombatSkill) score += 50
    }
    // Night time + survival skill
    if ((gameState.time || 0) >= 13000) {
      const isSurvivalSkill = skill.name.includes('first-night') || skill.name.includes('survival')
      if (isSurvivalSkill) score += 20
    }
  }

  // Signal 4: Skill success rate as tiebreaker
  const successRate = parseFloat(skill.metadata?.success_rate || '0.5')
  score += successRate * 5

  return score
}

export function getActiveSkill(phase, { mode, goalText, gameState } = {}) {
  if (skills.length === 0) return null

  // Use config mode as fallback
  const effectiveMode = mode || (skillsAgentConfig && skillsAgentConfig.mode) || 'open_ended'
  const effectiveGoal = goalText || (skillsAgentConfig && skillsAgentConfig.goal) || ''

  // Score all skills
  const scored = skills.map(skill => ({
    skill,
    score: scoreSkill(skill, { phase, mode: effectiveMode, goalText: effectiveGoal, gameState }),
  }))

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Take top skill (must have score > 0), plus general skills
  const topSkill = scored[0]?.score > 0 ? scored[0].skill : null
  const generalSkills = skills.filter(s => s.phase === 0)

  const parts = []
  if (topSkill) {
    parts.push(`[${topSkill.name}]\n${topSkill.body}`)
  }
  // Include 1 general skill if it's different from topSkill
  if (generalSkills.length > 0 && (!topSkill || generalSkills[0].name !== topSkill.name)) {
    parts.push(`[${generalSkills[0].name}]\n${generalSkills[0].body}`)
  }

  // Fallback: if nothing scored, try returning first available skill
  if (parts.length === 0 && skills.length > 0) {
    const fallback = skills[0]
    return { name: fallback.name, content: fallback.body }
  }

  if (parts.length === 0) return null

  return {
    name: topSkill?.name || generalSkills[0]?.name || 'general',
    content: parts.join('\n\n'),
  }
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

    // Promote high-performing experience skills to shared directory
    if (newRate >= 0.85) {
      promoteToShared(skillName)
    }
  } catch {
    // Skill file missing or unwritable — skip update
  }
}

// ── Promote Per-Agent Skill to Shared ──

export function promoteToShared(skillName) {
  // Only promote experience skills
  if (!skillName.startsWith('exp-')) return false
  const agentSkillPath = join(SKILLS_DIR, skillName, 'SKILL.md')
  const sharedSkillPath = join(SHARED_SKILLS_DIR, `shared-${skillName}`, 'SKILL.md')
  if (!existsSync(agentSkillPath)) return false
  if (existsSync(sharedSkillPath)) return false // already promoted
  try {
    mkdirSync(join(SHARED_SKILLS_DIR, `shared-${skillName}`), { recursive: true })
    const content = readFileSync(agentSkillPath, 'utf-8')
    writeFileSync(sharedSkillPath, content)
    console.log(`[Skills] Promoted ${skillName} to shared skills`)
    return true
  } catch { return false }
}

// ── Experience-Based Skill Creation ──

const MAX_EXPERIENCE_SKILLS = 15

export function createSkillFromExperience(skillName, description, strategy, context = {}) {
  const sanitized = skillName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 60)
  const dirName = 'exp-' + sanitized

  const skillPath = join(SKILLS_DIR, dirName, 'SKILL.md')

  // If skill already exists, update it instead
  if (existsSync(skillPath)) {
    updateSkill(dirName, { lessonsLearned: [strategy.slice(0, 200)] })
    return { name: dirName, created: false, updated: true }
  }

  // Cap experience-based skills at MAX_EXPERIENCE_SKILLS
  if (existsSync(SKILLS_DIR)) {
    const expDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name.startsWith('exp-'))
      .map(d => d.name)

    if (expDirs.length >= MAX_EXPERIENCE_SKILLS) {
      // Find lowest success_rate among experience skills and evict it
      let lowestRate = Infinity
      let lowestDir = null
      for (const ed of expDirs) {
        const s = skills.find(sk => sk.name === ed)
        const rate = s ? parseFloat(s.metadata?.success_rate || '0.5') : 0.5
        if (rate < lowestRate) {
          lowestRate = rate
          lowestDir = ed
        }
      }
      if (lowestDir) {
        rmSync(join(SKILLS_DIR, lowestDir), { recursive: true })
      }
    }
  }

  // Create the skill directory and SKILL.md
  const skillDir = join(SKILLS_DIR, dirName)
  mkdirSync(skillDir, { recursive: true })

  const content = renderSkillMd({
    name: dirName,
    description,
    phase: 0,
    deathCount: context.deathCount || 0,
    keyActions: [],
    objectives: strategy.split('\n').filter(l => l.trim()).slice(0, 8),
    tips: [],
    lessons: [],
  })

  writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8')
  loadSkills()

  return { name: dirName, created: true, updated: false }
}

// ── Downgrade Skill by Name ──

export function downgradeSkillByName(skillName) {
  const skill = skills.find(s => s.name === skillName)
  if (!skill) return false

  try {
    let content = readFileSync(skill.path, 'utf-8')
    const currentRate = parseFloat(skill.metadata?.success_rate || '0.5')
    const newRate = Math.max(0, currentRate - 0.15)
    content = content.replace(
      /success_rate: "[^"]*"/,
      `success_rate: "${newRate.toFixed(2)}"`
    )
    writeFileSync(skill.path, content, 'utf-8')
    // Update in-memory too
    if (skill.metadata) skill.metadata.success_rate = newRate.toFixed(2)
    return true
  } catch {
    return false
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
