# Architecture Research

**Domain:** Mineflayer-based Minecraft AI agent — Mind + Body architecture
**Researched:** 2026-03-22
**Confidence:** HIGH (Mindcraft source read directly from GitHub; mineflayer-pathfinder official repo verified; AIRI agent DeepWiki cross-checked)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                            MIND LAYER                                │
│                                                                      │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────────────┐ │
│  │ SelfPrompter │  │    Prompter    │  │        History           │ │
│  │ (goal loop)  │  │  (LLM client)  │  │  (conversation window)   │ │
│  │ idle > 2s    │  │  build prompts │  │  compress / summarize    │ │
│  └──────┬───────┘  └───────┬────────┘  └──────────────────────────┘ │
│         └──────────────────┘                                         │
│                      │ dispatch(!command)                            │
├──────────────────────┼──────────────────────────────────────────────┤
│                   BODY LAYER                                         │
│                      │                                               │
│  ┌───────────────────▼────────────────────────────────────────────┐ │
│  │                      ActionManager                              │ │
│  │  stop() → interrupt_code=false → runAction() → return result   │ │
│  └───────────────────┬────────────────────────────────────────────┘ │
│                      │                                               │
│  ┌───────────────────▼────────────┐  ┌──────────────────────────┐  │
│  │         Skills Library         │  │     ModeController        │  │
│  │  navigate / gather / build     │  │  self_defense, unstuck    │  │
│  │  craft / equip / interact      │  │  item_pickup, preserve    │  │
│  │  each checks bot.interrupt_code│  │  runs every 300ms         │  │
│  └───────────────────┬────────────┘  └──────────────────────────┘  │
│                      │                                               │
├──────────────────────┼──────────────────────────────────────────────┤
│               MINEFLAYER BOT                                         │
│  ┌───────────────────▼────────────────────────────────────────────┐ │
│  │  bot.dig()  bot.placeBlock()  bot.craft()  bot.equip()          │ │
│  │  bot.pathfinder.goto(goal)    bot.entity.position               │ │
│  │  bot.on('chat')  bot.on('health')  bot.on('death')              │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                              │ TCP (Minecraft protocol, no HTTP)
                    Minecraft Server (Paper 1.21.1)
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| SelfPrompter | Drives the goal loop — when agent is idle > 2s, re-prompts LLM with current goal | `update()` on 300ms tick; re-runs loop when idle accumulates |
| Prompter | Sends conversation history to LLM, returns text containing `!command` syntax | `openai` client pointed at MiniMax M2.7, no streaming |
| History | Rolling conversation window; compresses old turns to a memory summary | In-memory array; archives full session to JSONL |
| ActionManager | Serializes execution — one action at a time; handles interrupt; timeout watchdog; returns structured result | Promise chain; `bot.interrupt_code` flag |
| Skills Library | Async primitives: `goToPosition`, `collectBlock`, `placeBlock`, `craftRecipe`, etc. | Each checks `bot.interrupt_code` in loops; returns boolean |
| ModeController | Priority-ordered reactive behaviors; fires every 300ms independent of LLM | `interrupts: ['all']` for survival; lower for ambient |
| ConversationManager | Routes incoming chat — player messages pause goal loop and trigger LLM call | `bot.on('chat')` listener |
| Memory | MEMORY.md (lessons), notepad.txt (scratchpad), context/ (pinned plans) | File-backed, read at init, written async |
| Agent | Top-level orchestrator — wires bot, all subsystems, event handlers, lifecycle | Single `Agent` class |

---

## Recommended Project Structure

```
agent/
├── index.js                 # entry point — createBot(), init Agent, start
├── agent.js                 # Agent class — orchestrates all modules
├── config.js                # loadAgentConfig() — env, SOUL file, profiles
├── logger.js                # all log functions, rich output, box-drawing
│
├── mind/                    # LLM reasoning layer — everything that calls the LLM
│   ├── prompter.js          # LLM client — send history, receive response
│   ├── self-prompter.js     # goal loop — re-prompt when idle >= 2000ms
│   ├── history.js           # conversation window, compression, summarize
│   └── prompt-builder.js    # buildSystemPrompt(), buildUserMessage()
│
├── body/                    # skill execution layer — everything that calls Mineflayer
│   ├── action-manager.js    # one-at-a-time, interrupt, timeout, result
│   ├── modes.js             # ModeController — reactive autonomous behaviors
│   ├── commands/            # LLM-visible interface (parsed from !command syntax)
│   │   ├── index.js         # registry, executeCommand(), parseCommand()
│   │   ├── navigate.js      # !goTo, !explore, !followPlayer, !stopMoving
│   │   ├── gather.js        # !collectBlocks, !pickupItem
│   │   ├── build.js         # !placeBlock, !build, !clearArea
│   │   ├── craft.js         # !craft, !smelt, !equip
│   │   ├── combat.js        # !attack, !flee, !defend
│   │   └── social.js        # !chat, !give, !trade, !respond
│   └── skills/              # low-level async primitives (not LLM-visible directly)
│       ├── navigate.js      # goToPosition(), goToPlayer(), explore()
│       ├── gather.js        # collectBlock(), mineVein()
│       ├── build.js         # placeBlock(), clearArea()
│       ├── craft.js         # craftRecipe(), smelt()
│       ├── combat.js        # attackEntity(), flee()
│       └── world.js         # getStateSnapshot(), getNearbyBlocks(), getInventory()
│
├── memory/                  # persistent state — survives crashes and restarts
│   ├── memory.js            # MEMORY.md, notepad, lessons, skill files
│   ├── locations.js         # named locations (name → Vec3) + resource patches
│   └── session-log.js       # JSONL session archive
│
├── social/                  # player and multi-agent interaction
│   ├── conversation.js      # ConversationManager — message routing, priority
│   └── shared-state.js      # (v2.1+) cross-agent task registry
│
├── data/
│   ├── jeffrey/             # per-agent data directory
│   │   ├── MEMORY.md        # lessons, strategies
│   │   ├── notepad.txt      # LLM scratchpad (read/write across ticks)
│   │   ├── stats.json       # deaths, completions, counters
│   │   └── context/         # pinned context files (plans, long tasks, ≤5 files)
│   └── john/
│       └── ...
│
├── SOUL-jeffrey.md          # Jeffrey's personality, backstory, voice
├── SOUL-john.md             # John's personality, backstory, voice
└── skills/                  # agentskills.io SKILL.md files (carry over from v1)
    ├── minecraft-first-night/SKILL.md
    └── ...
```

### Structure Rationale

- **mind/ vs body/:** Explicit separation makes LLM call paths visible. No file in `mind/` imports from `body/skills/`. No file in `body/` calls the LLM. The boundary is strict and testable.
- **commands/ vs skills/:** Commands are the LLM-visible API — their names appear in the system prompt. Skills are internal implementations. Refactoring a skill never changes the LLM's interface. This is the pattern Mindcraft uses.
- **modes/ as a separate concern:** Modes run on a 300ms timer, independent of the command loop. They are not commands and the LLM never calls them. They fire when conditions are met — hostile nearby, low health, stuck in place. This independence is what makes the agent feel alive between LLM calls.
- **memory/ flat files:** No database. MEMORY.md, notepad.txt, and context/ files survive crashes, restarts, and git clones. At 2-10 agent scale, file I/O is not a bottleneck.

---

## Decision Loop

### Normal Tick (No Interrupts)

```
SelfPrompter.update() called every 300ms
    │
    ├── currentAction running? → skip
    │
    ├── idle_time < 2000ms → accumulate, skip
    │
    └── idle_time >= 2000ms → trigger LLM loop
            │
            ▼
    world.getStateSnapshot(bot)          ← position, health, inventory, nearby
    promptBuilder.buildSystemPrompt()    ← SOUL + commands + memory lessons
    promptBuilder.buildUserMessage()     ← snapshot + notepad + progress
            │
            ▼
    prompter.promptConvo(history)        ← LLM call (15-30s cadence effectively)
            │
            ▼
    containsCommand(response)?
    │
    ├── NO (3 consecutive misses → abort loop)
    │       history.add('assistant', response)
    │       bot.chat(response) if natural language
    │
    └── YES
            executeCommand(agent, '!commandName(args)')
                    │
                    ▼
              ActionManager.runAction(fn)
              ├── stop() — set interrupt_code=true, drain current action
              ├── interrupt_code = false — clear flag for new action
              ├── fn(agent) — skill execution
              │       checks bot.interrupt_code in every loop body
              ├── timeout watchdog (10 min)
              └── returns {success, message, interrupted, timedout}
                    │
                    ▼
            history.add('assistant', response)
            history.add('system', result.message)
            idle_time = 0 → loop back
```

### Interrupt Flow

```
Player sends chat message
    │
    bot.on('chat') fires
    │
    ConversationManager.handleMessage(sender, text)
    ├── pause SelfPrompter (clear idle accumulator)
    ├── ActionManager.requestInterrupt()
    │       sets bot.interrupt_code = true
    │       awaits current skill to cooperative-exit
    │
    └── agent.handleMessage(sender, text)
            │
            full LLM call with message priority-injected
            │
            executeCommand(...) → resume SelfPrompter

ModeController.update() — fires every 300ms, never awaited longer than 100ms
    │
    mode.update(agent)
    │
    ├── condition NOT met → skip
    │
    └── condition met (e.g. health < 6)
            │
            ActionManager.stop()
            │
            execute mode behavior (flee, eat, etc.)
            │
            emit 'idle' → SelfPrompter resumes
```

### State Persistence Across Ticks

```
File System                    In-Memory                    LLM Context
──────────                     ─────────                    ───────────
SOUL-jeffrey.md  ──(init)──▶  agentConfig.soul       ──▶  system prompt (every call)
MEMORY.md        ──(init)──▶  memory.lessons          ──▶  system prompt (every call)
skills/*/SKILL.md──(init)──▶  skills[]                ──▶  system prompt (relevant)
notepad.txt      ──(every)──▶ notepadContents         ──▶  user message (every call)
context/*.md     ──(every)──▶ pinnedContext[]          ──▶  user message (every call)
stats.json       ──(every)──▶ stats object             ──▶  user message (summary)
                 ◀──(async)── history.turns        → JSONL session archive
```

---

## Mind-Body Interface Contract

This is the hard boundary. The Mind produces command strings. The Body executes them. Neither layer reaches into the other's internals.

### Command Definition (Body provides, Mind names)

```javascript
// body/commands/gather.js
export const collectBlocks = {
  name: '!collectBlocks',
  description: 'Mine and collect the specified block type. Use for gathering resources.',
  params: {
    blockType: { type: 'BlockName', description: 'Block to collect (e.g. oak_log, stone)' },
    count:     { type: 'int', domain: [1, 64, '[]'], description: 'How many to collect' },
  },
  perform: async (agent, blockType, count) => {
    // delegates to skills — never imports from mind/
    const result = await skills.collectBlock(agent.bot, blockType, count)
    return result ? `Collected ${count} ${blockType}.` : `Failed to collect ${blockType}.`
  }
}
```

### ActionResult (what Body returns to Mind)

Every `command.perform()` runs through `ActionManager.runAction()`. The Mind gets back:

```javascript
{
  success: Boolean,       // did the skill complete its stated goal?
  message: String,        // appended to history as role:'system' turn
  interrupted: Boolean,   // halted by interrupt_code (mode or player message)
  timedout: Boolean,      // halted by timeout watchdog
}
```

The `message` string is what the LLM reads on the next turn and reasons from.

### Interrupt Contract

Any component may interrupt the Body:
1. Set `agent.bot.interrupt_code = true`
2. Optionally call `ActionManager.stop()` to await cooperative drain

Every skill function MUST check `if (bot.interrupt_code) return false` inside every loop body. A skill that omits this check is a defect — it blocks modes and makes the agent unresponsive to chat.

---

## Cooperative Interrupt Pattern (Critical)

```javascript
// body/skills/gather.js
export async function collectBlock(bot, blockType, count) {
  let collected = 0
  while (collected < count) {
    if (bot.interrupt_code) return false          // cooperative exit point

    const block = bot.findBlock({
      matching: mc.getBlockId(blockType),
      maxDistance: 64,
    })
    if (!block) break

    await goToPosition(bot, block.position.x, block.position.y, block.position.z, 2)
    if (bot.interrupt_code) return false          // check after every await

    await bot.dig(block)
    if (bot.interrupt_code) return false
    collected++
  }
  return collected > 0
}
```

Checking after every `await` is mandatory. The interrupt flag is set between ticks, not mid-await. An await-heavy function that checks only at loop start can still hold for 200-500ms per iteration, which is acceptable.

---

## Reactive Modes (Body Layer, Independent of LLM)

Modes make the agent feel alive between LLM decisions. They handle emergencies the LLM would be too slow to respond to.

```javascript
// body/modes.js — ordered by priority (highest first)
const MODES = [
  {
    name: 'self_preservation',
    interrupts: ['all'],
    update: async (agent) => {
      if (agent.bot.health <= 6 && !this.active) {
        this.active = true
        await skills.retreat(agent.bot)
        await skills.eatFood(agent.bot)
        this.active = false
      }
    }
  },
  {
    name: 'self_defense',
    interrupts: ['all'],
    update: async (agent) => {
      const hostile = world.getNearestHostile(agent.bot, 8)
      if (hostile && !this.active) {
        this.active = true
        await skills.equipHighestAttack(agent.bot)
        await skills.attackEntity(agent.bot, hostile)
        this.active = false
      }
    }
  },
  {
    name: 'unstuck',
    interrupts: ['all'],
    // fires if position hasn't changed in 5s during navigation
    update: async (agent) => { /* ... */ }
  },
  {
    name: 'item_collecting',
    interrupts: [],            // doesn't interrupt deliberate actions
    // picks up nearby dropped items when idle
    update: async (agent) => { /* ... */ }
  },
]
```

Mode updates must complete within ~100ms. Do not `await` a pathfinder.goto inside a mode update — start it async, track `this.active`, check again next tick.

---

## Multi-Agent Coordination Pattern

Two agents (Jeffrey, John) run as separate Node.js processes. Coordination is loose-coupled by design.

### Primary Channel: In-Game Chat

Agents chat to each other via `bot.chat()`. This is the natural Minecraft communication layer.

```
Jeffrey process                         John process
───────────────                         ────────────
!chat("John, can you smelt              bot.on('chat') fires
  these ores while I mine?")  ──▶       ConversationManager sees "Jeffrey:" prefix
                                        SelfPrompter pauses
                                        LLM call: "Jeffrey asked me to smelt ores"
                                        → !goToPosition(furnace) → !smelt("iron_ore", 32)
```

ConversationManager identifies bot messages by cross-referencing agent names. Bot-to-bot messages are tagged `(FROM OTHER BOT)` in history so the LLM knows the sender is an agent.

### Secondary Channel: Shared File (v2.1+, not v2.0)

For structured task handoffs (claim a mine area, register a build zone), `agent/data/shared/coordination.json` with file locking. Not required for v2.0 with 2 agents — chat is sufficient.

### Process Isolation

| Isolation | What it means |
|-----------|---------------|
| Separate Node.js process per agent | Crash in Jeffrey does not affect John |
| Separate `data/{name}/` | Memories, notepad, and context are per-agent |
| Separate `MC_USERNAME` | Separate Minecraft logins, no shared in-process state |
| No shared in-memory objects | All coordination via game world or files only |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 2 agents (v2.0) | Separate processes, chat coordination — current design is sufficient |
| 5-10 agents | Add shared task registry (file or SQLite); deduplicate LLM calls for shared goals; rate-limit concurrent calls |
| 10+ agents | MindServer coordinator process; agents register task ownership; event-based LLM triggering instead of idle polling |

### Scaling Priorities

1. **First bottleneck (2-5 agents):** LLM call rate. At 15-30s cadence, 5 agents = 10-20 calls/min. MiniMax M2.7 is cheap — not a cost problem. If model changes, add staggered start timers to spread calls.
2. **Second bottleneck (5+ agents):** File I/O contention on shared coordination files. Move to SQLite at that point.
3. **RAM is not a bottleneck:** Mineflayer bots are ~100MB each. 10 agents = ~1GB on a 15GB host. Headroom is large.

---

## Anti-Patterns

### Anti-Pattern 1: LLM Called on Every Game Tick

**What people do:** Fire an LLM call every 2s regardless of whether the previous action has completed (the v1 HermesCraft architecture).

**Why it's wrong:** Skills that take 10-30s (navigate 200 blocks, mine 32 ore) get interrupted before completion. The LLM spends most turns saying "still working on it." Token cost balloons. The v1 diagnosis documented exactly this failure.

**Do this instead:** Call LLM only when idle (all skills complete, no active action). SelfPrompter's 2s idle timer is the correct trigger. Skill execution runs uninterrupted to completion.

### Anti-Pattern 2: HTTP Bridge Between Agent and Game

**What people do:** Separate the agent from the bot with an HTTP server (v1 HermesBridge).

**Why it's wrong:** HTTP round-trips add latency, create race conditions ("another action pending"), require coordinate translation, and need a separate process. The v1 post-mortem listed crosshair drift, coordinate bugs, and 1GB RAM per agent.

**Do this instead:** Mineflayer bot in the same process as the agent. `bot.dig(block)` is a direct async call. Zero HTTP, zero translation layer.

### Anti-Pattern 3: Skill Functions Without interrupt_code Checks

**What people do:** Write skill functions as linear async chains without the cooperative cancel check.

**Why it's wrong:** A navigate call that takes 30s cannot be preempted. Modes can't fire. Player chat is ignored for 30s. Agent gets stuck in action loops with no escape.

**Do this instead:** Every loop body, every await, is followed by `if (bot.interrupt_code) return false`. The interrupt flag is the only safe cancellation mechanism. Treat it as a required invariant for every exported skill function.

### Anti-Pattern 4: Giving the LLM Raw Mineflayer API Access

**What people do:** Let the LLM generate Mineflayer code directly (Voyager-style) — `bot.pathfinder.goto(new GoalNear(...))`.

**Why it's wrong:** API details change. Generated code is brittle. Sandboxing is a security risk. The LLM spends tokens on boilerplate instead of reasoning about what to do next.

**Do this instead:** Command abstraction — `!collectBlocks("oak_log", 5)`. The LLM names intent. Skills handle Mineflayer details. This is Mindcraft's core design choice and it works.

### Anti-Pattern 5: One Monolithic Skills File

**What people do:** Pile all skill functions into one `skills.js` (Mindcraft itself does this — 1,340 lines).

**Why it's wrong:** Impossible to test in isolation. Merge conflicts on every addition. Navigation changes break craft logic by proximity in the file. Onboarding is painful.

**Do this instead:** Split by domain — `navigate.js`, `gather.js`, `build.js`, `craft.js`, `world.js`. Each is independently testable. Commands import only what they need.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Minecraft Server (Paper 1.21.1) | `mineflayer.createBot()` — direct TCP | No mod, no HTTP, no Xvfb |
| LLM (MiniMax M2.7) | `openai` client — `chat.completions.create` | Change `baseURL` and `model` only |
| mineflayer-pathfinder | `bot.loadPlugin(pathfinder)` | `bot.pathfinder.goto(goal)` returns Promise |
| minecraft-data | `mcData(version)` — block/item IDs, recipes | Used inside skills, not exposed to commands |
| @mineflayer-navigate or built-in pathfinder | Same as pathfinder | GoalNear, GoalBlock, GoalFollow |

### Internal Boundaries

| Boundary | Communication | Rule |
|----------|---------------|------|
| Mind → Body | Command string → `executeCommand()` in commands registry | Mind never calls `skills.*` directly |
| Body → Mind | `ActionResult.message` appended to `history` | Skills never call Prompter |
| Modes → ActionManager | `ActionManager.stop()` + `interrupt_code` flag | Modes request stop, do not own execution |
| Agent → Memory | `memory.load()` at init; `memory.save()` async after changes | Only memory.js writes its files |
| Multi-agent | `bot.chat()` / in-game chat channel | No IPC sockets, no shared in-memory objects |

---

## Build Order

Dependencies are strict — each phase requires the prior phase to be working.

```
Phase 1 — Bot Foundation
  mineflayer.createBot() + pathfinder plugin loading
  ActionManager (interrupt, timeout, result shape)
  Skills: navigate.js (goToPosition, goToPlayer)
         world.js (getStateSnapshot)
         gather.js (collectBlock)
  Commands: !goTo, !collectBlocks, !stop
  Verify: bot navigates, mines, and returns result message

Phase 2 — Mind Loop
  Prompter (openai client, history management)
  SelfPrompter (idle timer, goal injection, miss counter)
  prompt-builder (system prompt: SOUL + commands + memory)
  End-to-end smoke test: agent decides !collectBlocks from LLM
  Verify: LLM output drives a real block collection

Phase 3 — Survival Modes
  ModeController (300ms loop)
  Modes: self_preservation, self_defense, unstuck, item_collecting
  Verify: spawn hostile → agent fights without LLM call
          fall into lava → agent retreats without LLM call
          get stuck → agent recovers without LLM call

Phase 4 — Full Skill Set
  Skills: build.js (placeBlock, clearArea)
          craft.js (craftRecipe, smelt)
          combat.js (attackEntity, flee)
  Commands: !placeBlock, !craft, !smelt, !attack
  Crafting chain solver (carry over crafter.js from v1)
  Memory: MEMORY.md, notepad read/write, context/ pinned files

Phase 5 — Personality + Multi-Agent
  SOUL file loading per agent (jeffrey, john)
  ConversationManager (chat routing, bot-to-bot tagging)
  Per-agent data directories (data/jeffrey/, data/john/)
  Two agents on server simultaneously
  Verify: Jeffrey and John coordinate on a task via chat
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| SelfPrompter idle timer (2s) rather than fixed interval | Prevents LLM calls while skills are running; cadence is determined by skill duration, not a clock |
| `interrupt_code` flag (cooperative) rather than Promise.race | Skills need to clean up (close GUIs, stop pathfinder) before returning; forced abort leaves bot in bad state |
| Commands as parsed text, not tool calls | Simpler to debug; LLM text is human-readable; `tool_choice: required` is model-specific and fragile |
| Modes at 300ms, not event-driven | Polling at 300ms is cheap; event handlers for every mob-spawn/damage event create handler proliferation; polling is predictable |
| Separate process per agent, no MindServer for v2.0 | 2 agents don't need coordination infrastructure; add MindServer when scaling to 5+ |

---

## Sources

- Mindcraft source (`kolbytn/mindcraft`) — `agent.js`, `action_manager.js`, `modes.js`, `self_prompter.js`, `library/skills.js`, `library/full_state.js`, `library/world.js`, `history.js`, `memory_bank.js`, `process/agent_process.js` — read directly from GitHub raw — HIGH confidence
- Mindcraft architecture overview — DeepWiki `kolbytn/mindcraft/7-configuration` — module breakdown confirmation — MEDIUM confidence (secondary source, consistent with primary)
- AIRI Minecraft agent (`moeru-ai/airi`) — DeepWiki `4.1-minecraft-agent` — decision loop, interrupt guards, action queue — MEDIUM confidence (independent implementation, confirms same patterns)
- mineflayer-pathfinder (`PrismarineJS/mineflayer-pathfinder`) — `GoalNear`, `pathfinder.goto()` Promise API, known issues — HIGH confidence (official repo)

---

*Architecture research for: HermesCraft v2.0 Mineflayer Mind + Body rewrite*
*Researched: 2026-03-22*
