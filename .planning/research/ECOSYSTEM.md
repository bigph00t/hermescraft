# Minecraft AI Agent Ecosystem Research

**Domain:** Autonomous Minecraft life simulation agents
**Researched:** 2026-03-20
**Overall confidence:** MEDIUM-HIGH (multi-source verification across papers, repos, benchmarks)

---

## 1. Building Systems

### The State of the Art

Building is the **hardest unsolved problem** in Minecraft AI. Even the best proprietary model (GPT-4o) scores only 41/100 on the MineAnyBuild spatial planning benchmark (NeurIPS 2025). No existing agent builds aesthetically pleasing structures reliably through pure LLM reasoning.

### Approaches in the Ecosystem

#### A. Voyager: Code Generation (No Real Building)
Voyager generates JavaScript code that calls Mineflayer's `placeBlock` API. However, Voyager's skill library is overwhelmingly focused on **resource gathering, crafting, and exploration** -- not building. The auto-curriculum steers toward item acquisition, not construction. Voyager does not build houses.

**Relevance to HermesCraft:** Voyager's skill library pattern (vector DB + code retrieval) is excellent for gathering/crafting but insufficient for building. The code-generation approach is powerful but requires a mineflayer-style API -- HermesCraft uses a Fabric mod with HTTP API instead.

#### B. T2BM: Text-to-Building via Interlayer Representation
The T2BM system (IEEE CoG 2024) takes a text description and produces a JSON "interlayer" encoding of the building -- essentially a blueprint with block coordinates. Three modules:
1. **Input Refining** -- LLM enhances the user's vague description into detailed building specs
2. **Interlayer** -- LLM produces a JSON structure mapping coordinates to block types
3. **Repairing** -- fixes structural inconsistencies (floating blocks, gaps)

Supports facades, indoor scenes, functional blocks (doors, windows). Works with GPT-3.5/GPT-4.

**Relevance to HermesCraft:** HIGH. The interlayer concept maps directly to HermesCraft's needs. The agent's LLM can generate a JSON blueprint, then a procedural executor places blocks coordinate-by-coordinate via the existing `place` and `look_at_block` tools. This separates creative planning from motor execution.

#### C. BuilderGPT / BlockGPT: Schematic Generation
These tools have the LLM generate `.schematic` or `.nbt` files that can be loaded into the world. They work outside the agent loop -- the LLM produces a file, and a mod/plugin imports it.

**Relevance to HermesCraft:** LOW for autonomous agents. Agents should build block-by-block for realism.

#### D. MineAnyBuild: The Benchmark (NeurIPS 2025)
4,000 curated spatial planning tasks. Evaluates four dimensions:
- Spatial understanding (interpreting 3D space from text)
- Spatial reasoning (planning block placement)
- Creativity (aesthetic quality)
- Spatial commonsense (doors on ground floor, roofs on top)

Key finding: **LLMs are terrible at raw coordinate reasoning.** They need structured representations (layer-by-layer, relative positions) rather than absolute coordinate dumps.

#### E. Wave Function Collapse + Procedural Generation
Traditional game AI approach: define tile adjacency rules and let the algorithm fill in valid configurations. Used in GDMC (Generative Design in Minecraft Competition). Not LLM-based but highly reliable for generating architecturally valid structures.

**Relevance to HermesCraft:** MEDIUM. Can be used as a complement -- LLM picks style/type, WFC generates valid layout, agent places blocks.

### Recommended Building Architecture for HermesCraft

**Use a hybrid blueprint-executor approach:**

1. **Blueprint Library (pre-authored + LLM-generated):** Store 5-10 common structures as JSON blueprints (3x5 cabin, watchtower, farm plot, fence perimeter, storage hut). Each blueprint is a list of `{dx, dy, dz, block}` relative to a placement origin. Author the first set manually; later have the LLM generate new ones.

2. **Blueprint Format:**
```json
{
  "name": "small_cabin",
  "size": [5, 4, 7],
  "palette": ["oak_planks", "oak_log", "glass_pane", "oak_door", "oak_stairs"],
  "layers": [
    { "y": 0, "blocks": [{"x":0,"z":0,"block":"oak_log"}, ...] },
    { "y": 1, "blocks": [...] },
    ...
  ]
}
```

3. **Executor System:** A new tool (or enhancement to existing `place` tool) that:
   - Takes a blueprint + world origin coordinate
   - Iterates layer-by-layer, bottom to top
   - For each block: `look_at_block(origin.x+dx, origin.y+dy, origin.z+dz)`, `equip(block)`, `place(block)`
   - Handles failures (missing materials, blocked positions) gracefully
   - Reports progress back to LLM ("placed 45/120 blocks, need 8 more oak_planks")

4. **Material Awareness:** Before building, scan inventory and calculate requirements. If short on materials, queue a gathering subtask. Palette system ensures aesthetic coherence (oak theme, stone theme, etc.).

5. **Site Selection:** LLM chooses build site based on flat terrain detection (scan blocks in a grid area, check for level ground near resources/water).

**Confidence: MEDIUM.** This approach is synthesized from T2BM principles + MineAnyBuild findings + practical Mindcraft patterns. No single project has done exactly this with a Fabric mod HTTP API, but the components are well-understood.

---

## 2. Memory Architectures

### Academic Landscape

Memory is the most actively researched area in LLM agents. The 2025 survey "Memory in the Age of AI Agents" catalogs dozens of memory architectures. The key taxonomy:

| Memory Type | What It Stores | Analog | Duration |
|------------|---------------|--------|----------|
| Working Memory | Current context window | RAM | Seconds-minutes |
| Episodic Memory | Specific events with context | "I remember when..." | Days-weeks |
| Semantic Memory | Facts and knowledge | "I know that..." | Permanent |
| Procedural Memory | Skills and how-tos | "I know how to..." | Permanent |
| Spatial Memory | Locations and maps | Mental map | Permanent |

### Key Systems in the Ecosystem

#### A. Generative Agents (Stanford Smallville)
The gold standard for believable agent memory. Three components:
1. **Memory Stream:** Every observation/action stored with timestamp, natural language description
2. **Retrieval Model:** Scores memories by `recency * importance * relevance` -- weighted combination, not just latest-N
3. **Reflection:** Periodically synthesizes higher-level insights ("I've been spending too much time alone" / "Klaus and I have become friends")

Reflections are stored back in the memory stream as first-class memories, creating hierarchical abstraction.

**Critical insight:** Reflection is what makes agents feel human. Without it, agents just react to stimuli. With it, they develop "opinions" and "personality growth."

#### B. Voyager Skill Library
Stores executable JavaScript functions indexed by description embeddings in a vector database. When encountering a similar situation, retrieves relevant skills by semantic similarity.

**Pattern:** Code-as-memory. The agent doesn't remember "how" -- it remembers "code that worked."

#### C. GITM (Ghost in the Minecraft)
Text-based knowledge and memory. Uses a hierarchical decomposition where knowledge is stored as text descriptions at different levels of abstraction. Memory includes both factual knowledge (recipes, mob behavior) and experiential knowledge (what worked/failed).

#### D. Optimus-1 (NeurIPS 2024)
Hybrid Multimodal Memory with two stores:
1. **Hierarchical Directed Knowledge Graph (HDKG):** Explicit world knowledge as a graph
2. **Abstracted Multimodal Experience Pool (AMEP):** Past experiences distilled into reusable patterns

The Knowledge-Guided Planner retrieves from HDKG for task decomposition; the Experience-Driven Reflector retrieves from AMEP for in-context learning. Achieves 2-6x improvement over GPT-4V baseline.

#### E. MrSteve: Place Event Memory (2024)
Addresses STEVE-1's critical limitation. PEM captures **what, where, and when** for each episode. This "episodic" memory solves the problem of agents repeating failed actions or forgetting what they've already explored.

#### F. AriGraph (IJCAI 2025)
Knowledge graph extended with episodic vertices and edges. Learns during interaction: adds episodic vertices with full observations, extracts semantic relationships as triplets, connects through episodic edges. Significantly improves agent performance in text-based games.

### Recommended Memory Architecture for HermesCraft

**Current state:** HermesCraft has L1 (conversation history), L2 (MEMORY.md with lessons/strategies/worldKnowledge), L3 (session JSONL logs), L4 (skills). This is a solid foundation but missing key components.

**Recommended additions:**

1. **Episodic Memory (MEM-04: Autobiographical):**
   - Store events as `{timestamp, gameDay, type, description, location, entities, importance}`
   - Importance scored by: death=10, build_complete=8, new_player_met=7, found_resource=5, routine_action=1
   - Retrieval: `relevance(query) * recency_decay(age) * importance`
   - Cap at ~200 events, prune lowest-scoring when full
   - Format: JSONL file in data dir, loaded into prompt as "Recent memories" (top 5-10 by relevance score)

2. **Reflection System (REFL-01, REFL-02):**
   - Trigger: Every N ticks (configurable, ~50-100) OR when idle at night
   - Process: Feed recent episodic memories to LLM with prompt "What patterns do you notice? What have you learned? How do you feel about recent events?"
   - Store reflections in semantic memory (separate from lessons which are death-focused)
   - These reflections become part of the agent's evolving personality

3. **Spatial Memory (NAV-01 through NAV-04):**
   - Already have `locations.js` -- extend with:
   - Named locations with semantic labels ("my house", "the iron cave", "Jeffrey's farm")
   - Path memory: record successful routes between named locations
   - Danger zones: locations associated with deaths
   - Resource zones: locations where specific resources were found

4. **Relationship Memory (MEM-03):**
   - Already have `social.js` -- extend with:
   - Per-entity trust score: +1 for gifts/help, -1 for harm/theft, decays toward neutral
   - Conversation log: last 5 notable exchanges per entity
   - Emotional associations: "Jeffrey gave me food when I was starving" stored as episodic+semantic

**Implementation priority:** Episodic > Spatial > Reflection > Relationship (each builds on the previous)

**Confidence: HIGH.** The memory taxonomy is well-established across multiple papers. The specific implementation is adapted from Smallville + Voyager + existing HermesCraft code.

---

## 3. Multi-Agent Coordination

### Ecosystem Survey

#### A. Project Sid (Altera, 2024)
1,000 agents in Minecraft. Key findings:
- **Emergent specialization:** Agents naturally divided into farmers, builders, miners, guards
- **Social norms emerged:** Agents developed rules, enforced behavior, spread cultural ideas
- **Failure mode:** Groups falling into "loops of polite agreement" or chasing unattainable goals
- **Communication bottleneck:** Natural language coordination is expensive and error-prone
- **PIANO architecture:** Concurrent modules (cognition, planning, motor, speech, social) with a Cognitive Controller for coherence

#### B. VillagerAgent (ACL 2024)
Graph-based multi-agent coordination using Directed Acyclic Graphs (DAGs):
- **Task Decomposer:** Creates DAG of subtasks with dependency edges
- **Agent Controller:** Assigns subtasks to agents based on capabilities/proximity
- **State Manager:** Tracks environment and agent states
- Outperforms AgentVerse by reducing hallucinations and improving task decomposition
- Key benchmark: Construction Cooperation task

#### C. Mindcraft (2025)
Multi-agent LLM framework. Research finding: **"The primary bottleneck in collaborating effectively is efficient natural language communication."** Performance drops 15% when agents must communicate detailed plans. This is critical -- over-communication is worse than under-communication.

#### D. MineLand (2024)
48-agent simulator with physical needs. The Alex framework uses multitasking theory:
- **Priority-based attention:** Hurt events override chat events override work tasks
- **Working memory:** Maintains context across task switches
- **Limited senses:** Agents can't see/hear everything -- must actively communicate to compensate
- Finding: Physical needs (hunger, shelter) actually improved cooperation quality

#### E. TeamCraft (UCLA, 2025)
Benchmark for multi-agent embodied AI. Supports centralized and decentralized control.

### Recommended Multi-Agent Architecture for HermesCraft

**Current state:** Multi-agent support exists (unique ports, personalities, data dirs) but no coordination mechanism.

**Recommended approach:**

1. **Shared World State (not shared planning):**
   - Agents should NOT have a central coordinator -- that breaks the illusion of independent humans
   - Instead, agents perceive each other through game state (nearbyEntities) and chat
   - Each agent maintains its own model of what others are doing, based on observation

2. **Implicit Coordination via Chat:**
   - Agents communicate plans through in-game chat: "I'm going to build a house near the beach"
   - Other agents incorporate this into their planning: "Jeffrey is building there, I'll build elsewhere"
   - Disagreements emerge naturally from personality (greedy character might build right next to them)

3. **Shared Resource Awareness:**
   - A lightweight shared file or endpoint that records community resources:
     - Chest locations and rough contents
     - Farm locations
     - Crafting station locations
   - Each agent can read this; updates are written by whoever interacts with the resource

4. **Avoid over-coordination traps:**
   - Don't implement explicit task assignment (unnatural)
   - Don't implement shared planning databases (agents should disagree)
   - Do implement personality-driven responses to others' actions
   - Do implement basic norms (don't steal, help when asked) as SOUL file content

5. **Conflict is a feature:**
   - If two agents want the same resource, let them argue about it in chat
   - If personalities clash, let drama emerge
   - The SOUL files already handle this -- just ensure the LLM prompt surfaces nearby players and their recent actions

**Confidence: MEDIUM.** Multi-agent coordination in LLM-based systems is still immature. The 2025 Mindcraft research explicitly shows that current LLMs are "ill-optimized for multi-agent collaboration." The recommendation here is to lean into emergent behavior rather than engineered coordination, which aligns with HermesCraft's philosophy of believable simulation.

---

## 4. Behavior Modeling (Human-Likeness)

### What Makes Agents Feel Human?

The Stanford Generative Agents paper provides the clearest answer: **daily routines + memory-informed planning + reactive interruptions + reflection.**

Key insight from the research: Crowdworkers rated generative agents as MORE believable than humans pretending to be the agents. The architecture's planning and reflection components were each independently critical -- removing either one significantly reduced believability scores.

### Behavior Components from the Ecosystem

#### A. Daily Schedule (Generative Agents)
Agents create a daily plan on "waking up":
- High-level plan: "Today I want to gather wood, work on my house, and check on my farm"
- Breaks down into hourly activities
- Plans are re-evaluated on interruption (player arrives, night falls, danger)

#### B. Needs System (MineLand)
MineLand's physical needs system found that **hunger and shelter needs improved agent behavior quality**:
- Agents with physical needs exhibited longer survival times
- Needs forced realistic priority shifts (stop building, go eat)
- Mirrors Maslow's hierarchy: survival > safety > social > creative

#### C. Emotional State (Project Sid)
Project Sid agents tracked emotional fluctuations:
- Agents responded differently to stimuli based on emotional state
- Social interactions affected emotional state (being helped = positive, being ignored = negative)
- Emotional state influenced decision-making (happy agents were more generous)
- Challenge: agents sometimes got stuck in emotional loops

#### D. Idle Behavior
The biggest giveaway that an agent isn't human is **constant purposeful action**. Humans:
- Pause and look around
- Organize inventory
- Walk to a vantage point and look at the sunset
- Stand near other players without purpose
- Jump around randomly
- Place/break blocks idly

### Recommended Behavior System for HermesCraft

**Current state:** HermesCraft has embodied identity prompting ("You woke up on a small island. This is real.") and SOUL personality files. No explicit behavior scheduling.

**Recommended implementation:**

1. **Day/Night Cycle Behavior (BEHAV-01):**
   - Inject game time awareness into every prompt (already done via state)
   - Add a time-based behavioral hint to the system prompt:
     - Time 0-6000 (dawn-noon): "Morning. Good time to work on projects."
     - Time 6000-12000 (noon-dusk): "Afternoon. Finish tasks, prepare for night."
     - Time 12000-13000 (dusk): "Getting dark. Find shelter soon."
     - Time 13000-24000 (night): "Night. Stay safe. Good time to socialize, organize, reflect."
   - Do NOT hard-code behavior -- let the LLM decide, but nudge it

2. **Needs System (BEHAV-03):**
   - Track three needs as floating-point scores (0-100):
     - **Hunger:** Decreases over time, increases when eating. Low hunger = irritable, prioritize food
     - **Safety:** High when sheltered + armed + day. Low when exposed + night + low health
     - **Social:** Decreases when alone, increases when chatting/near players
   - Inject current needs into prompt: "Needs: hunger=72 (peckish), safety=90 (secure), social=30 (lonely)"
   - The LLM will naturally adjust behavior based on needs

3. **Emotional State (BEHAV-02):**
   - Simple emotion tracking: {mood: "content"|"anxious"|"excited"|"bored"|"angry", intensity: 0-10}
   - Events shift emotion: death=anxious+8, successful_build=excited+5, long_idle=bored+3, player_chat=varies
   - Decay toward neutral over time
   - Inject into prompt: "Mood: anxious (intensity 6) -- you died recently and it rattled you"

4. **Idle Behavior (BEHAV-04):**
   - When no urgent needs and no active task plan:
     - 30% chance: look around (look at random nearby block/entity)
     - 20% chance: organize inventory
     - 20% chance: wander to a nearby interesting location
     - 15% chance: chat with nearby player if present
     - 10% chance: start a new creative project
     - 5% chance: do nothing (just stand there for a few ticks)
   - Implement as a "boredom counter" -- if no meaningful action for 5+ ticks, inject idle hint

5. **Personality-Driven Behavior (DRAMA-01, DRAMA-02):**
   - Already handled by SOUL files -- but ensure the SOUL content is injected when making behavioral decisions
   - A greedy character should hoard resources; a generous one should offer help
   - Personality should influence HOW needs are met, not WHAT needs exist

**Confidence: HIGH for the approach, MEDIUM for specific implementations.** The Generative Agents paper strongly validates this architectural pattern. The specific numbers (decay rates, thresholds, probability distributions) will need tuning through observation.

---

## 5. Skill Learning

### Ecosystem Approaches

#### A. Voyager: Code-as-Skill Library
- Skills are JavaScript functions stored in a vector database
- Indexed by description embedding for semantic retrieval
- Self-verifying: agent tests skill success, only stores verified skills
- Composition: complex skills call simpler skills
- Transfer: skills learned in one world work in new worlds

**Key numbers:** Voyager achieves 3.3x more unique items, 2.3x longer distances, 15.3x faster tech tree progression vs. prior SOTA.

#### B. GITM: Hierarchical Decomposition
- LLM Decomposer breaks goals into sub-goals
- LLM Planner converts sub-goals into structured actions
- LLM Interface maps actions to keyboard/mouse operations
- 100% of Overworld tech tree items achievable (vs. 30% for all other agents combined)
- No GPU training needed -- runs on CPU with LLM API calls

#### C. Optimus-1: Knowledge-Guided Planning
- Knowledge graph stores world rules and relationships
- Experience pool stores past successful strategies
- Planner retrieves relevant knowledge before decomposing tasks
- Reflector periodically reviews and consolidates experiences

#### D. HermesCraft Current: Phase-Based Skill Creation
- Skills created from phase completions (SKILL.md files with YAML frontmatter)
- Multi-signal skill selection (phase match, keyword matching, game state context)
- Skill success rate tracking and incremental update
- Seed skills for common activities

### Recommended Skill Learning Architecture

**Current state:** HermesCraft's skill system is solid but passive -- skills are only created on phase completion, not from general experience.

**Recommended enhancements:**

1. **Experience-Based Skill Creation (SKILL-01):**
   - Track action sequences that lead to successful outcomes
   - When an agent successfully completes a novel task (builds something, finds a resource, survives a fight):
     - Extract the action sequence
     - Have the LLM summarize it as a named skill
     - Store with success conditions and context
   - Trigger: "You just did something new and it worked. Summarize what you did as a reusable strategy."

2. **Skill Retrieval Enhancement:**
   - Current keyword-based matching is adequate for phase-based play
   - For open-ended play, add embedding-based retrieval:
     - Use a lightweight embedding model (or even TF-IDF on skill descriptions)
     - Query with current game state + goal text
     - Return top-3 relevant skills instead of just top-1
   - This enables cross-domain skill transfer (mining technique useful for building, etc.)

3. **Skill Refinement:**
   - Track skill outcomes over time (already done via success_rate)
   - When a skill fails repeatedly, trigger refinement:
     - Feed the skill + recent failures to LLM
     - Ask for updated strategy
     - Overwrite the skill body with improved version
   - This creates genuine self-improvement

4. **Skill Sharing Between Agents (SKILL-02):**
   - Agents with high success rates on a skill can "teach" others
   - Implementation: shared skills directory readable by all agents
   - When Agent A masters a skill, it gets copied to a shared location
   - Agent B can discover and adopt it
   - In-game: manifests as agents sharing tips via chat ("I found that using a shield helps against skeletons")

5. **Curriculum System (Voyager-inspired):**
   - Instead of Voyager's fully automatic curriculum, use a "curiosity nudge":
   - Track what the agent has NOT done before
   - Periodically inject: "You haven't tried [fishing/exploring the cave/building with stone] yet. Maybe today's a good day for something new?"
   - This prevents agents from falling into repetitive loops without feeling forced

**Confidence: HIGH for the approach.** Voyager's skill library is the most validated component in the MC AI literature. The adaptation to HermesCraft's non-mineflayer architecture (text skills instead of code skills) is straightforward since the existing SKILL.md system is already well-structured.

---

## 6. Cross-Cutting Findings

### Key Patterns Across All Systems

1. **LLMs are bad at raw spatial reasoning.** Every successful building system uses structured intermediate representations (blueprints, layer encodings, coordinate lists) rather than asking the LLM to reason about 3D coordinates directly.

2. **Reflection makes agents believable.** The single most impactful component for human-likeness, validated across Smallville, Project Sid, and Optimus-1.

3. **Physical needs improve agent quality.** MineLand found that agents with hunger/shelter needs were more realistic and survived longer. This counter-intuitive finding suggests that constraints drive better behavior.

4. **Over-communication kills multi-agent performance.** Mindcraft 2025 shows 15% performance drop when agents must communicate detailed plans. Less is more -- agents should coordinate implicitly through observation and brief chat.

5. **Skills should be compositional.** Voyager's key insight: complex behaviors should be built from simpler building blocks, not written from scratch each time.

6. **Token efficiency matters.** With 2-5s tick intervals and context windows, every token in the prompt must earn its place. Memory summarization and progressive disclosure are essential.

### What HermesCraft Already Gets Right

- **Embodied identity prompting** ("You are alive, this is your body") aligns with best practices
- **SOUL personality files** are a cleaner version of what Project Sid implemented
- **Multi-level memory** (L1-L4) matches the academic taxonomy
- **Pipelining** (pre-think during sustained actions) is a novel optimization not found in papers
- **Thin mod + fat agent** architecture is the standard approach (Mindcraft, Voyager)
- **Pinned context documents** solve the memory wipe problem elegantly

### What HermesCraft Is Missing

| Gap | Priority | Difficulty | Reference System |
|-----|----------|------------|-----------------|
| Blueprint-based building | HIGH | MEDIUM | T2BM, MineAnyBuild |
| Reflection/consolidation | HIGH | LOW | Smallville |
| Episodic memory | HIGH | MEDIUM | MrSteve, AriGraph |
| Needs system | MEDIUM | LOW | MineLand |
| Day/night behavior hints | MEDIUM | LOW | Smallville |
| Idle behavior | MEDIUM | LOW | Original design |
| Emotional state tracking | MEDIUM | LOW | Project Sid |
| Implicit multi-agent coordination | LOW | LOW | Already partially done |
| Skill sharing between agents | LOW | LOW | Voyager, custom |
| Curiosity-driven exploration | LOW | LOW | Voyager curriculum |

---

## 7. Roadmap Implications

### Suggested Phase Structure

1. **Phase 1: Building System** (BUILD-01 through BUILD-03)
   - Highest impact feature gap
   - Blueprint library + executor + material awareness
   - Enables the core "village building" vision
   - Dependencies: existing place/look_at_block tools

2. **Phase 2: Memory Deepening** (MEM-01 through MEM-04)
   - Episodic memory + spatial memory
   - Enables agents to "remember where home is" and "recall past events"
   - Dependencies: existing memory.js + locations.js

3. **Phase 3: Behavior Realism** (BEHAV-01 through BEHAV-04)
   - Day/night hints + needs system + idle behavior
   - Makes agents pass the "is this a human?" test for longer
   - Dependencies: memory system (needs to remember home location)

4. **Phase 4: Reflection System** (REFL-01, REFL-02)
   - Night-time reflection + memory consolidation
   - Creates personality evolution over time
   - Dependencies: episodic memory (needs events to reflect on)

5. **Phase 5: Farming** (FARM-01 through FARM-04)
   - Crop farming + animal farming + tree farming
   - Provides renewable resources for building
   - Dependencies: building system (farm structures), spatial memory (farm locations)

6. **Phase 6: Multi-Agent Social** (COOP-01 through COOP-03, DRAMA-01, DRAMA-02)
   - Implicit coordination + conflict emergence
   - Dependencies: all previous systems (agents need to build, remember, behave realistically)

7. **Phase 7: Skill Learning Enhancement** (SKILL-01, SKILL-02)
   - Experience-based skill creation + skill sharing
   - Dependencies: stable agent behavior to generate meaningful skills

### Phase Ordering Rationale

- Building before memory: agents need to DO things before they can REMEMBER doing them
- Memory before behavior: realistic behavior requires remembering past context
- Behavior before reflection: reflection needs behavioral patterns to reflect ON
- Farming after building: farms need structures (fences, water channels)
- Multi-agent after individual: each agent must be believable alone first
- Skill learning last: needs all other systems producing data to learn from

### Research Flags

- **Phase 1 (Building):** Will need iterative testing of blueprint execution via the HTTP API. The `place` tool currently takes only an item name, not coordinates -- likely needs a `place_at` enhancement in the mod.
- **Phase 3 (Behavior):** Needs tuning of decay rates, thresholds, probability distributions. Expect 2-3 iterations.
- **Phase 6 (Multi-Agent):** Most uncertain. Current LLMs are "ill-optimized for multi-agent collaboration" (Mindcraft 2025). Expect emergent issues.

---

## Sources

### Papers and Primary Sources
- [Voyager: An Open-Ended Embodied Agent with LLMs](https://voyager.minedojo.org/) - Skill library, auto-curriculum, code generation
- [GITM: Ghost in the Minecraft](https://github.com/OpenGVLab/GITM) - Hierarchical decomposition, 100% tech tree
- [Project Sid: Many-agent simulations toward AI civilization](https://arxiv.org/html/2411.00114v1) - PIANO architecture, 1000-agent civilization
- [Generative Agents: Interactive Simulacra of Human Behavior](https://dl.acm.org/doi/10.1145/3586183.3606763) - Memory stream, reflection, planning
- [T2BM: 3D Building Generation in Minecraft via LLMs](https://arxiv.org/html/2406.08751v1) - Blueprint interlayer encoding
- [MineAnyBuild: Benchmarking Spatial Planning](https://arxiv.org/abs/2505.20148) - NeurIPS 2025, spatial reasoning benchmark
- [Mindcraft: Collaborating Action by Action](https://arxiv.org/abs/2504.17950) - Multi-agent LLM framework, communication bottleneck
- [VillagerAgent: Graph-Based Multi-Agent Framework](https://aclanthology.org/2024.findings-acl.964/) - DAG task decomposition
- [MineLand: Multi-Agent Interactions with Physical Needs](https://arxiv.org/html/2403.19267v1) - Alex framework, needs system
- [Optimus-1: Hybrid Multimodal Memory](https://arxiv.org/abs/2408.03615) - NeurIPS 2024, knowledge graph + experience pool
- [MrSteve: What-Where-When Memory](https://arxiv.org/abs/2411.06736) - Place Event Memory for episodic recall
- [AriGraph: Knowledge Graph with Episodic Memory](https://www.ijcai.org/proceedings/2025/0002.pdf) - IJCAI 2025

### Repositories
- [Voyager GitHub](https://github.com/MineDojo/Voyager)
- [Mindcraft GitHub](https://github.com/mindcraft-bots/mindcraft)
- [Mindcraft CE (Community Edition)](https://github.com/mindcraft-ce/mindcraft-ce)
- [Project Sid GitHub](https://github.com/altera-al/project-sid)
- [VillagerAgent GitHub](https://github.com/cnsdqd-dyb/VillagerAgent)
- [MineLand GitHub](https://github.com/cocacola-lab/MineLand)
- [BuilderGPT GitHub](https://github.com/CyniaAI/BuilderGPT)
- [Co-Voyager (Multi-agent Voyager)](https://github.com/Itakello/Co-voyager)

### Surveys
- [Memory in the Age of AI Agents (Survey)](https://arxiv.org/abs/2512.13564)
- [Agent Memory Paper List](https://github.com/Shichun-Liu/Agent-Memory-Paper-List)
- [Memory Mechanisms in LLM Agents](https://www.emergentmind.com/topics/memory-mechanisms-in-llm-based-agents)
