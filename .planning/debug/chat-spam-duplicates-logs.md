---
status: awaiting_human_verify
trigger: "Agent chat system is broken — John talks every single turn instead of natural back-and-forth, messages get duplicated, quoted versions appear alongside raw versions, agents echo each other's messages, @mentions and log output leak into chat, and truncated messages get skipped silently."
created: 2026-03-22T00:00:00Z
updated: 2026-03-22T00:20:00Z
symptoms_prefilled: true
---

## Current Focus

hypothesis: CONFIRMED AND FIXED — all 6 root causes addressed in agent/planner.js.
test: Awaiting human verification — run both agents, observe chat behavior over 2-3 minutes.
expecting: No duplicate sends, chat at most once every 3 cycles, no echoing, no @mentions, short messages not dropped.
next_action: Human to confirm fix in real environment.

## Symptoms

expected: Agents chat naturally like real people — say something when it makes sense, wait for a response, don't talk every single cycle. Messages should be clean (no quotes, no @, no duplicates, no log output leaking into chat). Natural back-and-forth conversation with quiet periods of just working.
actual: John talks almost every planner cycle. Messages appear duplicated (raw + quoted version). Jeffrey echoes John's messages as his own. @mentions leak into chat ("@JeffEnderstein"). System logs like "No cobblestone found within 50 blocks" appear in chat. Some messages get "Skipped truncated chat" and never send. The chat feels robotic and spammy.
errors: [Planner] Skipped truncated chat — messages over 180 chars without ending punctuation get dropped. Also the Say: regex extracts quoted text AND the line itself, causing double sends.
reproduction: Start both agents on a fresh world. Within 2-3 minutes, John starts chatting every cycle while Jeffrey barely talks or echoes John's words.
started: Has been an issue since the agents were first run.

## Eliminated

(none — all 6 root causes confirmed and fixed)

## Evidence

- timestamp: 2026-03-22T00:00:00Z
  checked: planner.js lines 929-1012 (Say: extraction path)
  found: Three regex patterns (p1, p2, p3 fallback) could ALL fire independently. No cooldown variable. Only word-similarity dedup, not frequency limiting.
  implication: Every planner cycle could produce a chat message.

- timestamp: 2026-03-22T00:00:00Z
  checked: planner.js parseQueueFromPlan case 'chat' (line 158) + Say: extraction
  found: Both paths fire independently. Queue chat bypasses D-16 redirect in index.js (response.mode='queue'). Result: same message sent twice — once from queue execution, once from Say: extraction.
  implication: Definitive source of duplicate messages.

- timestamp: 2026-03-22T00:00:00Z
  checked: planner.js chat classification (lines 567-612) + prompt construction
  found: newAgentChat included in state.recentChat → summarizeState() → LLM sees "New chat: <JohnKwon> hey let's get wood" → generates echoing Say: line.
  implication: Jeffrey echoes John because it's in every planner prompt with no "don't echo" instruction.

- timestamp: 2026-03-22T00:00:00Z
  checked: planner.js truncation filter (line 1010 original)
  found: Threshold was >10 chars (catches almost everything). Changed to >60 chars.
  implication: Short conversational phrases were silently dropped.

- timestamp: 2026-03-22T00:00:00Z
  checked: planner.js prompt instruction block (lines 708-726)
  found: Prompt listed "chat" as valid queue type AND instructed Say: line simultaneously. LLM used both. Both fire.
  implication: Structural prompt confusion was the root cause of dual-path activation.

- timestamp: 2026-03-22T00:00:00Z
  checked: planner.js Say: extraction, no cleaning step
  found: No @mention stripping, no "Name: " prefix stripping. Whatever the LLM wrote passed verbatim.
  implication: @JeffEnderstein and "Jeffrey: hey" reached Minecraft chat unchanged.

## Resolution

root_cause: Six distinct bugs in agent/planner.js: (1) Queue chat AND Say: extraction both fire — parseQueueFromPlan case 'chat' creates queue items that index.js executes while planner.js simultaneously extracts Say: from the same plan text; (2) No cycle-based cooldown — only word-similarity dedup, not frequency control; (3) newAgentChat in planner prompt causes echo — LLM sees other agent's messages and paraphrases them in Say: lines; (4) Truncation filter threshold of >10 chars drops valid short conversational messages; (5) @mentions and "Name:" prefixes not stripped before sending; (6) Prompt listed "chat" as valid queue type and instructed Say: simultaneously — LLM used both.

fix: (1) Changed parseQueueFromPlan case 'chat' to skip (continue) — Say: extraction is now the sole chat path; (2) Added _chatCooldownCycles counter and CHAT_COOLDOWN_CYCLES=3 constant — agents must wait 3 planner cycles (~15s) between unsolicited chats, human replies bypass this; (3) Added echo filter in Say: extraction — skips messages with 60%+ word overlap with newAgentChat messages from the current cycle; (4) Raised truncation filter threshold from >10 chars to >60 chars — short phrases now pass through; (5) Added cleaning step before send: strips @\w+ mentions and "Name: " prefixes; (6) Removed "chat" from valid QUEUE types list in prompt and added explicit NOTE: "Do NOT put chat in your QUEUE — use Say: ONLY".

verification:
files_changed: [agent/planner.js]
