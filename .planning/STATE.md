---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: in-progress
last_updated: "2026-03-21T20:57:32Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 4
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Agents feel and play like real people with spatial awareness, creativity, and genuine interaction
**Current focus:** Phase 01 complete — ready for Phase 02

## Current Phase

**Phase 1: Paper Server + Plugin Stack**

- Status: Complete (4/4 plans complete)
- Goal: Migrate to Paper, install 12 plugins, verify clients connect
- Current plan: All plans complete

## History

### v1.0 (completed 2026-03-21)

- Built full agent harness: Node.js with multi-level memory, skills, vision, social, locations
- HermesBridge Fabric mod: HTTP API for game state + actions
- 3-loop architecture: action (2s), vision (10s), planner (20-30s)
- Claude Haiku vision, MiniMax M2.7 for text
- Two agents: Jeffrey Enderstein, John Kwon with deep SOUL personalities
- Known issues: Baritone underground tunneling, chat truncation, no spatial awareness

### v2.0 (starting)

- Paper server migration for plugin support
- 12 plugins for enhanced gameplay (Timber, VeinMiner, mcMMO, etc.)
- Spatial awareness rework: look+break instead of blind Baritone
- Brain-hands-eyes architecture with action queue

## Blockers

None currently.

## Decisions

- Paper over Fabric server — plugin ecosystem
- Skript for custom commands — no Java compilation needed
- Look+break as primary interaction — prevents underground tunneling
- No artificial token limits — let LLM generate naturally
- Peaceful difficulty — focus on building and cooperation
- Paper 1.21.1 build #133 as server platform (01-01)
- RCON on port 25575 for runtime server configuration (01-01)
- enforce-secure-profile=false for offline-mode bot access (01-01)
- AuraSkills instead of mcMMO — mcMMO only on SpigotMC (no API), AuraSkills equivalent (01-03)
- BlockBeacon deferred to Skript — plugin not found on any public repo (01-03)
- ServerTap port 4567 needs Docker port exposure — deferred to container recreation (01-03)
- VeinMiner requires sneak (shift) to activate — default plugin behavior, agents must hold shift when mining ores (01-04)
- StopSpam cooldown 5000ms + similarity detection threshold 0.85 (01-03)
- TreeTimber from Modrinth CDN — Hangar API returns HTML redirects for external plugins (01-02)
- JAutoPickup instead of AutoPickup — original requires SpigotMC browser login (01-02)
- LuckPerms YAML storage — enables file-based group management without RCON (01-02)
- ServerTap REST API for console commands — rcon-cli not available in container (01-02)

## Session Log

- 2026-03-21: Completed 01-01 (Paper server setup + world migration). Paper running, both clients connected.
- 2026-03-21: Completed 01-02 (Batch 1 plugins). Timber, VeinMiner, AutoPickup, EssentialsX, Vault, LuckPerms, Chunky installed. Bot group configured.
- 2026-03-21: Completed 01-03 (Batch 2 plugins). AuraSkills, QuickShop-Hikari, Skript, ServerTap, StopSpam installed. StopSpam configured.
- 2026-03-21: Completed 01-04 (Verification). Chunky pre-gen 63,001 chunks. Timber, VeinMiner, AutoPickup verified working. Phase 1 complete.
