---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 05-01-PLAN.md
last_updated: "2026-03-21T06:52:59.914Z"
progress:
  total_phases: 10
  completed_phases: 7
  total_plans: 18
  completed_plans: 17
---

# GSD State: HermesCraft Life Simulation

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Agents must feel alive — indistinguishable from real players
**Current focus:** Phase 5 — Automatic Skill Learning

## Milestone: v1.0

**Status:** Ready to plan
**Phases:** 6 total, 0 complete

| Phase | Name | Status | Plans |
|-------|------|--------|-------|
| 1 | Building System | ○ Pending | 0/0 |
| 2 | Farming & Food | ○ Pending | 0/0 |
| 3 | Deep Memory | ● Complete | 2/2 |
| 4 | Human-Like Behavior | ● Complete | 2/2 |
| 5 | Automatic Skill Learning | ◐ In Progress | 1/2 |
| 6 | Cooperation & Exploration | ○ Pending | 0/0 |

## Session Context

Last session: 2026-03-21T06:52:59.912Z
Stopped At: Completed 05-01-PLAN.md

- Phase 05 Plan 01 complete: death avoidance learning -- recordDeathLocation saves danger zones, getNearbyDangers injects proximity warnings into planner
- locations.js: danger-N entries (type='danger', cause, lesson), capped at 10, oldest eviction
- index.js: recordDeathLocation called in death recording block after autobiographical event
- planner.js: DANGER ZONES NEARBY section in consolidateMemory when agent within 30 blocks of past death site
- Phase 04 complete: behavior-aware prompts with mode-specific hints (work/shelter/social/sleep) and idle tick tracking with boredom nudges in action loop
- Phase 04 Plan 02: prompt.js injects HOW TO BEHAVE section per mode, index.js tracks idleTicks and generates idle hints (5+ work, 3+ social)
- Phase 04 Plan 01 complete: needs system (hunger/safety/social/creative 0-100) and behavior mode (work/shelter/social/sleep) integrated into planner loop
- needs.js: pure calculation module with detectBehaviorMode, calculateNeeds, formatNeedsForPrompt
- planner.js: behavior mode + needs injected into system prompt and user content every 60s tick
- Phase 03 Plan 02 complete: recording hooks in index.js, memory consolidation in planner.js with things-you-might-mention
- Phase 03 Plan 01 complete: five deep memory data modules (autobiography, chests, chat-history, locations auto-home, social persistence)
- autobiography.js: JSONL event log, 100-entry cap, day-grouped summary
- chests.js: coordinate-keyed chest tracking with immediate write
- chat-history.js: 50-message ring buffer with sender-grouped relative timestamps
- locations.js: setHome/getHome, auto-home on first bed or door
- social.js: sentiment decay 0.1/hr, notable_interactions, getRelationshipSummary
- Established working agent harness with multi-agent support
- Two agents running on Survival Island (Jeffrey Enderstein, John Kwon)
- MiniMax M2.7-highspeed as LLM, MC 1.21.1 on Glass

## Decisions

- One-tick delay between marking done and verification prevents stale state reads (03-01)
- Keyword-based review (not LLM call) keeps review cost-zero, no extra API calls (03-01)
- Default-pass when no keywords match: trusts agent judgment, reduces false negatives (03-01)
- retry_count/max_retries stored in tasks.json for persistence across restarts (03-01)
- [Phase 03-02]: Gate skips INFO_ACTIONS entirely — they don't touch game world, no state check needed
- [Phase 03-02]: validatePreExecution returns valid:true for unknown types — non-blocking by default
- [Phase 03-02]: Partial-match hasItem() handles minecraft: prefix variations in inventory item IDs
- [Phase 01]: Door placed at y=1 only in blueprint grid - MC doors auto-extend to 2-tall
- [Phase 01]: Farmland in crop-farm blueprint requires special executor handling (place dirt then till)
- [Phase 01]: resolvePalette falls back to first preferred block when agent has none available
- [Phase 01]: Used temp file for NativeImage PNG export since MC 1.21.1 NativeImage.writeTo only takes Path
- [Phase 01]: Vision loop uses separate OpenAI client to prevent action loop interference
- [Phase 01-04]: Planner loop uses separate OpenAI client -- each cognitive layer is independent
- [Phase 01-04]: getBuildProgress dynamically imported from builder.js with fallback for parallel plan execution
- [Phase 01-04]: Vision context in user message, plan context in system prompt -- matches D-01 three-layer arch
- [Phase 01-04]: Building knowledge loaded once at startup, injected every tick as static system prompt content
- [Phase 01-03]: Place up to 3 blocks per tick to avoid overwhelming mod API
- [Phase 01-03]: Proximity check: agent must be within 8 blocks of build origin to place
- [Phase 01-03]: Auto-unpause: build resumes when missing materials appear in inventory
- [Phase 01-03]: Build action handled before executeAction dispatch (managed by builder.js, not mod API)
- [Phase 02-01]: Concatenated food + building knowledge into single variable -- avoids changing buildSystemPrompt signature
- [Phase 02-01]: Farm cycle completes at 'waiting' phase by nulling _activeFarm -- agent free to do other tasks while crops grow
- [Phase 02-01]: Sapling replanting is best-effort (silent catch) -- doesn't block agent if placement fails
- [Phase 02-01]: Farm and harvest added to SUSTAINED_ACTIONS for pipelining support
- [Phase 02-02]: Used isTouchingWater() over isSubmergedInWater() for bobber detection -- MC 1.21.1 compatibility
- [Phase 02-02]: Breed is agent-orchestrated (two interact_entity calls with 500ms gap) for partial success reporting
- [Phase 02-02]: Fish passes directly through executeAction to mod -- no special agent handler needed
- [Phase 03-02]: isKnownPlayer added to social.js rather than duplicating players data -- single source of truth
- [Phase 03-02]: Chest tracking records location even without mod content support -- hook exists for future enhancement
- [Phase 03-02]: Build completion detected inline at resumeBuild result, not via wasBuildActive edge detection
- [Phase 03-02]: Memory context appended as MEMORY CONTEXT section to planner user message
- [Phase 03-01]: JSONL for append-only event streams (autobiography, chat), JSON for mutable state (chests)
- [Phase 03-01]: Sentiment decay applied before each interaction update, not on timer -- simpler, no background process
- [Phase 03-01]: Notable interactions stored separately (max 5) from general interactions (max 20) for planner use
- [Phase 03-01]: Chat history caps at 50 entries both in-memory and on disk with rewrite on overflow
- [Phase 04-01]: needs.js is pure calculation module with zero imports -- planner passes all data as arguments
- [Phase 04-01]: Behavior mode injected into both system prompt (rules) and user content (status) for maximum LLM awareness
- [Phase 04-01]: Social time section only added when behaviorMode is social AND nearbyPlayers.length > 0
- [Phase 04-01]: Home position from getHome() passed to calculateNeeds for night-away-from-home safety penalty
- [Phase 04]: Behavior hints injected after CURRENT STRATEGY section in system prompt for contextual layering
- [Phase 04]: Idle hint placed before GAME STATE in user message so LLM sees boredom nudge early
- [Phase 04]: meaningfulActions set determines idle counter reset — only game-world-changing actions count, not info/chat
- [Phase 05-01]: Danger zones stored as regular location entries with type='danger' -- reuses existing locations object
- [Phase 05-01]: Cap at 10 danger zones with oldest-eviction to prevent unbounded growth
- [Phase 05-01]: 30-block radius for proximity warnings -- close enough to be relevant, far enough to warn early

## Roadmap Evolution

- Phase 7 added: Audit fixes — double trim bug, wait action, dead deps, missing tests, config drift (from post-Phase-1-3 codebase audit)

## Notes

- Research agent running in background investigating Voyager, STEVE-1, MineDojo approaches
- Building system is highest impact — visible, immediate, makes agents feel real
- Memory system is highest complexity — cross-cutting concern affecting everything
