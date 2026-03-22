# Architecture Patterns

**Domain:** Autonomous Minecraft life simulation
**Researched:** 2026-03-20

## Current Architecture

```
                    +-----------------+
                    |   MC Server     |
                    |   (Fabric 1.21) |
                    +--------+--------+
                             |
                    +--------+--------+
                    | HeadlessMC      |
                    | Client + Mod    |
                    | (HermesBridge)  |
                    +--------+--------+
                             | HTTP API (:300X)
                    +--------+--------+
                    |  Agent Harness  |
                    |   (Node.js)     |
                    |                 |
                    | observe-think-  |
                    | act loop        |
                    +--------+--------+
                             | API calls
                    +--------+--------+
                    |  LLM Provider   |
                    | (MiniMax M2.7)  |
                    +-----------------+
```

This architecture is sound and matches the ecosystem standard (Mindcraft, Voyager both use thin client + fat agent with LLM API calls).

## Recommended Architecture Additions

### Building System Component

```
Agent Loop
  |
  +--> LLM decides to build
  |      |
  |      +--> Select blueprint from library
  |      +--> Select site (flat ground scan)
  |      +--> Check materials (inventory vs. required)
  |      |
  |      +--> If materials short:
  |      |      Queue gathering subtask
  |      |      Return to building when ready
  |      |
  |      +--> Execute blueprint:
  |             Layer-by-layer, bottom to top
  |             For each block:
  |               equip(block_type)
  |               look_at_block(origin + offset)
  |               place(block_type)
  |             Report progress to LLM
  |
  +--> LLM observes progress, adjusts plan
```

**Key Design Decision:** Blueprint execution should be a **sustained action** (like mine/navigate) that runs across multiple ticks, reporting progress back to the LLM. The LLM should NOT decide each individual block placement -- it decides WHAT to build, WHERE, and WITH WHAT, then monitors the execution.

### Memory System Component

```
+--------------------------------------------------+
|                 MEMORY SYSTEM                     |
|                                                   |
|  Working Memory (L1)                              |
|  +----------------------------------------------+|
|  | Conversation history (last ~30 messages)      ||
|  | Current game state                            ||
|  | Active task plan                              ||
|  +----------------------------------------------+|
|                                                   |
|  Episodic Memory (NEW)                            |
|  +----------------------------------------------+|
|  | Event store: {time, day, type, desc, loc,     ||
|  |   entities, importance}                       ||
|  | Retrieval: recency * importance * relevance   ||
|  | Cap: ~200 events, prune lowest-scoring        ||
|  +----------------------------------------------+|
|                                                   |
|  Semantic Memory (L2 - MEMORY.md)                 |
|  +----------------------------------------------+|
|  | Lessons (death-derived)                       ||
|  | Strategies (phase-derived)                    ||
|  | World Knowledge (discovered facts)            ||
|  | Reflections (NEW - insight-derived)           ||
|  +----------------------------------------------+|
|                                                   |
|  Procedural Memory (L4 - skills/)                 |
|  +----------------------------------------------+|
|  | SKILL.md files with strategies                ||
|  | Success rate tracking                         ||
|  | Phase-specific and general skills             ||
|  +----------------------------------------------+|
|                                                   |
|  Spatial Memory (locations.js - ENHANCED)         |
|  +----------------------------------------------+|
|  | Named locations with semantic labels          ||
|  | Home location                                 ||
|  | Resource zones, danger zones                  ||
|  | Other agents' known locations                 ||
|  +----------------------------------------------+|
+--------------------------------------------------+
```

### Behavior System Component

```
Each Tick:
  1. Update needs scores (decay/increase based on state)
  2. Update emotional state (event-driven + decay)
  3. Inject needs + mood + time hints into prompt
  4. LLM makes decision informed by all context

  Needs: [hunger: 0-100, safety: 0-100, social: 0-100]
  Mood:  {type: string, intensity: 0-10}

  Time-based hints:
    dawn  -> "Morning. Good time to work."
    dusk  -> "Getting dark. Find shelter."
    night -> "Night. Stay safe. Socialize. Reflect."
```

## Component Boundaries

| Component | Responsibility | Communicates With | File(s) |
|-----------|---------------|-------------------|---------|
| Agent Loop | Tick cycle, state management | All components | index.js |
| LLM Interface | Query LLM, parse responses | Agent Loop | llm.js |
| Action Executor | HTTP calls to mod | Agent Loop | actions.js |
| Prompt Builder | Context-efficient prompts | Memory, Behavior, Skills | prompt.js |
| Memory Manager | L1-L4 storage/retrieval | Prompt Builder, Agent Loop | memory.js |
| Episodic Store (NEW) | Event recording and retrieval | Memory Manager | episodic.js |
| Reflection Engine (NEW) | Periodic memory synthesis | Episodic Store, Memory | reflection.js |
| Skill System | Procedural memory | Prompt Builder | skills.js |
| Social System | Relationship tracking | Memory Manager | social.js |
| Spatial System | Location memory | Memory Manager | locations.js |
| Blueprint Library (NEW) | Structure definitions | Building Executor | blueprints.js |
| Building Executor (NEW) | Block-by-block placement | Action Executor, Blueprint Library | builder.js |
| Needs Tracker (NEW) | Physical/social needs | Prompt Builder | needs.js |
| Behavior System (NEW) | Mood, idle, day/night | Prompt Builder, Needs Tracker | behavior.js |

## Data Flow

### Observe Phase
```
MC Server -> Mod (HTTP /state) -> Agent Loop
  -> Update needs (hunger from food level, safety from health/time/entities)
  -> Update social (nearby players)
  -> Update spatial (auto-detect locations)
  -> Check for death, phase transitions
```

### Think Phase
```
Agent Loop -> Prompt Builder
  -> System prompt: SOUL + gameplay + active skill + memory + needs + mood + pinned context
  -> User message: state + notepad + task plan + recent actions + chat
  -> Query LLM
  -> Parse response (action + reasoning)
```

### Act Phase
```
Agent Loop -> Action Executor -> Mod (HTTP /action)
  -> If building: Blueprint Executor handles multi-tick placement
  -> If info action: Handle locally (recipes, wiki, notepad)
  -> Track success/failure
  -> Record to episodic memory if significant
```

### Reflect Phase (NEW - periodic, not every tick)
```
Every ~100 ticks OR when idle at night:
  Agent Loop -> Reflection Engine
  -> Retrieve recent episodic memories
  -> Feed to LLM with reflection prompt
  -> Store resulting insights in semantic memory
  -> Optionally update emotional state
```

## Patterns to Follow

### Pattern 1: Separation of Creative and Procedural Decisions
**What:** LLM makes creative decisions (what to build, where, what style). Procedural systems handle execution (place blocks in order, manage inventory).
**When:** Any task involving spatial reasoning or repeated physical actions.
**Why:** LLMs are good at creative/strategic decisions, bad at coordinate math. This is the single most important architectural pattern from the research.

### Pattern 2: Progressive Disclosure in Prompts
**What:** Only inject information relevant to the current situation. Don't dump all memories, all skills, all locations into every prompt.
**When:** Building the system prompt.
**Why:** Token efficiency is critical at 2-5s tick intervals. MiniMax M2.7 context window and inference speed degrade with prompt bloat.

### Pattern 3: Sustained Actions with Progress Reporting
**What:** Long-running tasks (building, farming, mining) run across multiple ticks. The agent receives progress updates and can adjust.
**When:** Any multi-step physical task.
**Why:** Already implemented for mine/navigate via pipelining. Extend the same pattern to building.

### Pattern 4: Emergent Coordination via Observation
**What:** Multi-agent coordination happens through in-game observation (nearbyEntities, chat) rather than a central planner.
**When:** Multi-agent scenarios.
**Why:** Central planners break the human illusion. Project Sid and Mindcraft both found that over-coordination degrades quality.

## Anti-Patterns to Avoid

### Anti-Pattern 1: LLM-as-Coordinate-Planner
**What:** Asking the LLM to generate block coordinates for building.
**Why bad:** GPT-4o scores 41/100 on spatial planning. Smaller models will be worse. Leads to floating blocks, gaps, asymmetric structures.
**Instead:** Use pre-defined or LLM-generated blueprints with structured JSON format. Execute procedurally.

### Anti-Pattern 2: Dumping All Context Every Tick
**What:** Including all memories, all skills, all locations in every prompt.
**Why bad:** Token waste, slower inference, key information buried in noise.
**Instead:** Score memories by relevance to current situation. Include top-N. Use pinned context only for active plans.

### Anti-Pattern 3: Explicit Multi-Agent Task Assignment
**What:** A coordinator agent assigns tasks to worker agents.
**Why bad:** Unnatural. Real humans don't have a task manager assigning them work on a survival island.
**Instead:** Agents observe what others are doing and make their own decisions. Personality drives division of labor.

### Anti-Pattern 4: Perfect Recall
**What:** Agents remember everything forever.
**Why bad:** Humans forget. Perfect recall makes agents feel robotic. Also, unbounded memory = unbounded token cost.
**Instead:** Memory scoring with temporal decay. Important events persist; routine events fade.

## Scalability Considerations

| Concern | 2 agents | 5 agents | 10 agents |
|---------|----------|----------|-----------|
| LLM API calls | 0.5-1 calls/sec | 1-2.5 calls/sec | 2-5 calls/sec |
| Mod HTTP load | Negligible | Negligible | May need connection pooling |
| MC server load | Light | Moderate | Heavy (10 headless clients) |
| Memory I/O | Negligible | Negligible | May need batch writes |
| Chat noise | Low | Moderate | Need dedup + filtering |
| Agent-agent conflicts | Rare | Occasional | Frequent (feature!) |

**Key bottleneck at scale:** MC server performance with 10 headless clients, each rendering a chunk area. This is a server/hardware constraint, not an architecture one.

## Sources

- Architecture pattern validated against Voyager, Mindcraft, GITM, Project Sid
- Anti-patterns from MineAnyBuild (NeurIPS 2025), Mindcraft (2025)
- Memory architecture from Generative Agents (Stanford), Optimus-1 (NeurIPS 2024)
- Scalability considerations are original analysis based on existing HermesCraft deployment
