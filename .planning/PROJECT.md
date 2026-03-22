# HermesCraft: AI Agents That Play Minecraft Like People

## What This Is

A Minecraft AI agent system where AI characters (Jeffrey Enderstein, John Kwon, Alex, Anthony) play like real humans on a Survival Island. They build structures with aesthetic intent, gather resources from visible surfaces, explore and name locations, trade surplus items, learn skills over time, and have genuine conversations referencing their backstories — all driven by LLM reasoning with visual awareness. The system uses a Paper server with 12 plugins for enhanced gameplay, a brain-hands-eyes agent architecture with creative intelligence, and Claude Haiku for vision-based build evaluation.

## Core Value

Agents must feel and play like real people — creative, emotional, with desires, aesthetic sense, and the ability to look at the world around them and interact with what they see. A human observer watching for 30 minutes shouldn't immediately tell they're bots.

## Requirements

### Validated

- ✓ Multi-agent system with per-agent memory, skills, social tracking — v1
- ✓ 3-loop architecture (action/vision/planner) with shared state — v1
- ✓ Claude Haiku vision for screenshot analysis — v1
- ✓ MiniMax M2.7 for action and planning LLM calls — v1
- ✓ Deep personality SOUL files for each agent — v1
- ✓ HermesBridge Fabric client mod (HTTP API for state/actions) — v1
- ✓ Paper 1.21.1 server with 12 plugins (Timber, VeinMiner, AutoPickup, EssentialsX, AuraSkills, QuickShop, LuckPerms, Skript, ServerTap, StopSpam, Chunky) — v1.0
- ✓ Agent spatial awareness: surfaceBlocks + look_at_block + break_block primary interaction — v1.0
- ✓ Brain-hands-eyes architecture: planner writes queue, action loop executes, vision feeds awareness — v1.0
- ✓ Custom Skript commands: /scan, /share-location, /myskills — v1.0
- ✓ 8 plugin-backed agent tools: scan_blocks, go_home, set_home, share_location, check_skills, use_ability, query_shops, create_shop — v1.0
- ✓ Creative intelligence: creative debt counter, per-agent CREATIVE_BEHAVIOR, vision BUILD evaluation, meta-game word filter — v1.0
- ✓ SOUL files enhanced with creative drives, aesthetic preferences, emotional triggers — v1.0
- ✓ Anti-meta-game enforcement: FORBIDDEN_WORDS_BLOCK + META_GAME_REGEX two-layer filter — v1.0

### Active

(No active requirements — next milestone not yet defined)

### Out of Scope

- Scoreboard display — user doesn't want it
- More than 2 agents for now — scale later
- Custom Paper plugin (Java) — use Skript for custom commands
- Nether/End gameplay — focus on overworld island survival first
- Hostile mob combat — peaceful mode for building/cooperation focus

## Context

### Current State (post v1.0)
- Server: Paper 1.21.1 (build #133) in Docker on Glass with 12 plugins
- Clients: 2x Fabric clients with HermesBridge mod + Baritone, running in Xvfb
- Agent: Node.js ESM with 3 async loops (action 2s, vision 10s, planner 30s)
- LLM: MiniMax M2.7 for text, Claude Haiku for vision BUILD evaluation
- Codebase: ~8,300 LOC JavaScript (agent), ~2,700 LOC Java (mod), ~50 LOC Skript
- 4 SOUL files with deep personality + creative subsections
- 37 agent tools (29 game + 8 plugin)
- Known tech debt: VeinMiner sneak not documented to agent, ServerTap port 4567 not Docker-exposed, AuraSkills static Level 0 (needs PlaceholderAPI)

## Constraints

- **Server hardware**: Glass has 15GB RAM, running MC server + 2 clients + 2 agents
- **LLM cost**: MiniMax M2.7 is cheap. Claude Haiku for vision on user's subscription
- **MC version**: Must stay on 1.21.1 for Baritone compatibility
- **Client mods**: HermesBridge and Baritone are client-side only
- **Difficulty**: Peaceful mode (no hostile mobs) — focus on building and cooperation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Paper over Fabric server | Plugin ecosystem, performance | ✓ Good — 12 plugins running |
| Skript over custom Java plugin | Faster iteration, no compilation | ✓ Good — /scan, /share-location, /myskills |
| Look+break over Baritone #mine | Prevents underground tunneling | ✓ Good — surface-first gameplay |
| Keep MiniMax for LLM | Cheap, fast, adequate quality | ✓ Good |
| Claude Haiku for vision | Image understanding, BUILD evaluation | ✓ Good — drives creative feedback loop |
| Brain-hands-eyes architecture | Planner is brain, action loop is hands | ✓ Good — queue-based execution |
| No artificial token limits | Let LLM generate naturally | ✓ Good |
| AuraSkills over mcMMO | mcMMO SpigotMC-only, AuraSkills equivalent | ✓ Good — installed, needs PlaceholderAPI |
| Creative debt counter | Forces creative activity after gathering | ✓ Good — 5-cycle threshold |
| Two-layer meta-game filter | Prompt trains LLM + regex backstop | ✓ Good — FORBIDDEN_WORDS + META_GAME_REGEX |

---
*Last updated: 2026-03-22 after v1.0 milestone*
