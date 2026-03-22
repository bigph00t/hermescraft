---
phase: 01-reliability
verified: 2026-03-21T04:40:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Run agent through a 20-tick session, kill -9 the process, restart and observe conversation history"
    expected: "Agent resumes with restored history, first message is role=user"
    why_human: "Requires live Minecraft server + vLLM endpoint; OOM/SIGKILL simulation cannot be automated in CI"
  - test: "Send the same chat message twice from a Minecraft client and watch the agent terminal"
    expected: "Agent responds exactly once — second identical message produces no output"
    why_human: "Requires live Minecraft client connected to server; ring buffer cycling only happens with real mod running"
  - test: "Kick the bot from the server, wait 5 seconds, watch HermesBridgeMod logs"
    expected: "Log line 'Player disconnected — will auto-reconnect', then 'Auto-connecting' within ~10 seconds"
    why_human: "Requires running Fabric client with mod; Java mod boot cycle cannot be simulated in a shell script"
---

# Phase 01: Reliability Verification Report

**Phase Goal:** The agent never silently loses its execution context due to bugs in trimming, skill injection, chat deduplication, or reconnect logic
**Verified:** 2026-03-21T04:40:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | History trim never produces a state where a `tool` role message is first in `conversationHistory` | VERIFIED | `trimHistoryGraduated` (llm.js:71-104) strips orphaned tool messages first, then removes complete user+assistant+(optional tool) rounds. 5 passing tests in `agent/tests/llm.test.js` confirm boundary safety |
| 2 | No code path in the agent sets `conversationHistory.length = 0` except `clearConversation()` and `setConversationHistory()` | VERIFIED | Grep confirms exactly 2 occurrences at lines 38 and 46 — inside `clearConversation` and `setConversationHistory` respectively. Corrupt tool call handler at line 308 uses `trimHistoryGraduated(0.5)`. Test in llm.test.js MEM-02 suite confirms this by source scan |
| 3 | Conversation history is written to disk on `periodicSave` and restored on startup | VERIFIED | `memory.js:407-408` writes to `HISTORY_FILE` inside a try/catch in `periodicSave()`. `memory.js:85-98` reads and validates it in `loadMemory()` with `Array.isArray` + role-string check |
| 4 | Corrupted history file on disk does not crash the agent — it starts fresh | VERIFIED | `loadMemory()` history restore is wrapped in `try { } catch {}` (memory.js:86-97). Empty catch discards corrupted file silently |
| 5 | Skill body is correctly returned in open-ended mode — agent receives actual skill text, not undefined | VERIFIED | `skills.js:146-151` now returns `{ name: skill.name, content: skill.body }`. Bug string `generalSkills[0].content` is absent. `index.js:482` accesses `activeSkill?.content` which now resolves correctly |
| 6 | Player chat messages are processed exactly once — resending the same line does not trigger a second response | VERIFIED | `index.js:41` declares `let lastProcessedMessages = new Set()`. `index.js:397-399` builds positional keys `${i}:${m}`, filters against previous Set, then replaces it. Old hash-based variable `lastSeenChatHash` is absent (grep: 0 matches) |
| 7 | Agent reconnects after a server kick without requiring a process restart | VERIFIED | `HermesBridgeMod.java:28` declares `private boolean wasConnected = false`. Lines 89-93 detect `wasConnected && client.player == null` and reset `autoConnectAttempted = false`, enabling the reconnect block at line 96 to fire again |

**Score:** 7/7 truths verified

---

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `agent/llm.js` | Round-boundary-safe graduated trim; no full-wipe recovery paths | VERIFIED | Contains `trimHistoryGraduated` at line 71 with round-boundary logic. Exports `getConversationHistory`, `setConversationHistory`, `trimHistoryGraduated`. Module loads cleanly. |
| `agent/memory.js` | L1 history persistence in `periodicSave`; restore in `loadMemory` | VERIFIED | `HISTORY_FILE` declared at line 18, updated in `initMemory` at line 28. `periodicSave` writes at lines 407-408. `loadMemory` restores at lines 85-98 with validation. |
| `agent/skills.js` | Correct property access for skill body in open-ended mode | VERIFIED | Returns `{ name, content: skill.body }` at lines 147-151. Bug reference `.content` on raw skill object is absent. |
| `agent/index.js` | Timestamp-based chat deduplication that handles buffer cycling | VERIFIED | `lastProcessedMessages = new Set()` at line 41. Set-based dedup at lines 397-399. Old `lastSeenChatHash` absent. |
| `mod/src/main/java/hermescraft/HermesBridgeMod.java` | `autoConnectAttempted` reset on player disconnect | VERIFIED | `wasConnected` field at line 28. Disconnect detection at lines 89-93 with reset + state update. |
| `agent/tests/llm.test.js` | 10 automated tests for MEM-01 and MEM-02 | VERIFIED | File exists, 10 tests run: 10 pass, 0 fail (confirmed by `node --test agent/tests/llm.test.js`) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `agent/memory.js` | `agent/llm.js` | `import { getConversationHistory, setConversationHistory }` | WIRED | Line 11 of memory.js: `import { getConversationHistory, setConversationHistory } from './llm.js'` — both functions are called in `loadMemory` and `periodicSave` |
| `memory.js periodicSave` | `agent/data/{name}/history.json` | `writeFileSync(HISTORY_FILE, ...)` on periodic save cadence | WIRED | Line 408: `writeFileSync(HISTORY_FILE, JSON.stringify(history), 'utf-8')` inside try/catch in `periodicSave()` |
| `agent/skills.js getActiveSkill` | `agent/prompt.js buildSystemPrompt` | `activeSkill.content` passed into system prompt | WIRED | `index.js:482`: `activeSkill: activeSkill?.content \|\| ''` — reads `.content` from the object returned by `getActiveSkill`. Both phased and open-ended branches now return `{ name, content }` |
| `agent/index.js` chat dedup | `MOD_URL/chat` endpoint | `fetch` + `lastProcessedMessages` Set tracking | WIRED | `index.js:394-399`: fetch result → split → filter with positional Set keys → replace Set — full dedup cycle present and active |
| `HermesBridgeMod.java` tick handler | `ConnectScreen.connect` | `wasConnected` flag reset on disconnect | WIRED | Lines 89-93 reset `autoConnectAttempted = false` when `wasConnected && client.player == null`. Block at line 96 re-enables connect on next eligible tick |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MEM-01 | 01-01-PLAN.md | Graduated trim respects round boundaries — `tool` role never becomes first history entry after trimming | SATISFIED | `trimHistoryGraduated` (llm.js:71-104) is round-boundary-aware. Tests in MEM-01 suite: 5/5 pass |
| MEM-02 | 01-01-PLAN.md | All context overflow and error recovery paths use graduated trim — no `conversationHistory.length = 0` full-wipe paths remaining | SATISFIED | Grep confirms only 2 occurrences of `conversationHistory.length = 0`, both in safe functions. Corrupt handler at line 308 uses `trimHistoryGraduated(0.5)`. MEM-02 test suite: 2/2 pass |
| MEM-03 | 01-01-PLAN.md | L1 history persisted to disk on periodic save; restored on startup — survives OOM/SIGKILL | SATISFIED | `periodicSave` writes `history.json`; `loadMemory` restores it with validation and silent-catch |
| SKL-01 | 01-02-PLAN.md | Skill injection works correctly in all agent modes — fix `.content` vs `.body` mismatch | SATISFIED | Non-phased branch now returns `{ name, content: skill.body }` matching phased-mode shape. Bug string absent. |
| COM-01 | 01-02-PLAN.md | Chat messages deduplicated — agent never re-processes the same player message | SATISFIED | Set-based positional dedup replaces hash approach. Old variable absent. |
| COM-02 | 01-02-PLAN.md | Auto-reconnect works after server kicks — `autoConnectAttempted` resets when player disconnects | SATISFIED | `wasConnected` field + disconnect detection block in tick handler resets the flag |

**Orphaned requirements (mapped to Phase 1 but not in either plan's `requirements` field):** None. All 6 Phase 1 requirements (MEM-01, MEM-02, MEM-03, SKL-01, COM-01, COM-02) are claimed by exactly one plan each.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `agent/index.js` | 571-573 | `'Chat not available (mod may need update)'` | Info | Legitimate user-facing fallback message in an info action handler, not a stub. Not on a goal-critical code path. |

No blockers or warnings found. The single info-level finding is a graceful degradation message in an optional status-info action, not in any path relevant to the phase goal.

---

### Human Verification Required

#### 1. OOM/SIGKILL History Persistence

**Test:** Start the agent with a running Minecraft server and vLLM. Let it play for 20 ticks (accumulate some history), then `kill -9` the Node process. Restart the agent.
**Expected:** Agent resumes with prior conversation history intact (restored from `history.json`), first history entry is `role: user`.
**Why human:** Requires live Minecraft server + vLLM endpoint. Cannot simulate real periodic save cadence or file I/O timing in unit tests.

#### 2. Chat Deduplication Under Buffer Cycling

**Test:** Send the same player chat message twice from a Minecraft client with a 3-second gap. Observe the agent terminal.
**Expected:** Agent logs `New chat:` exactly once. No second response triggered.
**Why human:** Requires live Minecraft client connected to server. Ring buffer cycling (the root cause of the original bug) only occurs with the real mod running and a 20-message buffer in motion.

#### 3. AutoConnect After Kick

**Test:** Connect the bot to a server, wait until it is fully in-game (player non-null), then kick it from the server console. Watch the HermesBridgeMod logs in the Fabric client.
**Expected:** Log lines: `[HermesBridge] Player disconnected — will auto-reconnect` then within ~10 seconds `[HermesBridge] Auto-connecting to <server>`.
**Why human:** Requires running Fabric client with mod. Java mod boot cycle and Minecraft tick loop cannot be simulated in shell.

---

### Acceptance Criteria Checklist (from plans)

**Plan 01-01 acceptance criteria:**

- [x] `agent/llm.js` `trimHistoryGraduated` contains `conversationHistory[0].role === 'tool'` (orphan cleanup)
- [x] `agent/llm.js` `trimHistoryGraduated` contains `conversationHistory[0].role === 'user'` (round detection)
- [x] `agent/llm.js` does NOT contain `conversationHistory.length = 0` except inside `clearConversation()` and `setConversationHistory()`
- [x] `agent/llm.js` corrupt tool call handler contains `trimHistoryGraduated(0.5)` (line 308)
- [x] `agent/llm.js` exports `getConversationHistory` and `setConversationHistory`
- [x] `agent/memory.js` contains `import { getConversationHistory, setConversationHistory } from './llm.js'`
- [x] `agent/memory.js` contains `let HISTORY_FILE = join(DATA_DIR, 'history.json')`
- [x] `agent/memory.js` `loadMemory` contains `setConversationHistory(historyData)` inside a try/catch
- [x] `agent/memory.js` `periodicSave` contains `getConversationHistory()` and `writeFileSync(HISTORY_FILE`
- [x] `agent/memory.js` `loadMemory` contains `Array.isArray(historyData)` (validation)
- [x] `agent/memory.js` `loadMemory` history restore block has an empty catch

**Plan 01-02 acceptance criteria:**

- [x] `agent/skills.js` `getActiveSkill` does NOT contain `generalSkills[0].content` (bug removed)
- [x] `agent/skills.js` `getActiveSkill` non-phased branch contains `content: skill.body`
- [x] `agent/skills.js` `getActiveSkill` non-phased branch returns object with `name` and `content` keys
- [x] `agent/index.js` does NOT contain `lastSeenChatHash`
- [x] `agent/index.js` contains `let lastProcessedMessages = new Set()`
- [x] `agent/index.js` chat dedup block contains `lastProcessedMessages` usage (3 occurrences)
- [x] `HermesBridgeMod.java` contains `private boolean wasConnected = false;`
- [x] `HermesBridgeMod.java` contains `wasConnected && client.player == null` (disconnect detection)
- [x] `HermesBridgeMod.java` contains `autoConnectAttempted = false;` inside disconnect detection block
- [x] `HermesBridgeMod.java` contains `wasConnected = client.player != null;`

All 21 acceptance criteria pass.

---

### Test Results

```
node --test agent/tests/llm.test.js

  MEM-01: trimHistoryGraduated respects round boundaries
    PASS removes complete rounds from front — never leaves tool at index 0
    PASS removes orphaned tool message at front (already broken state)
    PASS is a no-op on empty history
    PASS removes at least one complete round worth of messages
    PASS after trim, first message is always role=user

  MEM-02: Corrupt tool call handler uses graduated trim, not full wipe
    PASS llm.js does NOT contain conversationHistory.length = 0 outside clearConversation and setConversationHistory
    PASS corrupt tool call handler contains trimHistoryGraduated(0.5)

  New exports: getConversationHistory and setConversationHistory
    PASS getConversationHistory returns the current history array
    PASS setConversationHistory replaces history with provided array
    PASS setConversationHistory handles non-array gracefully

tests 10 | pass 10 | fail 0
```

---

## Summary

Phase 1 goal achieved. All six requirements are implemented, wired, and pass their acceptance criteria. The automated test suite provides regression coverage for the most critical fixes (MEM-01, MEM-02). Three human verification items are flagged because they require a live Minecraft server + Fabric client to exercise the ring buffer, OOM kill, and server kick scenarios — these cannot be unit tested.

The phase goal — "the agent never silently loses its execution context" — is satisfied by:

1. **Trim safety (MEM-01, MEM-02):** Graduated trim respects round boundaries and is the only recovery path. No full-wipe paths remain.
2. **Persistence (MEM-03):** History survives OOM/SIGKILL via `history.json`.
3. **Skill injection (SKL-01):** Open-ended mode returns real skill content, not undefined.
4. **Chat dedup (COM-01):** Set-based positional tracking replaces the fragile hash approach.
5. **Reconnect (COM-02):** `wasConnected` flag enables reconnect after kicks without restart.

---

_Verified: 2026-03-21T04:40:00Z_
_Verifier: Claude (gsd-verifier)_
