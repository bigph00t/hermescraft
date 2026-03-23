# Phase 16: Vision System - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Agents can "see" their world via screenshots, processed by VLM into spatial understanding. On-demand `!see` command + periodic background brain processing. prismarine-viewer for headless rendering, Qwen2.5-VL-7B for image understanding.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key research decisions from STATE.md:
- On-demand `!see` tool via prismarine-viewer headless + Qwen2.5-VL-7B
- NOT per-tick vision — too expensive. On-demand via tool call + periodic via background brain
- prismarine-viewer processes 320×240 screenshot in ~100 tokens, 130ms on A100
- Top-down minimap as lightweight alternative (block data, no VLM needed)
- Screenshots stored in `data/<agent>/screenshots/` with timestamps

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mind/backgroundBrain.js` — background brain module (Phase 15), integration point for periodic vision
- `mind/index.js` — main tick loop, tool dispatch
- `body/skills/build.js` — existing tool pattern for adding `!see`
- `mind/spatial.js` — spatial awareness module, where vision results get injected

### Established Patterns
- Tools defined in body/ directory, registered in tool registry
- `!command` text-based tool calling (not JSON tool_choice)
- Background brain runs on 30s interval, writes to brain-state.json
- Data files stored in `data/<agent>/`

### Integration Points
- `!see` tool follows existing `!command` pattern
- Vision results feed into spatial awareness (mind/spatial.js)
- Background brain (mind/backgroundBrain.js) periodically captures and processes screenshots
- VLM endpoint: separate from main LLM, needs its own URL env var

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

Research files for deep context:
- `.planning/research/VISION-SCREENSHOTS.md` — prismarine-viewer headless, VLM options, minimap alternative

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
