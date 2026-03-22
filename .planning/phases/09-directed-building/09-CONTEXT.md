# Phase 9: Directed Building - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Players can instruct the bot in natural language to build specific structures or change materials, and the bot executes correctly. Build area scanning enables the bot to see what exists.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion.

Key constraints:
- Phase 8 provides !design command and blueprint generation pipeline — this phase makes it player-accessible
- "build a dock here" = player chat triggers !design with bot's current position as coordinates
- "use stone on this wall" = material specification modifies active build plan's palette
- Build scanning = new body/ skill using bot.blockAt() in a 3D bounding box
- Mind/Body boundary: scan skill in body/, material interpretation in mind/
- Material specification must work on both active builds and new builds

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mind/index.js` — designAndBuild() from Phase 8 (LLM → validate → build pipeline)
- `mind/prompt.js` — buildDesignPrompt(), system prompt with !design
- `body/skills/build.js` — build(), getActiveBuild(), palette system
- `body/blueprints/validate.js` — validateBlueprint()
- `mind/registry.js` — 12 commands including !design

### Integration Points
- Chat triggers in mind/index.js — detect directed building requests
- Active build state — modify palette mid-build
- Bot position — use as default build coordinates
- New !scan command for area inspection

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
