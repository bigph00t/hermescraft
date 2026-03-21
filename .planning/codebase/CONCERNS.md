# Codebase Concerns

**Analysis Date:** 2026-03-20

---

## 1. COMPRESSION / MEMORY

### trimHistoryGraduated — Message Boundary Violations (High Impact Bug)

**Files:** `agent/llm.js:58-64`

The function splices a raw count of messages without respecting conversation round boundaries:

```js
function trimHistoryGraduated(fraction = 0.25) {
  const removeCount = Math.max(2, Math.ceil(conversationHistory.length * fraction));
  conversationHistory.splice(0, removeCount);
}
```

A typical conversation round is 3 messages: `[user, assistant(tool_call), tool]`. If history has 12 messages and a context overflow fires, `removeCount = ceil(12 * 0.25) = 3`. Splicing 3 off a history that starts with a full round is safe. But if history starts mid-round — e.g. `[tool, user, assistant, tool, ...]` — splicing 3 removes `[tool, user, assistant]` and leaves `[tool, ...]` as the first message. The OpenAI API requires the first history message to be `user` role. Sending `role: "tool"` as the first message after the system prompt will cause a 400 error.

This creates a cascading failure: context overflow fires `trimHistoryGraduated` → potentially malformed history → API 400 → the `err.status === 400` branch on line 266 **wipes the entire history** (`conversationHistory.length = 0`). So the graduated trim can still cause a full wipe via the error recovery path.

**Fix approach:** After splicing, scan forward past any leading `tool` or `assistant` messages until the first `user` message, and remove those orphaned messages too.

### Session Memory — In-Memory Only, No Disk Persistence of Conversation History

**Files:** `agent/llm.js:32`, `agent/index.js:248-250`

`conversationHistory` is a module-level array. It is never written to disk. On agent crash, OOM kill, or SIGKILL, all L1 (session) memory is lost. The agent restarts with no context of what it was doing mid-task.

There is no checkpoint / restore of conversation state. The notepad (`agent/data/<name>/notepad.txt`) does persist to disk and is the only semi-durable task memory, but it only works if the agent successfully wrote its plan before crashing. The pinned context system (`dataDir/context/*.md`) also survives restarts and is the correct solution for long-lived state, but the agent has no automatic mechanism to write its current task state there — only a human can place files in that directory.

**Impact:** Any crash during a long mining or navigation task restarts the agent from zero context. The notepad may have a stale plan that no longer applies.

### completeToolCall — Called After Pipelined Response Executes (Correct But Fragile)

**Files:** `agent/llm.js:70-81`, `agent/index.js:537-543, 567-569`

When a pipelined response is used (precomputed during a sustained action), the tool call's `tool_result` message is correctly appended by `completeToolCall` after the precomputed action executes. The sequence is valid. However, `completeToolCall` only appends if `lastMsg.tool_calls?.length > 0` (line 73). If the pipelined response fell back to `text_parsed` mode (no tool_calls), `completeToolCall` is a no-op, leaving an unmatched tool call entry in history. This is currently safe because text-parsed responses do not push `tool_calls` to history (line 243), but is a subtle invariant that could break if the history push logic changes.

### History Never Backed Up Before Graduation Trim

**Files:** `agent/llm.js:253-263`

On context overflow retry, `trimHistoryGraduated(0.25)` is called, then the loop continues. If there are 3 retry attempts and each trims 25%, by the third attempt only ~42% of original history remains. The trimmed portions are gone forever. There is no logging of how much was trimmed or any notification to the operator that context pressure is occurring.

---

## 2. AGENT WORKFLOWS — No Plan→Execute→Review Loop

**Files:** `agent/index.js:226-634`, `agent/prompt.js:120-187`

The agent runs a purely reactive observe→think→act cycle with no explicit planning phase. Every tick independently calls the LLM for a single action. There is no mechanism for:

- **Multi-step planning:** The LLM decides one action per tick. It can write a plan to the notepad, but there is no code that enforces following a plan or verifies plan steps completed.
- **Execution verification:** After an action succeeds, there is no check that it achieved its intended goal. A `mine oak_log` that returns `success: true` does not verify that the log actually entered inventory.
- **Quality review:** No second LLM call reviews whether the chosen action was optimal. The first parsed tool call is executed unconditionally (beyond schema validation).
- **Iteration:** If a crafting sequence partially fails (e.g. smelt succeeds but craft fails), the agent must re-discover this through game state on the next tick rather than recovering within a task.

The notepad tool is the only planning primitive. The agent is instructed to write plans there, but there is no system prompt enforcement or code that detects when a plan step is complete and advances to the next.

**Impact:** The agent is prone to getting stuck in local loops (recognized and handled by the stuck detector), but cannot self-organize multi-step workflows that require sequential dependencies.

---

## 3. QUALITY / REVIEW — No Output Quality Mechanisms

**Files:** `agent/index.js:498-512`, `agent/llm.js:176-248`

LLM responses are accepted without quality filtering beyond schema validation:

- `validateAction()` (`agent/actions.js:56-69`) only checks that required parameters exist and are the right type. It does not check if the action makes sense in context (e.g. `craft diamond_pickaxe` with no diamonds in inventory).
- No self-review: the LLM is not asked to critique its own proposed action before executing.
- No confidence threshold: all tool calls are executed regardless of the quality of reasoning.
- Fallback actions default to `{ type: 'wait' }` (line 237 in `llm.js`), which then fails `validateAction` because `wait` was removed from `VALID_ACTIONS`. This causes `logWarn('No action parsed — defaulting to wait')` and returns `null` — the tick is skipped entirely rather than taking a safe default action like `eat` or `mine oak_log`.

The `reason` field injected into every tool (lines 244-248 in `tools.js`) is a 5-word display string for viewers, not genuine reasoning. The actual reasoning is the `<think>` content, which is extracted but never validated for coherence.

---

## 4. STRUCTURAL ISSUES

### Open-Ended Mode: getActiveSkill Returns Wrong Type (Bug)

**Files:** `agent/skills.js:140-146`, `agent/index.js:439, 456`

In `open_ended` mode, `getActiveSkill()` returns `generalSkills[0].content` — a raw string. In `phased` mode it returns `{ name, content }`. The caller in `index.js` always uses `activeSkill?.content || ''`, which works in phased mode but returns `undefined` in open-ended mode (since a string has no `.content` property). Skills are silently never injected into prompts for any open-ended agent.

**Fix approach:** Line 146 of `skills.js` should return `{ name: generalSkills[0].name, content: generalSkills[0].content }` to match the phased return shape.

### MOD_URL Declared Three Times in index.js

**Files:** `agent/index.js:368, 528`, `agent/actions.js:3`, `agent/state.js:3`

`MOD_URL` is read from `process.env.MOD_URL` as a local `const` inside two separate `if` blocks in `index.js` (lines 368 and 528), in addition to the module-level constant in `actions.js:3` and `state.js:3`. A configuration change to MOD_URL would need to be verified in all four locations. The two in-function declarations in `index.js` should use the module-level constant from `actions.js` or be extracted.

### wait Action — Inconsistency Between VALID_ACTIONS and ACTION_SCHEMAS

**Files:** `agent/actions.js:5-12, 43`

`wait` is removed from `VALID_ACTIONS` (line 12 comment: "deliberately removed") but is still present in `ACTION_SCHEMAS` (line 43). When `llm.js` defaults to `{ type: 'wait' }` as a fallback (line 237), `validateAction` returns `{ valid: false, error: 'unknown action type: wait' }`, causing the tick to log an error and return null rather than taking any action. This is probably the intended behavior but the schema entry for `wait` is dead code that creates confusion.

### pinned context system — Correct But Has No Auto-Write Mechanism

**Files:** `agent/prompt.js:16-42`, `agent/index.js:443-444`

`loadPinnedContext(dataDir)` is implemented correctly. It reads `dataDir/context/*.md` files on every tick and injects them into the system prompt, so they survive all history wipes. This is the right architecture for persistent task planning.

**However:** There is no tool the agent can use to write files to `dataDir/context/`. The notepad tool (`agent/index.js:194-203`) writes to `notepad.txt`. There is no `context_write` tool. Pinned context must be created manually by the operator. The agent cannot self-populate its pinned context as a planning document. The system is correct but incomplete.

### Hardcoded accessToken=0 and userType=legacy in Client Launch

**Files:** `launch-client.sh:155-156`

```bash
--accessToken 0 \
--userType legacy \
```

This is required for offline-mode servers and is intentional, but means any change to server auth (`online-mode=true`) would break all clients silently.

### autoConnectAttempted Never Resets on Disconnect

**Files:** `mod/src/main/java/hermescraft/HermesBridgeMod.java:27, 88-102`

`autoConnectAttempted` is set to `true` on the first connection attempt and only reset to `false` if the connect throws an exception (line 101). If the player successfully connects but is later kicked by the server (e.g. server restart), `client.player` goes to `null` but `autoConnectAttempted` remains `true`. The mod will never attempt to reconnect. The agent process will keep running but every `/state` call will return `{"error":"Not in game"}` and every tick will fail with "Failed to fetch game state."

**Fix approach:** Reset `autoConnectAttempted = false` in the tick handler when `client.player == null` after previously being non-null. Or add a disconnect event listener.

### HTTP API Has No Authentication

**Files:** `mod/src/main/java/hermescraft/HttpServer.java:20`

The API binds to `0.0.0.0` with no authentication. Any process on the machine (or any machine on the same network if firewall is open) can send arbitrary `/action` commands to control the Minecraft client — chat as the bot, navigate, attack players, etc. For a local dev setup this is acceptable. For the Glass deployment described in `.hermes.md` where the server is accessible via Cloudflare, this is a security risk if port 3001 is ever exposed.

---

## 5. PERFORMANCE ISSUES

### buildNearbyBlocks — O(n³) Loop Every 20 Ticks

**Files:** `mod/src/main/java/hermescraft/StateReader.java:365-391`

The block scan iterates a 17x17x17 cube (4,913 iterations) every 20 ticks (1 second). Each iteration calls `world.getBlockState(pos)` which involves chunk lookups. At 16x17 = 5000+ lookups per second, this is a significant client-thread load. For multi-agent deployments (10 bots per `launch-agents.sh`), this multiplies accordingly.

**Improvement path:** Cache block positions between updates. Only re-scan when the player moves more than 4 blocks. Or reduce radius from 8 to 6.

### Pipeline Double-LLM-Call Per Sustained Action Tick

**Files:** `agent/index.js:616-632`

When a sustained action (`mine`, `navigate`, `break_block`) succeeds, the agent immediately fires a second LLM call to precompute the next action. With a 120-second timeout and Hermes-4.3-36B at ~15 tok/s, two LLM calls back-to-back double the latency burden. If the model is under load, the pipeline call may timeout and be silently ignored (line 629: `catch { }` with no logging), wasting the attempt with no error visibility.

---

## 6. FRAGILE AREAS

### Death Detection on First Tick — False Positive Risk

**Files:** `agent/state.js:155-165`

```js
// First tick ever with health 0 — likely death screen on startup
if (stateHistory.length === 1 && state.health !== undefined && state.health <= 0) return true;
```

If the agent starts while the client is on the death screen (e.g. player died before agent connected), the first state read has `health=0` and `stateHistory.length=1`, triggering a death. `recordDeath` is called, incrementing `totalDeaths`, writing a death entry to session log, and sleeping 5 seconds. This is a false positive — the death happened before the session. Cumulative death counts and "lesson" records are polluted.

### Stuck Detection — failureTracker Keyed on Action Type+Args, Not Outcome

**Files:** `agent/index.js:72-80, 82-88`

The failure tracker counts consecutive failures of the same action key (e.g. `navigate@10,64,20`). It clears on any success. But `getStuckInfo()` returns the first entry exceeding `MAX_STUCK_COUNT=2`, and on detection clears that entry only (line 413: `failureTracker.delete(stuckInfo.action)`). This means if an agent is stuck on two different actions alternately (A fails, B fails, A fails, B fails), neither reaches count 2 in sequence and the stuck detector never fires.

### Chat Response Loop — Stale Messages Trigger Every 3 Ticks

**Files:** `agent/index.js:366-407`

The `/chat` endpoint returns the last 20 messages from a ring buffer that is never cleared on read. Every `CHAT_CHECK_INTERVAL=3` ticks, the agent reads the chat buffer. If a player said anything in the last 20 messages, `playerChatContext` is set and injected into the prompt, causing the LLM to process those messages again. This creates a low-grade continuous "respond to player messages" stimulus even for messages that were addressed hours ago. There is no timestamp filtering or "already responded" deduplication.

**Impact:** The agent spends tokens every 6 seconds re-processing old player chat even when no one is talking.

### Multi-Agent Shared Mods Directory

**Files:** `launch-client.sh:132`

```bash
MODS_DIR="$MC_DIR/mods"
```

All bots in `launch-agents.sh` share `~/.minecraft/mods/`. A mod update affects all running clients simultaneously. No per-bot mod isolation.

---

## 7. MISSING FEATURES

### No Vision / Screenshot Capability

There is no screenshot capture, no image feed from the Fabric client, and no vision model integration. The agent operates entirely from structured JSON state. Complex visual information (terrain layout, structure detection, player positions relative to the environment) is not available. The `StateReader` captures crosshair target and nearby blocks but cannot convey visual context like "there's a mountain blocking the path" or "I see a village in the distance."

### Dragon Fight Completion Cannot Be Detected

**Files:** `agent/goals.js:315-320`

```js
completionCheck(state) {
  // Dragon defeated — hard to detect, but XP jump or achievement
  return false; // Must be manually detected
},
```

Phase 7 (Dragon Fight) never completes. The agent runs forever in Dragon Fight mode after reaching it. XP level jump on dragon death could be detected by comparing `state.experience.level` between ticks, but this is not implemented.

### No Mechanism for Agent to Create Pinned Context Files

**Files:** `agent/prompt.js:16-42`, `agent/tools.js`

The pinned context system is correctly implemented in `loadPinnedContext()` but there is no tool for the agent to write to `dataDir/context/`. The notepad is limited to 2000 characters and is overwritten on each write. Pinned context is the right home for multi-session task plans but requires human intervention to populate.

### No Multi-Agent Coordination

**Files:** `launch-agents.sh`, `agent/social.js`

`launch-agents.sh` can spawn 10 bots, but each agent runs fully independently. There is no shared memory, no task assignment, no way for one agent to tell another "I'm mining at X, don't go there." `social.js` tracks player relationships but only handles human players — there is no bot-to-bot communication channel.

---

## 8. TECH DEBT

### mineflayer and ws in package.json — Unused Dependencies

**Files:** `package.json:13-16`

`mineflayer` (^4.35.0) and `ws` (^8.16.0) are listed as dependencies but are not imported anywhere in the agent codebase. These are likely leftover from a prior architecture (direct bot control vs. the current HTTP bridge approach). They add ~20MB to the install and can be removed.

### Skill Success Rate Initialized to 1.0 — Misleading Metric

**Files:** `agent/skills.js:312`

New skills are created with `success_rate: "1.0"`. The first failure drops it to 0.9 (line 269). This means skills always start at maximum confidence, which misrepresents the actual success rate on first use. A skill created on a lucky first completion looks identical to one that has been mastered over many runs.

### parseResponseFallback — Complex Regex on Untrusted Input

**Files:** `agent/llm.js:291-368`

The fallback text parser has multiple nested regex attempts with silent `catch {}` blocks. It handles Hermes XML format, REASONING:/ACTION: format, and generic JSON. This is maintenance-heavy and the behavior when all formats fail is to return `{ reasoning, action: null }` which propagates to a `logWarn('No action parsed')` and tick skip. The fallback path is increasingly irrelevant since native tool calling works, but removing it would break the `useToolCalling = false` degraded mode.

### Dragon Fight Phase: completionCheck Always Returns False

**Files:** `agent/goals.js:315-320`

Noted above under Missing Features, but also a tech debt item: the final phase of the entire game loop has a `// Must be manually detected` comment and returns `false` unconditionally. The game never ends.

---

## 9. DEPLOYMENT / ENVIRONMENT CONCERNS

### .hermes.md Documents a 1.21.11 Deployment Incompatible with Repo Code

**Files:** `.hermes.md:41-43`

The `.hermes.md` project context describes a Glass server deployment targeting MC 1.21.11. The repo's `build.gradle` targets MC 1.21.1. On 1.21.11, per `.hermes.md`:
- No Baritone (latest Baritone only supports 1.21/1.21.1)
- Crafting disabled (client recipe API removed in 1.21.11)
- `RecipeLookup.java` uses `recipeManager.values()` (line 76) which was removed in 1.21.11

This means the Glass deployment requires a separate, diverged build. The divergence is undocumented in code — there is no `1.21.11` branch or config flag. The repo code and the production deployment are out of sync.

### launch-agents.sh Hardcodes MiniMax M2.7 as Default Model

**Files:** `launch-agents.sh:33-34`

```bash
VLLM_URL="${VLLM_URL:-https://api.minimaxi.chat/v1}"
MODEL_NAME="${MODEL_NAME:-MiniMax-M2.7-highspeed}"
```

The default model in the multi-agent launcher is MiniMax, while the `.env.example` and all agent defaults assume `Doradus/Hermes-4.3-36B-FP8` on a local vLLM server. Running `./launch-agents.sh` without env overrides will attempt to call the MiniMax API with no key, fail silently (key check on line 40 would catch missing key), but the URL mismatch is a source of confusion.

---

*Concerns audit: 2026-03-20*
