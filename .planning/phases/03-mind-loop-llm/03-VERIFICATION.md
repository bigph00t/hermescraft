---
phase: 03-mind-loop-llm
verified: 2026-03-22T18:45:00Z
status: passed
score: 10/10 must-haves verified
re_verification: false
---

# Phase 3: Mind Loop + LLM — Verification Report

**Phase Goal:** The LLM layer fires on events (chat received, skill complete, idle timeout), outputs !commands the Body executes, and maintains a 40-turn rolling history — the end-to-end Mind + Body pipeline is alive.
**Verified:** 2026-03-22
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | LLM client sends a prompt to the OpenAI-compatible endpoint and returns a parsed result with reasoning + command | VERIFIED | `mind/llm.js` line 133: `queryLLM` calls `client.chat.completions.create`, strips `<think>` tags (line 161), runs `parseCommand`, returns `{ reasoning, command, args, raw }` |
| 2 | Conversation history accumulates messages and trims at 80 messages (40 turns) using graduated round-boundary-aware removal | VERIFIED | `MAX_HISTORY_MESSAGES = 80` at line 11; `trimHistory()` at line 34 removes complete rounds; `trimHistoryGraduated()` at line 52 is round-boundary-aware and exported |
| 3 | `!command` text is parsed from LLM response after stripping `<think>` tags | VERIFIED | Line 161 strips think tags before passing to `parseCommand()` (line 167); think-tag content separately extracted as `reasoning` (line 164-165) |
| 4 | Registry maps command names to body/ skill functions and returns `{ success, reason }` results | VERIFIED | `mind/registry.js` REGISTRY Map contains 7 entries; `dispatch()` calls `requestInterrupt`+`clearInterrupt` then awaits handler; errors caught and returned as `{ success: false, reason: err.message }` |
| 5 | LLM fires when a player sends a chat message and its !command response is executed by the Body within one round-trip | VERIFIED | `mind/index.js` line 92: `bot.on('messagestr', ...)` filters system/self messages and calls `think()` with `trigger: 'chat'`; `think()` calls `queryLLM` then `dispatch` in sequence |
| 6 | LLM fires after a skill completes and picks the next action without human intervention | VERIFIED | `mind/index.js` line 70: after `dispatch()` returns, `setTimeout(() => think(bot, { trigger: 'skill_complete', ... }), 0)` schedules re-think immediately |
| 7 | Bot re-evaluates and selects a new goal when idle for 2+ seconds with no active task | VERIFIED | `mind/index.js` lines 112-118: 500ms sentinel setInterval checks `Date.now() - lastActionTime >= 2000` and calls `think()` with `trigger: 'idle'` |
| 8 | Conversation history stays at or below 40 turns | VERIFIED | `trimHistory()` called after every push (line 176); `trimHistoryGraduated(0.25)` on context overflow (line 186); hard cap at `MAX_HISTORY_MESSAGES = 80` |
| 9 | Concurrent think() calls are prevented by `thinkingInFlight` guard | VERIFIED | `mind/index.js` line 29: `if (thinkingInFlight) return`; set to `true` at line 30; cleared in `finally` at line 76 (7 references total) |
| 10 | Concurrent skill dispatches are prevented by `skillRunning` guard | VERIFIED | `skillRunning = true` before `dispatch()` (line 60), `= false` after (line 62) and in catch (line 74) and finally (line 78); idle sentinel checks it (line 113) — 8 references total |

**Score: 10/10 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `mind/llm.js` | LLM client, conversation history, graduated trimming, !command parser | VERIFIED | 210 lines; exports `queryLLM`, `clearConversation`, `getHistory`, `trimHistoryGraduated`; uses OpenAI SDK, VLLM_URL, MAX_HISTORY_MESSAGES=80 |
| `mind/prompt.js` | System prompt builder and game state summary formatter | VERIFIED | 137 lines; exports `buildSystemPrompt`, `buildStateText`, `buildUserMessage`; includes 7-command reference, few-shot examples, state formatter |
| `mind/registry.js` | Command name to body/ skill dispatch map | VERIFIED | 57 lines; exports `dispatch`, `listCommands`; REGISTRY Map with 7 entries; only mind/ file importing from body/ |
| `mind/index.js` | Event-driven Mind loop — chat/skill/idle triggers funnel into think() | VERIFIED | 131 lines; exports `initMind`; registers messagestr + death handlers, idle sentinel; `think()` with both guard flags |
| `start.js` | v2 entry point — creates bot, inits mind, starts the agent | VERIFIED | 27 lines; imports `createBot` and `initMind`; global error handlers; `package.json` has `start:v2: node start.js` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `mind/llm.js` | OpenAI SDK | `import OpenAI from 'openai'` | WIRED | Line 4; `new OpenAI({ baseURL: VLLM_URL })` at lines 14-18 |
| `mind/registry.js` | `body/skills/gather.js` | `import { gather }` | WIRED | Line 4; used in REGISTRY Map line 15 |
| `mind/registry.js` | `body/interrupt.js` | `import { requestInterrupt, clearInterrupt }` | WIRED | Line 9; both called in `dispatch()` lines 44-45 |
| `mind/index.js` | `mind/llm.js` | `import { queryLLM, clearConversation }` | WIRED | Line 3; `queryLLM` called in `think()` line 38; `clearConversation` in death handler line 125 |
| `mind/index.js` | `mind/prompt.js` | `import { buildSystemPrompt, buildUserMessage }` | WIRED | Line 4; both called in `think()` lines 33-34 |
| `mind/index.js` | `mind/registry.js` | `import { dispatch }` | WIRED | Line 5; called in `think()` line 61 |
| `start.js` | `body/bot.js` | `import { createBot }` | WIRED | Line 3; called in `main()` line 9 |
| `start.js` | `mind/index.js` | `import { initMind }` | WIRED | Line 4; called in `main()` line 12 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MIND-01 | 03-02 | Event-driven LLM — fires on idle (2s no action), chat received, or skill completion | SATISFIED | `mind/index.js`: `messagestr` event (chat), `setTimeout(0)` after dispatch (skill_complete), 500ms sentinel with 2000ms threshold (idle) |
| MIND-02 | 03-01 | Command registry — LLM calls skills by name (!command pattern) | SATISFIED | `mind/registry.js`: 7 commands mapped; `parseCommand()` in llm.js extracts `!command` text; `dispatch()` bridges to body/ skills |
| MIND-03 | 03-01 | Conversation history — 40-turn rolling window with graduated trimming | SATISFIED | `MAX_HISTORY_MESSAGES = 80` (40 turns); `trimHistory()` on every push; `trimHistoryGraduated()` on overflow with round-boundary awareness |
| MIND-04 | 03-02 | Self-prompter — when idle with no goal, LLM re-evaluates and picks next action | SATISFIED | Idle sentinel fires `think()` with `trigger: 'idle'` after 2s; `buildUserMessage` formats `[idle for Nms — what should I do?]` which prompts self-evaluation |

All 4 requirements from REQUIREMENTS.md Phase 3 traceability table are satisfied. No orphaned requirements found.

---

## Anti-Patterns Found

None. Scan of all 5 phase files (`mind/llm.js`, `mind/prompt.js`, `mind/registry.js`, `mind/index.js`, `start.js`) found:
- No TODO/FIXME/HACK/PLACEHOLDER comments
- No stub return values (`return null` at llm.js:101 is `parseCommand`'s intentional no-match return, not a stub)
- No empty handler bodies
- No artificial cooldowns or tick caps

---

## Human Verification Required

### 1. LLM round-trip smoke test

**Test:** Run `npm run start:v2` with a real Minecraft server and vLLM endpoint. Send a chat message like `gather some wood`. Observe agent output.
**Expected:** Agent logs `[mind] chat from ...`, `[mind] thinking... chat`, `[mind] dispatching: gather ...`, and eventually `[mind] skill result: gather OK`.
**Why human:** End-to-end test requires live Minecraft server + vLLM inference running. Cannot verify LLM call latency, actual `!command` compliance by the model, or skill execution correctness programmatically.

### 2. Idle trigger behavior

**Test:** Let the agent run with no input for 3+ seconds after a skill completes.
**Expected:** Agent logs `[mind] thinking... idle` and dispatches a new command without any human message.
**Why human:** Requires live runtime to verify the 500ms sentinel fires correctly and the idle threshold is respected.

### 3. Chat filter correctness

**Test:** Have the bot say something in chat (via `!chat`). Verify the bot does not respond to its own echoed message.
**Expected:** No `[mind] chat from ...` log for the bot's own messages.
**Why human:** Requires live server to confirm the `sender === bot.username` and UUID-resolution filters work correctly for the specific server version.

---

## Gaps Summary

No gaps. All 10 truths verified, all 5 artifacts substantive and wired, all 4 requirements satisfied, all 8 key links confirmed. The phase goal is fully achieved in code.

---

_Verified: 2026-03-22T18:45:00Z_
_Verifier: Claude (gsd-verifier)_
