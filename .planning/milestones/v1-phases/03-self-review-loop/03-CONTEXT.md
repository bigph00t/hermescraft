# Phase 3: Self-Review Loop - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the plan→execute→review loop: after completing a subtask, the agent checks game state against expected outcomes and logs pass/fail. On failure, it retries with a different approach. Before executing any action, the agent validates it against known constraints (e.g., can't craft without ingredients). After this phase, the agent self-corrects instead of blindly proceeding.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Key design constraints:

- **Subtask outcome review (WRK-03):** After the agent marks a subtask as "done" via update_task, it should compare the expected outcome (from the task description) against the actual game state on the NEXT tick. If the game state doesn't match expectations (e.g., "craft wooden_pickaxe" but no pickaxe in inventory), mark the subtask as "failed" and log the discrepancy. Use the existing task state in `tasks.json` — add an `expected_outcome` field to each subtask and a `review_result` field for pass/fail/skipped.

- **Retry on failure (WRK-04):** When a subtask fails review, the agent should NOT mark the next subtask as in-progress. Instead, it should retry the failed subtask with a modified approach. Add retry tracking to tasks.json (retry_count, max_retries=2). If max retries exceeded, mark as "blocked" and move to next subtask. The system prompt should include the failure reason so the agent can reason about what went wrong.

- **Pre-execution validation (WRK-05):** Before executing a game action, validate it against the current game state. Key validations: (1) craft — check inventory has required ingredients, (2) navigate — check coords are in valid range, (3) equip — check item exists in inventory, (4) eat — check food is available, (5) smelt — check furnace nearby and item in inventory. Invalid actions should be logged and the agent told to try something else, rather than sending them to the mod API. Implement as a `validatePreExecution(action, state)` function called in tick() before executeAction().

- **Integration with existing systems:** The review happens in the tick loop, not as a separate LLM call. The agent sees the review result in its next tick's user message and naturally adjusts. This fits the tick budget constraint — no extra LLM calls needed.

</decisions>

<code_context>
## Existing Code Insights

### Key Files to Modify
- `agent/index.js` — Add pre-execution validation, post-subtask review logic in tick loop
- `agent/prompt.js` — Extend buildUserMessage to show review results and retry context
- `agent/actions.js` — Add validatePreExecution function

### Established Patterns (from Phase 2)
- tasks.json structure: `{ goal, subtasks: [{ id, description, status, ... }] }` in dataDir
- loadTaskState/saveTaskState functions in index.js
- == TASK PLAN == section in buildUserMessage
- update_task tool handler with auto-advance

### Integration Points
- validatePreExecution needs access to game state (already available in tick as `state`)
- Review logic needs to compare state against task expectations — runs between ticks
- Retry logic modifies task state — uses existing saveTaskState

</code_context>

<specifics>
## Specific Ideas

The user wants agents that "truly remember and learn" and "complete long tasks that yield good results." The review loop is the key differentiator from fire-and-forget: the agent should feel like it's checking its work, not just blindly executing a list. When something fails, the failure reason and the retry attempt should be visible in the agent's reasoning.

</specifics>

<deferred>
## Deferred Ideas

- Learning from review outcomes across sessions (feed into L2 memory lessons)
- Multi-agent review where one agent reviews another's work

</deferred>
