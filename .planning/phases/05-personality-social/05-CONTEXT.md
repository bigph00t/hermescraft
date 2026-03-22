# Phase 5: Personality + Social - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Jeffrey and John load their SOUL personalities, remember lessons across sessions, speak only about what they have actually observed in the game world, coordinate with each other via natural chat, and follow a day/night routine.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — patterns carry over from v1. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from PROJECT.md and STATE.md:
- SOUL personality files (Jeffrey, John) carry over from v1 — SOUL-jeffrey.md, SOUL-john.md at project root
- Memory system pattern carries over: MEMORY.md (lessons/strategies), session transcripts, per-agent data dirs
- Anti-meta-game enforcement: agents must never reference items/locations/events not actually observed
- Natural grounded chat: only reference real game state, never hallucinate
- v1 data isolation: fresh data/jeffrey/ and data/john/ directories; v1 data archived as *_v1/
- v1 memory contamination: do NOT load v1 MEMORY.md — contains dead action vocabulary
- Mind + Body split: personality/social features live in mind/ layer
- MiniMax M2.7 for LLM — personality expressed through system prompt + conversation
- Per-agent config via AGENT_NAME env var
- Multi-agent: 2 bots for now (Jeffrey, John), designed to scale to 5-10
- No artificial throttling on chat — but throttle output (chat spam), not thinking

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SOUL-jeffrey.md`, `SOUL-john.md` — v1 personality files at project root
- `agent/memory.js` — v1 memory system (MEMORY.md, stats, session transcripts)
- `agent/social.js` — v1 social/player tracking (sentiment scoring)
- `agent/locations.js` — v1 named world locations
- `agent/config.js` — v1 env var loading, SOUL file discovery
- `mind/llm.js` — Phase 3 LLM client with conversation history
- `mind/prompt.js` — Phase 3 prompt builder (extend with personality + memory)
- `mind/index.js` — Phase 3 Mind loop (extend with social events)
- `body/bot.js` — Bot lifecycle, mineflayer events

### Established Patterns
- ES Modules, 2-space indent, no-semi, single quotes
- Per-agent data isolation under agent/data/<AGENT_NAME>/
- SOUL files: SOUL-<agentname>.md at project root
- Memory: MEMORY.md, stats.json, sessions/*.jsonl in data dir

### Integration Points
- `mind/prompt.js` — inject SOUL personality, memory, social context into system prompt
- `mind/index.js` — handle chat events for social (dedup own messages, track players)
- `start.js` — load per-agent config, init memory/social subsystems
- `body/bot.js` — mineflayer chat events, time-of-day for day/night routine

</code_context>

<specifics>
## Specific Ideas

No specific requirements — patterns carry over from v1. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
