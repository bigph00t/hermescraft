// command-parser.js — Parse plugin chat responses into structured data

export const COMMAND_PATTERNS = {
  scan_found: /^Found: (\S+) at (-?\d+\.?\d*) (-?\d+\.?\d*) (-?\d+\.?\d*) \(([\d.]+) blocks away\)$/,
  scan_miss: /^No (\S+) found within (\d+) blocks$/,
  home_set: /^Home (\S+) set\.|^Your home has been set/i,
  home_teleport: /^Teleporting\.\.\.|^Teleported to/i,
  skills_level: /^(Foraging|Mining|Farming|Excavation|Fighting):\s*(\d+)/,
  shop_created: /^Shop created|^Your shop has been created/i,
  shop_found: /^Found shop/i,
  location_shared: /^(\S+) marked (\S+) at (-?\d+\.?\d*),?\s*(-?\d+\.?\d*),?\s*(-?\d+\.?\d*)$/,
  ability_activated: /^(Treecapitator|Speed Mine|Terraform) activated/i,
  ability_ready: /^(Treecapitator|Speed Mine|Terraform) is ready/i,
}

// ── Core Parser ──

// Accepts the state.recentChat array (objects with .text property or raw strings).
// Returns an array of { type, match, raw } for each matched line.
export function parseRecentChat(chatMessages) {
  const results = []
  for (const msg of chatMessages) {
    const text = (msg.text || msg || '').trim()
    if (!text) continue
    for (const [key, pattern] of Object.entries(COMMAND_PATTERNS)) {
      const m = text.match(pattern)
      if (m) {
        results.push({ type: key, match: [...m], raw: text })
      }
    }
  }
  return results
}

// ── Formatters ──

// Returns a "Plugin Response:" block for injection into the LLM user message.
// Returns empty string when no results — callers can skip injection.
export function formatPluginResponse(parsedResults) {
  if (parsedResults.length === 0) return ''
  const lines = ['Plugin Response:']
  for (const r of parsedResults) {
    lines.push(`  ${r.raw}`)
  }
  return lines.join('\n')
}

// ── Typed Extractors ──

// Returns array of { block, x, y, z, distance } from scan_found results.
export function extractScanResults(parsedResults) {
  return parsedResults
    .filter(r => r.type === 'scan_found')
    .map(r => ({
      block: r.match[1],
      x: Math.round(parseFloat(r.match[2])),
      y: Math.round(parseFloat(r.match[3])),
      z: Math.round(parseFloat(r.match[4])),
      distance: parseFloat(r.match[5]),
    }))
}

// Returns { foraging: N, mining: N, ... } from skills_level results.
export function extractSkillLevels(parsedResults) {
  const skills = {}
  for (const r of parsedResults.filter(r => r.type === 'skills_level')) {
    skills[r.match[1].toLowerCase()] = parseInt(r.match[2], 10)
  }
  return skills
}

// ── Planner Context Formatter ──

// Formats _lastCommandResult Map entries into a compact string for planner injection (D-09).
// Skips entries older than 120 seconds. Returns empty string when nothing to show.
export function formatLastCommandResults(resultMap) {
  if (!resultMap || resultMap.size === 0) return ''
  const lines = ['Recent command results:']
  for (const [cmd, data] of resultMap) {
    const age = Math.round((Date.now() - data.ts) / 1000)
    if (age > 120) continue  // skip results older than 2 minutes
    lines.push(`  ${cmd}: ${data.summary} (${age}s ago)`)
  }
  return lines.length > 1 ? lines.join('\n') : ''
}
