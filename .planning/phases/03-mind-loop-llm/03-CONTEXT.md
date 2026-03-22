# Phase 3: Mind Loop + LLM - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

The LLM layer fires on events (chat received, skill complete, idle timeout), outputs !commands the Body executes, and maintains a 40-turn rolling history — the end-to-end Mind + Body pipeline is alive.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from PROJECT.md and STATE.md:
- Mind + Body split: mind/ layer never imports skill functions directly; body/ never calls LLM — boundary is enforced
- Event-driven LLM: fires on chat received, skill complete, or idle — not on a fixed tick
- NO ARTIFICIAL DELAYS: the Mind should think as fast and often as possible. No arbitrary cooldowns, no forced wait timers
- NO ARTIFICIAL CAPS: don't hardcode turn limits. Use graduated trimming when context gets large
- MiniMax M2.7 via OpenAI-compatible API — already configured via VLLM_URL and MODEL_NAME env vars
- !command pattern for LLM → Body dispatch (e.g., !gather oak_log 10, !craft wooden_pickaxe)
- v1 agent/llm.js has OpenAI client, conversation history, trimming — reference for patterns
- v1 agent/prompt.js has system prompt builder — reference for prompt engineering
- Research flag from STATE.md: MiniMax M2.7 !command syntax compliance needs smoke test

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agent/llm.js` — v1 OpenAI-compatible LLM client, conversation history, graduated trimming
- `agent/prompt.js` — v1 system prompt builder
- `agent/config.js` — env var loading (VLLM_URL, MODEL_NAME, TEMPERATURE, etc.)
- `openai` ^4.0.0 — already installed
- All body/ skills from Phase 1+2 (gather, mine, craft, smelt, chest, inventory)

### Established Patterns
- ES Modules, 2-space indent, no-semi, single quotes
- Named exports only
- body/ skills return `{ success, reason, ... }` objects
- Cooperative interrupt via `bot.interrupt_code`
- Config via env vars loaded in config.js

### Integration Points
- `body/bot.js` — bot instance, events (chat, spawn, death)
- `body/skills/*` — all skill functions to dispatch to
- `body/interrupt.js` — cancel in-flight skills before starting new ones
- `openai` SDK — LLM API calls
- `VLLM_URL`, `MODEL_NAME` env vars — LLM endpoint config

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
