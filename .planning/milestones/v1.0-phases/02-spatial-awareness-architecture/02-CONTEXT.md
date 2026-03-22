# Phase 2: Spatial Awareness + Architecture Rework - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents see the world and interact with visible blocks. No more underground Baritone disasters. Brain-hands-eyes architecture fully operational. Agents use look_at_block + break_block on visible surface blocks as their PRIMARY interaction, with Baritone as fallback for navigation only.

</domain>

<decisions>
## Implementation Decisions

### Baritone Control
- **D-01:** Switch from `baritone-standalone-fabric` to `baritone-api-fabric` jar for real Java API access (isPathing(), programmatic settings, getMineProcess())
- **D-02:** Set `minYLevelWhileMining` to 55 for surface resources (logs, crops, sugar cane) via Baritone API settings
- **D-03:** Enable `legitMine` mode — Baritone only mines blocks the player can actually see (no x-ray underground pathfinding)
- **D-04:** Baritone used ONLY for navigation (#goto) and as mining FALLBACK. Primary block interaction is look_at_block + break_block on visible blocks
- **D-05:** Rewrite BaritoneIntegration.java to use BaritoneAPI directly instead of chat commands. Real isPathing() replaces the broken chat-based workaround

### Surface Block Detection
- **D-06:** Add `surfaceBlocks` array to mod state output — blocks filtered by `world.isSkyVisible(pos.up())` AND within 10 Y-levels of player
- **D-07:** Surface scan radius: 24 blocks horizontal, -5 to +10 vertical from player position
- **D-08:** surfaceBlocks includes tree logs, crops, sugar cane, pumpkin, melon — resources that should be gathered from the surface
- **D-09:** Agent checks surfaceBlocks FIRST. If surface logs exist, uses look_at_block(coords) + break_block instead of blind #mine

### Brain-Hands-Eyes Architecture
- **D-10:** Planner (30s interval) writes concrete action queue to action-queue.json — ordered list of {type, args, reason}
- **D-11:** Action loop (2s interval) pops from queue and executes WITHOUT calling LLM. Only calls LLM when: queue empty, emergency (health<6), or chat received
- **D-12:** Baritone tracker module: knows when mine/navigate is active (timestamp + movement detection). While Baritone active, action loop SKIPS the tick entirely — just waits
- **D-13:** When Baritone active AND player chats: call LLM with chat-only tools (chat, notepad, read_chat). Don't interrupt Baritone for chat responses
- **D-14:** Pipeline system REMOVED entirely — no pre-thinking next action while current runs. Queue provides continuity instead
- **D-15:** No artificial token limits on any LLM call. Let MiniMax generate naturally

### Chat System
- **D-16:** Planner sends chat via Say: lines extracted from strategy output. Action loop does NOT send chat
- **D-17:** Chat dedup in planner: track last 5 messages, skip if >50% word overlap with recent
- **D-18:** Chat messages auto-split at 200 chars in mod (sentence/word boundaries, max 3 chunks)
- **D-19:** Planner Say: regex uses double-quote matching only (not single quotes) to prevent apostrophe truncation ("I'll", "don't", etc.)

### Agent Prompt
- **D-20:** Agents talk about their world as real — crafting tables, furnaces, ores are real objects they use
- **D-21:** Agents NEVER mention: baritone, pathfinding, auto-stop, pipeline, action loop, mod, API — these don't exist in their world
- **D-22:** Gameplay instructions emphasize look_at_block + break_block for visible blocks, mine only as fallback when nothing visible

### Claude's Discretion
- Exact baritone-tracker.js stillness thresholds and timeout values
- Queue item validation logic details
- Emergency detection thresholds (exact health/mob distance values)
- Planner prompt wording for QUEUE: block generation

</decisions>

<canonical_refs>
## Canonical References

### Agent Architecture
- `agent/index.js` — Main tick loop, pipeline system to remove, decision tree to rewrite
- `agent/planner.js` — Planner loop, queue generation, chat sending
- `agent/llm.js` — LLM client, tool calling, remove max_tokens
- `agent/prompt.js` — System prompt + user message builder, add queue/baritone context
- `agent/state.js` — State fetching, remove old navigateActive tracking

### New Modules
- `agent/action-queue.js` — File-backed action queue (already created in v1, needs integration)
- `agent/baritone-tracker.js` — Centralized Baritone state tracking (already created in v1, needs integration)

### Mod
- `mod/src/main/java/hermescraft/BaritoneIntegration.java` — Rewrite for Baritone API
- `mod/src/main/java/hermescraft/StateReader.java` — Add surfaceBlocks with isSkyVisible filter
- `mod/src/main/java/hermescraft/ActionExecutor.java` — Chat auto-split, block placement validation

### Research Findings
- Baritone API: `BaritoneAPI.getSettings().minYLevelWhileMining`, `legitMine`, `getMineProcess().mineByName()`
- `baritone-api-fabric` jar needed (not standalone) for API access
- `world.isSkyVisible(pos.up())` definitively identifies surface blocks

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `action-queue.js` — Already created with initQueue, popAction, setQueue, clearQueue, getQueueSummary. Needs wiring into index.js
- `baritone-tracker.js` — Already created with startBaritone, updatePosition, getStatus, isBaritoneActive, getBaritoneContext. Needs wiring into index.js
- `shared-state.js` — Agent coordination via coordination.json. Already integrated into planner

### Established Patterns
- ESM imports throughout agent/ — no require()
- Config via environment variables + loadAgentConfig()
- File-backed persistence for all agent state (JSON/JSONL in data/{name}/)
- Mod HTTP API at MOD_URL for state/actions
- Planner already extracts Say: lines and sends chat via mod /action endpoint

### Integration Points
- `index.js tick()` — Main decision point, currently calls LLM every tick. Needs decision tree rewrite
- `index.js main()` — Startup, needs initQueue call (already added)
- `planner.js plannerTick()` — Already has queue writing code, needs QUEUE: prompt addition
- `state.js summarizeState()` — Needs surfaceBlocks injection
- `prompt.js buildUserMessage()` — Already accepts queueSummary/baritoneContext params

</code_context>

<specifics>
## Specific Ideas

- With Timber plugin active, agents only need to break ONE log of a tree and the whole thing falls. This means look_at_block + break_block on the nearest surface log is extremely effective
- With AutoPickup, items go straight to inventory — no need for pickup_items action after breaking blocks
- Baritone should still be used for #goto navigation (pathfinding to coordinates) — it's good at that. Just not for #mine which searches globally
- The queue system should feel natural — planner writes "mine oak_log, craft planks, craft sticks" and the action loop just does them one by one without thinking

</specifics>

<deferred>
## Deferred Ideas

- ServerTap REST API integration — Phase 3
- Custom Skript commands (/scan, /share-location) — Phase 3
- mcMMO/AuraSkills integration into agent personality — Phase 3
- QuickShop trading between agents — Phase 3
- Baritone API for path preview/cancellation — future enhancement

</deferred>

---

*Phase: 02-spatial-awareness-architecture*
*Context gathered: 2026-03-21 via autonomous mode*
