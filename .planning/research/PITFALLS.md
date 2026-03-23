# Pitfalls Research

**Domain:** LLM-driven Mineflayer agents — adding persistent memory, vision, ambitious build planning, and multi-agent coordination to existing v2.0 Mind + Body architecture
**Researched:** 2026-03-23
**Confidence:** HIGH — sourced from Mindcraft/Voyager post-mortems, MAST multi-agent failure taxonomy (NeurIPS 2025), mineflayer issue tracker, LLM memory research (2024-2025), and direct analysis of the v2.0 codebase

---

## Critical Pitfalls

### Pitfall 1: Unbounded Memory File Growth Degrades Retrieval and Prompt Quality

**What goes wrong:**
A naive "save everything" persistent memory strategy causes the MEMORY.md to grow without bound across sessions. After 20-30 sessions, the file contains hundreds of bullet-point "lessons" that are contradictory, redundant, or time-expired ("explored north — found nothing" becomes false after the next expedition). When all of this is injected into every prompt, three things happen simultaneously: (a) the LLM hits context rot — information buried in the middle of a long context is attended to 30% less reliably than information at the start or end, (b) contradictory facts confuse the LLM into hedging or ignoring the section entirely, and (c) the per-call token cost grows linearly with sessions played.

The v2.0 `memory.js` already has hardcoded caps (`slice(-20)` lessons, `slice(-10)` strategies) which prevent the worst case. The v2.3 milestone will add episodic memory, locations, build history, and potentially a background memory agent — each adds a new unbounded accumulation surface if not designed with explicit eviction from the start.

**Why it happens:**
Developers treat memory as append-only logs because that is the simplest implementation. The assumption is "more context = better performance." Research from 2024-2025 shows the opposite: models tested with 18 frontier LLMs all degraded in accuracy as context grew, and utility-based deletion with a capped buffer outperformed naive retention by up to 10% on task completion.

**How to avoid:**
- Apply a FIFO cap to every memory category (already done for lessons/strategies/worldKnowledge).
- For new episodic memory, deduplicate before writing: hash the semantic content and skip entries that are too similar to the last 5 entries in the same category.
- Mark memories with timestamps and apply temporal decay: facts older than N sessions that haven't been accessed are either pruned or demoted to a "cold" archive not injected into prompts.
- Never inject the full memory file; inject only the top-K most recently relevant entries per context.
- Enforce a hard character budget on the memory section of the system prompt (current `getMemoryForPrompt()` does this implicitly; make it explicit).

**Warning signs:**
- MEMORY.md file size growing past 5KB
- LLM starts ignoring memory section (visible in reasoning: never references lessons)
- Contradictory instructions visible in the same memory dump (e.g., "explore north" and "north explored, nothing there")
- System prompt token count growing session-over-session with no new features added

**Phase to address:** Memory Phase — design eviction and deduplication before the first production run, not as a retrofit.

---

### Pitfall 2: Vision Per-Tick = Latency Death Spiral

**What goes wrong:**
Adding screenshot-based vision (sending PNG/JPEG to a vision LLM like Claude Haiku or GPT-4o-mini) on every think() cycle destroys the agent's responsiveness. A screenshot capture + encode + API round trip + decode takes 800ms–2s on a good day. This is added on top of the existing 0.5–1s text LLM call, making each think cycle 1.3–3s. On Glass's constrained hardware (15GB RAM, 4 cores) with 2 agents both doing vision calls, you have 4 parallel LLM calls contending for the same network and process resources.

The critical compounding failure: the 300ms body survival tick runs independently and may fight the stuck agent for CPU time when the vision call is blocking the event loop or awaiting I/O.

Voyager's architecture explicitly paused the game server for thinking because it could not keep up with real-time play. The v2.3 milestone explicitly marks vision as out-of-scope in PROJECT.md — this is the correct call.

**Why it happens:**
Vision appears as an obvious enhancement ("give the bot eyes!") and VLM APIs make it trivially easy to implement. The failure is underestimating compounded latency and not accounting for the cost of two concurrent vision-calling agents. Research on game agents with VLM backends shows performance near random-action baselines when vision is the primary state input — worse than structured game-state APIs.

**How to avoid:**
- Keep vision explicitly out of scope. Mineflayer provides complete structured world state (block positions, entity types, inventory, time, health) which is far richer and more reliable than screenshot analysis.
- If vision is required for something specific (e.g., reading signs or identifying mob types not in entity data), use it as a deliberate one-shot command (`!look target:screenshot`) with a separate LLM call budget, not injected into every think cycle.
- Never trigger a vision call from the 300ms survival tick.
- If a future phase adds vision: gate it behind a dedicated trigger event, cache results for at least 2 seconds, and only use models that respond in under 500ms.

**Warning signs:**
- think() cycle time exceeding 2 seconds (log delta between `[mind] thinking...` and `[mind] dispatching:`)
- Survival tick logs showing gaps > 500ms between body tick firings
- Memory pressure on Glass increasing over a session

**Phase to address:** Every phase — vision stays out of scope. If it re-enters scope, it requires a dedicated latency study phase first.

---

### Pitfall 3: Blueprint Generation Block Count and Spatial Reasoning Failures

**What goes wrong:**
The existing `!design` pipeline asks an LLM to generate a blueprint JSON for a structure described in natural language. For small structures (5x5x4 cabins), this works. For "ambitious builds" targeted in v2.3 (multi-structure settlements, large unique buildings), the LLM reliably fails in three distinct ways:

1. **Grid row length miscounts**: The LLM generates grid rows that are not exactly `size.x` characters wide. `validateBlueprint()` catches this, but the build silently fails without recovery.
2. **Layer count mismatches**: The LLM declares `size.y = 8` but generates only 6 layers. The validator catches it, but the design result is `{ success: false }` with no fallback.
3. **Material estimation errors**: For a 10x10x5 structure, the LLM estimates "about 50 cobblestone" — actually 300 blocks are needed. The build pauses with `missingMaterials` error, and neither agent has a strategy to gather the correct amount.

The Mindcraft MineCollab benchmark (2025) found Claude 3.5 Sonnet placed less than 40% of blocks correctly in coordinated construction tasks. "Wrong Command," "Missing Step," and "Logic Error" together accounted for 100% of construction plan failures.

**Why it happens:**
LLMs have documented spatial reasoning and grid-counting weaknesses. Counting characters in a generated string requires the model to track an implicit counter — it drifts. This is not a model quality issue; it's a fundamental mismatch between autoregressive token generation and spatial counting. Larger/more capable models improve slightly but do not reliably eliminate it.

**How to avoid:**
- **Schema enforcement**: After LLM generates blueprint JSON, run `validateBlueprint()` and retry up to 2 times with the validation error injected back into the prompt ("Your grid row 3 has 7 characters but should have 5. Fix this specific row."). Already have the validator — add the retry loop.
- **Constrain by complexity**: Hard-cap blueprint sizes for LLM-generated designs at 10x10x8 (already in the design prompt as a rule). Do not increase this for v2.3 without testing.
- **Pre-calculate material requirements**: After blueprint validates, compute exact block counts from the palette+grid before starting the build. If the bot doesn't have enough, gather first, then build — don't rely on LLM estimation.
- **Segment large builds**: Break builds > 200 blocks into phases (foundation, walls, roof) rather than one monolithic build command. Each phase can pause for material gathering without losing the overall plan.
- **Post-place verification**: The existing `body/skills/build.js` does post-place checks. Ensure this extends to LLM-generated blueprints.

**Warning signs:**
- `validateBlueprint()` failing on > 30% of `!design` attempts
- Build pausing repeatedly for "missingMaterials" on the same structure
- `completedIndex / totalBlocks` ratio never advancing past 20-30% before pausing

**Phase to address:** Build Planning Phase — retry loop and pre-computed material lists before any ambitious build features ship.

---

### Pitfall 4: Multi-Agent Chat Loop — Agents Talk Themselves to Death

**What goes wrong:**
Jeffrey says "let's build a house." John hears it, responds "great idea, I'll get wood." Jeffrey hears that, responds "I'll get stone." John hears "stone," responds "I'll mine it." This loop generates dozens of chat messages per minute, consumes LLM call budget on content-free exchanges, and neither agent ever executes a skill. In a variant of this: Jeffrey !chat-responds while John is mid-conversation, both start chatting simultaneously, and the server floods with 20 chat messages in 5 seconds.

Mindcraft's MineCollab research found agent performance drops 15% when agents are required to communicate detailed plans — not because communication is bad, but because agents loop on communication instead of acting.

**Why it happens:**
The current `respondToChat()` function fires an LLM call on every chat message from the partner. When both agents are responsive, they can get into a ping-pong. The `_chatResponseInFlight` guard prevents stacking within one agent, but it does not limit total call frequency. An agent that receives 5 chat messages in 10 seconds while its previous LLM call returns in 500ms will fire 5 sequential LLM calls in 5 seconds.

**How to avoid:**
- **Chat deduplication window**: Track the last partner-chat timestamp. If a new partner chat arrives within 3 seconds of the last one, queue it but don't fire a new LLM call immediately — let the current call handle the context.
- **Action-first rule**: The existing system prompt says "If your partner talks to you, ALWAYS respond with !chat BEFORE doing anything else." This is correct for responsiveness but needs a complement: after responding to chat, the LLM should prefer dispatching an action next, not more chat.
- **Chat budget per cycle**: Track `consecutiveChatActions` counter. After 3 consecutive `!chat` outputs with no skill dispatch in between, inject into the next user message: "You've been chatting a lot. Take action now."
- **Cooldown on partner-message triggers**: Do not fire `respondToChat()` if the bot already called `respondToChat()` for the same partner within 2 seconds.

**Warning signs:**
- Server chat log showing > 5 messages per minute from bot accounts with no skill completions
- `[mind] chat reply sent` log lines appearing without any `[mind] dispatching:` lines between them
- Two agents both reporting `[mind] responding to chat from [partner]` simultaneously

**Phase to address:** Multi-Agent Coordination Phase — implement chat deduplication window before deploying two agents together.

---

### Pitfall 5: Shared State Corruption — Both Agents Write to the Same Files

**What goes wrong:**
Jeffrey and John both run in separate Node.js processes. Both processes read and write the same files if their `dataDir` is not isolated: `players.json`, `MEMORY.md`, `stats.json`, `locations.json`. When both processes do `writeFileSync()` concurrently (both respond to a shared event like nightfall), writes interleave at the OS level. `writeFileSync` is not atomic on Linux for files > 4KB — it is a sequence of write() syscalls. The second writer can overwrite a partial write from the first, producing JSON with a truncated line: `{"lessons": ["found iro` — unparseable. On the next startup, `JSON.parse()` throws, the agent initializes with empty state, and all learned knowledge is silently lost.

The Node.js issue tracker confirms `writeFileSync` can corrupt shared files under high-frequency concurrent access (nodejs/help#2346, nodejs/node#1058).

**Why it happens:**
The natural default is to give each agent a single shared `data/` directory since they're cooperating. Developers don't anticipate concurrent writes because each agent's event loop is single-threaded. But two processes are two concurrent writers, and file I/O crosses process boundaries.

**How to avoid:**
- **Per-agent data directories** (already implemented in v2.0: `agent/data/{name}/`). Jeffrey writes to `data/jeffrey/`, John writes to `data/john/`. Never share files between agents.
- For genuinely shared state (a shared chest inventory, a cooperative build plan), write to a single canonical owner's directory and have the other agent read-only access it, or use a lightweight IPC mechanism (a shared JSON file written only by one agent, with a lock file or atomic rename pattern).
- **Atomic write pattern**: Write to `file.tmp`, then `fs.renameSync('file.tmp', 'file')`. `rename()` is atomic on the same filesystem on Linux, eliminating partial-write corruption.
- **Validate on load**: All `JSON.parse()` calls in `memory.js`, `social.js`, `locations.js` already have try-catch with empty fallbacks. Verify this pattern is maintained in all new modules.

**Warning signs:**
- `SyntaxError: Unexpected end of JSON input` on agent startup
- Agent starting with empty memory after a session that appeared to be working
- `stats.json` showing `sessionsPlayed: 1` every startup despite many prior sessions
- `locations.json` missing entries that were saved in a prior session

**Phase to address:** Memory Phase (day one) — the per-agent directory pattern must be enforced and documented before any new shared-state features are added.

---

### Pitfall 6: Embedding Model Memory Leak Under Extended Agent Sessions

**What goes wrong:**
The `knowledgeStore.js` loads `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers` (quantized INT8, ~43MB model weights). Each `retrieveKnowledge()` call runs an embedding inference pass. On Node.js + ONNX Runtime Web, tensor objects are not always garbage collected promptly between calls. Documented in `huggingface/transformers.js` issue #860 (memory leak under repeated inference) and issue #759 (excessive memory consumption). Under a long-running agent session with RAG queries firing every think() cycle, the Node.js heap grows by ~10–50MB per hour. On Glass with 15GB RAM serving 2 agents + Paper server, this matters after 4-8 hours.

**Why it happens:**
ONNX Runtime allocates native memory for inference tensors. The JS garbage collector controls the JS wrapper but not the native backing memory. Without explicit `tensor.dispose()` calls (which transformers.js does not expose to the consumer in all cases), native tensors accumulate until a GC cycle happens to collect both the JS wrapper and the native memory. In practice, this collection is deferred and incomplete under high-frequency inference.

**How to avoid:**
- **Batch on startup, not per-tick**: The current design embeds the entire corpus once at startup and persists to disk. At query time, only one embedding is generated (the query itself). This is already the lowest-frequency pattern possible — do not change it.
- **Cache recent query embeddings**: If `deriveRagQuery()` generates the same query string twice within 5 seconds (e.g., "early game start first day punch tree"), cache the embedding vector for 10 seconds to avoid redundant inference.
- **Monitor heap growth**: Add periodic `process.memoryUsage().heapUsed` logging (every 5 minutes). Alert if heap grows by > 100MB in a session.
- **Restart cadence**: For long-running deployments, schedule a nightly restart (e.g., via the tmux session management in `launch-agents.sh`) to clear accumulated heap fragmentation.
- **Upgrade check**: The transformers.js memory leak was reported as open as of early 2025. Check the release notes before upgrading — a fix may land in a minor version.

**Warning signs:**
- Node.js process RSS growing steadily session-over-session without a bound
- `heapUsed` exceeding 500MB for a Mineflayer + mind agent process (baseline is ~100MB)
- ONNX inference calls taking longer than at startup (latency degradation under memory pressure)

**Phase to address:** Memory Phase — add heap monitoring from the first session; implement query embedding cache before production multi-agent deployment.

---

## Moderate Pitfalls

### Pitfall 7: Context Window Stuffing — "Lost in the Middle" for Build History and Locations

**What goes wrong:**
As Jeffrey and John build more structures over many sessions, `getBuildHistoryForPrompt()` and `getLocationsForPrompt()` each grow. If injected as-is into every system prompt, the LLM faces the "lost in the middle" problem: information at positions 40-70% of the context window receives 30% less attention than information at the start or end. Build history from 3 sessions ago is attended to at random. The LLM starts making contradictory decisions ("build a house near the river" — but a house was built at the river 2 sessions ago, already in world knowledge).

**Prevention:**
- Cap build history at 5 entries (most recent), not a flat file dump.
- Cap locations at entries within 200 blocks of current position (already partially implemented with distance filtering in `locations.js`).
- For the system prompt, always put the most critical information (identity, essential knowledge) at the start AND end of the prompt, with memory/history in the less-attended middle. This exploits the U-shaped attention curve.
- Before v2.3 adds more context sections, measure total system prompt length in tokens on a realistic session and ensure it stays under 4,000 tokens (leaving room for the user message with game state + RAG).

---

### Pitfall 8: Duplicate Work — Both Agents Mine the Same Ore Vein

**What goes wrong:**
Jeffrey and John both see the same iron ore vein in their field of view. Jeffrey's think() cycle decides `!mine item:iron_ore count:8`. Before Jeffrey's skill completes, John's think() cycle also decides `!mine item:iron_ore count:8`. Jeffrey mines the 8 ores. John navigates to the same spot, finds no iron ore, and reports failure. Neither agent told the other what it was doing. This wastes 30-60 seconds of agent time per occurrence and causes spurious failure logs.

**Prevention:**
- Implement a lightweight shared activity log: a single JSON file (owned by Agent 1, read-only for Agent 2) listing `{ agent, task, target, startedAt }`. Before starting a resource task, each agent checks if the same target is already claimed.
- The simpler alternative: use the chat system. Jeffrey should say "going to mine iron at 120,40,80" before starting. John reads partner chat context and avoids the same coordinates. The social system already tracks partner last chat.
- Coordinate via task specialization in SOUL files: Jeffrey focuses on building, John focuses on gathering. Reduces the category of tasks both agents want to do simultaneously.

---

### Pitfall 9: Background Memory Agent Starves the Game Loop

**What goes wrong:**
A background memory agent that runs LLM summarization/compression of session logs on a timer sounds attractive ("let the agent reflect on its day"). In practice, on Glass's 4-core machine with 2 active game agents + Paper server already claiming 3+ cores, a third LLM call triggered by a 10-minute timer can saturate MiniMax M2.7's request queue. If the LLM API has rate limits, the background call delays the next think() call for the active agents, making them appear "frozen" in-game for 3-5 seconds.

**Prevention:**
- Background memory processing must be triggered only when agents are confirmed idle (no skill running, no active chat).
- Rate-limit background calls to once every 30 minutes maximum.
- Do not use the same LLM for background compression and active play simultaneously — if the API is busy, defer compression until the next idle window.
- Consider doing memory compression locally (rule-based deduplication, not LLM-based) to avoid consuming API quota for non-gameplay tasks.

---

### Pitfall 10: Voyager-style Skill Bloat — Too Many Stored Behaviors

**What goes wrong:**
Voyager's skill library grew to hundreds of JavaScript functions. When the retrieval query was ambiguous, the agent retrieved and injected 3-5 skill functions (each 10-50 lines) into the prompt, using significant context budget on code that was rarely relevant. For v2.3, if episodic memory stores "what I did to succeed" as raw action sequences, these sequences become very long very fast and crowd out current game state.

**Prevention:**
- Store skill outcomes as natural language summaries ("built 5-block pillar by jump-placing cobblestone") not raw action logs.
- Cap episodic memory entries at 100 characters each.
- Use recency + relevance scoring when selecting which memories to inject, not just FIFO.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Append-only MEMORY.md with no eviction | Simple to implement | Context bloat, contradictions, prompt degradation after 20+ sessions | Only with a hard per-category cap (already present in v2.0) |
| Single `_generated.json` for all LLM blueprints | Simple file management | Second agent overwrites first agent's active build if both design simultaneously | Never — use per-agent `_generated_{name}.json` or add timestamp suffix |
| Full players.json injected in every prompt | Complete social context | Grows unbounded as server is populated; 50 player entries = wasted context budget | Never — filter to nearby + non-stranger, already implemented |
| Shared `knowledge/` corpus between both agents | Saves disk space | No issue — read-only corpus. This is fine. | Always acceptable |
| BM25 + vector re-index on every startup | Simple code path | ~30-60 second cold start delays agent readiness; slows down reconnect after crash | Only during development; pre-built index already implemented for production |
| No inter-agent coordination protocol | Fastest to ship | Duplicate work, chat loops, conflicting builds accumulate over time | Acceptable for v2.3 Phase 1; requires mitigation before ambitious multi-phase builds |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| MiniMax M2.7 + blueprint generation | Asking LLM to produce large grids (15x15+) in one shot | Hard-cap prompt rules at 10x10 max; retry with error feedback on validation failure |
| `@huggingface/transformers` in Node.js | Loading embedder model fresh on every startup | Pre-embed on first run, persist `LocalIndex` to disk; load from disk on subsequent runs (already done in `knowledgeStore.js`) |
| `vectra` LocalIndex + multi-agent | Both agents initializing the same index directory concurrently | Each agent should use a separate `AGENT_NAME`-prefixed index path, or pre-embed once as a shared build step |
| Mineflayer chunk caching | Letting bots explore indefinitely without unloading chunks | Mineflayer does not unload chunks automatically (issue #1123); for long sessions, monitor RSS and restart on a schedule |
| Paper server event lag + `placeBlock` timeout | Assuming 5s timeout is safe on loaded server | The existing timeout is already a known issue; build.js wraps placeBlock with retry; do not increase block rate in v2.3 |
| `writeFileSync` concurrent writes | Two agents writing to same JSON on the same tick | Per-agent data directories + atomic rename pattern for any file with concurrent writer risk |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| RAG retrieval on every think() call | Each think() takes extra 200-400ms for embedding + vector search | Cache identical query strings for 5-10 seconds; skip RAG for `idle` triggers when bot state hasn't changed | Day one with active agents |
| Two agents both doing BM25+vector search simultaneously | Double CPU on 4-core Glass machine during retrieval | Pre-built shared index (read-only after startup); BM25 is fast (~5ms), vector search is the bottleneck | Immediately with 2 agents |
| Build verification polling too aggressive | `[body/build] verifying block...` logs every 50ms; event loop starved | Post-place verification should be event-driven (`blockUpdate` event), not polled | With builds > 100 blocks |
| Social memory `interactions` array unbounded per player | players.json grows as agent talks more; injected into every prompt | Cap at 20 interactions per player (already done in `social.js`) | After 40+ sessions |
| Session JSONL files not pruned | Sessions dir fills disk over weeks of play | `pruneSessionLogs()` already keeps last 10 files; verify this runs on every shutdown | After 10+ days of sessions |
| Embedding model cold start on reconnect | 30-60s delay after bot crashes and reconnects | Pre-embed script should run in CI/deploy step, not on agent startup | On every crash+reconnect cycle |

---

## "Looks Done But Isn't" Checklist

- [ ] **Persistent memory:** Often ships without deduplication — verify that two sessions where the bot "dies to a creeper" do not create two identical "Died: killed by creeper. Be more careful." entries in lessons.
- [ ] **Build history:** Often missing cross-agent visibility — verify that John can see Jeffrey's completed builds in his prompt, not just John's own builds.
- [ ] **Multi-agent coordination:** Often passes with 1 agent in testing — verify specifically that two agents running simultaneously do not corrupt each other's data files. Run both together for 10 minutes and inspect all JSON files for validity.
- [ ] **Blueprint retry loop:** Often ships with "try once, fail silently" — verify that a validation failure on `!design` triggers at most 2 retries with error feedback injected, not zero retries.
- [ ] **Material pre-calculation:** Often ships without checking inventory before build — verify that a build paused for `missingMaterials` correctly resumes after gathering, rather than restarting from block 0.
- [ ] **RAG embedding cache:** Often missing entirely — verify that two identical consecutive RAG queries (common on idle triggers) do not fire two embedding inferences.
- [ ] **Background memory agent:** Often runs without idle check — verify it does NOT fire during an active skill or during a chat exchange.
- [ ] **Chat loop prevention:** Often passes in single-agent testing — verify with two agents chatting that neither enters a run of > 3 consecutive `!chat` responses without a skill action in between.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| MEMORY.md bloat discovered after 30 sessions | MEDIUM | Write a one-time migration script: parse MEMORY.md, dedup entries by 20-char prefix similarity, keep most recent 15 lessons/8 strategies/8 worldKnowledge, write back. Do not delete sessions/ JSONL — they remain as audit trail. |
| Shared file corruption (JSON parse failure on startup) | LOW | Agent already falls back to empty memory on parse error (try-catch in loadMemory). Fix: add per-agent dirs immediately. Replay lost knowledge from sessions/ JSONL using a migration script. |
| Chat loop (both agents stuck chatting) | LOW | Add `consecutiveChatActions` counter and inject action prompt. Restart agents if already in loop. |
| Blueprint generation quality too low for ambitious builds | HIGH | Reduce maximum blueprint size in design prompt rules (e.g., 8x8x6 max). Add retry loop with error injection. Accept that LLM-generated builds will be modest — supplement with a library of hand-crafted large blueprints. |
| Embedding model memory leak causing OOM | MEDIUM | Scheduled nightly restart (add to `launch-agents.sh`). Add heap monitoring. Check transformers.js release notes for fix. |
| Duplicate agent work (both mined same vein) | LOW | Log coordination failures. Implement activity-claim file as next patch. Short-term: rely on SOUL personality differentiation (gatherer vs builder). |

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Episodic memory design | Unbounded entries; stale facts injected verbatim | Hard caps + temporal decay from day one |
| Background memory agent | Starves game loop LLM calls if poorly timed | Idle-only trigger + 30-minute minimum interval |
| LLM blueprint generation (ambitious builds) | Grid counting errors; material underestimation | Validation retry loop + pre-computed material check before any build starts |
| Multi-agent coordination protocol | Chat loops; duplicate task execution | Chat deduplication window + consecutive-chat-action limit |
| Shared activity state (build plans, task claims) | Concurrent write corruption | Atomic rename writes; per-agent ownership with read-only cross-agent access |
| RAG context injection growth | System prompt token explosion | Measure prompt length before and after each new context section; enforce 4,000 token ceiling on system prompt |
| Long-running production sessions | Mineflayer chunk leak + embedding tensor leak | Heap monitoring + nightly restart cadence |

---

## Sources

- [Collaborating Action by Action: A Multi-agent LLM Framework for Embodied Reasoning (arXiv 2504.17950)](https://arxiv.org/html/2504.17950v1)
- [Why Do Multi-Agent LLM Systems Fail? — MAST taxonomy, NeurIPS 2025](https://arxiv.org/abs/2503.13657)
- [LLMs Fail at Minecraft Collab — Mindcraft benchmark analysis (DEV.to)](https://dev.to/aimodels-fyi/llms-fail-at-minecraft-collab-new-benchmark-exposes-ai-teamwork-weakness-53dg)
- [Design Patterns for Long-Term Memory in LLM-Powered Architectures (Serokell)](https://serokell.io/blog/design-patterns-for-long-term-memory-in-llm-powered-architectures)
- [Memori: A Persistent Memory Layer for Efficient, Context-Aware LLM Agents (arXiv 2603.19935)](https://arxiv.org/html/2603.19935)
- [How Memory Management Impacts LLM Agents (arXiv 2505.16067)](https://arxiv.org/html/2505.16067v2)
- [Context Rot: Why LLMs Degrade as Context Grows (Morph/Redis)](https://www.morphllm.com/context-rot)
- [Lost in the Middle: How Language Models Use Long Contexts (arXiv 2307.03172)](https://arxiv.org/abs/2307.03172)
- [A LLM Benchmark based on the Minecraft Builder Dialog Agent Task (arXiv 2407.12734)](https://arxiv.org/abs/2407.12734)
- [Voyager: An Open-Ended Embodied Agent with Large Language Models — limitations analysis](https://medium.com/trueagi/voyager-for-minecraft-under-the-hood-3e6cc7e3cb25)
- [Mineflayer chunks don't unload — memory leak (issue #1123)](https://github.com/PrismarineJS/mineflayer/issues/1123)
- [Mineflayer huge memory usage with multiple bots (discussion #2251)](https://github.com/PrismarineJS/mineflayer/discussions/2251)
- [Transformers.js memory leak under WebGPU/ONNX (issue #860)](https://github.com/huggingface/transformers.js/issues/860)
- [Node.js writeFile concurrent write corruption (issue #1058)](https://github.com/nodejs/node/issues/1058)
- [Fix Infinite Loops in Multi-Agent Chat Frameworks (Markaicode)](https://markaicode.com/fix-infinite-loops-multi-agent-chat/)
- [RAG vs Memory: Token Crisis in Agentic Tasks (agamjn.com)](https://agamjn.com/technical/2025/10/11/token-crisis-in-agentic-tasks.html)
- v2.0 codebase direct analysis: `mind/memory.js`, `mind/knowledgeStore.js`, `mind/index.js`, `mind/social.js`, `mind/prompt.js`

---
*Pitfalls research for: HermesCraft v2.3 — persistent memory, vision, build planning, multi-agent coordination*
*Researched: 2026-03-23*
