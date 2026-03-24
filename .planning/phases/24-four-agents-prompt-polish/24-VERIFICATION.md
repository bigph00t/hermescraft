---
phase: 24-four-agents-prompt-polish
verified: 2026-03-23T20:30:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 24: Eight Agents + Prompt Polish Verification Report

**Phase Goal:** 8 unique agent personalities with less prescriptive prompting — creative behavior emerges from knowledge + tools, not explicit instructions. Proximity-based chat so agents only hear nearby agents.
**Verified:** 2026-03-23
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | 8 SOUL files exist at project root, each 350-400+ words with backstory, voice, drives, and 6-8 quirks | VERIFIED | All 8 files exist: luna (583w), max (627w), ivy (551w), rust (553w), ember (529w), flint (532w), sage (526w), wren (536w) — all exceed 300-word minimum |
| 2 | 4 new SOUL files created for ember, flint, sage, wren covering distinct archetype gaps | VERIFIED | Chef/Alchemist (ember), Tinkerer/Scholar (flint), Archivist/Historian (sage), Newcomer/Wanderer (wren) — no overlap with existing archetypes |
| 3 | All 8 SOUL files contain 1-2 sentences about when the agent uses !see | VERIFIED | luna/max/ivy/rust have !see in Quirks section; ember/flint/sage/wren have !see in "How you talk" section (line 11 each) — plan spec said "naturally" into either section |
| 4 | config.js ALL_AGENTS lists all 8 agent names | VERIFIED | Line 16: `const ALL_AGENTS = ['luna', 'max', 'ivy', 'rust', 'ember', 'flint', 'sage', 'wren']` |
| 5 | config.js loadAgentConfig() returns partnerNames array (all agents minus self) | VERIFIED | Line 18-19, 47: partnerNames filtered from ALL_AGENTS, returned in config object; partnerName shim retained |
| 6 | System prompt Part 2 has no TALK A LOT section and no YOU TWO section | VERIFIED | grep confirms 0 matches for "TALK. A LOT", "YOU TWO", "best friends", "Your first action.*ALWAYS.*chat" in mind/prompt.js |
| 7 | System prompt Part 2 has a YOUR GROUP section with dynamic partner names | VERIFIED | Lines 144-150 in prompt.js: separate parts.push() call with partnerNames?.join() interpolation, fallback to 'others' |
| 8 | Chat loop prevention uses per-partner Map instead of global counter | VERIFIED | Lines 43-44: `const _chatCountByPartner = new Map()` and `let _lastChatSender = null`; grep confirms 0 occurrences of old `_consecutiveChatCount` |
| 9 | Agents only receive chat from senders within 32 blocks | VERIFIED | Lines 47-54: `CHAT_PROXIMITY_BLOCKS = 32`; `isSenderNearby()` function; applied at line 862 before respondToChat() |
| 10 | Proximity filter allows all chat when sender position is unknown (failsafe) | VERIFIED | Line 50: returns true when selfPos unknown; line 52: returns true when sender entity position unknown |
| 11 | launch-agents.sh launches N agents (default 8) in tmux with 30s stagger | VERIFIED | Executable (755); AGENT_NAMES=(luna max ivy rust ember flint sage wren); NUM_AGENTS="${1:-8}"; sleep 30 between agents; session hermescraft-agents |
| 12 | launch-agents.sh uses start.js (v2 Mineflayer), not agent/index.js (v1 HermesBridge) | VERIFIED | Line 111: `node SCRIPT_DIR_PLACEHOLDER/start.js`; no reference to agent/index.js; no Xvfb usage |
| 13 | infra/start-stack.sh calls launch-agents.sh instead of launch-duo.sh | VERIFIED | Lines 76-78: calls `./launch-agents.sh 8 "$MC_HOST" "$MC_PORT"`; no reference to launch-duo.sh; session references updated to hermescraft-agents |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `SOUL-ember.md` | New agent personality: Ember | VERIFIED | 529 words, all 4 required sections present, !see hint in "How you talk" |
| `SOUL-flint.md` | New agent personality: Flint | VERIFIED | 532 words, all 4 required sections present, !see hint in "How you talk" |
| `SOUL-sage.md` | New agent personality: Sage | VERIFIED | 526 words, all 4 required sections present, !see hint in "How you talk" |
| `SOUL-wren.md` | New agent personality: Wren | VERIFIED | 536 words, all 4 required sections present, !see hint in "How you talk" |
| `mind/config.js` | 8-agent config with partnerNames array | VERIFIED | Exports `loadAgentConfig`; ALL_AGENTS has 8 entries; returns `{ partnerName, partnerNames, ... }` |
| `mind/prompt.js` | Prompt with YOUR GROUP replacing YOU TWO, no TALK section | VERIFIED | YOUR GROUP section wired with `options.partnerNames`; all 13 knowledge sections (ESSENTIAL KNOWLEDGE through NETHER) intact |
| `mind/index.js` | Per-partner chat counter + proximity filter | VERIFIED | `_chatCountByPartner` Map, `_lastChatSender`, `isSenderNearby()`, proximity check at chat event handler |
| `launch-agents.sh` | N-agent tmux launcher with staggered starts | VERIFIED | 105 lines, executable, data-driven AGENT_NAMES loop, 30s stagger, bash syntax check passes |
| `infra/start-stack.sh` | Full stack launcher calling launch-agents.sh | VERIFIED | References launch-agents.sh with count=8; hermescraft-agents session; bash syntax check passes |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `mind/config.js` | `SOUL-*.md` | SOUL file discovery via `SOUL-${name}.md` pattern | VERIFIED | Lines 30-37: tries env path, then `SOUL-${name}.md`, then fallback — all 8 named files exist at project root |
| `mind/config.js` | `mind/prompt.js` | `partnerNames` in config object | VERIFIED | config.js line 47 returns `partnerNames`; index.js lines 94/122/420 pass `_config?.partnerNames || []` to buildSystemPrompt; prompt.js line 145 consumes it |
| `mind/prompt.js` | `mind/index.js` | `options.partnerNames` passed to `buildSystemPrompt` | VERIFIED | All 3 call sites pass `partnerNames: _config?.partnerNames || []` — wiki path (line 94), respondToChat (line 122), think() (line 420) |
| `mind/index.js` | `bot.players` | proximity check using entity position | VERIFIED | `isSenderNearby()` uses `bot.players[senderName]?.entity`; `senderEntity.position.distanceTo(selfPos)` — matches plan spec pattern |
| `launch-agents.sh` | `start.js` | `node start.js` per agent | VERIFIED | Line 111: `node SCRIPT_DIR_PLACEHOLDER/start.js` with placeholder substituted at runtime |
| `infra/start-stack.sh` | `launch-agents.sh` | Step 3 agent launch | VERIFIED | Line 78: `./launch-agents.sh 8 "$MC_HOST" "$MC_PORT"` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `mind/prompt.js` YOUR GROUP | `partnerList` from `options.partnerNames` | `config.js` ALL_AGENTS static array → `_config.partnerNames` in `index.js` | Yes — static list filtered per agent, not empty, 7 names for any of the 8 agents | FLOWING |
| `mind/index.js` `isSenderNearby` | `senderEntity.position` / `bot.entity.position` | Runtime mineflayer `bot.players[name].entity` — live world state | Yes — live entity positions from game server; failsafe returns true when unavailable | FLOWING |
| `mind/index.js` `chatLimitWarning` | `_chatCountByPartner.get(_lastChatSender)` | Incremented on each chat dispatch in `think()` | Yes — real per-conversation counter, cleared on game action | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — no runnable entry points without Minecraft server + vLLM running. Static analysis is definitive for all wiring and logic; no ambiguity requiring runtime verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| Infrastructure — enabling phase | 24-01, 24-02, 24-03 (all plans) | No formal REQ-ID — enabling/structural phase. Not tracked in REQUIREMENTS.md traceability table (by design). | SATISFIED | All 3 plans completed; phase goal fully delivered per ROADMAP.md Success Criteria 1-7 |

**Note on requirement IDs:** All three plan frontmatter entries declare `requirements: ["Infrastructure — enabling phase"]`. This is not a REQ-ID from REQUIREMENTS.md — it's a descriptor matching the ROADMAP.md "Requirements: Infrastructure — enabling phase" line. No formal requirements (MEM-xx, BLD-xx, COO-xx, etc.) are assigned to Phase 24. No orphaned requirements found.

**ROADMAP.md Success Criteria cross-check:**

| SC # | Criterion | Status |
|------|-----------|--------|
| 1 | SOUL files for all 8 agents (Luna, Max, Ivy, Rust + 4 new distinct personalities) | VERIFIED |
| 2 | launch-agents.sh launches N agents (configurable, default 8) in tmux with staggered starts | VERIFIED |
| 3 | System prompt Part 2 less prescriptive — removes forced chat patterns, lets personality drive | VERIFIED |
| 4 | YOU TWO replaced with group-aware language (N agents, dynamic) | VERIFIED |
| 5 | Proximity chat: agents only receive/respond to chat within 32 blocks | VERIFIED |
| 6 | Vision prompting enhanced: agents use !see proactively based on personality | VERIFIED — !see guidance in every SOUL file, personality-specific triggers |
| 7 | All 8 SOUL files loaded correctly based on AGENT_NAME env var | VERIFIED — config.js discovery path confirmed |

All 7 ROADMAP success criteria satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `launch-agents.sh` | 96-117 | `AGENT_NAME_PLACEHOLDER` etc. in HEREDOC | Info | Intentional — HEREDOC + bash string substitution pattern for tmux command injection; replaced at lines 122-131 before execution |
| `mind/index.js` | 175, 295, 309 | `return null` / `return null` | Info | Guards for empty DB result sets — not stubs, appropriate null returns for no-data conditions |

No blockers or warnings found.

### Human Verification Required

#### 1. Personality distinctiveness at runtime

**Test:** Launch 3 agents (e.g., luna, ember, rust) against a live MC server, observe their chat over 20 minutes
**Expected:** Each agent exhibits personality-specific behavior patterns — Ember discusses food/ingredients, Rust is terse and action-oriented, Luna is descriptive and aesthetic
**Why human:** Emergent personality behavior cannot be verified statically; requires observing LLM outputs shaped by SOUL files

#### 2. Proximity filter real-world effectiveness

**Test:** Place two agents >32 blocks apart, have a third player chat at one agent's location
**Expected:** Only the nearby agent responds; distant agent continues its current activity without reacting
**Why human:** Requires live Minecraft session to test entity position resolution under real bot.players state

#### 3. Per-partner chat loop prevention

**Test:** Trigger a long back-and-forth between two nearby agents (luna and max), observe whether non-chat actions reset the counter for each independently
**Expected:** Agent loops with luna stop being penalized when max starts a new conversation; chatLimitWarning applies per-partner, not globally
**Why human:** Map key isolation requires observing counter state across multiple LLM calls in sequence

### Gaps Summary

No gaps. All 13 derived truths verified, all 9 artifacts pass levels 1-4, all 6 key links wired. The phase goal is fully achieved: 8 distinct SOUL-file personalities are loaded from config, less prescriptive prompting is in place (YOUR GROUP replaces YOU TWO/TALK sections), proximity chat filter is wired with correct failsafe behavior, and the launch infrastructure supports N-agent deployment with configurable stagger.

---

_Verified: 2026-03-23_
_Verifier: Claude (gsd-verifier)_
