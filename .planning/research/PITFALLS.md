# Pitfalls Research

**Domain:** Minecraft AI agent — building systems, crafting solvers, spatial memory, HTTP-bridge architecture
**Researched:** 2026-03-21
**Confidence:** HIGH (based on direct codebase inspection + v1.0 live testing post-mortem)

---

## Critical Pitfalls

### Pitfall 1: Place Action Uses Free-Space Coords, Not Surface + Face

**What goes wrong:**
The current `handlePlace` in ActionExecutor.java requires the LLM to supply the exact empty coordinate where the block should land. The LLM does not know which positions are empty — it knows where existing blocks are (from `surfaceBlocks`). So it guesses, fails 90% of the time, and the build stalls. The current code does find an adjacent support block, but the LLM still has to supply the target air position, which it consistently gets wrong.

**Why it happens:**
Mineflayer's `placeBlock(referenceBlock, faceVector)` API is surface-aware by design — you click a face to place on. The HTTP bridge instead accepts a destination coordinate, which inverts the mental model. LLMs trained on Minecraft knowledge reason in terms of "place on top of this block" not "place at coordinate (x, y, z)."

**How to avoid:**
Change the `place` action API to accept a surface block coordinate plus an optional face direction (`top`, `north`, `south`, `east`, `west`, `bottom`). The mod resolves the destination by offsetting in the face direction. Default face is `top` when unspecified. The LLM calls `place(item, x, y, z, face="top")` where x,y,z is the block it sees in `surfaceBlocks`. This matches how a human player thinks.

**Warning signs:**
- "Cannot place at X,Y,Z — occupied by..." errors in logs (LLM targeting existing blocks)
- "Cannot place at X,Y,Z — no adjacent block" errors (LLM targeting free air with no support)
- Build progress stalls at 0 blocks after builder reports "started"
- Agent repeatedly calls `place` on the same coord before switching to something else

**Phase to address:** Phase 1 (Smart place action) — first change before any building feature is attempted. Everything downstream depends on this working.

---

### Pitfall 2: Hotbar-Only Item Selection Breaks Place and Equip

**What goes wrong:**
The current `selectHotbarItem` helper (called by `handlePlace` and `handleInteractEntity`) only scans hotbar slots 0-8. If the item is in main inventory slots 9-35, it returns false and the action fails with "Item not found in hotbar." Agents with full hotbars silently fail to place blocks they demonstrably possess.

**Why it happens:**
Vanilla player block placement requires the item in the active hotbar slot. Developers write the hotbar scan first, and the main inventory fallback is left as a TODO. In the current code, `handleEquip` already handles the swap-to-hotbar-slot-0 case for items in main inventory, but `handlePlace` does not call `handleEquip` first — it calls `selectHotbarItem` directly. The fix path is not to duplicate the equip logic in `handlePlace` but to call the equip path unconditionally before placing.

**How to avoid:**
In the smart place refactor, always call the equip logic before attempting placement. The equip action moves an item from any inventory slot to hotbar slot 0 via `SlotActionType.SWAP`. Place can then proceed knowing the item is in the hotbar.

**Warning signs:**
- "Item not found in hotbar: X" errors when agent's inventory (in state dump) shows the item is present
- Agent crafts an item successfully, then immediately fails to place it (crafted item lands in main inventory)
- After a chest deposit/withdraw cycle, equip and place actions start failing

**Phase to address:** Phase 1 (Smart place action). The equip-before-place logic is part of the same atomic operation.

---

### Pitfall 3: Crafting Chain Attempted Without Prerequisites

**What goes wrong:**
The LLM attempts to craft an item without first resolving whether it has all intermediate ingredients. Example: crafting `wooden_pickaxe` requires `oak_planks` and `stick`. The LLM knows this in theory but calls `craft(wooden_pickaxe)` when it only has `oak_log`. The mod-side craft handler finds a recipe but fails at ingredient lookup. The error message says "Missing ingredient: stick" — the agent then tries to `craft(stick)`, fails because it needs planks, then tries `craft(oak_planks)`, succeeds — but now the original plan is abandoned and the agent is in a reactionary loop.

**Why it happens:**
Without a dependency graph, the agent must discover the chain through trial and error. Each failure costs 2-4 ticks (action + result + next decision). A 3-step chain (log → planks → stick → pickaxe) can take 20+ ticks to complete versus 4 ticks with a pre-resolved plan. The `validatePreExecution` in `actions.js` already catches some cases (planks check for wooden_pickaxe) but uses hardcoded rules that cover maybe 20% of recipes.

**How to avoid:**
Build a static recipe graph covering vanilla 1.21.1 items. On `craft(item)` validation, walk the dependency tree and check inventory against the full ingredient list. Return a sorted execution sequence if ingredients are missing rather than failing. Keep this as a Node.js-side lookup table (not mod-side) — the mod already has `RecipeLookup.java` which can be queried via `/recipes` endpoint, but it only returns one level deep. The agent-side graph needs to handle multi-level resolution.

**Warning signs:**
- Repeated craft→fail→craft(prerequisite)→craft(prerequisite prerequisite) loops in logs
- Agent takes 15+ ticks to craft a pickaxe
- "Missing ingredient" errors followed immediately by a craft call for that ingredient (shows trial-and-error)
- `validatePreExecution` passes but mod-side craft still fails

**Phase to address:** Phase 2 (Crafting chain solver). Must come before complex building tasks that need many crafted items.

---

### Pitfall 4: Item Name Mismatch Between LLM Output and MC Registry

**What goes wrong:**
The LLM outputs item names that do not match Minecraft registry IDs. Confirmed failures from v1.0: `sticks` (should be `stick`), `oak_planks_4` (should be `oak_planks`), `oak_door_3` (should be `oak_door`), `wooden_planks` (should be `oak_planks`). These reach the mod's `handleCraft`, `handleEquip`, or `handlePlace` and fail silently or return "No crafting recipe found."

**Why it happens:**
LLMs learn Minecraft item names from a mix of wiki text, forum posts, and code. The wiki uses both display names ("Oak Planks") and IDs ("minecraft:oak_planks"). Forum posts use colloquial names ("planks," "sticks"). Training data is inconsistent. The LLM generalizes and invents plausible-sounding names. There is no validation at the prompt layer that rejects non-registry names before they reach the mod.

**How to avoid:**
Implement a normalization layer in `actions.js` before any action dispatch. Maintain a map of known LLM hallucinations to correct IDs. Also add a fuzzy-match fallback: strip trailing `_N` (quantity suffixes), normalize plurals (`sticks` → `stick`), handle common synonyms (`wood` → `oak_log` for crafting context, `planks` → `oak_planks`). The normalization map should be data-driven, not a giant if-else chain — a JSON file that can be updated without code changes.

Known mappings needed (from v1.0 testing):
- `sticks` → `stick`
- `oak_planks_4` / `wooden_planks` / `planks` → `oak_planks`
- `oak_log_1` / `wood` → `oak_log`
- `oak_door_3` / `wooden_door` → `oak_door`
- `cobble` → `cobblestone`
- `iron_ore` → `raw_iron` (1.18+ name change)
- `gold_ore` → `raw_gold`

**Warning signs:**
- "No crafting recipe found for X" when X sounds like a valid item
- Craft succeeds server-side but agent can't find the item in inventory afterward
- Equip fails with "Item not found" for items agent just crafted
- Logs show item name with trailing `_N` (numeric suffix)

**Phase to address:** Phase 1 (Item name normalization). Required before any other tool fix — bad names corrupt every downstream action.

---

### Pitfall 5: Block Placement During Active Builder Run Causes Double-Place

**What goes wrong:**
The builder loop in `builder.js` runs on each action-loop tick independently of the planner's queue. If the planner emits a `place` action while a builder run is active, two concurrent placement commands hit the mod. The mod's `AtomicReference<PendingAction>` only accepts one pending action at a time — the second is rejected with "Another action is already pending." But the builder also interprets an HTTP error as "retry next tick," so the builder re-attempts the same block indefinitely.

**Why it happens:**
`isBuildActive()` is checked in the planner to suppress the action queue, but this flag returns false when the build is paused for materials. During the pause, the planner generates gather-resource actions. If the gather actions resolve faster than expected and the build auto-unpauses, there's a race window where both loops are active simultaneously.

**How to avoid:**
Designate a single "command authority" per tick. The action loop checks `isBuildActive()` and `isFarmActive()` before executing planner actions; when either is active, only the subsystem loop runs. Add an explicit mutex flag (`_buildTakingTick`) set at the start of `resumeBuild()` and cleared on completion, and have the main action loop skip its own dispatch when this flag is set.

**Warning signs:**
- "Another action is already pending" errors appearing during builder runs
- Build progress counter increments erratically (some ticks count double, some zero)
- Same block coord appears multiple times in builder success logs
- Builder reports "complete" with fewer placed blocks than `totalBlocks`

**Phase to address:** Phase 3 (Freestyle building). Must be resolved before the builder loop is considered reliable.

---

### Pitfall 6: Chest Interaction Opens Screen But Doesn't Verify Contents Before Acting

**What goes wrong:**
The chest deposit/withdraw flow requires a multi-step sequence: navigate to chest → interact_block (opens screen) → then slot manipulations. If the chest is already open on a prior tick (the screen handler is a `GenericContainerScreenHandler`) the agent re-sends `interact_block`, which closes the chest instead of operating on it. This toggles the chest open/closed every other command.

**Why it happens:**
`interact_block` in the mod calls `interactBlock` unconditionally. For chest blocks, this is a toggle — first call opens, second call closes. The agent has no visibility into whether the chest screen is currently open (the `/state` endpoint doesn't report open screen type).

**How to avoid:**
Add a `screenType` field to the `/state` response (e.g., `"screenType": "chest"` / `"screenType": null`). The agent-side chest interaction handler checks `screenType` before sending `interact_block`. If the chest is already open, it proceeds directly to slot manipulation commands rather than re-opening. Add a `deposit_item` and `withdraw_item` action that wraps this logic at the mod level — the mod checks if a chest screen is open, opens it if not, then performs the slot operation.

**Warning signs:**
- Chest opens then immediately closes in logs
- Agent alternates between "Interacted with chest" and "Closed screen" on consecutive ticks
- `interact_block` on a chest coord returns success but no items transfer
- State shows chest in `nearbyBlocks` but agent inventories never change

**Phase to address:** Phase 1 (Chest interaction). State exposure must happen as part of the same phase.

---

### Pitfall 7: Spatial Memory Grows Unbounded and Corrupts Prompt

**What goes wrong:**
The `locations.js` `getLocationsForPrompt()` function returns all known locations as a single line. With active exploration, this line can grow to 500+ characters and then to several kilobytes as locations accumulate. When injected into every planner prompt, it consumes token budget and eventually crowds out more important context. The `chests.js` `getChestsForPrompt()` has the same problem — no cap on chest entries.

**Why it happens:**
Initial implementations cap the danger-location list at 10 (correct) but apply no cap to regular locations or chests. Two agents running for a few hours will discover hundreds of locations. No pruning strategy exists.

**How to avoid:**
Cap location prompt injection at the N most recently visited or nearest to current position. For the full spatial memory, use a tiered approach: locations within 100 blocks get full detail, 100-500 blocks get name+coord only, beyond 500 blocks are omitted from prompt (still stored on disk for retrieval when navigating). Apply the same proximity filter to chests. Add a `pruneOldLocations(maxCount)` function that keeps the most recently saved entries up to a configurable limit (50 is reasonable for a survival world).

**Warning signs:**
- Planner system prompt exceeds 8000 chars for location context alone
- LLM context overflow errors increase over time as session ages
- Agent navigation decisions reference stale locations from early session
- `locations.json` file size exceeds 100KB after a long session

**Phase to address:** Phase 4 (Spatial memory). The growth problem must be designed out at inception, not retrofitted.

---

### Pitfall 8: Blueprint Palette Resolution Silently Falls Back to Wrong Block

**What goes wrong:**
`resolvePalette()` in `blueprints.js` falls back to `preferred[0]` when the agent doesn't have any preferred block. This means a blueprint designed for `oak_planks` silently uses `cobblestone` when the agent has no planks, building a stone version of a wooden structure. The build completes "successfully" but produces nonsense. The agent has no indication this happened.

**Why it happens:**
The fallback was designed to keep the builder running rather than failing. But silent wrong-material substitution is worse than a clear failure. The material list in `startBuild`'s return value shows the intended materials, not what was actually used — the substitution happens invisibly.

**How to avoid:**
When palette resolution falls back to a non-preferred block, record the substitution explicitly and include it in the build start response. Better: block the build start if more than 50% of palette entries need substitution, and return a material list of what's needed. Let the agent decide whether to gather first or accept substitution. For the freestyle builder (v1.1), the LLM designs with materials it has, so this is less likely — but still add a substitution audit log for debugging.

**Warning signs:**
- Built structure looks visually wrong (stone where wood expected)
- Build completes with `placed === totalBlocks` but structure doesn't match blueprint name
- Vision BUILD evaluation returns low score for a "completed" build
- Palette has only one `preferred` entry that the agent lacks

**Phase to address:** Phase 3 (Freestyle building). Address during blueprint system rework, not before.

---

### Pitfall 9: Sustained Action Lock Blocks All Commands If Action Never Completes

**What goes wrong:**
The `AtomicReference<PendingAction>` + `currentSustained` design in ActionExecutor.java blocks all new actions while a sustained action is running. If a sustained action never completes (e.g., `break_block` targeting a block the player isn't looking at, `smelt` waiting for furnace screen that was closed by another agent), the mod is permanently locked. The 10-second timeout in `execute()` times out on the HTTP side and returns an error to Node.js, but `currentSustained` is NOT cleared — it just times out waiting.

**Why it happens:**
The `future.get(10, TimeUnit.SECONDS)` timeout in `execute()` cancels the wait but does NOT complete or nullify the `SustainedAction`. The `tickSustainedAction` loop continues running for up to its `maxTicks` limit. During this window, all subsequent HTTP calls get "Busy with sustained action" errors. If the tick count is high (e.g., `break_block` with 200 ticks = 10 seconds), the lockout duration equals the timeout + tick duration.

**How to avoid:**
When `execute()` times out, call `currentSustained.future.complete(error)` AND set `currentSustained = null` from the HTTP thread. This requires careful synchronization. Alternatively, add a `lastActionTimestamp` and if the sustained action's future was already completed externally (via timeout), `tickSustainedAction` should detect `sa.future.isDone()` and clear itself. The safest fix: `tickSustainedAction` always checks `sa.future.isDone()` at the top and self-clears.

**Warning signs:**
- All actions return "Busy with sustained action: X" for minutes at a time
- The sustained action type in the error is an old one (from a different context)
- Agent logs show "Action timed out" followed immediately by stuck-detection recovery
- After agent recovery (history wipe), actions still fail with "Busy"

**Phase to address:** Phase 1 (Smart place / tool hardening). This is a mod-side fix that must be verified before any sustained action is trusted.

---

### Pitfall 10: LLM Freestyle Build Design Uses Blocks Not in Inventory

**What goes wrong:**
For freestyle building, the planner generates a markdown block layout and the builder executes it. The planner prompt includes inventory state, but the LLM designs structures using blocks it finds aesthetically pleasing rather than constrained to what it has. Common failure: LLM designs a structure with `glass_pane`, `oak_slab`, `spruce_planks` when the agent only has `oak_log` and `cobblestone`. The builder starts, immediately reports `paused: missingMaterials`, and the agent spends the next 20 cycles gathering materials that may not exist in the immediate area.

**Why it happens:**
The planner prompt describes inventory but the creative intelligence layer (CREATIVE_BEHAVIOR) encourages aesthetic choices. These two forces conflict. The LLM optimizes for aesthetics within what it believes is available, but inventory names in the prompt may use imprecise names (the normalization issue from Pitfall 4), causing the LLM to think it has items it doesn't.

**How to avoid:**
The freestyle build planner prompt must receive the inventory as a list of exact canonical names with counts. The instructions must explicitly state: "Design ONLY using blocks from this inventory list." Additionally, compute a "buildable with current inventory" flag before forwarding the design to the builder. Reject designs that require more than 10% non-inventory materials. Include a materials checklist in the LLM's self-review step.

**Warning signs:**
- Build pauses within the first 3 blocks placed
- `missingMaterials` list contains items the agent has never seen in the world
- Builder cycles between paused/gathering without making progress
- Agent wanders far from base to find materials for a building design

**Phase to address:** Phase 3 (Freestyle building). The constraint must be designed into the build-planning prompt, not patched afterward.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded craft prerequisite checks in `validatePreExecution` | Catches most common failures quickly | Breaks for any recipe not in the ~15 hardcoded cases; must be updated manually for every new item | Never — replace with data-driven recipe graph in Phase 2 |
| `selectHotbarItem` only scans slots 0-8 | Simple to implement | Silently fails when item is in main inventory; causes cascading equip/place failures | Never in production — fix in Phase 1 |
| `resolvePalette` fallback to cobblestone | Build never stops for missing blocks | Structure is built wrong with no error signal; vision evaluation gives misleading low scores | Never — substitute should be explicit or build should fail cleanly |
| Single-file `locations.json` with no cap | Easy to read/write | Grows unbounded; corrupts prompt context over long sessions (2+ hours) | Only if max 50 locations expected; add cap in Phase 4 |
| `getChestsForPrompt` inlines all chest contents | Full context for decisions | Unreadable prompt at scale; 10 chests × 20 items = 200+ token line | Cap at 5 nearest chests in Phase 1 |
| Blueprint system uses fixed ASCII grid patterns | Easy to specify structures | LLM can't generate new blueprints; requires manual JSON authoring for every structure | MVP only — replace with freestyle markdown builder in Phase 3 |
| `_seenChatMessages` as in-memory Set | No duplicate processing | Lost on restart; all messages treated as new after crash/restart | Acceptable if restart is rare; persist to disk if stability matters |

---

## Integration Gotchas

Common mistakes when connecting to HermesBridge mod or external systems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| HermesBridge `/action` POST | Sending next action before current sustained action completes (assume 2s tick > sustained duration) | Check `currentSustained` status via `/state` `screenType` field, or await previous action response before dispatching next |
| Mod-side place action | Supplying destination coordinates (empty air) instead of support block + face direction | Supply support block coords + face direction; let mod compute destination offset |
| Crafting screen state | Sending `craft` without verifying screen is open; mod auto-opens crafting table but returns "send again next tick" | Always send `craft` twice for 3x3 recipes — first opens screen, second executes |
| Smelt action | Sending `smelt` once expecting ore to smelt instantly | Smelt only loads the furnace; smelting takes 10 seconds of real time; agent must re-query later or use a wait/check loop |
| Chest interaction via `interact_block` | Sending `interact_block` on chest when screen is already open (closes it instead) | Expose `screenType` in `/state`; check before sending interact_block |
| Skript `/scan` command result | Expecting synchronous result in same tick | `/scan` result arrives as chat message on a later tick; INFO_ACTIONS must await the chat response before deciding |
| Baritone `navigate` | Treating navigate as synchronous (fire and forget, assume arrived) | Navigate is async; agent must detect arrival via position comparison across ticks or await Baritone completion chat message |
| Paper StopSpam plugin | Chaining multiple `/qs` or `/scan` commands within 5 seconds | Enforce 5s gap between plugin commands; StopSpam will silently swallow the second command |
| Fabric client tick thread vs HTTP thread | Calling client methods directly from HTTP handler thread | All client-side operations must be dispatched via `client.execute()` or the AtomicReference pending-action pattern; direct calls cause thread safety crashes |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Chest prompt injection at scale | System prompt size exceeds 8K chars for location/chest context alone | Cap `getChestsForPrompt` to 5 nearest chests; cap `getLocationsForPrompt` to 30 nearest locations | After 10+ chests discovered (~2 agent-hours) |
| Builder sending 3 HTTP place requests per tick | One or two return "Another action pending"; builder interprets as retry, loops | Reduce BLOCKS_PER_TICK to 1; only send next after previous HTTP response confirmed | When mod is under load or tick processing > 50ms |
| `_seenChatMessages` Set grows forever in planner.js | Memory pressure over multi-day sessions | Cap at 1000 entries; prune oldest on overflow | After ~12 hours of active chat at 2 agents (low risk now) |
| Planner 500-message rolling history with very long messages | 200K context fills faster than expected; graduated trim fires every cycle | Keep planner messages concise; trim build/farming status lines to 1 sentence | Continuous sessions > 8 hours with verbose planner output |
| `locations.json` sync write on every `trackChest` | I/O momentarily blocks Node.js event loop | Batch: dirty-flag + flush every 30s | Not a problem at 2 agents; matters at 10+ |
| Blueprint queue holds 200+ blocks in memory | Memory not a concern but builder ticks slow if queue iteration is O(n) | Keep queue as array with `shift()`; avoid recomputing missing materials by scanning full remaining queue each pause | Structures > 100 blocks with frequent material pauses |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Smart place action:** Often missing auto-equip-from-inventory step — verify that placing a block crafted mid-session (item in main inventory, not hotbar) succeeds without a prior explicit equip call
- [ ] **Crafting chain solver:** Often missing multi-level dependency resolution — verify that `craft(wooden_pickaxe)` from a `oak_log`-only inventory emits the sequence [craft(oak_planks), craft(stick), craft(wooden_pickaxe)] not just "missing ingredients"
- [ ] **Item name normalization:** Often missing plural forms and quantity suffixes — verify `sticks`, `oak_planks_4`, `wooden_door`, `cobble` all normalize correctly before reaching the mod
- [ ] **Chest deposit/withdraw:** Often missing screen-state guard — verify that sending `interact_block` on an already-open chest does not close it; verify that deposit places items into correct slots
- [ ] **Spatial memory pruning:** Often missing proximity filter on prompt injection — verify `getLocationsForPrompt()` after 100+ discovered locations still produces a string under 500 chars
- [ ] **Freestyle builder material constraint:** Often missing inventory-only enforcement — verify the LLM design step does not produce blocks absent from the canonical inventory list in the prompt
- [ ] **Sustained action self-clear on timeout:** Often missing — verify that after a 10s action HTTP timeout, the next action executes within 1 tick with no "Busy with sustained action" error
- [ ] **Crafting table auto-open two-call pattern:** Often missing second-call awareness — verify that `craft(chest)` (3x3 recipe) sent once returns "Opening crafting table" and the second call actually crafts, not "Opening crafting table" again

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Sustained action lock (timeout not clearing currentSustained) | LOW | Add `currentSustained = null` on future timeout in `execute()`; no data loss; requires mod rebuild + client restart |
| Item name normalization gap (new hallucination pattern) | LOW | Add entry to normalization map JSON; hot-reload without restart |
| Crafting chain fails mid-sequence (partial ingredients consumed) | LOW | Agent detects missing-ingredient error; mod already returns partial crafting grid back to inventory on failure; agent re-plans |
| Chest toggle (open/close cycling) | MEDIUM | Add `screenType` to `/state` endpoint; requires mod rebuild + client restart; existing sessions unaffected after restart |
| Spatial memory prompt overflow | LOW | Add character cap to `getLocationsForPrompt`; immediate fix in JS with no data loss |
| Blueprint wrong material substitution (already built) | HIGH | Cannot undo blocks already placed; add audit log and substitution guard for future builds; manual cleanup required |
| Freestyle build stuck in materials-pause loop | LOW | Builder auto-pauses and reports what's needed; agent can gather and resume; no code change needed |
| Place action: floating block (no adjacent support) | LOW | Error message already clear; agent must look_at_block first before place; no fix needed if place API is surface-based |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Place action wrong coordinate model (free-space vs surface+face) | Phase 1: Smart place | Place a block on top of a visible surface block from inventory without specifying destination coords |
| Hotbar-only item selection for place/equip | Phase 1: Smart place | Place a block that was just crafted (lands in main inventory) without a prior explicit equip call |
| Item name normalization gaps | Phase 1: Normalization layer | Send `craft(sticks)`, `craft(oak_planks_4)`, `craft(wooden_door)` — all normalize and succeed or give correct errors |
| Chest toggle on interact_block | Phase 1: Chest interaction | Open a chest; confirm `/state` shows `screenType: "chest"`; send deposit; chest stays open |
| Sustained action lock on HTTP timeout | Phase 1: Mod hardening | Force break_block to timeout; verify next action executes within 1 tick |
| LLM non-registry item names | Phase 1: Normalization | Run normalization test against 20+ known hallucination patterns |
| Crafting chain no prerequisites (trial-and-error) | Phase 2: Crafting solver | Call `craft(wooden_pickaxe)` from oak_log-only inventory; verify auto-resolves in correct order with no intermediate failures |
| Freestyle build uses wrong materials | Phase 3: Freestyle builder | Design step enforces inventory-only constraint; verify 0 material-pause events in first 10 blocks |
| Blueprint silent material substitution | Phase 3: Builder rework | Verify substitution is logged and reported; build fails gracefully if > 50% palette needs substitution |
| Builder + planner double-place race | Phase 3: Freestyle builder | Run planner and builder simultaneously under load; verify no "Another action pending" errors during builder run |
| Spatial memory prompt growth | Phase 4: Spatial memory | After 100 saved locations, verify prompt injection under 500 chars |
| Chest prompt unbounded growth | Phase 1: Chest interaction | After 20 tracked chests, verify `getChestsForPrompt` under 300 chars |

---

## Sources

- Direct code inspection: `/home/bigphoot/Desktop/hermescraft/agent/actions.js` — validatePreExecution hardcoded recipe checks, selectHotbarItem scope
- Direct code inspection: `/home/bigphoot/Desktop/hermescraft/mod/src/main/java/hermescraft/ActionExecutor.java` — handlePlace coordinate model, startCraft two-call pattern, AtomicReference timeout behavior
- Direct code inspection: `/home/bigphoot/Desktop/hermescraft/agent/builder.js` — BLOCKS_PER_TICK concurrent dispatch, isBuildActive race window
- Direct code inspection: `/home/bigphoot/Desktop/hermescraft/agent/blueprints.js` — resolvePalette cobblestone fallback, silent substitution
- Direct code inspection: `/home/bigphoot/Desktop/hermescraft/agent/chests.js`, `locations.js` — unbounded growth, no prompt cap
- v1.0 live testing post-mortem: `/home/bigphoot/.claude/projects/-home-bigphoot-Desktop-hermescraft/memory/project_v11_diagnosis.md`
- Community pattern: [mineflayer placeBlock without item in hand issue #2320](https://github.com/PrismarineJS/mineflayer/issues/2320) — confirmed equip-before-place requirement
- Research: [Plancraft LLM crafting evaluation dataset](https://homepages.inf.ed.ac.uk/alex/papers/colm.pdf) — LLMs struggle with multi-step crafting dependency resolution; confirmed hallucinated item names
- Research: [Voyager Minecraft agent](https://voyager.minedojo.org/) — documented hallucinated item names (copper sword) and missed task completion as recurring failure modes
- [Minecraft Wiki: Identifier](https://minecraft.wiki/w/Identifier) — canonical registry name format reference

---
*Pitfalls research for: HermesCraft v1.1 — tool quality, building intelligence, HTTP-bridge agent*
*Researched: 2026-03-21*
