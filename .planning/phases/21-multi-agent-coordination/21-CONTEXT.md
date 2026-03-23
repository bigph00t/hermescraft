# Phase 21: Multi-Agent Coordination - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Multiple agents coordinate without duplicate work, chat loops, or state conflicts. Shared JSON + atomic renameSync for inter-agent communication. No Redis needed.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key research decisions from STATE.md:
- Shared JSON + atomic renameSync for coordination (no Redis)
- Task claiming via shared file in a common data directory
- Chat loop prevention: force non-chat action after 3 consecutive chats
- Build section assignment: spatial decomposition from Phase 19 buildPlanner
- Partner activity sharing via shared state file

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mind/social.js` — existing social/chat module
- `mind/index.js` — tick loop, action dispatch
- `mind/prompt.js` — system prompt with partner context
- `mind/buildPlanner.js` — build section decomposition (Phase 19)
- `mind/backgroundBrain.js` — partner observations in brain-state.json
- `data/<agent>/` — per-agent data directories

### Established Patterns
- Atomic file writes via writeFileSync + renameSync
- Per-agent data isolation in data/<agent>/
- Background brain partner observations (ring buffer, 100 entries)
- `!command` text-based tool dispatch

### Integration Points
- Shared coordination file: `data/shared/coordination.json`
- Task claiming integrated into action dispatch
- Chat counter in mind/index.js for loop prevention
- Partner activity in system prompt

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
