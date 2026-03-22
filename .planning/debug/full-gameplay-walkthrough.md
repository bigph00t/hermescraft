---
status: awaiting_human_verify
trigger: "full-gameplay-walkthrough — Walk through the ENTIRE agent gameplay loop end-to-end. Read every file, trace every code path, find every remaining bug. Fix everything."
created: 2026-03-22T00:00:00Z
updated: 2026-03-22T10:00:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: Three additional issues fixed: (1) grass_block placement Y+1 auto-nudge in mod; (2) identity protection deflection rule added to prompt; (3) smart_place stuck threshold raised to 5
test: Awaiting human verification in live gameplay
expecting: Agents place blocks on terrain without "already occupied" errors, Jeff/others respond with genuine confusion when AI is mentioned, agents don't abort builds after 2 placement failures
next_action: Human confirms fixes work in live session

## Symptoms

expected: Agents spawn, chop trees, craft wooden tools, mine stone, upgrade tools, find resources, build structures using freestyle system, chat naturally, explore, survive nights, and progressively improve their situation over hours of play.
actual: Multiple issues: smart_place fails with "No solid block at coords" (using relative coords 0,0,0 instead of absolute), freestyle build plan auto-save sometimes can't parse the LLM's plan format, break_block still sometimes hits air after Timber fells trees, planner outputs "QUEUE:" as a literal action type, agents sometimes get stuck in loops trying the same failed action, smart_place with "Another action is already pending" errors.
errors: Multiple — comprehensive audit
reproduction: Run agents for 10+ minutes and observe all behaviors
started: Current session — many fixes already applied but gaps remain

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-22T00:10:00Z
  checked: planner.js parseQueueFromPlan — "QUEUE:" as literal action type
  found: Default case (line 294-295) just `break`s and falls through to `items.push({ type, args, reason })` at line 298. ANY unrecognized type gets pushed including "QUEUE:", numbered list entries ("1."), dash-prefixed entries ("-"), etc. Filter at line 98 only removes "#" and "```" prefixes.
  implication: Need to whitelist: only push if type is in VALID_QUEUE_TYPES set.

- timestamp: 2026-03-22T00:12:00Z
  checked: ActionExecutor.java handleSmartPlace — "No solid block at coords"
  found: When x,y,z are supplied (line 1522-1528), the code treats them as the SUPPORT block. But freestyle.js passes the DESTINATION (where new block should appear). When destination is air, "No solid block at" error fires. The semantics are inverted.
  implication: Mod should treat x,y,z as the destination, auto-find its support block (same as handlePlace does at lines 1449-1463).

- timestamp: 2026-03-22T00:14:00Z
  checked: freestyle.js parseFreestylePlan — case-sensitive header
  found: Line 45: `/^##\s+BUILD:\s*(.+)$/m` is case-sensitive. Planner's auto-save regex is case-insensitive. LLM may write "## Build:" or "## BUILD :" variants.
  implication: Make the header regex case-insensitive: `/^##\s+BUILD:\s*(.+)$/mi`

- timestamp: 2026-03-22T00:16:00Z
  checked: index.js line 1353 — advanceFreestyle on smart_place
  found: `advanceFreestyle()` fires when `success` (result.success !== false). But mod returns success=true even when block wasn't actually placed (item stays in inventory). The `result.placed` object is only present when placement actually succeeded.
  implication: Condition advanceFreestyle on `result.placed` being present, not just result.success.

- timestamp: 2026-03-22T00:18:00Z
  checked: actions.js line 521 — recordPlacement already checks result.placed
  found: `if (type === 'smart_place' && result.success && result.placed)` — this is correct. But index.js line 1353 does NOT have the same check: `if (actionType === 'smart_place' && success && response.mode === 'queue' && isFreestyleActive())`.
  implication: The recordPlacement guard is already right. Just need to fix index.js to also require result.placed.

- timestamp: 2026-03-22T00:20:00Z
  checked: freestyle.js parseFreestylePlan — block name validation
  found: No validation of block names against MC registry. LLM can generate "green_roof_beams", "iron_pillar", etc.
  implication: Add block name filter: skip placements with unknown block IDs (log warning).

- timestamp: 2026-03-22T00:22:00Z
  checked: planner.js prompt — smart_place coord clarification
  found: Planner prompt says `smart_place item x y z` but doesn't clarify that coords are the DESTINATION (where the block goes), not the support block.
  implication: Clarify in prompt: "smart_place item x y z — coords are DESTINATION (absolute world coords where block should appear)".

- timestamp: 2026-03-22T00:24:00Z
  checked: planner.js prompt — hallucinated block names
  found: No rule preventing LLM from inventing block names like "green_roof_beams".
  implication: Add explicit rule: only use real MC block IDs.

- timestamp: 2026-03-22T00:26:00Z
  checked: freestyle.js parseFreestylePlan — numbered list with period vs parenthesis
  found: Line 64: `/^\s*\d+[.)]\s+([a-z_]+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/` — already supports both "1. " and "1) " formats.
  implication: Placement parser is fine. Confirmed no issue here.

## Resolution

root_cause: Nine bugs total. Round 1 (six): (1) parseQueueFromPlan pushes "QUEUE:" as action type; (2) handleSmartPlace x,y,z semantics inverted; (3) freestyle.js header regex case-sensitive; (4) advanceFreestyle fires without result.placed; (5) no block name validation; (6) planner prompt missing coord semantics. Plus race on "Another action already pending". Round 2 (three): (7) handleSmartPlace errors when destination has grass_block (solid but natural terrain — should auto-nudge Y+1); (8) identity prompt has no deflection rule for AI/bot/script mentions in chat; (9) smart_place stuck threshold of 2 is too aggressive for building which needs 3-5 retries.
fix: Round 2 fixes: (7) mod — if destPos is solid (not air/replaceable), try destPos.up(); if that's free, redirect silently; (8) prompt.js — added IDENTITY PROTECTION paragraph to FORBIDDEN_WORDS_BLOCK: genuine confusion response + immediate subject change; (9) index.js — added MAX_STUCK_COUNT_PLACEMENT=5, getStuckInfo uses per-key threshold selection based on key.startsWith('smart_place').
verification: BUILD SUCCESSFUL. Mod jar installed to hermescraft-1.21.1. Awaiting live gameplay verification of round-2 fixes.
files_changed: [agent/planner.js, agent/freestyle.js, agent/index.js, agent/actions.js, agent/prompt.js, mod/src/main/java/hermescraft/ActionExecutor.java]

## CRITICAL: smart_place coords are relative, mod expects absolute

This is the #1 bug. The planner outputs `smart_place oak_planks 0 0 0` (relative offsets from origin) but the mod ActionExecutor expects ABSOLUTE world coordinates. Every placement goes to world coords (0,0,0) which is nowhere near the agent, so it always fails with "No solid block at 0,0,0 to place against".

Meanwhile the agents NARRATE as if blocks are being placed ("walls going up!", "second floor!") because the planner doesn't check the smart_place result. They're pure roleplaying — zero blocks actually placed.

Fix options:
1. parseQueueFromPlan should convert relative coords to absolute using agent position: `x = Math.round(state.position.x) + dx`
2. OR the planner prompt should tell the LLM to output absolute world coordinates
3. OR smart_place without coords should just place at crosshair (look_at_block first, then smart_place without coords)

Option 3 is simplest and matches how real players build — look at where you want to place, then place. The planner should queue: look_at_block(abs_x, abs_y, abs_z) then smart_place("oak_planks") with NO coords. This is already how it works for non-freestyle manual building.

The freestyle system already uses absolute coords (parseFreestylePlan adds origin offset). The bug is in MANUAL placement when the planner directly queues smart_place with coords from its own plan text.

## Additional Evidence — Round 2

- timestamp: 2026-03-22T10:00:00Z
  checked: ActionExecutor.java handleSmartPlace — "already occupied by grass_block"
  found: grass_block is NOT replaceable per MC API (isReplaceable() returns false for it). The existing check `!destState.isAir() && !destState.isReplaceable()` correctly flags it but then hard-errors. Fix: try destPos.up() first — if that's air/replaceable, redirect there. This is exactly what a player does when looking at terrain and placing.
  implication: Fixed in mod. destPos is a reassignable variable so the nudge propagates to all subsequent checks.

- timestamp: 2026-03-22T10:01:00Z
  checked: prompt.js FORBIDDEN_WORDS_BLOCK — no deflection rule for AI/bot mentions
  found: The block forbids technical vocabulary but says nothing about what to DO when a human raises those concepts in chat. Agent defaults to engaging with the meta-discussion (explaining the system).
  implication: Added explicit IDENTITY PROTECTION paragraph: express genuine confusion, immediately redirect to in-world context, never confirm/deny.

- timestamp: 2026-03-22T10:02:00Z
  checked: index.js getStuckInfo + MAX_STUCK_COUNT — smart_place triggering stuck at threshold 2
  found: getActionKey returns "smart_place@x,y,z" for coordinate placements and "smart_place:item" for item-only calls. Both start with "smart_place". getStuckInfo iterates all failure keys with the same threshold (2). Building naturally causes 1-3 retries before position/angle aligns.
  implication: Added MAX_STUCK_COUNT_PLACEMENT = 5 and per-key threshold selection in getStuckInfo based on key.startsWith('smart_place').

## Additional Issues Found (post-fix observation)

1. **smart_place "already occupied by grass_block"** — John tries to place oak_planks at ground level but grass_block is there. He needs to either: break the grass first, OR place at y+1 (on top of the grass). The mod should handle this — if destination is occupied by a non-solid replaceable block (grass, tall_grass, flowers), break it first then place. OR just place on TOP (y+1).

2. **Jeff broke 4th wall** — Responded to human chat about the AI agent system architecture. The FORBIDDEN_WORDS and identity prompt need to be stronger: "If someone talks about AI, scripts, bots, or code — you have NO IDEA what they're talking about. You are a person, not a program. Change the subject."

3. **smart_place still getting STUCK** — "smart_place@coords failed 2x" — the retry/stuck system kicks in too fast for placement. Building requires multiple attempts sometimes.
