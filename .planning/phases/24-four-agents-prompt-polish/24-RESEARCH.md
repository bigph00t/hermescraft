# Phase 24: Four Agents + Prompt Polish - Research

**Researched:** 2026-03-23
**Domain:** Node.js agent configuration, tmux multi-process management, proximity chat filtering, prompt engineering
**Confidence:** HIGH

## Summary

Phase 24 is a configuration and wiring phase — no new algorithms, no new npm packages, no new architectural patterns. The work is: expand from 2 agents to 4, reduce prompt prescriptiveness so SOUL files drive behavior, add proximity filtering to chat injection, and update the per-partner chat counter. All changes are in files that already exist and follow patterns already established.

The four SOUL files (Luna, Max, Ivy, Rust) are complete and production-quality. `config.js` already has SOUL file discovery via `AGENT_NAME → SOUL-{name}.md`. `launch-duo.sh` is the exact template for `launch-quad.sh`. The `_consecutiveChatCount` variable in `mind/index.js` is the global chat counter that must become per-partner. Chat filtering belongs in the `messagestr` handler in `mind/index.js` where sender position can be checked against bot position.

**Primary recommendation:** Four discrete plans — (1) SOUL + config expansion, (2) prompt Part 2 rewrite, (3) proximity chat filter, (4) launch-quad.sh + start-stack.sh update.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Remove forced chat frequency rules from "TALK. A LOT." section — let personality (SOUL files) drive chattiness naturally
- Remove example dialogue lines from Part 2 — SOUL files already define each agent's voice, generic examples fight personality
- Remove "Your first action should ALWAYS be !chat" — too prescriptive, SOULs should drive greetings naturally
- Keep gameplay tips (BUILDING, FARMING, HUNTING, etc.) — these are knowledge, not personality. Trim wordiness
- Replace "YOU TWO" section with "YOUR GROUP" — mention all agents exist, relationships emerge from SOUL files, no forced pair-bonding
- Inject partner names dynamically from connected agents list into prompt
- Remove "best friends" framing — let SOULs define relationships (Luna/Max are close but Ivy/Rust have their own dynamics)
- Chat loop prevention: keep 3-consecutive-chat limit but per-partner (not global) — prevents chatloop with one agent while still talking to others
- 32-block proximity chat range — filter incoming chat messages by sender distance before injecting into conversation history
- Filter chat agent-side in mind/ — check sender position before injecting into history (no mod rebuild needed)
- Add 1-2 sentences to each SOUL file about when they look around (Rust scouts terrain, Luna evaluates builds) — prompt doesn't force it
- launch-quad.sh stagger interval: 30 seconds between agents (per existing launch-duo.sh pattern)

### Claude's Discretion
- Exact wording of trimmed Part 2 sections
- launch-quad.sh implementation details (tmux pane layout, port allocation)
- How dynamic partner names are gathered (mod API endpoint or file-based)
- Per-partner chat counter implementation details

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| Infrastructure — enabling phase | No v2.3 requirement IDs map to this phase; success criteria are the requirements | See success criteria analysis below |

### Success Criteria Mapped to Research

| Criterion | Research Findings |
|-----------|-------------------|
| SOUL files for all 4 agents exist | CONFIRMED: SOUL-luna.md, SOUL-max.md, SOUL-ivy.md, SOUL-rust.md all present at project root |
| launch-quad.sh launches 4 agents in tmux with staggered starts | launch-duo.sh is a complete template; pattern is copy + add Ivy/Rust blocks at 30s stagger intervals |
| System prompt Part 2 less prescriptive | "TALK. A LOT." section + "YOU TWO" section + opening action rule are the only targets; gameplay sections kept |
| "YOU TWO" replaced with group-aware language | Single section swap in prompt.js; inject partner names from config.partners array |
| Proximity chat: agents only hear nearby agents within 32 blocks | bot.entities has position data per entity; check distance in messagestr handler before calling respondToChat/trackPlayer |
| Vision prompting enhanced per personality | 1-2 sentence addition to each SOUL file; no code change |
| All 4 SOUL files loaded correctly | config.js already works; only ALL_AGENTS list and partners logic need updating |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js ESM | existing | Agent runtime | Already in use — no change |
| mineflayer | ^4.35.0 | Bot entity position access | `bot.entities` provides position data for proximity check |
| tmux | system | Multi-process session management | Already used in launch-duo.sh |

### No New Dependencies
This phase adds zero npm packages. All required capabilities are already in the codebase.

## Architecture Patterns

### Pattern 1: SOUL File Loading (already established)
**What:** `config.js` `loadAgentConfig()` reads `AGENT_NAME` env var, tries `SOUL-{name}.md`, falls back to `SOUL-minecraft.md`
**Current state:** `ALL_AGENTS = ['luna', 'max']` hardcoded — must become `['luna', 'max', 'ivy', 'rust']`
**Partners array:** `ALL_AGENTS.filter(a => a !== name.toLowerCase())` — returns all non-self agents. `partnerName = partners[0]` for social module compat. For prompt injection, all three partner names need to be available.
**Change required:** `ALL_AGENTS` expansion + expose `partners` array (not just `partnerName`) from `loadAgentConfig()`

### Pattern 2: Chat Message Filtering (new — proximity)
**Where:** `mind/index.js` `initMind()` `bot.on('messagestr', ...)` handler
**Current flow:** Any non-self message → `trackPlayer` → `respondToChat`
**New flow:** Any non-self message → resolve username → check if sender is in `bot.entities` with distance ≤ 32 → if outside range, skip `respondToChat` (optionally still `trackPlayer` for social awareness)
**Position access:**
```javascript
// Sender position resolution — sender is UUID, resolved to username already in the handler
const senderEntity = Object.values(bot.entities || {}).find(
  e => e.type === 'player' && e.username === username
)
const selfPos = bot.entity?.position
let inRange = true  // default to in-range when position unknown (human players, fallback)
if (senderEntity?.position && selfPos) {
  const dist = senderEntity.position.distanceTo(selfPos)
  inRange = dist <= 32
}
```
**Key nuance:** Human players (the actual user) are not agents — they may not have a Mineflayer entity reference for distance. When no entity position is found for a sender, treat as in-range (safe fallback — humans always heard).

### Pattern 3: Per-Partner Chat Counter (replaces global counter)
**Current:** `_consecutiveChatCount` is a module-level integer in `mind/index.js`
**New:** `_chatCounts` is a `Map<string, number>` keyed by partner username
**Logic changes:**
```javascript
// Old (global)
if (result.command === 'chat') { _consecutiveChatCount++ }
else if (result.command !== 'idle') { _consecutiveChatCount = 0 }

// New (per-partner)
// Only increment if the triggering context was a chat from a specific partner
// Reset on any non-chat action (existing pattern preserved)
const chatTarget = result.args?.message  // not useful — use trigger context
// Better: track who we last chatted with, increment their counter
```
**Implementation approach:** The current `chatLimitWarning` passed to `buildUserMessage` is derived from `_consecutiveChatCount >= 3`. For per-partner, the warning needs context of who triggered the think(). The `context` object already has `sender` for chat triggers. Track `Map<partnerName, number>` and look up the current trigger's sender when deciding whether to inject the warning.

**Reset rule:** Any non-chat, non-idle dispatch resets ALL partner counters (or just the active one — either works, resetting all is simpler and matches the spirit of "broke the loop").

### Pattern 4: launch-quad.sh (extend launch-duo.sh pattern)
**Template:** launch-duo.sh has 4 agents' worth of boilerplate to replicate: HEREDOC + placeholder substitution per agent
**Stagger timing:** Luna starts immediately (sleep 3), Max at ~33s (sleep 33), Ivy at ~63s (sleep 63), Rust at ~93s (sleep 93) — 30s intervals
**Tmux windows:** 4 windows named luna/max/ivy/rust — same SESSION name pattern but `hermescraft-quad`
**Port:** No per-agent port differentiation in current Mineflayer architecture — all bots connect to the same MC server port. No port allocation needed.

### Pattern 5: Dynamic Partner Names in Prompt
**Where:** `buildSystemPrompt()` in `prompt.js` — the "YOU TWO" / new "YOUR GROUP" section
**Data source:** `config.partners` array (all agent names except self)
**Injection:** Format partners list as a comma-separated string: `"Luna, Max, and Ivy"` etc., derived at startup from `config.partners`
**How passed to prompt:** Already passed as `options.*` — add `options.partners` or derive from `options.players` data

### Existing Project Structure
```
/
├── SOUL-luna.md          # Complete — needs vision hint added
├── SOUL-max.md           # Complete — no vision addition needed (passive)
├── SOUL-ivy.md           # Complete — needs vision hint added
├── SOUL-rust.md          # Complete — needs vision hint added
├── launch-duo.sh         # Template for launch-quad.sh
├── launch-quad.sh        # NEW — to be created
├── mind/
│   ├── config.js         # ALL_AGENTS list + partners export
│   ├── prompt.js         # Part 2 rewrite: TALK. A LOT. + YOU TWO sections
│   ├── index.js          # messagestr handler (proximity), chat counter (per-partner)
│   └── coordination.js   # Already handles multi-agent (no change needed)
└── infra/
    └── start-stack.sh    # Replace launch-duo.sh call with launch-quad.sh
```

### Anti-Patterns to Avoid
- **Over-engineering proximity filter:** Don't fetch positions via HTTP; `bot.entities` already has position data in-process. Zero latency, zero network cost.
- **Breaking the social module:** `social.js` `initSocial()` uses `config.partnerName` (singular). Don't break this — keep `partnerName = partners[0]` for backward compat, add `partners` as a separate export.
- **Hardcoding agent names in prompt.js:** The "YOUR GROUP" section must use dynamic partner list injection, not hardcoded strings. Otherwise each SOUL file needs a different prompt template.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Entity position lookup | Custom position tracking | `bot.entities[id].position.distanceTo()` | Already available via mineflayer |
| tmux session management | Custom process orchestration | `tmux new-session`, `tmux new-window`, `tmux send-keys` | Identical to launch-duo.sh pattern |
| Distance calculation | Custom Euclidean formula | `Vec3.distanceTo()` / mineflayer's built-in | Mineflayer `position` objects have `distanceTo` |

## Common Pitfalls

### Pitfall 1: UUID → Username Resolution for Proximity Check
**What goes wrong:** The `messagestr` event passes `sender` as a UUID (MC 1.16+), not a username. The existing handler already resolves UUID → username via `bot.players`. The proximity check must happen AFTER this resolution, using the resolved `username` to find the entity in `bot.entities`.
**Why it happens:** `bot.entities` is keyed by entity ID (integer), not by username or UUID. Must search by `entity.username`.
**How to avoid:** Look up entity with `Object.values(bot.entities).find(e => e.type === 'player' && e.username === username)` after username resolution.
**Warning signs:** Proximity filter always passes (entities not found) or always blocks (wrong entity matched).

### Pitfall 2: Human Players Silenced by Proximity Filter
**What goes wrong:** Human players (the actual user) may not have a position in `bot.entities` if they're on a different MC client or haven't moved recently. The proximity check would silently block their messages.
**How to avoid:** Default `inRange = true` when no entity position is found for the sender. Only filter when BOTH positions are known. This means agents always hear human players, which is correct behavior.
**Warning signs:** Bot doesn't respond to `/msg` or direct chat from human operator.

### Pitfall 3: Per-Partner Counter Losing Context
**What goes wrong:** `_consecutiveChatCount` is checked in `buildUserMessage` but the warning is emitted without knowing which partner triggered the think. The per-partner counter needs the `context.sender` to know which counter to increment and which warning to show.
**How to avoid:** Pass the per-partner counter lookup into `buildUserMessage` as the chatLimitWarning: look up `chatCounts.get(context.sender)` before the `buildUserMessage` call. If ≥ 3, pass the warning.
**Warning signs:** Warning fires for the wrong partner or never fires despite repeated chat loop.

### Pitfall 4: coordination.js Only Reads One Partner File
**What goes wrong:** `coordination.js` `initCoordination()` sets `_partnerFile` to `activity-{config.partnerName}.json` — one file, singular. With 4 agents, there are 3 partners and 3 activity files.
**Current scope:** CONTEXT.md does not ask to update coordination for 4-partner awareness. The partner activity prompt injection shows ONE partner's activity. This is acceptable for Phase 24.
**If updated:** Would need `_partnerFiles = partners.map(p => 'activity-' + p + '.json')` and aggregated prompt output.
**Recommendation (Claude's discretion):** Leave coordination.js reading only `partners[0]`'s file for now. The existing system works; expanding it is Phase 25 scope.

### Pitfall 5: start-stack.sh Still References launch-duo.sh
**What goes wrong:** After creating launch-quad.sh, start-stack.sh still calls `./launch-duo.sh`. The quad deployment never runs.
**How to avoid:** Update the `# ── Step 3: Agents ──` section of `infra/start-stack.sh` to call `./launch-quad.sh`.
**Also update:** The echo lines referencing "Luna & Max" and tmux session name `hermescraft-duo`.

### Pitfall 6: SOUL Vision Hints — Keep Them Diegetic
**What goes wrong:** Adding vision hints to SOUL files as meta-instructions ("use !see when X") breaks the diegetic voice of the SOUL file. The SOUL is the character's inner voice, not a tool guide.
**How to avoid:** Write as character behavior: "You like to look around when you arrive somewhere new" or "You instinctively scan your surroundings when you're outside" — the LLM infers !see from context. Max doesn't need a vision hint (engineer — examines work, doesn't scout terrain).
**Warning signs:** SOUL files start sounding like system prompts instead of character descriptions.

## Code Examples

### Proximity Filter in messagestr Handler
```javascript
// mind/index.js — inside bot.on('messagestr', ...) after username resolution
// Confidence: HIGH — uses existing mineflayer entity model (same pattern as buildStateText)

// Proximity filter — only process chat from agents/players within 32 blocks
// Default to in-range if positions unknown (humans, freshly-spawned agents)
const CHAT_RANGE = 32
const senderEntity = Object.values(bot.entities || {}).find(
  e => e.type === 'player' && e.username === username
)
const selfPos = bot.entity?.position
let inRange = true
if (senderEntity?.position && selfPos) {
  inRange = senderEntity.position.distanceTo(selfPos) <= CHAT_RANGE
}
if (!inRange) {
  console.log('[mind] chat from', username, 'out of range — ignored')
  return
}
```

### Per-Partner Chat Counter
```javascript
// mind/index.js — module level
const _chatCounts = new Map()  // partnerName -> consecutive chat count

// In think() after dispatch:
if (result.command === 'chat') {
  const target = context.sender || null  // who triggered this think cycle
  if (target) {
    _chatCounts.set(target, (_chatCounts.get(target) || 0) + 1)
  }
} else if (result.command !== 'idle') {
  _chatCounts.clear()  // any real action resets all partner counters
}

// Before buildUserMessage call:
const activeSender = context.sender || null
const chatWarningCount = activeSender ? (_chatCounts.get(activeSender) || 0) : 0
const userMessage = buildUserMessage(bot, context.trigger, {
  ...context,
  partnerChat,
  chatLimitWarning: chatWarningCount >= 3 ? chatWarningCount : null,
})
```

### ALL_AGENTS Expansion in config.js
```javascript
// mind/config.js — updated constants
const ALL_AGENTS = ['luna', 'max', 'ivy', 'rust']
const partners = ALL_AGENTS.filter(a => a !== name.toLowerCase())
const partnerName = partners[0] || null  // kept for social.js compat (initSocial uses partnerName)

return { name, dataDir, soulContent, partnerName, partners, mcUsername }
// Note: partners[] is now exported alongside partnerName
```

### Group-Aware "YOUR GROUP" Prompt Section
```javascript
// mind/prompt.js — buildSystemPrompt() receives options.partners
// options.partners: string[] — all partner agent names, e.g. ['max', 'ivy', 'rust']

function formatPartnerList(partners) {
  if (!partners || partners.length === 0) return 'your group'
  if (partners.length === 1) return partners[0]
  if (partners.length === 2) return `${partners[0]} and ${partners[1]}`
  const last = partners[partners.length - 1]
  return partners.slice(0, -1).join(', ') + ', and ' + last
}

// In Part 2 template:
const groupLine = `## YOUR GROUP\n\nYou're part of a group: ${formatPartnerList(options.partners)}. ` +
  `Your relationships emerge naturally from who you are. Share resources, watch each other's backs, ` +
  `and build something worth building together.\n\nTo share items, use !give — it hands items directly to a group member.`
```

### launch-quad.sh Stagger Pattern
```bash
# Each agent block follows this structure:
# Luna: sleep 3 (immediate)
# Max:  sleep 33 (30s stagger)
# Ivy:  sleep 63 (60s stagger)
# Rust: sleep 93 (90s stagger)

SESSION="hermescraft-quad"
tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -n "luna"
# ... luna block ...
tmux new-window -t "$SESSION" -n "max"
# ... max block (sleep 33) ...
tmux new-window -t "$SESSION" -n "ivy"
# ... ivy block (sleep 63) ...
tmux new-window -t "$SESSION" -n "rust"
# ... rust block (sleep 93) ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global chat counter | Per-partner chat counter | Phase 24 | Prevents looping with one agent while still talking to others |
| "YOU TWO" (2-agent hardcoded) | "YOUR GROUP" (dynamic partner list) | Phase 24 | Scales to 4 agents without prompt rewrite per agent |
| No proximity filtering | 32-block range filter on chat | Phase 24 | Agents form natural spatial sub-groups |
| launch-duo.sh (2 agents) | launch-quad.sh (4 agents) | Phase 24 | Full team deployment |
| ALL_AGENTS = ['luna', 'max'] | ALL_AGENTS = ['luna', 'max', 'ivy', 'rust'] | Phase 24 | Ivy and Rust recognized as group members |

## Open Questions

1. **Dynamic partner names: config-based vs live-connected**
   - What we know: CONTEXT.md says "inject partner names dynamically from connected agents list" — ambiguous whether "connected" means "listed in config" or "currently online in bot.players"
   - What's unclear: If config-based, all 4 agents always see 3 partner names even if 2 are offline. If live-connected, an offline Rust means his name doesn't appear.
   - Recommendation (Claude's discretion): Use config-based (ALL_AGENTS minus self) — simpler, no startup race condition. Agents know who COULD be here even if they're offline. This matches how SOUL files reference each other.

2. **coordination.js — 1 vs 3 partner files with 4 agents**
   - What we know: `_partnerFile` reads exactly one partner's activity. With 4 agents, 3 partner files exist.
   - What's unclear: Should Phase 24 update coordination to aggregate all partners' activities?
   - Recommendation: Leave as-is. `partners[0]` activity is still useful. Expanding to 3-partner activity aggregation is polish, not blocking.

3. **TALK. A LOT. section — full removal vs keep grounding rule**
   - What we know: Decision says remove the section. The section also contains "Never mention bugs, errors, commands, or game mechanics in chat" — a grounding rule, not a personality directive.
   - Recommendation: Remove the chat frequency rules (TALK. A LOT. heading, example lines, "first action" rule) but keep "Never mention bugs, errors, commands, or game mechanics in chat" somewhere in Part 2 — it's a behavioral constraint, not a personality directive.

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/config changes (JS files, bash scripts, markdown SOUL files). No external services, databases, or CLI tools beyond what already exists in the running stack.

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `mind/config.js`, `mind/index.js`, `mind/prompt.js`, `mind/social.js`, `mind/coordination.js`
- Direct codebase read: `launch-duo.sh`, `infra/start-stack.sh`, `start.js`
- Direct codebase read: `SOUL-luna.md`, `SOUL-max.md`, `SOUL-ivy.md`, `SOUL-rust.md`
- Direct codebase read: `.planning/phases/24-four-agents-prompt-polish/24-CONTEXT.md`

### Secondary (MEDIUM confidence)
- None needed — all research is internal codebase inspection

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all existing patterns
- Architecture: HIGH — all integration points read and verified in source
- Pitfalls: HIGH — all pitfalls derived from actual code reading, not speculation

**Research date:** 2026-03-23
**Valid until:** Stable indefinitely (no external dependencies)
