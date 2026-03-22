# Milestones

## v2.0 Mineflayer Rewrite (Shipped: 2026-03-22)

**Phases completed:** 6 phases, 13 plans, 20 tasks

**Key accomplishments:**

- Headless mineflayer bot with pathfinder and tool plugins on Paper 1.21.1, cooperative interrupt harness, and item/block name normalizer — foundation for all body/ skills
- navigate.js/dig.js/place.js — three atomic wrappers enforcing nav timeout, dig verification, and place verification as project-wide safety invariants
- gather() and mine() body-layer skills: interrupt-safe resource collection and ore mining with auto-tool tier enforcement
- BFS crafting chain solver (minecraft-data 1.21.1) ported to body/crafter.js; craft skill in body/skills/craft.js executes full dependency chains via bot.recipesFor() + bot.craft() with crafting table management
- One-liner:
- Event-driven Mind loop wiring chat/skill_complete/idle into think() -> queryLLM() -> dispatch(), plus v2 entry point `start.js` connecting Mind + Body
- combat.js with attackTarget (body tick single-hit) + combatLoop (LLM-dispatchable sustained loop), HOSTILE_MOBS Set (42 entries), and !combat wired into registry
- One-liner:
- Four mind/ data subsystems ported from v1 with v2 isolation: config (SOUL loading), memory (MEMORY.md + session JSONL), social (sentiment tracking + partner pre-seeding), locations (named waypoints with cardinal directions)
- start.js
- One-liner:
- !build command wired to registry dispatch, blueprint catalog + active build progress injected into system prompt every tick, build completions persisted to world knowledge + named locations for cross-session expansion

---

## v1.1 Tool Quality & Building Intelligence (Shipped: 2026-03-22)

**Phases completed:** 4 phases, 10 plans, 13 tasks

**Key accomplishments:**

- One-liner:
- Java mod ActionExecutor.java extended with smart_place (full 36-slot equip + surface placement + placed data), chest_deposit/chest_withdraw sustained actions, and timeout self-clear fix — mod builds successfully
- smart_place replaces place in the LLM tool list; chest_deposit/chest_withdraw added with auto-tracking of chest contents via trackChest on every response
- minecraft-data 1.21.1 BFS recipe chain solver that resolves full dependency trees from inventory, returning ordered leaf-to-root craft steps with crafting table flags and inventory-aware variant selection
- Craft chain expansion wired into planner: `craft wooden_pickaxe` auto-expands to oak_planks, stick, wooden_pickaxe queue entries at plan-write time via solveCraft
- Markdown building plan parser (freestyle.js) and persistent placed-block log (placement-tracker.js) — standalone modules ready for wiring in 07-02
- Freestyle building wired end-to-end: placement tracking in actions.js, queue expansion in planner.js, init at startup in index.js, and LLM taught the freestyle type via prompt updates
- placed_count deterministic build verification wired to reviewSubtaskOutcome with 10% tolerance; build failure prompt injection and PLACED BLOCKS summary added to buildUserMessage; advanceFreestyle wired in tick loop after each successful queued smart_place
- agent/locations.js:

---

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
