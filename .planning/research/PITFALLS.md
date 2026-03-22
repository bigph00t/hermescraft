# Pitfalls Research

**Domain:** LLM-driven Mineflayer bot — Mind + Body architecture on Paper 1.21.1
**Researched:** 2026-03-22
**Confidence:** HIGH (based on Mineflayer GitHub issues, Mindcraft project analysis, community reports, and v1 post-mortem)

---

## Critical Pitfalls

### Pitfall 1: Pathfinder Hangs Indefinitely on Unreachable Goals

**What goes wrong:**
`bot.pathfinder.goto(goal)` hangs permanently when the goal is physically unreachable — e.g., a block inside a wall, underwater without swimming enabled, or blocked by bedrock. No timeout fires, no error event emits, no `path_reset` event triggers. The bot freezes in place and the Mind loop never gets a result back. The skill function `goto()` awaits a promise that never resolves.

**Why it happens:**
`mineflayer-pathfinder` has a documented open issue (#222) where `thinkTimeout` does not trigger in the hanging state. The pathfinder's A* algorithm reaches a partial result, doesn't declare failure, and the consuming code waits forever. The pathfinder expects higher-level code to detect obstruction — it provides events like `path_update` with status `noPath` and `path_reset` with reason `stuck`, but these only fire in some failure modes, not when the pathfinder hangs computing an impossible path.

**How to avoid:**
Wrap every `goto()` call in a hard wall-clock timeout (e.g., 30s). If the timeout fires before the goal is reached, cancel the pathfinder with `bot.pathfinder.setMovements(null)` or `bot.pathfinder.stop()` and return a failure result. Never await a pathfinder promise without an external deadline. Additionally, before calling `goto()`, check `bot.blockAt(target)` to validate the destination is not solid.

**Warning signs:**
- Skill function `navigate` has been running for > 30s with no position change
- `bot.pathfinder.isMoving()` returns true but bot.entity position is static
- Mind loop queued multiple actions but none are executing
- Memory grows because skill function never returns, leaving the async call stack open

**Phase to address:** Phase 1 (Core skill functions) — every navigation skill must wrap pathfinder in a timeout before any other skill can be built on top.

---

### Pitfall 2: bot.dig() Silently Succeeds on Protected Blocks

**What goes wrong:**
`bot.dig(block)` returns a resolved promise (no error thrown) even when the dig physically fails — specifically when the block is inside spawn protection, in a game mode that prevents breaking, or protected by a Paper plugin (GriefPrevention, WorldGuard, etc.). The skill function reports success, the Mind loop marks the task done, and the block is still there. The bot then tries to path through the unbroken block and gets stuck.

**Why it happens:**
Documented in mineflayer issue #3494. The dig function resolves based on the animation completing and the dig packet being sent, not on receiving a block-break confirmation from the server. In protected zones, the server silently rejects the break and restores the block without sending a `diggingAborted` event.

**How to avoid:**
After `bot.dig(block)` resolves, read `bot.blockAt(block.position)` and verify the block type changed to `air`. If the block is still present, treat the dig as failed. Add this check in a `digBlock()` skill wrapper. Also call `bot.canDigBlock(block)` before attempting — though this does not catch server-side protection, it catches client-side impossibility (water, bedrock, etc.).

**Warning signs:**
- Skill reports `"mined oak_log"` but tree is still standing
- Bot immediately gets pathfinding error after a successful mine call
- Mine loop repeats the same block coords without making progress
- `bot.blockAt()` after dig returns the original block type

**Phase to address:** Phase 1 (Core skill functions) — add post-dig verification to the `mineBlock()` skill wrapper.

---

### Pitfall 3: placeBlock Timeout on High-Entity-Count Servers

**What goes wrong:**
`bot.placeBlock(referenceBlock, faceVector)` throws `Error: Event blockUpdate did not fire within timeout of 5000ms` when the server is under load. This happens on Paper servers with many entities, active farms, or heavy chunk loading. The block may or may not have actually been placed — the server processed the placement but the confirmation packet arrived late or out of order.

**Why it happens:**
`placeBlock` internally uses a `once('blockUpdate', ...)` listener with a 5-second timeout. On a loaded Paper server, the blockUpdate event for the placed block can be delayed past 5 seconds if the server tick is backlogged. A community fix (reducing the timeout to 500ms with patch-package) actually makes this worse — it increases false negatives. The real issue is that the timeout is based on event latency, which is server-load-dependent.

**How to avoid:**
Catch the timeout error in the `placeBlock()` skill wrapper. After the timeout, check `bot.blockAt(targetPosition)` — if the block is now the correct type, the placement succeeded and the timeout was a false negative. Only fail if the block is not present after the timeout. This converts an unreliable exception into a reliable post-placement check. Additionally, pre-equip the item before calling `bot.placeBlock()` to reduce the time between the call and packet dispatch.

**Warning signs:**
- `blockUpdate did not fire within timeout` errors during building on a multi-agent server
- Build logs show intermittent failures even though the structure visually progresses
- Error rate increases when multiple bots are online simultaneously

**Phase to address:** Phase 1 (Core skill functions) — add post-placement verification to the `placeBlock()` skill wrapper.

---

### Pitfall 4: Crafting Recipes Only Match Exact Item Names (No Wood Tag Support)

**What goes wrong:**
`bot.recipesFor(itemId)` uses exact item ID matching. If the bot has `spruce_planks` in inventory, `bot.recipesFor('crafting_table')` returns an empty array because the recipe expects `oak_planks` (or rather, the `planks` tag). All wooden plank types are functionally equivalent in vanilla Minecraft, but Mineflayer's recipe lookup does not honor item tags — it only matches the specific item ID registered in the recipe.

**Why it happens:**
Documented in mineflayer issue #3549. The recipe system was built around exact item IDs, not Minecraft's tag system (`minecraft:planks`, `minecraft:logs`, etc.). Vanilla Minecraft uses tags for recipe ingredients, but the PrismarineJS recipe data uses concrete item IDs.

**How to avoid:**
Do not rely solely on `bot.recipesFor()` for recipe discovery. Use `minecraft-data` to get the recipe data directly, then implement tag resolution yourself. For wood recipes specifically, map all plank variants to a canonical representative before checking recipes. Our existing `crafter.js` BFS solver already handles this — ensure it does not call `bot.recipesFor()` but uses its own data. Alternatively, when `bot.recipesFor()` returns empty, try with each plank variant before declaring the recipe unavailable.

**Warning signs:**
- `craft(crafting_table)` fails with "no recipe found" when bot has `spruce_planks`
- Any recipe using wood tags (planks, logs, slabs) fails with non-oak variants
- Agent cuts down a spruce tree and then cannot craft basic tools

**Phase to address:** Phase 2 (Crafting skill) — test all wood-family recipes with non-oak variants before declaring the crafting skill complete.

---

### Pitfall 5: Window Operations Race — Opening Chest That Is Already Open (or Closed)

**What goes wrong:**
`bot.openChest(chestBlock)` throws or hangs if called when a window is already open. Similarly, calling `chest.close()` on a chest that was closed by server event (e.g., another player walked away, plugin closed it) causes an unhandled rejection. The `windowOpen` event has a 20-second timeout — if it doesn't fire, the skill hangs for 20 seconds before erroring.

**Why it happens:**
Documented in mineflayer issues #3360 and #3769. Mineflayer expects exactly one open window at a time. If a prior window interaction left a window open (e.g., the chest skill threw mid-operation), subsequent `openChest` calls fail because the bot thinks it's already in a window. The chest skill must track window state explicitly and close any open window before opening another.

**How to avoid:**
Before any `openChest()` or `openBlock()` call, check `bot.currentWindow` — if it is not null, call `bot.closeWindow(bot.currentWindow)` first. Wrap the entire chest interaction (open → operate → close) in a try/finally so the window always closes even if the operation throws. Add a 10-second wall-clock timeout around `openChest()` independent of the internal event timeout.

**Warning signs:**
- `windowOpen did not fire within timeout of 20000ms` errors during chest interactions
- Inventory skill hangs for 20 seconds then errors
- After a failed chest operation, all subsequent chest operations also fail
- `bot.currentWindow` is not null at the start of a chest skill call

**Phase to address:** Phase 1 (Core skill functions) — the chest interaction skill must include window lifecycle management from the start.

---

### Pitfall 6: LLM Action Loop Causes Context Window Overflow Over Long Sessions

**What goes wrong:**
Each Mind loop turn appends a state observation + action result to the conversation history. After 60-90 minutes of continuous operation, the accumulated messages exceed the model's context window. When this happens, the LLM receives a truncated context and loses earlier decisions, inventory state, and active plans. The agent starts repeating actions it already completed or contradicting its own earlier decisions. Context overflow errors from the API result in failed Mind loop turns.

**Why it happens:**
Naive rolling history — keep last N messages — works short-term but each message contains a full state snapshot (inventory, position, nearby blocks, recent actions). A 15-30s Mind loop with verbose state produces 2-4KB per turn. At 128K tokens, this gives roughly 60-90 real-time minutes before overflow. The v1 agent already hit this: 90 messages at ~4KB each = 360KB = ~90K tokens, consuming 70% of context before system prompt.

**How to avoid:**
State snapshots in conversation history must be compressed. Use a delta format: only include state fields that changed since the last turn. Store full state separately; the conversation history only carries "what changed and what was decided." Keep a separate persistent scratchpad (notepad.txt) for plans — it doesn't grow with turns. Implement progressive summarization: every 20 turns, summarize the oldest 10 turns into a single paragraph and replace them. Cap total conversation history at 40 turns, never 90.

**Warning signs:**
- LLM API returns context window errors after 60+ minutes of operation
- Agent repeats tasks it completed in earlier turns
- Agent references items it no longer has (dropped or consumed earlier)
- Mind loop latency increases as history grows (model processing longer context)

**Phase to address:** Phase 3 (Mind loop + memory) — the conversation structure must be designed with overflow prevention built in, not retrofitted.

---

### Pitfall 7: mineflayer-pathfinder Gets Stuck in GoalFollow Sprinting Loop

**What goes wrong:**
When using `GoalFollow` to track a moving entity, the bot overshoots the target, overcorrects, and enters a tight sprint-stop-sprint cycle. In extreme cases, the bot locks its movement controls in "sprinting" state while physically unable to move, burning CPU and causing the bot to appear frozen or jittering. This is distinct from the unreachable-goal hang (Pitfall 1) — the bot is moving, just not making progress toward the goal.

**Why it happens:**
Documented in mineflayer-pathfinder issue #332. The pathfinder recomputes the path every tick when following a moving entity. If the entity moves faster than the bot can replan, the computed path is always stale. The control state becomes desynchronized from the goal state, leading to stuck sprint keys.

**How to avoid:**
For entity following, use `GoalFollow` with a tolerance radius (e.g., 3 blocks) rather than distance 0. This prevents constant recomputation when the bot is "close enough." For aggressive following (combat), implement a custom follow loop using `bot.lookAt()` + manual movement controls instead of relying on the pathfinder. Always add a safety escape: if `bot.entity.velocity` magnitude is near zero for 3 consecutive ticks while `GoalFollow` is active, reset pathfinder state.

**Warning signs:**
- Bot velocity near zero but `bot.pathfinder.isMoving()` returns true
- Bot spinning rapidly around a target entity
- `pathfinder` goal remains active for > 60s without reaching target
- CPU usage spikes when multiple bots use GoalFollow simultaneously

**Phase to address:** Phase 2 (Navigation skill) — movement safety harness needed before any entity-following or social behavior.

---

### Pitfall 8: Bot Kicked for Flying After Respawn

**What goes wrong:**
After the bot dies and respawns, the server's anti-cheat kicks the bot for flying. This happens because mineflayer's physics simulation pauses during the respawn packet exchange — the bot is technically not applying gravity for 1-2 ticks. Paper's built-in movement validation detects this as "flying" and issues a kick. With anti-cheat plugins (Grim, Themis), this is even more aggressive.

**Why it happens:**
Documented in mineflayer issue #671. The `restartPhysics` fix was merged in PR #1013, but the timing window between the respawn packet and the first position packet still exists on some server configurations. Paper's `spawn-protection` and movement validation settings can exacerbate this.

**How to avoid:**
Listen to the `spawn` event and add a short delay (100-200ms) before issuing any movement command after respawn. Set `bot.physics.gravity` to the correct vanilla value in the `spawn` handler as a safety measure. If using Paper, set `allow-flight: true` in `server.properties` — this disables the built-in flight check while keeping plugin-level anti-cheat intact. This is acceptable on a private server.

**Warning signs:**
- Bot disconnects with "Flying is not enabled" immediately after death
- Disconnect happens consistently at respawn but not at initial join
- Log shows disconnect within 2 seconds of the `spawn` event

**Phase to address:** Phase 1 (Bot setup) — respawn handling must be correct before any survival gameplay is attempted.

---

### Pitfall 9: VeinMiner/Timber Plugin Requires Client-Side Activation Packet

**What goes wrong:**
VeinMiner (the main Paper plugin, not to be confused with the datapack) requires a client-side mod to send activation packets over the custom payload channel. Without these packets, the plugin operates in "server-side only" mode with no automatic vein mining. Mineflayer bots do not send the VeinMiner client handshake packet, so the plugin thinks no compatible client is connected and disables its automatic features for that player.

**Why it happens:**
VeinMiner uses `BukkitMessagingChannel` / custom payload packets for client-server handshaking. The plugin's activation state per-player depends on the client declaring itself VeinMiner-compatible. Without the declaration, the server-side plugin defaults to requiring explicit activation (right-click activation mode or command). A bot can still trigger VeinMiner manually via a command or keybind emulation, but automatic vein-mining on block break will not work.

**How to avoid:**
Two options: (1) Configure the VeinMiner plugin to use "command activation" mode rather than "client activation" mode, which removes the packet requirement. (2) Send the VeinMiner client handshake packet from the bot using `bot._client.write('custom_payload', ...)` with the VeinMiner channel name. Option 1 is simpler — just change one line in the plugin config. Verify which VeinMiner variant is installed (the GitHub 2008Choco version vs the Hangar DestenyLP version — they have different configs).

**Warning signs:**
- Bot mines one log and tree does not auto-fell
- Other human players get tree-felling but bots do not
- Plugin admin logs show bot as "not VeinMiner client connected"

**Phase to address:** Phase 1 (Server setup) — verify plugin behavior with bots in the first integration test. If it doesn't work out of the box, switch to command activation mode immediately.

---

### Pitfall 10: Multi-Agent Chat Flooding Causes All Bots to See Duplicate Events

**What goes wrong:**
In a multi-agent setup, every bot listens to `bot.on('chat', ...)` for coordination messages. When Bot A sends a chat message, every bot including Bot A receives it. If bots are not filtering their own messages, they process their own output as new input, creating a feedback loop: Bot A says something, Bot A hears itself, Bot A responds to itself, Bot B hears both, Bot B responds, etc. Chat volume grows exponentially.

**Why it happens:**
Mineflayer's `chat` event fires for all chat messages regardless of sender. The `username` field in the event identifies the sender, but code that doesn't filter on `username !== bot.username` will process all messages including self-sent ones. In the v1 codebase, `_seenChatMessages` tracked this, but with multiple bots in the same process or separate processes, there is no shared state to deduplicate across bots.

**How to avoid:**
Every `chat` listener must filter `if (username === bot.username) return`. For cross-agent coordination, use a dedicated channel: either a scoreboard sidebar, a private `/msg`, or a custom plugin channel — never public chat. Implement a rate limit on outgoing chat: max 1 message per 3 seconds per bot to respect Paper's chat throttling and avoid kick for spam.

**Warning signs:**
- Chat logs show a bot replying to its own messages
- Chat message volume doubles every few seconds after agents start talking
- Bots get kicked for "Sending chat messages too quickly"
- One bot's chat triggers action responses in all other bots simultaneously

**Phase to address:** Phase 3 (Multi-agent coordination) — design the communication protocol before connecting multiple bots.

---

### Pitfall 11: Skill Functions Must Handle Async Errors or They Leak Promises

**What goes wrong:**
A skill function that calls `bot.dig()`, `bot.pathfinder.goto()`, or `bot.placeBlock()` and does not `await` in a `try/catch` will leak unhandled promise rejections. When an unhandled rejection fires, Node.js emits an `unhandledRejection` event. Without a global handler, the process crashes. With a global handler that ignores it (like v1's crash recovery), the skill appears to succeed while the actual operation failed silently. The Mind loop gets a `{ success: true }` from a skill that threw internally.

**Why it happens:**
Mineflayer's async API uses promises throughout. The pattern `bot.dig(block)` returns a promise — calling it without `await` or `.catch()` in an async context silently drops the rejection. Junior contributors to the skill library frequently write `bot.dig(block)` without await inside an async function, which looks correct (no warning from the linter) but drops the error.

**How to avoid:**
Every skill function is `async` and uses `try/catch` wrapping all mineflayer API calls. Skill functions return `{ success: boolean, error?: string, result?: any }` — never throw. The Mind loop never needs to catch skill exceptions — skills always return a structured result. Enforce this pattern with a code review checklist. Add an ESLint rule for `no-floating-promises` (with `@typescript-eslint/no-floating-promises` if TypeScript is adopted).

**Warning signs:**
- `UnhandledPromiseRejectionWarning` in Node.js output
- Skill function returns `{ success: true }` but the expected game state change didn't happen
- Intermittent failures in skills that work correctly 80% of the time
- Skills appear faster than expected (early return before async operation completes)

**Phase to address:** Phase 1 (Core skill functions) — establish the error handling pattern before writing any skill. All skills must follow the same return contract.

---

### Pitfall 12: LLM Hallucinates Invalid Item Names Even With Mineflayer

**What goes wrong:**
The v1 item name normalization problem carries forward. Even with Mineflayer's direct API, the Mind loop receives LLM output like `mine("oak log")`, `craft("wooden_planks")`, `equip("sticks")`, `place("dirt_block")`. These go into skill function calls that use `bot.registry.itemsByName[name]` — which returns `undefined` for non-canonical names — and the skill throws `TypeError: Cannot read properties of undefined`. If skills don't guard against this, the Mind loop crashes.

**Why it happens:**
LLMs learn Minecraft vocabulary from mixed sources: wiki (display names like "Oak Log"), forum posts (colloquial like "wood"), and code samples (registry names like "oak_log"). Even when prompted with "use exact Minecraft registry names", models occasionally output display names or pluralized forms. This is fundamentally a training data issue — the LLM associates the concept with multiple surface forms.

**How to avoid:**
The item name normalization layer from v1 (`crafter.js` + normalizer) must be ported to v2. Wrap `bot.registry.itemsByName[name]` in a `resolveItem(name)` function that normalizes before lookup. Include the canonical name list in the Mind loop system prompt as a reference. For skill function parameters that accept item names, validate and normalize at the skill boundary before any API call.

The known mappings still apply (from v1 post-mortem):
- `"wooden planks"` / `"planks"` → `oak_planks`
- `"sticks"` → `stick`
- `"wood"` / `"log"` → `oak_log`
- `"cobble"` → `cobblestone`
- `"iron ore"` → `raw_iron` (1.18+ rename)
- Any display name with spaces → snake_case equivalent

**Warning signs:**
- `TypeError: Cannot read properties of undefined (reading 'id')` in skill functions
- Mind loop gets `{ success: false, error: "Unknown item: wooden_planks" }` from craft skill
- LLM uses a mix of registry names and display names in the same turn
- Agent fails to use items it demonstrably has (wrong name lookup)

**Phase to address:** Phase 1 (Core skill functions) — item name resolution is a prerequisite for every skill.

---

### Pitfall 13: Keepalive Disconnects During Long LLM Calls

**What goes wrong:**
MiniMax M2.7 has 0.5-2s latency per call. During the Mind loop LLM call, the bot is idle — not sending any packets. Paper servers enforce a keepalive timeout: if the bot doesn't respond to the server's keepalive ping within 30 seconds, it gets kicked with "Timed out." This is not a problem for fast LLMs (< 5s), but if the LLM call is slow, retries, or the Mind loop is doing intensive preprocessing, the bot can miss keepalive packets.

**Why it happens:**
Documented in mineflayer issues #2076 and #2673. Mineflayer handles keepalive automatically — it responds to keepalive packets in the physics tick loop. However, if the Node.js event loop is blocked (e.g., synchronous JSON parsing of a large state object, or a sync `fs.writeFileSync` call inside the Mind loop), keepalive responses are delayed. Paper's default timeout is 30s, which is usually sufficient for MiniMax M2.7, but retry storms can push latency to 10-20s.

**How to avoid:**
Never block the Node.js event loop inside the Mind loop. All file I/O must be async. All JSON serialization of large state objects should use `setImmediate` to yield between chunks if the object is large. Set `checkTimeoutInterval: 60000` in the mineflayer bot options to be more lenient than the default. On Paper, the keepalive timeout is configured in `server.properties` — for a private server, increasing it to 60s is reasonable.

**Warning signs:**
- Bots disconnect without error, just "Timed out" in server logs
- Disconnects correlate with long LLM calls (retries, slow model responses)
- Bot behaves fine at low load but disconnects under heavy processing
- Keepalive timeout message appears, not a kick for behavior

**Phase to address:** Phase 1 (Bot harness) — async I/O discipline and keepalive options must be set before any sustained operation.

---

### Pitfall 14: Paper Plugin Anti-Cheat Flags Rapid Bot Actions

**What goes wrong:**
Mineflayer bots can perform actions faster than a human player — instant block breaking (unless tool speed is respected), instant inventory operations, perfectly timed clicks. Paper anti-cheat plugins (or even vanilla Paper's built-in checks) detect this as cheating and kick the bot. Specifically: rapid crafting, instant block break (ignoring break time), and instant container open/close are the common triggers.

**Why it happens:**
Mineflayer's `bot.dig()` respects break time by default (it simulates the break duration). However, if `forceLook: true` is used or the bot cancels and restarts digs rapidly, anti-cheat sees repeated partial break packets as cheating. The bot's packet timing is also perfectly regular (no jitter), which some anti-cheat plugins flag as bot-like behavior.

**How to avoid:**
Use `bot.dig(block)` without `forceLook` to respect natural break timing. Do not cancel and restart digs unless necessary. For the private Paper server, do not install aggressive anti-cheat plugins (Grim, AAC). The vanilla Paper movement checks can be disabled with `allow-flight: true` (for flying-related kicks). For crafting and containers, add small random delays (50-200ms) between operations to humanize the pattern — relevant if the server ever has human observers.

**Warning signs:**
- Bots get kicked for "hacking" or "cheating" messages from a plugin
- Kick messages reference "FastBreak," "FastPlace," "InventoryHack"
- Bots work fine on vanilla but get kicked on the production Paper server
- Kicks correlate with specific skill executions (dig loop, crafting chain)

**Phase to address:** Phase 1 (Server setup) — verify bot operation against the actual Paper server with its plugin stack before investing in skill development.

---

### Pitfall 15: Migration from v1 — Old Memory Files Are Incompatible

**What goes wrong:**
The v1 agent stores memory in `agent/data/{name}/MEMORY.md`, `notepad.txt`, `skills/*/SKILL.md`, and `context/`. These files contain v1-specific references: action names like `place(x, y, z)`, `break_block(x, y, z)`, `look_at_block(x, y, z)` — all of which are replaced by Mineflayer skill function names. If v2 loads v1 MEMORY.md files, the LLM will try to call v1 actions that no longer exist, generating invalid skill calls and confusing the agent about its own capabilities.

**Why it happens:**
MEMORY.md is written by the LLM using whatever action vocabulary was current at the time. The v1 lessons reference HTTP-bridge semantics explicitly. A v2 agent loading v1 memory reads "use look_at_block before break_block to avoid drift" and tries to call a `look_at_block` skill that doesn't exist.

**How to avoid:**
Do not migrate v1 memory files directly to v2. Create new per-agent data directories for v2. Port the useful strategic knowledge (general Minecraft progression tips, base locations) manually into new MEMORY.md files using v2 vocabulary. Keep v1 data files archived but not in the v2 agent data path. Specifically: `agent/data/jeffrey_v1/` → read-only archive; `agent/data/jeffrey/` → fresh v2 directory.

**Warning signs:**
- v2 agent attempts actions like `look_at_block`, `break_block(x,y,z)`, `interact_block` from v1 vocabulary
- MEMORY.md references coordinates in v1 absolute format that v2 skills don't accept
- Agent references "the HTTP bridge" or "mod-side" concepts in its reasoning
- Skill function library returns "unknown skill" for actions the agent thinks it knows

**Phase to address:** Phase 0 (Migration setup) — clean data directory creation must happen before any v2 agent is started.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Not wrapping pathfinder in a timeout | Simpler skill code | Bot hangs permanently on unreachable goals; entire agent freezes | Never — add timeout in every navigation skill |
| Using `bot.recipesFor()` directly | Easy recipe lookup | Fails for non-oak wood variants and any tag-based recipe | Never for production crafting; use minecraft-data with tag resolution |
| Trusting `bot.dig()` return value without verification | One less async check | Silent failures on protected blocks; bot thinks it mined, proceeds with bad state | Never in survival gameplay; always verify block changed |
| Rolling window of 90 conversation turns | Captures full session history | Context overflow at ~90min; LLM loses earlier context; agent becomes incoherent | Never beyond MVP testing; cap at 40 turns with summarization |
| No item name normalization layer | Faster initial build | Any LLM hallucination corrupts skill calls; `undefined` errors throughout | Never — port normalization from v1 before first skill test |
| Synchronous fs.writeFileSync in Mind loop | Simpler code | Blocks event loop; delays keepalive responses; potential disconnect | MVP only; switch to async writes before extended sessions |
| Single process for all bots | No IPC complexity | One crash kills all bots; one bot's CPU spike delays others' keepalive | Only for 2 bots; use separate processes for 5+ |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Paper server + bots | Using online-mode auth when server is offline-mode | Set `auth: 'offline'` explicitly; offline Paper ignores auth but mineflayer defaults may try Microsoft auth and fail |
| VeinMiner plugin | Assuming bots trigger vein mining automatically | Configure plugin for command/server-side activation; do not rely on client packet handshake |
| mineflayer-pathfinder + Paper chunks | Calling goto() before chunks are loaded at spawn | Wait for `bot.waitForChunksToLoad()` after `spawn` event before any pathfinding |
| MiniMax M2.7 + Mind loop | Blocking Node.js event loop during LLM response processing | Keep all processing async; LLM response parsing must not block |
| Multi-agent + Paper chat | All bots listening to all chat without self-filter | Always check `username !== bot.username` before processing chat events |
| Paper spawn protection | Placing or digging near spawn (0,0) for testing | Test mining and placing away from spawn; set spawn-protection=0 in server.properties for dev |
| mineflayer-collect-block plugin | Assuming it works with Paper anti-cheat | This plugin uses rapid click packets; can trigger anti-cheat; prefer manual dig + pickup pattern |
| Crafting without crafting table | Calling craft for 3x3 recipes without placing table first | Skill must auto-place crafting table if inventory recipe requires one; check recipe size before crafting |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full state snapshot in every conversation turn | Context fills in 60-90min; LLM context errors | Delta state format; only changed fields per turn | After ~60 minutes at 15-30s Mind loop interval |
| `bot.findBlocks()` with large radius | Synchronous scan blocks event loop for 50-200ms | Use small radius (16-32 blocks); chunk scan progressively | At radius > 64, on a populated chunk |
| Pathfinder running with very large range | A* search space explodes; pathfinder uses CPU for 5-10s | Set `bot.pathfinder.thinkTimeout = 5000` AND add external wall clock timeout | When destination is > 200 blocks away in complex terrain |
| Writing memory files synchronously on every turn | Event loop blocked every 15-30s | Async file writes; dirty-flag batch flush every 60s | Constant impact from first use; worsens with multiple bots |
| `bot.inventory.items()` called repeatedly in tight loop | Array allocation on every call | Cache inventory snapshot; update only on `inventory.updateSlot` event | When called > 10 times per second in skill code |
| Multiple bots in one Node.js process without setImmediate breaks | One bot's LLM call delays all others' physics ticks | Separate processes per bot, or use worker threads for LLM calls | At 3+ bots in same process |

---

## "Looks Done But Isn't" Checklist

- [ ] **Navigation skill:** Often missing external wall-clock timeout — verify that `goto(unreachableBlock)` returns failure within 30s, not hangs forever
- [ ] **Mine skill:** Often missing post-dig block verification — verify `mine("oak_log")` fails gracefully on a protected block instead of reporting success
- [ ] **Craft skill:** Often missing tag-based recipe resolution — verify `craft("crafting_table")` works when bot has `spruce_planks` (not just `oak_planks`)
- [ ] **Place skill:** Often missing post-place block verification — verify `place()` timeout error does not falsely report failure when block was placed
- [ ] **Chest skill:** Often missing window lifecycle cleanup — verify that after a failed chest operation, the next chest operation succeeds (window not stuck open)
- [ ] **Multi-agent chat:** Often missing self-message filter — verify bots do not respond to their own chat messages in a multi-bot test
- [ ] **Respawn handling:** Often missing physics restart delay — verify bots do not get kicked for flying after death on the production Paper server
- [ ] **Context window:** Often underestimated — verify Mind loop runs for 2 hours continuously without context overflow errors
- [ ] **Item name normalization:** Often missing plural/display-name variants — test `craft("sticks")`, `equip("wooden sword")`, `mine("oak log")` all normalize and succeed

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Pathfinder hang (bot frozen) | LOW | Stop the bot process; add external timeout wrapper; redeploy |
| Silent dig failure (block protected) | LOW | Add post-dig block check to skill wrapper; no data loss |
| placeBlock timeout false negatives | LOW | Add post-placement block check; reduce false failure rate |
| Context window overflow in production | MEDIUM | Trim history to last 20 turns; add summarization step; resume session |
| VeinMiner not triggering for bots | LOW | Change plugin config to server-side/command activation; no code change needed |
| Bot kicked for flying after respawn | LOW | Add gravity fix to spawn handler; redeploy; no data loss |
| v1 memory files loaded by v2 agent | MEDIUM | Archive v1 data directory; create fresh v2 data directory; re-run agent |
| Chat flood loop from self-messages | LOW | Add `username !== bot.username` filter; hot-fix without restart |
| Keepalive disconnect during LLM retry storm | LOW | Make all I/O async; increase Paper keepalive timeout; no data loss |
| Crafting broken for non-oak wood | LOW | Fix recipe resolution in craft skill; test all plank variants |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Pathfinder indefinite hang | Phase 1: Core skills | Call `goto(bedrock_block)` — must return failure within 30s |
| dig() silent success on protected block | Phase 1: Core skills | Mine in spawn protection zone — must return `{ success: false }` |
| placeBlock blockUpdate timeout | Phase 1: Core skills | Place block on loaded Paper server under entity load — no false failures |
| Crafting recipe tag mismatch | Phase 2: Crafting skill | Craft crafting_table with spruce_planks — must succeed |
| Window lifecycle race | Phase 1: Core skills | Open chest, throw error mid-operation, open same chest again — must succeed |
| Context window overflow | Phase 3: Mind loop | Run 2-hour continuous session — no context overflow errors |
| GoalFollow sprint lock | Phase 2: Navigation skill | Follow a moving entity for 5 minutes — bot must not freeze |
| Respawn flying kick | Phase 1: Bot setup | Kill bot intentionally 3 times — no flying kicks on Paper server |
| VeinMiner client handshake | Phase 1: Server setup | Mine a log with VeinMiner plugin active — verify behavior matches expectation |
| Multi-agent chat flood | Phase 3: Multi-agent | Start 2 bots, send chat message — verify bots don't enter feedback loop |
| Skill promise leak | Phase 1: Core skills | All skills return structured result; no unhandledRejection events in 1hr test |
| Item name hallucination | Phase 1: Core skills | Feed 20 known hallucinated names to normalizer — all resolve correctly |
| Keepalive disconnect | Phase 1: Bot harness | Run bot idle for 10 minutes with slow simulated LLM — no disconnects |
| Anti-cheat flags rapid actions | Phase 1: Server setup | Run dig loop and crafting chain — no kicks on production Paper server |
| v1 memory file incompatibility | Phase 0: Migration | v2 agent loads fresh data dir — no v1 action names appear in reasoning |

---

## Sources

**Mineflayer GitHub Issues (HIGH confidence — official bug tracker):**
- [#3494: bot.dig doesn't fail when physically impossible](https://github.com/PrismarineJS/mineflayer/issues/3494) — silent success on protected blocks
- [#3791: Cannot use most features with Grim anti-cheat](https://github.com/PrismarineJS/mineflayer/issues/3791) — flying check failures every tick
- [#3549: recipesFor only recognizes oak_planks](https://github.com/PrismarineJS/mineflayer/issues/3549) — wood tag matching broken
- [#3492: problem with 1.21.1](https://github.com/PrismarineJS/mineflayer/issues/3492) — advancement packet deserialization errors
- [#3360: windowOpen did not fire within timeout](https://github.com/PrismarineJS/mineflayer/issues/3360) — 20s chest open hang
- [#2757: blockUpdate did not fire within timeout](https://github.com/PrismarineJS/mineflayer/issues/2757) — entity-load-induced placeBlock failure
- [#2673: bots disconnecting with keepalive timeout](https://github.com/PrismarineJS/mineflayer/issues/2673) — keepalive disconnect pattern
- [#671: bot kicked for flying](https://github.com/PrismarineJS/mineflayer/issues/671) — respawn physics gap causing anti-cheat kick

**mineflayer-pathfinder GitHub Issues (HIGH confidence):**
- [#222: Pathfinding hangs on unbreakable block](https://github.com/PrismarineJS/mineflayer-pathfinder/issues/222) — thinkTimeout does not fire in hanging state
- [#332: Bot constantly stuck with GoalFollow](https://github.com/PrismarineJS/mineflayer-pathfinder/issues/332) — sprint lock, control state desync
- [#273: Pathfinder stuck with partial computed path](https://github.com/PrismarineJS/mineflayer-pathfinder/issues/273) — active goal + incomplete path = stuck

**VeinMiner (MEDIUM confidence — official GitHub):**
- [VeinMiner by 2008Choco](https://github.com/2008Choco/VeinMiner) — client-side mod activation requirement, optional companion mod

**Mindcraft project (MEDIUM confidence — community project similar to ours):**
- [Mindcraft FAQ](https://github.com/kolbytn/mindcraft/blob/main/FAQ.md) — "mineflayer's pathfinder is imperfect"; "brain disconnected" for LLM API errors; Node 18/20 required
- [Mindcraft README](https://github.com/kolbytn/mindcraft) — code execution sandboxed at 750ms; action limits; skill storage pattern

**v1 post-mortem (HIGH confidence — first-party):**
- `/home/bigphoot/.claude/projects/-home-bigphoot-Desktop-hermescraft/memory/project_v11_diagnosis.md`
- Item name normalization patterns (sticks, oak_planks_4, wooden_door, etc.) — confirmed failure modes from live testing

---
*Pitfalls research for: HermesCraft v2.0 — Mineflayer rewrite, Mind + Body architecture, Paper 1.21.1*
*Researched: 2026-03-22*
