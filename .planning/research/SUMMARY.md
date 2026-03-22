# Project Research Summary

**Project:** HermesCraft v2.0 — Mineflayer Mind + Body Rewrite
**Domain:** LLM-driven Minecraft AI agent
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

HermesCraft v2.0 is a ground-up rewrite of a Minecraft AI agent, replacing the v1 Fabric mod + HTTP bridge architecture with a direct Mineflayer Node.js integration. The research is unambiguous: every serious LLM+Minecraft project (Mindcraft, Voyager, AIRI) uses Mineflayer directly — no HTTP bridge, no Java mod, no Xvfb display. This eliminates the root causes of all v1 failures: crosshair drift, race conditions, and 1GB RAM per agent collapse to zero. The recommended architecture is a Mind/Body split where the LLM layer (Mind) fires on events, not on a fixed timer, and the Body executes skills autonomously between LLM decisions. This is event-driven, not tick-locked.

The recommended approach is modeled directly on Mindcraft's production source code (verified, not inferred). The agent interface is a parameterized command palette (`!collectBlocks("oak_log", 4)`) — the LLM names intent, the Body executes. Autonomous reactive modes (`self_preservation`, `self_defense`, `unstuck`, `idle_staring`) run on a 300ms Body tick, independent of the LLM, and are what make the agent feel alive between decisions. The LLM fires only when: a player sends a chat message, the self-prompter detects the agent has been idle for 2+ seconds, or a goal completes and the next action needs to be decided. This naturally produces the 15-30s Mind decision cadence targeted in PROJECT.md without a fixed timer.

The critical risks are infrastructure-level, not feature-level. Five pitfalls must be designed in from the start: every navigation skill needs an external wall-clock timeout or it hangs permanently; every dig and place skill needs post-action block verification or it reports false success; item name normalization is a prerequisite for every skill; conversation history must be capped at 40 turns with summarization or context overflows after 60-90 minutes; and the v1 memory files must NOT be migrated directly — they contain v1 action vocabulary (`look_at_block`, `break_block(x,y,z)`) that will corrupt v2 agent behavior.

## Key Findings

### Recommended Stack

Mineflayer 4.35.0 (already installed, latest stable as of 2026-02-13) is the sole transport layer for all game interaction. The Fabric mod and HTTP bridge are entirely eliminated. The new required package is `mineflayer-pathfinder` 2.4.5, which replaces Baritone and provides Promise-based A* pathfinding with `GoalNear`, `GoalFollow`, and `GoalSurface` targets. Five survival plugins are recommended for production: `mineflayer-pvp` (combat), `mineflayer-collectblock` (resource gathering), `mineflayer-tool` (auto-equip best tool), `mineflayer-auto-eat` (autonomous hunger), and `mineflayer-armor-manager` (auto-equip armor). All are at known-compatible versions verified against Mindcraft's package.json. Per-bot RAM drops from 1GB+ (v1 with Fabric + Xvfb) to ~100MB, enabling comfortable scaling to 10 agents on existing 15GB Glass hardware.

**Core technologies:**
- `mineflayer` 4.35.0: headless bot transport — replaces entire Fabric mod + HTTP bridge stack
- `mineflayer-pathfinder` 2.4.5: A* pathfinding — replaces Baritone, promise-based, no crosshair drift
- `minecraft-data` 3.105.0: item/block/recipe database — already installed, carried from v1
- `openai` ^4.0.0: LLM client — pointed at MiniMax M2.7 (or any OpenAI-compatible endpoint)

**Critical version requirement:** Pin `version: '1.21.1'` explicitly in `createBot()`. Auto-detection is a documented source of protocol bugs. MC 1.21.1 support is confirmed in mineflayer 4.35.0 with the known Paper SlotComponent issue resolved in the bundled minecraft-data 3.105.0.

**Cleanup required:** Remove `sharp` (vision, v1 only) and `ws` (unused) from `package.json`.

### Expected Features

The feature set divides into a v2.0 launch set and a post-validation set. The critical insight from FEATURES.md is that the two-tier command interface from Mindcraft — parameterized `!commands` for 90% of tasks, `!newAction` code-gen escape hatch for complex tasks — is the correct design. Do not give the LLM raw Mineflayer API access; that is a documented failure mode.

**Must have (v2.0 launch — table stakes):**
- Bot connection, pathfinding, navigation commands — every other feature depends on these
- Block collection, crafting (with chain solver), smelting — core resource progression loop
- Combat + `self_defense` mode, `self_preservation` mode — survival without LLM decision per threat
- SOUL + memory system (MEMORY.md, notepad, context/) — carry over from v1 with fresh data directories
- `idle_staring` and `elbow_room` modes — zero-cost "feels alive" behaviors; highest observed human-feeling impact per Mindcraft modes.js analysis
- `unstuck` mode — critical for unsupervised operation; without it, agents get stuck for hours
- Natural grounded chat with response timing delays — agents must only reference what they have seen
- Multi-agent: 2 bots (Jeffrey, John) with separate data dirs, chat routing, self-message filtering

**Should have (v2.0.x — add after individual bots are stable):**
- Day/night routine (NPC controller: go home at dusk, sleep, resume at dawn)
- `torch_placing`, `hunting`, `item_collecting` ambient modes
- `!newAction` code generation escape hatch (Tier 2 interface) for complex tasks
- Villager trading (end-game economy)

**Defer (v2.1+):**
- Scale to 5-10 bots (needs shared task registry, likely SQLite)
- Blueprint-based building (needs reliable `placeBlock` first)
- Skill auto-update from phase completion (carry over SKILL.md pattern after Ender Dragon phases)

### Architecture Approach

The architecture is a strict Mind/Body separation. The Mind layer (Prompter, SelfPrompter, History) owns all LLM calls and conversation history. The Body layer (ActionManager, Skills, ModeController, Commands) owns all Mineflayer calls. The boundary is enforced: no file in `mind/` imports from `body/skills/`, no file in `body/` calls the LLM. The command registry is the LLM-visible interface — command names appear in the system prompt while skill functions are internal implementations. Refactoring a skill never changes the LLM's interface.

Every skill function is `async` with `try/catch`, returns `{ success, message, error? }`, never throws, and checks `if (bot.interrupt_code) return false` after every `await`. This cooperative interrupt pattern lets modes and chat preempt long-running skills without forced termination that leaves the bot in a bad state.

**Major components:**
1. `mind/prompter.js` — LLM client, conversation history, self-prompter loop (event-driven, 2s idle timer)
2. `body/action-manager.js` — serialized execution, interrupt flag, 10-min timeout watchdog
3. `body/modes.js` — ModeController, 300ms reactive behaviors, completely independent of LLM
4. `body/commands/` — LLM-visible command registry (`!collectBlocks`, `!craft`, `!goTo`, etc.)
5. `body/skills/` — internal async primitives split by domain (navigate, gather, build, craft, world)
6. `memory/` — MEMORY.md, notepad, session JSONL, locations (file-backed, no database needed at 2-10 agent scale)
7. `social/conversation.js` — chat routing, multi-agent message tagging, self-prompter pause/resume

**Build order is strict** (from ARCHITECTURE.md): Phase 1 (bot foundation + core skills + interrupt harness) → Phase 2 (Mind loop + LLM integration) → Phase 3 (survival modes) → Phase 4 (full skill set + memory) → Phase 5 (personality + multi-agent). Each phase requires the prior phase working before it begins.

### Critical Pitfalls

1. **Pathfinder indefinite hang** — `bot.pathfinder.goto()` never resolves on unreachable goals (documented issue #222). Every navigation skill must wrap `goto()` in a 30s wall-clock timeout and return failure if triggered. Must be addressed in Phase 1 before any skill builds on navigation.

2. **Silent false success from `bot.dig()` and `bot.placeBlock()`** — both resolve without confirming the server actually processed the action. Protected blocks, spawn protection, and server-load-related timeouts cause the skill to report success while the game state is unchanged. Every dig and place skill must verify the block state changed with `bot.blockAt()` afterward.

3. **Item name hallucination** — LLMs output display names ("Oak Log"), pluralized forms ("sticks"), and colloquial names ("cobble") even when prompted with registry names. Without a normalization layer, `bot.registry.itemsByName[name]` returns `undefined` and skills throw. The v1 normalizer must be ported before any skill is written.

4. **Context window overflow after 60-90 minutes** — full state snapshots per turn fill the 128K context window in ~90 minutes. The v1 agent hit this at 90 messages × 4KB = 360KB. Cap at 40 turns with progressive summarization (oldest 10 turns → 500-char summary). Use delta state format in conversation history.

5. **v1 memory file contamination** — v1 MEMORY.md files contain action vocabulary (`look_at_block`, `break_block(x,y,z)`, HTTP bridge references) that does not exist in v2. Loading them causes the agent to call non-existent skills. Create fresh `agent/data/jeffrey/` and `agent/data/john/` directories for v2; archive v1 data as `jeffrey_v1/`.

## Implications for Roadmap

Based on combined research, the architectural build order from ARCHITECTURE.md provides the definitive phase structure. Each phase has hard dependencies on the prior one — no parallelization is possible until Phase 5.

### Phase 0: Migration Setup
**Rationale:** Must happen before a single line of v2 code runs an agent. PITFALLS.md identifies v1 memory file contamination as a Phase 0 issue — the data directory structure and server config must be established first or the first agent run will poison fresh memory files.
**Delivers:** Clean v2 data directories (`data/jeffrey/`, `data/john/`), v1 data archived, `package.json` cleanup (`sharp`, `ws` removed), Paper server configured (`allow-flight: true`, `spawn-protection=0` for dev), VeinMiner switched to command activation mode.
**Addresses:** Pitfall 15 (v1 memory contamination), Pitfall 9 (VeinMiner plugin config), Pitfall 14 (anti-cheat server settings)
**Research flag:** Standard setup — no deep research needed

### Phase 1: Bot Foundation + Core Skills
**Rationale:** All other phases depend on a bot that can connect, navigate, mine, and place blocks reliably. The interrupt harness, post-action verification, and item normalization must be correct here — they cannot be retrofitted later without breaking all higher-level skills. The "bot connects and spawns on Paper 1.21.1" smoke test is the critical early gate for this entire project.
**Delivers:** Headless bot on Paper 1.21.1. ActionManager with interrupt + timeout. Navigation, gather, place, chest skills. Item name normalization. Post-dig and post-place block verification. Respawn handler with 100-200ms delay.
**Addresses:** Pitfall 1 (pathfinder hang), Pitfall 2 (silent dig failure), Pitfall 3 (placeBlock timeout), Pitfall 5 (window lifecycle for chests), Pitfall 8 (respawn kick), Pitfall 11 (async error handling), Pitfall 12 (item normalization), Pitfall 13 (keepalive async I/O)
**Avoids:** Anti-pattern of building skills without the cooperative interrupt pattern
**Research flag:** Well-documented patterns from Mindcraft source. Smoke test is the gate — validate pathfinder on Paper 1.21.1 before full skill development.

### Phase 2: Mind Loop + LLM Integration
**Rationale:** Skills are inert without an LLM driving them. The Mind loop design (event-driven, 2s idle timer, 40-turn history cap, delta state format) must be built correctly from the start — retrofitting history compression after sessions accumulate is expensive and risks session instability.
**Delivers:** End-to-end pipeline: LLM reads world state, outputs `!command`, Body executes, result feeds back to history. SelfPrompter goal loop with 2s idle timer and 3-miss stop condition. History compression (progressive summarization, 40-turn cap). Command registry with system prompt injection.
**Addresses:** Pitfall 6 (context overflow), Pitfall 4 (crafting tag resolution — verify crafter.js uses minecraft-data directly, not `bot.recipesFor()`)
**Research flag:** Standard patterns from Mindcraft source. One gap: MiniMax M2.7 `!command` syntax compliance needs a smoke test — the model was not tested in v1 and may need prompt adjustments vs Hermes 4.3.

### Phase 3: Survival Modes
**Rationale:** Without autonomous modes, the agent cannot survive without the LLM watching for every threat. Modes must be in before multi-agent testing because unsupervised bots die. The ModeController design (300ms tick, independent of LLM, cooperative interrupt) is also the gating dependency for the "feels alive" behavior that makes testing legible.
**Delivers:** ModeController with `self_preservation`, `self_defense`, `unstuck`, `item_collecting`, `idle_staring`, `elbow_room`. Agents survive and feel alive between LLM decisions.
**Addresses:** The "LLM too slow for survival decisions" problem. `idle_staring` and `elbow_room` are the highest-impact human-feeling behaviors (verified from Mindcraft modes.js).
**Research flag:** Standard patterns from Mindcraft modes.js — direct copy of priority ordering and condition thresholds. No additional research needed.

### Phase 4: Full Skill Set + Memory
**Rationale:** Building and crafting are second-tier skills that depend on navigation and collection working correctly (Phase 1). Adding the full skill set here after the Mind loop is working (Phase 2) means each new skill can be validated end-to-end against the real LLM immediately. Memory files (MEMORY.md, notepad, context/) are carried from v1 structure but populated fresh.
**Delivers:** `placeBlock`, `clearArea`, `craftRecipe` (with chain solver BFS), `smelt`, `attack`, `flee`. MEMORY.md, notepad read/write, context/ pinned files. Saved locations. Stats tracking.
**Addresses:** Full Ender Dragon progression capability. Crafting chain solver validated against Pitfall 4 (spruce_planks → crafting_table test case).
**Research flag:** `placeBlock` has known complexity (Pitfall 3 — blockUpdate timeout on loaded Paper server). Phase 1 adds the wrapper; Phase 4 stress-tests it with real builds. The v1 crafter.js BFS solver needs auditing for `bot.recipesFor()` usage — if present, it must be replaced with direct minecraft-data lookup.

### Phase 5: Personality + Multi-Agent
**Rationale:** Multi-agent coordination requires single-agent stability first. All v2.0 crash modes must be eliminated before adding a second bot. Chat routing, self-message filtering, and the conversation pause/resume flow are the final pieces. SOUL files for Jeffrey and John can be ported from v1 (they contain personality content, not action vocabulary).
**Delivers:** SOUL file loading per agent. ConversationManager with self-message filtering. Per-agent data directories. Two agents on server simultaneously. Jeffrey and John coordinate on a task via chat.
**Addresses:** Pitfall 10 (chat flood from self-messages). Multi-agent routing per Mindcraft conversation.js pattern (200ms response delay when idle, 5s delay when busy, `(FROM OTHER BOT)` message tagging).
**Research flag:** Well-documented in Mindcraft conversation.js. No additional research needed.

### Phase Ordering Rationale

- Phases 1-5 are a strict dependency chain, not preferences. This order comes directly from ARCHITECTURE.md's "Build Order" section, derived from Mindcraft's documented production evolution.
- Phase 0 is not optional even though it has no code — the v1 data contamination risk from skipping it is rated MEDIUM recovery cost in PITFALLS.md.
- Multi-agent is correctly placed last (Phase 5). FEATURES.md explicitly notes "single-agent working first" as a dependency. All prior phases must be green.
- "Feels human" features (`idle_staring`, `elbow_room`) are placed in Phase 3, not in a separate polish phase, because they contribute directly to observability during testing of the survival loop.
- Day/night routine and ambient modes (`torch_placing`, `hunting`) are deferred to v2.0.x — they require stable bots but are not part of the core rewrite milestone.

### Research Flags

Phases with well-documented patterns (skip `research-phase`):
- **Phase 0:** Standard file ops and server config. No research needed.
- **Phase 1:** Mindcraft source covers all patterns with HIGH confidence. Focus on the smoke test gate.
- **Phase 3:** Mindcraft modes.js is directly applicable. Priority ordering and condition thresholds are ready to copy.
- **Phase 5:** Mindcraft conversation.js is the blueprint for routing and timing.

Phases that need targeted research or validation during execution:
- **Phase 1 (Pathfinder smoke test):** Live behavior of `mineflayer-pathfinder` 2.4.5 on Paper 1.21.1 must be validated before full skill development. Issue #222 (indefinite hang) may behave differently on current Paper builds.
- **Phase 2 (MiniMax M2.7 command format):** The `!command` syntax parsing has not been tested against MiniMax M2.7 specifically. Hermes 4.3 was the v1 model. MiniMax may need prompt tuning to reliably output `!commandName(args)` format vs free text or tool calls.
- **Phase 4 (Crafting chain solver audit):** The v1 crafter.js BFS solver needs to be checked for `bot.recipesFor()` usage (Pitfall 4, wood tag issue). If it calls `bot.recipesFor()` internally, it needs a rewrite before Phase 4 begins.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified via npm registry and node_modules. Mindcraft package.json used as reference implementation. MC 1.21.1 support confirmed with specific issue resolution context (SlotComponent fix in minecraft-data 3.105.0). |
| Features | HIGH | Derived from direct source reads of Mindcraft skills.js, modes.js, agent.js, self_prompter.js, action_manager.js, conversation.js. Function names and patterns from real code, not inferred. |
| Architecture | HIGH | Mindcraft source read directly from GitHub. AIRI DeepWiki cross-checked independently. Build order confirmed by testing in Mindcraft's documented production evolution. |
| Pitfalls | HIGH | 15 pitfalls documented with GitHub issue numbers, reproduction conditions, and specific recovery steps. Most reference mineflayer's issue tracker directly. |

**Overall confidence:** HIGH

### Gaps to Address

- **MiniMax M2.7 command format compliance:** FEATURES.md and ARCHITECTURE.md are based on Mindcraft using GPT-4/Claude. MiniMax M2.7 instruction-following for `!command` syntax needs validation in Phase 2 smoke test. If the model reliably outputs tool calls instead of text commands, the command parser must handle both formats.
- **Paper 1.21.1 + mineflayer-pathfinder 2.4.5 live behavior:** Issues #3488 and #3492 reference older mineflayer versions and are likely resolved, but a live connection smoke test is the only way to confirm. Build this into Phase 1 exit criteria explicitly.
- **v1 crafter.js compatibility:** The carry-over crafting chain solver from v1 needs auditing against `bot.recipesFor()` usage (Pitfall 4). Assess during Phase 4 planning.
- **Glass server anti-cheat plugin stack:** PITFALLS.md calls out rapid bot actions as an anti-cheat trigger. The actual Paper plugin stack running on Glass (GriefPrevention, VeinMiner, others) has not been fully audited for bot compatibility. Validate during Phase 1 integration testing.

## Sources

### Primary (HIGH confidence)
- `node_modules/mineflayer/package.json` — version 4.35.0 confirmed installed
- [Mindcraft source: skills.js, modes.js, agent.js, self_prompter.js, action_manager.js, conversation.js, history.js, coder.js, npc/controller.js](https://github.com/kolbytn/mindcraft) — architecture and feature patterns read directly
- [mineflayer GitHub README](https://github.com/PrismarineJS/mineflayer) — auth, version support, offline mode
- [mineflayer-pathfinder repo](https://github.com/PrismarineJS/mineflayer-pathfinder) — GoalNear, goto() Promise API, issue #222
- `npm view` for all recommended packages — versions confirmed 2026-03-22
- [mineflayer discussion #2251](https://github.com/PrismarineJS/mineflayer/discussions/2251) — 100MB per bot RAM figure, maintainer-confirmed
- mineflayer issues #3494, #3488, #3492, #3549, #3360, #3769, #222, #671, #2076, #2673 — specific pitfall root causes

### Secondary (MEDIUM confidence)
- [AIRI Minecraft agent DeepWiki](https://deepwiki.com/moeru-ai/airi) — independent implementation confirms same interrupt and action queue patterns
- [Mindcraft-CE README](https://mindcraft-ce.com/) — enhanced unstuck, multi-tier hierarchy, augments system
- [Voyager breakdown](https://www.hanakano.com/posts/voyager-breakdown/) — curriculum, skill library, 73% performance drop without self-verification

### Tertiary (LOW confidence — needs live validation)
- MiniMax M2.7 `!command` syntax compliance — inferred from instruction-following capability; needs smoke test in Phase 2
- Paper 1.21.1 + mineflayer 4.35.0 connection stability — known older issues likely resolved; needs live confirmation in Phase 1

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
