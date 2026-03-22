# Domain Pitfalls

**Domain:** Autonomous Minecraft life simulation
**Researched:** 2026-03-20

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Asking the LLM to Reason About 3D Coordinates
**What goes wrong:** LLM generates block placement coordinates. Results: floating blocks, asymmetric walls, doors at ceiling height, roofs with gaps.
**Why it happens:** LLMs fundamentally lack spatial reasoning. They can describe a house in text but cannot reliably map descriptions to (x,y,z) coordinates.
**Consequences:** Buildings look broken. Agents appear incompetent. The core promise of "agents that build villages" fails.
**Prevention:** Use blueprint-executor pattern. LLM chooses WHAT to build (creative decision). Procedural code handles WHERE each block goes (spatial execution). Pre-authored blueprints for common structures.
**Detection:** Test building output before shipping. If more than 20% of generated structures have floating blocks or structural gaps, the system is broken.
**Confidence:** HIGH. MineAnyBuild (NeurIPS 2025) benchmarks this exhaustively: GPT-4o scores 41/100.

### Pitfall 2: Unbounded Memory Growth
**What goes wrong:** Memory stores grow without bound. Prompt size explodes. LLM inference slows. Token costs spiral. Eventually, agents lose coherence because important memories are buried under noise.
**Why it happens:** Easy to add memories, hard to decide what to forget. "We'll optimize later" turns into a scaling emergency.
**Consequences:** 5-10x slowdown in agent response time. Key memories (home location, danger zones) lost in noise. Session costs become prohibitive at scale.
**Prevention:** Hard caps on every memory tier from day one. Episodic: 200 events max. Semantic: 30 entries. Skills: 20. Prune by lowest `recency * importance` score when full. Regular garbage collection.
**Detection:** Monitor prompt size per tick. Alert if system prompt exceeds 4000 tokens or total prompt exceeds 8000 tokens.
**Confidence:** HIGH. Every memory-augmented agent system documents this issue.

### Pitfall 3: Over-Coordinated Multi-Agent Behavior
**What goes wrong:** Central planner assigns tasks. Agents execute in lockstep. Communication overhead dominates. Agents fall into "loops of polite agreement."
**Why it happens:** Engineering instinct says coordination = efficiency. Research shows coordination = bottleneck for LLM agents.
**Consequences:** 15% performance drop (Mindcraft 2025). Agents look robotic -- they "agree" too much. No emergent drama or personality clash. The illusion of independent humans breaks.
**Prevention:** NO central coordinator. Agents observe each other and make independent decisions. Personality-driven disagreements are FEATURES. Brief, natural chat -- not detailed plan sharing.
**Detection:** If agents are spending >30% of ticks on coordination chat, they're over-communicating.
**Confidence:** HIGH. Mindcraft 2025 paper explicitly quantifies this: "primary bottleneck is efficient natural language communication."

### Pitfall 4: Ignoring the "Always Purposeful" Tell
**What goes wrong:** Agent never pauses, never does anything "pointless." Every single tick has a productive action. This is the biggest giveaway that something isn't human.
**Why it happens:** Engineers optimize for productivity. The agent loop is designed to always DO something. Empty ticks feel like bugs.
**Consequences:** Observers instantly recognize agents as bots. The core value proposition ("indistinguishable from a real player for several minutes") fails.
**Prevention:** Explicit idle behavior system. When no urgent needs and no active plan: randomly look around, organize inventory, wander, or literally do nothing for a few ticks. Make "doing nothing" a valid action.
**Detection:** Track action diversity over last 20 ticks. If 100% are "productive" actions (mine/craft/build/navigate), inject idle behavior.
**Confidence:** MEDIUM-HIGH. Generative Agents paper identifies this; no MC-specific research quantifies it.

## Moderate Pitfalls

### Pitfall 5: Reflection Without Episodic Memory
**What goes wrong:** Implement reflection system before episodic memory. Agent tries to "reflect" but only has death-focused lessons and phase strategies -- no raw experiences to synthesize.
**Prevention:** Build episodic memory FIRST. Collect 50+ events before enabling reflection. Reflection quality depends on event quality and diversity.

### Pitfall 6: Blueprint Executor Without Inventory Awareness
**What goes wrong:** Agent starts building. Runs out of oak_planks on block 45 of 120. Building left half-finished. Agent doesn't know how to resume.
**Prevention:** Before starting any build, calculate total materials needed. Check inventory. If short, queue gathering subtask. Track placement progress (which blocks are placed, which remain). Support resume-from-checkpoint.

### Pitfall 7: Token-Heavy Needs/Mood System
**What goes wrong:** Needs and mood descriptions consume 200+ tokens per tick. Multiplied across ticks and agents, this is significant overhead for marginal behavioral improvement.
**Prevention:** Keep needs/mood injection to 1-2 lines total: "Needs: hunger=72, safety=90, social=30 | Mood: anxious (6/10)". The LLM extracts behavioral implications from concise data.

### Pitfall 8: Emotional Loops
**What goes wrong:** Agent gets anxious after death. Anxiety causes defensive behavior. Defensive behavior is boring. Boredom rises. Conflicting emotions create indecisive behavior loops.
**Prevention:** Decay ALL emotions toward neutral over time (half-life of ~20 ticks). Cap emotion intensity. Have a "reset to baseline" trigger after sustained inaction.

### Pitfall 9: Social Memory Echo Chamber
**What goes wrong:** Agent has one bad interaction with another player. Trust score drops. Low trust causes hostile behavior. Hostile behavior causes more bad interactions. Trust never recovers.
**Prevention:** Trust decay toward neutral (not zero, neutral -- slightly positive baseline representing "benefit of the doubt"). Positive interactions should have higher weight than negative ones.

### Pitfall 10: Chat Message Spam in Multi-Agent
**What goes wrong:** Multiple agents all detect the same chat message. All respond simultaneously. Creates a wall of AI text in chat that is obviously non-human.
**Prevention:** Already partially handled by chat dedup. Add: random delay before responding (0-3 seconds). Only one agent responds to general messages; direct mentions (@name) always get a response.

## Minor Pitfalls

### Pitfall 11: Skill File Bloat
**What goes wrong:** Skills accumulate without cleanup. Skill selection becomes slow and noisy.
**Prevention:** Cap at 20 skills per agent. Replace lowest success-rate skills when adding new ones.

### Pitfall 12: Day/Night Behavior Too Rigid
**What goes wrong:** Agent ALWAYS goes to shelter at night and ALWAYS works during day. Predictable, robotic.
**Prevention:** Behavior hints should be suggestions, not commands. Some nights the agent should stay out (building by torchlight, adventuring, talking to friends). Personality should influence how strictly day/night is followed.

### Pitfall 13: Building Site Conflicts in Multi-Agent
**What goes wrong:** Two agents decide to build in the same location. Structures overlap or interfere.
**Prevention:** Before building, check nearby blocks for existing structures. If another agent's build is nearby, choose a different site OR chat about it (personality-dependent).

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Building | LLM spatial reasoning failure | Blueprint executor, not LLM coordinate generation |
| Building | Half-finished structures | Inventory pre-check + resume from checkpoint |
| Building | Mod API limitation (`place` has no coordinates) | Need to add `place_at` endpoint to mod |
| Memory | Unbounded growth | Hard caps + scoring-based pruning |
| Memory | Reflection quality | Ensure 50+ episodic events before enabling reflection |
| Behavior | Always-purposeful tell | Explicit idle behavior system |
| Behavior | Emotional loops | Decay toward neutral + intensity caps |
| Farming | Crop timing confusion | LLM doesn't know MC growth rates; use timer/tick count |
| Multi-Agent | Over-communication | Chat limiter (already exists); emergent coordination |
| Multi-Agent | Build site conflicts | Proximity check before building |
| Skill Learning | Skill bloat | Cap at 20; replace lowest success rate |

## Sources

- Spatial reasoning: MineAnyBuild (NeurIPS 2025), T2BM (IEEE CoG 2024)
- Multi-agent coordination: Mindcraft (2025), Project Sid (2024)
- Memory growth: "Memory in the Age of AI Agents" survey (2025)
- Behavioral realism: Generative Agents (Stanford), MineLand (2024)
- Emotional state: Project Sid observations on emotional loops
