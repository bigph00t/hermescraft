# Phase 17: Memory Foundation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Agents accumulate a persistent, spatially-tagged event log across sessions — no experience is ever lost. SQLite (better-sqlite3) event log with Stanford Generative Agents importance scoring, spatial coordinates on every event, and FIFO pruning for bounded growth.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key research decisions from STATE.md:
- SQLite via better-sqlite3 (synchronous API, zero-dependency native module)
- Stanford Generative Agents importance scoring: deaths=10, discoveries=8, combat=7, building=6, routine=2
- Every event carries (x, z, dimension) coordinates from bot position
- FIFO pruning with configurable max events (default 10,000)
- Event types: death, build, discovery, combat, craft, social, movement, observation
- Schema: id, timestamp, event_type, importance, x, z, dimension, description, metadata (JSON)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mind/memory.js` — existing memory module (L2 MEMORY.md, death countermeasures, skill updates)
- `mind/index.js` — tick loop where events get logged (death handler, action results)
- `mind/spatial.js` — bot position tracking, provides coordinates for spatial tagging
- `data/<agent>/` — per-agent data directory pattern

### Established Patterns
- File-based persistence in `data/<agent>/`
- `init<Subsystem>` pattern for module startup
- Module state via module-level variables
- Periodic save pattern (periodicSave in index.js)

### Integration Points
- `initMemoryDB(config)` called at startup in start.js
- Event logging calls from index.js (death, action results, phase changes)
- Spatial coordinates from `mind/spatial.js` bot position
- SQLite DB file: `data/<agent>/memory.db`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

Research files for deep context:
- `.planning/research/FEATURES.md` — Stanford Generative Agents, memory patterns
- `.planning/research/ARCHITECTURE.md` — Memory as second RAG, integration design
- `.planning/research/PITFALLS.md` — Memory bloat, ONNX leak warnings

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
