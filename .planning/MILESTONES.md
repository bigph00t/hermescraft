# Milestones

## v1.0 Paper Migration + Plugin-Enhanced Agents (Shipped: 2026-03-22)

**Phases completed:** 4 phases, 15 plans, 29 tasks

**Key accomplishments:**

- Paper 1.21.1 (build #133) replacing Fabric server in Docker on Glass, Survival Island world migrated with Nether/End directory reorganization, both Fabric clients verified connected
- 7 Paper plugins (Timber, VeinMiner, AutoPickup, EssentialsX+Vault, LuckPerms, Chunky) installed with LuckPerms bot group and EssentialsX economy configured
- 5 gameplay/utility plugins installed via Hangar/Modrinth/GitHub APIs, StopSpam pre-configured with 5s cooldown and similarity detection
- Chunky pre-generated 63,001 chunks (2000 block radius), Timber/VeinMiner/AutoPickup verified working in-game -- Phase 1 complete
- Surface block detection via isSkyVisible filter in StateReader and Baritone minYLevelWhileMining/legitMine chat command configuration
- Removed artificial token limits from LLM calls, fixed dead setNavigating reference, and rewrote gameplay instructions for surface-first block interaction with Timber/AutoPickup plugin awareness
- surfaceBlocks in state summary with look_at_block coordinates and hardened brain-hands decision tree with emergency bypass, queue execution, and Baritone startup configuration
- Planner-only chat via D-16 hard block in action loop, surface-first QUEUE prompt with look_at_block + break_block examples
- Three Skript server commands (/scan /share-location /myskills) plus command-parser.js regex parser and servertap.js graceful-degradation REST client
- 8 plugin-backed tools added to GAME_TOOLS with corresponding action handlers in actions.js — scan_blocks, go_home/set_home, share_location, check_skills, use_ability (60s cooldown via _abilityCooldowns Map), query_shops, create_shop
- Full plugin integration wiring: GAMEPLAY_INSTRUCTIONS teaches LLM about 8 plugin tools, planner gets strategy guidance + skill personality + persistent command results, ServerTap enriches state summary, skill cache and scan results persist across ticks
- Skript scripts (scan.sk, share-location.sk, myskills.sk) deployed to Paper server, LuckPerms bot permissions granted, Approach B fix applied for missing PlaceholderAPI, full pipeline human-verified as approved
- Commit:
- VISION_PROMPT enhanced with BUILD: field — Claude Haiku now produces a parseable structural observation ("no windows on north wall") or "BUILD: none" on every screenshot, feeding the planner's idle creative-behavior loop
- Creative intelligence fully wired into planner.js: debt counter forces ~2.5 min gathering cap, per-agent CREATIVE_BEHAVIOR blocks with autobiography directives, BUILD observation injection, META_GAME_REGEX chat filter, demand-aware trading, and lastCreativeActivity timestamps in shared state

---
