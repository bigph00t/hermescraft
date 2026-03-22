# HermesCraft: AI Agents That Play Minecraft Like People

## What This Is

A Minecraft AI agent system where AI characters (Jeffrey Enderstein, John Kwon) play like real humans in a vast open world. They gather resources, craft tools, build structures, explore, trade, and have genuine conversations — all driven by LLM reasoning through a Mind + Body architecture. The Mind (LLM) makes decisions every 15-30s. The Body (Mineflayer skill functions) executes autonomously — walking, mining, placing, crafting — smoothly, like a real player.

## Core Value

Agents must feel and play like real people — creative, emotional, with desires, aesthetic sense, and the ability to interact with the world around them. A human observer watching for 30 minutes shouldn't immediately tell they're bots.

## Requirements

### Validated

- ✓ Deep personality SOUL files for each agent — v1
- ✓ MiniMax M2.7 for LLM reasoning — v1
- ✓ Paper 1.21.1 server with plugins — v1.0
- ✓ Creative intelligence with personality-driven behavior — v1.0
- ✓ Anti-meta-game enforcement — v1.0
- ✓ Item name normalization — v1.1
- ✓ Crafting chain solver (BFS with minecraft-data) — v1.1

### Active

- [ ] Mineflayer replaces Fabric client + HermesBridge + Baritone
- [ ] Mind + Body two-layer architecture (LLM decisions + skill execution)
- [ ] Skill functions for core gameplay (gather, mine, build, craft, navigate)
- [ ] Natural chat with grounding (only reference real game state)
- [ ] Multi-agent coordination on same server
- [ ] Agents actually play the game — mine, craft, build real structures, progress through tiers

### Out of Scope

- Fabric client mod (HermesBridge) — replaced by Mineflayer
- Baritone — Mineflayer has its own pathfinder
- Vision/screenshots — dropped. Mineflayer provides world state directly
- 3-loop architecture — replaced by Mind + Body
- HTTP bridge — Mineflayer is direct API

## Current Milestone: v2.0 Mineflayer Rewrite

**Goal:** Scrap the Fabric mod + HTTP bridge architecture entirely. Replace with Mineflayer headless bots using a Mind (LLM) + Body (skill functions) architecture. Agents that actually play the game smoothly.

**Target:**
- Mineflayer bots replacing Fabric clients
- Skill function library (gather, mine, build, craft, navigate, chat)
- Mind loop (LLM every 15-30s for decisions)
- Body loop (skill execution, autonomous between LLM calls)
- Personality system (SOUL files, memory, social)
- Multi-agent on single server

## Context

### Why the rewrite
v1.0-v1.1 built an agent on top of a Fabric client mod + HTTP bridge. Every game action went: LLM → HTTP POST → mod → Minecraft API → HTTP response → parse. This caused:
- Crosshair drift (look_at_block succeeds, break_block hits air)
- Coordinate translation bugs (relative vs absolute)
- "Another action pending" race conditions
- 1GB+ RAM per agent (full MC client + Xvfb)
- Agents narrating fantasy builds while every placement silently failed

Mineflayer eliminates all of this: `bot.dig(block)` just works, `bot.placeBlock(ref, face)` just works, `bot.pathfinder.goto(goal)` just works. No HTTP, no crosshair, no races.

### What carries over
- SOUL personality files (Jeffrey, John)
- Memory system pattern (MEMORY.md, skills, notepad)
- Crafting chain solver (crafter.js — BFS with minecraft-data)
- Item name normalizer
- Creative behavior system concepts
- Paper server with plugins (Timber, VeinMiner, AutoPickup, etc.)

### Reference projects
- Mindcraft (kolbytn/mindcraft) — LLM + Mineflayer skill library, closest to our target
- Voyager — GPT-4 code generation with Mineflayer
- mineflayer-pathfinder — A* pathfinding plugin

## Constraints

- **Server hardware**: Glass has 15GB RAM — Mineflayer bots use ~100MB each vs 1GB+
- **LLM cost**: MiniMax M2.7 is cheap, keep it
- **MC version**: 1.21.1 (Paper server)
- **Agents**: 2 for now (Jeffrey, John), designed to scale to 5-10
- **No peaceful mode restriction** — agents should handle survival properly
- **No artificial throttling** — no arbitrary cooldowns, turn caps, token limits, or forced delays. Let the Mind think as fast and as often as it can. If the LLM responds in 0.5s, use it immediately. The agent should be as responsive and active as the hardware allows.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Paper server | Plugin ecosystem | ✓ Good — keep |
| MiniMax M2.7 | Cheap, fast, adequate | ✓ Good — keep |
| SOUL personality files | Rich character identity | ✓ Good — keep |
| Fabric mod + HTTP bridge | v1 architecture | ⚠️ Failed — replace with Mineflayer |
| Baritone for pathfinding | Human-like movement | ⚠️ Overkill — mineflayer-pathfinder sufficient |
| 3-loop architecture | Separate action/vision/planner | ⚠️ Overcomplicated — replace with Mind + Body |
| Claude Haiku vision | Screenshot analysis | ⚠️ Unnecessary — Mineflayer provides world state directly |
| Mineflayer rewrite | Direct bot API, headless, lightweight | — Pending (v2.0) |
| Mind + Body architecture | LLM decides, skills execute | — Pending (v2.0) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-22 after v2.0 milestone start*
