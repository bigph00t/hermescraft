---
status: awaiting_human_verify
trigger: "Investigate and fix multiple remaining agent issues found from overnight log analysis"
created: 2026-03-22T00:00:00Z
updated: 2026-03-22T00:00:00Z
---

## Current Focus

hypothesis: All 6 root causes confirmed — applying targeted fixes
test: Each fix addresses specific confirmed root cause
expecting: All 6 issues resolved
next_action: Apply fixes to planner.js, actions.js, prompt.js

## Symptoms

expected: Agents run continuously, use correct tools, equip proper items, don't use emojis, filter out plugin spam
actual: Multiple issues found in overnight logs
errors: |
  1. Invalid action: unknown action type: mine
  2. John broke stone with bare hands (157 ticks)
  3. Planner outputs emojis in plans
  4. QuickShop update spam leaks into chat buffer
  5. look_at_block reports "Looking at air" without useful guidance
  6. Notepad entries have markdown header formatting
reproduction: Run agents for 30 minutes
started: Overnight session

## Eliminated

(none yet — all root causes confirmed, no dead ends)

## Evidence

- timestamp: 2026-03-22T00:00:00Z
  checked: planner.js line 731 (Valid types line in planner system prompt)
  found: "mine" IS NOT listed in the Valid types line — that's correct. BUT the conversion in parseQueueFromPlan (line 111-118) handles "mine" to "scan_blocks" correctly. The LLM still generates "mine" despite it not being in Valid types. Root cause is that the prompt's TOOL PROGRESSION section says things like "scan_blocks(oak_log)" but the model has prior Minecraft knowledge that "mine" is the right word.
  implication: Need to make the prohibition of "mine" explicit in the Valid types instructional text.

- timestamp: 2026-03-22T00:00:00Z
  checked: actions.js validatePreExecution case 'break_block' (lines 265-343)
  found: It checks hasWoodenPick = hasItem('wooden_pickaxe') || ... which looks at INVENTORY not EQUIPPED SLOT. John had wooden_pickaxe in inventory but not equipped. The check passes (inventory has it) but then he breaks stone bare-handed because the actual equip never happened.
  implication: Need to auto-equip the best pickaxe BEFORE the break_block action executes, not just validate. The fix goes in validatePreExecution or executeAction for break_block — inject an equip action ahead of it.

- timestamp: 2026-03-22T00:00:00Z
  checked: planner.js system prompt (lines 657-768)
  found: No emoji prohibition anywhere in the planner system prompt. The FORBIDDEN_WORDS_BLOCK in prompt.js (line 85) only applies to the main action loop, not the planner. Planner has its own systemPrompt string built inline.
  implication: Add "No emojis" instruction to planner system prompt.

- timestamp: 2026-03-22T00:00:00Z
  checked: planner.js chat filtering (lines 576-603)
  found: The isGenericSystem filter only catches "You " prefix, permission errors, and specific "No/Set" patterns. QuickShop sends messages like "--- [QuickShop] Update available..." or "modrinth.com" links — these don't match any filter and pass through to the LLM.
  implication: Add QuickShop update spam filter — lines starting with "---", containing "modrinth.com", "SNAPSHOT", or "QuickShop" update notices.

- timestamp: 2026-03-22T00:00:00Z
  checked: actions.js / index.js for look_at_block result handling
  found: look_at_block result from mod says "Looking at air at X,Y,Z". The action result handling in index.js (lines 1302-1321) passes the result directly to the LLM via completeToolCall. The mod returns this message but it's not treated as a failure — success:true with an air message. The agent doesn't get clear "block is gone, re-scan" guidance.
  implication: In index.js after executeAction, detect look_at_block results containing "air" and return a clear error: "Block at X,Y,Z is air (gone). Use scan_blocks to find a new target."

- timestamp: 2026-03-22T00:00:00Z
  checked: prompt.js FORBIDDEN_WORDS_BLOCK (lines 85-87), index.js handleNotepad
  found: FORBIDDEN_WORDS_BLOCK prohibits meta-game jargon but says nothing about markdown formatting or emojis. The notepad is plain text storage (readFileSync/writeFileSync) but the LLM writes markdown headers (## Day 1 - Complete! ✅) by habit because nothing prohibits it.
  implication: Add notepad formatting prohibition to GAMEPLAY_INSTRUCTIONS or the notepad tool description: "No markdown headers (##). No emojis. Plain text only."

## Resolution

root_cause: |
  1. mine: LLM generates "mine" because Minecraft knowledge overrides Valid types list — conversion fallback exists but shouldn't be needed; need explicit prohibition text
  2. bare hands: validatePreExecution checks inventory but doesn't auto-equip; pickaxe present but not in hand
  3. emojis: planner system prompt has no emoji prohibition (FORBIDDEN_WORDS_BLOCK only in main loop prompt.js)
  4. QuickShop spam: chat filter doesn't match plugin update notice patterns (---, modrinth, SNAPSHOT)
  5. look_at_block air: result passes as success:true with "air" message; agent has no clear signal to re-scan
  6. notepad markdown: nothing in any prompt prohibits markdown/emoji in notepad writes

fix: |
  1. mine in queue: Added explicit "mine does NOT exist. NEVER write mine" note to planner system prompt after Valid types line (planner.js ~line 739)
  2. bare hands: Added autoEquip logic to validatePreExecution for break_block — detects pickaxe in inventory but not equipped, returns {valid:true, autoEquip:'best_pickaxe'}. index.js handles autoEquip in both queue path (D) and LLM path. action-queue.js got setQueueFront() to re-insert break_block after auto-equip tick.
  3. planner emojis: Added "NO EMOJIS anywhere in your output" line to planner system prompt after mine prohibition (planner.js ~line 740)
  4. QuickShop spam: Added isUpdateSpam filter in plannerTick chat processing — matches ---, modrinth.com, SNAPSHOT, update available, [QuickShop], [EssentialsX], download.*update (planner.js ~line 588)
  5. look_at_block air: Added post-action detection in index.js — if result contains "looking at air", converts to failure with clear "use scan_blocks" guidance (index.js ~line 1317)
  6. notepad markdown: Added "plain text only — no markdown headers, no bullet points, no emojis" to notepad tool description in GAMEPLAY_INSTRUCTIONS (prompt.js line 60). Added "NO EMOJIS — ever" to FORBIDDEN_WORDS_BLOCK (prompt.js line 88).
verification: Node --check syntax passes for all 5 files. All 6 insertion points confirmed by grep.
files_changed:
  - agent/planner.js
  - agent/actions.js
  - agent/prompt.js
  - agent/index.js
  - agent/action-queue.js
