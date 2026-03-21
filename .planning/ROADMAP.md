# Roadmap: HermesCraft Agent Hardening & Workflow Overhaul

## Overview

Three phases build on each other: first make the agent reliable (fix the bugs that cause silent context loss and broken state), then give it real planning capability (agent-writable context, task decomposition, progress tracking), then close the loop with self-review so it can detect and correct its own failures. Nothing in Phase 2 is safe to build on a foundation that can wipe its own history.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Reliability** - Fix memory, skill, chat, and reconnect bugs — the agent stops silently losing context
- [ ] **Phase 2: Planning Capability** - Agent can write its own context, decompose tasks, and track progress against a plan
- [ ] **Phase 3: Self-Review Loop** - Agent evaluates outcomes, detects failures, and iterates rather than moving on blindly

## Phase Details

### Phase 1: Reliability
**Goal**: The agent never silently loses its execution context due to bugs in trimming, skill injection, chat deduplication, or reconnect logic
**Depends on**: Nothing (first phase)
**Requirements**: MEM-01, MEM-02, MEM-03, SKL-01, COM-01, COM-02
**Success Criteria** (what must be TRUE):
  1. History trim never produces a conversation state where a `tool` role message is first — verified by running the trim under simulated overflow and checking the boundary
  2. No code path in the agent calls `conversationHistory.length = 0` — graduated trim is the only recovery path
  3. Agent conversation history is present on disk after a simulated crash and correctly restored on next startup
  4. Skill body is correctly injected in open-ended mode — agent receives and can reference skill content during open-ended gameplay
  5. Player chat messages are processed exactly once — re-sending the same chat line from a player does not trigger a second agent response
  6. Agent reconnects after a server kick without requiring a restart — `autoConnectAttempted` resets when the player disconnects post-connection
**Plans**: TBD

Plans:
- [ ] 01-01: Memory & compression fixes (MEM-01, MEM-02, MEM-03)
- [ ] 01-02: Skill injection, chat dedup, and autoconnect fixes (SKL-01, COM-01, COM-02)

### Phase 2: Planning Capability
**Goal**: The agent can write its own persistent context and decompose complex instructions into tracked multi-step plans
**Depends on**: Phase 1
**Requirements**: MEM-04, SKL-02, WRK-01, WRK-02
**Success Criteria** (what must be TRUE):
  1. Agent can call a tool that writes a file to `dataDir/context/` — the file persists and is injected into the next tick's system prompt
  2. Active skill is selected automatically based on current phase/goal — no manual env var or config change needed to switch skills
  3. Given a complex instruction ("build a house"), agent produces a written multi-step plan with discrete subtasks before acting
  4. Each tick, the agent knows which subtask is current, which are done, and which are blocked — plan state is visible in its reasoning
**Plans**: TBD

Plans:
- [ ] 02-01: Agent-writable pinned context tool (MEM-04) and automatic skill routing (SKL-02)
- [ ] 02-02: Task decomposition and per-tick progress tracking (WRK-01, WRK-02)

### Phase 3: Self-Review Loop
**Goal**: The agent evaluates its own actions and subtask outcomes, catching failures and iterating instead of proceeding blindly
**Depends on**: Phase 2
**Requirements**: WRK-03, WRK-04, WRK-05
**Success Criteria** (what must be TRUE):
  1. After completing a subtask, the agent checks the actual game state against the expected outcome and logs a pass or fail
  2. When a subtask fails, the agent retries with a different approach rather than marking it complete and continuing
  3. Before executing a proposed action, the agent rejects obviously invalid actions (e.g., crafting without required ingredients, navigating to coordinates outside valid range) and substitutes a safe alternative
**Plans**: TBD

Plans:
- [ ] 03-01: Subtask outcome review and retry logic (WRK-03, WRK-04)
- [ ] 03-02: Pre-execution action validation gate (WRK-05)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Reliability | 0/2 | Not started | - |
| 2. Planning Capability | 0/2 | Not started | - |
| 3. Self-Review Loop | 0/2 | Not started | - |
