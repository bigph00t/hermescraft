---
phase: 05-tool-primitives
verified: 2026-03-22T04:30:00Z
status: human_needed
score: 8/8 must-haves verified
re_verification: false
human_verification:
  - test: "Place a block via smart_place with item in main inventory (not hotbar)"
    expected: "Block places successfully; response includes placed.block, placed.x/y/z"
    why_human: "Requires live MC client + mod — cannot verify Java interactBlock + inventory swap without running game"
  - test: "Deposit items into a chest via chest_deposit"
    expected: "Items transfer from player to chest; chests.json updates with contents; action returns chest_contents string"
    why_human: "Requires GenericContainerScreenHandler to open — needs live MC client with real chest block"
  - test: "Withdraw a specific item from a chest via chest_withdraw"
    expected: "Item appears in player inventory; chests.json updated; response includes transferred and chest_contents"
    why_human: "Same as above — needs running game with open chest screen"
  - test: "Trigger a sustained action timeout, then verify next action dispatches within 2 ticks"
    expected: "No permanent stuck: currentSustained cleared on future.isDone(); next action proceeds normally"
    why_human: "Race condition between HTTP timeout and Java tick — observable only at runtime"
  - test: "Test item normalization in a live craft: tell agent to craft 'sticks'"
    expected: "normalizeItemName('sticks') -> 'stick'; craft action succeeds"
    why_human: "End-to-end flow through mod dispatch — the normalizer unit tests pass but live wiring needs a real run"
---

# Phase 05: Tool Primitives Verification Report

**Phase Goal:** Agents can place blocks reliably, interact with chests, break blocks only from the surface, and never get stuck from a sustained action lockout
**Verified:** 2026-03-22T04:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | LLM item names normalized to MC 1.21.1 registry before dispatch | VERIFIED | `agent/normalizer.js` exists (89 lines), 18-entry ALIASES map, 7-step pipeline; wired in `executeAction` and `validatePreExecution`; 10/10 test cases pass at runtime |
| 2 | mine action does not exist in tool list shown to LLM | VERIFIED | `GAME_TOOLS` has no `name: 'mine'` entry (runtime confirmed); `VALID_ACTIONS` excludes `'mine'` (runtime confirmed) |
| 3 | All block breaking via look_at_block + break_block only | VERIFIED | `look_at_block` present in GAME_TOOLS; description updated to "Primary way to mine"; GAMEPLAY_INSTRUCTIONS directs to `scan_blocks` + `look_at_block` + `break_block`; no mine fallback in prompt |
| 4 | smart_place auto-equips from all 36 inventory slots | VERIFIED | `handleSmartPlace` in ActionExecutor.java (line 1451): tries hotbar first, then loops slots 9-35 with `clickSlot(SWAP)` to hotbar 0; `smart_place` in GAME_TOOLS and VALID_ACTIONS |
| 5 | smart_place response includes placed block data | VERIFIED | Lines 1574-1585 of ActionExecutor.java: `result.add("placed", placed)` with block, x, y, z properties |
| 6 | Sustained action self-clears on timeout | VERIFIED | `tickSustainedAction` (line 377): checks `sa.future.isDone()` before switch; calls `releaseAllKeys`, sets `currentSustained = null`, returns immediately |
| 7 | chest_deposit and chest_withdraw navigate open-wait-transfer-close flow | VERIFIED | `startChestAction` + `tickChestAction` implement 2-step state machine (step 0=wait for GenericContainerScreenHandler, step 1=shift-click transfer+close); both actions in GAME_TOOLS, VALID_ACTIONS, ACTION_SCHEMAS |
| 8 | Chest responses auto-update chests.json via trackChest | VERIFIED | `executeAction` (lines 395-406): parses `chest_contents` from response, calls `trackChest(x, y, z, contents)`; `initChests` called in `agent/index.js` at agent startup (line 1391) |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `agent/normalizer.js` | Item name canonicalization, exports `normalizeItemName` | VERIFIED | 89 lines; exports `normalizeItemName`; uses `minecraft-data` 1.21.1; 18 ALIASES entries |
| `agent/tools.js` | GAME_TOOLS with smart_place, chest_deposit, chest_withdraw; no mine; no place | VERIFIED | `smart_place`, `chest_deposit`, `chest_withdraw` present; `mine` absent; `place` absent (runtime confirmed) |
| `agent/actions.js` | normalizeItemName called before dispatch; trackChest wired; new actions in VALID_ACTIONS | VERIFIED | `normalizeItemName` called in `executeAction` (line 310-311) and `validatePreExecution` (line 124-125); `trackChest` called after chest responses (line 402); `smart_place`, `chest_deposit`, `chest_withdraw` in VALID_ACTIONS and ACTION_SCHEMAS |
| `agent/chests.js` | exports `trackChest`, `getChestsForPrompt`, `initChests` | VERIFIED | All 3 exports present plus `getChestContents` and `saveChests`; `initChests` called in `index.js` line 1391; `getChestsForPrompt` used in `planner.js` line 241 |
| `mod/src/main/java/hermescraft/ActionExecutor.java` | smart_place, chest_deposit/withdraw, timeout self-clear | VERIFIED | `handleSmartPlace` at line 1451; `startChestAction` at line 555; `tickChestAction` at line 613; `sa.future.isDone()` check at line 377; `GenericContainerScreenHandler` imported at line 20 |
| `agent/prompt.js` | GAMEPLAY_INSTRUCTIONS has smart_place and chest guidance; no mine fallback | VERIFIED | Lines 50-51: PLACE and CHESTS instructions added; no "mine block_name" string; scan_blocks appears 3 times as the discovery fallback |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `agent/actions.js` | `agent/normalizer.js` | import + call in `executeAction` and `validatePreExecution` | WIRED | `import { normalizeItemName } from './normalizer.js'` at line 3; called at lines 310-311 and 124-125 |
| `agent/normalizer.js` | `minecraft-data itemsByName` | registry validation in normalization pipeline | WIRED | `mcData.itemsByName` used at lines 57, 70, 76, 82 |
| `agent/actions.js executeAction` | `agent/chests.js trackChest` | after chest_deposit/chest_withdraw response | WIRED | `import { trackChest } from './chests.js'` at line 4; called at line 402 |
| `agent/tools.js GAME_TOOLS` | LLM tool list | smart_place replaces place, chest_deposit/withdraw added | WIRED | All 3 tools in GAME_TOOLS (runtime confirmed); `place` absent |
| `ActionExecutor.java tickSustainedAction` | `sa.future.isDone()` | self-clear check at start of every tick | WIRED | Lines 377-382: isDone check before switch, calls releaseAllKeys + clears currentSustained |
| `ActionExecutor.java handleSmartPlace` | full 36-slot inventory search | slots 9-35 loop + SWAP click to hotbar | WIRED | Lines 1468-1488: `for (int i = 9; i < player.getInventory().size(); i++)` with `clickSlot(SWAP)` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| TOOL-01 | 05-02, 05-03 | Agent can place blocks reliably using support block + face direction (auto-equip from full inventory) | SATISFIED | `handleSmartPlace` searches all 36 slots; `smart_place` in GAME_TOOLS; GAMEPLAY_INSTRUCTIONS teaches usage |
| TOOL-02 | 05-01 | All LLM-generated item names normalized to valid MC 1.21.1 registry names before dispatch | SATISFIED | `normalizer.js` with 18 ALIASES + registry validation; wired in `executeAction` and `validatePreExecution` |
| TOOL-03 | 05-01 | Mine action removed — all block breaking uses look_at_block + break_block only | SATISFIED | `mine` absent from GAME_TOOLS and VALID_ACTIONS; prompt updated to scan_blocks fallback |
| TOOL-04 | 05-02 | Sustained action lock timeout clears properly — subsequent actions never permanently blocked | SATISFIED | `sa.future.isDone()` check at line 377 of ActionExecutor.java self-clears before switch |
| CHEST-01 | 05-02, 05-03 | Agent can deposit items into a nearby chest | SATISFIED (code) / NEEDS HUMAN (runtime) | `chest_deposit` sustained action implemented end-to-end in mod and agent; live transfer not tested |
| CHEST-02 | 05-02, 05-03 | Agent can withdraw specific items from a nearby chest | SATISFIED (code) / NEEDS HUMAN (runtime) | `chest_withdraw` sustained action implemented end-to-end in mod and agent; live transfer not tested |

No orphaned requirements: all 6 phase 5 requirement IDs (TOOL-01 through TOOL-04, CHEST-01, CHEST-02) are claimed by plans and have implementation evidence.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `agent/prompt.js` | 288 | `parts.push('TODO: ' + ...)` | Info | Not a stub — this is a formatting string that renders "TODO: [tasks]" in the agent's progress display. Legitimate. |

No blocker or warning anti-patterns found. The single "TODO" match is a string literal used for display output, not incomplete code.

---

### Human Verification Required

Plan 05-03 Task 2 was a `checkpoint:human-verify` gate that was **explicitly deferred by the user**. The 7-step end-to-end live test was not completed. All 5 items below derive from that deferred checkpoint.

#### 1. Smart Place End-to-End

**Test:** With a block item in the main inventory (slots 9-35, not hotbar), call `smart_place("oak_planks")` after `look_at_block` on a surface block.
**Expected:** Item auto-equips via inventory swap to hotbar slot 0; block places successfully; mod response includes `"placed": {"block": "oak_planks", "x": ..., "y": ..., "z": ...}`.
**Why human:** Requires a live MC client with mod deployed. The `clickSlot(SWAP)` interaction needs a real Minecraft screen handler in scope — the mod returns early if `player.currentScreenHandler` is null.

#### 2. Chest Deposit

**Test:** Place a chest within 6 blocks of the agent. Issue `chest_deposit(x, y, z, "oak_log", 8)` where x/y/z are the chest coordinates.
**Expected:** Items transfer from player to chest; mod response has `"chest_contents": "oak_log x..."` string; `agent/data/{name}/chests.json` file is created/updated with the chest's contents.
**Why human:** `GenericContainerScreenHandler` only exists when Minecraft opens a chest screen — requires a real game session.

#### 3. Chest Withdraw

**Test:** With items already in a chest, issue `chest_withdraw(x, y, z, "oak_log", 4)`.
**Expected:** Item appears in player inventory; `chests.json` updated to reflect remaining contents; response includes `"transferred"` field.
**Why human:** Same GenericContainerScreenHandler dependency as deposit.

#### 4. Sustained Action Timeout Recovery

**Test:** Start a long sustained action (e.g., `look_at_block` far away), then interrupt it by causing the HTTP future to time out. Verify the agent can dispatch a new action within 2 ticks.
**Expected:** `tickSustainedAction` detects `sa.future.isDone()` on next tick; `currentSustained` set to null; new action starts without manual restart.
**Why human:** The timeout-then-tick race condition is timing-dependent and only observable at runtime.

#### 5. Item Normalization in Live Craft

**Test:** Instruct the agent to craft `"sticks"` (wrong plural form).
**Expected:** `normalizeItemName("sticks")` returns `"stick"` transparently; craft action reaches the mod with `"item": "stick"`; craft succeeds if planks are in inventory.
**Why human:** Unit tests pass (10/10), but the full dispatch pipeline (normalizer → action payload → mod HTTP call → craft handler) needs a live run to confirm no intermediate step corrupts the item name.

---

### Gaps Summary

No automated verification gaps. All 8 observable truths are verified at code level:
- `agent/normalizer.js` exists with a substantive 7-step normalization pipeline wired into both dispatch points
- `mine` is completely absent from GAME_TOOLS and VALID_ACTIONS (runtime confirmed)
- `smart_place` is in GAME_TOOLS, VALID_ACTIONS, ACTION_SCHEMAS, and the Java mod
- Sustained action timeout self-clear is in `tickSustainedAction` before the switch
- `chest_deposit` and `chest_withdraw` are end-to-end implemented and wired
- `trackChest` is called from `executeAction` on every successful chest response
- All 4 commits (4723b05, 1a12c68, 2e6f51d, fdd4ce2) verified in git history

The only open items are runtime behaviors (CHEST-01, CHEST-02, TOOL-04 under load) that require a live MC session. These were explicitly deferred by the user at the Plan 03 human checkpoint. Code is complete; live testing is the remaining gate.

---

_Verified: 2026-03-22T04:30:00Z_
_Verifier: Claude (gsd-verifier)_
