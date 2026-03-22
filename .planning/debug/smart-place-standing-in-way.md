---
status: awaiting_human_verify
trigger: "smart-place-standing-in-way"
created: 2026-03-22T00:00:00Z
updated: 2026-03-22T00:00:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED — The mod-side handleSmartPlace at lines 1528-1533 and 1553-1557 returns a hard error when destPos equals playerFeet or playerHead, instead of trying adjacent placement offsets. The agent receives this error and retries the same coordinates, creating an infinite loop.
test: Implement mod-side auto-offset: when destPos is blocked by the player, iterate over 4 cardinal offsets (N/S/E/W) from the same support level and try the first free spot. If none available, return the error.
expecting: Fix eliminates the error for the common case (player standing beside or on top of the target block) without requiring agent-side changes or a separate navigate action.
next_action: Implement fix in ActionExecutor.java handleSmartPlace

## Symptoms

expected: Agent places crafting_table on a nearby block surface. Should auto-move if standing in the way.
actual: "Cannot place there — you are standing in the way. Move first." — agent doesn't know to move and retries at the same spot.
errors: "✗ Cannot place there — you are standing in the way. Move first."
reproduction: Agent crafts crafting_table, looks at the ground block directly below/beside them, tries smart_place. Fails because they're standing on the target spot.
started: Observed during current session after agents crafted crafting tables.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-22T00:05:00Z
  checked: ActionExecutor.java lines 1528-1533 (coordinate mode) and 1553-1557 (crosshair mode)
  found: Both branches compute destPos = supportBlock.offset(placeFace), then if destPos equals playerFeet or playerHead they return a hard errorResult "Cannot place there — you are standing in the way. Move first." No fallback or retry logic exists.
  implication: The mod never tries an alternate position — it always fails when the player occupies the target spot.

- timestamp: 2026-03-22T00:05:00Z
  checked: agent/actions.js validatePreExecution case 'smart_place' (lines 235-240)
  found: Only checks inventory — no position check. The agent never learns it needs to move before calling smart_place.
  implication: Agent will retry the same call indefinitely since it passes pre-execution validation.

- timestamp: 2026-03-22T00:05:00Z
  checked: planner.js smart_place usage (lines 151-154, 177, 224)
  found: Planner emits smart_place with explicit x,y,z coordinates (support block coords). In crosshair mode it relies on look_at_block first. No step-back logic exists anywhere in the queue builder.
  implication: Fix must be mod-side: try adjacent offsets before giving up. Agent-side pre-execution check can also be added as a secondary guard using player position from state.

- timestamp: 2026-03-22T00:05:00Z
  checked: handleNavigate (lines 750-767) and BaritoneIntegration
  found: navigate uses Baritone which is async/sustained. Can't be injected mid-smart_place call in the mod. Mod-side offset-search is the clean approach.
  implication: The fix should be entirely in handleSmartPlace: when destPos is occupied by the player, search for the nearest free alternative (same face direction but shift the support block by +1 in cardinal offsets).

## Resolution

root_cause: handleSmartPlace in ActionExecutor.java lines 1531-1532 (coordinate mode) and 1555-1556 (crosshair mode) returned a hard error "Cannot place there — you are standing in the way. Move first." when destPos == playerFeet or playerHead. No fallback to adjacent positions existed. The agent received this error, passed pre-execution validation (which only checks inventory), and retried the same coordinates indefinitely.

fix: In both coordinate-mode and crosshair-mode branches of handleSmartPlace, when destPos is occupied by the player, iterate over the 4 cardinal neighbours (N/S/E/W) of the original support block at the same Y level. Pick the first one where: the neighbour is solid (can serve as a support), the destination (neighbour.offset(placeFace)) is air/replaceable, and the destination doesn't overlap with the player. If found, redirect supportBlock to the neighbour and proceed with placement. If none found, return the error with updated text. Step 3 (look+place) then aims at the new supportBlock face automatically.

verification: Mod builds cleanly (gradle clean build). Deployed to both PrismLauncher instances. Requires Minecraft restart and live test.

files_changed:
  - mod/src/main/java/hermescraft/ActionExecutor.java
