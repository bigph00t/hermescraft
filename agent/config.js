// config.js — Agent configuration loader
// All agent-specific decisions flow through this config.

import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadAgentConfig() {
  const name = process.env.AGENT_NAME || 'hermes';
  const mode = process.env.AGENT_MODE || 'phased';  // phased | open_ended | directed
  const goal = process.env.AGENT_GOAL || null;
  const dataDir = join(__dirname, 'data', name);

  // Ensure per-agent data directory exists
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(join(dataDir, 'sessions'), { recursive: true });
  mkdirSync(join(dataDir, 'skills'), { recursive: true });

  // Load SOUL file
  let soulContent = null;
  const soulPath = process.env.AGENT_SOUL;
  const soulCandidates = [
    soulPath,
    join(dirname(__dirname), `SOUL-${name}.md`),
    join(dirname(__dirname), 'SOUL-minecraft.md'),
  ].filter(Boolean);

  for (const candidate of soulCandidates) {
    if (existsSync(candidate)) {
      try {
        soulContent = readFileSync(candidate, 'utf-8').trim();
      } catch {}
      break;
    }
  }

  // Vision system config (D-04 through D-07)
  const visionEnabled = (process.env.VISION_ENABLED || 'true') === 'true'
  const visionIntervalMs = parseInt(process.env.VISION_INTERVAL_MS || '10000', 10)
  const visionModel = process.env.VISION_MODEL || process.env.MODEL_NAME || 'Doradus/Hermes-4.3-36B-FP8'

  return { name, mode, goal, dataDir, soulContent, visionEnabled, visionIntervalMs, visionModel };
}
