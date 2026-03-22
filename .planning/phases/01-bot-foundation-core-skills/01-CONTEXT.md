# Phase 1: Bot Foundation + Core Skills - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

A headless Mineflayer bot connects to Paper 1.21.1, navigates to coordinates, digs blocks, places blocks, and executes gather and mine skills — all with post-action verification and a cooperative interrupt harness so higher-level skills can safely cancel in-flight operations.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from PROJECT.md and STATE.md:
- Mind + Body split: LLM layer (mind/) never imports skill functions; body/ never calls LLM
- Cooperative interrupt: every skill checks `bot.interrupt_code` after every `await`
- Pathfinder hang: wrap `goto()` in wall-clock timeout
- Silent dig/place: verify block state changed with `bot.blockAt()` after every dig and place
- Item name normalization: port v1 normalizer before writing any skill
- Validate `mineflayer-pathfinder` 2.4.5 live on Paper 1.21.1 before full skill dev

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agent/normalizer.js` — v1 item name normalizer, to be ported/adapted
- `agent/crafter.js` — BFS crafting chain solver using minecraft-data
- `minecraft-data` ^3.105.0 — already a dependency
- `mineflayer` ^4.35.0 — already a dependency, not yet used as primary bot framework

### Established Patterns
- ES Modules throughout (`"type": "module"`)
- 2-space indent, no-semi, single quotes
- Named exports only, no default exports
- `init<Subsystem>` pattern for module initialization
- Config objects passed by reference from `loadAgentConfig()`
- Module header: one-line purpose comment
- Per-agent data isolation under `agent/data/<AGENT_NAME>/`

### Integration Points
- `agent/index.js` — current entry point, will need restructuring for Mind + Body
- `agent/config.js` — env var loading, SOUL file discovery
- `agent/logger.js` — rich terminal logging with named exports
- Paper 1.21.1 server (localhost:25565) — connection target

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
