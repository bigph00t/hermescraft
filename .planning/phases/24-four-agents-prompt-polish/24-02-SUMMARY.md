---
phase: 24-four-agents-prompt-polish
plan: "02"
subsystem: mind/prompt + mind/index
tags: [prompt-engineering, multi-agent, chat-filter, personality]
dependency_graph:
  requires: [24-01]
  provides: [group-aware-prompt, per-partner-chat-counter, proximity-chat-filter]
  affects: [mind/prompt.js, mind/index.js]
tech_stack:
  added: []
  patterns: [per-partner-Map-counter, proximity-failsafe-filter, dynamic-partnerNames-injection]
key_files:
  created: []
  modified:
    - mind/prompt.js
    - mind/index.js
decisions:
  - "partnerNames injected via options from _config.partnerNames (static ALL_AGENTS list, not live detection)"
  - "YOUR GROUP section as separate parts.push() call so template interpolation works for partnerList"
  - "isSenderNearby failsafe returns true for both unknown-self and unknown-sender — only block when distance positively > 32"
  - "_lastChatSender set at top of respondToChat (after in-flight guard) so it's always set before async ops begin"
  - "_lastChatSender cleared on non-chat dispatch to prevent stale sender bleed into idle-triggered think()"
metrics:
  duration: 267s
  completed: "2026-03-24"
  tasks_completed: 2
  files_modified: 2
---

# Phase 24 Plan 02: Prompt Polish + Group Social Summary

Group-aware prompt replacing YOU TWO with dynamic YOUR GROUP, per-partner chat counter Map replacing global integer, and 32-block proximity filter with startup failsafe.

## What Was Built

### Task 1: Prompt Surgery (mind/prompt.js)

Removed the `## TALK. A LOT.` section entirely — forced chat frequency rules, example dialogue lines, and the "Your first action should ALWAYS be !chat" directive. Removed the `## YOU TWO` section — best friends framing, forced pair bonding.

Added `## YOUR GROUP` as a separate `parts.push()` call that dynamically injects `options.partnerNames` (an array). Falls back to `'others'` when array is empty. Includes !give guidance and proximity awareness (stay a few blocks apart).

Preserved all 13 knowledge sections (ESSENTIAL KNOWLEDGE through NETHER) unchanged. "Never mention bugs, errors, commands" line preserved and moved to the grounding section. Updated `buildSystemPrompt` options comment to document `partnerNames` field.

### Task 2: Per-Partner Counter + Proximity Filter (mind/index.js)

Replaced module-level `let _consecutiveChatCount = 0` with:
- `const _chatCountByPartner = new Map()` — tracks consecutive chats per sender
- `let _lastChatSender = null` — tracks who triggered the current response chain

`_lastChatSender` is set at the top of `respondToChat()` (after the in-flight guard). In `think()` after dispatch: chat increments `_chatCountByPartner[_lastChatSender || '__broadcast__']`; any game action clears the entire Map and nulls `_lastChatSender`.

`chatLimitWarning` in `buildUserMessage` now uses `_chatCountByPartner.get(_lastChatSender)` instead of the global.

Added `isSenderNearby(bot, senderName)` function:
- Returns `true` when own position unknown (can't block)
- Returns `true` when sender entity position unknown (startup failsafe — prevents blocking all chat before entities load)
- Returns `distanceTo <= 32` when both positions known

Proximity check added to `messagestr` handler before `respondToChat()` call.

All three `buildSystemPrompt` call sites now pass `partnerNames: _config?.partnerNames || []`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | dfb102b | feat(24-02): prompt surgery — remove TALK/YOU TWO, add YOUR GROUP |
| Task 2 | 931b630 | feat(24-02): per-partner chat counter + proximity filter |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality is wired end-to-end. `partnerNames` flows from `config.js` ALL_AGENTS (updated in Plan 01) → `_config.partnerNames` → `buildSystemPrompt(options.partnerNames)` → template interpolation into YOUR GROUP section.

## Self-Check: PASSED

- `mind/prompt.js` exists and contains YOUR GROUP: confirmed
- `mind/index.js` exists and contains _chatCountByPartner + isSenderNearby: confirmed
- Commits dfb102b and 931b630 verified in git log
