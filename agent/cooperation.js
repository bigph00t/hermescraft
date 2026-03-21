// cooperation.js — Chat-based coordination awareness for multi-agent cooperation
import { getRecentChats } from './chat-history.js'

const FIVE_MINUTES_MS = 5 * 60 * 1000

// ── Activity Detection ──

const ACTIVITY_PATTERNS = {
  mining: /\b(mining|getting|gathering|chopping|digging|collecting)\b/i,
  building: /\b(building|constructing|making a|working on)\b/i,
  farming: /\b(farming|planting|harvesting|fishing)\b/i,
  exploring: /\b(exploring|checking out|heading to|going to)\b/i,
}

/**
 * Scan recent chat messages for activity announcements.
 * Returns array of { player, activity, raw }.
 */
export function parseOtherActivities(chats, selfName) {
  const now = Date.now()
  const results = []

  for (const chat of chats) {
    if (chat.sender === selfName) continue
    if (now - new Date(chat.timestamp).getTime() > FIVE_MINUTES_MS) continue

    for (const [activity, pattern] of Object.entries(ACTIVITY_PATTERNS)) {
      if (pattern.test(chat.message)) {
        results.push({ player: chat.sender, activity, raw: chat.message })
        break // one activity per message
      }
    }
  }

  return results
}

// ── Resource Need Detection ──

const NEED_PATTERNS = [
  /\b(?:needs?|need)\s+(\w+(?:\s+\w+){0,2})/i,
  /\blooking for\s+(\w+(?:\s+\w+){0,2})/i,
  /\banyone have\s+(\w+(?:\s+\w+){0,2})/i,
  /\bout of\s+(\w+(?:\s+\w+){0,2})/i,
  /\brunning low on\s+(\w+(?:\s+\w+){0,2})/i,
]

/**
 * Scan chat for resource need mentions.
 * Returns array of { player, item, raw }.
 */
export function parseResourceNeeds(chats, selfName) {
  const now = Date.now()
  const results = []

  for (const chat of chats) {
    if (chat.sender === selfName) continue
    if (now - new Date(chat.timestamp).getTime() > FIVE_MINUTES_MS) continue

    for (const pattern of NEED_PATTERNS) {
      const match = chat.message.match(pattern)
      if (match) {
        results.push({ player: chat.sender, item: match[1].trim(), raw: chat.message })
        break // one need per message
      }
    }
  }

  return results
}

// ── Build Project Detection ──

const BUILD_PATTERNS = [
  /\blet'?s build\s+(?:a\s+)?(\w+(?:\s+\w+){0,2})/i,
  /\bshould we build\s+(?:a\s+)?(\w+(?:\s+\w+){0,2})/i,
  /\bbuilding a\s+(\w+(?:\s+\w+){0,2})/i,
  /\bstarted a\s+(\w+(?:\s+\w+){0,2})/i,
]

const LOCATION_PATTERNS = [
  /\bat\s+(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)/i,
  /\bnear\s+(?:the\s+)?(\w+(?:\s+\w+){0,2})/i,
  /\bby\s+the\s+(\w+(?:\s+\w+){0,2})/i,
]

/**
 * Scan chat for collective build discussions.
 * Returns array of { player, project, location, raw }.
 */
export function parseBuildProjects(chats, selfName) {
  const now = Date.now()
  const results = []

  for (const chat of chats) {
    if (chat.sender === selfName) continue
    if (now - new Date(chat.timestamp).getTime() > FIVE_MINUTES_MS) continue

    for (const pattern of BUILD_PATTERNS) {
      const match = chat.message.match(pattern)
      if (match) {
        // Try to extract location from same message
        let location = null
        for (const locPattern of LOCATION_PATTERNS) {
          const locMatch = chat.message.match(locPattern)
          if (locMatch) {
            if (locMatch[2]) {
              // coordinate pattern
              location = `${locMatch[1]},${locMatch[2]},${locMatch[3]}`
            } else {
              location = locMatch[1]
            }
            break
          }
        }

        results.push({ player: chat.sender, project: match[1].trim(), location, raw: chat.message })
        break // one project per message
      }
    }
  }

  return results
}

// ── Master Cooperation Context ──

/**
 * Build cooperation context string for planner injection.
 * Returns formatted string or empty string if no signals found.
 * @param {Array} chats - from getRecentChats
 * @param {string} selfName - agent's own name
 * @param {Array<{item: string, count: number}>} inventory - agent's inventory
 */
export function getCooperationContext(chats, selfName, inventory) {
  const activities = parseOtherActivities(chats, selfName)
  const needs = parseResourceNeeds(chats, selfName)
  const builds = parseBuildProjects(chats, selfName)

  if (activities.length === 0 && needs.length === 0 && builds.length === 0) {
    return ''
  }

  const lines = ['== COOPERATION ==']

  if (activities.length > 0) {
    const summary = activities.map(a => `${a.player} is ${a.activity}`).join(', ')
    lines.push('Others: ' + summary)
  }

  if (needs.length > 0) {
    for (const need of needs) {
      const have = inventory.find(i =>
        i.item.toLowerCase().includes(need.item.toLowerCase()) ||
        need.item.toLowerCase().includes(i.item.toLowerCase())
      )
      if (have) {
        lines.push(`Need: ${need.player} needs ${need.item} -- you have ${have.count} ${have.item}, consider dropping some`)
      } else {
        lines.push(`Need: ${need.player} needs ${need.item}`)
      }
    }
  }

  if (builds.length > 0) {
    const b = builds[0]
    const loc = b.location ? ` ${b.location}` : ''
    lines.push(`Build: ${b.player} started ${b.project}${loc} -- consider helping`)
  }

  lines.push('Suggest: Announce what YOU are doing via chat')

  return lines.join('\n')
}
