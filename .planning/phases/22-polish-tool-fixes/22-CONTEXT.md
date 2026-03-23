# Phase 22: Polish & Tool Fixes - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Fix accumulated bugs, tune prompts, ensure overnight stability. This is the final polish phase before RunPod deployment. Focus on auto-equip, crash resilience, prompt quality, and persistence verification.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Known bugs from STATE.md:
- Tool auto-equipping bug: agents mine with fists instead of pickaxe
- Nightly agent restart for ONNX memory leak mitigation (embedding model)
- ONNX tensor memory leak (transformers.js issue #860)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mind/index.js` — tick loop, action dispatch
- `body/skills/` — all skill implementations
- `mind/prompt.js` — system prompt builder
- `mind/memoryDB.js` — SQLite persistence
- `mind/backgroundBrain.js` — brain-state.json persistence
- `mind/spatial.js` — spatial database
- `start.js` — agent startup sequence

### Integration Points
- Auto-equip before mine/gather dispatch in mind/index.js
- Crash recovery handlers in mind/index.js (uncaughtException, unhandledRejection)
- Periodic save in index.js (periodicSave)
- Memory/brain-state/spatial persistence on clean shutdown

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
