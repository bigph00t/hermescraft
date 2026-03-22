# Phase 3: Plugin Integration + Custom Commands - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents use installed server plugins as tools — /findblock, /home, AuraSkills abilities, QuickShop trading, ServerTap queries. Custom Skript commands for /scan and /share-location. Prompt and planner updated so agents naturally use plugin commands as part of gameplay.

</domain>

<decisions>
## Implementation Decisions

### Custom Skript Commands
- **D-01:** `/scan <block> <radius>` — returns up to 5 nearest surface blocks with coordinates, formatted as parseable lines: `Found: <block> at <x> <y> <z> (<distance> blocks away)`. Returns "No <block> found within <radius> blocks" on miss.
- **D-02:** `/share-location <name>` — broadcasts to all players: `<player> marked <name> at <x> <y> <z>`. Stored in a YAML file so locations persist across restarts.
- **D-03:** `/scan` uses `isSkyVisible` filter — surface blocks only, consistent with Phase 2 surface-first design
- **D-04:** Radius capped at 100 blocks to prevent server lag. Default radius: 50
- **D-05:** No other custom Skript commands for this phase — /scan and /share-location cover discovery and coordination needs

### Plugin Command → Agent Tool Mapping
- **D-06:** Each major plugin capability gets its own dedicated tool — NOT a generic `plugin_command` tool. LLMs reason better with named tools that have typed parameters.
- **D-07:** New tools: `scan_blocks(block_type, radius?)`, `go_home(name?)`, `set_home(name?)`, `share_location(name)`, `check_skills()`, `use_ability(ability_name)`, `query_shops(item?)`, `create_shop(item, price, quantity)`
- **D-08:** Tool handlers in `actions.js` translate to chat commands: `scan_blocks("oak_log", 50)` → sends `/scan oak_log 50` via chat
- **D-09:** Chat response parsing: add a response listener in the agent that watches for plugin command output patterns (e.g., lines starting with "Found:", "Home set!", "Shop created"). Parse into structured data and store in a `lastCommandResult` field accessible to the planner.
- **D-10:** Command results are injected into the next user message as a `Plugin Response:` section so the LLM sees what happened

### AuraSkills Integration
- **D-11:** Read-AND-use: agents see their skill levels in the prompt AND can actively trigger abilities when they make sense
- **D-12:** Skill levels fetched via `/skills top <skill>` or ServerTap API (if available), parsed and cached in agent state. Refreshed every 5 planner cycles (~2.5 min)
- **D-13:** Active abilities exposed as `use_ability` tool: TreeFeller (woodcutting), Super Breaker (mining), Giga Drill Breaker (excavation), Serrated Strikes (swords — though peaceful mode, kept for completeness)
- **D-14:** Ability cooldowns tracked agent-side: after using an ability, record timestamp + cooldown duration. Don't offer ability in tools if on cooldown.
- **D-15:** Planner prompt includes skill levels as personality flavor: "Your Woodcutting is level 15 (TreeFeller available)" — agents reference these naturally in conversation ("I'm getting pretty good with an axe")

### QuickShop Trading
- **D-16:** Agents trade via QuickShop chest shops — place chest, create shop with `/qs create <price> <item>`, stock it from inventory
- **D-17:** Trading is planner-driven: planner decides to sell surplus items (>32 of any stackable resource) or buy items needed for current goal
- **D-18:** Shop location: agents build shops near their home location. If no home set, set one first.
- **D-19:** Price discovery: agents check existing shops via `/qs find <item>`, set prices within ±20% of market. If no market exists, use hardcoded sensible defaults (wood=1, iron=10, diamond=100)
- **D-20:** Agents mention trades in conversation naturally: "I set up a shop selling oak logs if you need any" — not "I executed /qs create 1 oak_log"

### ServerTap REST API
- **D-21:** ServerTap used for read-only server state queries — player list, world time, server TPS. NOT for executing commands (use chat for that).
- **D-22:** New module `agent/servertap.js` — thin wrapper around `fetch()` calls to `http://localhost:4567/v1/`. Returns parsed JSON.
- **D-23:** Endpoints used: `GET /players` (who's online), `GET /economy/balance/<player>` (check balance), `GET /server` (TPS/uptime)
- **D-24:** ServerTap data injected into state summary as `Server: {player_count} online, {tps} TPS` — lightweight, no separate tool needed
- **D-25:** If ServerTap port not exposed in Docker yet, gracefully skip — agent works without it, just loses server-side data enrichment

### Prompt & Planner Updates
- **D-26:** GAMEPLAY_INSTRUCTIONS updated with plugin command section: brief list of what each command does, when to use it
- **D-27:** Planner system prompt enhanced: "You have access to server plugins. Use /scan to find resources instead of wandering. Use /home to return to base. Share discoveries with /share-location."
- **D-28:** Plugin commands are presented as natural world actions in the prompt, not technical commands: "You can scan the area for specific blocks" not "Execute /scan command"
- **D-29:** Skills/abilities described as personal talents: "You've developed a talent for felling entire trees in one swing (TreeFeller)" not "AuraSkills ability TreeFeller available"

### Claude's Discretion
- Exact Skript implementation syntax and error handling
- ServerTap module error handling and retry logic
- Chat response parsing regex patterns
- Cooldown duration values for AuraSkills abilities
- QuickShop default price table
- Tool parameter validation details

</decisions>

<canonical_refs>
## Canonical References

### Agent Architecture (from Phase 2)
- `agent/tools.js` — GAME_TOOLS array, tool definition pattern with auto-injected `reason` field
- `agent/actions.js` — Action execution, already supports `/` commands via `sendCommand()` (line 273)
- `agent/planner.js` — Planner loop (30s), queue generation, chat sending
- `agent/prompt.js` — System prompt builder, GAMEPLAY_INSTRUCTIONS, user message construction
- `agent/state.js` — State fetching and `summarizeState()` for LLM context
- `agent/skills.js` — Skill loading, selection, and injection into system prompt

### Mod
- `mod/src/main/java/hermescraft/ActionExecutor.java` — Chat handler routes `/` commands through `sendCommand()`, no mod changes needed

### Plugin References
- AuraSkills docs: abilities, cooldowns, mana system
- QuickShop-Hikari: `/qs create`, `/qs find`, `/qs list` commands
- EssentialsX: `/home`, `/sethome`, `/warp`, `/back` commands
- Skript language: custom command definition, variable storage

### Prior Context
- `.planning/phases/01-paper-server-plugin-stack/01-CONTEXT.md` — Plugin installation decisions, AuraSkills replaces mcMMO
- `.planning/phases/02-spatial-awareness-architecture/02-CONTEXT.md` — Brain-hands-eyes architecture, planner-only chat, queue system

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `actions.js` chat handler — Already routes `/` commands through `client.getNetworkHandler().sendCommand()`. All plugin tools map to this.
- `planner.js` queue parser — Can queue `chat /command args` lines. Plugin commands fit naturally into the queue.
- `skills.js` skill injection — Can create new plugin-strategy skills (e.g., `plugin-resource-finder/SKILL.md`)
- Pinned context system — `agent/data/{name}/context/` can hold plugin command reference sheets

### Established Patterns
- Tools defined in `GAME_TOOLS` array with OpenAI function-calling schema
- Actions return `{ success, message/error }` — plugin tools follow same pattern
- Planner extracts `Say:` lines for chat — plugin response parsing follows same extraction pattern
- State summary is a compressed text block injected into user message — plugin data appends to it

### Integration Points
- `tools.js` — Add 8 new tools (scan_blocks, go_home, set_home, share_location, check_skills, use_ability, query_shops, create_shop)
- `actions.js` — Add handlers that translate tool calls to `/` chat commands
- `prompt.js` — Add plugin availability section to GAMEPLAY_INSTRUCTIONS
- `state.js` — Optionally add ServerTap data to state summary
- `planner.js` — Enhance planner prompt with plugin strategy guidance
- New: `agent/servertap.js` — ServerTap REST client (optional, graceful degradation)
- New: `agent/command-parser.js` — Parse plugin command responses from chat into structured data

</code_context>

<specifics>
## Specific Ideas

- With /scan + surface filter, agents can find the nearest tree or ore vein without wandering. Combined with Phase 2's look_at_block, this creates a find→look→break→collect loop that feels very human.
- /share-location lets agents coordinate: "I found a cave with iron!" → marks it → other agent navigates there. Natural multiplayer behavior.
- AuraSkills abilities (TreeFeller, Super Breaker) are power-ups that agents earn through play. They should feel like personal growth: "I've chopped enough trees that I can fell a whole one in one swing now."
- QuickShop trading creates emergent economy: one agent specializes in wood, the other in mining. They trade surplus. This drives specialization naturally.
- All plugin interactions should be invisible to the observer — agents talk about "scanning the area" and "checking if anyone's selling iron", not about slash commands.

</specifics>

<deferred>
## Deferred Ideas

- Plugin messaging channels (Fabric mod ↔ Paper plugin) — HTTP bridge sufficient for now
- Custom AuraSkills configuration (XP rates, ability power) — default settings are fine
- Warp system setup (/setwarp for community locations) — depends on agents having established bases first
- Citizens NPC integration — evaluate after core plugin usage works
- Economy balancing (inflation control, price floors) — observe emergent behavior first

</deferred>

---

*Phase: 03-plugin-integration-custom-commands*
*Context gathered: 2026-03-21 — all decisions at Claude's discretion per user request*
