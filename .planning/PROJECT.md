# HermesCraft: AI Agents That Play Minecraft Like People

## What This Is

A Minecraft AI agent system where AI characters (Jeffrey Enderstein, John Kwon) play like real humans in a vast open world. They gather resources, craft tools, build structures, explore, fight mobs, and have genuine conversations — all driven by LLM reasoning through a Mind + Body architecture. The Mind (MiniMax M2.7) makes decisions on events. The Body (Mineflayer skill functions) executes autonomously — walking, mining, placing, crafting, fighting — smoothly, like a real player. A 300ms survival tick handles combat, hazard avoidance, and item pickup without LLM involvement.

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
- ✓ Mineflayer replaces Fabric client + HermesBridge + Baritone — v2.0
- ✓ Mind + Body two-layer architecture (LLM decisions + skill execution) — v2.0
- ✓ Skill functions for core gameplay (gather, mine, build, craft, smelt, combat, navigate) — v2.0
- ✓ Natural chat with grounding (only reference real game state) — v2.0
- ✓ Multi-agent coordination on same server — v2.0
- ✓ Agents play the game — mine, craft, build structures, survive, cooperate — v2.0
- ✓ Cooperative interrupt system for all skills — v2.0
- ✓ 300ms autonomous survival tick (eat, flee, fight, unstuck, pickup) — v2.0
- ✓ Persistent memory across sessions (MEMORY.md, locations, build state) — v2.0
- ✓ Day/night routine (shelter at nightfall) — v2.0
- ✓ Structured building from blueprints with post-place verification — v2.0

### Active

- [x] Minecraft RAG — full game knowledge (recipes, blocks, mobs, biomes) queryable on demand — Validated in Phase 11: Knowledge Corpus (2,677 chunks)
- [x] Tool/command RAG — agents understand their own !commands deeply via indexed documentation — Validated in Phase 11: Knowledge Corpus (22 command chunks)
- [ ] Auto-lookup on failure — when skills fail, automatically retrieve correct approach
- [ ] Context-aware knowledge injection — inject relevant MC info based on current activity
- [ ] !wiki command — agents query MC knowledge mid-gameplay

### Out of Scope

| Feature | Reason |
|---------|--------|
| Fabric client mod (HermesBridge) | Replaced by Mineflayer in v2.0 |
| Baritone | Replaced by mineflayer-pathfinder in v2.0 |
| Vision/screenshots (Claude Haiku) | Mineflayer provides world state directly |
| 3-loop architecture | Replaced by Mind + Body in v2.0 |
| HTTP bridge | Mineflayer is direct API |

## Current State

**Shipped:** v2.0 Mineflayer Rewrite (2026-03-22)

The v2.0 rewrite is complete. 24 JavaScript modules across `body/` (skills, primitives, modes) and `mind/` (LLM client, prompt builder, command registry, config, memory, social, locations). 3,389 lines of code. 4 blueprint JSONs. Entry point: `npm run start:v2`.

**Phase 11 complete (2026-03-23):** Knowledge corpus built — 2,677 chunks (782 recipes, 1,662 facts, 211 strategy, 22 commands). `mind/knowledge.js` with 4 generators wired into `start.js`. 10 hand-authored knowledge files in `knowledge/` covering mining, combat, farming, survival, biomes, structures, building, tool-mastery, creative-flows, objectives.

Architecture: `start.js` → `createBot()` → init subsystems → `initMind(bot, config)` → `initModes(bot, isSkillRunning)`. Event-driven Mind loop (chat/skill_complete/idle triggers). 9 registry commands (!gather, !mine, !craft, !smelt, !navigate, !chat, !idle, !combat, !build, !deposit, !withdraw). 300ms body tick with 6-priority survival cascade.

## Current Milestone: v2.2 Minecraft RAG

**Goal:** Agents get deep Minecraft knowledge via RAG — recipes, blocks, mobs, biomes, building techniques, plus understanding of their own tool/command structure. All queryable on demand.

**Target:**
- Index minecraft-data (1.21.1 recipes, blocks, items, mobs, biomes)
- Index MC gameplay knowledge (building, farming, survival strategies)
- Auto-document and index all !commands with args, patterns, failure modes
- !wiki command for on-demand queries
- Context injection: relevant MC knowledge per-call based on current activity
- Auto-lookup: when skills fail, retrieve correct approach automatically

## Context

### v2.0 architecture (current)
- `body/` — Mineflayer skill functions, primitives, blueprints, modes tick
- `mind/` — LLM client, prompt builder, registry, config, memory, social, locations
- `start.js` — Entry point wiring Mind + Body
- Mind/Body boundary enforced: only `mind/registry.js` imports from `body/`; body never imports from mind
- Cooperative interrupt via `bot.interrupt_code` checked after every `await` in skills

### What carries over to v2.1
- Everything from v2.0 — it's additive
- SOUL personality files (Jeffrey, John)
- Memory, social, locations systems
- All body/ skills and mind/ modules

### Reference projects
- Mindcraft (kolbytn/mindcraft) — LLM + Mineflayer skill library
- Voyager — GPT-4 code generation with Mineflayer

## Constraints

- **Server hardware**: Glass has 15GB RAM — Mineflayer bots use ~100MB each
- **LLM cost**: MiniMax M2.7 is cheap, keep it
- **MC version**: 1.21.1 (Paper server)
- **Agents**: 2 for now (Jeffrey, John), designed to scale to 5-10
- **No artificial throttling** — let the Mind think as fast and often as possible

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Paper server | Plugin ecosystem | ✓ Good — keep |
| MiniMax M2.7 | Cheap, fast, adequate | ✓ Good — keep |
| SOUL personality files | Rich character identity | ✓ Good — keep |
| Mineflayer rewrite | Direct bot API, headless, lightweight | ✓ Good — shipped v2.0 |
| Mind + Body architecture | LLM decides, skills execute | ✓ Good — clean boundary, shipped v2.0 |
| Event-driven Mind (not fixed tick) | Fire on chat/skill_complete/idle | ✓ Good — responsive, no wasted LLM calls |
| !command text mode (not tool calling) | MiniMax M2.7 unreliable with tool_choice:required | ✓ Good — reliable parsing |
| 300ms body tick | Autonomous survival independent of LLM | ✓ Good — bot feels alive |
| Cooperative interrupt | isInterrupted(bot) after every await | ✓ Good — clean skill cancellation |
| Pre-made blueprints for v2.0 | Ship building quickly | ⚠️ Revisit — agents should design their own (v2.1) |

## Evolution

This document evolves at phase transitions and milestone boundaries.

---
*Last updated: 2026-03-23 after Phase 11 completion*
