# Phase 8: Blueprint Intelligence - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

The LLM can generate valid blueprint JSON from natural language descriptions using a rich reference library. 10+ reference blueprints in the system prompt. Generated blueprints pass validation.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase.

Key constraints:
- Blueprint JSON format must match existing body/blueprints/ schema: `{ name, description, palette, layers: [{ y, blocks: [{x, z, block}] }] }`
- MiniMax M2.7 via !command text mode — LLM outputs blueprint JSON as a response, not via tool calling
- Need a !design command that takes a description and outputs a blueprint, or extend !build to accept inline descriptions
- Reference blueprints go in body/blueprints/ as JSON files
- Validation layer needed: parse LLM output, check JSON validity, verify layer ordering, check palette against MC blocks
- Mind/Body boundary: blueprint validation can live in body/ (it's data validation), generation prompt lives in mind/

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `body/blueprints/*.json` — 4 existing blueprints (small-cabin, animal-pen, crop-farm, watchtower)
- `body/skills/build.js` — Build skill that executes blueprint JSON
- `mind/prompt.js` — System prompt builder (extend with reference blueprints)
- `mind/registry.js` — Command registry (wire !design or extend !build)
- `mind/llm.js` — LLM client (queryLLM returns parsed text)
- `minecraft-data` — Block name validation

### Integration Points
- `mind/prompt.js` — inject reference blueprints as few-shot examples
- `mind/registry.js` — new command for blueprint generation
- `body/skills/build.js` — generated blueprints fed into existing build()

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
