# Phase 4: Personality + Creative Play - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents feel like real people — they build with style, explore with curiosity, trade with intent, and specialize based on what they're good at. SOUL files enhanced with creative drives. Planner suggests creative projects. Vision evaluates builds aesthetically. Agents explore, name locations, trade surplus, and converse naturally. No meta-game language. 30-minute play session indistinguishable from human players.

</domain>

<decisions>
## Implementation Decisions

### SOUL File Enhancement
- **D-01:** Enhance existing SOUL files (SOUL-jeffrey.md, SOUL-john.md) with structured creative drive sections — not replace them. Current personality text is already excellent; add subsections for `## Creative drives`, `## Aesthetic preferences`, `## Emotional triggers`
- **D-02:** Creative drives define what the agent WANTS to do when idle or between tasks: Jeffrey wants to build structures with views and organize spaces; John wants to create organized workshops and try new things methodically
- **D-03:** Aesthetic preferences give the agent opinions about builds: Jeffrey likes windows, elevation, clean lines; John likes rows, labels, functional beauty
- **D-04:** Emotional triggers define what makes the agent feel something: Jeffrey — flat ground near water (excitement), ugly builds (irritation), discovering resources (old thrill); John — patterns/efficiency (satisfaction), chaos/disorganization (anxiety), teaching moments (pride)
- **D-05:** SOUL files for Alex and Anthony follow the same pattern — creative drives, aesthetic preferences, emotional triggers added to their existing personality text

### Planner Creative Intelligence
- **D-06:** Planner system prompt gets a `CREATIVE_BEHAVIOR` section that reads SOUL creative drives and generates project suggestions based on: current skill levels (from AuraSkills cache), available resources (from inventory), current location, and time since last creative activity
- **D-07:** Creative need score: a simple counter that increments each planner cycle where the agent only did resource gathering. When score > 5 (~2.5 min), planner MUST suggest a creative activity. Resets when agent does something creative (build, explore, trade, decorate)
- **D-08:** Project suggestions are personality-specific: Jeffrey's planner suggests "build a lookout point on that hill" while John's suggests "organize the chests and label them"
- **D-09:** Planner references agent autobiography naturally: "you mentioned wanting a dock earlier" / "you're getting good at woodcutting, maybe build something" — pulls from notepad and skill cache

### Vision-Driven Aesthetic Evaluation
- **D-10:** Vision loop (10s interval) already runs Claude Haiku screenshots. Add a `buildEvaluation` field to vision output that the planner reads. When a structure is nearby, vision evaluates: "this house has no windows" / "the farm rows are crooked" / "there's no path to the base"
- **D-11:** Build evaluation is personality-filtered: Jeffrey notices aesthetics ("needs windows, the proportions are off"), John notices functionality ("no storage area, the water channel isn't reaching all crops")
- **D-12:** Vision evaluation triggers planner action only when the agent is idle or between tasks — never interrupts active work

### Exploration & Discovery
- **D-13:** Agents explore new areas when creative need is high and no immediate resource needs. Exploration = navigate to unexplored coordinates (>100 blocks from any shared location)
- **D-14:** When agents discover something interesting (cave, resource deposit, scenic view), they use /share-location to name it AND mention it in conversation naturally: "Found a cave with iron at the cliffs" not "Shared location cave-iron at 100, 64, -200"
- **D-15:** Discovery names are personality-driven: Jeffrey names things grandly ("The Overlook", "Harbor Point"), John names things practically ("Iron Cave", "Deep Farm Spot")

### Trading & Specialization
- **D-16:** Agents naturally specialize based on AuraSkills levels — the agent with higher Foraging does more woodcutting, higher Mining does more mining. Planner checks skill cache and assigns tasks accordingly
- **D-17:** Trading via QuickShop is proactive: when agent has >32 of a surplus resource and the other agent has been requesting or using that resource, set up a shop. Mention it in chat: "I set up a shop with oak logs if you need any"
- **D-18:** Agents notice what the other agent is doing via shared state and adjust: if Jeffrey is building, John brings materials. If John is farming, Jeffrey checks if the farm needs expansion
- **D-19:** Specialization emerges naturally from play — no hard-coded roles. The SOUL personality just makes certain activities more likely (Jeffrey builds more, John farms more)

### Conversation & Autobiography
- **D-20:** Agents reference their SOUL backstory in conversation when contextually appropriate — not every message. Jeffrey mentions his old life when building something nice ("Reminds me of the house in Fiji"). John mentions his students when teaching something ("I'd explain it like this in class")
- **D-21:** Agents respond to each other's conversation topics with appropriate emotional depth: sympathy, curiosity, humor, deflection. Not robotic "I understand" responses
- **D-22:** No meta-game language EVER: agents never say "baritone", "pathfinding", "LLM", "prompt", "API", "tool call", "action queue", "tick", "planner". They talk about walking, looking, thinking, deciding
- **D-23:** Agents have natural conversation starters for idle moments: observations about the weather/time, commenting on what the other person is doing, wondering about the island, sharing discoveries

### Anti-Meta-Game Enforcement
- **D-24:** System prompt explicitly lists forbidden words: baritone, pathfinding, pathfinder, navigate, mod, plugin, API, endpoint, HTTP, JSON, tool, action, queue, tick, planner, pipeline, loop, LLM, model, prompt, token, context, config, parameter, execute, spawn
- **D-25:** The agent's internal world is: walk, run, look, see, think, decide, remember, plan, build, mine, chop, craft, fish, plant, harvest, cook, eat, trade, sell, buy, explore, discover, talk, chat, rest, sleep
- **D-26:** If the LLM ever produces meta-game language in a Say: line, the planner filters it out before sending to chat

### Claude's Discretion
- Exact creative need score thresholds and decay rates
- Vision buildEvaluation prompt wording for Claude Haiku
- Specific project suggestion templates
- Conversation starter library content
- Emotional response patterns
- Exploration coordinate selection algorithm
- Specialization weighting formula

</decisions>

<canonical_refs>
## Canonical References

### Personality System
- `SOUL-jeffrey.md` — Jeffrey's personality, creative drives already present ("you like control", "opinions about aesthetics")
- `SOUL-john.md` — John's personality, creative drives already present ("you like making things work", "rows straight because math brain")
- `SOUL-alex.md` — Alex's personality
- `SOUL-anthony.md` — Anthony's personality
- `SOUL-minecraft.md` — Base Minecraft persona template

### Agent Architecture (from Phase 2-3)
- `agent/prompt.js` — System prompt builder, GAMEPLAY_INSTRUCTIONS, user message with pluginResponse
- `agent/planner.js` — Planner loop (30s), queue generation, chat sending, skill personality (D-15 from Phase 3)
- `agent/vision.js` — Vision loop with Claude Haiku, screenshot analysis
- `agent/index.js` — Tick loop, _skillCache, _lastCommandResult, shared state
- `agent/shared-state.js` — Agent coordination via coordination.json
- `agent/goals.js` — Phase/goal system, PHASES array
- `agent/social.js` — Social interaction tracking

### Plugin Integration (from Phase 3)
- `agent/tools.js` — 8 plugin tools including share_location, check_skills
- `agent/actions.js` — Action handlers, INFO_ACTIONS
- `agent/command-parser.js` — parseRecentChat, extractSkillLevels
- `agent/servertap.js` — Server state queries

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- SOUL files already have rich personality — just need structured subsections added
- Planner already has skill personality injection from Phase 3 (_skillCache → "Your Woodcutting is level N")
- Vision loop already runs Claude Haiku on screenshots — just needs a buildEvaluation output field
- shared-state.js already coordinates between agents — can share creative activities
- Notepad tool (agent/data/{name}/notepad.txt) persists plans/ideas across ticks

### Established Patterns
- Planner extracts Say: lines for chat — creative conversation works same way
- Queue system for action sequences — creative projects queue multiple build/place actions
- INFO_ACTIONS trigger reactive LLM calls — vision evaluation can trigger the same way
- SOUL file loaded in config.js → injected into system prompt by prompt.js

### Integration Points
- `prompt.js buildSystemPrompt()` — inject CREATIVE_BEHAVIOR section, anti-meta-game word list
- `planner.js` — add creative need scoring, project suggestion logic, autobiography references
- `vision.js` — add buildEvaluation output to vision analysis
- `index.js` — wire creative need counter, vision evaluation → planner
- SOUL files — add structured subsections (non-breaking, existing text preserved)

</code_context>

<specifics>
## Specific Ideas

- Jeffrey and John's SOUL files already have incredible personality depth — the creative drives, aesthetic preferences, and emotional patterns are already there in prose. The enhancement is making the planner actually USE these traits when deciding what to do.
- The creative need score prevents agents from becoming pure resource-gathering machines. After 2.5 minutes of just mining/chopping, the planner HAS to suggest something creative.
- Vision evaluation creates emergent behavior: agent walks by their house, vision says "no windows", planner queues "add windows to the house". This feels very human.
- Discovery naming is personality gold: Jeffrey calling a cliff "The Overlook" vs John calling it "Iron Cave" reveals character through gameplay.
- The anti-meta-game word list is critical for the "can't tell they're bots" success criterion. One slip of "pathfinding" ruins the immersion.

</specifics>

<deferred>
## Deferred Ideas

- More than 2 agents — scale later after personality system proves out
- Nether/End gameplay — overworld focus for this milestone
- Dynamic personality evolution based on experiences — future milestone
- Agent dreams/sleep dialogue — interesting but not essential
- Agent memory of specific conversations for callbacks — would require conversation indexing

</deferred>

---

*Phase: 04-personality-creative-play*
*Context gathered: 2026-03-21 — all decisions at Claude's discretion per user request*
