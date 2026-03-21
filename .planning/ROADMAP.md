# Roadmap: HermesCraft Life Simulation

## Overview

Transform existing Minecraft AI agents from basic tool-calling bots into full life simulation — agents that build, farm, remember, cooperate, and feel alive.

**Milestone:** v1.0 — Agents that pass the eye test (human observer can't tell they're AI for several minutes)

## Phases

### Phase 1: Building System
**Goal:** Agents can construct real structures that look intentional to a human eye, powered by a three-loop architecture (action/vision/planner) and blueprint-executor pattern.

**Requirements:** BUILD-01, BUILD-02, BUILD-03, BUILD-04

**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md — Foundation: place_at coordinates, blueprint library, 3 starter blueprints
- [x] 01-02-PLAN.md — Vision system: mod screenshot endpoint, agent vision loop
- [x] 01-03-PLAN.md — Blueprint executor engine, build tool integration
- [x] 01-04-PLAN.md — Multi-loop architecture, planner loop, building knowledge

**Deliverables:**
- Blueprint system in agent (common structure templates: house, pen, farm)
- Block palette selection based on available materials
- Multi-step build execution (foundation → walls → roof → door → interior)
- Farm plot construction with tilling and water placement

### Phase 2: Farming & Food Production
**Goal:** Agents sustainably feed themselves through farming, fishing, and animal husbandry.

**Requirements:** FARM-01, FARM-02, FARM-03, FARM-04, FARM-05

**Deliverables:**
- Crop farming cycle (till → plant → wait → harvest → replant)
- Animal breeding mechanics (attract with food, breed, pen management)
- Fishing skill (craft rod, find water, cast, collect)
- Food cooking automation (furnace management)
- Tree replanting for sustainable wood supply

### Phase 3: Deep Memory System
**Goal:** Agents remember everything — places, people, events, conversations — across sessions and reference them naturally.

**Requirements:** MEM-01, MEM-02, MEM-03, MEM-04, MEM-05

**Deliverables:**
- Home base concept (establish, remember, navigate to from anywhere)
- Chest inventory tracking (what's in which chest where)
- Conversation memory with natural recall ("you said yesterday...")
- Autobiographical timeline ("day 1: arrived, day 2: built house")
- Deep relationship model with trust, history, sentiment persistence

### Phase 4: Human-Like Behavior
**Goal:** Agents behave like real people — work/rest cycles, idle actions, needs-driven decisions, social time.

**Requirements:** BEHAV-01, BEHAV-02, BEHAV-03, BEHAV-04

**Deliverables:**
- Day/night behavior engine (work daylight, shelter night)
- Needs system (hunger, safety, social, creative → drive action selection)
- Idle behavior set (look around, organize, wander, sit, stare at view)
- Night socialization (gather near fire, chat, share stories, plan tomorrow)

### Phase 5: Automatic Skill Learning
**Goal:** Agents get better over time without explicit programming — they learn from experience.

**Requirements:** SKILL-01, SKILL-02, SKILL-03

**Deliverables:**
- Experience-based skill creation (successful action sequences → saved skill)
- Background reflection process (periodic memory consolidation, insight generation)
- Death avoidance learning (death context → countermeasure → applied next time)
- Skill effectiveness tracking (which skills actually help vs. don't)

### Phase 6: Cooperation & Exploration
**Goal:** Agents work together as a community and explore the world beyond their base.

**Requirements:** COOP-01, COOP-02, COOP-03, NAV-01, NAV-02, NAV-03

**Deliverables:**
- Task division system (agents announce what they're doing, avoid duplication)
- Resource sharing (drop items for each other, stock shared chests)
- Collective building (agree on project, divide work, build together)
- Exploration with return (venture out, discover, come back, report)
- Location naming and shared map knowledge

## Phase Dependencies

```
Phase 1 (Building) ──→ Phase 4 (Behavior, needs shelter)
Phase 2 (Farming) ──→ Phase 4 (Behavior, needs food system)
Phase 3 (Memory) ──→ Phase 5 (Skills, needs memory to learn)
Phase 3 (Memory) ──→ Phase 6 (Cooperation, needs location memory)
Phase 4 (Behavior) ──→ Phase 6 (Cooperation, needs day/night cycle)
```

**Recommended order:** Phase 1 → 2 → 3 → 4 → 5 → 6

### Phase 7: Audit fixes — double trim bug, wait action, dead deps, missing tests, config drift

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 7 to break down)

---
*Roadmap created: 2026-03-20*
