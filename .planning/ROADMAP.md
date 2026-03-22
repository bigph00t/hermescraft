# Roadmap: HermesCraft

## Milestones

- ✅ **v1.0 Paper Migration + Plugin-Enhanced Agents** - Phases 1-4 (shipped 2026-03-22)
- ✅ **v1.1 Tool Quality & Building Intelligence** - Phases 5-6 (shipped 2026-03-22)
- ✅ **v2.0 Mineflayer Rewrite** - Phases 1-6 (shipped 2026-03-22)
- 🚧 **v2.1 Creative Building + Bug Fixes** - Phases 7-10 (in progress)

## Phases

<details>
<summary>✅ v2.0 Mineflayer Rewrite (Phases 1-6) - SHIPPED 2026-03-22</summary>

**Phases completed:** 6 phases, 13 plans, 20 tasks

Key accomplishments: headless mineflayer bot, Mind+Body architecture, event-driven LLM loop,
cooperative interrupt system, 300ms survival tick, blueprint-based building, 9 registry commands,
memory/social/locations subsystems, 24 JS modules, 3389 lines of code.

</details>

### 🚧 v2.1 Creative Building + Bug Fixes (In Progress)

**Milestone Goal:** Agents understand natural language building instructions, design their own structures, specify materials, and remember/expand builds across sessions.

## Phase Details

### Phase 7: Live Testing + Bug Fixes
**Goal**: The v2.0 system runs stably on the live Paper server with all registry commands working
**Depends on**: Phase 6 (v2.0 complete)
**Requirements**: FIX-01, FIX-02
**Success Criteria** (what must be TRUE):
  1. Bot connects to the Paper 1.21.1 server, stays connected, and responds to player chat without crashing
  2. All 11 registry commands (!gather, !mine, !craft, !smelt, !navigate, !chat, !idle, !combat, !build, !deposit, !withdraw) execute against live server without throwing uncaught errors
  3. 300ms survival tick runs continuously alongside the Mind loop without interfering with command execution
**Plans:** 2/2 plans complete

Plans:
- [x] 07-01-PLAN.md — Fix package.json deps, normalizer ore alias bug, system prompt missing commands
- [x] 07-02-PLAN.md — Create smoke test validating all v2 modules, exports, and integration contracts

### Phase 8: Blueprint Intelligence
**Goal**: The LLM can generate valid blueprint JSON from natural language descriptions using a rich reference library
**Depends on**: Phase 7
**Requirements**: CBUILD-03, CBUILD-04
**Success Criteria** (what must be TRUE):
  1. System prompt includes 10+ reference blueprint examples covering diverse structure types (dock, house, tower, bridge, shelter)
  2. Given a structure description, the LLM outputs syntactically valid blueprint JSON with layers in bottom-to-top order (floor before walls before roof)
  3. Generated blueprints pass the existing build skill's validation without manual correction
**Plans:** 1/2 plans executed

Plans:
- [x] 08-01-PLAN.md — Create 8 new reference blueprints + blueprint validation module
- [ ] 08-02-PLAN.md — Wire !design command: prompt builder, registry, and LLM-to-build pipeline

### Phase 9: Directed Building
**Goal**: Players can instruct the bot in natural language to build specific structures or change materials, and the bot executes correctly
**Depends on**: Phase 8
**Requirements**: CBUILD-01, CBUILD-02, CBUILD-05
**Success Criteria** (what must be TRUE):
  1. Player says "build a dock here" and the bot generates a blueprint and begins placing blocks at the current location without further instruction
  2. Player says "use stone on this wall" and the active build plan updates to use the specified material before the next block is placed
  3. Bot scans a 3D bounding region using bot.blockAt() and returns an accurate inventory of block types and positions found
**Plans**: TBD

### Phase 10: Build Memory
**Goal**: Build history persists across sessions and the bot can return to a previous site and extend it autonomously
**Depends on**: Phase 9
**Requirements**: BMEM-01, BMEM-02
**Success Criteria** (what must be TRUE):
  1. After a session ends and a new one begins, the bot can describe what it built, where, and when — without the player re-specifying the build
  2. Bot navigates to a previous build site, scans the region, identifies existing blocks, and places only the missing ones to extend or repair the structure
**Plans**: TBD

## Progress

**Execution Order:** 7 → 8 → 9 → 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 7. Live Testing + Bug Fixes | v2.1 | 2/2 | Complete   | 2026-03-22 |
| 8. Blueprint Intelligence | v2.1 | 1/2 | In Progress|  |
| 9. Directed Building | v2.1 | 0/TBD | Not started | - |
| 10. Build Memory | v2.1 | 0/TBD | Not started | - |
