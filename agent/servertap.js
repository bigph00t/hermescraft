// servertap.js — Thin REST client for ServerTap API (read-only server data)

const SERVERTAP_URL = process.env.SERVERTAP_URL || 'http://localhost:4567/v1'
const SERVERTAP_KEY = process.env.SERVERTAP_KEY || ''
const TIMEOUT_MS = 3000

// ── Internal Fetch Helper ──

// Silent catch — returns null on any network or parse failure.
// Per D-25: agent works without ServerTap; graceful degradation required.
async function stFetch(path) {
  try {
    const headers = {}
    if (SERVERTAP_KEY) headers['key'] = SERVERTAP_KEY
    const res = await fetch(`${SERVERTAP_URL}${path}`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ── Public API ──

export async function getServerInfo() {
  return stFetch('/server')
}

export async function getPlayers() {
  const data = await stFetch('/players')
  return Array.isArray(data) ? data : []
}

// Resolves player name to UUID first — ServerTap economy endpoint requires UUID.
export async function getPlayerBalance(playerName) {
  const players = await getPlayers()
  const player = players.find(p =>
    (p.displayName || p.name || '').toLowerCase() === playerName.toLowerCase()
  )
  if (!player) return null
  return stFetch(`/economy/balance/${player.uuid}`)
}

// Returns a compact "Server: N online, X.X TPS" string for state summary injection.
// Returns empty string when no data available — callers skip injection if empty.
export function formatServerSummary(serverInfo, players) {
  if (!serverInfo && (!players || players.length === 0)) return ''
  const parts = []
  if (players && players.length > 0) parts.push(`${players.length} online`)
  if (serverInfo?.tps) parts.push(`${parseFloat(serverInfo.tps).toFixed(1)} TPS`)
  if (serverInfo?.health?.tps) parts.push(`${parseFloat(serverInfo.health.tps).toFixed(1)} TPS`)
  return parts.length > 0 ? `Server: ${parts.join(', ')}` : ''
}
