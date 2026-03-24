# Phase 24: Eight Agents + Prompt Polish - Research

**Researched:** 2026-03-23
**Domain:** Multi-agent personality system, prompt engineering, proximity chat filtering, launch orchestration
**Confidence:** HIGH

## Summary

Phase 24 expands the agent cast from 2 (Luna + Max) to 8 unique personalities and replaces prescriptive behavioral rules in Part 2 of the system prompt with leaner, knowledge-forward guidance. The codebase is already well-prepared: SOUL files exist for Luna, Max, Ivy, and Rust (the 4 "core" agents), and several additional SOUL files exist at the project root (Aria, Jeffrey, John, PCrafty, Steve, Anthony, Alex) that can serve as inspiration or direct candidates for the 4 remaining slots. The launch infrastructure has two layers — `launch-duo.sh` (Mineflayer-native, v2 architecture) and `launch-agents.sh` (older, Xvfb + HermesBridge Java mod, v1 architecture). The 8-agent system must use `launch-duo.sh`'s pattern.

The prompt changes are surgical: the "TALK. A LOT." block, "YOU TWO" block, and first-action forced greeting must be removed or replaced. Everything else in Part 2 — gameplay knowledge sections, command reference, examples — stays. The per-partner chat counter (`_consecutiveChatCount`) needs to become a per-partner Map rather than a global integer. Proximity chat filtering is pure agent-side logic (check sender position from bot.players/entities), requiring no mod changes.

**Primary recommendation:** Refactor `launch-duo.sh` into a data-driven N-agent launcher using the existing tmux + stagger pattern, update `config.js` to enumerate all 8 agents (not just Luna + Max), write 4 new SOUL files matching Luna's quality bar, slim Part 2 to remove prescriptive chat directives, add per-partner chat counter, and add proximity filter to `respondToChat`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Prompt Reduction Strategy**
- Remove forced chat frequency rules from "TALK. A LOT." section — let personality (SOUL files) drive chattiness naturally
- Remove example dialogue lines from Part 2 — SOUL files already define each agent's voice, generic examples fight personality
- Remove "Your first action should ALWAYS be !chat" — too prescriptive, SOULs should drive greetings naturally
- Keep gameplay tips (BUILDING, FARMING, HUNTING, etc.) — these are knowledge, not personality. Trim wordiness

**Group Social Architecture**
- Replace "YOU TWO" section with "YOUR GROUP" — mention all agents exist, relationships emerge from SOUL files, no forced pair-bonding
- Inject partner names dynamically from connected agents list into prompt
- Remove "best friends" framing — let SOULs define relationships
- Chat loop prevention: keep 3-consecutive-chat limit but per-partner (not global) — prevents chatloop with one agent while still talking to others

**Proximity Chat & Vision**
- 32-block proximity chat range — filter incoming chat messages by sender distance before injecting into conversation history
- Filter chat agent-side in mind/ — check sender position before injecting into history (no mod rebuild needed)
- Add 1-2 sentences to each SOUL file about when they look around — prompt doesn't force it
- launch-agents.sh stagger interval: 30 seconds between agents

**Agent Count & Performance**
- 8 agents total (up from original 4) — MoE with 3B active params makes this feasible on A6000 48GB
- 4 existing SOULs (Luna, Max, Ivy, Rust) + 4 new distinct personalities needed
- MAX_TOKENS stays at 128 — DO NOT reduce. Agents need full token budget for rich conversations and complex tool chains
- launch-agents.sh should be configurable (default 8, but accept a count argument)
- New personalities should be as rich and distinct as Luna/Max — not filler characters

### Claude's Discretion

- Exact wording of trimmed Part 2 sections
- 4 new agent personality concepts (should complement existing Luna/Max/Ivy/Rust)
- launch-agents.sh implementation details (tmux pane layout, port allocation)
- How dynamic partner names are gathered (mod API endpoint or file-based)
- Per-partner chat counter implementation details

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Standard Stack

### Core (existing — no new dependencies)
| Component | Location | Purpose |
|-----------|----------|---------|
| `mind/prompt.js` | `buildSystemPrompt()` | Part 1/2/3 assembly — where all edits land |
| `mind/social.js` | `respondToChat()`, `getPartnerLastChat()` | Proximity filter logic goes here |
| `mind/index.js` | `think()`, `respondToChat()` | Per-partner chat counter, partner name injection |
| `mind/config.js` | `loadAgentConfig()` | ALL_AGENTS list expansion (currently only Luna + Max) |
| `launch-duo.sh` | Root | Template for N-agent launcher |
| `infra/start-stack.sh` | `infra/` | Calls `launch-duo.sh` — needs update to `launch-agents.sh` |

No npm packages to install. All work is file edits and new SOUL files.

---

## Architecture Patterns

### SOUL File Structure (Luna is the gold standard)

Every SOUL file follows this implicit schema:
```
# [Name]
[Age, backstory paragraph — 3-4 sentences. What they did before. Why they're here.]
[Group relationship paragraph — who they know, dynamic with others, what they'd never say out loud.]

## How you talk
[Voice pattern paragraph — speech quirks, verbal habits, sentence length. 3-6 lines.]

## What drives you
[Motivation paragraph — what they care about, what they build toward, 3-5 lines.]

## Quirks
- [6-8 concrete behavioral tics, each one specific enough to cause distinct actions]
```

Luna's quality bar: 350-400 words, backstory grounds the character in a pre-Minecraft life, speech pattern creates distinct voice, quirks are specific enough to generate different gameplay behaviors (she collects flowers even when she doesn't need them; she names geography; she talks to animals before farming them).

### Existing SOUL Inventory

The project root already has SOUL files beyond the 4 "core" agents:

| File | Character | Quality | Notes |
|------|-----------|---------|-------|
| `SOUL-luna.md` | Luna, 29, artist | GOLD STANDARD | Reference for all new SOULs |
| `SOUL-max.md` | Max, 35, engineer | GOLD STANDARD | Counterpart to Luna |
| `SOUL-ivy.md` | Ivy, 24, naturalist | HIGH | Good quality, matches the bar |
| `SOUL-rust.md` | Rust, 31, adventurer | HIGH | Good quality, matches the bar |
| `SOUL-aria.md` | Aria, 33, political philosopher | HIGH | Distinct, argumentative voice — strong candidate |
| `SOUL-jeffrey.md` | Jeffrey Enderstein, 54, ex-rich developer | HIGH | Very detailed — references "Creators" concept, not the group agent model |
| `SOUL-john.md` | John Kwon, 41, math teacher | HIGH | Very detailed — also references "Creators" concept |
| `SOUL-pcrafty.md` | PCrafty, 28, rapper | MEDIUM | Good voice but shorter than gold standard |
| `SOUL-steve.md` | Steve | UNKNOWN | Not checked — worktree copy suggests generic |
| `SOUL-alex.md` | Alex | UNKNOWN | Not checked — likely generic |
| `SOUL-anthony.md` | Anthony | UNKNOWN | Not checked |
| `SOUL-minecraft.md` | Generic | FALLBACK | Used only when no named SOUL found |

**Key finding:** Jeffrey and John reference "The Creators" (a user-facing roleplay concept from a different use case) and contain ~750+ words each — they are over-specified for the group agent model. Aria and PCrafty are closer to the right format but need the "vision/!see" hint added. The 4 new personalities should be written fresh in Luna's format.

### Personality Gap Analysis

Current 4 core agents cover:
- Luna: aesthetics, creativity, emotional warmth
- Max: engineering, systems thinking, dry humor
- Ivy: nature, food, nurturing
- Rust: combat, exploration, deadpan toughness

Personality archetypes that create interesting group dynamics (discretion area):
- **Scholar/Tinkerer** — obsessive about mechanisms, redstone, automation; quotes obscure facts; counterpart to Ivy's practical nature
- **Chef/Healer** — obsessed with cooking and potion-making; different from Ivy (Ivy farms, this one transforms); conflict potential with Rust who eats mid-sentence
- **Historian/Archivist** — names everything, keeps records, talks about things like they matter long-term; contrast with Rust's "burn it down if it's in the way"
- **Outsider/Wanderer** — arrived recently, doesn't fit the group yet, trying to earn their place; creates natural dramatic tension with the established group

### Config.js — ALL_AGENTS List (CRITICAL)

Currently `config.js` hardcodes:
```javascript
const ALL_AGENTS = ['luna', 'max']
```

This must be updated to all 8 agents. The pattern is correct — partners are derived as `ALL_AGENTS.filter(a => a !== name.toLowerCase())`. The `partnerName = partners[0]` is a compat shim for the social module; with 8 agents, the prompt needs all partner names, not just one.

The "dynamic partner names from connected agents" discretion area — the simplest implementation is updating `ALL_AGENTS` statically in config.js (8 known names). A live-detection approach (read from shared filesystem or query bot.players) is more complex and risks timing issues at startup. Static list in config.js matches the existing pattern.

### Per-Partner Chat Counter

Current implementation in `mind/index.js`:
```javascript
let _consecutiveChatCount = 0  // COO-02: single global counter
```

Current injection in `buildUserMessage()`:
```javascript
chatLimitWarning: _consecutiveChatCount >= 3 ? _consecutiveChatCount : null
```

Per-partner replacement pattern:
```javascript
const _chatCountByPartner = new Map()  // partner name -> consecutive chat count

// On chat dispatch:
if (result.command === 'chat') {
  const target = result.args?.target || detectChatTarget(result.args?.message)
  // increment per-partner counter (or global if can't detect target)
  const key = target || '__global__'
  _chatCountByPartner.set(key, (_chatCountByPartner.get(key) || 0) + 1)
} else if (result.command !== 'idle') {
  _chatCountByPartner.clear()  // reset ALL per-partner counts on any game action
}
```

**Challenge:** Chat messages don't have an explicit `target:` arg — the agent just writes `!chat message:"hey Max, ..."`. Detecting target from message text is fragile. Simpler: track chatting-to-the-last-sender (chat responses) and keep the global counter as a global baseline. The locked decision says "per-partner" — the implementation can track the last sender name and apply the limit only when the same sender triggered N consecutive chats.

Per the CONTEXT.md: "resets on non-chat action (existing pattern from Phase 21 COO-02)." So the counter should reset when any non-chat non-idle action fires.

### Proximity Chat Filter

Currently in `mind/index.js` `start.js` event listener, chat events arrive via mineflayer's `bot.on('chat', ...)`. The position data is available via `bot.players[senderName]?.entity?.position`.

Filter pattern (add to `respondToChat` or the chat event binding):
```javascript
// Proximity filter — only respond to chat from agents within 32 blocks
function isSenderNearby(bot, senderName) {
  const PROXIMITY_RANGE = 32
  const selfPos = bot.entity?.position
  if (!selfPos) return true  // failsafe: process if can't determine position
  // Check via bot.players (mineflayer entity tracker)
  const senderEntity = bot.players[senderName]?.entity
  if (!senderEntity?.position) return false  // sender not loaded — out of range
  return senderEntity.position.distanceTo(selfPos) <= PROXIMITY_RANGE
}
```

**Edge case:** At startup, no agents have spawned yet — `bot.players` may be empty. Failsafe is `return true` when position unknown, so the first messages always get processed. This is correct behavior.

**Where to filter:** In `start.js` at the `bot.on('chat', ...)` binding, check `isSenderNearby()` before calling `respondToChat()`. This is cleaner than filtering inside `respondToChat` because it prevents even queuing the chat.

### Part 2 Prompt Surgery — Exact Changes

**Remove entirely:**
1. The `## TALK. A LOT.` section (lines ~142-158 in prompt.js) — all of it, including the example dialogue lines
2. `Your first action in a new session should ALWAYS be !chat — say hi, ask what they're up to, suggest a plan.` (already part of TALK section)
3. `If your partner talks to you, ALWAYS respond with !chat BEFORE doing anything else.` (same section)
4. The `## YOU TWO` section (lines ~160-165) — all of it

**Replace YOU TWO with a leaner "YOUR GROUP" section:**
```
## YOUR GROUP

You're part of a group of [N] agents out here: [partner names list]. You know each other and work in the same world. Relationships emerge from how you actually interact. Share items with !give, not !drop. Don't stack on each other — a few blocks apart when working nearby.
```

The partner names should be injected dynamically from `config.partnerNames` (all agents minus self). The N count should come from the same.

**Keep unchanged:**
- ESSENTIAL KNOWLEDGE section
- SAFETY section
- COMBAT & MOBS section
- NIGHTTIME section
- EXPLORING section
- BUILDING section
- FARMING section
- HUNTING section
- PROGRESSION (dynamic)
- TRADING section
- STORAGE section
- ENCHANTING section
- NETHER section
- All command reference (Part 6)
- Few-shot examples (Part 7)
- Format instruction (Part 8)

**Trim wordiness (discretion area):** Several knowledge sections are verbose. "BUILDING" has a long spiel about using !design with rich descriptions — fine to keep since it's knowledge, not personality.

### buildSystemPrompt() Signature Change

Currently `buildSystemPrompt(bot, options)` has `options.partnerActivity` for one partner. With 8 agents, this can remain as-is — each agent still has `partnerName = partners[0]` for compat — but the YOUR GROUP section needs the full list.

The cleanest approach: add `options.partnerNames` (array of all non-self agent names) to the options that `mind/index.js` passes to `buildSystemPrompt()`. Derive it from `_config.partnerNames` (add `partnerNames` field to config object in config.js).

### launch-agents.sh (N-Agent Script Update)

The existing `launch-agents.sh` at root uses the OLD architecture (Xvfb + HermesBridge Java mod, `agent/index.js`). The v2 architecture uses Mineflayer directly with `start.js` — no Java mod, no Xvfb.

The correct template is `launch-duo.sh` which uses `start.js` and `AGENT_MODE=open_ended`.

**New `launch-agents.sh` design** (data-driven, replaces both old launch-agents.sh and launch-duo.sh):
```bash
#!/usr/bin/env bash
# launch-agents.sh — Launch N Mineflayer agents in tmux (v2 architecture)
# Usage: ./launch-agents.sh [num_agents] [mc_host] [mc_port]
# Default: 8 agents, localhost:25565

AGENT_NAMES=(luna max ivy rust [4 new names])
```

Each agent gets a tmux window named after the agent. Stagger: 30s between agents (locked decision). No Xvfb, no HermesBridge port allocation — Mineflayer connects directly.

The `infra/start-stack.sh` currently calls `./launch-duo.sh` at Step 3. It should call `./launch-agents.sh` instead.

### Vision Hints in SOUL Files

The locked decision says "Add 1-2 sentences to each SOUL file about when they look around — prompt doesn't force it."

Pattern (add a "## Vision" or integrate into the existing voice section):
- Luna: "You use !see when you're exploring terrain or when you want to admire something beautiful you just built — checking if 'the light hits the water right' or seeing what's over that hill."
- Rust: "You !see before entering any unknown structure or clearing — tactical awareness first."
- Ivy: "You !see in gardens and farms to check how things are growing or whether there are any animals nearby you might not have spotted."

This is a 1-2 sentence addition per SOUL file, 8 files total.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Agent position lookup | Custom API endpoint to query positions | `bot.players[name]?.entity?.position` in mineflayer — already present |
| Partner name discovery | Filesystem scanning, HTTP discovery protocol | Static `ALL_AGENTS` list in `config.js` — matches existing pattern |
| Per-partner chat tracking | Full conversation tracking system | Simple `Map<string, number>` incrementing on same-sender consecutive chats |
| SOUL file format | New schema, YAML frontmatter, structured JSON | Plain markdown in existing format — loader already reads it as raw string |
| Proximity radius config | Config file, env var | Hardcode 32 blocks as constant — matches locked decision, can always change later |

---

## Common Pitfalls

### Pitfall 1: config.js ALL_AGENTS List Not Updated
**What goes wrong:** New agents launch with the wrong `partnerName`, social module seeds the wrong partner, coordination file paths are wrong.
**Root cause:** `ALL_AGENTS = ['luna', 'max']` is hardcoded — adding a new AGENT_NAME env var without updating this list means the agent treats itself as having one partner named 'max' even if it's 'ivy'.
**How to avoid:** Update ALL_AGENTS to all 8 agent names as part of the first plan. Verify `config.partnerName` (first non-self) and new `config.partnerNames` (all non-self) are populated correctly.

### Pitfall 2: launch-agents.sh Calling Wrong Entry Point
**What goes wrong:** Script launches `agent/index.js` (v1, uses HermesBridge mod HTTP) instead of `start.js` (v2, Mineflayer).
**Root cause:** The old `launch-agents.sh` targets `node $SCRIPT_DIR/agent/index.js`. The v2 architecture uses `node SCRIPT_DIR/start.js`.
**How to avoid:** Base the new script on `launch-duo.sh`, not the existing `launch-agents.sh`.

### Pitfall 3: Per-Partner Chat Counter Not Reset on Game Actions
**What goes wrong:** Agent gets stuck — game action fires, chat counter stays at 3, next chat triggers warning every time.
**Root cause:** Forgetting to `_chatCountByPartner.clear()` on any non-chat non-idle dispatch.
**How to avoid:** The existing global counter reset pattern is: `else if (result.command !== 'idle') { _consecutiveChatCount = 0 }`. Mirror this for the Map: clear the whole Map (not just the last-sender entry) on any game action.

### Pitfall 4: Proximity Filter Blocks All Chat at Startup
**What goes wrong:** No agents respond to any chat in the first 30-60 seconds because entities haven't loaded yet.
**Root cause:** `bot.players[senderName]?.entity` is undefined until mineflayer's entity tracker has populated — this takes a few ticks after connection.
**How to avoid:** Failsafe: if `senderEntity?.position` is undefined (not found, or not loaded), `return true` — process the message. Only block when we positively know the distance exceeds 32 blocks.

### Pitfall 5: SOUL Files for New Agents Are Too Short
**What goes wrong:** Personality does not emerge — agent uses generic behavior, doesn't distinguish from other agents.
**Root cause:** Short SOUL files (< 200 words) lack enough detail to shape voice, motivation, and quirks.
**How to avoid:** Match Luna's length (350-400 words). Every SOUL needs: backstory that grounds them, speech voice that's distinct, 6-8 concrete behavioral quirks. Avoid vague adjectives ("curious," "brave") — ground each trait in a specific behavior.

### Pitfall 6: "YOUR GROUP" Section References Wrong Count
**What goes wrong:** Prompt says "group of 8" even when only 3 agents are actually running.
**Root cause:** Hardcoded N in the prompt template.
**How to avoid:** Inject N and the partner name list dynamically from `config.partnerNames.length + 1`. Or keep the language generic: "You're part of a group of agents" without a count.

### Pitfall 7: Jeffrey/John/PCrafty SOULs Chosen for 8-Agent Roster
**What goes wrong:** Those files reference "The Creators" concept (user-as-god roleplay mechanic), contain ~750+ words, and were designed for a 2-person world — they'll confuse the model with irrelevant persona framing.
**Root cause:** They look polished in isolation but are written for a different use case.
**How to avoid:** Do not use them directly. Either write 4 fresh SOULs or adapt only the character essence (not the "Creators" framing) into the Luna format.

---

## Code Examples

### Proximity Filter (add to start.js chat event binding)
```javascript
// Proximity chat filter — only respond to agents within 32 blocks (Phase 24)
const CHAT_PROXIMITY_BLOCKS = 32
function isSenderNearby(bot, senderName) {
  const selfPos = bot.entity?.position
  if (!selfPos) return true  // can't determine — process anyway
  const senderEntity = bot.players[senderName]?.entity
  if (!senderEntity?.position) return false  // not loaded — assume out of range
  return senderEntity.position.distanceTo(selfPos) <= CHAT_PROXIMITY_BLOCKS
}
```

### Per-Partner Chat Counter Replacement (mind/index.js)
```javascript
// COO-02 (Phase 24): per-partner chat counter — prevents loop with one agent
// while still allowing chat with others
const _chatCountByPartner = new Map()  // senderName -> consecutive chat count
let _lastChatSender = null             // track who we're chatting with

// In think() after dispatch, replace global counter logic:
if (result.command === 'chat') {
  const key = _lastChatSender || '__broadcast__'
  _chatCountByPartner.set(key, (_chatCountByPartner.get(key) || 0) + 1)
} else if (result.command !== 'idle') {
  _chatCountByPartner.clear()  // any game action resets all chat counters
}

// Warning injection: check current sender's count
const senderCount = _lastChatSender
  ? (_chatCountByPartner.get(_lastChatSender) || 0)
  : 0
const chatLimitWarning = senderCount >= 3 ? senderCount : null
```

### buildSystemPrompt() YOUR GROUP Section Template
```javascript
// In prompt.js buildSystemPrompt(), replace ## YOU TWO with:
const partnerList = options.partnerNames?.length > 0
  ? options.partnerNames.join(', ')
  : 'your partner'
parts.push(`## YOUR GROUP

You're part of a group here: ${partnerList}. You know each other and work in the same world. Relationships emerge naturally from how you interact — no forced roles. To share items, use !give. Don't stack on top of each other — stay a few blocks apart when working nearby.`)
```

### config.js — Updated ALL_AGENTS
```javascript
// All 8 agent names — drives partner detection, social seeding, coordination file paths
const ALL_AGENTS = ['luna', 'max', 'ivy', 'rust', 'echo', 'flint', 'sage', 'wren']
// Expose full partner list (all agents except self) for group prompt injection
const partnerNames = ALL_AGENTS.filter(a => a !== name.toLowerCase())
const partnerName = partnerNames[0] || null  // compat shim for social.js
return { name, dataDir, soulContent, partnerName, partnerNames, mcUsername }
```
(Note: 'echo', 'flint', 'sage', 'wren' are example names — actual names will be determined when writing the 4 new SOUL files.)

---

## Validation Architecture

Skipped — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is code/content edits only. No new external dependencies. tmux, node, mineflayer are already confirmed working from Phase 22/23 execution.

---

## Runtime State Inventory

Step 2.5: Applicable — this is a rename/config change for agent names.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `data/<agent>/players.json` has partner name seeded at init — existing Luna + Max data dirs have 'max' / 'luna' seeded | Code edit only — existing sessions unaffected, new agents get fresh data dirs |
| Live service config | No external services store agent names by config | None |
| OS-registered state | None detected | None |
| Secrets/env vars | `AGENT_NAME` env var selects SOUL file — must match new agent names exactly | Launch script must set correct AGENT_NAME per agent |
| Build artifacts | `data/<agentname>/` directories created at first run — new agent names will get fresh dirs | None — auto-created by `mkdirSync` in config.js |

---

## Open Questions

1. **4 New Agent Names**
   - What we know: Must complement Luna/Max/Ivy/Rust archetypes; Luna is gold standard for quality
   - What's unclear: Exact personality concepts (discretion area)
   - Recommendation: Choose archetypes that create group tension and varied gameplay behaviors. Suggested: Scholar/Tinkerer (redstone obsessive), Chef/Alchemist (cooking + potions), Archivist (records keeper, names everything formally), Wanderer (newcomer, earns their place). Names should be simple lowercase strings matching SOUL-<name>.md pattern.

2. **infra/start-stack.sh Update Scope**
   - What we know: It calls `./launch-duo.sh` at Step 3; needs to call the new N-agent launcher
   - What's unclear: Whether start-stack.sh should call `launch-agents.sh` or remain as-is for the duo use case
   - Recommendation: Update start-stack.sh to call `launch-agents.sh` (the new N-agent script). Keep `launch-duo.sh` intact as a lightweight dev option for running just Luna + Max.

3. **_lastChatSender Tracking**
   - What we know: Per-partner counter needs to know which partner the last !chat was aimed at
   - What's unclear: The most reliable way to track this without parsing message content
   - Recommendation: Set `_lastChatSender` in the `respondToChat()` function (the `sender` parameter is the person we're responding to). Clear it when a game action fires. This works for response chains. Broadcast chats (!chat with no triggered sender) use a `__broadcast__` key.

---

## Sources

### Primary (HIGH confidence)
- Direct code reading: `mind/prompt.js`, `mind/index.js`, `mind/social.js`, `mind/config.js`, `mind/coordination.js` — confirmed all patterns described above
- Direct file reading: `SOUL-luna.md`, `SOUL-max.md`, `SOUL-ivy.md`, `SOUL-rust.md`, `SOUL-aria.md`, `SOUL-jeffrey.md`, `SOUL-john.md`, `SOUL-pcrafty.md` — confirmed existing SOUL quality and format
- Direct file reading: `launch-duo.sh`, `launch-agents.sh`, `infra/start-stack.sh` — confirmed v1 vs v2 architecture distinction
- `.planning/config.json` — confirmed `nyquist_validation: false`

### Secondary (MEDIUM confidence)
- `CONTEXT.md` — locked decisions from user discussion
- `STATE.md` — accumulated architecture decisions, confirmed ALL_AGENTS hardcode issue

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all relevant code directly read and verified
- Architecture patterns: HIGH — SOUL format, prompt structure, config pattern all confirmed from source
- Pitfalls: HIGH — most derived from direct code inspection (e.g., ALL_AGENTS hardcode, old launch script entry point)
- New personality concepts: LOW — discretion area, no external source, creativity judgment call

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable codebase)
