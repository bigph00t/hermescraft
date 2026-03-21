# Requirements: HermesCraft Agent Hardening & Workflow Overhaul

**Defined:** 2026-03-20
**Core Value:** The agent must never silently lose its execution context — and when given a complex task, it must plan, execute, and review its own work instead of fire-and-forget.

## v1 Requirements

### Memory & Compression

- [x] **MEM-01**: Graduated trim respects conversation round boundaries — a `tool` role message never becomes the first history entry after trimming
- [x] **MEM-02**: All context overflow and error recovery paths use graduated trim — no remaining `conversationHistory.length = 0` full-wipe paths
- [x] **MEM-03**: Conversation history (L1) is persisted to disk on periodic save and restored on startup — survives OOM/SIGKILL
- [ ] **MEM-04**: Agent can write planning documents to `dataDir/context/` via a tool call — pinned context is agent-writable, not human-only

### Skill & Routing

- [ ] **SKL-01**: Skill injection works correctly in all agent modes (phased, open-ended, directed) — fix `.content` vs `.body` mismatch
- [ ] **SKL-02**: Active skill is automatically selected based on current context (phase, goal, situation) without manual intervention

### Communication

- [ ] **COM-01**: Chat messages are deduplicated — agent tracks last-seen message and never re-processes the same player message
- [ ] **COM-02**: Auto-reconnect works after server kicks/disconnects — `autoConnectAttempted` resets when player becomes null after being connected

### Agent Workflows

- [ ] **WRK-01**: Agent can decompose complex instructions into a multi-step plan with tracked subtasks
- [ ] **WRK-02**: Agent tracks progress against its plan each tick — knows what's done, what's next, what's blocked
- [ ] **WRK-03**: Agent reviews outcomes of completed subtasks and detects when results don't match expectations
- [ ] **WRK-04**: Agent iterates on failed or low-quality subtask outcomes — retries with adjusted approach rather than moving on blindly
- [ ] **WRK-05**: Agent evaluates its own proposed action before executing — catches obviously wrong actions (e.g., crafting without ingredients, navigating to invalid coords)

## v2 Requirements

### Multi-Agent

- **MA-01**: Agents can share plans and coordinate task allocation
- **MA-02**: Agents can communicate findings and delegate subtasks

### Advanced Memory

- **AME-01**: Semantic memory search — agent retrieves relevant lessons by context, not just recency
- **AME-02**: Memory consolidation — agent periodically synthesizes raw lessons into higher-level strategies

### Vision

- **VIS-01**: Agent can request and interpret screenshots for spatial reasoning

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-agent coordination protocol | Single-agent must be solid first |
| Vision/screenshot integration | LiteLLM config issue, not agent architecture |
| Discord/external integrations | Out of scope for this milestone |
| Rewriting Fabric mod framework | Working fine, just needs bug fixes |
| Real-time voice interaction | Different product direction entirely |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MEM-01 | Phase 1 | Complete |
| MEM-02 | Phase 1 | Complete |
| MEM-03 | Phase 1 | Complete |
| MEM-04 | Phase 2 | Pending |
| SKL-01 | Phase 1 | Pending |
| SKL-02 | Phase 2 | Pending |
| COM-01 | Phase 1 | Pending |
| COM-02 | Phase 1 | Pending |
| WRK-01 | Phase 2 | Pending |
| WRK-02 | Phase 2 | Pending |
| WRK-03 | Phase 3 | Pending |
| WRK-04 | Phase 3 | Pending |
| WRK-05 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 after initial definition*
