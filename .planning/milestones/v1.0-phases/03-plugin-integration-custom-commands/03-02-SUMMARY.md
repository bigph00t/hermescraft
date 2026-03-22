---
phase: 03-plugin-integration-custom-commands
plan: 02
subsystem: agent
tags: [tools, actions, minecraft, plugins, essentialsx, auraskills, quickshop, skript, cooldown]

# Dependency graph
requires:
  - phase: 03-plugin-integration-custom-commands
    provides: Skript /scan and /share-location commands installed on Paper server (Plan 01)
provides:
  - 8 new tool definitions in GAME_TOOLS array (agent/tools.js)
  - 8 new action handlers mapping tool calls to slash commands (agent/actions.js)
  - _abilityCooldowns Map with isAbilityOnCooldown() export for D-14 cooldown tracking
  - scan_blocks and check_skills in INFO_ACTIONS for LLM result visibility
affects:
  - 03-03-PLAN prompt updates — needs tool names and descriptions for GAMEPLAY_INSTRUCTIONS
  - agent/prompt.js — next plan will reference these tool capabilities in planner prompt

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Plugin tool handler: each tool call maps to a slash command via sendSingleAction({ type:'chat', message:'/command args' })
    - INFO_ACTIONS gate: scan_blocks and check_skills are INFO_ACTIONS so LLM sees results before next action
    - Cooldown Map pattern: _abilityCooldowns Map with ABILITY_COOLDOWN_MS constant, isAbilityOnCooldown() exported for external checks
    - Schema validators support argument aliasing: scan_blocks accepts block_type OR blockType

key-files:
  created: []
  modified:
    - agent/tools.js
    - agent/actions.js

key-decisions:
  - "scan_blocks and check_skills are INFO_ACTIONS — their results arrive in chat and LLM must see them before deciding next action"
  - "use_ability returns guidance message (not slash command) — AuraSkills abilities activate via tool right-click + block break, not /command"
  - "share_location replaces spaces with hyphens — Skript treats spaces as argument separators"
  - "create_shop documents 3-step prerequisite and StopSpam concern inline as comment"
  - "Ability cooldown is 60s conservative default — AuraSkills actual varies by level but 60s covers all"
  - "scan_blocks clamps radius 1-100 server-side to prevent lag per D-04"

patterns-established:
  - "Plugin handler block: `if (type === 'action_name') { ... return sendSingleAction({ type: 'chat', message: '/cmd args' }) }`"
  - "Cooldown check before action: `const remaining = isAbilityOnCooldown(ability); if (remaining) return { success: false, error: '...Ns remaining' }`"

requirements-completed: [INT-03, INT-04, INT-05, INT-06]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 03 Plan 02: Plugin Tools and Action Handlers Summary

**8 plugin-backed tools added to GAME_TOOLS with corresponding action handlers in actions.js — scan_blocks, go_home/set_home, share_location, check_skills, use_ability (60s cooldown via _abilityCooldowns Map), query_shops, create_shop**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-21T22:58:45Z
- **Completed:** 2026-03-21T23:00:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- 8 new tool definitions with natural-language descriptions (D-28), correct parameter schemas, enum constraint on use_ability, and 3-step prerequisite warning in create_shop description
- 8 action handlers translating tool calls to plugin slash commands: /scan, /home, /sethome, /share-location, /myskills, cooldown-gated ability activation, /qs find, /qs create
- Ability cooldown system (D-14): _abilityCooldowns Map + ABILITY_COOLDOWN_MS=60000 + isAbilityOnCooldown() exported, use_ability returns remaining seconds on cooldown
- scan_blocks and check_skills added to INFO_ACTIONS so LLM sees command results before deciding next action

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 8 plugin tool definitions to tools.js** - `cc91b7c` (feat)
2. **Task 2: Add 8 action handlers with cooldown tracking and schema validators to actions.js** - `98e17a1` (feat)

## Files Created/Modified

- `agent/tools.js` — Added 8 new entries to GAME_TOOLS array; total tools now 37
- `agent/actions.js` — Added 8 names to VALID_ACTIONS, scan_blocks+check_skills to INFO_ACTIONS, 8 ACTION_SCHEMAS validators, _abilityCooldowns Map + isAbilityOnCooldown(), 8 plugin command handler blocks

## Decisions Made

- scan_blocks and check_skills are INFO_ACTIONS (results arrive via chat, LLM must see before acting)
- use_ability does NOT send a slash command — AuraSkills abilities activate via right-click + break, returns guidance message instead
- share_location replaces whitespace with hyphens (Skript argument separator limitation)
- Ability cooldown is 60s conservative default; actual AuraSkills cooldowns vary by level but 60s is safe
- scan_blocks validates block_type or blockType alias for compatibility
- create_shop documents 3-step prerequisite sequence (place chest → equip item → interact_block) and StopSpam concern as inline code comment

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — node -e inline verification command failed due to shell escaping of `!` in the negation operator; switched to `--input-type=module` heredoc pattern which worked cleanly.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 8 plugin tools and handlers are ready; Plan 03 can update GAMEPLAY_INSTRUCTIONS and planner prompt to reference these tools by name
- isAbilityOnCooldown() is exported and available for prompt.js to conditionally show/hide use_ability based on cooldown state
- Tool names are stable — Plan 03 prompt updates can reference scan_blocks, go_home, use_ability etc. directly

---
*Phase: 03-plugin-integration-custom-commands*
*Completed: 2026-03-21*
