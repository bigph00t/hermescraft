# Phase 23: Model Switch + Unified Inference - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Replace 3-model architecture (hermes 27B + 9B + VLM) with single Qwen3.5-35B-A3B MoE served via vLLM — native vision, one process for everything.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `infra/start-models.sh` — existing model launch script (currently launches heretic + 9B)
- `infra/setup-pod.sh` — existing pod setup script (currently downloads heretic GGUF + 9B)
- `mind/llm.js` — LLM client with MODEL_NAME default
- `mind/backgroundBrain.js` — background brain module (currently uses separate VLLM_URL port 8001)
- `mind/vision.js` — vision module (currently uses separate port 8002)
- `.env.runpod` — RunPod environment configuration

### Established Patterns
- Environment variables for model configuration (VLLM_URL, MODEL_NAME, MAX_TOKENS)
- infra/ directory for deployment scripts
- Smoke tests validate defaults and module behavior

### Integration Points
- All mind/ modules use VLLM_URL for API calls
- start-models.sh called by start-stack.sh
- setup-pod.sh runs during pod initialization

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
