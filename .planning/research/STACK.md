# Stack Research

**Domain:** Minecraft AI Agent — v2.3 Persistent Memory, Vision, Build Planning, Multi-Agent
**Researched:** 2026-03-23
**Confidence:** MEDIUM-HIGH — cloud services verified via official docs; npm packages confirmed via registry

---

## Context: What This Research Covers

v2.3 adds four capability layers on top of the v2.0/v2.2 Mineflayer + RAG stack. This document covers ONLY what is new. Do not re-install or change anything from the validated stack:

- `mineflayer` 4.35.0, `mineflayer-pathfinder` 2.4.5 — carry forward unchanged
- `minecraft-data` 3.105.0, `vec3` 0.1.10 — carry forward unchanged
- `vectra` 0.12.3, `minisearch` 7.2.0, `@huggingface/transformers` 3.8.1 — RAG stack, unchanged
- `openai` 4.x OpenAI-compat client — unchanged
- SOUL files, MEMORY.md, locations, social modules — unchanged

---

## Recommended Stack Additions

### Persistent Memory System

**Verdict: Custom SQLite-backed event log, NOT Honcho.**

Honcho (Plastic Labs) is the most sophisticated purpose-built agent memory platform available in 2026.
It is specifically marketed for game NPCs, has a Node.js SDK (`@honcho-ai/sdk` 2.0.1), and delivers
state-of-the-art results on the BEAM memory benchmark. However, for HermesCraft v2.3 it is the wrong
choice for three reasons:

1. **External service dependency** — Honcho is a hosted cloud service (self-hosting requires
   Postgres + pgvector + Docker + OpenAI API key for its internal reasoning). The Glass server has
   15GB RAM and no Postgres. Adding an external call-per-turn memory service adds latency and a new
   failure mode.

2. **Designed for user-agent relationships, not game event streams** — Honcho models "peers"
   (humans and agents) with psychological insights derived from conversation. HermesCraft agents
   need to remember game events: "I mined 64 iron at coords 120,64,-300 on 2026-03-20." Honcho
   reasoning (Dreamer agent, peer cards) produces the wrong abstraction for this.

3. **Cost** — $2 per million ingested tokens. Game event streams are high-volume. A session
   producing 500 agent turns at ~200 tokens each = 100K tokens. Ten sessions per week = 1M tokens.
   Not prohibitive, but unnecessary when the existing MEMORY.md pattern already works and SQLite
   is free.

**Use Honcho when:** Building a chatbot or personal assistant where understanding the user's
psychology and preferences over long multi-month conversations is the core product. Not this.

The right approach is a local **SQLite event log** using `better-sqlite3`:

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `better-sqlite3` | 12.8.0 | Persistent cross-session event log | Synchronous API fits the tick loop (no async complexity). Supports ESM `import Database from 'better-sqlite3'`. Zero infrastructure — single `.db` file per agent. Fast: synchronous SQLite is faster than any async alternative for this workload. Append-only writes, reads by recency or tag. |

**Schema pattern:**
```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT NOT NULL,
  ts INTEGER NOT NULL,       -- unix ms
  type TEXT NOT NULL,        -- 'observation' | 'decision' | 'skill_outcome' | 'death' | 'build'
  summary TEXT NOT NULL,     -- 1-2 sentence natural language summary (what the LLM sees)
  data TEXT,                 -- JSON blob for structured data (coordinates, items, etc.)
  tags TEXT                  -- comma-separated tags for filtered retrieval
);
CREATE INDEX idx_agent_type ON events(agent, type);
CREATE INDEX idx_ts ON events(ts DESC);
```

Retrieval: recency (last N events), type filter, or simple keyword scan on `summary`. No
vector search needed — that's already covered by the RAG stack in `mind/knowledgeStore.js`.

**Letta/MemGPT**: Overpowered. Letta is a full agent framework that manages memory tiers via
tool calling. The project has its own Mind+Body architecture — adding Letta's agent loop would
conflict. The tiered memory concept (core/archival) is correct, but implement it directly: the
existing `mind/memory.js` is already the core tier; SQLite events become the archival tier.

---

### Vision / Spatial Intelligence

**Verdict: No external vision service. Use Mineflayer's data APIs directly.**

The PROJECT.md `Out of Scope` table already ruled out screenshot-based vision:
> "Vision/screenshots (Claude Haiku) — Mineflayer provides world state directly"

This remains correct for v2.3. The reasoning:

- **Claude Haiku 4.5** costs $1/M input tokens. A 1024x1024 screenshot encodes to ~1500 tokens
  of image data per Anthropic's tokenization. At one screenshot per turn on a 2s tick = 1800
  screenshots/hour = 2700K tokens/hour = ~$2.70/hour per agent, per vision call. Two agents
  running all day = ~$130/day on vision alone. Unacceptable.

- **prismarine-viewer headless** can render the bot's 3D world view to an image buffer
  (requires `node-canvas-webgl`). This works but produces a screenshot of what the bot "sees"
  which is less information-rich than `bot.blockAt(pos)` queries that give exact block IDs,
  NBT data, and light levels. The rendered image would then need to be sent to a vision model
  anyway, recreating the cost problem.

- **Mineflayer world APIs are the vision system.** `bot.blockAt(Vec3)` returns block type,
  metadata, biome, light level. `bot.findBlock({matching, maxDistance})` scans the loaded
  chunk within radius. `bot.entity` gives exact position and look vector. This is richer,
  cheaper, and faster than any screenshot-based approach.

**What v2.3 needs is better spatial intelligence built on these APIs:**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `mineflayer-schem` | 1.5.2 | Build from `.schem`/`.schematic`/`.litematic` files | Extends mineflayer with schematic execution: multi-bot building, automatic chest item retrieval, directional block handling, build progress events. Required if LLM-generated builds are serialized to schematic format. |

No new npm package is required for pure spatial scanning — use `bot.blockAt()` and
`bot.findBlock()` from mineflayer directly. Write a `body/spatial.js` utility module
(~100 lines) that encapsulates:
- `scanVolume(bot, origin, radius)` — returns block type histogram for a region
- `verifyBuild(bot, blueprint, origin)` — compares placed blocks against expected, returns diff
- `findBuildSite(bot, size)` — finds a flat area of given dimensions near the agent

---

### Build Planning

**Verdict: LLM-generated JSON blueprints, not external code generation.**

Three approaches exist in the wild:

1. **Voyager-style code generation** — GPT-4 generates JavaScript functions that call
   `bot.placeBlock()`. Requires a capable code-gen model. MiniMax M2.7's code generation
   quality is unverified for this. Risk: hallucinated block IDs, off-by-one coordinate errors,
   untestable code before execution.

2. **BuilderGPT / LLM-to-schematic** — Python-based pipeline, generates `.schem` files.
   Wrong language stack and adds a Python subprocess dependency.

3. **LLM-generated JSON blueprint arrays** — The LLM outputs a structured list of
   `{x, y, z, block}` entries relative to an origin. The agent's existing `body/build.js`
   skill executes placement. Clean, inspectable, retryable. This is what
   HermesCraft already does with pre-made blueprints (4 JSON files, noted in PROJECT.md).
   v2.3 extends this to LLM-generated blueprints.

**Recommended approach:** JSON blueprint generation via structured LLM output (the `!command`
text mode already used), executed by the existing `body/build.js` skill. No new npm packages
required. The build planning feature is a prompt engineering + architecture problem, not a
library problem.

**Supporting library for schematic interop:**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `prismarine-schematic` | latest | Read/write `.schem` and `.nbt` schematic files | Required if agents want to save their LLM-generated blueprints as reusable schematics, or if external tools (WorldEdit, Litematica) are used to provide reference structures. Peer of mineflayer-schem. |

---

### Multi-Agent Coordination

**Verdict: Shared JSON state file + in-process event emitter. No Redis, no external queue.**

The Glass server runs 2 agents (Jeffrey, John) as separate Node.js processes. Scaling
target is 5-10 agents. Options reviewed:

- **Redis pub/sub + task queue** — Standard for distributed multi-agent systems (per Redis
  blog 2025: Streams for task queues, pub/sub for coordination). However, Redis is not
  installed on Glass, adds infrastructure overhead, and is overkill for 2-10 local processes.

- **VillagerAgent DAG approach** — Academic framework with directed acyclic graph task
  decomposition, task distributor, and state manager. Powerful but requires writing the
  orchestration layer from scratch with complex dependency tracking.

- **Blackboard architecture** — Shared state object any agent reads/writes, with coordinator
  selecting next actor from board state. Proven pattern, available as TypeScript in
  `Network-AI` npm package. Adds coordination overhead the project doesn't need yet.

- **Shared JSON file + file-system events** — Dead simple. Each agent writes its current
  task/status to `agent/data/shared/blackboard.json`. Other agents read this file. Node.js
  `fs.watch()` notifies on changes. No network, no infrastructure, works with the existing
  file-based architecture. Scales to 10 agents on one machine.

The shared file approach is correct for v2.3. Implement as `mind/coordination.js`:
- `readBlackboard()` — parse shared JSON
- `writeMyStatus(agent, status)` — atomic write with `fs.writeFileSync` + file lock
- `claimTask(agent, task)` — optimistic lock: write, re-read to verify no conflict

**No new npm packages required for basic coordination.** If contention becomes a problem
at >5 agents, `proper-lockfile` (a lightweight file-locking npm package) can be added.

| Library | Version | Purpose | When to Add |
|---------|---------|---------|-------------|
| `proper-lockfile` | 4.1.2 | File-level mutex for blackboard writes | Add if write conflicts appear at 5+ agents. Not needed for 2 agents. |

---

### Background Memory Agent

The PROJECT.md targets "background memory agent that saves/organizes experiences
automatically." This is an architectural pattern, not a library problem.

**Implementation:** A `setInterval` (every 60 seconds) in `start.js` that:
1. Reads recent `events` rows from SQLite (last N unprocessed)
2. Calls the LLM to generate a 1-2 sentence consolidation summary
3. Appends high-signal summaries to the agent's `MEMORY.md`
4. Marks events as processed

This reuses the existing OpenAI-compat client and MEMORY.md system. No new infrastructure.
The LLM call runs outside the 2s tick loop — latency doesn't matter. One extra LLM call
per minute per agent is negligible for MiniMax M2.7.

---

## Complete v2.3 Installation

```bash
# Persistent memory
npm install better-sqlite3

# Build from schematics (optional, for interop with WorldEdit/Litematica)
npm install mineflayer-schem prismarine-schematic
```

Everything else is implemented in new modules using existing dependencies.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `better-sqlite3` local event log | Honcho `@honcho-ai/sdk` 2.0.1 | Use Honcho when: external service OK, high-volume conversational memory needed, multi-month psychological modeling of users is the product. Not for game event streams. |
| `better-sqlite3` local event log | Letta/MemGPT full agent framework | Use Letta when: building agents from scratch and want a managed memory tier system. Conflicts with existing Mind+Body architecture. |
| Mineflayer block APIs for spatial | `prismarine-viewer` headless screenshots | Use prismarine-viewer when: you need human-interpretable visual output for debugging or streaming. Not suitable as vision input for LLM due to cost. |
| JSON blueprint arrays | Voyager code generation | Use Voyager approach when: LLM is GPT-4 class with strong code generation, and complex procedural structures are needed. MiniMax M2.7 is unproven for reliable JS code gen. |
| Shared JSON file blackboard | Redis pub/sub + Streams | Use Redis when: agents on different machines, >10 agents, throughput requirements exceed file I/O |
| Shared JSON file blackboard | Blackboard via `Network-AI` npm | Use Network-AI when: need atomic propose-validate-commit locking at scale, cross-framework orchestration |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@honcho-ai/sdk` | External hosted service, wrong abstraction (psychology vs events), cost at scale | `better-sqlite3` local event log |
| `langchain` / `langgraph` | Framework-level dependency that replaces your architecture, not adds to it. 200KB+ package. | Implement memory consolidation in 50 lines of plain JS |
| `sharp` (screenshot processing) | Vision is out of scope per PROJECT.md. Screenshot-based vision at $130/day/agent is unacceptable. | `bot.blockAt()`, `bot.findBlock()` for spatial intelligence |
| `node-canvas-webgl` + `prismarine-viewer` headless | Requires Xvfb-equivalent on Glass, memory overhead, produces less information than block APIs | Mineflayer world state APIs directly |
| Any Python subprocess for build generation | Language boundary adds latency, error handling complexity, deployment friction | LLM JSON blueprint output parsed in Node.js |
| `proper-lockfile` (yet) | Premature optimization for 2 agents | Add at 5+ agents if write conflicts appear |

---

## Version Compatibility

| Package | Version | Mineflayer Compat | MC 1.21.1 | Notes |
|---------|---------|-------------------|-----------|-------|
| `better-sqlite3` | 12.8.0 | N/A (Node.js only) | N/A | ESM `import Database from 'better-sqlite3'` supported. Requires native compilation — ensure `node-gyp` toolchain present on Glass. |
| `mineflayer-schem` | 1.5.2 | 4.x | 1.8–1.20+ (declared) | Based on mineflayer-builder. Requires mineflayer-pathfinder loaded. Verify 1.21.1 on integration test. |
| `prismarine-schematic` | latest | (mineflayer dep) | 1.21.1 expected | PrismarineJS project, maintained alongside mineflayer. Used internally by mineflayer-builder. |
| `@honcho-ai/sdk` | 2.0.1 | N/A | N/A | NOT RECOMMENDED — documented for completeness |

---

## Sources

- [Honcho docs — overview](https://docs.honcho.dev/) — Architecture, pricing, API methods (MEDIUM confidence — verified via official docs)
- [Honcho v3 announcement](https://blog.plasticlabs.ai/blog/Honcho-3) — Dreaming Agent, $2/M token pricing, peer model (HIGH confidence — official blog)
- [Honcho self-hosting docs](https://docs.honcho.dev/contributing/self-hosting) — Postgres + pgvector requirement confirmed (HIGH confidence)
- [@honcho-ai/sdk npm](https://www.npmjs.com/package/@honcho-ai/sdk) — version 2.0.1, Node.js SDK (HIGH confidence)
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) — version 12.8.0, ESM support confirmed (HIGH confidence)
- [better-sqlite3 GitHub](https://github.com/WiseLibs/better-sqlite3) — synchronous API, performance characteristics (HIGH confidence)
- [Letta/MemGPT docs](https://docs.letta.com/concepts/memgpt/) — tiered memory architecture, Letta V1 agent loop (MEDIUM confidence)
- [prismarine-viewer GitHub](https://github.com/PrismarineJS/prismarine-viewer) — headless mode, node-canvas-webgl requirement (HIGH confidence)
- [mineflayer-schem npm](https://libraries.io/npm/mineflayer-schem) — version 1.5.2, schematic format support (MEDIUM confidence)
- [Mindcraft README](https://github.com/kolbytn/mindcraft) — LLM generates JS code for block placement, skill library pattern (HIGH confidence)
- [Voyager paper](https://arxiv.org/abs/2305.16291) — code-as-action-space, iterative prompting, skill library (HIGH confidence — peer reviewed)
- [BuilderGPT README](https://github.com/CyniaAI/BuilderGPT) — LLM → structured build function → block list (MEDIUM confidence)
- [VillagerAgent ACL 2024](https://aclanthology.org/2024.findings-acl.964/) — DAG multi-agent coordination for Minecraft (HIGH confidence — peer reviewed)
- [Redis multi-agent blog 2025](https://redis.io/blog/multi-agent-systems-coordinated-ai/) — Streams + pub/sub pattern for agent coordination (MEDIUM confidence)
- [Claude Haiku 4.5 pricing](https://platform.claude.com/docs/en/about-claude/pricing) — $1/M input, $5/M output tokens (HIGH confidence)
- [MineCollab / Mindcraft paper 2025](https://mindcraft-minecollab.github.io/) — multi-agent embodied reasoning benchmark (HIGH confidence)

---

*Stack research for: HermesCraft v2.3 Persistent Memory, Vision, Build Planning, Multi-Agent*
*Researched: 2026-03-23*
*Prior stack (v2.0/v2.2) documented in STACK.md — this file covers v2.3 additions only*
