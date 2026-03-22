# Feature Research: Mineflayer Mind + Body Architecture

**Domain:** LLM-driven Minecraft agent — Mineflayer skill library, Mind loop design, LLM-to-skill interface
**Researched:** 2026-03-22
**Confidence:** HIGH for skill inventory (verified against Mindcraft skills.js, world.js, modes.js, actions.js, queries.js source); HIGH for Mind loop design (Mindcraft agent.js, self_prompter.js, action_manager.js); MEDIUM for "feels human" patterns (observed in code but not benchmarked)

---

## Context: What We Learned From Real Source Code

Research covered the actual source files of Mindcraft (kolbytn/mindcraft), its community fork (mindcraft-ce), and Voyager (MineDojo/Voyager). All function names and patterns below are from real code, not inferred.

**Key insight:** Mindcraft uses a two-tier interface — parameterized `!commands` the LLM calls by name (e.g., `!collectBlocks("oak_log", 4)`) for routine actions, plus a `!newAction` escape hatch that drops the LLM into code generation mode (JavaScript that calls `skills.*` functions directly) for complex tasks the command palette can't express. The Body runs fully autonomous between LLM decisions. The LLM fires only on: message received, self-prompter tick, or idle event.

---

## Table Stakes

Features that every functional Mineflayer LLM agent must have. Without these, the Mind cannot meaningfully control the Body.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Block collection (`collectBlock`) | Primary resource loop — every MC agent needs to gather | MEDIUM | Mindcraft pattern: pathfind to nearest matching block, auto-select tool via `bot.tool.equipForBlock()`, call `bot.collectBlock.collect(block)`. Uses `mineflayer-collectblock` plugin |
| Block placement (`placeBlock`) | Agents that can't place blocks can't build | MEDIUM | Mindcraft pattern: break target if occupied, find adjacent solid block, equip item, call `bot.placeBlock(refBlock, faceVec)`. Auto-equip is atomic with placement — never split |
| Navigation (`goToPosition`, `goToNearestBlock`) | Every multi-step task requires movement | LOW | mineflayer-pathfinder with `GoalNear`. Navigate-before-interact is a hard rule — never assume proximity |
| Crafting with recipe resolution (`craftRecipe`) | Crafting is core progression | MEDIUM | Mindcraft pattern: query `bot.recipesFor()` without table first, search for crafting table if needed, navigate to it, craft. Must handle "no recipe found" gracefully |
| Smelting (`smeltItem`) | Iron, cooked food, glass — essential tier 2 | MEDIUM | Find furnace, navigate to it, insert ore + fuel, wait for output, collect |
| Inventory management (`equip`, `discard`, `consume`) | Agent must manage its own hotbar | LOW | `equip` puts armor on or readies tools. `consume` eats food. `discard` drops overflow |
| Self-defense (`defendSelf`) | Survival without requiring LLM decision every hit | MEDIUM | Mindcraft modes.js `self_defense`: auto-fires when hostile mobs within 8 blocks, interrupts all actions. Uses `mineflayer-pvp` plugin |
| Self-preservation mode | Agent must not drown, burn, fall to death | MEDIUM | Mindcraft `self_preservation` mode: monitors drowning, fire, critical health (<5 HP). Jumps when submerged, places water bucket when burning, flees at critical health. Interrupts everything |
| Chest interaction (`putInChest`, `takeFromChest`) | Storage and multi-agent item exchange | MEDIUM | Navigate to chest, open container window, transfer items. Mindcraft has `viewChest` too. Must handle "no chest found" case |
| World state queries (`nearbyBlocks`, `inventory`, `entities`) | LLM must observe before deciding | LOW | These are the LLM's eyes. Mindcraft exposes: `!stats` (position, health, hunger, time), `!inventory`, `!nearbyBlocks`, `!entities`, `!craftable`, `!savedPlaces` |
| Chat send/receive | Agents must communicate naturally | LOW | `bot.chat()` for output; message event listener for input. Multi-agent chat needs routing so bots don't respond to each other's spam |
| Goal persistence (`!goal` command) | LLM sets an ongoing objective, self-prompts toward it | MEDIUM | Mindcraft self_prompter: when `!goal` issued, enters continuous loop. After each skill execution, re-prompts LLM with "your goal is X, what next?" Every 2s cooldown between prompts |
| `!stop` interrupt | User or system can halt all executing actions | LOW | Mindcraft makes `!stop` unblockable — highest priority, always clears action queue |
| Unstuck detection | Agent gets stuck behind blocks, in water, on ledges | LOW | Mindcraft `unstuck` mode: monitors position every 20s, triggers `moveAway()` if no position change. Critical for unsupervised operation |

---

## Differentiators

Features that separate "agent that runs commands" from "agent that plays like a person."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Autonomous background modes | Body handles survival while Mind focuses on goals | MEDIUM | Mindcraft modes system: `self_preservation`, `unstuck`, `self_defense`, `hunting`, `item_collecting`, `torch_placing`, `elbow_room`, `idle_staring`. Each mode runs on 300ms Body tick, fires only when conditions met, can interrupt foreground action |
| Idle staring (look around naturally) | Bot looks at nearby entities/players when doing nothing — core "feels alive" signal | LOW | Mindcraft `idle_staring` mode: when idle, track nearby entities visually or look in random direction every 2-12 seconds. Costs nothing, has outsized human-feeling impact |
| Elbow room (personal space behavior) | Bot naturally moves away from clustering players rather than standing frozen | LOW | Mindcraft `elbow_room` mode: detects nearby players while idle, moves away with randomized delay to prevent synchronized movement with other bots |
| Day/night routine (NPC controller) | Bot goes home at dusk, sleeps, exits in morning — human daily cycle | MEDIUM | Mindcraft npc/controller.js: `do_routine` flag. Before tick 13000 (day): work goals. After tick 13000 (dusk): navigate home, go to bed. Resets current goal on new day |
| Saved places memory (`!rememberHere`) | Bot can name and navigate back to locations — base, mine, farm | LOW | Mindcraft `rememberHere`/`goToRememberedPlace` commands. Persistent location store. Required for home base, resource depots, multi-agent rendezvous points |
| `!newAction` code generation escape hatch | For complex tasks not coverable by command palette, LLM generates JavaScript | HIGH | Mindcraft coder.js: `!newAction` drops LLM into code mode with access to `skills.*` and `world.*`. Up to 5 attempts with error feedback loop. Different model can be used for code vs chat. HermesCraft does NOT need to replicate full Voyager-style code gen — parameterized commands cover 90% of cases |
| Item auto-collect (idle) | Picks up dropped items while idle — no LLM decision needed | LOW | Mindcraft `item_collecting` mode: 2s wait after spotting dropped items, then collect if inventory space available. Interrupts followPlayer only |
| Torch placement (idle) | Places torches in dark areas while exploring — background ambiance + practical | LOW | Mindcraft `torch_placing` mode: when idle and nearby light level insufficient, places torch. 5s cooldown. Requires torch in inventory |
| Hunting (idle) | Pursues and kills animals when idle — provides food autonomously | LOW | Mindcraft `hunting` mode: targets huntable animals within 8 blocks when idle. Interrupts followPlayer only |
| Crafting plan query (`!getCraftingPlan`) | Before attempting craft, agent can query what ingredients are needed recursively | MEDIUM | Mindcraft query command: given target item + quantity, returns full ingredient breakdown. Prevents "try to craft, fail, confused" loop |
| Natural chat timing (multi-agent) | Bots don't talk over each other; delayed response if busy | LOW | Mindcraft conversation.js: if both idle → 200ms response delay. If other bot busy → 5s delay. If current bot busy → check if action allows interruption. Self-prompter pauses during conversation |
| Villager trading (`showVillagerTrades`, `tradeWithVillager`) | End-game economy interaction — rare but expected in a full playthrough | MEDIUM | Mindcraft has both commands. Exposes trade index system. Not required for MVP but expected for Ender Dragon completion |
| Bed sleeping (`goToBed`) | Skip night, avoid phantoms — real player behavior | LOW | Navigate to nearest bed, sleep. Mindcraft NPC controller does this as part of day/night routine |
| Surface escape (`goToSurface`, `digDown`) | Recovery from underground situations | LOW | `goToSurface`: navigate upward to highest block above. `digDown`: excavate straight down with hazard avoidance (lava check) |

---

## Anti-Features

These seem useful but create more problems than they solve.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| LLM generates coordinate arrays for building | "Let the LLM design the build freely" | LLM coordinate hallucination is primary failure mode. T2BM (2024) showed 38% success rate with GPT-4 + repair modules even when coordinates are the only variable. Free coordinate generation → near-0% | LLM describes build in natural language (dimensions, style, materials). Deterministic code translates to block positions. Use Mindcraft's `placeBlock(blockType, x, y, z)` with computed positions |
| Continuous LLM polling (tick-locked) | "LLM should decide every game tick" | v1.0 architecture showed this is the root cause of: race conditions, context overflow, token cost explosion, agent paralysis during skill execution | Mind fires on events only: message received, idle event, self-prompter tick (with cooldown). Body runs autonomously |
| Per-tick world snapshot injection | Inject full world state every LLM call for maximum context | Context window bloat — at 2s ticks with 10 query functions each returning 20+ lines, history fills in minutes. Cost scales with model calls | Lazy queries: LLM calls `!nearbyBlocks` / `!entities` explicitly when it needs info. State is pulled, not pushed |
| Global action lock ("one action at a time" strictly) | Prevents races | In v1.0, "Another action pending" errors paralyzed agents for minutes | Mindcraft action_manager.js pattern: timeout protection (10 min default), fast-action loop detection (<20ms), graceful stop with 10s forced termination. Resume on idle event |
| Separate vision loop (screenshot-based) | See what the bot sees | 1GB+ RAM per agent, Xvfb required, Claude Haiku cost per tick. v1.0 result: agents narrated fantasy while placements failed | Mineflayer provides world state directly: `bot.blockAt()`, `bot.nearestEntity()`, `bot.inventory`. No camera needed |
| Fabric mod + HTTP bridge | "More control over MC internals" | v1.0 root cause: crosshair drift, coordinate translation bugs, race conditions, 1GB RAM per agent | Mineflayer: `bot.dig(block)` just works, `bot.placeBlock()` just works, no HTTP, no bridge |
| Baritone for pathfinding | "Human-like movement patterns" | Baritone routes underground regardless of surface intent, breaks blocks mid-path, causes 300-block cave wanders | mineflayer-pathfinder: A* pathfinding, `GoalNear`, `GoalFollow`, `GoalSurface`. Sufficient for all observed HermesCraft navigation needs |
| Mineflayer-smooth-look for all movement | Smooth head turning like a real player | Adds dependency and timing complexity. Main value is in PvP scenarios. Paper server likely has anti-cheat that flags inhuman packet timing | Use standard `bot.look()`. For idle behavior, `idle_staring` mode provides the visual "aliveness" without smooth-look overhead |

---

## The Two-Tier LLM-to-Skill Interface (Critical Design)

This is the core architectural insight from Mindcraft source analysis. Not a feature — the interface contract.

### Tier 1: Parameterized Commands (90% of cases)

The LLM outputs `!commandName("arg1", arg2)` syntax. The Body parses, validates, and dispatches to skill functions. LLM never touches mineflayer API directly.

**Query commands** (observation, no action):
- `!stats` — position, health, hunger, time of day
- `!inventory` — full item counts
- `!nearbyBlocks` — blocks within radius
- `!entities` — nearby mobs and players
- `!craftable` — what can be crafted right now
- `!savedPlaces` — named locations
- `!getCraftingPlan(item, qty)` — ingredient breakdown

**Action commands** (Body executes autonomously):
- Navigation: `!goToCoordinates(x,y,z)`, `!searchForBlock(type)`, `!goToPlayer(name)`, `!followPlayer(name)`, `!goToRememberedPlace(name)`, `!goToSurface`, `!moveAway(dist)`
- Collection: `!collectBlocks(type, num)`
- Crafting: `!craftRecipe(item, num)`, `!smeltItem(item, num)`, `!clearFurnace`
- Storage: `!putInChest(item, num)`, `!takeFromChest(item, num)`, `!viewChest`
- Combat: `!attack(mobType)`, `!attackPlayer(name)`
- Inventory: `!equip(item)`, `!discard(item, num)`, `!consume(item)`, `!givePlayer(item, name, num)`
- Build: `!placeHere(blockType)` (single block — complex building uses Tier 2)
- Utility: `!rememberHere(name)`, `!goToBed`, `!digDown(dist)`, `!stay(secs)`, `!stop`
- Social: `!startConversation(botName)`, `!endConversation`

### Tier 2: Code Generation (10% of cases, complex tasks)

`!newAction` drops LLM into code-gen mode. LLM writes JavaScript with access to `skills.*` and `world.*`. Body executes in sandboxed compartment. Up to 5 retry attempts with error feedback. Requires a dedicated `code_model` (can be different, more capable model than chat model).

**Use for:** Complex building sequences, multi-step automated farms, novel tasks not in command palette.

**Do not use for:** Anything achievable with Tier 1 commands. Code gen is expensive and error-prone with smaller models.

---

## Mind Loop Design

Based on Mindcraft agent.js, self_prompter.js, action_manager.js source analysis.

### Core Loop

```
Body tick: every 300ms
  - Run all enabled modes (self_preservation, unstuck, self_defense, etc.)
  - If mode fires → interrupt current action, execute mode behavior
  - If idle event → wait 5s, then execute next queued goal

LLM fires on events (not on timer):
  1. Incoming chat message → handleMessage() → prompter.promptConvo(history)
  2. !goal set → self_prompter activates → loop: prompt LLM, execute command, 2s cooldown, repeat
  3. Bot becomes idle (action completed) → if self_prompter active → re-prompt
  4. No command used 3 consecutive prompts → self_prompter stops automatically
```

### Key Design Rules (from source analysis)

1. **LLM must use a command every response** — Mindcraft uses `tool_choice: required` equivalent: if 3 consecutive responses contain no `!command`, self-prompting stops. Prevents rambling.
2. **Action output caps at 500 chars** — action_manager.js truncates execution output before feeding back to LLM. Prevents history bloat.
3. **Memory summarization on overflow** — history.js: when `max_messages` reached, oldest 5 messages summarized via LLM into 500-char summary, appended to full history file.
4. **2000ms minimum between self-prompts** — prevents LLM spam when actions complete quickly.
5. **Conversations pause self-prompter** — bot stops autonomous behavior to respond to players. Self-prompter resumes 5s after conversation ends.
6. **20-second unstuck threshold** — position sampled every Body tick; if no change for 20s, `unstuck` mode fires.

### What Makes 15-30s Feel Right

HermesCraft's PROJECT.md targets 15-30s Mind decisions. Mindcraft doesn't have a fixed interval — it's event-driven with 2s minimum cooldown. In practice, skill execution takes 5-30 seconds (pathfinding + collecting + crafting). The effective decision rate naturally lands in the 15-30s range when skill execution time is factored in. This is the right model: **don't set a timer, let skill completion drive re-prompting.**

---

## What Makes a Bot Feel Human vs Robotic

Based on Mindcraft modes.js, npc/controller.js, conversation.js, and skills.js source analysis. These are implemented behaviors, not aspirational.

### Highest Impact (do first)

1. **Idle staring** — bot looks at nearby entities and players while doing nothing. Single mode, zero skill cost. Most visible "aliveness" signal. Mindcraft updates look target every 2-12 seconds with randomized timing.

2. **Elbow room** — bot moves away from clusters of players when idle. Randomized delay prevents synchronized movement with other bots. Eliminates "bot standing frozen next to you" uncanny valley.

3. **Day/night routine** — bot goes home at dusk, sleeps, exits at dawn. Directly matches human play patterns. Requires: saved home location + `goToBed` skill + NPC controller.

4. **Chat response timing** — bot doesn't respond instantly (200ms delay when idle). Doesn't respond while busy with important actions. Pauses goals to have conversations. Matches human "finishing what I was doing" behavior.

### Medium Impact (add after core works)

5. **Autonomous survival** — self_preservation fires before LLM knows there's danger. Bot dodges, flees, heals without asking permission. Looks reactive and alive.

6. **Item collection while passing by** — `item_collecting` mode: bot notices dropped items, waits 2 seconds (natural hesitation), picks them up. Not aggressive hoarding — opportunistic collection.

7. **Torch placement** — bot lights up dark areas while exploring without being told. Small ambient behavior with high "they really play this game" signal.

8. **Hunting when idle** — bot pursues nearby animals when it has nothing else to do. Provides food autonomously. Looks purposeful rather than frozen.

### Lower Impact (but noticeable)

9. **Chat grounding** — bot only references things it has actually seen/done. Requires world state queries before chat. SOUL files must forbid invented claims ("I built a castle" when no castle was placed).

10. **Natural language location references** — bot says "back at base" not "at 142, 64, -89". Requires saved places with human names.

11. **Personal space in multi-agent** — when two bots wander toward the same spot, they spread out naturally. Mindcraft uses randomized delay in `elbow_room` to desynchronize.

---

## Feature Dependencies

```
Mind Loop (event-driven LLM)
    └── requires: Body tick (300ms autonomous mode execution)
    └── requires: Parameterized command interface (Tier 1)
    └── enables: All goal-directed behavior

Parameterized Commands (Tier 1)
    └── requires: mineflayer-pathfinder (navigation)
    └── requires: mineflayer-collectblock (collection)
    └── requires: mineflayer-pvp (combat)
    └── requires: mineflayer-auto-eat (autonomous eating)
    └── enables: All LLM-directed gameplay

Autonomous Modes (Body)
    └── requires: Body tick loop
    └── independent of: Mind/LLM
    └── enables: Survival without LLM decisions

Day/Night Routine
    └── requires: Saved places (home location)
    └── requires: goToBed skill
    └── enhances: Human-feeling behavior

Code Generation (Tier 2)
    └── requires: Tier 1 skills (code calls them)
    └── requires: Sandbox execution environment
    └── enables: Arbitrary complex tasks

Crafting Chain Solver
    └── requires: minecraft-data recipe database
    └── requires: Inventory query
    └── enhances: craftRecipe command (auto-prerequisites)

Memory / SOUL system
    └── requires: File-backed storage
    └── independent of: Mineflayer
    └── enables: Personality, learned lessons, notepad

Multi-Agent Coordination
    └── requires: Single-agent working first
    └── requires: Chat routing between bot instances
    └── enables: Collaboration, trading, joint builds

idle_staring mode
    └── requires: Body tick loop
    └── independent of: LLM
    └── enables: Baseline "feels alive" behavior (zero cost)
```

---

## MVP Definition for v2.0

### Launch With (v2.0 milestone — Mineflayer Rewrite)

- [ ] **Mineflayer bot connection** — headless bot connects to Paper server, no Fabric mod. ~100MB RAM vs 1GB.
- [ ] **mineflayer-pathfinder** — `GoalNear`, `GoalFollow`, `GoalSurface`. Replace Baritone entirely.
- [ ] **Tier 1 skill library** — all navigation, collection, crafting, combat, chest, inventory commands. ~35 functions modeled on Mindcraft skills.js.
- [ ] **Mind loop** — event-driven: message → LLM. Idle → self_prompter. No tick-locked polling.
- [ ] **Autonomous modes** — `self_preservation`, `unstuck`, `self_defense`, `item_collecting`, `idle_staring`, `elbow_room`. These are what make the bot feel alive.
- [ ] **SOUL + Memory system** — carry over from v1. SOUL files (Jeffrey, John), MEMORY.md, notepad, per-agent data directory.
- [ ] **Crafting chain solver** — carry over from v1.1. BFS dependency resolver with minecraft-data.
- [ ] **Saved places** — home location, resource spots. Required for day/night routine and base tether.
- [ ] **Natural chat** — grounded in actual world state. Response timing with delays. Conversation pauses self-prompter.
- [ ] **Multi-agent on same server** — 2 bots (Jeffrey, John) with separate ports, separate data dirs, chat routing.

### Add After Validation (v2.0.x)

- [ ] **Day/night routine** — NPC controller with home return at dusk. Trigger: bots are stable individually.
- [ ] **Torch placing + hunting + torch modes** — ambient background behaviors. Add when core gameplay works.
- [ ] **`!newAction` code generation** — Tier 2 escape hatch. Trigger: agents hitting tasks not expressible in command palette.
- [ ] **Villager trading** — end-game economy. Trigger: agents are past iron tier.
- [ ] **mineflayer-smooth-look** — for PvP scenarios if bots do PvP. Defer unless needed.

### Future (v2.1+)

- [ ] **Scale to 5-10 bots** — infrastructure work. Individual bots must be stable first.
- [ ] **Blueprint-based building** — structured multi-block builds. Requires reliable `placeBlock` first.
- [ ] **Skill auto-update from phase completion** — carry over SKILL.md pattern. Trigger: agents complete Ender Dragon phases.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Mineflayer bot connection | HIGH | LOW | P1 |
| mineflayer-pathfinder | HIGH | LOW | P1 |
| Navigation skills (goTo*) | HIGH | LOW | P1 |
| Block collection skill | HIGH | LOW | P1 |
| Crafting skill + chain solver | HIGH | MEDIUM | P1 |
| Combat + self_defense mode | HIGH | MEDIUM | P1 |
| self_preservation mode | HIGH | LOW | P1 |
| SOUL + Memory system | HIGH | LOW (carry-over) | P1 |
| Natural chat (grounded) | HIGH | MEDIUM | P1 |
| idle_staring mode | HIGH | LOW | P1 |
| elbow_room mode | MEDIUM | LOW | P1 |
| Chest interaction skills | MEDIUM | MEDIUM | P1 |
| unstuck mode | MEDIUM | LOW | P1 |
| item_collecting mode | MEDIUM | LOW | P1 |
| Saved places | MEDIUM | LOW | P1 |
| Multi-agent routing | MEDIUM | MEDIUM | P1 |
| Day/night routine | MEDIUM | MEDIUM | P2 |
| torch_placing mode | LOW | LOW | P2 |
| hunting mode | LOW | LOW | P2 |
| Code generation (newAction) | MEDIUM | HIGH | P2 |
| Villager trading | LOW | MEDIUM | P3 |
| mineflayer-smooth-look | LOW | LOW | P3 |

**Priority key:**
- P1: v2.0 milestone (Mineflayer rewrite)
- P2: v2.0.x (after bots are stable)
- P3: v2.1+ (future)

---

## Competitor Feature Analysis

| Feature | Mindcraft | Voyager | HermesCraft v1.1 | HermesCraft v2.0 Plan |
|---------|-----------|---------|-----------------|----------------------|
| Pathfinding | mineflayer-pathfinder | mineflayer-pathfinder | Baritone (broken) | mineflayer-pathfinder |
| LLM-to-skill interface | `!commands` + code gen | Code gen only | HTTP POST actions | `!commands` (Tier 1) + code gen (Tier 2) |
| Autonomous modes | 10 modes, 300ms tick | None (task-based) | 0 modes | 6+ modes, 300ms tick |
| Memory | 500-char summary + full log | Vector skill library | MEMORY.md + SKILL.md | MEMORY.md + SKILL.md (carry over) |
| Human-feeling behavior | idle_staring, elbow_room, daily routine | None | None | idle_staring, elbow_room, daily routine |
| Crafting chain solver | Not automatic (fails on missing ingredients) | Code-gen based | BFS solver (v1.1) | BFS solver (carry over) |
| Multi-agent | Conversation manager + shared server | Single agent | Multi-agent (broken) | Conversation routing + separate data dirs |
| Survival | 3 autonomous modes | None | Manual (LLM-decided) | 2 autonomous modes + mode system |
| Building | `placeBlock` + `!newAction` for complex | Code gen (GPT-4 required) | Blueprint system (broken) | `placeBlock` + saved plans |

---

## Sources

- [Mindcraft skills.js](https://raw.githubusercontent.com/kolbytn/mindcraft/main/src/agent/library/skills.js) — Full skill function inventory with API patterns. HIGH confidence.
- [Mindcraft world.js](https://raw.githubusercontent.com/kolbytn/mindcraft/main/src/agent/library/world.js) — 22 world observation functions. HIGH confidence.
- [Mindcraft actions.js](https://raw.githubusercontent.com/kolbytn/mindcraft/main/src/agent/commands/actions.js) — Full action command list with descriptions. HIGH confidence.
- [Mindcraft queries.js](https://raw.githubusercontent.com/kolbytn/mindcraft/main/src/agent/commands/queries.js) — Full query command list. HIGH confidence.
- [Mindcraft modes.js](https://raw.githubusercontent.com/kolbytn/mindcraft/main/src/agent/modes.js) — All 10 autonomous modes, conditions, cooldowns, interrupts. HIGH confidence.
- [Mindcraft agent.js](https://raw.githubusercontent.com/kolbytn/mindcraft/main/src/agent/agent.js) — 300ms Body tick, LLM event triggers, self_prompter integration. HIGH confidence.
- [Mindcraft self_prompter.js](https://raw.githubusercontent.com/kolbytn/mindcraft/main/src/agent/self_prompter.js) — Self-prompting loop, 2000ms cooldown, 3-miss stop condition. HIGH confidence.
- [Mindcraft action_manager.js](https://raw.githubusercontent.com/kolbytn/mindcraft/main/src/agent/action_manager.js) — 10-min timeout, loop detection, idle event emission, 500-char output cap. HIGH confidence.
- [Mindcraft coder.js](https://raw.githubusercontent.com/kolbytn/mindcraft/main/src/agent/coder.js) — Code generation loop, sandbox execution, 5-attempt retry with error feedback. HIGH confidence.
- [Mindcraft conversation.js](https://raw.githubusercontent.com/kolbytn/mindcraft/main/src/agent/conversation.js) — Chat timing (200ms idle / 5s busy), multi-agent routing, self-prompter pause. HIGH confidence.
- [Mindcraft npc/controller.js](https://raw.githubusercontent.com/kolbytn/mindcraft/main/src/agent/npc/controller.js) — Day/night routine, idle → executeNext pattern, home management. HIGH confidence.
- [Mindcraft history.js](https://raw.githubusercontent.com/kolbytn/mindcraft/main/src/agent/history.js) — 500-char memory summary on overflow. HIGH confidence.
- [Voyager breakdown](https://www.hanakano.com/posts/voyager-breakdown/) — Curriculum, skill library, iterative refinement; 73% performance drop without self-verification. MEDIUM confidence.
- [Mindcraft-CE README](https://mindcraft-ce.com/) — Augments system, enhanced unstuck navigation, multi-tier agent hierarchy. MEDIUM confidence.
- [mineflayer-auto-eat](https://github.com/nxg-org/mineflayer-auto-eat) — Autonomous eating plugin. HIGH confidence.
- [mineflayer-collectblock](https://github.com/PrismarineJS/mineflayer-collectblock) — Block collection with pathfinding + tool selection. HIGH confidence.
- [HermesCraft PROJECT.md](/.planning/PROJECT.md) — v2.0 goals, constraints, carry-over requirements. HIGH confidence.

---

*Feature research for: HermesCraft v2.0 Mineflayer Mind + Body Architecture*
*Researched: 2026-03-22*
