# Phase 20: Gameplay Loops - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Agents pursue rich, human-like gameplay — farming, hunting, exploring, trading, progressing gear. This phase adds gameplay knowledge and behavior hints to the system prompt so the LLM makes better gameplay decisions, plus new tools for specific gameplay actions.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key design principles:
- Gameplay knowledge injected via system prompt hints, not hardcoded behavior trees
- The LLM decides WHAT to do, the tools execute HOW
- New tools: !farm, !breed, !hunt, !smelt, !explore
- Progression awareness via inventory analysis in system prompt
- Spatial memory (Phase 17) logs discoveries for exploration tracking

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mind/index.js` — tick loop, tool dispatch, existing `!mine`, `!craft` commands
- `mind/registry.js` — command registry (24 commands currently)
- `mind/prompt.js` — system prompt builder with gameplay phase guidance
- `mind/goals.js` — phase-based progression system (7 phases)
- `mind/memoryDB.js` — event logging for exploration discoveries
- `mind/spatial.js` — entity awareness for hunting targets
- `body/skills/` — existing skill implementations

### Established Patterns
- `!command` text-based tool calling
- Skill files in `body/skills/` with action handlers
- Phase-based progression in goals.js
- System prompt gameplay hints in prompt.js

### Integration Points
- New tools registered in mind/registry.js
- New skill files in body/skills/
- Gameplay hints in mind/prompt.js
- Progression tracking in mind/goals.js

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
