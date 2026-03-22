---
phase: 08-blueprint-intelligence
plan: "02"
subsystem: mind
tags: [blueprint-design, llm, design-prompt, registry, !design, validation]

dependency_graph:
  requires:
    - phase: 08-01
      provides: validateBlueprint() from body/blueprints/validate.js, 12 reference blueprint JSONs
  provides:
    - buildDesignPrompt() in mind/prompt.js — dedicated blueprint-generation system prompt with schema, rules, references
    - designAndBuild() in mind/index.js — full !design pipeline (LLM call -> extract -> validate -> write -> build)
    - !design command registered in registry.js and handled in think() before dispatch
    - !design listed in system prompt command reference and examples
  affects: [mind/index.js, mind/prompt.js, mind/registry.js, body/blueprints/_generated.json]

tech-stack:
  added: []
  patterns:
    - "Dedicated LLM call pattern: design prompt replaces game prompt for a single blueprint-generation exchange"
    - "Two-try JSON extraction: direct parse first, regex \\{[\\s\\S]*\\} fallback second"
    - "Pre-dispatch command handling: !design handled in think() before dispatch() (same pattern as !sethome)"
    - "Registry stub pattern: !design in REGISTRY returns fallback error; real logic is in think()"

key-files:
  created: []
  modified:
    - mind/prompt.js
    - mind/registry.js
    - mind/index.js
    - tests/smoke.test.js

key-decisions:
  - "designAndBuild() lives in mind/index.js (the wiring layer), not registry.js — it needs to orchestrate a separate LLM call, which belongs in Mind"
  - "!design handled in think() before dispatch, matching the !sethome pattern — registry entry is a help-text stub only"
  - "Generated blueprint written to body/blueprints/_generated.json so existing build() can load it by name without API changes"
  - "Two-stage JSON extraction: strip think tags first, then try direct parse, then regex outermost {…} — handles markdown-fenced or padded output"
  - "buildDesignPrompt() is pure formatting — no file I/O; caller (designAndBuild) passes reference blueprints"

requirements-completed: [CBUILD-03, CBUILD-04]

duration: 3min
completed: "2026-03-22"
---

# Phase 08 Plan 02: Blueprint Intelligence — !design Pipeline Summary

**buildDesignPrompt() injects 3 random reference blueprints and JSON schema rules into a dedicated LLM call; designAndBuild() validates the output and auto-executes build() at bot position; !design wired end-to-end in think() before dispatch.**

## Performance

- **Duration:** 3min
- **Started:** 2026-03-22T20:48:31Z
- **Completed:** 2026-03-22T20:51:41Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `buildDesignPrompt(description, referenceBlueprints)` exported from mind/prompt.js — creates a self-contained blueprint-generation prompt with JSON schema, 8 rules, and few-shot reference examples
- `!design description:"text"` added to system prompt command reference (Part 6) and examples (Part 7)
- `designAndBuild(bot, description)` exported from mind/index.js — orchestrates the full pipeline: random reference selection -> design LLM call -> JSON extraction (2-stage) -> validateBlueprint() -> write _generated.json -> build() at bot position
- `!design` registered in registry REGISTRY map (stub for listCommands/help) and handled in think() before dispatch with skillRunning guard and world knowledge recording

## Task Commits

1. **Task 1: Add design prompt builder and reference injection to prompt.js** - `52c6fee` (feat)
2. **Task 2: Wire !design command through registry and index** - `1e28bf6` (feat)

## Files Created/Modified

- `mind/prompt.js` — Added `buildDesignPrompt()` export; updated Parts 6 and 7 of `buildSystemPrompt()` to include `!design`
- `mind/registry.js` — Added `design` entry to REGISTRY map as fallback stub
- `mind/index.js` — Added imports (fs, path, url, validateBlueprint, build, buildDesignPrompt, BLUEPRINTS_DIR); added `designAndBuild()` export; added `!design` handler block in `think()` before dispatch
- `tests/smoke.test.js` — Updated registry count assertion (11 → 12), added `design` to expectedCmds, added `!design` to system prompt assertions

## Decisions Made

- **Dedicated LLM call:** The design prompt fully replaces the system prompt for one exchange. Conversation history accumulates this, which is acceptable — it provides context about what was designed.
- **Two-stage JSON extraction:** First try direct `JSON.parse()` on stripped text; second try regex `{[\s\S]*}` to handle any residual markdown fencing or surrounding text. If both fail, return `{ success: false, reason: 'LLM did not produce valid JSON' }`.
- **Written to _generated.json:** Avoids any changes to `build()` API. The file is overwritten on every design call.
- **Pure formatting in prompt.js:** `buildDesignPrompt()` takes pre-loaded references as `{ name, json }` objects — no file I/O in prompt.js, respecting Mind/Body boundary.
- **Registry stub:** The `design` REGISTRY entry exists only so `listCommands()` includes it for help/system prompt coverage. The actual logic is in `think()` before `dispatch()` is ever called.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated smoke test command count and !design assertions**
- **Found during:** Task 2 (verify npm test passes)
- **Issue:** Smoke test expected exactly 11 commands (`registry has 11 commands`); adding `!design` made it 12. The test also lacked a `!design` assertion in system prompt checks.
- **Fix:** Updated count assertion to 12, added `design` to `expectedCmds`, added `design` to `promptCmds`
- **Files modified:** tests/smoke.test.js
- **Verification:** `npm test` → 194 passed, 0 failed
- **Committed in:** 1e28bf6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — stale count assertion)
**Impact on plan:** Necessary correctness fix; no scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- !design pipeline is fully wired: agent can now generate blueprints from chat messages like "!design description:\"a small lookout tower\""
- Generated blueprints land in body/blueprints/_generated.json and are auto-built at bot position
- Validation failures return descriptive errors (visible in console and returned to think() for skill_complete trigger)
- Phase 08 complete — both plans shipped

---
*Phase: 08-blueprint-intelligence*
*Completed: 2026-03-22*
