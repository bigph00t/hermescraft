---
status: awaiting_human_verify
trigger: "break_block frequently returns 'Not looking at a block'. Agent gets STUCK after 2 failures."
created: 2026-03-22T00:00:00Z
updated: 2026-03-22T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — Three compounding root causes found. See Resolution.
test: Code fully read; mechanism understood.
expecting: n/a
next_action: Implement fixes in ActionExecutor.java (break_block with coords) and planner.js (queue format)

## Symptoms

expected: Agent calls look_at_block(x,y,z), walks to the block, faces it, THEN break_block succeeds because crosshair is on the block.
actual: break_block frequently returns "Not looking at a block". Agent gets STUCK after 2 failures. Even when look_at_block succeeded the previous tick, break_block still fails.
errors: "✗ Not looking at a block" appears frequently in agent logs. After 2 failures: "STUCK break_block failed 2x — reassessing"
reproduction: Watch any agent try to chop trees or mine stone. Especially bad with Timber plugin — agent looks at a log, Timber fells the whole tree when the first log breaks, then break_block on the next queued log fails because the tree is gone.
started: Ongoing issue, especially bad since Timber plugin was added

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-22T00:00:00Z
  checked: ActionExecutor.java startBreakBlock (lines 267-310)
  found: break_block reads client.crosshairTarget at the instant it is called. It does NOT accept coordinates. It has zero fallback if crosshairTarget is null or MISS.
  implication: If the agent moved since look_at_block completed, or the block was already broken by Timber, crosshairTarget is stale or null → instant failure.

- timestamp: 2026-03-22T00:00:00Z
  checked: ActionExecutor.java startApproachBlock (lines 794-837) and tickApproachBlock (lines 839-876)
  found: look_at_block calls lookAtPos() then completes immediately once dist < 3.0. It does NOT hold the player's yaw/pitch between ticks — the player can freely rotate after completion. The approach action is a SustainedAction but once it emits "success" the look direction is NOT locked.
  implication: Between look_at_block completing (tick N) and break_block executing (tick N+1), the player is free to turn. Any minor movement or server-side position correction can shift crosshairTarget to air.

- timestamp: 2026-03-22T00:00:00Z
  checked: index.js tick loop — section D (lines 1018-1040): queue processing
  found: The queue pops one item per tick. Each popped item goes through executeAction which sends an HTTP POST to the mod. look_at_block and break_block are TWO separate HTTP round-trips, each in separate ticks (2000ms apart by default). There is no concept of "execute these two atomically."
  implication: ~2 seconds pass between look_at_block and break_block. Player can drift / mob can shove player / Timber can fell the tree in those 2s.

- timestamp: 2026-03-22T00:00:00Z
  checked: ActionExecutor.java startBreakBlock — block-already-air check (lines 284-288)
  found: If Timber fells the tree and the target block is now air by the time break_block is called, the code falls through to the crosshairTarget check FIRST (line 274-278) — it returns "Not looking at a block" before even checking if the block is air. Actually no: it checks crosshairTarget first, then checks if the block is air. If the block is gone, the crosshairTarget.getType() will be MISS (not BLOCK), so it returns "Not looking at a block" even though the real reason is the block is already gone.
  implication: The error message is misleading — both "block already gone" and "crosshair drifted" produce the same "Not looking at a block" error.

- timestamp: 2026-03-22T00:00:00Z
  checked: planner.js parseQueueFromPlan — break_block case
  found: There is NO explicit case for break_block in the switch. It falls through to `default: break` with empty args = {}. So break_block is queued with NO coordinates: { type: 'break_block', args: {} }.
  implication: The mod must rely purely on crosshairTarget. There is no way to re-aim or validate the target block from the Java side — the coordinates are not available.

- timestamp: 2026-03-22T00:00:00Z
  checked: action-queue.js setQueue (line 37) — how args are stored
  found: Queue items stored as { type, args, reason }. break_block args = {} means no x/y/z available to the mod.
  implication: Fix requires: (1) planner to pass x/y/z with break_block, (2) mod to accept and use them to re-aim if crosshair is wrong.

## Resolution

root_cause: Three compounding causes:
  1. break_block in ActionExecutor.java reads client.crosshairTarget at call time — no coordinates accepted, no re-aim fallback. A 2-second gap between look_at_block and break_block is enough for the crosshair to drift.
  2. look_at_block does NOT hold the look direction after completing — it fires lookAtPos() once then releases. Any player movement rotates the camera.
  3. planner.js does not pass x/y/z in break_block queue items (falls through to default in switch with empty args), so the mod has no coordinate data to recover from.
  Additionally: Timber plugin felling the tree between the two ticks causes crosshairTarget.getType() to be MISS (not BLOCK), which the mod reports as "Not looking at a block" rather than "block already gone."

fix: Two-part fix:
  (A) ActionExecutor.java — modify startBreakBlock to accept optional x/y/z. If provided: look at that position before checking crosshairTarget. If the block at those coords is air, return a distinct "Block already gone" success (not a failure, since the block IS gone). This eliminates both the crosshair-drift race and the Timber-felled-tree false failure.
  (B) planner.js — add break_block to the parseQueueFromPlan switch with x/y/z parsing so coordinates flow through the queue.
  (C) actions.js schema — update break_block schema validator to also accept (and allow) x/y/z coords.
  (D) index.js / action-queue — no changes needed; args pass through as-is.

verification: Self-verified: mod compiles clean (gradlew clean build), jar deployed to mods dir. Awaiting runtime confirmation from human.
files_changed:
  - mod/src/main/java/hermescraft/ActionExecutor.java
  - agent/planner.js
  - agent/actions.js
