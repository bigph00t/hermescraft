---
phase: 24-four-agents-prompt-polish
plan: 01
subsystem: agents
tags: [soul-files, personality, config, multi-agent]

requires: []
provides:
  - "8 SOUL files at project root — ember, flint, sage, wren created fresh; luna, max, ivy, rust updated with 8-agent group awareness and !see hints"
  - "mind/config.js ALL_AGENTS expanded to 8 agents; partnerNames array added to loadAgentConfig() return"
affects:
  - "24-02 (prompt polish) — partnerNames in config used for YOUR GROUP section injection"
  - "24-03 (launch script) — all 8 agent names needed for launch-agents.sh AGENT_NAMES array"
  - "mind/prompt.js — buildSystemPrompt() can now receive options.partnerNames from config"

tech-stack:
  added: []
  patterns:
    - "ALL_AGENTS static list in config.js drives partner detection; partnerName is compat shim, partnerNames is full array"
    - "SOUL file format: backstory + group paragraph + How you talk + What drives you + Quirks (6-8 behavioral tics)"

key-files:
  created:
    - SOUL-ember.md
    - SOUL-flint.md
    - SOUL-sage.md
    - SOUL-wren.md
  modified:
    - SOUL-luna.md
    - SOUL-max.md
    - SOUL-ivy.md
    - SOUL-rust.md
    - mind/config.js

key-decisions:
  - "4 new personality archetypes: Ember (Chef/Alchemist), Flint (Tinkerer/Scholar), Sage (Archivist), Wren (Newcomer) — chosen to fill group dynamic gaps and create interesting tension"
  - "Vision hints integrated into Quirks section (not a separate Vision section) — natural fit per plan requirement"
  - "Group relationship paragraphs updated in existing 4 SOULs to acknowledge all 8 agents — preserves pair dynamics while adding wider awareness"
  - "partnerName kept as compat shim (first non-self agent) while partnerNames exposes full array"

patterns-established:
  - "SOUL files: 350-400+ words per personality, grounded backstory, distinct voice, 6-8 behavioral tics specific enough to cause different in-game actions"
  - "!see hints: 1-2 sentences per agent, integrated naturally (not a dedicated section)"

requirements-completed: []

duration: 4min
completed: "2026-03-24"
---

# Phase 24 Plan 01: Eight Agent SOUL Files + Config Summary

**4 new rich agent SOUL files (ember/flint/sage/wren) filling personality gap archetypes; all 8 SOULs updated with group awareness and vision hints; config.js expanded to 8-agent ALL_AGENTS with partnerNames array**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-24T00:59:27Z
- **Completed:** 2026-03-24T01:04:13Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Created 4 new SOUL files (ember, flint, sage, wren) at 526-536 words each — all exceed the 300-word minimum and match Luna's quality bar
- Updated 4 existing SOUL files (luna, max, ivy, rust) to expand group relationship paragraphs from pair awareness to full 8-agent group; added !see vision hints to each
- Updated mind/config.js: ALL_AGENTS now has all 8 agents, loadAgentConfig() returns partnerNames array (all agents minus self) with partnerName as backward-compatible shim

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 4 new SOUL files + add vision hints to all 8** - `69fb56b` (feat)
2. **Task 2: Update config.js for 8-agent support with partnerNames** - `2db91bc` (feat)

## Files Created/Modified

- `SOUL-ember.md` — Chef/Alchemist archetype: 27yo pastry chef turned herbalist, transforms ingredients, horrified by Rust's eating habits
- `SOUL-flint.md` — Tinkerer/Scholar archetype: 42yo ex-physics professor, explains mechanisms nobody asked about, builds redstone contraptions
- `SOUL-sage.md` — Archivist/Historian archetype: 38yo ex-museum curator, names everything formally, insists on signage, debriefs Rust after every expedition
- `SOUL-wren.md` — Newcomer/Wanderer archetype: 22yo design-degree dropout, eager and self-conscious, volunteers faster than they think things through
- `SOUL-luna.md` — Group paragraph expanded; !see vision hint added to Quirks
- `SOUL-max.md` — Group paragraph expanded; !see vision hint added to Quirks
- `SOUL-ivy.md` — Group paragraph expanded; !see vision hint added to Quirks
- `SOUL-rust.md` — Group paragraph expanded; !see vision hint added to Quirks
- `mind/config.js` — ALL_AGENTS expanded 2→8; partnerNames array added; return object updated

## Decisions Made

- **4 personality archetypes** chosen to complement existing Luna/Max/Ivy/Rust coverage: Ember (transformation/chemistry), Flint (mechanisms/automation), Sage (preservation/documentation), Wren (newcomer tension). Each creates distinct gameplay behaviors and inter-agent friction.
- **Vision hints integrated into Quirks section** — avoids creating a separate "Vision" heading that would feel bolted on; each hint reflects the personality's natural behavior pattern.
- **Group paragraphs updated** — kept existing pair dynamics intact (Luna+Max, Ivy+Rust) but added awareness of the wider group with specific callouts to personality-relevant relationships (e.g., Rust keeps an eye on Wren; Max notes Flint's redstone work is worth watching).
- **partnerName compat shim retained** — social module still references partnerName (singular); partnerNames array is additive for prompt.js use in plan 02.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 8 SOUL files ready for immediate use — any AGENT_NAME from the 8 will load correctly
- config.js partnerNames ready for mind/prompt.js YOUR GROUP section injection (plan 02)
- launch-agents.sh update (plan 03) can use AGENT_NAMES = (luna max ivy rust ember flint sage wren) directly from this list

---
*Phase: 24-four-agents-prompt-polish*
*Completed: 2026-03-24*
