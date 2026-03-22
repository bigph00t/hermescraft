# Technology Stack

**Project:** HermesCraft
**Researched:** 2026-03-20

## Current Stack (Validated -- No Changes Needed)

### Core Architecture
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 20+ | Agent harness | Fast, async, matches ecosystem (Voyager/Mindcraft use JS) |
| Fabric Mod (Java) | 1.21.1 | Game client with HTTP API | Real client rendering, Baritone integration, actual game mechanics |
| Baritone | 1.11.2 | Pathfinding and mining | Industry standard for MC bot navigation |
| MiniMax M2.7 | - | LLM for all agents | 100 tps, vision capable, cheap at scale |

### Infrastructure
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker | - | MC server | Isolation, reproducibility |
| Xvfb | - | Headless rendering | Run clients without display |
| HeadlessMC | - | Client launcher | Headless MC client management |

### Agent Architecture
| Component | File | Purpose |
|-----------|------|---------|
| Observe-Think-Act Loop | index.js | Core agent lifecycle |
| Tool Calling | llm.js + tools.js | LLM-driven action selection |
| Memory System | memory.js | L1-L4 memory hierarchy |
| Skill System | skills.js | Procedural memory (SKILL.md files) |
| Social System | social.js | Player relationship tracking |
| Spatial System | locations.js | Named location memory |
| Prompt Builder | prompt.js | Context-efficient prompt construction |
| Action Executor | actions.js | HTTP API calls to mod |

## Additions Needed for New Features

### Building System
| Technology | Purpose | Why |
|------------|---------|-----|
| JSON blueprint format | Structure definitions | LLMs can generate/parse JSON; layer-by-layer is spatially natural |
| Blueprint executor (new JS module) | Procedural block placement | Separates creative planning from motor execution |
| `place_at` mod endpoint | Coordinate-targeted placement | Current `place` tool doesn't accept coordinates |

### Memory Enhancement
| Technology | Purpose | Why |
|------------|---------|-----|
| JSONL event store | Episodic memory | Append-only, fast reads, simple format |
| Relevance scoring function | Memory retrieval | recency * importance * relevance (Smallville pattern) |
| Reflection prompt template | Memory consolidation | Periodic LLM call to synthesize insights |

### Behavior System
| Technology | Purpose | Why |
|------------|---------|-----|
| Needs tracker (in-memory + JSON) | Hunger/safety/social scores | Drives behavioral priority shifts |
| Emotion state machine | Mood tracking | Events shift mood, mood decays toward neutral |
| Idle behavior randomizer | Human-like pauses | Prevents the "always purposeful" NPC tell |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Bot framework | Fabric mod | Mineflayer | Already built; Fabric gives real client rendering, Baritone |
| Agent framework | Custom harness | Mindcraft | Custom is leaner, no mineflayer dependency, already working |
| Skill format | SKILL.md (text) | Executable JS (Voyager) | HermesCraft uses HTTP API not mineflayer; text skills + tool calling achieves same result |
| Memory retrieval | Scoring function | Vector DB (Voyager) | Overkill for ~200 events; simple scoring is faster and sufficient |
| Building | Blueprint executor | LLM coordinate reasoning | LLMs score 41/100 on spatial planning (MineAnyBuild). Blueprints are reliable. |
| Multi-agent coord | Emergent via chat | Central planner (VillagerAgent) | Central planner breaks the human illusion |

## No New Dependencies Required

The recommended enhancements are all implementable within the existing Node.js + JSON file stack. No new databases, no vector stores, no embedding services needed for the initial implementation. If semantic skill retrieval becomes necessary later, a lightweight embedding approach (TF-IDF or a small local model) can be added.

## Sources

- Architecture validated against Voyager, Mindcraft, GITM, Project Sid patterns
- Building approach from T2BM (IEEE CoG 2024), MineAnyBuild (NeurIPS 2025)
- Memory taxonomy from "Memory in the Age of AI Agents" survey (2025)
