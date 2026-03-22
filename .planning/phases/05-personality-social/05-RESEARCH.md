# Phase 5: Personality + Social - Research

**Researched:** 2026-03-22
**Domain:** LLM persona injection, persistent memory, multi-agent chat coordination, Minecraft day/night cycle
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- SOUL personality files (Jeffrey, John) carry over from v1 — SOUL-jeffrey.md, SOUL-john.md at project root
- Memory system pattern carries over: MEMORY.md (lessons/strategies), session transcripts, per-agent data dirs
- Anti-meta-game enforcement: agents must never reference items/locations/events not actually observed
- Natural grounded chat: only reference real game state, never hallucinate
- v1 data isolation: fresh `data/jeffrey/` and `data/john/` directories; v1 data archived as `*_v1/`
- v1 memory contamination: do NOT load v1 MEMORY.md — contains dead action vocabulary
- Mind + Body split: personality/social features live in mind/ layer
- MiniMax M2.7 for LLM — personality expressed through system prompt + conversation
- Per-agent config via AGENT_NAME env var
- Multi-agent: 2 bots for now (Jeffrey, John), designed to scale to 5-10
- No artificial throttling on chat — but throttle output (chat spam), not thinking

### Claude's Discretion
All implementation choices are at Claude's discretion — patterns carry over from v1.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SOUL-01 | SOUL file loading — Jeffrey and John with distinct personalities, creative drives | v1 config.js SOUL loading pattern; `mind/prompt.js` already has `options.soul` placeholder; `start.js` must call `loadAgentConfig()` and pass `soulContent` to `buildSystemPrompt` |
| SOUL-02 | Persistent memory — lessons, strategies, world knowledge across sessions | v1 `agent/memory.js` is the reference; port to `mind/memory.js` with per-agent data dirs; v1 stats schema is reusable with minor cleanup |
| SOUL-03 | Natural grounded chat — only reference real game state, never hallucinate | Anti-hallucination is a prompt engineering constraint — system prompt must explicitly forbid referencing unseen items/places; `buildStateText` already provides factual game state |
| SOUL-04 | Multi-agent coordination — 2 bots on same server, chat naturally, cooperate | v1 `agent/social.js` is the reference; port to `mind/social.js`; self-message dedup already in `mind/index.js` for `bot.username` check; need to extend for partner bot messages |
| SOUL-05 | Day/night behavior — work during day, shelter at night, social in evening | `bot.time.isDay` and `bot.time.timeOfDay` available from mineflayer time plugin; thresholds from mineflayer source: isDay = timeOfDay 0–12999, night = 13000–23999; shelter at 12000+ |
</phase_requirements>

---

## Summary

Phase 5 layers personality, persistent memory, and social awareness on top of the existing Mind loop. All three capabilities require additions to `mind/` with no changes to `body/` — the Mind+Body boundary holds. The v1 `agent/memory.js`, `agent/social.js`, and `agent/config.js` are direct ports with cleanups: dead phased-mode references removed, v1 MEMORY.md explicitly not loaded (it contains dead action vocabulary), and data directories isolated under `data/<AGENT_NAME>/`.

The core challenge for SOUL-01 is not loading the SOUL file — the mechanism already exists in `mind/prompt.js` (`options.soul` parameter) and `agent/config.js` (`loadAgentConfig()` SOUL discovery). The gap is wiring `loadAgentConfig()` into `start.js` and threading `soulContent` through `initMind()` to `buildSystemPrompt()`. Jeffrey and John's distinct personalities (Jeffrey: entitled, short, builder; John: methodical, math-brained, teacher) are already fully specified in the SOUL files.

The hardest requirement is SOUL-03 (no hallucination). The LLM cannot "know" items it hasn't seen — this must be enforced through explicit system prompt instructions and the `buildStateText()` function providing a strict ground-truth snapshot. The second hardest is SOUL-04 (multi-agent coordination) because chat deduplication and partner-bot context injection require careful state management to avoid the bots echoing each other or having stale impressions.

**Primary recommendation:** Port v1 memory and social modules to `mind/` first, then wire SOUL loading into `start.js`, then extend the prompt builder, then add day/night behavior to the body tick.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mineflayer (already installed) | 4.35.0 | `bot.time.timeOfDay`, `bot.time.isDay`, `messagestr` event with sender UUID | All needed APIs confirmed present in installed version |
| openai (already installed) | ^4.0.0 | LLM client — same as Phase 3 | No change |
| Node.js fs (built-in) | — | MEMORY.md, stats.json, players.json, locations.json persistence | Same pattern as v1 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No new npm dependencies | — | All features implemented with existing stack | — |

**Installation:**
```bash
# No new dependencies required — all built on existing mineflayer + fs + openai
```

**Version verification:** All packages already installed and confirmed operational in Phases 1–4.

---

## Architecture Patterns

### New Files to Create

```
mind/
├── memory.js      # Port of agent/memory.js — persistent lessons/strategies/world knowledge
├── social.js      # Port of agent/social.js — player tracking, sentiment, partner chat
└── config.js      # loadAgentConfig() — SOUL discovery, AGENT_NAME, data dir setup
```

`mind/index.js`, `mind/prompt.js`, `start.js` — extend in place (no new files).

### Pattern 1: SOUL Loading (SOUL-01)

**What:** `loadAgentConfig()` discovers SOUL file by AGENT_NAME, reads it into `soulContent`. `buildSystemPrompt()` already accepts `options.soul` — just needs to receive it.

**When to use:** On startup, before `initMind()`.

**Gap:** `start.js` currently calls `createBot()` + `initMind(bot)` with no config. Must add:
1. `const config = loadAgentConfig()` call in `main()` in `start.js`
2. Pass `config` into `initMind(bot, config)` so it can thread `soulContent` into `buildSystemPrompt()`

**Pattern:**
```javascript
// start.js — extended
import { loadAgentConfig } from './mind/config.js'

async function main() {
  const config = loadAgentConfig()
  const bot = await createBot({ username: config.name })
  await initMind(bot, config)
  initModes(bot, isSkillRunning)
}
```

```javascript
// mind/index.js — extended think()
async function think(bot, context) {
  const systemPrompt = buildSystemPrompt(bot, {
    soul: _config.soulContent,
    memory: getMemoryForPrompt(),
    players: getPlayersForPrompt(bot),
  })
  ...
}
```

### Pattern 2: Persistent Memory (SOUL-02)

**What:** Port `agent/memory.js` to `mind/memory.js`. Remove phased-mode references (`highestPhase`, `PHASES`), keep `lessons`, `strategies`, `worldKnowledge`, `stats`, session JSONL logging, `periodicSave()`.

**Key differences from v1:**
- No phased-mode stats (v2 has no phase system)
- `initMemory(config)` uses `config.dataDir` from `mind/config.js`
- Do NOT load v1 MEMORY.md — create fresh files in `data/jeffrey/` and `data/john/`
- Conversation history persistence (`history.json`) requires `getHistory()` from `mind/llm.js`

**v1 exports to keep (all used):**
- `initMemory(config)` — init with per-agent data dir
- `loadMemory()` — reads MEMORY.md, stats.json, history.json on startup
- `saveMemory()` — writes MEMORY.md
- `getMemoryForPrompt()` — returns lessons/strategies/worldKnowledge as prompt text
- `addWorldKnowledge(fact)` — add observed fact, deduplicated
- `periodicSave()` — called from modes.js or index.js on interval
- `writeSessionEntry(entry)` — JSONL session transcript

**Remove from v1:**
- `recordDeath()` — death handling is already in body/modes.js; a lightweight wrapper is fine
- `recordPhaseComplete()` — no phases in v2
- `getRelevantLessons(phase)` — replace with `getMemoryForPrompt()` (flat, no phase filtering)
- `HOSTILE_MOBS` constant — already lives in body/skills/combat.js

**periodicSave() wiring:** Must be called on a timer from `start.js` or `mind/index.js`, not `body/modes.js` (mind/body boundary). Every 60s is sufficient.

### Pattern 3: Anti-Hallucination Ground Truth (SOUL-03)

**What:** The LLM must not reference items, places, or events it has not observed. This is enforced via two mechanisms:

1. **Prompt constraint** — system prompt explicitly instructs the bot to only reference what appears in the current game state snapshot.
2. **State snapshot** — `buildStateText(bot)` already provides factual inventory, position, time. Extend with: nearby entities by name, memory knowledge summary, known locations.

**System prompt constraint text (to add):**
```
Never mention items you don't have, places you haven't been, or events that didn't happen.
Only reference what you can see in the game state below. If you're uncertain, say so briefly or stay silent.
```

**Grounded chat rule:** The `!chat` command is the only way the bot speaks in Minecraft chat. The LLM response is the text. Since the system prompt constrains what the LLM can reference, chat is automatically grounded — no additional filter needed at the registry level.

**World knowledge accumulation:** `addWorldKnowledge(fact)` should be called when the bot observes a significant event (finds a resource, reaches a new location). This knowledge is then injected back into future prompts — building a factual memory of what has actually been seen.

### Pattern 4: Multi-Agent Coordination (SOUL-04)

**What:** Two bots on the same server hear each other's chat. Each bot must:
1. Not echo its own messages back as LLM triggers
2. Recognize the other bot's username as a partner (not a human stranger)
3. Get the partner's recent chat injected into its context
4. Track the partner relationship via the social module

**Self-message dedup:** Already handled in `mind/index.js` — `if (username === bot.username) return`. This is correct.

**Partner detection:** The social module tracks all players including other bots. The key is that `Jeffrey` knows `John` and vice versa — their relationship starts as known partner, not stranger. This is achieved by:
- Initializing `players.json` with a pre-seeded entry for the partner, OR
- Special-casing known bot names (`JEFFREY_PARTNER = 'john'`, `JOHN_PARTNER = 'jeffrey'`) in the prompt

**Recommended approach:** Seed a `PARTNER_NAME` env var (or derive from AGENT_NAME: jeffrey's partner is john and vice versa). Inject partner's last chat into the user message when available.

**Chat context injection pattern:**
```javascript
// In buildUserMessage, add partner chat if recent
const partnerLastChat = getPartnerLastChat()  // from social module
if (partnerLastChat) {
  parts.push(`[${partnerLastChat.sender} said: "${partnerLastChat.message}"]`)
}
```

**No echo guard (critical):** `bot.on('messagestr', ...)` fires for ALL chat including the bot's own chat echoed back by the server. The existing guard `if (username === bot.username) return` handles this. Must verify this also handles the UUID-to-username path (confirmed present in `mind/index.js` lines 98-104).

**Cooperation without explicit coordination protocol:** Bots don't need a separate message bus. They naturally cooperate because:
- Each reads the other's chat via the standard `messagestr` event
- Each can respond to the other with `!chat`
- The social module tracks the partner's sentiment and recent messages

### Pattern 5: Day/Night Routine (SOUL-05)

**What:** Bot changes behavior based on time of day. During day — work (gather, mine, build). At dusk (approaching night) — navigate to shelter. During night — reduced activity, stay inside or low-risk actions. At dawn — resume work.

**Mineflayer time API** (confirmed from source):
- `bot.time.isDay` — boolean, true when `timeOfDay` 0–12999
- `bot.time.timeOfDay` — 0–23999 ticks, mod 24000
- Key thresholds:
  - `0` = dawn / sunrise
  - `6000` = midday
  - `12000` = dusk begins (approaching sunset)
  - `13000` = night begins (hostile mobs spawn)
  - `18000` = midnight
  - `23000` = pre-dawn

**Implementation approach:** Day/night awareness lives in TWO places:

1. **Body tick (body/modes.js):** Add a check before the 5-priority cascade — if it's night and no home is known, bot should seek shelter. If home is known and it's night, navigate home. This is a body behavior, not a mind behavior.

2. **System prompt injection (mind/prompt.js):** Add a `timeContext` line to `buildStateText()` that gives the LLM awareness of the time regime:
   ```
   time: night (13420) — stay in shelter, avoid venturing far
   ```
   This allows the LLM to make time-appropriate action choices without the body having to hard-code every possible action restriction.

**Day/night time labels for prompt:**
```javascript
function timeLabel(timeOfDay) {
  if (timeOfDay < 1000) return 'dawn'
  if (timeOfDay < 6000) return 'morning'
  if (timeOfDay < 12000) return 'afternoon'
  if (timeOfDay < 13000) return 'dusk — seek shelter soon'
  if (timeOfDay < 18000) return 'night — stay in shelter'
  if (timeOfDay < 23000) return 'late night — stay in shelter'
  return 'pre-dawn'
}
```

**Shelter logic (body/modes.js addition):**
```javascript
// Priority 0 (highest): night shelter — if night and not home, go home
if (!bot.time.isDay && bot.time.timeOfDay > 12500) {
  const home = getHome()  // from mind/locations.js
  if (home && !isNearHome(bot.entity.position, home)) {
    navigateTo(bot, home.x, home.y, home.z)
    return  // skip lower priorities
  }
}
```

**Important:** `body/modes.js` importing from `mind/locations.js` would break the mind/body boundary. Two options:
- Pass a `getHome()` callback from `start.js` into `initModes()` (same pattern as `isSkillRunning`)
- Keep home in `body/` — store it on `bot.homeLocation` as a bot property

Recommended: store `bot.homeLocation` on the bot object (set by memory init, accessed by body tick).

### Pattern 6: Locations (world knowledge subsystem)

**What:** Port `agent/locations.js` to `mind/locations.js`. Locations persist across sessions in `data/<AGENT_NAME>/locations.json`. Provides named waypoints (home, shelter, resources).

**Key exports to port:**
- `initLocations(config)` — init per-agent file
- `setHome(x, y, z)` / `getHome()` — home waypoint
- `saveLocation(name, x, y, z, type)` — named locations
- `getLocationsForPrompt(position)` — compact text for system prompt
- `saveLocations()` — write to disk

**Simplification vs v1:** The resource patch auto-detection (`saveResourcePatch`, `autoDetectLocations`) can be ported but is lower priority. For Phase 5, the essential subset is: home detection, named locations, locations-for-prompt injection.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chat sender resolution | Custom UUID lookup | `bot.players?.[sender]?.username` | Already working in mind/index.js; UUID sender is an MC 1.19+ protocol detail |
| Time of day | Custom tick counter | `bot.time.isDay` / `bot.time.timeOfDay` | Mineflayer time plugin handles `update_time` packets automatically |
| Sentiment tracking | Custom analysis of chat text | Port v1 social.js scoring (+0.5 chat, +2 give_item, -3 attacked) | v1 model is simple and effective; LLM sentiment analysis would be overkill and slow |
| Memory serialization | JSON or DB | Plain MEMORY.md (markdown) + stats.json | Same as v1 — readable by humans, injects cleanly as prompt text, no parse overhead |
| Anti-hallucination filter | Post-process LLM output | System prompt instructions + ground-truth state injection | Post-processing is fragile; prompt constraints are the right lever for LLM behavior |

**Key insight:** All the building blocks exist in v1 or are already stubbed in Phase 3 code. This phase is a port + wire-up, not a design phase.

---

## Common Pitfalls

### Pitfall 1: v1 MEMORY.md contamination
**What goes wrong:** Loading v1 `agent/data/jeffrey/MEMORY.md` injects dead action vocabulary (e.g., `look_at`, `smart_place`, v1 `navigate` format) into the LLM context, causing the LLM to attempt actions that don't exist in v2.
**Why it happens:** Memory files are shared by filesystem path and AGENT_NAME. If the data dir isn't isolated, v2 agent reads v1 files.
**How to avoid:** `mind/config.js` must set `dataDir` to `data/<AGENT_NAME>/` relative to project root (not `agent/data/`). On first run, if no MEMORY.md exists, create a fresh empty one.
**Warning signs:** LLM produces commands like `!look_at`, `!smart_place`, `!use_chest` — these are v1-only.

### Pitfall 2: Bot echoes own chat
**What goes wrong:** When a bot says something via `bot.chat()`, the Paper server echoes the message back as a `playerChat` packet. If the `messagestr` listener doesn't filter this out, the bot triggers `think()` on its own message and may respond to itself.
**Why it happens:** The mineflayer `messagestr` event fires for all chat including echoed self-messages. The sender UUID resolves to the bot's own username.
**How to avoid:** The guard in `mind/index.js` (`if (username === bot.username) return`) already handles this. Do not remove it. Verify it covers the UUID→username resolution path (confirmed: lines 102-104).
**Warning signs:** Bot says something, then immediately responds to itself in a loop.

### Pitfall 3: Partner bot triggers flood
**What goes wrong:** Jeffrey and John are both chatty. If John says something, Jeffrey responds. Jeffrey's response triggers John. John responds. Infinite back-and-forth chat loop.
**Why it happens:** Both bots listen to all chat. Without a damper, they can get into a conversation spiral.
**How to avoid:** Do not add artificial chat cooldowns (violates no-throttle constraint). Instead, rely on the `thinkingInFlight` guard (already in place) and the LLM's natural tendency to `!idle` when there's nothing useful to say. The SOUL files explicitly instruct both bots to chat only when they have something real to say. Additionally, the social module's `trackPlayer()` approach provides recent-chat awareness so the LLM sees it already responded.
**Warning signs:** Chat log shows Jeffrey→John→Jeffrey→John with no game actions in between.

### Pitfall 4: bot.time is null before first update_time packet
**What goes wrong:** `bot.time.timeOfDay` is `null` immediately after spawn. Code that reads it without null-checking will throw or behave unexpectedly.
**Why it happens:** The mineflayer time plugin sets all fields to `null` initially and only populates them after the first `update_time` packet from the server.
**How to avoid:** Always use `bot.time?.timeOfDay ?? 0` with null-coalescing. `promptbuilder` already uses `bot.time?.timeOfDay ?? 0` — confirm this pattern is used everywhere.
**Warning signs:** `TypeError: Cannot read properties of null` on time-of-day checks.

### Pitfall 5: SOUL file not found crashes silently
**What goes wrong:** If SOUL file discovery fails (wrong path, typo in AGENT_NAME), `soulContent` is null. `buildSystemPrompt` falls back to the generic identity string. Bot runs but has no personality.
**Why it happens:** `loadAgentConfig()` in v1 uses a try/catch that returns null on failure rather than throwing. The fallback is a generic identity, not an error.
**How to avoid:** Log clearly when SOUL file is not found: `console.warn('[config] SOUL file not found for', name, '— using generic identity')`. Do not throw — the bot should still run. But the planner should verify SOUL file discovery works before considering SOUL-01 done.
**Warning signs:** Both bots sound identical; no character voice.

### Pitfall 6: Locations module crosses mind/body boundary for shelter
**What goes wrong:** `body/modes.js` needs home coordinates for night shelter behavior, but home is stored in `mind/locations.js`. Importing `mind/` from `body/` violates the architecture.
**Why it happens:** Shelter is a body behavior but the data lives in the mind layer.
**How to avoid:** On memory init, write `bot.homeLocation = getHome()` onto the bot object. Body tick reads `bot.homeLocation` directly without importing mind/. Update `bot.homeLocation` whenever home is set via `setHome()`.
**Warning signs:** Import of `mind/locations.js` appearing in `body/` files.

---

## Code Examples

Verified from mineflayer installed source and existing codebase:

### Time of Day Check
```javascript
// Source: node_modules/mineflayer/lib/plugins/time.js
// bot.time.isDay = timeOfDay 0-12999 = true
// bot.time.timeOfDay = 0-23999
const isDay = bot.time?.isDay ?? true          // null-safe default to day
const timeOfDay = bot.time?.timeOfDay ?? 0     // null-safe default to 0

// Dusk detection (begin seeking shelter before night)
const approachingNight = timeOfDay >= 12000 && timeOfDay < 13000
// Night proper (hostiles spawn at 13000)
const isNight = timeOfDay >= 13000
```

### Chat Sender Resolution (confirmed working in mind/index.js)
```javascript
// Source: mind/index.js lines 98-104
bot.on('messagestr', (msgStr, position, jsonMsg, sender) => {
  if (!sender || sender === bot.username) return
  const username = bot.players?.[sender]?.username || sender.toString().slice(0, 8)
  if (username === bot.username) return  // Filter own echoed messages
  think(bot, { trigger: 'chat', sender: username, message: msgStr })
})
```

### SOUL Discovery (from agent/config.js, already tested)
```javascript
// Source: agent/config.js — port to mind/config.js
const soulCandidates = [
  process.env.AGENT_SOUL,
  join(projectRoot, `SOUL-${name}.md`),
  join(projectRoot, 'SOUL-minecraft.md'),
].filter(Boolean)

for (const candidate of soulCandidates) {
  if (existsSync(candidate)) {
    soulContent = readFileSync(candidate, 'utf-8').trim()
    break
  }
}
```

### Memory Init Pattern (from agent/memory.js)
```javascript
// Source: agent/memory.js — port to mind/memory.js
// Key: dataDir is per-agent, never shared
export function initMemory(config) {
  DATA_DIR = config.dataDir          // e.g. data/jeffrey/
  MEMORY_FILE = join(DATA_DIR, 'MEMORY.md')
  STATS_FILE = join(DATA_DIR, 'stats.json')
  HISTORY_FILE = join(DATA_DIR, 'history.json')
}
```

### Prompt Extension with SOUL + Memory + Social
```javascript
// Source: mind/prompt.js — extend buildSystemPrompt
export function buildSystemPrompt(bot, options = {}) {
  const parts = []

  // 1. SOUL identity (SOUL-01)
  if (options.soul) {
    parts.push(options.soul)
  } else {
    parts.push(`You are ${bot.username}, a Minecraft player.`)
  }

  // 2. Anti-hallucination constraint (SOUL-03)
  parts.push(`
Never mention items you don't have, places you haven't been, or events that didn't happen in this session.
Only reference what appears in the current game state below. Keep chat brief and natural — only speak when you have something real to say.`)

  // 3. Memory (SOUL-02)
  if (options.memory) {
    parts.push(options.memory)  // from getMemoryForPrompt()
  }

  // 4. Known players / partner context (SOUL-04)
  if (options.players) {
    parts.push(options.players)  // from getPlayersForPrompt()
  }

  // 5. !command reference (unchanged from Phase 3)
  // ...
}
```

### Social Module — trackPlayer Usage
```javascript
// Source: agent/social.js — port to mind/social.js
// Called from mind/index.js chat handler:
trackPlayer(username, { type: 'chat', detail: msgStr })

// For partner-specific context in prompt:
const partnerName = config.partnerName  // 'john' for jeffrey, 'jeffrey' for john
const partnerEntry = players[partnerName]
const lastPartnerChat = partnerEntry?.interactions
  .filter(i => i.type === 'chat')
  .slice(-1)[0]?.detail ?? null
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phased mode / Ender Dragon quest | v2 has no phase system — open-ended autonomous mode | v2.0 milestone | Remove all `highestPhase`, `PHASES` references from ported memory module |
| HermesBridge mod + HTTP | Mineflayer direct API | v2.0 milestone | `bot.time`, `bot.players`, `messagestr` are all direct mineflayer properties |
| 3-loop architecture (plan/execute/review) | Single mind loop with event triggers | v2.0 milestone | No planner loop; memory + social are prompt context only |
| agent/ directory for mind code | mind/ directory | v2.0 milestone | All new code goes in `mind/` — no additions to `agent/` |

**Deprecated/outdated:**
- `agent/memory.js` v1 stats fields: `highestPhase`, `highestPhaseName` — not meaningful in v2
- `agent/config.js` vision/planner config — not relevant for Phase 5
- v1 MEMORY.md files — must NOT be loaded; contain dead action vocabulary

---

## Integration Map

### Files Modified (extend in place)
| File | What Changes |
|------|-------------|
| `start.js` | Import `loadAgentConfig`; pass config to `initMind`; call `initMemory(config)`; set `bot.homeLocation`; start `periodicSave()` interval |
| `mind/index.js` | Accept `config` param in `initMind`; thread soul/memory/social into `buildSystemPrompt` call; call `trackPlayer()` on chat events; add locations context |
| `mind/prompt.js` | Extend `buildSystemPrompt()` with soul, memory, players, time-label options; extend `buildStateText()` with richer time label and location context |

### Files Created (new)
| File | What It Does |
|------|-------------|
| `mind/config.js` | `loadAgentConfig()` — SOUL discovery, data dir, partner name |
| `mind/memory.js` | Port of v1 agent/memory.js — lessons/strategies/worldKnowledge, periodicSave, session JSONL |
| `mind/social.js` | Port of v1 agent/social.js — player tracking, sentiment, getPlayersForPrompt |
| `mind/locations.js` | Port of v1 agent/locations.js — home, named locations, getLocationsForPrompt |

### Files NOT Modified
| File | Why |
|------|-----|
| `body/*` | Mind/body boundary — no personality or social logic in body |
| `body/modes.js` | Shelter behavior added via `bot.homeLocation` property on bot object, not via mind/ import |
| `mind/llm.js` | Unchanged — queryLLM is agnostic to soul/memory content |
| `mind/registry.js` | Unchanged — !chat already dispatches via `bot.chat()` |

---

## Open Questions

1. **Partner name derivation**
   - What we know: Two bots are jeffrey and john; each needs to know the other's name for social module seeding
   - What's unclear: Should this be hardcoded (if name === 'jeffrey' → partner = 'john'), env-var driven (`PARTNER_NAME`), or discovered from server player list?
   - Recommendation: Use env var `PARTNER_NAME` defaulting to the other known bot name. Simplest, most explicit, scales to 3+ bots without code changes.

2. **When to call addWorldKnowledge()**
   - What we know: The function exists; it should be called when the bot observes something significant
   - What's unclear: Which skill completion events warrant a world knowledge entry? `!mine` finding a vein? `!navigate` reaching a new area?
   - Recommendation: For Phase 5, call it from the LLM explicitly via the memory system on session load. Don't try to auto-detect from skill completions yet. The LLM can generate world knowledge entries as part of its reasoning.

3. **History persistence (history.json) in v2**
   - What we know: v1 memory.js persists and restores conversation history across restarts; v2 `mind/llm.js` exports `getHistory()` but no `setHistory()`
   - What's unclear: Do we want cross-session history restoration in v2? It risks stale context.
   - Recommendation: Skip history.json persistence for Phase 5. Memory (MEMORY.md) + SOUL provides sufficient continuity. Cross-session conversation history often does more harm than good (stale references, outdated world state).

---

## Sources

### Primary (HIGH confidence)
- `/home/bigphoot/Desktop/hermescraft/node_modules/mineflayer/lib/plugins/time.js` — `bot.time.isDay`, `bot.time.timeOfDay` confirmed present and values verified
- `/home/bigphoot/Desktop/hermescraft/node_modules/mineflayer/lib/plugins/chat.js` — `messagestr` event signature, sender UUID behavior confirmed
- `/home/bigphoot/Desktop/hermescraft/agent/memory.js` — v1 memory system, full module read
- `/home/bigphoot/Desktop/hermescraft/agent/social.js` — v1 social module, full module read
- `/home/bigphoot/Desktop/hermescraft/agent/locations.js` — v1 locations module, full module read
- `/home/bigphoot/Desktop/hermescraft/agent/config.js` — v1 SOUL discovery pattern confirmed
- `/home/bigphoot/Desktop/hermescraft/mind/prompt.js` — `options.soul` stub already present
- `/home/bigphoot/Desktop/hermescraft/mind/index.js` — self-message dedup pattern confirmed working

### Secondary (MEDIUM confidence)
- SOUL-jeffrey.md, SOUL-john.md — full character files read; personality patterns extracted
- `.planning/STATE.md` — architecture decisions confirmed (no phased mode, no artificial delays, data isolation)

### Tertiary (LOW confidence)
- None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and working
- Architecture: HIGH — based on direct code reads of v1 reference implementations
- Pitfalls: HIGH — pitfalls 1-4 derived from existing code; pitfall 5-6 from architectural analysis
- SOUL file content: HIGH — full character files read

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack, no moving parts)

**nyquist_validation:** disabled in .planning/config.json — Validation Architecture section omitted.
