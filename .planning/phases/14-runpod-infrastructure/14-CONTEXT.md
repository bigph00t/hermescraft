# Phase 14: RunPod Infrastructure - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Custom Qwen3.5-27B heretic fine-tune running on RunPod A6000 48GB, replacing MiniMax M2.7, with secondary 9B model for background brain

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mind/index.js` — main agent tick loop, LLM integration
- `start.js` — agent startup configuration
- `launch-duo.sh` — multi-agent launch script
- `docker-compose.yml` — existing container configuration

### Established Patterns
- OpenAI-compatible API client via `openai` package in `mind/index.js`
- Environment-based configuration (VLLM_URL, MODEL_NAME, etc.)
- `.env` files for deployment-specific config

### Integration Points
- `VLLM_URL` environment variable controls LLM endpoint
- `MODEL_NAME` controls which model is requested
- `launch-duo.sh` orchestrates multi-agent startup

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
