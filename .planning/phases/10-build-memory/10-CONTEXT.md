# Phase 10: Build Memory - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Build history persists across sessions and the bot can return to a previous site and extend it autonomously.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion.

Key constraints:
- Build completion already records worldKnowledge + saveLocation (Phase 6/8)
- Build state already persists to build_state.json (Phase 6)
- scanArea() exists (Phase 9) — bot can see what's already built
- Need a build_history.json that records all completed builds with metadata
- On session start, LLM should know about previous builds from MEMORY.md worldKnowledge
- Bot should be able to resume/extend builds: scan site, diff against plan, place only missing blocks
- Mind/Body boundary: history file in data dir, prompt injection in mind/

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `body/skills/build.js` — build(), getActiveBuild(), build_state.json persistence
- `body/skills/scan.js` — scanArea() for site inspection
- `mind/memory.js` — addWorldKnowledge(), getMemoryForPrompt()
- `mind/locations.js` — saveLocation(), getLocationsForPrompt()
- `mind/index.js` — build completion recording (addWorldKnowledge + saveLocation)
- `mind/prompt.js` — system prompt injection

### Integration Points
- Build completion in mind/index.js — record to history
- Session start in start.js — load history
- System prompt — inject build history summary
- !scan → diff against previous build → place missing blocks

</code_context>

<specifics>
## Specific Ideas

No specific requirements.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
