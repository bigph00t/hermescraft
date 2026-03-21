// needs.js — Needs calculation and behavior mode detection (pure functions, no imports)

// Hostile mob types for safety calculation
const HOSTILE_MOBS = new Set([
  'zombie', 'skeleton', 'spider', 'creeper', 'enderman', 'witch', 'drowned', 'phantom',
])

// ── Behavior Mode Detection ──

/**
 * Detect current behavior mode based on Minecraft time of day and health.
 * @param {object} state - Game state with `time` (0-24000 ticks) and `health` (0-20)
 * @returns {'work'|'shelter'|'social'|'sleep'}
 */
export function detectBehaviorMode(state) {
  // Safety override — low health means seek shelter regardless of time
  if (state.health < 8) return 'shelter'

  const time = state.time ?? 0

  if (time >= 0 && time < 11500) return 'work'
  if (time >= 11500 && time < 12500) return 'shelter'
  if (time >= 12500 && time < 22000) return 'social'
  return 'sleep' // 22000-24000
}

// ── Needs Calculation ──

/**
 * Calculate four needs scores from game state.
 * @param {object} state - Game state (food, health, nearbyEntities, time, position)
 * @param {object} socialState - { lastChatTimestamp: number, nearbyPlayerCount: number }
 * @param {object} [opts] - Optional: { homePos, lastActivityTimestamp }
 * @returns {{ hunger: number, safety: number, social: number, creative: number, priority: string }}
 */
export function calculateNeeds(state, socialState, opts = {}) {
  const now = Date.now()

  // Hunger: 0 = starving, 100 = full
  const hunger = Math.round(((state.food ?? 20) / 20) * 100)

  // Safety: 0 = danger, 100 = safe
  let safety = 100
  safety -= (20 - (state.health ?? 20)) * 3
  // Check for hostile mobs within 16 blocks
  const nearbyHostile = (state.nearbyEntities || []).some(e => {
    const name = (e.type || e.name || '').toLowerCase()
    return HOSTILE_MOBS.has(name) && (e.distance === undefined || e.distance <= 16)
  })
  if (nearbyHostile) safety -= 20
  // Night penalty when far from home
  const mode = detectBehaviorMode(state)
  if ((mode === 'social' || mode === 'sleep') && opts.homePos && state.position) {
    const dx = state.position.x - opts.homePos.x
    const dz = state.position.z - opts.homePos.z
    const distFromHome = Math.sqrt(dx * dx + dz * dz)
    if (distFromHome > 20) safety -= 15
  }
  safety = clamp(safety, 0, 100)

  // Social: 0 = lonely, 100 = fulfilled
  let social = 50
  if ((socialState.nearbyPlayerCount || 0) > 0) social += 30
  const lastChat = socialState.lastChatTimestamp || 0
  if (lastChat > 0 && (now - lastChat) < 300000) {
    social += 20
  }
  if (lastChat > 0) {
    const minutesSinceChat = (now - lastChat) / 60000
    const penalty = Math.min(50, Math.floor(minutesSinceChat / 10) * 5)
    social -= penalty
  }
  social = clamp(social, 0, 100)

  // Creative: 0 = bored, 100 = engaged
  let creative = 70
  if (opts.lastActivityTimestamp) {
    const minutesSinceActivity = (now - opts.lastActivityTimestamp) / 60000
    creative -= Math.floor(minutesSinceActivity) * 3
  }
  creative = clamp(creative, 0, 100)

  // Priority: lowest score wins, ties broken by safety > hunger > social > creative
  const scores = [
    { name: 'safety', value: safety },
    { name: 'hunger', value: hunger },
    { name: 'social', value: social },
    { name: 'creative', value: creative },
  ]
  // Sort by value ascending, tie-break order is already correct (safety first)
  scores.sort((a, b) => a.value - b.value)
  const priority = scores[0].name

  return { hunger, safety, social, creative, priority }
}

// ── Prompt Formatting ──

/**
 * Format needs into a single-line summary for LLM prompt injection.
 * @param {{ hunger: number, safety: number, social: number, creative: number, priority: string }} needs
 * @returns {string}
 */
export function formatNeedsForPrompt(needs) {
  const label = v => v >= 70 ? 'ok' : v >= 40 ? 'moderate' : 'LOW'
  return `Needs: hunger=${needs.hunger}(${label(needs.hunger)}) safety=${needs.safety}(${label(needs.safety)}) social=${needs.social}(${label(needs.social)}) creative=${needs.creative}(${label(needs.creative)}) -> Priority: ${needs.priority}`
}

// ── Helpers ──

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val))
}
