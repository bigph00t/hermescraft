# Feature Landscape

**Domain:** Autonomous Minecraft life simulation
**Researched:** 2026-03-20

## Table Stakes

Features users expect from "AI agents that live in Minecraft like real people." Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Build structures | Core Minecraft activity; agents without homes look wrong | HIGH | Blueprint executor system needed |
| Remember locations | Humans remember where they live | MEDIUM | Extend existing locations.js |
| Day/night behavior | Humans sleep/shelter at night | LOW | Prompt injection based on game time |
| Eat when hungry | Basic survival; already partially implemented | LOW | Just needs better prompting |
| Chat naturally | Current implementation works | DONE | Already implemented |
| Gather resources | Already implemented via mine/craft tools | DONE | Already implemented |
| Have personality | SOUL files already handle this | DONE | Already implemented |
| React to danger | Already partially implemented (death avoidance) | DONE | Could use improvement |

## Differentiators

Features that set HermesCraft apart from other MC AI projects. Not expected, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Reflection/dream system | Agents develop and change over time -- no other project does this at runtime | MEDIUM | Night-time LLM reflection call |
| Needs-driven behavior | Hunger/safety/social needs drive realistic priority shifts (MineLand validated) | LOW | Score tracking + prompt injection |
| Emotional state | Mood affects decisions -- anxious agents act cautious, bored agents explore | LOW | State machine + prompt injection |
| Idle behavior | Humans pause, look around, do "nothing" -- most bots never stop | LOW | Randomized idle actions when no task |
| Autobiographical memory | "I built that house on day 2" -- agents tell their own story | MEDIUM | Episodic event store with retrieval |
| Multi-agent drama | Conflicts emerge from personality clashes, resource competition | MEDIUM | Personality + shared world + chat |
| Aesthetic building | Agents choose materials that look good together, not random blocks | LOW | Palette system in blueprints |
| Skill sharing via chat | Agent teaches another: "use a shield against skeletons" | LOW | Shared skill directory + chat trigger |
| Persistent world knowledge | Chest contents, farm locations, danger zones tracked across sessions | MEDIUM | Extend existing memory system |

## Anti-Features

Features to explicitly NOT build. Each was considered and rejected for specific reasons.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Central task coordinator | Breaks human illusion -- real people don't have a boss assigning tasks | Emergent coordination via chat and observation |
| Shared planning database | Agents should disagree and have different information | Each agent maintains own world model |
| Explicit team formation | Humans don't formally "form teams" on a survival island | Let cooperation emerge from personality and need |
| Hardcoded building rules | Kills creativity and feels robotic | Blueprint library with LLM selection |
| Perfect memory | Humans forget things | Memory scoring with decay; prune low-importance events |
| Combat optimization | This is a life sim, not a PvP bot | Reactive combat only (flee or fight based on personality) |
| Redstone/automation | Too complex, low visual impact for observers | Focus on visible building and farming |
| Nether/End progression | Out of scope for island survival theme | Keep to overworld activities |

## Feature Dependencies

```
Building System
  -> Spatial Memory (remember where you built)
  -> Material Awareness (know what you have)
  -> Site Selection (find flat ground)

Episodic Memory
  -> Reflection System (needs events to reflect on)
  -> Autobiographical Memory (depends on stored episodes)
  -> Relationship Depth (remember past interactions)

Needs System
  -> Day/Night Behavior (safety need spikes at night)
  -> Emotional State (unmet needs affect mood)
  -> Idle Behavior (when all needs met, agent can idle)

Farming
  -> Building System (farm structures: fences, water channels)
  -> Spatial Memory (remember farm locations)
  -> Patience/Planning (wait for crop growth)

Multi-Agent Coordination
  -> Chat System (communication channel) [DONE]
  -> Social Memory (remember who did what) [PARTIAL]
  -> Personality System (how agents react) [DONE]
  -> Building System (collaborative building)
```

## MVP Recommendation

Prioritize for maximum "wow factor" with minimum effort:

1. **Blueprint-based building** (TABLE STAKES, HIGH impact) -- single biggest gap
2. **Day/night behavior hints** (TABLE STAKES, LOW effort) -- just prompt changes
3. **Needs system** (DIFFERENTIATOR, LOW effort) -- score tracking + prompt injection
4. **Episodic memory** (DIFFERENTIATOR, MEDIUM effort) -- event store + retrieval
5. **Idle behavior** (DIFFERENTIATOR, LOW effort) -- randomized idle actions

Defer:
- **Reflection system:** Valuable but needs episodic memory first. Phase 4.
- **Multi-agent coordination:** Each agent must be individually believable first. Phase 6.
- **Skill sharing:** Nice-to-have; current per-agent skills work fine. Phase 7.
- **Farming:** Functional but not as visually impressive as building. Phase 5.

## Sources

- Feature gap analysis from PROJECT.md requirements
- Priority informed by Generative Agents (believability), MineLand (needs), MineAnyBuild (building difficulty)
- Anti-features informed by Mindcraft 2025 (communication bottleneck), Project Sid (coordination loops)
