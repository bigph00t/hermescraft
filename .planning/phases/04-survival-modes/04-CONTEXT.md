# Phase 4: Survival Modes - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Autonomous reactive behaviors run on a 300ms Body tick entirely independent of the LLM — the bot survives hostile mobs, avoids environmental hazards, recovers from stuck pathfinding, picks up nearby items, and feels alive between decisions.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from PROJECT.md and STATE.md:
- Mind + Body split: these are body-layer autonomous behaviors — no LLM calls
- 300ms body tick for reactive behaviors, independent of the Mind's event-driven loop
- Cooperative interrupt: body tick behaviors must not conflict with active skills
- Self-preservation (eat, flee hazards) runs WITHOUT LLM involvement
- Combat (attack hostiles, retreat at low health) runs WITHOUT LLM involvement
- Unstuck detection and recovery for pathfinder hangs
- Idle look-at-entities for liveliness
- Auto-pickup nearby dropped items
- v1 agent/index.js has stuck detection patterns — reference for approach

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `body/bot.js` — Bot lifecycle, mineflayer instance
- `body/interrupt.js` — Cooperative interrupt harness
- `body/navigate.js` — Navigate with timeout (used for flee/chase)
- `body/dig.js`, `body/place.js` — Block primitives
- `body/skills/inventory.js` — `eatIfHungry()`, `equipBestArmor()` from Phase 2
- `mind/index.js` — Mind loop (needs integration with body tick)
- `agent/index.js` — v1 stuck detection (reference)
- `minecraft-data` — entity/mob data

### Established Patterns
- ES Modules, 2-space indent, no-semi, single quotes
- Named exports, body/ skill functions return `{ success, reason }`
- `isInterrupted(bot)` checks after every `await`

### Integration Points
- `body/bot.js` — bot instance, mineflayer events
- `mind/index.js` — Mind loop needs to know about body tick state
- `mineflayer` events: `entityHurt`, `health`, `physicsTick`
- `mineflayer-pathfinder` — position tracking for stuck detection

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
