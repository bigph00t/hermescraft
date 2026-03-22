# Phase 1: Building System - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents can construct real structures that look intentional to a human eye. This requires vision (prerequisite), building knowledge, and opportunistic multi-session construction. Also establishes the multi-layer agent architecture that all future phases depend on.

**Scope expansion:** This phase now includes the vision system and multi-agent-per-character architecture because building requires spatial awareness and planning. These are foundational — every subsequent phase benefits from them.

</domain>

<decisions>
## Implementation Decisions

### Multi-Layer Agent Architecture
- **D-01:** Each character runs as ONE Node.js process with 3 async loops (not separate processes):
  - **Action Loop** (~3s interval) — tick-by-tick gameplay, reads vision + plan context, calls LLM, executes tool
  - **Vision Loop** (~10s interval) — takes screenshot via mod API, sends to MiniMax vision, writes spatial awareness to `vision-context.txt`
  - **Planner Loop** (~60s interval) — reads full state + memory, calls LLM for big-picture planning/reflection, writes strategy to `plan-context.txt`
- **D-02:** Loops communicate via file writes in agent's data directory. Action loop reads `vision-context.txt` and `plan-context.txt` each tick. Slight staleness is intentional — humans don't have instant omniscience either.
- **D-03:** Single process with async loops gives true parallelism (LLM calls are I/O-bound). No IPC, no HTTP between layers, no management overhead.
- **D-15:** Rate math: 2 characters = ~0.9 LLM calls/sec. 10 characters = ~4.3 calls/sec. Within MiniMax limits.

### Multi-Character Coordination
- **D-16:** Characters coordinate ONLY through the Minecraft world — in-game chat and seeing each other. No behind-the-scenes shared state.
- **D-17:** Each character's process is fully isolated. Jeffrey's agent knows nothing about John's internal state.
- **D-18:** This means coordination emerges naturally: "hey john where are you" in chat, seeing each other's builds, sharing chests in-game.
- **D-19:** Scaling: each character = 1 Node.js process + 1 MC client. Glass can handle ~10 concurrent.

### Vision System
- **D-04:** Mod captures framebuffer as PNG on `GET /screenshot` endpoint. Low res (640x360) for speed.
- **D-05:** Vision Agent sends screenshot to MiniMax M2.7 (supports vision) with prompt: "Describe what you see. Note terrain, water, cliffs, structures, mobs, other players."
- **D-06:** Vision context injected into Action Agent's prompt as `== WHAT I SEE ==` section
- **D-07:** Vision helps prevent drowning/cliff falls — "I see water ahead" → agent avoids walking into it

### Building Knowledge
- **D-08:** Ship a building principles knowledge file (`agent/knowledge/building.md`) covering:
  - Structural basics: foundation → walls → roof → door → interior
  - Material matching: wood types together, stone types together, don't mix randomly
  - Proportions: rooms at least 3x3 interior, doors 1 wide 2 tall, windows 1x1 or 1x2
  - Common structures: house, animal pen (fence perimeter), farm plot (tilled rows + water)
- **D-09:** Each SOUL file can describe building preferences (Jeffrey: lavish. John: functional)
- **D-10:** Vision Agent enables self-critique — agent screenshots its build, evaluates, iterates

### Build Execution
- **D-11:** Opportunistic construction — agent builds with what it has, comes back for more later
- **D-12:** Planner Agent creates a build plan (block positions + materials) stored in `plan-context.txt`
- **D-13:** Action Agent reads plan and places blocks when it has materials. No rigid sequence.
- **D-14:** Build progress tracked — agent knows which blocks it already placed

### Claude's Discretion
- Screenshot resolution and format
- Exact vision prompt wording
- File format for inter-agent communication
- How build plans are serialized (JSON block list, text description, etc.)

</decisions>

<specifics>
## Specific Ideas

- Agents should build like real players — messy, opportunistic, "I have cobblestone so the floor is cobblestone"
- Vision is critical for water/cliff safety — agents currently drown because they can't see water
- Each character's SOUL should influence build style but not override structural soundness
- Planner agent doubles as reflection/memory consolidation (every 60s review)

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

### Existing code
- `agent/index.js` — Main action agent tick loop
- `agent/tools.js` — Current tool definitions (19 tools including `place`)
- `agent/state.js` — Game state fetching (includes nearbyBlocks with coordinates)
- `agent/prompt.js` — System/user prompt construction (injection points for vision/planner context)
- `mod/src/main/java/hermescraft/HermesBridgeMod.java` — Mod entry point (add screenshot endpoint here)
- `mod/src/main/java/hermescraft/HttpServer.java` — HTTP endpoints (add /screenshot handler)
- `mod/src/main/java/hermescraft/ActionExecutor.java` — Action execution (place block implementation)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `place` tool already works — places blocks at crosshair or coordinates
- `navigate` + Baritone — pathfind to build site
- `look_at_block` — face specific block position for precise placement
- Pinned context system (`dataDir/context/*.md`) — can inject vision/planner output
- Agent data isolation — each agent has own data dir, multiple processes can share it

### Established Patterns
- Tick loop reads context files each tick — adding vision/planner context is natural
- MiniMax M2.7 supports vision (image input) — confirmed working for screenshots
- Agent personality via SOUL files — building preferences fit here

### Integration Points
- Vision Agent writes to `{dataDir}/vision-context.txt` — Action Agent reads in prompt builder
- Planner Agent writes to `{dataDir}/plan-context.txt` — Action Agent reads in prompt builder
- Screenshot endpoint added to HttpServer.java — Vision Agent calls via HTTP
- Building knowledge loaded into system prompt alongside SOUL content

</code_context>

<deferred>
## Deferred Ideas

- Multi-room structures — Phase 1 focuses on basic single-room builds (v2 BUILD-05)
- Glass windows and interior lighting — v2 BUILD-06
- Bridges between locations — v2 BUILD-07
- Collective building (multiple agents on same structure) — Phase 6 COOP-03

</deferred>

---

*Phase: 01-building-system*
*Context gathered: 2026-03-21*
