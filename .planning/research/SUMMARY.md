# Research Summary: HermesCraft Autonomous Life Simulation

**Domain:** Autonomous Minecraft AI agents that live like humans
**Researched:** 2026-03-20
**Overall confidence:** MEDIUM-HIGH

## Executive Summary

The Minecraft AI agent ecosystem is dense and rapidly evolving, with major contributions from Voyager (skill learning), GITM (hierarchical planning), Project Sid (1000-agent civilization), Stanford's Generative Agents (believable behavior), and several 2024-2025 papers on memory, building, and multi-agent coordination.

HermesCraft's existing architecture is well-positioned. The observe-think-act loop with tool calling, multi-level memory, SOUL personality files, and pipelining are all aligned with or ahead of the research ecosystem. The major gaps are: (1) building systems, which require a blueprint-executor approach because LLMs cannot reason about 3D coordinates reliably; (2) memory depth, particularly episodic memory and reflection systems that make agents develop over time; and (3) behavior scheduling with needs-driven decision making to pass the human-likeness test.

The most surprising finding is that building is the hardest problem -- even GPT-4o scores only 41/100 on spatial planning benchmarks (MineAnyBuild, NeurIPS 2025). No existing agent builds aesthetically pleasing structures through pure LLM reasoning. The recommended approach is a hybrid system: pre-authored JSON blueprints executed procedurally, with LLM selecting style, site, and managing the process. This separates the creative decision (which LLMs are good at) from spatial execution (which they aren't).

The second major finding is that reflection -- the ability to synthesize memories into higher-level insights -- is the single most impactful component for making agents feel human, validated across three independent research programs (Stanford, Project Sid, Optimus-1).

## Key Findings

**Stack:** Existing Node.js + Fabric mod + HTTP API architecture is the right pattern. No changes needed.
**Architecture:** Add blueprint executor for building, episodic memory store, reflection system, and needs tracker.
**Critical pitfall:** LLMs cannot do raw spatial reasoning. Building MUST use structured blueprints, not coordinate-level LLM planning.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Building System** - Highest impact gap; enables the core village vision
   - Addresses: BUILD-01, BUILD-02, BUILD-03
   - Avoids: LLM spatial reasoning pitfall via blueprint-executor separation

2. **Memory Deepening** - Foundation for all behavioral realism
   - Addresses: MEM-01, MEM-02, MEM-03, MEM-04
   - Avoids: Shallow agent behavior from lack of context

3. **Behavior Realism** - Pass the "is this human?" test
   - Addresses: BEHAV-01, BEHAV-02, BEHAV-03, BEHAV-04
   - Avoids: Constant purposeful action (the biggest NPC giveaway)

4. **Reflection System** - Personality evolution over time
   - Addresses: REFL-01, REFL-02
   - Avoids: Static personalities that never grow

5. **Farming** - Renewable resource loops
   - Addresses: FARM-01 through FARM-04

6. **Multi-Agent Social** - Coordination and drama
   - Addresses: COOP-01 through COOP-03, DRAMA-01, DRAMA-02

7. **Skill Learning Enhancement** - Self-improvement
   - Addresses: SKILL-01, SKILL-02

**Phase ordering rationale:**
- Build before remember: agents need activities to remember
- Remember before behave: realistic behavior requires past context
- Behave before reflect: reflection needs behavioral patterns
- Individual before social: each agent must be believable alone first

**Research flags for phases:**
- Phase 1 (Building): Needs mod enhancement (place_at tool with coordinates). Blueprint format needs iteration.
- Phase 3 (Behavior): Tuning-heavy. Expect 2-3 iterations on decay rates and thresholds.
- Phase 6 (Multi-Agent): Most uncertain. LLMs are "ill-optimized for collaboration" per 2025 Mindcraft research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Building | MEDIUM | T2BM + MineAnyBuild validate approach, but no one has done this with Fabric mod HTTP API |
| Memory | HIGH | Well-established taxonomy across 5+ papers, clear implementation path |
| Behavior | HIGH | Generative Agents paper is definitive; implementation is straightforward |
| Multi-Agent | MEDIUM | Active research area, known bottlenecks, emergent approach is safest |
| Skill Learning | HIGH | Voyager's skill library is the most validated MC AI component |

## Gaps to Address

- **Vision system (VIS-01):** Not researched in depth. Would dramatically improve spatial awareness for building. Needs separate research.
- **Place_at tool:** Current `place` tool doesn't accept coordinates. Mod needs enhancement for building system.
- **Embedding model for skill retrieval:** Current keyword matching works for phased play; open-ended play needs semantic retrieval.
- **Performance at scale:** How many agents can run simultaneously with 2-5s tick intervals? Needs empirical testing.
