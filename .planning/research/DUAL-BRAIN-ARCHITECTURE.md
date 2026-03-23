# Dual-Brain Cognitive Architecture for HermesCraft Agents

Research into multi-layer / dual-process AI agent architectures for real-time Minecraft agents.
Compiled March 2026.

---

## 1. Prior Art: Existing Multi-Layer Architectures

### 1.1 Voyager (Wang et al., 2023)
**Paper:** https://arxiv.org/abs/2305.16291

Voyager is not a true dual-brain; it uses a single LLM (GPT-4) with three distinct functional roles:

| Role | What it does | Speed |
|---|---|---|
| Automatic Curriculum | Proposes next task based on state + progress | Per-task |
| Skill Library | Retrieves top-5 relevant code programs via embedding search | Per-task |
| Iterative Prompting | Executes code, feeds back errors/results, iterates up to 4 rounds | Per-subtask |

**Key insight:** Voyager uses **code as the action space**, bridging planning (what the program expresses) and execution (what runs in-world). This collapses the planner/executor split because the plan IS the executable. GPT-3.5 handles "standard NLP tasks" (embeddings) while GPT-4 handles curriculum + code generation — effectively a cheap/expensive split.

**Relevance for HermesCraft:** The skill library pattern (vector-embedded reusable code) is directly applicable. The curriculum is Voyager's version of a background brain — it fires once per task completion, not per tick.

---

### 1.2 Parallelized Planning-Acting for Minecraft Multi-Agents (2025)
**Paper:** https://arxiv.org/html/2503.03505v2

The most directly relevant architecture. Each agent runs **two independent threads**:

```
Planning Thread ──► action buffer (single slot) ──► Acting Thread
     │                                                     │
     └─── reads observations, team chat ◄─────────────────┘
```

- **Planning thread:** Continuously generates action proposals. Outputs an action + interruption flag. When the buffer is occupied, it overwrites the old action (always keep latest).
- **Acting thread:** Executes skills from a library. On interruption flag, aborts current skill and fetches the latest action.
- **Communication:** Single-slot buffer. No complex IPC — newest action wins.
- **Latency hide:** When `execution_time > planning_time`, the system hides inference latency behind execution. This is the core win.

**Performance:** 3 agents reduced Diamond Armor completion time from 28.3 → 13.7 minutes. 20 agents achieved 100% Ender Dragon success vs failures with fewer agents.

**Key insight for HermesCraft:** The planning thread is already doing something like a background brain — it generates the next action *while the current one executes*. This is the minimum viable dual-layer pattern.

---

### 1.3 Project Sid / PIANO (Altera, 2024)
**Paper:** https://arxiv.org/abs/2411.00114

PIANO (Parallel Information Aggregation via Neural Orchestration) runs **10 concurrent modules** in a shared-state model:

| Module | Speed | Type |
|---|---|---|
| Cognition | Medium | LLM |
| Planning | Slow | LLM |
| Motor Execution | Fast | Rule/script |
| Speech | Fast | LLM |
| Memory | Background | LLM + retrieval |
| Action Awareness | Fast | Rule |
| Goal Generation | Slow | LLM |
| Social Awareness | Medium | LLM |
| Talking | Fast | LLM |
| Skill Execution | Fast | Script |

**Shared Agent State:** All modules are stateless functions that read/write a central `AgentState` object. No direct point-to-point messaging. This avoids deadlock and simplifies coordination.

**Cognitive Controller (CC):** A bottleneck module that synthesizes across all module outputs and broadcasts high-level decisions downward. Once CC decides, talk modules are strongly conditioned on that decision for coherence.

**Conflict resolution:** Not explicitly specified in the paper — the CC broadcast apparently takes precedence, but the paper doesn't describe what happens when module outputs conflict at the same tick.

**Reflex speed:** Small, fast non-LLM networks handle reflexes. LLM modules run at their own cadence.

**Relevance:** This is the most sophisticated multi-module architecture in Minecraft. For a 2-brain design, the CC is the background brain, and the fast reflex modules are the main brain.

---

### 1.4 Generative Agents (Park et al., 2023)
**Paper:** https://arxiv.org/abs/2304.03442

Three-layer memory + reflection architecture:

```
Observe → Memory Stream → Retrieve → Plan → Act
                ↑               ↓
           Reflect (async)   Reflect (threshold)
```

**Memory Stream:** All observations stored with recency, importance, and relevance scores. Retrieval is scored as a weighted sum of all three.

**Reflection trigger:** Asynchronous. Fires when the sum of importance scores for recent events exceeds a threshold (150 in their implementation). In practice, agents reflected 2-3 times per simulated day.

**Reflection process:**
1. LLM generates candidate questions from the 100 most recent memories
2. Retrieval of relevant records
3. LLM extracts insights, cites evidence
4. Insights stored back into the memory stream as higher-level nodes

**Reflection tree:** Leaf nodes = raw observations. Non-leaf nodes = abstractions. Reflections can recurse on other reflections (meta-reflection).

**Relevance:** The reflection mechanism IS a background brain. It runs asynchronously when a threshold is hit, produces higher-level insights, and those insights flow back into future retrieval. The importance-score trigger is directly applicable to HermesCraft: instead of a fixed interval, the background brain fires when "enough has happened."

---

### 1.5 Talker-Reasoner Architecture (Google DeepMind, 2024)
**Paper:** https://arxiv.org/html/2410.08328v1

The canonical System 1 / System 2 dual-agent implementation:

| | Talker (System 1) | Reasoner (System 2) |
|---|---|---|
| Speed | Fast, continuous | Slow, on-demand |
| Role | Real-time conversation, immediate response | Multi-step reasoning, belief state updates, planning |
| Memory | Reads from shared memory | Writes to shared memory |
| Triggering | Every turn | Selective — only when task complexity warrants it |
| Model | Gemini 1.5 Flash | Heavier reasoning model |

**Communication:** Shared memory only. The Reasoner writes structured belief states (JSON/XML). The Talker reads those beliefs to prime responses.

**Async gap:** "The Talker might operate with a delayed view of the world, as the Reasoner might not have had time to generate the new belief." This is explicitly accepted — stale beliefs are fine for simple tasks.

**Conditional waiting:** Whether the Talker waits for the Reasoner depends on the belief state complexity. For planning-heavy phases, the Talker blocks. For casual interactions, it proceeds with stale data.

**Relevance:** This is the closest prior art to the proposed HermesCraft architecture. The Talker = main brain (fast, per-tick). The Reasoner = background brain (slow, async). Shared file/DB is the communication channel.

---

### 1.6 DPT-Agent: Dual Process Theory Agent (2025)
**Paper:** https://arxiv.org/html/2502.11882

Applied to real-time human-AI collaboration games:

**System 1 Implementation:**
- Finite-State Machine (FSM) for low-level action transitions
- Code-as-policy generator for fast reactive decisions
- A* pathfinding for navigation
- Updates every lambda interval ticks

**System 2 Implementation:**
- Theory of Mind (ToM) module: infers partner behavior from history
- Asynchronous Reflection module: updates "Behavior Guidelines" from env feedback + ToM
- Runs asynchronously, triggered by history buffer accumulation

**Data flow:**
```
System 2 outputs beliefs (b) and guidelines (g)
     ↓
System 1 code-as-policy: ct = LLM(τ[t-λ:t], b_n, g_m)
     ↓
FSM executes autonomously between code updates
```

**Key finding:** Neither system alone solves the latency-capability tradeoff. o3-mini-high alone scored -43 (too slow). With DPT-Agent integration: 65.83. ToM module alone contributed +8-13 points.

**Relevance:** Proves the dual-brain pattern works in real-time game scenarios. The FSM-as-executor pattern maps to HermesCraft's action executor. The ToM module maps to social awareness for multi-agent scenarios.

---

### 1.7 BabyAGI / AutoGPT (2023)
BabyAGI uses a single LLM behind three specialized agent roles in a tight loop:
1. **Task Creator**: Generates new tasks from result + goal
2. **Task Prioritizer**: Reranks the task list
3. **Task Executor**: Executes current task with context from vector DB

This is an **outer loop / inner loop** pattern. The outer loop (creator + prioritizer) is the background brain. The inner loop (executor) is the main brain. Communication is via a shared task queue + vector DB. Not async — the outer loop blocks between executions.

**Relevance:** The task queue pattern is useful. BabyAGI's weakness (blocking outer loop) is exactly what the proposed architecture avoids by making the background brain truly async.

---

## 2. System 1 / System 2 Thinking in AI Agents

### Canonical Definition
| | System 1 | System 2 |
|---|---|---|
| Speed | Fast (~ms) | Slow (~seconds) |
| Process | Intuitive, automatic | Deliberate, analytical |
| Token cost | Low | High |
| Reliability | High for familiar patterns | High for novel/complex tasks |
| Failure mode | Wrong snap judgments | Too slow to be useful |

### In Practice for LLM Agents

**From the DPT-Agent results:** Small models (<20B) have low latency but near-zero score efficiency on complex tasks. Large reasoning models have superior reasoning but latency so high they fail real-time benchmarks. The dual-brain pattern is specifically the solution to this tradeoff.

**Routing logic (when does each brain act?):**
- **Main brain always runs**: Every tick, unconditionally. Fast, bounded latency.
- **Background brain runs**: On a timer (every N seconds) OR on a trigger (importance threshold exceeded, specific events detected).
- **Override condition**: The background brain writes priority instructions the main brain is forced to follow next tick. But the background brain cannot preempt a currently-executing action — it only influences the NEXT decision.

**When does the background brain's output take precedence?**
- Explicit plan updates: Background writes a new plan → main brain follows it
- Constraint updates: Background detects danger, writes "AVOID X" → main brain reads before next action
- The main brain is never interrupted mid-action; only inter-action decisions are affected

---

## 3. Background Processing Patterns

### 3.1 What Should the Background Brain Do?

Based on the research, the background brain's work naturally falls into cycles of different duration:

**Fast cycle (10-20 seconds): Tactical**
- Scan recent action history for failures / stuck patterns
- Update "current situation summary" (compressed narrative of last N ticks)
- Revise immediate plan if current approach is failing
- Analyze screenshot if available → update spatial awareness

**Medium cycle (60-120 seconds): Strategic**
- Memory consolidation: Summarize last N observations into 3-5 lessons
- Inventory analysis: What do we have, what do we need, in what order?
- Plan generation: Full multi-step plan for current phase
- Social reasoning: Analyze partner behavior, predict needs (multi-agent)

**Slow cycle (5-15 minutes): Reflective**
- Generative-agents-style reflection: Extract abstract insights from the session
- Skill update: Append new lessons to relevant SKILL.md
- MEMORY.md update: Distill session into long-term knowledge

### 3.2 Memory Consolidation in Detail

Based on Generative Agents' reflection mechanism:

```
Every tick:
  main_brain_action → observation stored in episodic buffer

When buffer_importance_sum > THRESHOLD (or every N seconds):
  background_brain fires:
    1. Generate 3-5 candidate questions from recent buffer
    2. Retrieve relevant memories (recency + importance + relevance)
    3. LLM call: extract insights, cite sources
    4. Write insights to shared_state.json
    5. Reset importance accumulator

Main brain reads shared_state.json before each tick
```

The importance threshold trigger is better than a fixed timer because it fires more during high-activity periods and less during idle periods (e.g., Baritone pathfinding).

### 3.3 Spatial Analysis

The background brain is the right place to process spatial data:
- Main brain gets raw block scan (e.g., 10x10 area) as a flat list
- Background brain runs every 30 seconds: convert raw block data into higher-level spatial model ("there's a cave system to the north", "surface biome is forest", "nearest iron vein: 12m east")
- Writes spatial summary to shared state; main brain reads summary, not raw data

This compresses the main brain's spatial context from hundreds of tokens to ~50.

### 3.4 Planning

Background brain writes structured plans that the main brain follows:

```json
{
  "plan": {
    "goal": "Build a shelter before nightfall",
    "steps": [
      {"id": 1, "action": "collect_wood", "target": 20, "status": "todo"},
      {"id": 2, "action": "craft_planks", "target": 60, "status": "todo"},
      {"id": 3, "action": "build_hut", "status": "todo"}
    ],
    "current_step": 1,
    "constraints": ["avoid_zombies_at_night", "stay_near_spawn"],
    "updated_at": 1709123456
  }
}
```

Main brain reads this, checks `current_step`, and executes. When a step completes, main brain marks it done. Background brain rewrites the plan if it becomes stale or if conditions change.

### 3.5 Social Reasoning (Multi-Agent)

From DPT-Agent's Theory of Mind module:
- Background brain reads chat history + action log of partner agents
- Infers current goals and behavioral tendencies of each partner
- Writes partner models to shared state
- Main brain uses partner models when deciding whether to request help, share resources, or stay out of the way

---

## 4. Communication Between Brains

### 4.1 Recommended Pattern: Shared JSON State File

Based on Talker-Reasoner and PIANO architectures, shared memory is simpler and more robust than direct IPC.

**File:** `agent/data/{name}/background_state.json`

```json
{
  "plan": { ... },              // Background's current plan
  "insights": ["...", "..."],   // Memory consolidation results
  "spatial": { ... },          // Spatial model summary
  "partner_models": { ... },   // Social reasoning results
  "constraints": ["..."],      // Danger flags / hard constraints
  "background_status": "idle", // "running" | "idle" | "error"
  "last_updated": 1709123456,
  "cycle_count": 42
}
```

Main brain reads this file at the start of each tick (or caches it with a 5-second TTL). Background brain writes atomically (write to `.tmp`, then rename) to prevent partial reads.

**Atomic write pattern (critical for correctness):**
```javascript
await fs.writeFile(path + '.tmp', JSON.stringify(state))
await fs.rename(path + '.tmp', path)
```

### 4.2 Stale Data Tolerance

From Talker-Reasoner: explicitly accepting stale background data is fine. The main brain must:
- Check `last_updated` timestamp
- If background state is >30s old during active play, flag it but continue
- Never block waiting for background completion (except in explicit planning phases)

### 4.3 Priority Interrupts

The background brain cannot preempt the main brain mid-action. It communicates urgency via a `constraints` field:

```json
"constraints": [
  {"type": "AVOID", "target": "creeper", "priority": "HIGH", "reason": "detected 3m away"},
  {"type": "ABORT_PLAN", "reason": "inventory full, no room to collect wood"}
]
```

The main brain reads constraints at the top of each tick decision. High-priority constraints override the current plan step. This is the interrupt mechanism without actual preemption.

### 4.4 What NOT to Use for Communication
- **Direct function calls between processes:** Blocks the main brain
- **WebSocket or HTTP between Node processes:** Over-engineering for same-machine IPC
- **SQLite:** Viable but adds a dependency; JSON file is simpler for this scale
- **Redis:** Viable if you already have it running, but JSON file avoids infrastructure dependency

---

## 5. Resource Management: Sharing a GPU

### 5.1 vLLM's Continuous Batching

vLLM uses iteration-level scheduling (continuous batching). When the main brain submits a request, it enters the batch. When the background brain submits, it also enters the batch. vLLM interleaves them naturally without explicit coordination.

**Implication:** You don't need to schedule at the application level. vLLM handles it. The main brain's request will typically be smaller (fewer tokens) and return faster than the background brain's request.

### 5.2 Agent.xpu Dual-Queue Pattern

Agent.xpu (2025) validated a dual-queue architecture for exactly this use case:
- **Real-time queue:** Main brain requests — tagged as high-priority
- **Best-effort queue:** Background brain requests — tagged as low-priority

Result: 4.6x lower reactive (main brain) latency while maintaining 1.6-6.8x higher throughput for background tasks.

**For HermesCraft:** Set `priority` or use separate vLLM client instances with different batch sizes. In practice, since the background brain runs every 10-60 seconds (not every 2 seconds), natural timing separation reduces contention significantly.

### 5.3 Token Budget Allocation

| Brain | Model Size | Max Tokens/Call | Frequency | Est. GPU Load |
|---|---|---|---|---|
| Main (fast) | 27B | 384 | Every 3s | ~70% |
| Background (slow) | 7-14B | 2048 | Every 30-60s | ~30% |

**Critical:** Background brain uses a smaller model. 7B model inference is ~3-5x faster than 27B. This means background calls finish faster and contend less.

**Background brain token budget breakdown:**
- Input: up to 4000 tokens (recent history + current state + task context)
- Output: up to 2048 tokens (full plan + insights + spatial summary)

### 5.4 Avoiding Inference Contention in Practice

Options in order of preference:

1. **Natural timing separation (simplest):** Main brain fires every 3s. Background brain fires every 30-60s. With continuous batching, they rarely overlap. No code needed.

2. **Cooldown guard:** Before background brain fires, check if a main brain call is in-flight. If yes, defer 3s. Simple flag in shared state.

3. **Separate vLLM endpoints:** If running on GPU with enough VRAM, load 27B + 7B models on the same instance with separate serving endpoints. vLLM can serve multiple models.

4. **Separate GPU processes:** If you have a second GPU or time-share, run background brain on a separate process entirely.

---

## 6. Anti-Patterns: What NOT to Do

### 6.1 Over-Communication Between Layers
**Problem:** Background brain writes 20 fields every 10 seconds. Main brain spends 500 tokens per tick just processing background output.
**Fix:** Background brain writes a maximum of 5 compressed fields. Total background state injected into main brain prompt: ≤300 tokens.

### 6.2 Background Brain Overriding Time-Critical Decisions
**Problem:** Background brain marks "ABORT_PLAN" while main brain is mid-combat. Agent freezes.
**Fix:** Interrupts are suggestions, not commands. Main brain checks constraints but uses its own judgment. Only `constraints` with `priority: "CRITICAL"` are mandatory.

### 6.3 Unbounded Memory / Spatial Database Growth
**Problem:** Background brain appends insights forever. After 10 hours, `background_state.json` is 50MB.
**Fix:** Fixed-size ring buffers:
- Insights: keep last 20 entries
- Spatial model: keep last 50 notable locations
- Partner models: keep last 100 observations per partner

### 6.4 Both Brains Controlling the Same Action
**Problem:** Main brain executes `goto(X)`. Background brain also issues `goto(Y)`. Baritone gets conflicting commands.
**Fix:** Only the main brain issues actions. The background brain writes plans and constraints only. The main brain translates plan steps into actions.

### 6.5 Synchronous Background Brain
**Problem:** Background brain fires every 30s but blocks the tick loop while running.
**Fix:** Background brain runs in a separate `setInterval` or `setTimeout` chain, completely independent of the main tick loop. Use `Promise` non-blocking — don't await it in the tick.

### 6.6 Cold-Start Planning Gap
**Problem:** At startup, background state is empty. Main brain has no plan.
**Fix:** On startup, main brain defaults to a bootstrap behavior ("assess surroundings, check inventory, read notepad") until background state is populated. Background brain runs its first cycle within 5 seconds of startup.

### 6.7 Model Size Mismatch
**Problem:** Using a 27B model for the background brain defeats the purpose — it's slow and resource-intensive.
**Fix:** Background brain should be 7B-14B. Reasoning quality for consolidation/planning is more important than reasoning quality for split-second decisions. A 14B model with 2048 output tokens produces better plans than a 27B model with 384 tokens.

---

## 7. Proposed Architecture for HermesCraft

### 7.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                      HermesCraft Agent                      │
│                                                             │
│  ┌──────────────────────┐    ┌──────────────────────────┐  │
│  │     MAIN BRAIN       │    │   BACKGROUND BRAIN       │  │
│  │  (27B Hermes model)  │    │   (7-14B fast model)     │  │
│  │                      │    │                          │  │
│  │  Runs every 3s       │    │  Runs every 30-60s       │  │
│  │  Max 384 output tok  │    │  Max 2048 output tok     │  │
│  │  Controls actions    │    │  Writes state only       │  │
│  └──────────┬───────────┘    └──────────────────────────┘  │
│             │                           │                   │
│             │ reads                     │ writes            │
│             ▼                           ▼                   │
│     ┌──────────────────────────────────────────┐           │
│     │         background_state.json             │           │
│     │  plan, insights, spatial, constraints     │           │
│     └──────────────────────────────────────────┘           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               Existing HermesCraft Systems           │  │
│  │  notepad.txt  MEMORY.md  SKILL.md  conversationHistory│  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Main Brain Changes (Minimal)

The main brain tick loop gains only:
1. Read `background_state.json` (cached, max 5s TTL)
2. Inject background state summary into user message (≤300 tokens)
3. Check `constraints` array before deciding action
4. When completing a plan step, write completion marker to background state

No other changes to the main brain.

### 7.3 Background Brain Process

Runs as a second `setInterval` in the same Node.js process (or a sibling process):

```javascript
// Pseudo-code
setInterval(async () => {
  if (backgroundRunning) return  // Skip if previous cycle not done
  backgroundRunning = true

  try {
    const recentHistory = getRecentHistory(50)  // Last 50 messages
    const currentState = await fetchGameState()
    const existingState = readBackgroundState()

    const prompt = buildBackgroundPrompt(recentHistory, currentState, existingState)
    const response = await queryLLM(prompt, { model: BACKGROUND_MODEL, maxTokens: 2048 })

    const newState = parseBackgroundResponse(response)
    writeBackgroundStateAtomic(newState)
  } finally {
    backgroundRunning = false
  }
}, BACKGROUND_INTERVAL_MS)  // 30000-60000
```

### 7.4 Background Brain Prompt Structure

```
SYSTEM: You are the planning and memory module for a Minecraft agent.
Your job is NOT to take actions. Your job is to:
1. Analyze recent events and extract lessons
2. Maintain a coherent multi-step plan
3. Build a spatial model of the environment
4. Write concise, actionable output for the action brain

USER:
## Recent History (last 50 ticks)
{compressed_history}

## Current Game State
{inventory, position, health, biome}

## Current Plan (may be stale)
{existing_plan}

## Task
Update the plan and insights. Output JSON only:
{
  "plan": { "goal": "...", "steps": [...], "current_step": N },
  "insights": ["...", "...", "..."],
  "spatial": { "notable_locations": [...], "hazards": [...] },
  "constraints": [],
  "reasoning": "..."
}
```

### 7.5 Injection into Main Brain Prompt

The background state is injected as a compact section in the user message:

```
## Background Brain (updated Ns ago)
Goal: {plan.goal}
Current step: {plan.steps[current_step].action}
Constraints: {constraints[0..2]}
Insights: {insights[0..3]}
Nearby hazards: {spatial.hazards[0..2]}
```

Total: ~200-300 tokens. Does not replace the main brain's own reasoning — it supplements it.

---

## 8. Key Design Decisions Summary

| Decision | Recommendation | Rationale |
|---|---|---|
| Communication medium | JSON file (atomic write) | Simplest, no dependencies, crash-safe |
| Background brain model | 7-14B | Fast enough, sufficient reasoning quality |
| Background interval | 30-60s (or importance trigger) | Avoids GPU contention, still timely |
| Override mechanism | `constraints` field, main brain enforces | No preemption of active actions |
| Memory growth control | Ring buffers, fixed sizes | Prevents unbounded disk/token growth |
| Startup behavior | Bootstrap mode until first background cycle | No cold-start failure |
| GPU contention | Natural timing + vLLM continuous batching | No explicit scheduling needed at this scale |
| Background brain location | Same Node.js process, separate setInterval | Simplest deployment, no new infra |
| Plan format | Structured JSON with step IDs | Main brain can mark steps complete atomically |
| Stale data handling | Accept stale, check timestamp, log warning | Never block main brain on background |

---

## 9. Key Papers and References

- Voyager: https://arxiv.org/abs/2305.16291
- Project Sid / PIANO: https://arxiv.org/abs/2411.00114
- Generative Agents: https://arxiv.org/abs/2304.03442
- Talker-Reasoner: https://arxiv.org/html/2410.08328v1
- DPT-Agent (Dual Process Theory): https://arxiv.org/html/2502.11882
- Parallelized Planning-Acting for Minecraft: https://arxiv.org/html/2503.03505v2
- Neural Brain (neuroscience-inspired): https://arxiv.org/html/2505.07634v1
- Agent.xpu Dual-Queue Scheduling: https://arxiv.org/html/2506.24045v1/
- Memory in the Age of AI Agents survey: https://arxiv.org/abs/2512.13564
- From System 1 to System 2 survey: https://arxiv.org/abs/2502.17419
