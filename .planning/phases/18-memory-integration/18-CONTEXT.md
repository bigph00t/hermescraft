# Phase 18: Memory Integration - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Retrieved past experiences appear in every LLM call — agents demonstrably reference prior sessions. This is the READ side of the memory system (Phase 17 was WRITE). Memory retrieval injected into system prompt, background brain produces reflection journals.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key research decisions from STATE.md:
- Memory retrieval via queryRecent + queryNearby from mind/memoryDB.js (Phase 17)
- Top-K relevant experiences injected into system prompt via Promise.all with knowledge RAG
- 4,000-token budget for total memory context
- Background brain (Phase 15) produces reflection journals — LLM-authored strategy summaries
- Reflection journals stored as high-importance events in SQLite (importance=9)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mind/memoryDB.js` — Phase 17 SQLite module: logEvent, queryRecent, queryNearby, pruneOldEvents
- `mind/backgroundBrain.js` — Phase 15 background brain: 30s interval, brain-state.json, ring buffers
- `mind/prompt.js` — system prompt builder with existing RAG slot (Part 5.7)
- `mind/index.js` — think() function where memory retrieval hooks in
- `mind/knowledgeStore.js` — existing knowledge RAG (BM25 + vector + RRF fusion)

### Established Patterns
- RAG context slot in prompt.js (Part 5.7) with token budget
- Promise.all for parallel retrieval (knowledge RAG pattern)
- Background brain cycle writes to brain-state.json
- Ring buffer pattern for capping state

### Integration Points
- think() in mind/index.js — add memory retrieval alongside knowledge RAG
- buildSystemPrompt() in mind/prompt.js — new Part for memory context
- runBackgroundCycle in mind/backgroundBrain.js — add reflection journal generation
- memoryDB.logEvent for storing reflection journals

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
