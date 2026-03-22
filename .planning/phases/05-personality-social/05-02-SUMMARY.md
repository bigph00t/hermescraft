---
phase: 05-personality-social
plan: "02"
subsystem: mind+body
tags: [personality, memory, social, grounding, night-shelter, wiring]
dependency_graph:
  requires: [05-01]
  provides: [SOUL-01, SOUL-02, SOUL-03, SOUL-04, SOUL-05]
  affects: [start.js, mind/index.js, mind/prompt.js, body/modes.js]
tech_stack:
  added: []
  patterns:
    - "bot.homeLocation as mind/body boundary for home coordinates"
    - "timeLabel() function for 7-label day/night cycle awareness"
    - "Anti-hallucination grounding constraint in system prompt"
    - "partnerChat injection into user message for partner awareness"
key_files:
  created: []
  modified:
    - start.js
    - mind/index.js
    - mind/prompt.js
    - body/modes.js
decisions:
  - "bot.homeLocation property used as mind/body boundary — setHome() updates locations.json, start.js sets bot.homeLocation, modes.js reads it without any mind/ import"
  - "timeLabel() uses 7 labels not 2 — dusk/night/late-night labels include shelter guidance text, matching what the bot actually needs to know to seek shelter"
  - "Night shelter is Priority 0 before survival — shelter blocks are not a reason to fight; fleeing mobs is more urgent so survival check follows immediately"
  - "checkNightShelter gated on !getSkillRunning() — a skill in progress should not be interrupted for shelter; unlike starvation which overrides"
  - "Anti-hallucination constraint injected as Part 2, immediately after SOUL identity — ensures persona is established before grounding constraints"
metrics:
  duration: "3 min"
  completed: "2026-03-22"
  tasks_completed: 2
  files_modified: 4
---

# Phase 05 Plan 02: Personality+Social Wiring Summary

Wire all four mind/ modules from Plan 01 into start.js, mind/index.js, mind/prompt.js, and body/modes.js — completing the Personality+Social phase with SOUL identity, memory persistence, anti-hallucination grounding, social tracking, and day/night routine.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Wire config+memory+social+locations into start.js and mind/index.js | d57690e | start.js, mind/index.js |
| 2 | Extend prompt.js with grounding+time and modes.js with night shelter | 4c27c99 | mind/prompt.js, body/modes.js |

## What Was Built

### Task 1: start.js + mind/index.js Extended

**start.js** rewritten to be the full v2 startup wiring point:
- `loadAgentConfig()` runs first — discovers SOUL file, data dir, partner name
- `createBot()` now receives `{ username: config.mcUsername }` from config
- All four data subsystems initialized in order: `initMemory()` → `loadMemory()` → `initSocial()` → `initLocations()`
- `getHome()` called after initLocations; if home exists, `bot.homeLocation` is set (mind/body bridge)
- `initMind(bot, config)` now receives config so SOUL flows into every think()
- `setInterval(() => periodicSave(), 60000)` runs every 60s for memory + stats persistence

**mind/index.js** extended with config threading:
- Signature changed from `initMind(bot)` to `initMind(bot, config)` — config stored as `_config`
- `think()` now calls `buildSystemPrompt(bot, { soul, memory, players, locations })` with all four options
- `partnerChat` extracted via `getPartnerLastChat(_config.partnerName)` and passed to `buildUserMessage`
- Chat handler calls `trackPlayer(username, { type: 'chat', detail: msgStr })` before `think()`
- Death handler calls `recordDeath('Died in the world')` after clearing conversation
- `!sethome` command handled: calls `setHome()` and updates `bot.homeLocation`

### Task 2: mind/prompt.js + body/modes.js Extended

**mind/prompt.js** extended with 5 new features:
1. Anti-hallucination constraint (Part 2): "Never mention items you don't have, places you haven't been..." — injected after SOUL identity
2. Memory injection (Part 3): `options.memory` from `getMemoryForPrompt()` — lessons, strategies, world knowledge
3. Social injection (Part 4): `options.players` from `getPlayersForPrompt()` — known players with sentiment and nearby flag
4. Locations injection (Part 5): `options.locations` from `getLocationsForPrompt()` — named waypoints within 500 blocks
5. `!sethome` and `!combat` added to command reference
6. `timeLabel()` function: 7 rich time labels — `dawn/morning/afternoon/dusk -- seek shelter soon/night -- stay in shelter/late night -- stay in shelter/pre-dawn`
7. Player names collected in buildStateText nearby loop and shown in `nearby:` line
8. `partnerChat` injection in `buildUserMessage` — shows partner's last message for context

**body/modes.js** extended with Priority 0 night shelter:
- `checkNightShelter(bot, getSkillRunning)` added: fires when timeOfDay 12500-23000, home set, bot >10 blocks from home, no skill running
- Calls `navigateTo(bot, home.x, home.y, home.z, 3, 30000)` — 3 block tolerance, 30s timeout
- Reads `bot.homeLocation` (set by start.js / !sethome) — NO mind/ imports
- Inserted as Priority 0 before checkSurvival in bodyTick cascade

## SOUL Requirements Satisfied

- **SOUL-01**: Jeffrey/John SOUL files loaded via `mind/config.js`, injected into every `buildSystemPrompt()` call via `options.soul`
- **SOUL-02**: Memory persists lessons/strategies/worldKnowledge across sessions via `mind/memory.js`; `periodicSave()` runs every 60s from `start.js`
- **SOUL-03**: Anti-hallucination constraint in system prompt; `buildStateText` provides ground-truth game state; bot can only reference visible state
- **SOUL-04**: `mind/social.js` tracks players; partner pre-seeded as acquaintance; chat events call `trackPlayer`; partner's last chat injected into user message
- **SOUL-05**: Rich time labels in prompt (dawn through pre-dawn with shelter guidance); night shelter behavior in `body/modes.js` navigates home at dusk

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] start.js exists and contains loadAgentConfig, initMemory, periodicSave, bot.homeLocation
- [x] mind/index.js contains _config, trackPlayer, soulContent, getMemoryForPrompt, getLocationsForPrompt, recordDeath, sethome
- [x] mind/prompt.js contains timeLabel function, anti-hallucination text, options.memory/players/locations, partnerChat
- [x] body/modes.js contains checkNightShelter, bot.homeLocation, 12500 threshold; no actual mind/ imports
- [x] Commits d57690e and 4c27c99 exist
