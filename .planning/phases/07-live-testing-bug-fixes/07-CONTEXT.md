# Phase 7: Live Testing + Bug Fixes - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

The v2.0 system runs stably on the live Paper server with all registry commands working. Fix any bugs found during live testing.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure bug fix phase. Test the v2.0 code on a live server, identify and fix issues.

Key constraints:
- Paper 1.21.1 server on Glass
- MiniMax M2.7 via VLLM_URL for LLM
- 2 agents: Jeffrey and John (AGENT_NAME=jeffrey, AGENT_NAME=john)
- `npm run start:v2` is the entry point
- All 11 registry commands must work: gather, mine, craft, smelt, navigate, chat, idle, combat, build, deposit, withdraw
- 300ms body tick must not interfere with Mind loop
- v2.0 milestone audit found 3 wiring gaps (already fixed in commit 4dd6db7): chest init, equipBestArmor, savePlayers

</decisions>

<code_context>
## Existing Code Insights

### Key Files
- `start.js` — v2 entry point
- `mind/` — LLM client, prompt, registry, config, memory, social, locations
- `body/` — Skills, primitives, modes, blueprints
- `package.json` — `start:v2` script

### Known Issues from v2.0 Audit
- Phase 6 VERIFICATION.md was stale (fixed)
- 3 wiring gaps fixed: initChestMemory, equipBestArmor, savePlayers
- Human verification items deferred from phases 1,3,4,5 (live server testing)

### Integration Points
- Paper 1.21.1 server (localhost:25565)
- vLLM/MiniMax M2.7 endpoint (VLLM_URL)
- Per-agent data dirs (data/jeffrey/, data/john/)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — test and fix phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
