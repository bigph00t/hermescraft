---
phase: 03-mind-loop-llm
plan: "01"
subsystem: mind
tags: [llm-client, conversation-history, command-parser, prompt-builder, command-registry]
dependency_graph:
  requires:
    - body/skills/gather.js
    - body/skills/mine.js
    - body/skills/craft.js
    - body/skills/smelt.js
    - body/navigate.js
    - body/interrupt.js
  provides:
    - mind/llm.js
    - mind/prompt.js
    - mind/registry.js
  affects:
    - mind/index.js (Plan 02 — wires these modules together)
tech_stack:
  added: []
  patterns:
    - "OpenAI SDK text mode (no tool_choice) — !command text parsing is the reliable path for MiniMax M2.7"
    - "Graduated history trimming ported verbatim from agent/llm.js — round-boundary-aware, never wipes full context"
    - "Mind boundary: only mind/registry.js imports from body/; mind/llm.js and mind/prompt.js are boundary-clean"
key_files:
  created:
    - mind/llm.js
    - mind/prompt.js
    - mind/registry.js
  modified: []
decisions:
  - "Text mode only in queryLLM — no tool_choice; MiniMax M2.7 thinking model ignores brevity constraints and may not produce tool calls reliably; !command text is the resilient path per research"
  - "parseCommand uses matchAll with capture groups for named args (key:value and key:\"quoted\") plus positional fallback for bare !gather oak_log 10 style calls"
  - "MAX_HISTORY_MESSAGES = 80 (40 turns) matching MIND-03 — graduated trimming at 25% per overflow, not a full wipe"
  - "registry.js parseInt() wraps all numeric args — parseCommand produces strings, body/ skills expect numbers"
  - "listCommands() exposes registered command names so prompt.js can build the !command reference dynamically in future phases"
metrics:
  duration: "2m 23s"
  completed: "2026-03-22"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 03 Plan 01: Mind Core Modules Summary

LLM client with 40-turn rolling history + graduated trimming, state-aware prompt builder, and 7-command dispatch registry bridging Mind to Body.

## What Was Built

Three modules that form the core of the v2 Mind layer:

**mind/llm.js** — OpenAI SDK client in text mode. `queryLLM(systemPrompt, userMessage)` sends the prompt to the configured vLLM endpoint, strips `<think>` tags from the response (MiniMax M2.7 wraps all output in think tags — the actual `!command` comes after `</think>`), runs `parseCommand()` to extract the command name and args, appends to conversation history, and trims. Graduated trimming (`trimHistoryGraduated`) is ported verbatim from agent/llm.js — round-boundary-aware removal of oldest complete turns. On context overflow, trims 25% and retries up to 3 times with exponential backoff.

**mind/prompt.js** — `buildSystemPrompt(bot, options)` emits the identity section (SOUL file or default persona), a compact `!command` reference with 8 argument examples, and an explicit single-command format instruction for MiniMax M2.7 compliance. `buildStateText(bot)` reads position, health, food, time-of-day, inventory, and nearby entity counts directly from mineflayer — no HTTP bridge. `buildUserMessage(bot, trigger, options)` formats the trigger context (`[chat from X: msg]`, `[skill complete: name — done/failed]`, `[idle for Nms]`) followed by the state text.

**mind/registry.js** — A plain `Map` of 7 command names to async handler functions. `dispatch(bot, command, args)` calls `requestInterrupt` (cooperative cancel of any in-flight skill), `clearInterrupt` (reset for new skill), then awaits the body/ skill function. All numeric args (`count`, `x`, `y`, `z`) are `parseInt()`-wrapped since `parseCommand` produces strings. Returns `{ success, reason? }` — errors are caught and returned as `{ success: false, reason: err.message }` rather than thrown.

## Verification

All acceptance criteria passed:
- `mind/llm.js` imports OpenAI, uses VLLM_URL, sets MAX_HISTORY_MESSAGES = 80, has trimHistoryGraduated (3 occurrences: definition + 2 usages), has parseCommand (definition + usage), strips `<think>` tags (4 occurrences)
- `mind/prompt.js` references `!gather` in command docs, uses `buildStateText` in 2 places (definition + buildUserMessage call)
- No `body/` imports in `mind/llm.js` or `mind/prompt.js` — boundary PASS
- All three modules load together: 9 total exports
- `listCommands()` returns: gather, mine, craft, smelt, navigate, chat, idle

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `0ffef65` feat(03-01): create mind/llm.js and mind/prompt.js
- `f987ba4` feat(03-01): create mind/registry.js (command dispatch bridge Mind → Body)

## Self-Check: PASSED

All files present: mind/llm.js, mind/prompt.js, mind/registry.js
All commits present: 0ffef65, f987ba4
