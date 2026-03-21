# Phase 2: Planning Capability - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the agent the ability to write its own persistent context documents, automatically select the right skill for the situation, decompose complex instructions into multi-step plans, and track progress against those plans each tick. After this phase, the agent can handle "build a house" by breaking it into steps, tracking what's done, and knowing what's next.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase building new agent capabilities. Key design constraints:

- **Agent-writable pinned context (MEM-04):** Add a new `save_context` tool to GAME_TOOLS in `agent/tools.js`. When called, writes a file to `agentConfig.dataDir/context/`. Handle in index.js same as other INFO_ACTIONS. File naming should be agent-controlled (e.g., `save_context({ filename: "plan.md", content: "..." })`). Max 5 files, max 8000 chars per file (matching existing loadPinnedContext limits).

- **Automatic skill selection (SKL-02):** Extend `getActiveSkill` in `agent/skills.js` to select skills based on multiple signals: current phase (existing), current goal text (for directed mode), and game state context (e.g., if agent is in combat, prefer combat skills). The agent shouldn't need manual config to get the right skill. Consider a simple scoring/matching system rather than hardcoded if/else.

- **Task decomposition (WRK-01):** Add a `plan_task` tool that lets the agent write a structured plan to its notepad with discrete subtasks. Format: numbered steps with `[ ]`/`[x]` checkboxes. The notepad already persists to disk — extend it to support structured task tracking. Consider a separate `tasks.json` file in dataDir for machine-readable tracking alongside the human-readable notepad.

- **Per-tick progress tracking (WRK-02):** Each tick, the agent should see its current plan progress in the user message. Extend `buildUserMessage` in `agent/prompt.js` to include task completion status from the structured task list. The agent should know: what's done, what's current, what's next, what's blocked.

</decisions>

<code_context>
## Existing Code Insights

### Key Files to Modify
- `agent/tools.js` — Add `save_context` and `plan_task` tools to GAME_TOOLS
- `agent/index.js` — Handle new tools in INFO_ACTIONS, load task state each tick
- `agent/skills.js` — Extend getActiveSkill with multi-signal selection
- `agent/prompt.js` — Extend buildUserMessage with task progress display

### Established Patterns
- INFO_ACTIONS pattern in index.js — tools that return data to LLM without game state changes
- loadPinnedContext already reads from dataDir/context/ — just need write side
- Notepad persistence pattern (readNotepad/writeNotepad in index.js) — extend for structured tasks
- Skills have `.phase`, `.name`, `.description`, `.body` fields
- buildUserMessage already has progressDetail section — extend it

### Integration Points
- New tools must be added to both GAME_TOOLS array (tools.js) and INFO_ACTIONS set (actions.js)
- Task state needs to be loaded in tick() and passed to buildUserMessage
- Skill selection needs access to agentConfig.mode, currentPhase, and game state

</code_context>

<specifics>
## Specific Ideas

The user wants "GSD-type flow" — agents that plan before they act, track progress, and complete long tasks with good results. The task decomposition should feel natural: when given "build a house", the agent writes a plan to its pinned context, tracks steps, and references it each tick.

</specifics>

<deferred>
## Deferred Ideas

- Multi-agent task delegation (v2 — MA-01, MA-02)
- Semantic memory search for skill selection (v2 — AME-01)

</deferred>
