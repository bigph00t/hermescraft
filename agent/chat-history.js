// chat-history.js — Chat message history for deep memory
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

let CHAT_FILE = ''
let messages = []
const MAX_MESSAGES = 50

export function initChatHistory(agentConfig) {
  CHAT_FILE = join(agentConfig.dataDir, 'chat-history.jsonl')
  const dir = dirname(CHAT_FILE)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  // Load existing entries (last 50 only)
  if (existsSync(CHAT_FILE)) {
    try {
      const lines = readFileSync(CHAT_FILE, 'utf-8')
        .split('\n')
        .filter(l => l.trim())
      for (const line of lines) {
        try {
          messages.push(JSON.parse(line))
        } catch {}
      }
      // Keep only last 50
      if (messages.length > MAX_MESSAGES) {
        messages = messages.slice(-MAX_MESSAGES)
      }
    } catch {}
  }
}

export function recordChat(sender, message) {
  if (!CHAT_FILE) return

  const entry = {
    timestamp: new Date().toISOString(),
    sender,
    message,
  }

  messages.push(entry)

  // Cap in-memory at 50
  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(-MAX_MESSAGES)
  }

  // Append to disk
  try {
    appendFileSync(CHAT_FILE, JSON.stringify(entry) + '\n', 'utf-8')
  } catch {}

  // When disk file exceeds 50 lines, rewrite with only the last 50
  try {
    const lines = readFileSync(CHAT_FILE, 'utf-8')
      .split('\n')
      .filter(l => l.trim())
    if (lines.length > MAX_MESSAGES) {
      const kept = lines.slice(-MAX_MESSAGES)
      writeFileSync(CHAT_FILE, kept.join('\n') + '\n', 'utf-8')
    }
  } catch {}
}

export function getRecentChats(n = 10) {
  return messages.slice(-n)
}

export function getChatSummary() {
  if (messages.length === 0) return ''

  // Group by sender, show last 2-3 messages each with relative timestamps
  const bySender = {}
  for (const m of messages) {
    if (!bySender[m.sender]) bySender[m.sender] = []
    bySender[m.sender].push(m)
  }

  const now = Date.now()
  const lines = []

  for (const [sender, msgs] of Object.entries(bySender)) {
    const recent = msgs.slice(-3).reverse()
    const parts = recent.map(m => {
      const ago = formatRelativeTime(now - new Date(m.timestamp).getTime())
      return `'${m.message}' (${ago})`
    })
    lines.push(`${sender} said: ${parts.join(', ')}`)
  }

  return lines.join('. ')
}

function formatRelativeTime(ms) {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
