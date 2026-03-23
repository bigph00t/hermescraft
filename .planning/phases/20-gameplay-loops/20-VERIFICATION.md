---
phase: 20-gameplay-loops
verified: 2026-03-23T22:44:33Z
status: gaps_found
score: 16/18 must-haves verified
re_verification: false
gaps:
  - truth: "System prompt contains ENCHANTING knowledge for building enchanting setups"
    status: failed
    reason: "No '## ENCHANTING' section exists in mind/prompt.js. Enchanting knowledge lives only in knowledge/gameplay-loops.md as RAG chunks (## Enchanting Setup Guide, ## Enchanting Priority), which are conditionally retrieved — not always present in the system prompt."
    artifacts:
      - path: "mind/prompt.js"
        issue: "Missing always-present ## ENCHANTING prompt section. Only incidental mentions in Gear: DIAMOND hint and TRADING section text."
    missing:
      - "Add '## ENCHANTING' section to Part 2 of buildSystemPrompt in mind/prompt.js with compact always-present enchanting guidance (enchanting table recipe, bookshelves needed, lapis, best enchantments)"
      - "Add 'prompt.js has ENCHANTING section' assertion to smoke tests (Section 26 or Section 13 prompt block)"

  - truth: "System prompt contains NETHER knowledge for portal building and nether survival"
    status: failed
    reason: "No '## NETHER' section exists in mind/prompt.js. Nether knowledge lives only in knowledge/gameplay-loops.md as RAG chunks (## Nether Portal Construction, ## Nether Resources, ## Nether Survival Tips), which are conditionally retrieved."
    artifacts:
      - path: "mind/prompt.js"
        issue: "Missing always-present ## NETHER prompt section. Only incidental mentions in buildProgressionHint Gear: DIAMOND return string."
    missing:
      - "Add '## NETHER' section to Part 2 of buildSystemPrompt in mind/prompt.js with compact nether guidance (portal recipe, key resources, survival tips, bed-explodes warning)"
      - "Add 'prompt.js has NETHER section' assertion to smoke tests"

human_verification: []
---

# Phase 20: Gameplay Loops Verification Report

**Phase Goal:** Agents pursue rich, human-like gameplay — farming, hunting, exploring, trading, progressing gear
**Verified:** 2026-03-23T22:44:33Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths — Plan 01

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `!harvest` command exists in registry and dispatches to `body/skills/harvest.js` | VERIFIED | `import { harvest }` at line 16 of `mind/registry.js`; REGISTRY entry at line 111 |
| 2 | `!hunt` command exists in registry and dispatches to `body/skills/hunt.js` | VERIFIED | `import { hunt }` at line 17; REGISTRY entry at line 112 |
| 3 | `!explore` command exists in registry and dispatches to `body/skills/explore.js` | VERIFIED | `import { explore }` at line 18; REGISTRY entry at line 113 |
| 4 | `harvest.js` finds mature crops via `getProperties().age` lambda, digs, replants | VERIFIED | CROP_CONFIG defined; lambda `block.getProperties().age === matureAge` at line 51 and 73; replant logic at lines 89-105 |
| 5 | `hunt.js` searches 48-block radius for hostile mobs and navigates before combat | VERIFIED | `HUNT_RADIUS = 48` at line 8; entity filter at lines 25-32; `navigateTo` + `combatLoop` at lines 48-60 |
| 6 | `explore.js` navigates to target point, scans notable blocks/entities, returns structured discoveries | VERIFIED | Cardinal direction nav at lines 46-53; NOTABLE_BLOCKS scan at lines 68-87; entity scan at lines 90-113; structured return at line 123 |
| 7 | `deriveRagQuery` in `index.js` routes harvest, hunt, and explore to appropriate queries | VERIFIED | Lines 215, 217, 219 in `mind/index.js` |
| 8 | `logEvent` in `index.js` fires for each explore discovery individually | VERIFIED | `for (const disc of skillResult.discoveries)` + `logEvent(...)` at lines 562-563 of `mind/index.js` |

**Plan 01 Score:** 8/8 truths verified

### Observable Truths — Plan 02

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | System prompt contains FARMING section | VERIFIED | `## FARMING` at line 210 of `mind/prompt.js` |
| 2 | System prompt contains HUNTING section | VERIFIED | `## HUNTING` at line 214 of `mind/prompt.js` |
| 3 | System prompt contains PROGRESSION section with dynamic gear tier detection | VERIFIED | `## PROGRESSION` at line 218; `${buildProgressionHint(bot)}` at line 220; live test confirmed all 6 tiers |
| 4 | System prompt contains TRADING section | VERIFIED | `## TRADING` at line 222 of `mind/prompt.js` |
| 5 | System prompt contains ENCHANTING knowledge for building enchanting setups | FAILED | No `## ENCHANTING` section in `mind/prompt.js`. Enchanting knowledge exists only in `knowledge/gameplay-loops.md` (RAG-conditional). |
| 6 | System prompt contains NETHER knowledge for portal building and nether survival | FAILED | No `## NETHER` section in `mind/prompt.js`. Nether knowledge exists only in `knowledge/gameplay-loops.md` (RAG-conditional). |
| 7 | System prompt contains STORAGE section for chest organization strategy | VERIFIED | `## STORAGE` at line 226 of `mind/prompt.js` |
| 8 | `knowledge/gameplay-loops.md` exists with strategy chunks for RAG retrieval | VERIFIED | 23 `##` sections, 205 lines; auto-discovered by `buildStrategyChunks()` |
| 9 | `buildProgressionHint` detects gear tier from inventory and returns upgrade guidance | VERIFIED | Lines 96-116 of `mind/prompt.js`; live test: NONE/IRON/DIAMOND all return correct strings |
| 10 | Smoke tests pass for all new exports, registry count = 27, and prompt sections | VERIFIED | `node tests/smoke.test.js` → 513 passed, 0 failed; Section 26 has 28 assertions all passing |

**Plan 02 Score:** 8/10 truths verified

**Overall Score:** 16/18 must-have truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `body/skills/harvest.js` | Mature crop detection, harvest, auto-replant | VERIFIED | 112 lines (min 40); exports `harvest`; CROP_CONFIG; getProperties().age lambda; isInterrupted checks |
| `body/skills/hunt.js` | Proactive hostile mob seeking, 48b radius, combatLoop | VERIFIED | 64 lines (min 30); exports `hunt`; HUNT_RADIUS=48; combatLoop integration |
| `body/skills/explore.js` | Cardinal navigation, discovery scan, structured return | VERIFIED | 127 lines (min 30); exports `explore`; NOTABLE_BLOCKS (20 types); entity scan; discoveries array |
| `mind/registry.js` | !harvest, !hunt, !explore command dispatch (27 total) | VERIFIED | Live test: `listCommands().length === 27`; all three commands present |
| `mind/index.js` | RAG routing for harvest/hunt/explore + logEvent for discoveries | VERIFIED | deriveRagQuery lines 215/217/219; deriveFailureQuery lines 257/258/259; EVT_MAP extended line 557; per-discovery logEvent lines 561-564 |
| `knowledge/gameplay-loops.md` | 20+ strategy sections, 150+ lines | VERIFIED | 23 sections, 205 lines; covers all 10 GPL areas; all 7 required keywords found |
| `mind/prompt.js` | buildProgressionHint export + 5 gameplay sections + command docs | PARTIAL | FARMING/HUNTING/PROGRESSION/TRADING/STORAGE verified; ENCHANTING and NETHER sections missing |
| `tests/smoke.test.js` | Section 26 with Phase 20 assertions, registry count 27 | VERIFIED | 28 assertions in Section 26; all pass; registry count updated from 24 to 27 in 2 places |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `mind/registry.js` | `body/skills/harvest.js` | `import { harvest } from '../body/skills/harvest.js'` | WIRED | Line 16 of registry.js |
| `mind/registry.js` | `body/skills/hunt.js` | `import { hunt } from '../body/skills/hunt.js'` | WIRED | Line 17 of registry.js |
| `mind/registry.js` | `body/skills/explore.js` | `import { explore } from '../body/skills/explore.js'` | WIRED | Line 18 of registry.js |
| `mind/index.js` | `deriveRagQuery` | `skill === 'harvest'` routing | WIRED | Lines 215, 217, 219 |
| `mind/prompt.js` | `buildSystemPrompt` | `${buildProgressionHint(bot)}` inside Part 2 template literal | WIRED | Line 220 of prompt.js |
| `mind/prompt.js` | command reference | `!harvest`, `!hunt`, `!explore` in Part 6 | WIRED | Lines 311-313 of prompt.js |
| `knowledge/gameplay-loops.md` | `buildStrategyChunks()` | Auto-discovery of all `knowledge/*.md` files | WIRED | Confirmed by plan 02 summary; no code change required |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `body/skills/harvest.js` | `cropPositions` (block array) | `bot.findBlocks(lambda)` | Yes — live mineflayer API call against game world | FLOWING |
| `body/skills/hunt.js` | `candidates` (entity array) | `Object.values(bot.entities)` | Yes — live entity registry from game state | FLOWING |
| `body/skills/explore.js` | `discoveries` | `bot.findBlocks` + `Object.values(bot.entities)` | Yes — live game state | FLOWING |
| `mind/prompt.js` buildProgressionHint | `names` (item Set) | `bot.inventory.items()` | Yes — live inventory; confirmed by mock bot tests | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| harvest exports `harvest` function | `node --input-type=module` import check | `typeof harvest === 'function'` | PASS |
| hunt exports `hunt` function | `node --input-type=module` import check | `typeof hunt === 'function'` | PASS |
| explore exports `explore` function | `node --input-type=module` import check | `typeof explore === 'function'` | PASS |
| Registry has 27 commands | `listCommands().length` | 27 | PASS |
| Registry includes harvest/hunt/explore | `cmds.includes(...)` | true for all three | PASS |
| buildProgressionHint returns NONE for empty inventory | Mock bot test | `'Gear: NONE — ...'` | PASS |
| buildProgressionHint detects iron tier | Mock bot with iron_pickaxe | `'Gear: IRON — ...'` | PASS |
| buildProgressionHint detects diamond tier | Mock bot with diamond_sword | `'Gear: DIAMOND — ...'` | PASS |
| Full smoke test suite | `node tests/smoke.test.js` | 513 passed, 0 failed | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GPL-01 | 20-01 | Animal farming — breed cows/sheep/pigs/chickens | SATISFIED | `breed` command pre-existed in registry (line 110); `deriveRagQuery` routing added at line 221; EVT_MAP `breed: 'observation'` at line 557 |
| GPL-02 | 20-01 | Crop farming — plant, grow, harvest, auto-replant | SATISFIED | `harvest.js` with CROP_CONFIG, lambda age check, dig+replant loop; `!harvest` in registry |
| GPL-03 | 20-01 | Mob hunting — actively seek hostiles for drops | SATISFIED | `hunt.js` with HUNT_RADIUS=48, entity filter, combatLoop integration; `!hunt` in registry |
| GPL-04 | 20-01 | Exploration — systematic world exploration, discoveries | SATISFIED | `explore.js` with NOTABLE_BLOCKS scan, entity discovery, structured return; per-discovery logEvent in index.js |
| GPL-05 | 20-02 | Villager trading — locate villagers, professions, trade | SATISFIED | `## TRADING` section in prompt.js; villager entity detection in explore.js; Villager Trading sections in knowledge/gameplay-loops.md |
| GPL-06 | 20-01 | Smelting & furnace management | SATISFIED | `smelt` command pre-existed; `deriveRagQuery` routing via `farm` path; EVT_MAP `smelt: 'craft'` |
| GPL-07 | 20-02 | Enchanting — build setup, enchant tools/armor | PARTIAL | Enchanting knowledge in gameplay-loops.md (RAG-only); Gear: DIAMOND hint mentions enchanting; NO always-present `## ENCHANTING` prompt section |
| GPL-08 | 20-02 | Nether exploration — portal, nether resources | PARTIAL | Nether knowledge in gameplay-loops.md (RAG-only); Gear: NETHERITE hint; NO always-present `## NETHER` prompt section |
| GPL-09 | 20-02 | Storage organization — organized chest storage | SATISFIED | `## STORAGE` section in prompt.js; Storage strategy sections in knowledge/gameplay-loops.md |
| GPL-10 | 20-02 | Tool/armor progression — wood → stone → iron → diamond | SATISFIED | `buildProgressionHint` detects 6 tiers and injects dynamic upgrade guidance into every system prompt tick via `## PROGRESSION` section |

**Note on REQUIREMENTS.md tracking table:** The requirements tracking table at line 91-100 of REQUIREMENTS.md maps GPL-01 through GPL-10 to "Phase 18". This is a documentation inconsistency — Phase 18 was "memory-integration", not gameplay loops. The actual implementation was delivered in Phase 20. All requirements are marked `[x]` (complete) in the checklist at lines 41-50.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `mind/prompt.js` | 220 | `${buildProgressionHint(bot)}` inside template literal | INFO | Not a stub — intentional dynamic injection pattern. buildProgressionHint is a pure function verified to return correct strings. |

No placeholders, TODO/FIXME, empty returns, or hardcoded empty arrays found in any Phase 20 artifact. All skill files follow cooperative interrupt pattern, try/catch wrapping, and `{ success, reason? }` return contracts.

---

## Human Verification Required

None. All behavioral checks can be verified programmatically via source inspection and smoke tests. Live Minecraft gameplay testing is not required to verify code correctness — the smoke tests validate all export shapes, logic paths, and integration points.

---

## Gaps Summary

**2 gaps found** — both are missing always-present prompt sections declared as must_have truths in plan 02.

**Root cause:** Plan 02 Task 2 specified adding FARMING, HUNTING, PROGRESSION, TRADING, STORAGE, and also listed ENCHANTING and NETHER as must_have truths, but the task action body only described implementing the first 5 sections. The plan summary reports "5 new gameplay sections" and the smoke tests only assert those 5. ENCHANTING and NETHER knowledge is accessible via RAG (conditional on query relevance) but is not always-present in the system prompt as the must_have truths require.

**Impact on goal:** Minor. Agents have access to enchanting/nether knowledge through RAG queries when context triggers those topics. The absence of always-present sections means agents may not proactively pursue enchanting or nether progression without a prior contextual trigger. GPL-07 and GPL-08 are partially satisfied — the knowledge exists and is retrievable, but not guaranteed to appear in every system prompt tick.

**Fix scope:** Add `## ENCHANTING` and `## NETHER` sections to `buildSystemPrompt` Part 2 in `mind/prompt.js` (matching the compact 3-5 line style of FARMING/HUNTING sections), then add two smoke test assertions in the Section 13 prompt block.

---

_Verified: 2026-03-23T22:44:33Z_
_Verifier: Claude (gsd-verifier)_
