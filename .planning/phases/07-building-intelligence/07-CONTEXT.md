# Phase 7: Building Intelligence - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the hardcoded blueprint system with freestyle LLM-designed building. The planner writes a structured building plan to a context file, the action loop executes it block-by-block using smart_place, a placement tracker records every placed block, and task verification checks the result against the original plan using vision + placement log.

</domain>

<decisions>
## Implementation Decisions

### Freestyle Building Plan Format
- Planner writes building plan as a context file (uses existing save_context tool)
- Plan format: structured markdown with block list and placement sequence
- Each entry specifies: block type, relative position (x, y, z offset from origin), placement order
- Origin point: the agent's current position when the build starts
- Plan includes: structure name, dimensions, material list with quantities, layer-by-layer placement order (bottom up)
- Inventory check: reject plan before queuing if >10% of required blocks are not in inventory
- Plan lives in context file so it survives history wipes — action loop reads it each tick

### freestyle.js Module
- New agent/freestyle.js — parses the markdown building plan into a [{block, x, y, z}] array
- Writes parsed plan to action queue as a sequence of smart_place actions
- Each smart_place action includes the target block type and absolute coordinates (origin + offset)
- Progress tracking: mark each step complete as smart_place succeeds
- Plan completion: when all steps executed, delete the context file

### Block Placement Tracking (placement-tracker.js)
- New agent/placement-tracker.js — persistent placed-blocks log
- File: agent/data/{name}/placed_blocks.json
- On every successful smart_place response: append {block, x, y, z, timestamp}
- Read from smart_place HTTP response (Phase 5 added placed block data to response)
- Survives agent restarts (JSON file persistence)
- Provides getPlacedBlocks() for verification and getPlacedBlocksForPrompt() for prompt injection

### Task Completion Verification
- After build completion, trigger verification using existing pendingReview mechanism in index.js
- Inject "verify your build" prompt — compare vision output + placement log against the plan
- Vision loop (Claude Haiku) provides the structural observation (BUILD: field)
- Placement tracker provides the block count and positions
- Log pass/fail result — if fail, optionally queue repair steps
- Do NOT block the tick loop for verification — make it async within the existing review cycle

### Builder.js Replacement
- Do NOT modify existing builder.js or blueprints.js — leave them for backwards compatibility
- freestyle.js is the new building system — planner uses it instead of blueprints
- If builder.js/blueprints.js cause conflicts (double-place race condition), guard with a flag

### Claude's Discretion
- Exact markdown format for building plans (as long as it includes block, position, and order)
- Verification prompt wording (as long as it uses vision BUILD: field + placement log)
- Whether to support partial builds (resume after restart) vs full rebuilds

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- agent/index.js: pendingReview mechanism for subtask verification (reviewSubtaskOutcome)
- save_context / delete_context tools — already in GAME_TOOLS, write to agent/data/{name}/context/
- smart_place action (Phase 5) — returns {placed: {block, x, y, z}} in response
- Vision loop: _lastVisionText with BUILD: field from Claude Haiku (Phase 4)
- CREATIVE_BEHAVIOR blocks in SOUL files — drives aesthetic building decisions
- builder.js / blueprints.js — existing system being replaced (not modified)

### Established Patterns
- Context files: agent/data/{name}/context/*.md — up to 5 files, 8000 chars each
- JSON persistence: agent/data/{name}/*.json pattern (stats.json, locations.json, chests.json)
- Module pattern: flat camelCase.js with named exports, init<Subsystem>() at startup
- Action results parsed in executeAction() post-response block (see chests.js trackChest pattern)

### Integration Points
- freestyle.js hooks into planner.js — when planner decides to build, it writes the plan via save_context and queues the freestyle execution
- placement-tracker.js hooks into executeAction() — parse smart_place response for placed block data
- Verification hooks into index.js pendingReview mechanism — set after build completion
- getPlacedBlocksForPrompt() injected into buildUserMessage() in prompt.js

</code_context>

<specifics>
## Specific Ideas

- T2BM (2024) validated freestyle building via JSON interlayer — LLM designs, agent executes deterministically
- Voyager's self-verification (73% performance drop without it) validates the verification approach
- The freestyle plan should feel natural to the LLM — structured markdown it can generate easily
- Research warns: reject designs requiring >10% non-inventory materials before queuing

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
