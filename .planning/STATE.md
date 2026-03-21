---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-03-21T23:53:40.200Z"
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 15
  completed_plans: 15
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Agents feel and play like real people with spatial awareness, creativity, and genuine interaction
**Current focus:** Phase 04 — personality-creative-play

## Current Phase

**Phase 4: Personality + Creative Play**

- Status: Complete (3/3 plans with SUMMARY: 04-01, 04-02, 04-03 done)
- Goal: Add creative drives, build evaluation, planner personality, anti-meta-game enforcement
- Current plan: All plans complete. Phase 04 done.

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
- [Phase 02]: Removed max_tokens entirely from text-fallback LLM path — both branches generate naturally (02-02)
- [Phase 02]: Surface-first GAMEPLAY_INSTRUCTIONS: surfaceBlocks + look_at_block as primary, mine as fallback (02-02)
- [Phase 02]: Baritone chat command syntax #settingName value (not #set prefix) for settings configuration (02-01)
- [Phase 02]: Surface scan 24-block horizontal, -5/+10 vertical, capped at 20 results sorted by distance (02-01)
- [Phase 02]: Emergency health bypass at health < 6 with temperature 0.3 for survival focus (02-03)
- [Phase 02]: Queue cleared on phase transition + death for clean state (02-03)
- [Phase 02]: Baritone settings use #settingName value syntax in agent startup (02-03)
- [Phase 02]: Action loop chat block uses isBaritoneActive() exception for Baritone-active chat (02-04)
- [Phase 02]: Chat from queue (mode=queue) passes through -- planner explicitly queued it (02-04)
- [Phase 03]: scan_blocks and check_skills are INFO_ACTIONS — results arrive via chat and LLM must see them before deciding next action
- [Phase 03]: use_ability sends guidance message (not slash command) — AuraSkills abilities activate via right-click + break, not /command
- [Phase 03]: Ability cooldown 60s conservative default via _abilityCooldowns Map (D-14)
- [Phase 03-plugin-integration-custom-commands]: myskills.sk uses PlaceholderAPI PAPI approach A for AuraSkills skill levels (03-01)
- [Phase 03-plugin-integration-custom-commands]: Skript variables namespaced as {locations::%player name%::*} to prevent multi-agent collisions (03-01)
- [Phase 03]: updatePlannerPluginState() setter pattern — planner runs on own setInterval, module-level setter decouples index.js from planner internals
- [Phase 03]: GAMEPLAY_INSTRUCTIONS no-slash phrasing uses 'natural abilities' language to avoid embedding /command patterns (D-28)
- [Phase 03-04]: myskills.sk uses Approach B (static level 0) — PlaceholderAPI not installed; PAPI placeholders would emit literal strings breaking command-parser.js extractSkillLevels()
- [Phase 04-02]: VISION_PROMPT uses template literal for multi-line; BUILD: field on new line parseable via /^BUILD:\s*(.+)$/m regex
- [Phase 04-02]: No other vision.js changes — _lastVisionText + getVisionContext() already return full BUILD: field to planner
- [Phase 04-personality-creative-play]: Appended sections to SOUL files rather than rewriting — preserves all existing personality prose
- [Phase 04-personality-creative-play]: FORBIDDEN_WORDS_BLOCK injected after GAMEPLAY_INSTRUCTIONS so anti-meta-game enforcement applies to all modes
- [Phase 04-03]: GATHERING_TYPES conservative set (mine/craft/smelt/equip/scan_blocks/eat) so navigate/place/build/farm/fish/chat count as creative
- [Phase 04-03]: META_GAME_REGEX word boundaries prevent false positives; lastIndex reset required on stateful /g regex
- [Phase 04-03]: lastCreativeActivity uses undefined (not null) when debt > 0 — spread conditional preserves previous timestamp in coordination.json

## Session Log

- 2026-03-21: Completed 01-01 (Paper server setup + world migration). Paper running, both clients connected.
- 2026-03-21: Completed 01-02 (Batch 1 plugins). Timber, VeinMiner, AutoPickup, EssentialsX, Vault, LuckPerms, Chunky installed. Bot group configured.
- 2026-03-21: Completed 01-03 (Batch 2 plugins). AuraSkills, QuickShop-Hikari, Skript, ServerTap, StopSpam installed. StopSpam configured.
- 2026-03-21: Completed 01-04 (Verification). Chunky pre-gen 63,001 chunks. Timber, VeinMiner, AutoPickup verified working. Phase 1 complete.
- 2026-03-21: Completed 02-01 (Mod surface detection + Baritone settings). surfaceBlocks array in state JSON, configureSettings() for Baritone, mod deployed to local instances.
- 2026-03-21: Completed 02-02 (Agent code cleanup). Removed max_tokens cap from LLM, fixed dead setNavigating reference, rewrote gameplay instructions for surface-first interaction.
- 2026-03-21: Completed 02-03 (State wiring + decision tree). surfaceBlocks in state summary, emergency bypass, Baritone startup config, static imports, queue clear on phase transition.
- 2026-03-21: Completed 02-04 (Chat ownership + surface-first queue). Planner-only chat via D-16 hard block, surface-first QUEUE prompt, look_at_block in valid types. Phase 02 complete.
- 2026-03-21: Completed 03-01 (Skript commands + parser modules). /scan /share-location /myskills on server, command-parser.js and servertap.js agent modules created.
- 2026-03-21: Completed 03-02 (Plugin tools and action handlers). 8 tools in tools.js, 8 handlers in actions.js, ability cooldown system.
- 2026-03-21: Completed 03-03 (Plugin wiring). GAMEPLAY_INSTRUCTIONS, planner strategy guidance, ServerTap state summary, skill cache + command result persistence, INFO_ACTIONS handlers.
- 2026-03-21: Completed 03-04 (Deploy + verify). Skript scripts deployed to Docker container, LuckPerms permissions granted, Approach B applied for myskills.sk (no PAPI), human-verified as approved. Phase 03 complete.
- 2026-03-21: Completed 04-01 (SOUL creative subsections + FORBIDDEN_WORDS). 12 new sections added to 4 SOUL files. FORBIDDEN_WORDS_BLOCK injected into prompt.js for all modes.
- 2026-03-21: Completed 04-02 (Vision BUILD evaluation). VISION_PROMPT enhanced with BUILD: field — Claude Haiku produces structural observations or "BUILD: none". Feeds planner Plan 03.
- 2026-03-21: Completed 04-03 (Creative intelligence wiring). Debt counter, CREATIVE_BEHAVIOR blocks, BUILD injection, META_GAME_REGEX filter, trading proactivity, lastCreativeActivity in shared state. Phase 04 complete.
