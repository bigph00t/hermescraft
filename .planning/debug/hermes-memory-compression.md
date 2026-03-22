---
status: awaiting_human_verify
trigger: "hermes-memory-compression: The Hermes agent's memory/compression system is destroying execution context. A session with 562 messages (~443,300 tokens) was compressed to 7 messages (~837 tokens) — 99.8% loss."
created: 2026-03-20T00:00:00Z
updated: 2026-03-20T00:05:00Z
---

## Current Focus

hypothesis: The "compression" described is NOT a compression system at all — it is the trimHistory() function in llm.js aggressively deleting from the front of conversationHistory when a context overflow error occurs. The 443K -> 837 token drop (562 -> 7 messages) matches exactly what happens when `conversationHistory.splice(0, Math.max(2, conversationHistory.length))` runs — it nukes the entire history in one shot. The injected planning documents (SUBAGENT_CONTEXT.md etc.) were passed in as user messages in the conversation history and were wiped along with everything else.
test: Code audit of the two trim paths in llm.js — trimHistory() and the overflow handler in the catch block
expecting: Confirm that the overflow catch branch wipes entire history in one call, and that there is no mechanism to protect pinned/system content from deletion
next_action: Design and implement a fix — protect critical context via system prompt injection rather than conversation history

## Symptoms

expected: After user said "Go", the bot should execute Wave 0 tasks using injected context documents (SUBAGENT_CONTEXT.md, CODE_REFERENCES_PREMIUM_UI.md, frontend-master-plan.md). The bot had 11 tasks planned and should have started executing them.
actual: Bot showed "planning 11 task(s)" then auto-compressed from 562 messages (~443,300 tokens) to 7 messages (~837 tokens). After compression, it lost ALL execution context — the 3 planning documents, the wave execution plan, loaded skill references, and the full conversation history. The compression was so aggressive it essentially wiped the session.
errors: No explicit errors. The compression itself completed "successfully" but the result was unusable — going from 443K tokens to 837 tokens means almost nothing was preserved.
reproduction: Large session with many injected context documents triggers auto-compression when token count gets high.
timeline: Happened during the current session. The bot built up context over 562 messages, then when execution was about to start, compression triggered and destroyed everything.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-20T00:00:00Z
  checked: agent/llm.js trimHistory() function (lines 41-56)
  found: trimHistory() removes messages from the FRONT of conversationHistory in pairs/triples until length <= MAX_HISTORY_MESSAGES (default 90). This is normal sliding-window behavior and would NOT cause 562->7 message collapse.
  implication: The normal trim path cannot cause the observed 99.8% loss by itself.

- timestamp: 2026-03-20T00:00:00Z
  checked: agent/llm.js catch block at lines 246-253 (context overflow handler)
  found: `conversationHistory.splice(0, Math.max(2, conversationHistory.length))` — when conversationHistory.length is e.g. 90, Math.max(2, 90) = 90, so this deletes ALL 90 messages in one shot and immediately retries (continue). This nukes the entire in-memory session history.
  implication: Any context overflow error triggers a complete wipe of the session conversation memory. If the user injected large planning docs into the history, they are ALL gone after this.

- timestamp: 2026-03-20T00:00:00Z
  checked: agent/llm.js inner try block at lines 133-143 (inner overflow handler)
  found: `conversationHistory.splice(0, trimCount)` where trimCount = Math.ceil(history.length / 2). This cuts half first, then rethrows. The outer catch then cuts the remaining half entirely. Two-stage wipe.
  implication: The sequence is: hit overflow -> inner catch cuts half and rethrows -> outer catch cuts everything remaining -> continue retries with empty history.

- timestamp: 2026-03-20T00:00:00Z
  checked: MAX_HISTORY_MESSAGES value and planning document injection mechanism
  found: MAX_HISTORY_MESSAGES defaults to 90 (env MAX_HISTORY). The planning documents (SUBAGENT_CONTEXT.md etc.) were injected as conversation history messages — user/assistant pairs. At 562 messages / 443K tokens, the model's actual context limit was being exceeded on every call, so the overflow handler ran repeatedly and finally wiped everything, leaving only the 7 most recent messages from the final retry cycle (system + a few new messages appended after the wipe).
  implication: The planning documents were NOT pinned to the system prompt. They lived only in the volatile conversationHistory array. Once that was wiped, they were gone forever.

- timestamp: 2026-03-20T00:00:00Z
  checked: agent/prompt.js buildSystemPrompt() function
  found: The system prompt includes: identity/soul, gameplay instructions, phase objectives, active skill, and lessons from memory. There is NO mechanism to inject planning documents or wave execution plans into the system prompt. The only persistent storage is the MEMORY.md file (lessons/strategies/worldKnowledge) and the notepad file.
  implication: Critical execution context (planning docs, wave plans) had no durable home. The notepad (notepad.txt) is the ONLY persistent writable store the agent can use across context resets, and it is capped at 600 chars display. The real fix requires either (a) expanding notepad, (b) re-injecting docs from disk on each tick, or (c) protecting them in the system prompt.

- timestamp: 2026-03-20T00:00:00Z
  checked: agent/index.js buildSystemPrompt() call (lines 443-450)
  found: systemPrompt is rebuilt fresh every tick from agentConfig + phase + memory. No planning documents are re-injected from disk each tick. The system prompt is static per tick.
  implication: Even after a full wipe, the system prompt could safely carry planning docs if they were read from disk and injected there. This is the most robust fix: move critical context from conversation history into the system prompt (rebuilt each tick from disk files).

## Resolution

root_cause: Two compounding bugs:
  1. The context overflow handler in llm.js completely wiped conversationHistory in one call: `splice(0, Math.max(2, conversationHistory.length))` — with 90 messages that removes all 90 in one shot. A "last resort" path at the end of queryLLM did `conversationHistory.length = 0` as well. No graduated trim existed for overflow.
  2. Critical planning documents were injected into conversationHistory (volatile, in-memory only) rather than the system prompt (rebuilt fresh from disk each tick). When the history was wiped, the docs were gone with no recovery path.

fix:
  A. llm.js: Replaced all full-wipe splice calls in the overflow path with trimHistoryGraduated(0.25) — removes 25% of oldest messages per retry, so 3 retries = up to 75% trimmed while preserving most recent context.
  B. prompt.js: Added loadPinnedContext(dataDir) that reads <dataDir>/context/*.{md,txt,json} from disk and injects into the system prompt on every tick. Files here survive ALL history wipes because they are re-read from disk each tick.
  C. prompt.js: Raised NOTEPAD_MAX_CHARS from 600 to 2000 so the agent's own plan notepad is more useful.
  D. index.js: Calls loadPinnedContext(_agentConfig.dataDir) each tick and passes result as pinnedContext to buildSystemPrompt.

verification: Fix applied. Awaiting user test.
files_changed:
  - agent/llm.js
  - agent/prompt.js
  - agent/index.js
