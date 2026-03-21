# Roadmap: HermesCraft v2

## Overview

Transform HermesCraft from a broken Baritone-puppet system into spatially-aware, plugin-enhanced AI agents that play Minecraft like real people.

**Milestone:** Paper Migration + Plugin-Enhanced Agents
**Phases:** 4
**Core metric:** Agents gather wood from visible trees (not underground), build structures, trade, and converse naturally without chat truncation or Baritone conflicts.

## Phase 1: Paper Server + Plugin Stack

**Goal:** Migrate to Paper server and install all plugins. Both clients connect. Plugins verified working.

**Requirements:** SRV-01, SRV-02, SRV-03, SRV-04, PLG-01 through PLG-12

**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md — Paper server setup, world migration, client connectivity verification
- [x] 01-02-PLAN.md — Install Timber, VeinMiner, AutoPickup, EssentialsX+Vault, LuckPerms, Chunky; configure LuckPerms bot group
- [x] 01-03-PLAN.md — Install AuraSkills (mcMMO alt), QuickShop-Hikari, Skript, ServerTap, StopSpam; configure StopSpam (5s cooldown)
- [x] 01-04-PLAN.md — Chunky world pre-generation, functional verification of Timber/VeinMiner/AutoPickup

**Scope:**
- Download Paper 1.21.1 jar, set up in Docker
- Migrate Survival Island world files (reorganize Nether/End dirs)
- Install all 12 plugins: Timber, VeinMiner, AutoPickup, EssentialsX+Vault, mcMMO, QuickShop-Hikari, LuckPerms, Skript, BlockBeacon, ServerTap, StopSpam, Chunky
- Configure each plugin (permissions, settings, economy)
- Pre-generate world with Chunky (2000 block radius)
- Verify both Fabric clients connect and HermesBridge + Baritone work
- Set up LuckPerms: bot group with plugin command access
- Configure StopSpam: 5-second cooldown, similarity detection
- Test: Timber fells whole trees, VeinMiner gets whole veins, AutoPickup sends items to inventory

**Done when:** Paper server running, all 12 plugins active, both clients connected, tree-felling/vein-mining/auto-pickup working.

## Phase 2: Spatial Awareness + Architecture Rework

**Goal:** Agents see the world and interact with visible blocks. No more underground Baritone disasters. Brain-hands-eyes architecture fully operational.

**Requirements:** SAW-01 through SAW-06, ARC-01 through ARC-06

**Plans:** 4 plans

Plans:
- [x] 02-01-PLAN.md — Mod changes: surfaceBlocks in StateReader, Baritone settings in BaritoneIntegration, mod rebuild + deploy
- [x] 02-02-PLAN.md — Agent cleanup: remove MAX_TOKENS, fix dead references, surface-first gameplay instructions
- [x] 02-03-PLAN.md — Surface awareness: surfaceBlocks in state summary, decision tree hardening, Baritone startup config
- [ ] 02-04-PLAN.md — Chat ownership: planner-only chat sending, dedup enforcement, queue prompt tuning

**Scope:**
- Switch to baritone-api-fabric jar (real isPathing(), programmatic settings)
- Add surfaceBlocks to mod state (isSkyVisible filter)
- Implement look_at_block + break_block as primary interaction (not #mine)
- Configure Baritone: minYLevelWhileMining=55 for surface resources
- Action queue system: planner writes queue, action loop pops and executes without LLM
- Baritone tracker: knows when mine/navigate active, skips ticks
- Chat sent by planner only (Say: lines), action loop focuses on gameplay
- Chat dedup in planner (skip similar messages)
- Remove all artificial token limits
- Vision descriptions drive block targeting

**Done when:** Agent walks to visible tree, chops it (Timber fells whole tree, AutoPickup collects), crafts tools. Never goes underground unless intentionally mining ores. Planner chats naturally without truncation or spam.

## Phase 3: Plugin Integration + Custom Commands

**Goal:** Agents use plugins as tools — /findblock, /home, mcMMO skills, QuickShop trading, ServerTap queries.

**Requirements:** INT-01 through INT-07

**Scope:**
- Write Skript: /scan <block> <radius> surface — returns nearest surface blocks with coords
- Write Skript: /share-location <name> — broadcasts location to all
- Agent tool: execute /findblock via chat, parse response for coordinates
- Agent tool: /home set, /home, /warp for fast travel
- Agent reads mcMMO skill levels from ServerTap API, adapts behavior
- Agent can set up QuickShop chest shops (place chest, set price)
- Agent queries ServerTap REST API for player/world data
- Update prompt.js and tools.js with new plugin-enabled actions
- Update planner to suggest plugin-enabled strategies

**Done when:** Agent uses /findblock to locate iron, /home to return to base, reads mcMMO level and says "I'm getting better at mining", sets up a shop with surplus wood.

## Phase 4: Personality + Creative Play

**Goal:** Agents feel like real people — they build with style, explore with curiosity, trade with intent, and specialize based on what they're good at.

**Requirements:** PER-01 through PER-07

**Scope:**
- Enhance SOUL files with creative drives, aesthetic preferences, emotional range
- Planner suggests creative projects based on mcMMO skills ("you're good at woodcutting, build a dock")
- Agent evaluates builds aesthetically via vision ("this house needs windows")
- Agent explores new areas, names locations, shares discoveries
- Agent trades surplus items via QuickShop based on inventory analysis
- Agent references autobiography and relationships in conversation
- Agent tries new activities (fishing, gardening, decorating) based on creative need score
- Ensure no meta-game language (baritone, pathfinding, API, etc.)
- Test: extended play session where agents build, explore, trade, and converse naturally

**Done when:** 30-minute play session where both agents gather resources, build a base with aesthetic choices, trade items, explore the island, and chat naturally about their lives. A human observer can't immediately tell they're bots.

---
*Roadmap created: 2026-03-21*
*Milestone: Paper Migration + Plugin-Enhanced Agents*
