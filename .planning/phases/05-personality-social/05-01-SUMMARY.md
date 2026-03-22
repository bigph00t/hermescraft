---
phase: 05-personality-social
plan: 01
subsystem: personality
tags: [memory, social, config, locations, soul, mineflayer]

requires:
  - phase: 04-survival-modes
    provides: body/modes.js and mind/index.js isSkillRunning pattern; confirms mind/body boundary

provides:
  - mind/config.js: loadAgentConfig() with SOUL discovery, data dir at data/<name>/, partner inference
  - mind/memory.js: persistent lessons/strategies/worldKnowledge with MEMORY.md, session JSONL transcripts
  - mind/social.js: player relationship tracking with sentiment, partner pre-seeding, nearby detection via bot object
  - mind/locations.js: named waypoints with distance+direction prompt injection, home get/set

affects:
  - 05-02 (personality-social plan 02): wires these modules into start.js, prompt.js, index.js

tech-stack:
  added: []
  patterns:
    - "config.js is the only file that reads SOUL-*.md and env vars — all subsystems receive config object"
    - "data dir is data/<name>/ at project root, not agent/data/<name>/ (v1 isolation)"
    - "social.js getPlayersForPrompt takes bot object directly to read bot.players + bot.entities"
    - "partner pre-seeded at sentiment:3 / acquaintance — jeffrey<->john mutual recognition from session 1"

key-files:
  created:
    - mind/config.js
    - mind/memory.js
    - mind/social.js
    - mind/locations.js
  modified: []

key-decisions:
  - "No history.json persistence in memory.js — stale conversation context does more harm than good in v2"
  - "recordDeath simplified to take a message string — no phase/progress args (v2 has no phase system)"
  - "getPlayersForPrompt signature changed from nearbyEntities array to bot object — avoids passing intermediate data"
  - "getLocationsForPrompt filters to 500 blocks (v1 was 150) — agents on open world benefit from wider awareness"
  - "partner seeded at sentiment:3/acquaintance not 0/stranger — jeffrey and john know each other from session 1"

patterns-established:
  - "init<Subsystem>(config) pattern: all four modules use config.dataDir as single source of truth"
  - "No default exports — named exports only across all four modules"

requirements-completed: [SOUL-01, SOUL-02, SOUL-04]

duration: 2min
completed: 2026-03-22
---

# Phase 5 Plan 01: Personality & Social Data Modules Summary

**Four mind/ data subsystems ported from v1 with v2 isolation: config (SOUL loading), memory (MEMORY.md + session JSONL), social (sentiment tracking + partner pre-seeding), locations (named waypoints with cardinal directions)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-22T19:15:29Z
- **Completed:** 2026-03-22T19:17:53Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `mind/config.js` discovers SOUL files by AGENT_NAME, infers jeffrey<->john partner relationship, creates `data/<name>/` directory hierarchy — no v1 data path contamination
- `mind/memory.js` loads/saves MEMORY.md and stats.json, writes session JSONL transcripts, drops v1 phase fields (highestPhase), drops history.json persistence
- `mind/social.js` tracks player sentiment (-10 to +10), pre-seeds partner at acquaintance level so jeffrey and john start the first session as known contacts, reads nearby players from bot object
- `mind/locations.js` stores named waypoints with type/timestamp, `getLocationsForPrompt` returns distance and cardinal direction for each within 500 blocks

## Task Commits

Each task was committed atomically:

1. **Task 1: Create mind/config.js and mind/memory.js** - `50df05c` (feat)
2. **Task 2: Create mind/social.js and mind/locations.js** - `7c737f6` (feat)

## Files Created/Modified

- `mind/config.js` - Agent config: SOUL discovery, data dir, partner name, MC username
- `mind/memory.js` - Persistent memory: lessons, strategies, world knowledge, session JSONL
- `mind/social.js` - Player relationships: sentiment scoring, partner pre-seeding, nearby detection
- `mind/locations.js` - Named waypoints: home get/set, prompt injection with distance+direction

## Decisions Made

- No history.json in v2 memory.js — stale conversation context recovered from file caused more confusion than continuity in v1 testing; v2 starts clean each session
- `getPlayersForPrompt(bot)` takes bot object directly — avoids callers needing to pre-extract `nearbyEntities`; reads `bot.players` and `bot.entities` for nearby detection
- `getLocationsForPrompt` radius expanded to 500 blocks from v1's 150 — open world exploration means agents need awareness beyond immediate vicinity
- Partner starts at `sentiment: 3 / relationship: 'acquaintance'` not `0 / 'stranger'` — jeffrey and john have history; day 1 they should recognize each other, not treat each other as unknown players

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `grep -c "agent/data" mind/config.js` acceptance criterion failed with count 1 — the comment explaining the data path difference contained the literal string "agent/data". Reworded comment to use "v1 put data under agent/" instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four data subsystems ready for Plan 02 wiring into start.js, prompt.js, and index.js
- `loadAgentConfig()` returns `{ name, dataDir, soulContent, partnerName, mcUsername }` — Plan 02 extends start.js to call it and thread config through all inits

---
*Phase: 05-personality-social*
*Completed: 2026-03-22*
