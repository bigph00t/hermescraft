---
phase: 24-four-agents-prompt-polish
plan: 03
subsystem: infra
tags: [bash, tmux, mineflayer, launch-scripts, multi-agent]

# Dependency graph
requires:
  - phase: 24-01
    provides: "8 SOUL files + config.js with all 8 agent names"
  - phase: 24-02
    provides: "Prompt polish, per-partner chat counter, proximity filter"
provides:
  - "launch-agents.sh: data-driven N-agent tmux launcher for v2 Mineflayer architecture"
  - "infra/start-stack.sh: updated to call launch-agents.sh with 8 agents"
affects: [deployment, runpod-infrastructure, glass-startup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HEREDOC + bash string substitution for tmux command injection (placeholder pattern from launch-duo.sh)"
    - "Data-driven loop over AGENT_NAMES array for scalable multi-agent launch"

key-files:
  created: []
  modified:
    - "launch-agents.sh"
    - "infra/start-stack.sh"

key-decisions:
  - "launch-agents.sh is a full rewrite of the v1 Xvfb-based launcher — completely different architecture"
  - "tmux session renamed to hermescraft-agents (was hermescraft-duo in launch-duo.sh pattern)"
  - "launch-duo.sh preserved untouched — still useful for lightweight 2-agent dev sessions"
  - "Count argument hardcoded to 8 in start-stack.sh but operators can edit for smaller deployments"

patterns-established:
  - "Per-agent tmux windows named after agent for easy navigation"
  - "Exit code contract: 0=clean stop, 42=scheduled restart, else=crash+5s delay"

requirements-completed: ["Infrastructure — enabling phase"]

# Metrics
duration: 2min
completed: 2026-03-24
---

# Phase 24 Plan 03: N-Agent Launch Script Summary

**Data-driven tmux launcher for all 8 Mineflayer agents with 30s stagger, rewriting the v1 Xvfb-based launch-agents.sh for the v2 architecture**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-24T01:06:37Z
- **Completed:** 2026-03-24T01:08:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Rewrote launch-agents.sh from v1 Xvfb/HermesBridge architecture to v2 Mineflayer — 121 lines deleted, 105 new
- Data-driven AGENT_NAMES array covers all 8 agents: luna max ivy rust ember flint sage wren
- infra/start-stack.sh now calls launch-agents.sh with count=8, referencing hermescraft-agents tmux session
- launch-duo.sh preserved intact for 2-agent dev use

## Task Commits

Each task was committed atomically:

1. **Task 1: Create data-driven launch-agents.sh** - `c5b4cd0` (feat)
2. **Task 2: Update infra/start-stack.sh** - `dc92330` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `launch-agents.sh` - Full rewrite: v2 Mineflayer launcher for N agents in tmux with 30s stagger and auto-restart
- `infra/start-stack.sh` - Step 3 updated to call launch-agents.sh; session reference updated to hermescraft-agents

## Decisions Made
- Used HEREDOC + bash placeholder substitution (same pattern as launch-duo.sh) for safe tmux command injection — avoids quoting complexity in a data-driven loop
- Session named `hermescraft-agents` (not `hermescraft-bots` from v1, not `hermescraft-duo`) to reflect the new multi-agent v2 identity
- Hardcoded `8` in start-stack.sh as default production count — operators can edit for partial deployments without changing the launcher script itself

## Deviations from Plan

None - plan executed exactly as written.

One minor deviation resolved automatically: the initial draft included "no Xvfb needed" in the comment, which caused the verification grep for `Xvfb` to fail. Fixed by rephrasing the comment to not mention Xvfb at all. This is a trivial cosmetic fix, not a behavioral change.

## Issues Encountered

Verification check `grep -q 'Xvfb'` matched a comment explaining that Xvfb is NOT used ("no Java client, no Xvfb needed"). The intent of the check was to catch actual Xvfb usage, not explanatory comments. Resolved by removing the mention from the comment entirely — the script's architecture is self-evident from the code.

## User Setup Required

None - no external service configuration required. Scripts are ready to use on Glass or RunPod once the model server and MC server are running.

## Next Phase Readiness

Phase 24 is complete. All three plans shipped:
- 24-01: 8 SOUL files + config.js for all 8 agents
- 24-02: Prompt polish (TALK/YOU TWO removed, per-partner chat counter, proximity filter)
- 24-03: N-agent launch script + start-stack.sh update

Ready for deployment testing on Glass/RunPod.

## Self-Check: PASSED

- FOUND: launch-agents.sh
- FOUND: infra/start-stack.sh
- FOUND: 24-03-SUMMARY.md
- FOUND: c5b4cd0 (Task 1 commit)
- FOUND: dc92330 (Task 2 commit)

---
*Phase: 24-four-agents-prompt-polish*
*Completed: 2026-03-24*
