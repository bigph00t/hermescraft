# Phase 1: Reliability - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all bugs that cause silent context loss, broken skill injection, chat re-processing, and failed reconnects. After this phase, the agent's foundational systems (memory, compression, skills, communication, connectivity) work correctly and reliably.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure/bug-fix phase. Key constraints from deep dive:

- `trimHistoryGraduated` must splice on conversation round boundaries (user+assistant+optional tool = 1 round), never leaving an orphaned `tool` role message as the first entry
- The corrupt tool call handler at `llm.js:266-270` must use graduated trim, not `conversationHistory.length = 0`
- L1 conversation history persistence should use the existing `periodicSave()` cadence (every 20 ticks) to avoid per-tick I/O overhead
- History restore on startup should be best-effort — corrupted history files should be discarded, not crash the agent
- Skill injection fix: `skills.js:146` returns `.content` but skills have `.body` — straightforward property name fix
- Chat dedup: track last-seen message index or timestamp on the Node.js side, not mod side — minimizes Java changes
- AutoConnect: reset `autoConnectAttempted` when `client.player` transitions from non-null to null (was connected, now disconnected)

</decisions>

<code_context>
## Existing Code Insights

### Key Files to Modify
- `agent/llm.js:58-64` — trimHistoryGraduated boundary bug
- `agent/llm.js:266-270` — second full-wipe path (corrupt tool call handler)
- `agent/llm.js:32` — conversationHistory in-memory array (needs disk persistence)
- `agent/skills.js:146` — `.content` vs `.body` mismatch
- `agent/index.js:366-410` — chat processing (needs dedup tracking)
- `agent/memory.js:380-387` — periodicSave (add history persistence here)
- `mod/src/main/java/hermescraft/HermesBridgeMod.java:88-102` — autoConnect logic

### Established Patterns
- Periodic save already exists (`periodicSave()` in memory.js, called every 20 ticks)
- Data directory per agent (`agentConfig.dataDir`) — use for history persistence
- Ring buffer pattern in Java mod for chat messages
- Round-based history structure: user + assistant + optional tool = 1 round

### Integration Points
- `loadMemory()` / `periodicSave()` are the persistence lifecycle hooks
- `trimHistory()` already respects round boundaries — use same pattern for `trimHistoryGraduated`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. All bugs are well-characterized from the deep dive with exact file paths and line numbers.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
