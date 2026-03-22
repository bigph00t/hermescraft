---
status: awaiting_human_verify
trigger: "Full audit of agent tick loop, planner loop, and vision loop for any other bugs, inefficiencies, or issues that would make the agents behave badly."
created: 2026-03-22T00:00:00Z
updated: 2026-03-22T00:02:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: 13 bugs confirmed and 9 fixed across index.js, planner.js, actions.js, action-queue.js
test: Code inspection + targeted fixes applied
expecting: Better agent behavior — survival, less stalling, scan results visible, correct stuck detection
next_action: human verification

## Symptoms

expected: Smooth agent behavior — observe world, plan intelligently, execute actions, learn from mistakes, chat naturally.
actual: Various issues: agents get stuck frequently, planner outputs get garbled, queue items get skipped with unclear errors, system logs leak into player-visible chat, agents don't seem to learn from failures.
errors: Multiple — this is a general audit looking for any issues
reproduction: Run agents for 5-10 minutes and observe behavior
timeline: Ongoing since v1.0, some issues predate v1.1 changes

## Eliminated

(none — all 13 bugs confirmed)

## Evidence

### Bug 1 — CRITICAL: Emergency health response overridden by Baritone-active check [FIXED]
- checked: index.js lines 980-1011
- found: Emergency LLM response (health < 6) was discarded if isBaritoneActive() — Baritone-active block would return null before the response could be used.
- fix: Removed `!isBaritoneActive()` guard from emergency block. Also stop Baritone explicitly on health emergency. Added `!response` guard to Baritone-active block so it doesn't override emergency response.

### Bug 2 — CRITICAL: Planner drops scan_miss and "No "-prefixed plugin responses [FIXED]
- checked: planner.js line 564 (old)
- found: `s.startsWith('No ')` in system-junk skip filter silently dropped "No oak_log found within 50 blocks" and "No players within N blocks".
- fix: Added `isPluginResult` check that whitelists known plugin responses (scan_miss, nearby_miss) before the filter. These now pass through to the planner context.

### Bug 3 — CRITICAL: Chat truncation in action loop too aggressive (90 chars) [FIXED]
- checked: index.js line 1166-1168
- found: Queue-sourced chat was hard-truncated to 90 chars, producing mid-sentence messages for players.
- fix: Raised limit to 180 chars (matching planner's clip threshold). Added smart sentence-boundary clipping logic to match planner behavior.

### Bug 4 — MEDIUM: mine→scan_blocks conversion logging improved [FIXED - minor]
- checked: planner.js lines 111-116
- found: mine conversion produced only scan_blocks, which is correct behavior (can't know coords at queue-build time). Improved logging to show the block type being converted.

### Bug 5 — MEDIUM: "QUEUE: keep" when queue already empty leaves agent stalling [FIXED]
- checked: planner.js lines 906-932
- found: When queue drained between planner cycles and LLM output "QUEUE: keep", no new items were parsed, leaving agent without a queue until next planner cycle.
- fix: QUEUE: keep now checks if queue is actually empty. If empty, falls through to re-parse plan for new items.

### Bug 6 — MEDIUM: Position-based stuck detection resets on non-movement actions [FIXED]
- checked: index.js lines 618-620
- found: `samePositionTicks = 0` reset on every non-movement action. Agent alternating navigate(stuck)→notepad→navigate(stuck) never triggered recovery.
- fix: Removed the `else if (!wasMovementAction) { samePositionTicks = 0 }` branch. Counter now only resets when position actually changes. Non-movement ticks are neutral — don't reset, don't increment.

### Bug 7 — MEDIUM: Chat redirect tells LLM "chat queued for planner" (misleading) [FIXED]
- checked: index.js line 1077
- found: Tool call result said "Chat queued for planner. Focus on actions." but nothing was actually queued anywhere. LLM learned incorrect behavior.
- fix: Changed message to "Chat skipped — focus on a game action instead." (honest). Added comment clarifying the planner handles chat independently.

### Bug 8 — LOW: TICK_MS env var unused in main loop (documented behavior)
- checked: index.js lines 1499-1510
- found: Main loop runs at LLM speed, not at TICK_MS. This is correct behavior (you want max responsiveness), but the env var is misleading.
- decision: Not fixing — tick rate is correctly constrained by LLM latency. TICK_MS was intended as minimum interval, but LLM calls are always longer.

### Bug 9 — MEDIUM: _pendingHumanMessages accumulates unbounded on planner LLM errors [FIXED]
- checked: planner.js catch block
- found: _pendingHumanMessages was only cleared on successful planner cycle. Consecutive LLM failures caused unbounded accumulation.
- fix: Added cap in catch block — trim to 5 most recent messages, mark older ones as seen.

### Bug 10 — LOW: Queue summary omits navigate coordinates [FIXED]
- checked: action-queue.js getQueueSummary
- found: navigate/look_at_block/interact_block showed no info in queue summary ("navigate → navigate → navigate").
- fix: Added fallback to show "x,y,z" when args.blockName and args.item are absent but x/y/z are present.

### Bug 11 — LOW: Vision context stale timestamp (informational, no fix needed)
- checked: vision.js lines 200-203
- found: "updated Xs ago" in vision context is useful to the LLM for deciding whether to trust vision data.
- decision: Intentional. No fix.

### Bug 12 — LOW: breed chicken food mismatch between validatePreExecution and handler [FIXED]
- checked: actions.js line 244 vs index.js line 1239
- found: validatePreExecution used 'seeds', handler used 'wheat_seeds'. Mismatch could cause false validation failures.
- fix: Aligned validatePreExecution to use 'wheat_seeds' to match the handler and actual Minecraft item ID.

### Bug 13 — LOW: "Set " filter drops EssentialsX sethome confirmation [FIXED - covered by Bug 2 fix]
- fix: Covered by the isPluginResult whitelist added for Bug 2. "Set [home] home." now passes through.

## Resolution

root_cause: Multiple independent bugs across the tick loop: (1) emergency survival bypassed when Baritone active, (2) scan "no results" silently dropped by planner chat filter, (3) queue-sourced chat truncated at 90 chars, (4) QUEUE:keep when queue empty caused stalling, (5) stuck detection reset too aggressively on non-movement actions, (6) misleading "chat queued" feedback, (7) pending human messages grew unbounded on LLM errors.

fix: |
  agent/index.js:
    - Emergency block now stops Baritone and runs regardless; Baritone-active block guards with !response
    - Chat truncation raised from 90 to 180 chars with sentence-boundary clipping
    - Stuck detection: removed samePositionTicks reset on non-movement actions
    - Chat redirect message changed from misleading "queued" to honest "skipped"
  agent/planner.js:
    - System junk filter now whitelists known plugin results (scan_miss, nearby_miss, sethome confirm)
    - QUEUE: keep now re-parses plan if queue is empty
    - mine conversion logging improved
    - _pendingHumanMessages capped to 5 on LLM errors
  agent/actions.js:
    - breed chicken food corrected from 'seeds' to 'wheat_seeds'
  agent/action-queue.js:
    - getQueueSummary shows x,y,z coordinates for navigate/place actions

verification: Code inspection — all changes verified by re-reading modified sections
files_changed:
  - agent/index.js
  - agent/planner.js
  - agent/actions.js
  - agent/action-queue.js
