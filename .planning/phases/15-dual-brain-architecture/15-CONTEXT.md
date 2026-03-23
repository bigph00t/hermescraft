# Phase 15: Dual-Brain Architecture - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Each agent has a background brain (9B) that runs every 30-60s, producing insights, plans, and constraints that the main brain (27B) reads on each tick. Implements the Talker-Reasoner pattern (DeepMind 2024) with shared JSON state.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key research decisions already captured in STATE.md:
- Talker-Reasoner pattern (DeepMind 2024): Main brain every 3s (tick), background every 30-60s
- Shared JSON state via brain-state.json
- Ring buffers: 20 insights, 50 spatial entries, 100 partner observations
- Background brain connects to port 8001 (vLLM Qwen3.5-9B), main brain to port 8000 (llama-server heretic 27B)
- File-based communication (atomic renameSync) — no Redis needed

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mind/index.js` — main agent tick loop, where background brain integration point lives
- `mind/llm.js` — LLM client (OpenAI-compatible), needs second client instance for port 8001
- `mind/prompt.js` — system prompt builder, where brain-state injection goes
- `start.js` — agent startup, needs background brain initialization

### Established Patterns
- OpenAI-compatible API client via `openai` package
- Environment-based configuration (VLLM_URL, MODEL_NAME)
- Module init pattern: `init<Subsystem>` functions called at startup
- File-based data persistence in `data/<agent>/`
- Periodic save pattern in index.js (periodicSave)

### Integration Points
- Background brain module should follow `init<Subsystem>` pattern
- brain-state.json goes in `data/<agent>/brain-state.json`
- System prompt injection via `buildSystemPrompt()` in mind/prompt.js
- Second LLM endpoint: VLLM_URL_SECONDARY or BACKGROUND_BRAIN_URL env var

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

Research files for deep context:
- `.planning/research/DUAL-BRAIN-ARCHITECTURE.md` — Talker-Reasoner pattern details
- `.planning/research/ARCHITECTURE.md` — Integration design, dual-brain data flow

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
