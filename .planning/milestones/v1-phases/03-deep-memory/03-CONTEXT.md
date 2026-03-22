# Phase 3: Deep Memory System - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents remember everything — places, people, events, conversations — across sessions and reference them naturally. Memory persists to disk files. Planner loop consolidates and surfaces relevant memories.

</domain>

<decisions>
## Implementation Decisions

### Memory Storage
- **D-01:** File-based persistence. Extend existing locations.json, players.json. Add autobiography.jsonl and chat-history.jsonl.
- **D-02:** autobiography.jsonl — one JSON entry per significant event: built house, found diamonds, died, met player, first night survived. Timestamp + description + coordinates.
- **D-03:** chat-history.jsonl — last 50 chat messages with timestamps and sender. Persisted across restarts.
- **D-04:** Chest tracking: on interact_block(chest), store chest contents in chests.json keyed by coordinates.

### Memory Recall
- **D-05:** Planner loop (60s) reads ALL memory files, generates a condensed "memory context" written to plan-context.txt. Includes: recent events, relationship summaries, nearby known locations, things worth mentioning.
- **D-06:** Action loop gets condensed memory context each tick via plan-context.txt. Never reads raw memory files directly (too expensive).
- **D-07:** "Things you might mention" section in plan-context — recent discoveries, deaths, encounters. LLM naturally weaves these into conversation.

### Home Concept
- **D-08:** Agent auto-saves home coords when it first builds a shelter (or places a bed). Stored in locations.json as "home".
- **D-09:** Planner tracks "time since home visit" and nudges agent to return when away too long.

### Conversation Memory
- **D-10:** Store chat messages in chat-history.jsonl with timestamp, sender, content.
- **D-11:** Planner summarizes recent conversations into relationship context ("John talked about kidney stones yesterday", "Jeffrey mentioned his island twice").

### Claude's Discretion
- How many autobiography entries to keep (suggest: last 100)
- Exact format of "things you might mention" section
- Threshold for "time since home" nudge

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured above.

### Existing Memory Code
- `agent/memory.js` — Current L2 memory (lessons, strategies, world knowledge)
- `agent/social.js` — Player relationship tracking
- `agent/locations.js` — Named location memory
- `agent/planner.js` — Planner loop (writes plan-context.txt — extend with memory)
- `agent/prompt.js` — Prompt builder (injects memory context)

</canonical_refs>

<specifics>
## Specific Ideas

- Memory should feel organic — agent references past events naturally, not mechanically
- Planner loop is the memory consolidation engine — runs every 60s, has time to read files
- Action loop stays fast — only reads plan-context.txt, never raw memory files

</specifics>

<deferred>
## Deferred Ideas

- Semantic search over memories — future (keyword matching is fine for now)
- Memory decay (forgetting old events) — future
- Shared village memory between agents — Phase 6 (coordination)

</deferred>

---

*Phase: 03-deep-memory*
*Context gathered: 2026-03-21 via smart discuss*
