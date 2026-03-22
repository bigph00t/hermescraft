// social.js -- Player relationship tracking, sentiment scoring, partner awareness

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

let PLAYERS_FILE = ''
let players = {}

export function initSocial(config) {
  PLAYERS_FILE = join(config.dataDir, 'players.json')
  const dir = dirname(PLAYERS_FILE)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  if (existsSync(PLAYERS_FILE)) {
    try { players = JSON.parse(readFileSync(PLAYERS_FILE, 'utf-8')) } catch { players = {} }
  }

  // Seed partner entry at acquaintance level if not already known
  if (config.partnerName && !players[config.partnerName]) {
    players[config.partnerName] = {
      first_met: new Date().toISOString(),
      interactions: [],
      notable_interactions: [],
      sentiment: 3,       // start as acquaintance, not stranger
      relationship: 'acquaintance',
    }
  }
}

export function trackPlayer(name, interaction) {
  // interaction: { type: 'chat'|'gave_item'|'attacked'|'near', detail: string }
  if (!name) return

  if (!players[name]) {
    players[name] = {
      first_met: new Date().toISOString(),
      interactions: [],
      notable_interactions: [],
      sentiment: 0,
      relationship: 'stranger',
    }
  }

  const p = players[name]

  // Apply sentiment decay before updating — stale relationships fade toward neutral
  if (p.last_seen) {
    const hoursSinceLastSeen = (Date.now() - new Date(p.last_seen).getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastSeen > 0) {
      const decay = Math.min(Math.abs(p.sentiment), hoursSinceLastSeen * 0.1)
      if (p.sentiment > 0) p.sentiment -= decay
      else if (p.sentiment < 0) p.sentiment += decay
    }
  }

  p.last_seen = new Date().toISOString()
  p.interactions.push({ ...interaction, timestamp: new Date().toISOString() })
  // Keep last 20 interactions
  if (p.interactions.length > 20) p.interactions = p.interactions.slice(-20)

  // Track notable interactions (gave_item, attacked) — max 5
  if (!p.notable_interactions) p.notable_interactions = []
  if (interaction.type === 'gave_item' || interaction.type === 'attacked') {
    p.notable_interactions.push({ ...interaction, timestamp: new Date().toISOString() })
    if (p.notable_interactions.length > 5) p.notable_interactions.shift()
  }

  // Update sentiment: chat +0.5, gave_item +2, attacked -3
  if (interaction.type === 'gave_item') p.sentiment = Math.min(10, p.sentiment + 2)
  if (interaction.type === 'attacked') p.sentiment = Math.max(-10, p.sentiment - 3)
  if (interaction.type === 'chat') p.sentiment = Math.min(10, p.sentiment + 0.5)

  // Update relationship level
  if (p.sentiment >= 5) p.relationship = 'friend'
  else if (p.sentiment >= 2) p.relationship = 'acquaintance'
  else if (p.sentiment <= -3) p.relationship = 'hostile'
  else p.relationship = 'stranger'
}

export function getPlayersForPrompt(bot) {
  if (Object.keys(players).length === 0) return ''

  // Determine who is nearby using bot.players and bot.entities
  const nearbyNames = new Set()
  if (bot && bot.players) {
    for (const [pName, pData] of Object.entries(bot.players)) {
      if (pData.entity) nearbyNames.add(pName)
    }
  }
  if (bot && bot.entities) {
    for (const entity of Object.values(bot.entities)) {
      if (entity.type === 'player' && entity.username) {
        nearbyNames.add(entity.username)
      }
    }
  }

  const lines = []
  for (const [name, p] of Object.entries(players)) {
    const isNearby = nearbyNames.has(name)
    if (isNearby || p.relationship !== 'stranger') {
      const recentChat = p.interactions.filter(i => i.type === 'chat').slice(-1)
      const lastChat = recentChat.length > 0 ? ` Last said: "${recentChat[0].detail?.slice(0, 50)}"` : ''
      lines.push(`${name} (${p.relationship}, sentiment:${Math.round(p.sentiment)})${isNearby ? ' [NEARBY]' : ''}${lastChat}`)
    }
  }

  return lines.length > 0 ? 'Known players:\n' + lines.join('\n') : ''
}

export function getPartnerLastChat(partnerName) {
  if (!partnerName || !players[partnerName]) return null
  const p = players[partnerName]
  const chatInteractions = p.interactions.filter(i => i.type === 'chat')
  if (chatInteractions.length === 0) return null
  const last = chatInteractions[chatInteractions.length - 1]
  return { sender: partnerName, message: last.detail || '', timestamp: last.timestamp }
}

export function savePlayers() {
  try { writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2)) } catch {}
}
