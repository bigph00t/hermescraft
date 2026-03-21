---
phase: 05-skill-learning
plan: 02
subsystem: agent-cognition
tags: [reflection, skills, llm, autobiography, planner]

requires:
  - phase: 05-01
    provides: "Death avoidance learning, danger zone tracking"
  - phase: 03-deep-memory
    provides: "Autobiography event log, memory system"
provides:
  - "createSkillFromExperience — experience-based skill creation from reflection"
  - "downgradeSkillByName — failure-attributed skill degradation"
  - "reflectionTick — 5-minute LLM reflection cycle in planner loop"
  - "Reflection autobiography events (type: reflection)"
affects: [skill-learning, cooperation, planner]

tech-stack:
  added: []
  patterns: ["reflection-cycle (periodic LLM self-review)", "experience-skill-cap (max 15 exp- skills with lowest-rate eviction)"]

key-files:
  created: []
  modified:
    - agent/skills.js
    - agent/planner.js

key-decisions:
  - "Experience skills prefixed 'exp-' to distinguish from phase-based skills"
  - "Cap at 15 experience skills with lowest-success-rate eviction to prevent unbounded growth"
  - "Downgrade rate 0.15 (more aggressive than recordSkillOutcome's 0.1) for direct failure attribution"
  - "Reflection uses temperature 0.3 for factual/grounded output vs planner's 0.5"
  - "SKILL parsing uses strict pipe-delimited regex to avoid false positives"

patterns-established:
  - "Reflection cycle: periodic deeper LLM review layered on top of main planner tick"
  - "Experience skill lifecycle: create from reflection, update on duplicate, downgrade on failure, evict on cap"

requirements-completed: [SKILL-01, SKILL-02]

duration: 2min
completed: 2026-03-21
---

# Phase 5 Plan 02: Experience-Based Skill Creation + Reflection Cycle Summary

**Automatic skill learning from 5-minute LLM reflection cycle with experience-based SKILL.md creation and failure-attributed degradation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T06:53:56Z
- **Completed:** 2026-03-21T06:56:57Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended skills.js with createSkillFromExperience (creates SKILL.md from reflection-identified accomplishments, prefixed "exp-", capped at 15 with lowest-success-rate eviction)
- Extended skills.js with downgradeSkillByName (decrements success_rate by 0.15 for failure attribution from reflection)
- Added reflectionTick to planner.js that runs every 5 planner ticks (~5 minutes), asking LLM to review recent events, extract lessons, identify new skills, and flag failures
- Reflection events recorded to autobiography.jsonl as type "reflection" for persistent memory

## Task Commits

Each task was committed atomically:

1. **Task 1: Add createSkillFromExperience to skills.js** - `f397522` (feat)
2. **Task 2: Add 5-minute reflection cycle to planner.js** - `947f384` (feat)

## Files Created/Modified
- `agent/skills.js` - Added createSkillFromExperience (experience-based skill creation with exp- prefix, 15 cap, eviction), downgradeSkillByName (0.15 rate decrement), rmSync import
- `agent/planner.js` - Added reflectionTick function, _tickCount and REFLECTION_INTERVAL constants, imports for recordEvent/createSkillFromExperience/downgradeSkillByName/getSkillIndex/getMemory, integration into plannerTick and startPlannerLoop

## Decisions Made
- Experience skills prefixed "exp-" to clearly distinguish from phase-based "minecraft-" skills in the file system
- Capped at 15 experience skills with lowest-success-rate eviction to prevent unbounded disk growth
- Downgrade rate of 0.15 is more aggressive than recordSkillOutcome's 0.1 because reflection-identified failures are direct attribution vs. general phase outcome
- Reflection uses temperature 0.3 (vs planner's 0.5) for more factual, grounded self-review
- SKILL line parsing uses strict pipe-delimited regex (`SKILL: name | description | strategy`) to avoid false positive skill creation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 5 (Automatic Skill Learning) is now complete with all 3 requirements fulfilled
- Agents now learn from death avoidance (05-01), periodic reflection, and experience-based skill creation (05-02)
- Ready for Phase 6 (Cooperation & Exploration) which builds on memory and behavior systems

## Self-Check: PASSED

- agent/skills.js: FOUND
- agent/planner.js: FOUND
- .planning/phases/05-skill-learning/05-02-SUMMARY.md: FOUND
- Commit f397522: FOUND
- Commit 947f384: FOUND

---
*Phase: 05-skill-learning*
*Completed: 2026-03-21*
