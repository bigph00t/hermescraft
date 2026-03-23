# Phase 22: Polish & Tool Fixes - Research

**Researched:** 2026-03-23
**Domain:** Node.js Mineflayer agent bug fixes, prompt tuning, persistence verification, overnight stability
**Confidence:** HIGH — all findings derived from direct codebase analysis; no external sources required

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting.

### Claude's Discretion
Use ROADMAP phase goal, success criteria, and codebase conventions to guide all decisions.

Known bugs from STATE.md:
- Tool auto-equipping bug: agents mine with fists instead of pickaxe
- Nightly agent restart for ONNX memory leak mitigation (embedding model)
- ONNX tensor memory leak (transformers.js issue #860)

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

---

## Summary

Phase 22 is a pure polish and bugfix phase. There is no new feature work. The four success criteria map cleanly to four independent fix areas: (1) auto-equip before mine/gather, (2) overnight stability via nightly restart, (3) prompt quality tuning, (4) persistence correctness verification.

The most important fix is the tool auto-equip bug. Source analysis reveals that `mine.js` already calls `bot.tool.equipForBlock(target, { requireHarvest: true })` and correctly returns `no_suitable_tool` when the bot has no pickaxe — so the bug is NOT in mine.js. The bug is in `gather.js`, which calls `bot.tool.equipForBlock(target)` without `requireHarvest: true` and then never checks whether the equip actually succeeded before digging. When the bot has no appropriate tool, `equipForBlock` silently falls through and the bot swings with an empty hand. Fix: add a post-equip check in gather.js mirroring the mine.js `canHarvestWith()` pattern, plus call `equipForBlock` with `{ requireHarvest: true }` where the block has harvest requirements.

The nightly restart is a one-line cron addition to `launch-duo.sh` — no code changes needed. Persistence is already correct architecturally (WAL mode, atomic renames, per-agent data dirs), but needs a startup validation pass to confirm no regressions. Prompt tuning is adjustable directly in `mind/prompt.js` — the building ambition, exploration drive, and chat frequency sections are already present and clearly organized.

**Primary recommendation:** Fix gather.js equip check first (highest agent pain), add nightly restart to launch-duo.sh second, then tune prompt constants, then run a persistence smoke check.

---

## Bug 1: Tool Auto-Equip (PRIMARY)

### Root Cause Analysis

**mine.js (lines 83-95)** — CORRECT. Already calls `equipForBlock(target, { requireHarvest: true })`, then explicitly checks `canHarvestWith(target, heldType)`. Returns `{ success: false, reason: 'no_suitable_tool' }` if the check fails. The mine skill stops immediately when no qualifying tool exists.

**gather.js (lines 62-64)** — BUGGY. Calls `bot.tool.equipForBlock(target)` WITHOUT `requireHarvest: true`. The `{ requireHarvest: true }` option is the mineflayer-tool-plugin flag that restricts equip to tools that actually yield a drop. Without it, the plugin may equip any item (including bare-nothing). After the equip call there is NO check that the held item can harvest the target block. The bot then calls `digBlock(bot, fresh)` with whatever is in its hand.

**Exact location of bug:** `body/skills/gather.js` line 64:
```js
try { await bot.tool.equipForBlock(target) } catch {}
```

**Fix:** Mirror the mine.js pattern — add `{ requireHarvest: true }` to the option, and add a post-equip harvest check. For gather (unlike mine), failing to have the right tool should NOT be a hard stop — gather is for wood and dirt and grass which have no tier restriction. The check should only block when `block.harvestTools` is defined AND the held item does not qualify.

**Pattern to reuse from mine.js:**
```js
// In gather.js — after equipForBlock call:
try { await bot.tool.equipForBlock(target, { requireHarvest: true }) } catch {}

// Check whether the held item can actually harvest this block.
// For blocks without harvestTools (wood, dirt, sand, grass), this always passes.
// For blocks that require a tier (deepslate, stone in gather context), this prevents
// wasting a dig attempt that yields nothing.
const heldType = bot.heldItem ? bot.heldItem.type : null
if (!canHarvestWith(target, heldType)) {
  console.log(`[gather] cannot harvest ${normalized} with current tools — skipping`)
  continue  // skip candidate, try next (don't abort whole gather like mine does)
}
```

Note: gather uses `continue` not `return` — miners hard-stop because wrong-tier mining wastes time on ALL remaining candidates. Gatherers can skip individual blocks (e.g., skip deepslate if no iron pickaxe, keep gathering nearby dirt).

The `canHarvestWith` function needs to be duplicated in gather.js or extracted to a shared `body/tools.js` utility. Given the project convention of flat camelCase files in body/, a new `body/tools.js` exporting `canHarvestWith` is the right move.

### Verification (source-level only, no live MC)

After fix:
- Smoke test still passes (no new exports required — internal change)
- `gather.js` import list remains the same (no new dependencies if `canHarvestWith` is inlined or shared)
- `mine.js` canHarvestWith can be moved to body/tools.js and imported by both

---

## Bug 2: ONNX Memory Leak — Nightly Restart

### Problem

`@huggingface/transformers` (ONNX Runtime backend) leaks native tensor memory on repeated inference. Each `retrieveKnowledge()` call embeds the query. Over 8-12 hours the Node.js process RSS grows by 10-50MB/hr (documented in transformers.js issue #860 — OPEN as of 2025).

### Current State

The `launch-duo.sh` restart loop already handles crash-restart with `while true; do node start.js; done`. What's MISSING is a scheduled daily restart to preemptively clear the heap before OOM.

### Solution

Add a nightly restart to `launch-duo.sh`. Two options:

**Option A — cron-based kill+restart (outside tmux):** A cron job at 04:00 that kills and relaunches the tmux session. Simple but requires cron on RunPod pod.

**Option B — in-process scheduled restart (recommended):** Add a `RESTART_INTERVAL_MS` env var (default `43200000` = 12 hours). In `start.js`, after all init is complete:
```js
// Nightly restart for ONNX memory leak mitigation (transformers.js issue #860)
const RESTART_INTERVAL_MS = parseInt(process.env.RESTART_INTERVAL_MS || '43200000', 10)
if (RESTART_INTERVAL_MS > 0) {
  setTimeout(() => {
    periodicSave(); savePlayers(); saveLocations(); saveBuildHistory()
    console.log('[hermescraft] scheduled restart for ONNX memory leak mitigation')
    process.exit(0)  // exit code 0 — the while-true loop in launch-duo.sh will restart
  }, RESTART_INTERVAL_MS)
}
```

The `while true; do node start.js; CODE=$?; [ $CODE -eq 0 ] && break; done` pattern in launch-duo.sh BREAKS on exit code 0. The inner restart must exit with a non-zero code, OR the launch-duo.sh loop must be changed to `while true; do ... done` (never break on 0).

**Actual issue in launch-duo.sh:** The current loop is:
```bash
while true; do
    node start.js
    CODE=$?
    [ $CODE -eq 0 ] && break
    echo "[!] crashed — restarting in 5s..."
    sleep 5
done
```

This means `exit 0` stops the agent. Fix the restart loop to NOT break on 0, and use a special exit code (e.g., 42) as the "restart requested" signal:
```bash
while true; do
    node start.js
    CODE=$?
    [ $CODE -eq 0 ] && break       # clean shutdown — stop
    [ $CODE -eq 42 ] && continue   # scheduled restart — loop immediately
    echo "[!] crashed (exit $CODE) — restarting in 5s..."
    sleep 5
done
```

And in start.js scheduled restart: `process.exit(42)`.

**Option B is the correct approach** — keeps restart logic self-contained, survives cloud reboots, works with the existing tmux/launch structure.

---

## Bug 3: Prompt Tuning

### Current State of Relevant Prompt Sections

All tuning targets live in `mind/prompt.js` `buildSystemPrompt()`. The file is well-organized with Part 1 through Part 8 clearly labeled. Current state:

**Chat frequency (Part 2, "TALK. A LOT." section):**
- Current: "every 1-2 actions, you say something"
- System is prompting for HIGH chat frequency — this is by design
- Issue: the `_consecutiveChatCount >= 3` warning threshold may need tuning
- The `_consecutiveChatCount` in mind/index.js resets ONLY on "successful non-chat non-idle skill dispatch" (line 573). If skills fail repeatedly, count never resets. This is a latent bug.

**Building ambition (Part 2, "BUILDING" section):**
- Current: instructs agents to "think BIG," build "town halls, workshops, houses with second floors, bridges, farms, walls, towers, gardens, roads." Rich and specific.
- Uses `!design` for small builds, `!plan` for large.
- The key prompt phrase driving build ambition: `Use !design with rich, detailed descriptions: not "a house" but "a two-story stone house with oak trim, glass windows, a balcony facing the sunset, and a garden out front."`

**Exploration drive (Part 2, "EXPLORING" section):**
- Current: "Don't just stay where you spawned. Explore!"
- `!explore direction:north distance:N` and `!look target:horizon` are both mentioned.

**Issues to tune:**
1. `_consecutiveChatCount` reset condition: should also reset on ANY skill dispatch attempt (even failed ones), not just successful ones. Otherwise a stuck agent (repeated failures) keeps its chat counter climbing and eventually gets the "stop chatting" warning even when it's not chatting.
2. The "TALK. A LOT." section creates chat loops when combined with the partner chat inject — after partner speaks, both agents see `⚠ [partner] just spoke. Respond with !chat before doing anything else.` This is intentional but aggressive. The 30-second recency window for the "⚠" warning (mind/prompt.js line 482) is the right threshold.
3. Building ambition text is good. No changes needed unless testing shows agents aren't building.

**Specific prompt fix for chat count reset:**

In `mind/index.js` around line 570-575:
```js
// Current (buggy for failure loops):
if (result.command === 'chat') {
  _consecutiveChatCount++
} else if (result.command !== 'idle' && skillResult.success) {
  _consecutiveChatCount = 0  // ONLY resets on success
}

// Fixed:
if (result.command === 'chat') {
  _consecutiveChatCount++
} else if (result.command !== 'idle') {
  _consecutiveChatCount = 0  // reset on ANY non-chat non-idle dispatch
}
```

---

## Persistence Verification

### Architecture Assessment (HIGH confidence from source)

All four persistence systems are correctly architected:

**SQLite (mind/memoryDB.js):**
- WAL mode + `synchronous = NORMAL` — crash-safe, no journal thrash
- Idempotent schema creation (`CREATE TABLE IF NOT EXISTS`)
- Prepared statement (`_insertStmt`) stored at module level — no per-call prep overhead
- FIFO pruning on startup (cap 10,000 events per agent)
- Per-agent column (`agent = config.name`) — no cross-agent pollution
- Risk: `pruneOldEvents` runs on startup only, never mid-session. Over a very long session (12+ hours), can exceed 10k events without pruning. Low risk since events are small rows.

**brain-state.json (mind/backgroundBrain.js):**
- Atomic write: `writeFileSync(BRAIN_STATE_TMP)` + `renameSync(tmp, target)` — POSIX atomic
- TTL cache (5s) on reads — main brain never reads a partial write
- Ring buffer caps enforced before every write (insights: 20, spatial: 50, partnerObs: 100)
- Error: if `BRAIN_STATE_FILE` doesn't exist on first `getBrainStateForPrompt()` call, returns `null` — correct
- Risk: none identified

**spatial.js:**
- Stateless module — `buildSpatialAwareness(bot)` reads live bot state every call
- Near-vision cache (3s TTL) stored in module-level `_cachedNearVision`
- No persistence to disk — computed fresh each tick
- No persistence bugs possible (it's pure computation)

**Shutdown persistence (start.js):**
- `setInterval(periodicSave + savePlayers + saveLocations + saveBuildHistory, 60000)` — saves every 60s
- **Missing: no SIGTERM/SIGINT handler** — if the process is killed with `kill <pid>` or Ctrl+C, the last 60s of state is lost. The global `uncaughtException` handler calls `periodicSave()` but `SIGTERM` is NOT an exception — it bypasses the error handlers.
- Fix: add SIGTERM/SIGINT handlers in `start.js`:
```js
function shutdown() {
  periodicSave(); savePlayers(); saveLocations(); saveBuildHistory()
  process.exit(0)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
```
- The `uncaughtException` handler is in `start.js` but only calls `console.error` + does NOT call `periodicSave`. The CLAUDE.md notes older version had `periodicSave()` in the crash handler — current `start.js` does NOT. Add `periodicSave()` to the `uncaughtException` handler.

**memory.js / social.js / locations.js (file-backed JSON):**
- All use try/catch with empty fallback on load — correct
- All write to per-agent directories — no cross-agent corruption
- `saveMemory()`, `savePlayers()`, `saveLocations()` are synchronous `writeFileSync` — not atomic (no tmp+rename pattern here), but these are single-writer per file so race condition only exists if a crash happens mid-write. Low risk in practice.

---

## Architecture Patterns

### Existing Patterns to Follow

**Tool equip pattern (from mine.js):**
```js
// Equip best tool
try { await bot.tool.equipForBlock(target, { requireHarvest: true }) } catch {}
// Verify equip worked
const heldType = bot.heldItem ? bot.heldItem.type : null
if (!canHarvestWith(target, heldType)) {
  return { success: false, reason: 'no_suitable_tool' }
}
```

**Atomic file write pattern (from backgroundBrain.js):**
```js
writeFileSync(FILE + '.tmp', content, 'utf-8')
renameSync(FILE + '.tmp', FILE)
```

**Non-fatal catch pattern (project-wide):**
```js
try { /* operation */ } catch (err) {
  console.log('[module] operation failed (non-fatal):', err.message)
}
```

**Scheduled restart exit code pattern:**
```js
process.exit(42)  // exit code 42 = scheduled restart (handled by while-loop)
```

### Anti-Patterns to Avoid

- **Introducing new module dependencies** — this is a polish phase, not a feature phase. All fixes should stay within existing module boundaries.
- **Changing `mine.js` tool equip** — it is already correct. Do NOT touch it.
- **Adding cooldowns or artificial delays** — per project memory: "NEVER add arbitrary cooldowns, turn caps, or forced delays." The scheduled restart is opt-in via env var, not a throttle.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool tier checks | Custom item-tier lookup table | `block.harvestTools` from minecraft-data (already used in mine.js) | MC-data has authoritative per-block tool requirements; hand-rolled tables go stale with MC updates |
| Crash-safe file writes | Custom lock file or journal | `writeFileSync(tmp) + renameSync(tmp, target)` (already in backgroundBrain.js) | POSIX rename is atomic on local disk; reinventing this adds complexity |
| Process restart scheduling | External cron, PM2, systemd | `setTimeout(process.exit(42), RESTART_INTERVAL_MS)` + bash while loop | Simpler, no extra process manager dependency, works in tmux/RunPod context |

---

## Common Pitfalls

### Pitfall 1: Over-fixing gather.js (making it behave like mine.js)
**What goes wrong:** Adding a `return { success: false }` when gather can't equip, treating it identically to mine's hard-stop. This breaks gathering wood (which has no harvestTools restriction and must always work bare-handed in emergencies).
**How to avoid:** gather must `continue` to next candidate (not `return`) when a block has harvest restrictions and no qualifying tool. Only abort the entire gather if ALL candidates in a batch fail the harvest check.

### Pitfall 2: Scheduled restart fires during active skill
**What goes wrong:** `setTimeout(process.exit, 12h)` fires while `skillRunning = true`. The build loop is mid-placement, the process exits, and the next restart begins with a corrupted build state.
**How to avoid:** Check `isSkillRunning()` before exiting. If a skill is running, defer the restart check by 30 seconds and retry:
```js
function scheduleRestart() {
  if (isSkillRunning()) {
    setTimeout(scheduleRestart, 30000)
    return
  }
  periodicSave(); savePlayers(); saveLocations(); saveBuildHistory()
  process.exit(42)
}
setTimeout(scheduleRestart, RESTART_INTERVAL_MS)
```

### Pitfall 3: SIGTERM handler calling process.exit() causes a second SIGTERM
**What goes wrong:** On some environments, calling `process.exit()` inside a SIGTERM handler triggers another SIGTERM, creating a loop.
**How to avoid:** Use a `_shuttingDown` guard flag:
```js
let _shuttingDown = false
function shutdown() {
  if (_shuttingDown) return
  _shuttingDown = true
  periodicSave(); savePlayers(); saveLocations(); saveBuildHistory()
  process.exit(0)
}
```

### Pitfall 4: Chat count reset fix over-corrects
**What goes wrong:** Resetting `_consecutiveChatCount` on every failed dispatch means a bot that fails repeatedly at gathering (and isn't chatting) resets the counter constantly, masking a real chat loop that happens to have skill failures between chats.
**How to avoid:** Only reset on non-chat dispatches. The counter semantics are "consecutive chats without ANY other action." A failed non-chat dispatch still breaks the chain — that's the correct behavior.

---

## Code Examples

### gather.js fix (canHarvestWith shared utility)

**New file: `body/tools.js`**
```js
// tools.js — Shared tool utility functions for body/ skills

/**
 * Check whether the currently held item can harvest a block at full-drop tier.
 * Uses block.harvestTools from minecraft-data.
 * If block.harvestTools is undefined, any tool works (wood, dirt, sand, etc.)
 * If block.harvestTools exists but heldItemType is null, bare hands can't harvest it.
 *
 * @param {import('mineflayer').Block} block
 * @param {number|null} heldItemType - bot.heldItem.type, or null if empty hand
 * @returns {boolean}
 */
export function canHarvestWith(block, heldItemType) {
  if (!block.harvestTools) return true       // no restriction
  if (heldItemType === null) return false    // block requires tool, hands = fail
  return !!block.harvestTools[heldItemType]
}
```

Then in `mine.js`, replace the inline definition with:
```js
import { canHarvestWith } from '../tools.js'
```

And in `gather.js`, add after navigation + before dig:
```js
import { canHarvestWith } from '../tools.js'
// ...
try { await bot.tool.equipForBlock(target, { requireHarvest: true }) } catch {}
const heldType = bot.heldItem ? bot.heldItem.type : null
if (!canHarvestWith(target, heldType)) {
  // Block requires a tool tier we don't have — skip this candidate
  console.log(`[gather] cannot harvest ${normalized} at tier — skipping block`)
  continue
}
```

### start.js shutdown handler

```js
// Graceful shutdown — saves all persistent state before exit.
// Handles both clean shutdown (SIGTERM from orchestrator) and Ctrl+C (SIGINT).
let _shuttingDown = false
function gracefulShutdown(signal) {
  if (_shuttingDown) return
  _shuttingDown = true
  console.log(`[hermescraft] ${signal} received — saving state and exiting`)
  periodicSave()
  savePlayers()
  saveLocations()
  saveBuildHistory()
  process.exit(0)
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT',  () => gracefulShutdown('SIGINT'))

// Also save on uncaught exceptions (crash safety — existing handler extended)
process.on('uncaughtException', (err) => {
  console.error('[hermescraft] uncaught exception:', err.message)
  periodicSave()  // save before continuing
  // Don't exit — let the agent recover
})
```

### launch-duo.sh restart loop fix

```bash
while true; do
    node SCRIPT_DIR_PLACEHOLDER/start.js
    CODE=$?
    [ $CODE -eq 0 ] && break       # clean shutdown — stop the loop
    [ $CODE -eq 42 ] && { echo "[!] Scheduled restart — relaunching..."; continue; }
    echo "[!] Crashed (exit $CODE) — restarting in 5s..."
    sleep 5
done
```

### start.js scheduled restart

```js
// Scheduled restart for ONNX memory leak mitigation (transformers.js issue #860)
// Exit code 42 = scheduled restart (launch-duo.sh while-loop continues on 42, stops on 0)
const RESTART_INTERVAL_MS = parseInt(process.env.RESTART_INTERVAL_MS || '43200000', 10)  // 12h default
if (RESTART_INTERVAL_MS > 0) {
  function scheduleRestart() {
    if (isSkillRunning()) {
      setTimeout(scheduleRestart, 30000)  // defer if skill active
      return
    }
    console.log('[hermescraft] scheduled restart — saving state')
    periodicSave(); savePlayers(); saveLocations(); saveBuildHistory()
    process.exit(42)
  }
  setTimeout(scheduleRestart, RESTART_INTERVAL_MS)
  console.log(`[hermescraft] scheduled restart in ${RESTART_INTERVAL_MS / 3600000}h`)
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| gather.js: equipForBlock with no requireHarvest | gather.js: equipForBlock + canHarvestWith check | Phase 22 fix |
| No SIGTERM handler — last 60s of state lost on kill | SIGTERM + SIGINT graceful shutdown handlers | Phase 22 fix |
| No scheduled restart — ONNX leak accumulates | Scheduled restart via process.exit(42) + while-loop | Phase 22 fix |
| _consecutiveChatCount resets only on success | Resets on any non-chat non-idle dispatch | Phase 22 fix |
| mine.js: canHarvestWith defined inline | Shared body/tools.js canHarvestWith | Phase 22 refactor |

---

## Environment Availability

Step 2.6: SKIPPED — this phase is pure code/config changes. No external CLI tools, databases, or services beyond Node.js and npm, which are already in use. Testing is smoke-test only (no live MC server available per additional_context).

---

## Open Questions

1. **Is the tool equip bug also in other skills (hunt, combat)?**
   - What we know: `combat.js` and `hunt.js` dispatch attacks, not block digs. Tool equip for combat (sword selection) is a different code path — likely uses `bot.equip()` directly. Worth a quick check of `body/skills/combat.js` and `body/skills/hunt.js` equip patterns.
   - What's unclear: whether the wrong-tool issue manifests for weapon equip in combat.
   - Recommendation: scan combat.js and hunt.js for `equipForBlock` vs `equip` calls. If they use `bot.equip(sword)` by name, they are probably fine. If they use `equipForBlock`, apply same fix.

2. **Does the Vectra index directory need per-agent namespacing?**
   - What we know: STATE.md notes "Each agent should use a separate AGENT_NAME-prefixed index path" as a pitfall from PITFALLS.md. Current knowledgeStore.js was examined at a high level in prior phases.
   - What's unclear: whether both Luna and Max currently write to the same Vectra index directory (potential corruption if both embed on startup simultaneously).
   - Recommendation: Check `mind/knowledgeStore.js` init path — if it uses a shared path, add per-agent suffix. Treat as low priority if pre-embed script is the only writer.

3. **Should periodicSave in the DB layer also be scheduled via SQLite's `db.checkpoint()`?**
   - What we know: WAL mode + NORMAL sync is crash-safe. SQLite WAL checkpoints automatically.
   - What's unclear: whether a very long session without checkpointing causes the WAL file to grow large.
   - Recommendation: not a bug, low priority for Phase 22. WAL auto-checkpoints at 1000 pages.

---

## Sources

### Primary (HIGH confidence)
- Direct source analysis: `body/skills/mine.js` — correct tool equip pattern baseline
- Direct source analysis: `body/skills/gather.js` — identified bug location (line 64)
- Direct source analysis: `mind/index.js` — chat count reset logic (lines 570-575), SIGTERM gap
- Direct source analysis: `start.js` — shutdown handlers, periodic save, no SIGTERM handler
- Direct source analysis: `mind/memoryDB.js` — WAL mode, FIFO pruning, per-agent columns
- Direct source analysis: `mind/backgroundBrain.js` — atomic write pattern, ring buffers
- Direct source analysis: `launch-duo.sh` — while-loop restart, exit code 0 breaks loop
- Direct source analysis: `mind/prompt.js` — prompt structure, buildSystemPrompt parts
- `.planning/research/PITFALLS.md` — ONNX leak (Pitfall 6), Mineflayer chunk leak, nightly restart

### Secondary (MEDIUM confidence)
- transformers.js issue #860 (documented in PITFALLS.md) — ONNX tensor leak, still open as of early 2025
- mineflayer-tool-plugin docs (implied by existing mine.js pattern) — `requireHarvest: true` flag behavior

---

## Metadata

**Confidence breakdown:**
- Bug diagnosis (gather.js equip): HIGH — direct code comparison with working mine.js pattern; the gap is unambiguous
- SIGTERM handler gap: HIGH — start.js source confirms no SIGTERM/SIGINT handler
- Scheduled restart approach: HIGH — consistent with project conventions (no cooldowns, tmux launch pattern, exit codes)
- Prompt tuning targets: HIGH — prompt.js source confirms sections exist and are editable
- Persistence correctness: HIGH — all four systems analyzed from source; memoryDB WAL is correct, backgroundBrain atomic write is correct
- `_consecutiveChatCount` reset fix: MEDIUM — behavioral fix based on code logic; exact agent behavior under failure loops is untested without live MC server

**Research date:** 2026-03-23
**Valid until:** No external dependencies — valid indefinitely (codebase-grounded)
