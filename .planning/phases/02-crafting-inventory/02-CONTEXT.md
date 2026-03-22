# Phase 2: Crafting + Inventory - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Bot resolves full crafting dependency chains, smelts items in furnaces, deposits and withdraws from chests, auto-equips best tools and armor, and eats autonomously — the complete resource management loop.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from PROJECT.md and STATE.md:
- Mind + Body split: these are body/ skill functions — no LLM calls
- Cooperative interrupt: every skill checks `bot.interrupt_code` after every `await`
- Existing v1 crafter.js has BFS crafting chain solver using minecraft-data — port/adapt to new body/ structure
- Item name normalization via body/normalizer.js (created in Phase 1)
- All skills use Phase 1 primitives (navigate, dig, place) from body/

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agent/crafter.js` — v1 BFS crafting chain solver using minecraft-data (port to body/)
- `body/bot.js` — Bot lifecycle, mineflayer instance, pathfinder + tool plugins
- `body/interrupt.js` — Cooperative interrupt harness
- `body/normalizer.js` — Item + block name normalizer
- `body/navigate.js` — Navigate with wall-clock timeout
- `body/dig.js` — Dig with post-dig verification
- `body/place.js` — Place with post-place verification
- `body/skills/gather.js` — Gather skill (Phase 1)
- `body/skills/mine.js` — Mine skill (Phase 1)
- `minecraft-data` — Already installed, provides recipes and item data

### Established Patterns
- ES Modules, 2-space indent, no-semi, single quotes
- Named exports only, `init<Subsystem>` pattern
- Skills in `body/skills/` directory
- Every skill checks `isInterrupted(bot)` after every `await`

### Integration Points
- `body/bot.js` — bot instance used by all skills
- `mineflayer` API: `bot.craft()`, `bot.openContainer()`, `bot.equip()`, `bot.consume()`
- `minecraft-data` recipes — crafting dependency resolution
- Paper server plugins (VeinMiner, AutoPickup) may affect behavior

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
