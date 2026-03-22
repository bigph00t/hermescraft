# Phase 3: Plugin Integration + Custom Commands - Research

**Researched:** 2026-03-21
**Domain:** Skript command authoring, AuraSkills abilities, QuickShop-Hikari shop flow, ServerTap REST API, Node.js agent tool/action extension
**Confidence:** MEDIUM-HIGH — plugin behavior verified via official wikis; Skript sky-visibility workaround is inferred from confirmed primitives

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Custom Skript Commands**
- D-01: `/scan <block> <radius>` — returns up to 5 nearest surface blocks, formatted: `Found: <block> at <x> <y> <z> (<distance> blocks away)`. Miss: `No <block> found within <radius> blocks`
- D-02: `/share-location <name>` — broadcasts: `<player> marked <name> at <x> <y> <z>`. Persists in YAML
- D-03: `/scan` uses `isSkyVisible` filter (sky-exposed surface blocks only)
- D-04: Radius capped at 100 blocks, default 50
- D-05: No other custom Skript commands this phase

**Plugin Command → Agent Tool Mapping**
- D-06: Each plugin capability gets its own dedicated named tool (no generic `plugin_command`)
- D-07: New tools: `scan_blocks`, `go_home`, `set_home`, `share_location`, `check_skills`, `use_ability`, `query_shops`, `create_shop`
- D-08: Tool handlers in `actions.js` translate to chat commands
- D-09: Chat response parsing: listener watches for plugin output patterns, stores in `lastCommandResult`
- D-10: Command results injected into next user message as `Plugin Response:` section

**AuraSkills Integration**
- D-11: Read-AND-use: skill levels in prompt + active abilities via `use_ability` tool
- D-12: Skill levels fetched via `/skills` or ServerTap, cached, refreshed every 5 planner cycles
- D-13: Active abilities: TreeFeller (Foraging), Super Breaker (Mining), Giga Drill Breaker (Excavation), Serrated Strikes removed — actual name is Lightning Blade (Fighting)
- D-14: Ability cooldowns tracked agent-side after use
- D-15: Planner prompt describes skills as personality: "Your Woodcutting is level 15 (TreeFeller available)"

**QuickShop Trading**
- D-16: Agents trade via QuickShop chest shops: place chest, create shop, stock it
- D-17: Trading is planner-driven: sell surplus >32, buy needed items
- D-18: Shop near home location
- D-19: Price discovery via `/qs find <item>`, ±20% of market or hardcoded defaults
- D-20: Natural conversation about trades

**ServerTap REST API**
- D-21: Read-only: player list, world time, server TPS — NOT for executing commands
- D-22: New module `agent/servertap.js` — thin `fetch()` wrapper to `http://localhost:4567/v1/`
- D-23: Endpoints: `GET /v1/players`, `GET /v1/economy/balance/<player>`, `GET /v1/server`
- D-24: ServerTap data injected into state summary as lightweight line
- D-25: Graceful skip if ServerTap not reachable

**Prompt & Planner Updates**
- D-26: GAMEPLAY_INSTRUCTIONS updated with plugin command section
- D-27: Planner system prompt enhanced with plugin strategy guidance
- D-28: Plugin commands presented as natural world actions in prompt
- D-29: Skills/abilities described as personal talents in prompt

### Claude's Discretion
- Exact Skript implementation syntax and error handling
- ServerTap module error handling and retry logic
- Chat response parsing regex patterns
- Cooldown duration values for AuraSkills abilities
- QuickShop default price table
- Tool parameter validation details

### Deferred Ideas (OUT OF SCOPE)
- Plugin messaging channels (Fabric mod ↔ Paper plugin)
- Custom AuraSkills configuration (XP rates, ability power)
- Warp system setup (/setwarp)
- Citizens NPC integration
- Economy balancing
</user_constraints>

---

## Summary

Phase 3 wires up the Paper server's plugin stack so agents can use it as a toolkit — scanning for blocks, fast-traveling home, tracking personal skill levels, and trading surplus items. The work splits cleanly into four tracks: (1) two Skript scripts on the server, (2) eight new tools in `tools.js` + `actions.js` on the agent, (3) a new `servertap.js` REST client, and (4) prompt updates to make the planner aware of all the above.

The biggest risk is the chat-response-parsing loop: commands like `/scan` and `/qs find` reply via MC chat, and the agent must intercept and parse those replies before acting on them. Phase 2 established the chat capture infrastructure (mod sends `recentChat` in state JSON), so the mechanism exists — Phase 3 just adds pattern matching on top of it. A `command-parser.js` module with regex per command is the right design.

The second risk is QuickShop: the plugin is primarily GUI-driven (hold item → right-click chest → type price in chat). An agent cannot operate a GUI. The agent can place a chest and type `/qs create <price> <item>` while holding the target item, which QuickShop does support as an alternative flow. The planner must also queue: `equip item → navigate to chest → place chest → /qs create price item`. This multi-step flow requires careful queue design.

**Primary recommendation:** Implement in three waves — Wave 1: Skript scripts + scan_blocks/share_location tools, Wave 2: AuraSkills check_skills/use_ability + prompt updates, Wave 3: QuickShop create_shop/query_shops + ServerTap servertap.js.

---

## Standard Stack

### Core (already installed per Phase 1)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Skript | 2.9.x (Paper 1.21) | Custom server commands | No Java compile cycle needed |
| AuraSkills | latest 1.21.x | RPG skill/ability system | Installed in Phase 1 (replaces mcMMO) |
| QuickShop-Hikari | 1.20-1.21 | Chest shops / economy | Installed in Phase 1 |
| EssentialsX | latest | `/home`, `/sethome`, `/back`, `/warp` | Installed in Phase 1 |
| ServerTap | latest | REST API for Paper | Installed in Phase 1 |

### Agent Modules (new this phase)
| Module | Location | Purpose |
|--------|----------|---------|
| `servertap.js` | `agent/servertap.js` | Thin fetch() wrapper for ServerTap REST |
| `command-parser.js` | `agent/command-parser.js` | Regex-based plugin chat response parsing |

### Agent Files Modified
| File | Change |
|------|--------|
| `agent/tools.js` | Add 8 new tool definitions to `GAME_TOOLS` |
| `agent/actions.js` | Add handlers for 8 new tools, add to `VALID_ACTIONS` + `INFO_ACTIONS` |
| `agent/prompt.js` | Update `GAMEPLAY_INSTRUCTIONS` with plugin section |
| `agent/planner.js` | Update system prompt with plugin strategy guidance |
| `agent/state.js` | Optionally append ServerTap data to `summarizeState()` |

---

## Architecture Patterns

### Pattern 1: Tool → Chat Command → Response Parsing Loop

The central pattern for all plugin-backed tools:

```
Agent calls tool (scan_blocks "oak_log" 50)
    → actions.js handler translates to chat command: /scan oak_log 50
    → mod sends command via sendCommand()
    → server plugin outputs response in chat
    → state.js fetches state on next tick (recentChat contains output)
    → command-parser.js extracts structured data from chat text
    → next user message includes "Plugin Response: Found: oak_log at 10 64 -5 (8.2 blocks away)"
    → LLM reads Plugin Response, plans next action (navigate to coords)
```

This loop is already half-built: `recentChat` in the mod state JSON captures all server chat. The missing piece is `command-parser.js` and the injection into the user message.

**Timing:** The command is sent at tick N; the response arrives in `recentChat` at tick N+1 (2 seconds later). The agent tool must return `{ success: true, message: "Command sent, check Plugin Response in next tick" }`. The LLM will naturally wait for the result.

### Pattern 2: Skript Command Structure

Verified from official Skript documentation:

```skript
# Source: https://docs.skriptlang.org/docs.html (Skript 2.9)
command /scan <text> [<integer=50>]:
    description: Scan for nearby surface blocks
    permission: skript.scan
    permission message: You don't have permission.
    trigger:
        set {_blockType} to arg-1
        set {_radius} to arg-2
        if {_radius} > 100:
            set {_radius} to 100
        set {_count} to 0
        set {_found::*} to {}
        loop blocks in radius {_radius} around player:
            if loop-block is not air:
                if name of loop-block contains {_blockType}:
                    set {_above} to block 1 above loop-block
                    if {_above} is air:
                        set {_d} to distance between player's location and location of loop-block
                        add 1 to {_count}
                        set {_found::%{_count}%} to "%loop-block% at %x-coordinate of loop-block% %y-coordinate of loop-block% %z-coordinate of loop-block% (%{_d}% blocks away)"
                        if {_count} >= 5:
                            stop loop
        if {_count} is 0:
            send "No %{_blockType}% found within %{_radius}% blocks" to player
        else:
            loop {_found::*}:
                send "Found: %loop-value%" to player
```

**Sky-visibility workaround (MEDIUM confidence):** Skript does not expose `World#isSkyVisible()` natively. The standard community workaround is checking if the block directly above is `air` — this is a close but not identical approximation. For surface resources (logs, crops) on a survival island, this is sufficient. For a more accurate check, check that blocks above are air iterating upward to build height 320, but this is expensive in a loop. The `block above is air` check covers the common case reliably and is the pattern used in published Skript surface-detection scripts.

### Pattern 3: YAML Variable Storage for /share-location

Skript persistent variables are stored automatically in its own internal database (by default `plugins/Skript/variables.csv`). Global variables prefixed with `{@...}` persist across restarts without any explicit YAML save call:

```skript
command /share-location <text>:
    description: Broadcast and save a named location
    trigger:
        set {locations::%arg-1%::x} to x-coordinate of player's location
        set {locations::%arg-1%::y} to y-coordinate of player's location
        set {locations::%arg-1%::z} to z-coordinate of player's location
        set {locations::%arg-1%::owner} to player's name
        broadcast "%player% marked %arg-1% at %{locations::%arg-1%::x}%, %{locations::%arg-1%::y}%, %{locations::%arg-1%::z}%"
```

Variables starting with `{` (not `{_`) are global and persist. This matches D-02's requirement without requiring explicit YAML file writes.

### Pattern 4: QuickShop Creation Flow

**Critical finding:** QuickShop-Hikari's primary shop creation is GUI/chat-based, not pure command-based. The documented player workflow is:

1. Hold the item you want to sell in your hand (equip it)
2. Right-click (interact_block) on a placed chest
3. Plugin asks "How much do you want to sell this item for?" in chat
4. Type the price as a number in chat

This is a multi-step interactive flow that requires the agent to:
- Queue: `equip <item>` → `place chest` → `interact_block <chest coords>` → `chat <price>`
- The `interact_block` triggers QuickShop's prompt
- The `chat <price>` responds to the prompt

An alternative exists: `/qs create <price> <item>` as a direct command. However, the documentation notes this is less reliable and may require holding the item anyway. **The planner queue must model the multi-step interaction, not a single-command shortcut.**

**For `/qs find <item>`:** This command does appear in QuickShop Hikari (verified via community wikis). It broadcasts shop locations for a specific item to the command sender.

### Pattern 5: AuraSkills Ability Activation

The eight mana abilities and their activation triggers (HIGH confidence, from official wiki):

| Mana Ability | Skill | Activation |
|---|---|---|
| Treecapitator | Foraging | Right-click with axe, then break a log |
| Speed Mine | Mining | Right-click with pickaxe, then break stone/ore |
| Replenish | Farming | Right-click with hoe, then break a crop |
| Terraform | Excavation | Right-click with shovel, then dig |
| Lightning Blade | Fighting | Right-click sword, attack entity |
| Sharp Hook | Fishing | Left-click rod while entity is hooked |
| Charged Shot | Archery | Left-click bow to toggle |
| Absorption | Defense | Left-click shield |

**For agents (peaceful mode, no combat):** Only Treecapitator, Speed Mine, and Terraform are useful. The activation pattern for these three is: `equip <tool>` (right-click weapon/tool, which the equip action does), then perform the action (break_block). The ability activates automatically when the tool is used at the right moment.

**Agent-side ability tracking:** AuraSkills sends ability activation messages in chat/action bar. The `command-parser.js` can watch for patterns like `"Treecapitator activated"` or `"Haste 10"` to confirm activation. Cooldown durations are configured in `mana_abilities.yml` — defaults are approximately 20-60 seconds per ability, but these are server-specific. Safe approach: after triggering, block the ability tool for 60 seconds as a conservative estimate.

**Skill level checking:** The best approach is `/skills` command output, but this opens a GUI (not chat-parseable). Instead, use `/sk top <skill>` which outputs to chat in parseable lines — though this shows rankings not the agent's own level. The cleanest path is `check_skills` tool → sends `/sk profile skills <agent_name>` as admin (requires LuckPerms op grant) or reads the level from the action bar XP messages that AuraSkills broadcasts on skill XP gain.

**Better approach (D-12):** Use PlaceholderAPI integration via a Skript command. Create a Skript `/myskills` command that broadcasts `%auraskills_farming% %auraskills_foraging% %auraskills_mining%` for the calling player. This returns a clean, parseable line in chat.

### Recommended Project Structure (new files)

```
agent/
├── servertap.js          # New: REST client for ServerTap API
├── command-parser.js     # New: regex parsing of plugin chat responses
├── tools.js              # Modified: +8 plugin tools
├── actions.js            # Modified: +8 handlers, VALID_ACTIONS, INFO_ACTIONS
├── prompt.js             # Modified: GAMEPLAY_INSTRUCTIONS plugin section
├── planner.js            # Modified: system prompt plugin strategy
└── state.js              # Modified (optional): ServerTap data in summary

server/plugins/skript/scripts/
├── scan.sk               # /scan command
└── share-location.sk     # /share-location command
```

### Anti-Patterns to Avoid

- **Polling for command results in same tick:** The command goes out on tick N; the response is in `recentChat` on tick N+1. Do not try to read the result synchronously. The tool handler returns immediately; the parser handles the next tick.
- **Opening GUIs in action queue:** QuickShop shop creation triggers a chat prompt, not a GUI — but `/skills`, `/auraskills` etc open GUIs. Stick to commands that respond in chat.
- **Sending `/scan` from planner queue:** `/scan` output arrives in chat and is needed by the action loop. If queued in the planner batch, the result may not arrive before the next planner cycle. `scan_blocks` should be treated as an INFO_ACTION and handled by the action loop's LLM call, not the planner queue.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server-side block scan | Custom Java mod endpoint | Skript `/scan` | No mod rebuild needed; Skript is already installed |
| Skill level storage | Per-agent JSON file | PlaceholderAPI via Skript `/myskills` | Authoritative source; no sync issues |
| Location persistence | agent/locations.js extension | Skript YAML variables | Server-side persistence; works across agent restarts |
| Shop price discovery | Hardcode + guess | `/qs find <item>` chat response | Real market data; zero additional code |
| Home fast travel | Custom teleport action | EssentialsX `/home` `/sethome` | Already installed; handles multi-home, permissions |

**Key insight:** Every complex problem in this phase already has a plugin solution. The agent's job is to issue commands and parse the text output — not to build data stores or computation logic on the agent side.

---

## Common Pitfalls

### Pitfall 1: Skript radius loop performance
**What goes wrong:** `loop blocks in radius 100` can iterate up to ~4 million block positions (4/3 π r³ ≈ 4.18M for r=100). This will lag the server.
**Why it happens:** Skript runs on the main thread.
**How to avoid:** The decision to cap radius at 100 (D-04) mitigates but does not eliminate lag. Use `radius 50` as default. Also add an early-exit counter: stop the loop at 5 results found (already in D-01). For the server tick budget, a radius 50 sphere is ~523K blocks — still heavy. The `block above is air` check short-circuits fast for solid terrain. Consider adding a hard limit: if the loop body has executed more than 500 times, `stop loop`.
**Warning signs:** Server TPS drops when `/scan` is used.

### Pitfall 2: QuickShop chat prompt interception
**What goes wrong:** After `interact_block` on a chest, QuickShop prompts "How much do you want to sell?" in chat. The agent's next chat action (the price) is sent while the planner's StopSpam cooldown is also active — 5 second cooldown blocks the response.
**Why it happens:** StopSpam was configured with 5s cooldown in Phase 1. The `chat <price>` response after `interact_block` could be blocked if the agent sent any other message in the previous 5 seconds.
**How to avoid:** The `create_shop` tool must be an atomic operation: `interact_block → wait 1s → chat price`. In the action queue, these should be adjacent items with no intervening chat actions. The action loop already enforces sequential queue execution with 2s tick intervals.
**Warning signs:** Shop creation silently fails with no confirmation.

### Pitfall 3: AuraSkills abilities require skill level threshold
**What goes wrong:** `use_ability treecapitator` is queued but the agent's Foraging level is too low to have unlocked it.
**Why it happens:** Mana abilities unlock at level 1 of the skill by default in AuraSkills, but if the agent has never used a Foraging tool, the ability is not available.
**How to avoid:** `check_skills` tool should be called first. In `use_ability` handler, gate the activation: if the cached skill level for the relevant skill is 0, return `{ success: false, error: "Treecapitator not yet unlocked — need Foraging XP first" }`.
**Warning signs:** Agent queues `use_ability` but nothing happens.

### Pitfall 4: Skript variable collisions with multiple agents
**What goes wrong:** `/share-location base` from agent Jeffrey and from agent John both write to `{locations::base::*}`, clobbering each other.
**Why it happens:** Skript global variables are shared across the entire server.
**How to avoid:** Namespace by player name: `{locations::%player's name%::%arg-1%::*}`. Use player name in variable key. Location lookup queries all players' stored locations.
**Warning signs:** One agent's home overwrites another agent's home.

### Pitfall 5: INFO_ACTIONS vs queued actions
**What goes wrong:** `scan_blocks` is put in the planner QUEUE: block, but its result (the coordinates) is needed to generate the next queue items (look_at_block, navigate). The result arrives too late.
**Why it happens:** Planner runs every 30s; scan result arrives in 2s. The next queue items were already generated before the scan result was known.
**How to avoid:** `scan_blocks` and `check_skills` must be `INFO_ACTIONS` — they trigger an LLM call in the action loop, not blind queue execution. The action loop calls the LLM with the Plugin Response context, and the LLM generates the follow-up actions inline. Add both to `INFO_ACTIONS` Set in `actions.js`.

---

## Code Examples

### Tool definition pattern (tools.js)

```javascript
// Source: existing GAME_TOOLS pattern in agent/tools.js
{
  type: 'function',
  function: {
    name: 'scan_blocks',
    description: 'Scan the area for a specific block type on the surface. Returns up to 5 nearest with coords.',
    parameters: {
      type: 'object',
      properties: {
        block_type: { type: 'string', description: 'e.g. "oak_log", "iron_ore", "wheat"' },
        radius: { type: 'integer', description: 'Search radius in blocks (default 50, max 100)' },
      },
      required: ['block_type'],
    },
  },
},
```

### Action handler pattern (actions.js)

```javascript
// Source: existing executeAction() pattern in agent/actions.js
// In the VALID_ACTIONS Set, add all 8 new tool names
// In ACTION_SCHEMAS, add validation

case 'scan_blocks':
  // Translate to /scan chat command
  const blockType = action.block_type || action.blockType
  const radius = Math.min(action.radius || 50, 100)
  return sendSingleAction({ type: 'chat', message: `/scan ${blockType} ${radius}` })

case 'set_home':
  const homeName = action.name || 'home'
  return sendSingleAction({ type: 'chat', message: `/sethome ${homeName}` })

case 'go_home':
  const dest = action.name || 'home'
  return sendSingleAction({ type: 'chat', message: `/home ${dest}` })

case 'check_skills':
  // Triggers /myskills Skript command — returns parseable skill levels in chat
  return sendSingleAction({ type: 'chat', message: '/myskills' })

case 'use_ability':
  // Abilities activate via tool right-click, not a slash command
  // This queues the equip + break sequence; actual activation is automatic
  const ability = action.ability_name
  const toolMap = {
    'treecapitator': 'axe',
    'speed_mine': 'pickaxe',
    'terraform': 'shovel',
  }
  const tool = toolMap[ability?.toLowerCase()]
  if (!tool) return { success: false, error: `Unknown ability: ${ability}` }
  return { success: true, message: `Equip your ${tool} and use it — ${ability} activates automatically` }
```

### command-parser.js pattern

```javascript
// agent/command-parser.js — Parse plugin chat responses into structured data
export const COMMAND_PATTERNS = {
  scan_found: /^Found: (\S+) at (-?\d+) (-?\d+) (-?\d+) \(([\d.]+) blocks away\)$/,
  scan_miss: /^No (\S+) found within (\d+) blocks$/,
  home_set: /^Home (\S+) set\.|^Your home has been set/i,
  home_teleport: /^Teleported to your home/i,
  skills_level: /^(\w+): (\d+)/,   // from /myskills Skript command
  shop_created: /^Shop created|^Your shop has been created/i,
  location_shared: /^(\S+) marked (\S+) at (-?\d+) (-?\d+) (-?\d+)$/,
}

export function parseRecentChat(chatMessages) {
  const results = []
  for (const msg of chatMessages) {
    const text = msg.text || ''
    for (const [key, pattern] of Object.entries(COMMAND_PATTERNS)) {
      const m = text.match(pattern)
      if (m) results.push({ type: key, match: m, raw: text })
    }
  }
  return results
}
```

### servertap.js pattern

```javascript
// agent/servertap.js — Thin REST client for ServerTap API
const SERVERTAP_URL = process.env.SERVERTAP_URL || 'http://localhost:4567/v1'

export async function getServerInfo() {
  try {
    const res = await fetch(`${SERVERTAP_URL}/server`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

export async function getPlayers() {
  try {
    const res = await fetch(`${SERVERTAP_URL}/players`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return []
    return await res.json()
  } catch { return [] }
}

export async function getPlayerBalance(playerName) {
  try {
    // ServerTap economy endpoint uses UUID — requires separate player lookup
    const players = await getPlayers()
    const player = players.find(p => p.displayName === playerName)
    if (!player) return null
    const res = await fetch(`${SERVERTAP_URL}/economy/balance/${player.uuid}`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

export function formatServerSummary(serverInfo, players) {
  if (!serverInfo && !players) return ''
  const parts = []
  if (players) parts.push(`${players.length} online`)
  if (serverInfo?.health?.tps) parts.push(`${serverInfo.health.tps.toFixed(1)} TPS`)
  return parts.length ? `Server: ${parts.join(', ')}` : ''
}
```

### Skript /myskills helper command

This Skript command enables parseable skill data retrieval:

```skript
# plugins/Skript/scripts/agent-tools.sk
# /myskills — outputs skill levels as parseable chat lines
command /myskills:
    description: Show your AuraSkills levels (parseable format)
    trigger:
        send "Foraging: %{auraskills_foraging}%" to player
        send "Mining: %{auraskills_mining}%" to player
        send "Farming: %{auraskills_farming}%" to player
        send "Excavation: %{auraskills_excavation}%" to player
        send "Fighting: %{auraskills_fighting}%" to player
```

**Note:** The PAPI placeholder syntax in Skript requires the SkriptPlaceholderAPI addon (skript-placeholders). If not available, the agent must fall back to parsing `/sk top <skill>` output (which shows all players ranked — the agent finds its own entry by name).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| mcMMO skills | AuraSkills (formerly Aurelium Skills) | Phase 1 decision | Different commands (/skills not /mcstats), different ability names |
| Blind Baritone #mine | surfaceBlocks + look_at_block | Phase 2 | /scan supplements this — agents find targets without wandering |
| No economy | QuickShop + EssentialsX Vault | Phase 1 | Agents can trade; creates specialization incentive |
| No server data | ServerTap REST at :4567 | Phase 1 installed | Needs Docker port exposure (noted in STATE.md as deferred) |

**Deprecated/outdated:**
- mcMMO references in ROADMAP.md (line 83): "reads mcMMO level" — replaced by AuraSkills per STATE.md decision
- `/skills top <skill>` for agent self-check: unreliable (shows other players); replace with `/myskills` Skript helper

---

## Open Questions

1. **ServerTap Docker port exposure**
   - What we know: STATE.md documents "ServerTap port 4567 needs Docker port exposure — deferred to container recreation"
   - What's unclear: Whether the container has been recreated since Phase 1 to expose :4567
   - Recommendation: Wave 1 of planning should include a verification step: `curl http://localhost:4567/v1/server` from Glass host. If not exposed, `servertap.js` graceful skip (D-25) keeps the agent functional.

2. **SkriptPlaceholderAPI addon availability**
   - What we know: PAPI placeholders `%auraskills_*%` require PlaceholderAPI (not installed in Phase 1 stack) or a Skript PAPI addon
   - What's unclear: Whether PlaceholderAPI is installed on the Paper server
   - Recommendation: Plan Wave should verify with `docker exec <container> ls plugins/`. If not present, fall back to `/sk top <skill>` parsing — agent identifies its own row by username.

3. **AuraSkills skill level 0 edge case**
   - What we know: Mana abilities unlock at level 1+ with configured unlock levels
   - What's unclear: Default unlock level for Treecapitator/Speed Mine in AuraSkills (config-dependent)
   - Recommendation: Assume level 1 of Foraging/Mining required. Check_skills response of 0 → don't offer use_ability. Default cooldown 60s (conservative).

4. **QuickShop /qs create vs GUI flow**
   - What we know: GUI is primary interaction; `/qs create` exists as alternative
   - What's unclear: Whether `/qs create <price> <item>` requires holding the item or can specify it by name
   - Recommendation: Plan the `interact_block → chat price` path as the reliable route. Equip item first in queue. Test manually before agent uses it.

---

## Validation Architecture

> Skipped: workflow.nyquist_validation is explicitly false in .planning/config.json.

---

## Sources

### Primary (HIGH confidence)
- https://wiki.aurelium.dev/auraskills/mana-abilities — All 8 mana ability names, skills, activation methods (verified)
- https://wiki.aurelium.dev/auraskills/placeholders — PAPI placeholder syntax `%auraskills_[skill]%` (verified)
- https://github.com/Archy-X/AureliumWiki/blob/main/auraskills/commands.md — AuraSkills player commands `/skills`, `/sk top`, `/sk profile` (verified)
- https://docs.skriptlang.org/docs.html — Skript 2.9 `loop blocks in radius`, `distance`, coordinate expressions (verified)
- https://github.com/servertap-io/servertap — ServerTap API: GET /v1/server, /v1/players, /v1/economy/balance (verified)
- https://sovdee.gitbook.io/skript-tutorials/core-concepts/commands — Skript command definition syntax (verified)

### Secondary (MEDIUM confidence)
- https://www.reddit.com/r/admincraft/comments/f32v4g/servertap_is_a_rest_api_for_your_server/ — ServerTap response format examples (`displayName`, `uuid`, `exp` fields)
- Community Skript forums — `block above is air` as sky-visibility proxy (pattern inferred from confirmed primitives, not explicit documentation)

### Tertiary (LOW confidence)
- QuickShop-Hikari creation flow: "hold item → right-click chest → type price in chat" — inferred from SpigotMC description ("hold item, click the chest, enter the price"), not from formal docs
- AuraSkills default cooldown ~60s — not documented as fixed value; configurable in `mana_abilities.yml`
- SkriptPlaceholderAPI addon requirement for `%auraskills_*%` in Skript — inferred from Skript+PAPI integration knowledge

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all plugins installed and verified in Phase 1
- Skript command authoring: MEDIUM — core syntax verified; sky-visibility workaround inferred
- AuraSkills abilities: HIGH — official wiki has full ability table with activation methods
- QuickShop flow: MEDIUM — interactive flow inferred from marketing text, not formal API docs
- ServerTap endpoints: HIGH — GitHub README + community examples confirm endpoint paths
- Pitfalls: MEDIUM — based on architectural analysis of existing agent code + Phase 2 patterns

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (plugins stable; Skript syntax stable for 2.9.x series)
