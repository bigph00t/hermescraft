# Phase 6: Creative Building - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Agents build complete structures — walls, roof, floor — from structured plans, choose what to build based on their personality and the state of the world, and return across sessions to expand their base.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from PROJECT.md and STATE.md:
- Mind + Body split: build skill lives in body/, build choice/planning is LLM-driven in mind/
- Post-place verification: every block placement must be verified server-side (from Phase 1 body/place.js)
- Cooperative interrupt: build skill checks interrupt after every placement
- Personality-driven: Jeffrey's curiosity drives different builds than John's pragmatism — expressed through LLM system prompt, not hardcoded rules
- Cross-session persistence: build plans and progress saved to per-agent data dir
- v1 had blueprints system (agent/blueprints/, agent/blueprints.js, agent/builder.js, agent/freestyle.js) — reference for patterns
- Structured plans: floor, walls, roof as block-by-block placement lists
- SOUL files define creative personality traits for each agent

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `body/place.js` — Phase 1 place primitive with post-place verification
- `body/navigate.js` — Phase 1 navigate with timeout
- `body/interrupt.js` — Cooperative interrupt harness
- `body/skills/gather.js` — Gather resources for building
- `body/skills/craft.js` — Craft building materials
- `mind/prompt.js` — System prompt builder (extend with build context)
- `mind/registry.js` — Command registry (wire !build command)
- `mind/memory.js` — Persistent memory (store build plans/progress)
- `mind/locations.js` — Named locations (save build sites)
- `agent/blueprints.js`, `agent/builder.js`, `agent/freestyle.js` — v1 building system (reference)
- `agent/blueprints/` — v1 blueprint definitions (reference)

### Established Patterns
- ES Modules, 2-space indent, no-semi, single quotes
- Skills return `{ success, reason, ... }` objects
- `isInterrupted(bot)` checks after every `await`
- Per-agent data in `data/<AGENT_NAME>/`

### Integration Points
- `mind/registry.js` — wire !build command
- `mind/prompt.js` — inject build context (current plan, progress)
- `mind/memory.js` — persist build plans across sessions
- `body/place.js` — block placement with verification
- `body/navigate.js` — move to build site
- SOUL files — personality traits drive build choices

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
