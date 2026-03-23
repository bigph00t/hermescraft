# Phase 19: Enhanced Spatial + Building - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Agents have rich entity awareness, can verify builds, and can plan/execute 500+ block structures. LLM generates structured build specs from natural language; deterministic code handles coordinates. Builds decompose into sections for persistence across sessions.

Note: SPA-01 (entity awareness), SPA-02 (post-build scan), and SPA-04 (area familiarity) were already implemented in Phase 16. This phase extends them and adds the full building system (BLD-01 through BLD-05).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key research decisions from STATE.md:
- LLM generates intent (style, dims, materials) — deterministic code handles coordinates
- Section decomposition for >100 blocks: floor, walls, roof, interior as separate sections
- Build plans stored in `data/<agent>/builds/` as JSON for session persistence
- Material list validation before starting — won't build without sufficient inventory
- Post-build scan (Phase 16 SPA-02) detects missing/wrong blocks and auto-repairs
- Build history in `mind/build-history.js` already exists — extend for persistent plans

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `body/skills/build.js` — existing build skill with `designAndBuild()`, `placeBlockAt()`
- `mind/build-history.js` — build history tracking with atomic file writes
- `mind/spatial.js` — spatial awareness with entity awareness (Phase 16), scanArea
- `mind/index.js` — `!build` command handler, post-build scan hook (Phase 16)
- `mind/vision.js` — screenshot capture for build verification (Phase 16)
- `mind/memoryDB.js` — event logging for build events (Phase 17)

### Established Patterns
- `!command` text-based tool calling
- Atomic file writes via renameSync
- JSON-based data persistence in `data/<agent>/`
- Section-based system prompt injection

### Integration Points
- `!build` command in mind/index.js — enhanced with new build system
- `body/skills/build.js` — extended with section decomposition and material validation
- `data/<agent>/builds/` — persistent build plans
- `mind/prompt.js` — build progress context injection

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

Research files for deep context:
- `.planning/research/ARCHITECTURE.md` — Build decomposition design
- `.planning/research/FEATURES.md` — Voyager-style build patterns

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
