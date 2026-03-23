# Phase 20: Gameplay Loops - Research

**Researched:** 2026-03-23
**Domain:** Minecraft gameplay systems — farming, hunting, exploration, trading, gear progression
**Confidence:** HIGH

## Summary

Phase 20 adds rich gameplay knowledge and behavioral hints to the system so the LLM pursues human-like Minecraft gameplay: farming crops, breeding animals, hunting hostile mobs, exploring the world, trading with villagers, managing smelting, enchanting, organizing storage, and progressing gear tiers. The design principle is firm: gameplay knowledge lives in the system prompt and RAG corpus, not in hardcoded behavior trees. The LLM decides what to do; tools execute how.

Critical insight from reading the codebase: **most of the body-layer machinery already exists**. `body/skills/farm.js`, `body/skills/breed.js`, `body/skills/combat.js`, and `body/skills/smelt.js` are complete and wired into the registry. `mind/spatial.js` already surfaces passive animals and hostile mobs in every tick's prompt via entity awareness. What is missing is not tools — it is gameplay knowledge: RAG corpus chunks, system prompt hints, and RAG query routing that teach the LLM when and why to use these tools in a coherent gameplay loop.

Two requirements need new tools: `!hunt` (proactive mob seeking, distinct from `!combat` which only hits the nearest visible mob) and `!explore` (systematic world traversal that logs findings to spatial memory). Everything else is prompt and knowledge work.

**Primary recommendation:** Write gameplay knowledge chunks into `mind/knowledge.js` (`buildStrategyChunks` → read from `knowledge/` markdown files), add gameplay hint sections to `mind/prompt.js`, add RAG query routing for farming/hunting/exploring/trading, then add `!hunt` and `!explore` skill stubs.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key design principles:
- Gameplay knowledge injected via system prompt hints, not hardcoded behavior trees
- The LLM decides WHAT to do, the tools execute HOW
- New tools: !farm, !breed, !hunt, !smelt, !explore
- Progression awareness via inventory analysis in system prompt
- Spatial memory (Phase 17) logs discoveries for exploration tracking

### Claude's Discretion
All implementation choices.

### Deferred Ideas (OUT OF SCOPE)
None — discuss phase skipped.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GPL-01 | Animal farming — breed cows, sheep, pigs, chickens; manage pens; harvest food and materials | `body/skills/breed.js` exists and is wired. Needs prompt hints on when/why to breed. |
| GPL-02 | Crop farming — plant, grow, harvest wheat/carrots/potatoes; use bone meal; auto-replant | `body/skills/farm.js` exists with till+plant. Needs harvest detection and auto-replant loop; bone meal use via `!craft bone_meal` + `!farm`. |
| GPL-03 | Mob hunting — actively seek and fight hostiles for drops (bones, string, gunpowder, ender pearls) | `!combat` hits nearest mob. Need `!hunt` skill that navigates toward hostile mobs proactively. RAG needs mob drop tables. |
| GPL-04 | Exploration — systematic world exploration, discover villages/temples/biomes, report findings | `!look target:horizon` + `!navigate` handle movement. Need `!explore` that moves to unvisited chunks and calls `logEvent` on discoveries. |
| GPL-05 | Villager trading — locate villagers, understand professions, trade for useful items | No existing trade tool. Prompt hints + RAG chunks on villager professions. Trading via `bot.trade()` mineflayer API. |
| GPL-06 | Smelting & furnace management — smelt ores, cook food, manage fuel efficiently | `body/skills/smelt.js` fully implemented. Needs RAG chunks on what to smelt when, and prompt hints on fuel efficiency. |
| GPL-07 | Enchanting — build enchanting setup, enchant tools/armor when possible | No existing enchant tool. Needs new `!enchant` body skill using mineflayer enchantment table API, plus knowledge chunks. |
| GPL-08 | Nether exploration — build portal, explore nether, gather nether resources | Needs `!build` a nether portal (blueprint), prompt hints on flint+steel, nether survival. Knowledge chunks on nether biomes/resources. |
| GPL-09 | Storage organization — build and maintain organized chest storage, label and sort | `!deposit`/`!withdraw` exist. Needs prompt hints on proactive storage management, RAG chunks on organization strategies. |
| GPL-10 | Tool/armor progression — actively pursue upgrades from wood → stone → iron → diamond | `!mine`, `!craft`, `!smelt` all exist. Needs inventory-analysis progression hints in system prompt so LLM recognizes its current tier and next steps. |
</phase_requirements>

---

## Standard Stack

### Existing (Confirmed Working)

| Module | Location | What it Does | Phase 20 Role |
|--------|----------|--------------|---------------|
| `body/skills/farm.js` | `body/skills/farm.js` | Till soil, plant seeds | GPL-02 executor — needs harvest detection added |
| `body/skills/breed.js` | `body/skills/breed.js` | Feed 2 animals to breed | GPL-01 executor — already complete |
| `body/skills/combat.js` | `body/skills/combat.js` | Attack nearest hostile mob, retreat on low health | GPL-03 base — needs proactive hunt variant |
| `body/skills/smelt.js` | `body/skills/smelt.js` | Full furnace management, event-driven wait | GPL-06 executor — already complete |
| `body/skills/chest.js` | `body/skills/chest.js` | Deposit/withdraw, chest memory | GPL-09 base |
| `mind/spatial.js` | `mind/spatial.js` | Entity awareness: hostile mobs, passive animals in 16b radius | GPL-01, GPL-03 awareness already in every prompt |
| `mind/memoryDB.js` | `mind/memoryDB.js` | SQLite event log, `logEvent()`, `queryNearby()` | GPL-04 discovery logging |
| `mind/registry.js` | `mind/registry.js` | `!farm`, `!breed`, `!smelt` already registered | All GPL skills dispatch through here |
| `mind/knowledge.js` | `mind/knowledge.js` | Corpus builder: `buildStrategyChunks()` reads `knowledge/*.md` files | New gameplay strategy chunks go here |

### New Modules Needed

| Module | Location | What it Does | Why New |
|--------|----------|--------------|---------|
| `body/skills/hunt.js` | `body/skills/hunt.js` | Navigate toward hostile mobs, combat loop; returns drops collected | `!combat` only hits nearest visible mob — `!hunt` searches proactively in wider radius |
| `body/skills/explore.js` | `body/skills/explore.js` | Move in unexplored directions, log discoveries to memoryDB | `!look target:horizon` is passive; `!explore` actively navigates and logs |
| `body/skills/harvest.js` | `body/skills/harvest.js` | Detect and break mature crops, replant seeds | `!farm` only tills+plants; harvest is a separate skill |
| `knowledge/gameplay-loops.md` | `knowledge/gameplay-loops.md` | Gameplay strategy text chunked by `buildStrategyChunks()` | New strategy chunk file |

### Mineflayer APIs Available (Verified via Codebase)

| API | Used In | Available For Phase 20 |
|-----|---------|----------------------|
| `bot.entities` | `spatial.js` | Entity scan for hunt/explore |
| `bot.activateEntity(entity)` | `breed.js` | Trade with villagers |
| `bot.findBlock({ matching, maxDistance })` | `farm.js`, `smelt.js` | Find crops, villagers, enchanting tables |
| `bot.findBlocks(...)` | `spatial.js`, `farm.js` | Multi-block search |
| `bot.pathfinder.setGoal()` | `combat.js` | Navigation to mob |
| `bot.dig(block)` | available (used in other skills) | Harvest mature crops |
| `bot.activateBlock(block)` | `farm.js` | Use enchanting table, trade GUI |

---

## Architecture Patterns

### Recommended Project Structure (No Changes to Top-Level)

```
body/skills/
├── farm.js        # existing — till + plant
├── harvest.js     # NEW — detect mature crops, break, replant
├── hunt.js        # NEW — proactive hostile mob seeking
├── explore.js     # NEW — systematic world traversal + logEvent
├── breed.js       # existing — complete
├── combat.js      # existing — complete
├── smelt.js       # existing — complete
knowledge/
└── gameplay-loops.md   # NEW — strategy chunks for farming/hunting/exploring/trading
mind/
├── prompt.js      # UPDATE — add FARMING, HUNTING, PROGRESSION, TRADING hint sections
├── index.js       # UPDATE — add RAG query routing + logEvent calls for new skills
└── registry.js    # UPDATE — register !hunt, !explore, !harvest
tests/
└── smoke.test.js  # UPDATE — add sections for new exports + registry count
```

### Pattern 1: Knowledge Chunk Injection (Established)

Gameplay strategy lives in `knowledge/gameplay-loops.md` and surfaces via RAG when relevant. `buildStrategyChunks()` in `knowledge.js` reads all `.md` files from the `knowledge/` directory and chunks them.

**This is the right pattern for GPL-01 through GPL-10.** The LLM retrieves farming/hunting/trading guidance when it needs it, rather than having all of it forced into every prompt.

The RAG chunk format:
```
id: strategy_<slug>
type: strategy
tags: ['strategy', 'farming', 'crops']  (or 'hunting', 'trading', etc.)
source: knowledge/gameplay-loops.md
text: [compact, actionable Minecraft guidance]
```

### Pattern 2: System Prompt Gameplay Hints (Established)

`mind/prompt.js` already has section headers like `## ESSENTIAL KNOWLEDGE`, `## COMBAT & MOBS`, `## EXPLORING`. Phase 20 adds:

- `## FARMING` — when to plant/harvest/breed, bone meal usage, pen management
- `## HUNTING` — which mobs to seek for drops, when it's worth hunting vs. safe gathering
- `## PROGRESSION` — inventory-based gear tier detection (wood/stone/iron/diamond), what to upgrade next
- `## TRADING` — how to find and use villager professions

These are compact (5-10 lines each) and always-present in the core prompt.

### Pattern 3: Inventory-Based Progression Awareness

The progression hint section in `prompt.js` should be **dynamic** — inspect the bot's inventory and emit the current gear tier and next step. This requires reading `bot.inventory.items()` in `buildStateText()` or a new helper.

Progression detection logic (pure JS, no LLM cost):
```javascript
// Source: game knowledge + CLAUDE.md conventions
function detectProgressionTier(items) {
  const names = new Set(items.map(i => i.name))
  if (names.has('diamond_pickaxe') || names.has('diamond_sword')) return 'diamond'
  if (names.has('iron_pickaxe') || names.has('iron_sword')) return 'iron'
  if (names.has('stone_pickaxe') || names.has('stone_sword')) return 'stone'
  if (names.has('wooden_pickaxe') || names.has('wooden_sword')) return 'wood'
  return 'none'
}
```

This feeds a one-liner into the system prompt: `"Gear tier: iron — next upgrade: diamond pickaxe (mine below Y=16)"`.

### Pattern 4: RAG Query Routing for New Activities

`mind/index.js` `deriveRagQuery()` must be extended to route queries for farming, hunting, and trading activities so the correct knowledge chunks surface. Current patterns to follow:

```javascript
// Source: mind/index.js deriveRagQuery() — existing patterns
if (skill === 'farm') return `farm hoe farmland water seeds`
// EXTEND with:
if (skill === 'harvest') return `harvest crops mature wheat carrot potato auto-replant`
if (skill === 'hunt') return `hunt hostile mobs drops bones string gunpowder ender pearl`
if (skill === 'explore') return `exploration biomes villages temples discoveries waypoints`
```

### Pattern 5: logEvent for GPL-04 Exploration

`mind/index.js` already calls `logEvent(bot, evtType, desc, meta)` on successful skill dispatch. The `!explore` skill must return `{ success, discoveries: [{type, x, z, description}] }` so `index.js` can log each discovery. This follows the existing `scanResult`/`postBuildScan` consume-once pattern.

### Anti-Patterns to Avoid

- **Hardcoded behavior trees:** Do not add `if (farmReady) { farm() }` loops. The LLM decides when to farm based on prompt state.
- **Blocking explore loops:** `!explore` must respect the interrupt system — check `isInterrupted(bot)` every navigation step.
- **Giant always-present gameplay sections:** Keep prompt hints compact (5-10 lines per section). Long sections eat tokens that belong to memory/RAG.
- **Enchanting GUI automation:** Enchanting table in mineflayer requires opening a window and picking an option — test this carefully or fall back to a pure knowledge hint without a `!enchant` tool for the first pass.
- **Per-tick harvest checks:** Do not poll crop growth in the idle loop. The LLM triggers `!harvest` when it decides to; crop growth is not tracked in real-time.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Mob drop tables | Custom drop table map | `mind/knowledge.js` strategy chunks | Already feeds RAG; LLM can query "what does a skeleton drop" |
| Crop growth detection | Timer-based growth tracking | `bot.findBlocks({ matching: matureCropId })` | Mineflayer has crop block state; check it at harvest time, not continuously |
| Navigation in explore | Custom pathfinding | `navigateTo()` in `body/navigate.js` | Already handles obstacles, timeout, interrupt |
| Enchantment selection | Encoding enchantment logic | Prompt hints + RAG chunks | LLM knows enchantments; just need to open the table and let it read the options |
| Villager trade detection | Parsing trade windows | `bot.activateEntity()` + villager entity type | Mineflayer opens trade GUI; the LLM selects from options |

**Key insight:** The body layer's navigation, interrupt, and entity APIs already handle the hard parts. New skills are thin wrappers that navigate + act + return structured results.

---

## Common Pitfalls

### Pitfall 1: farm.js Harvest Gap
**What goes wrong:** `!farm` only tills soil and plants seeds. There is no harvest action — calling `!farm` on mature crops does nothing useful (it retills already-tilled land).
**Why it happens:** `farm.js` was designed for the plant phase only.
**How to avoid:** Implement `body/skills/harvest.js` that calls `bot.findBlocks({ matching: matureCropId })`, navigates to each, digs, and replants. Register as `!harvest`.
**Warning signs:** The LLM calls `!farm` repeatedly near crops but inventory never gains wheat/carrots.

### Pitfall 2: !combat vs !hunt Confusion
**What goes wrong:** `!combat` in `registry.js` calls `bot.nearestEntity()` with distance < 16. If no mob is within 16 blocks, it returns `{ success: false, reason: 'no_hostile_nearby' }`. The LLM calls `!combat` repeatedly expecting to hunt but gets failures.
**Why it happens:** `!combat` is reactive (defend self), not proactive (seek drops).
**How to avoid:** `!hunt` expands search radius (e.g., 32-64 blocks), navigates toward found mobs, then runs `combatLoop`. Distinct command name guides LLM intent.
**Warning signs:** `[combat] no_hostile_nearby` in logs while spatial awareness shows `animals:` but no `HOSTILE:`.

### Pitfall 3: Crop Block State IDs
**What goes wrong:** `bot.findBlocks({ matching: grassId })` style lookup requires knowing the exact block state ID for a mature crop. In MC 1.21.1: mature wheat = `age:7`, mature carrot/potato = `age:7` too, but the block IDs for different growth stages differ.
**Why it happens:** `minecraft-data` `blocksByName['wheat']` gives the block definition but not state-specific IDs.
**How to avoid:** Use `bot.findBlocks({ matching: block => block.name === 'wheat' && block.getProperties().age === 7 })`. The lambda form handles state properties correctly.
**Warning signs:** `harvest.js` never finding any mature crops even when visually present.

### Pitfall 4: logEvent Coordinates in explore.js
**What goes wrong:** `logEvent` in `memoryDB.js` reads `bot.entity.position` for coordinates. `explore.js` calls `logEvent` after navigating to a new position — the coordinates will be the discovery location, which is correct. But if the bot hasn't actually moved (nav failed), logging a "discovery" at the wrong position pollutes spatial memory.
**Why it happens:** `explore.js` must check `nav.success` before logging.
**How to avoid:** Only call `logEvent` when navigation succeeded and something was actually observed (block scan non-empty or entity found).
**Warning signs:** Spatial memory fills with false positives at spawn coordinates.

### Pitfall 5: Smoke Test Count
**What goes wrong:** `smoke.test.js` section 2 asserts `commands.length === 24`. Adding `!hunt`, `!explore`, and `!harvest` to the registry will break this assertion.
**Why it happens:** The count is hardcoded.
**How to avoid:** Update the assertion to match the new count (24 + 3 = 27). Update the `expectedCmds` array too.
**Warning signs:** `FAIL registry has 24 commands` in smoke test output.

### Pitfall 6: Enchanting Table GUI in Mineflayer
**What goes wrong:** Mineflayer's enchanting table interaction (`bot.openEnchantmentTable()`) requires the bot to have at least 1 lapis lazuli in inventory, a nearby enchanting table, and enough XP. The API exists but is less documented than chests/furnaces.
**Why it happens:** Enchanting is optional/complex for a first pass.
**How to avoid:** For GPL-07, start with a pure knowledge/prompt approach — teach the LLM enchanting via RAG chunks and let it use `!build` for the table + `!craft` for lapis, then add the actual `!enchant` tool in a later plan if the test harness can validate it.
**Warning signs:** Enchanting tool causes hard crashes or silent failures with no useful error message.

---

## Code Examples

### harvest.js Structure (New Skill)

```javascript
// harvest.js — Detect and harvest mature crops, then replant
// Source: mineflayer block state API (established pattern in farm.js)

import minecraftData from 'minecraft-data'
import { normalizeItemName } from '../normalizer.js'
import { navigateTo } from '../navigate.js'
import { isInterrupted } from '../interrupt.js'

const mcData = minecraftData('1.21.1')

// Mature stage = age:7 for wheat, carrot, potato, beetroot (age:3 for beetroot)
const CROP_CONFIG = {
  wheat:    { mature: 7, seedItem: 'wheat_seeds' },
  carrots:  { mature: 7, seedItem: 'carrot' },
  potatoes: { mature: 7, seedItem: 'potato' },
  beetroots:{ mature: 3, seedItem: 'beetroot_seeds' },
}

export async function harvest(bot, cropName, count = 8) {
  // find mature crop blocks within 16b using lambda block state check
  // dig each, then replant from inventory if seeds available
  // returns { success, harvested, replanted }
}
```

### hunt.js Structure (New Skill)

```javascript
// hunt.js — Seek hostile mobs within expanded radius and combat loop
// Source: combat.js combatLoop + spatial.js entity awareness patterns

import { HOSTILE_MOBS, combatLoop } from './combat.js'
import { navigateTo } from '../navigate.js'
import { isInterrupted } from '../interrupt.js'

const HUNT_RADIUS = 48  // wider search than !combat's 16b reactive radius

export async function hunt(bot, targetType = null) {
  // If targetType specified, filter to that mob type (for targeted drops like 'skeleton' for bones)
  // Otherwise hunt nearest hostile within HUNT_RADIUS
  // Navigate toward target, then combatLoop
  // returns { success, target, drops? }
}
```

### explore.js Structure (New Skill)

```javascript
// explore.js — Navigate to unexplored areas and log discoveries to memoryDB
// Source: logEvent pattern from mind/index.js; navigateTo from navigate.js

import { navigateTo } from '../navigate.js'
import { isInterrupted } from '../interrupt.js'

export async function explore(bot, direction = null, distance = 64) {
  // Pick a direction (user-specified or pseudo-random from unexplored quadrant)
  // Navigate to a point distance blocks away in that direction
  // Scan for notable blocks (villages, temples, biomes, ores, water) via bot.findBlocks
  // Return { success, discoveries: [{type, x, z, description}], newPos }
  // Caller (mind/index.js) logs discoveries to memoryDB
}
```

### Progression Hint in prompt.js

```javascript
// Source: CLAUDE.md conventions — compact helper, injected into system prompt Part 2

function buildProgressionHint(bot) {
  const items = bot.inventory?.items() || []
  const names = new Set(items.map(i => i.name))

  if (names.has('diamond_pickaxe') && names.has('diamond_sword')) {
    return 'Gear: DIAMOND — pursue enchanting and nether exploration.'
  }
  if (names.has('iron_pickaxe')) {
    return 'Gear: IRON — mine below Y=16 for diamonds. Craft iron sword and armor.'
  }
  if (names.has('stone_pickaxe')) {
    return 'Gear: STONE — mine Y=16-64 for iron. Smelt raw_iron → iron_ingot, then craft iron tools.'
  }
  if (names.has('wooden_pickaxe')) {
    return 'Gear: WOOD — mine coal and stone immediately. Craft stone pickaxe.'
  }
  return 'Gear: NONE — craft a wooden pickaxe immediately (3 planks + 2 sticks).'
}
```

### RAG Query Routing Extensions for index.js

```javascript
// Source: mind/index.js deriveRagQuery() — extend existing if/else chain

// After existing farming check:
if (skill === 'harvest') return 'harvest mature crops wheat carrot potato replant farm'
if (skill === 'hunt') return 'hunt hostile mobs drops bones string gunpowder ender pearl combat'
if (skill === 'explore') return 'exploration biomes village temple ocean monument discoveries waypoints'
// Inventory-based: if player has raw ores, smelt-first guidance still needed
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Hardcoded phase objectives (7-phase dragon quest in old `agent/goals.js`) | LLM-driven via prompt hints + RAG | LLM picks goal from context; no fixed progression gate |
| Behavior trees for farming (Voyager-style) | RAG chunks + prompt section | Knowledge is retrieved when relevant, not always-present |
| No harvest distinct from farm | farm.js (till+plant) only | Phase 20 adds `!harvest` as a separate action |

---

## Open Questions

1. **Enchanting table GUI automation (GPL-07)**
   - What we know: `bot.openEnchantmentTable()` exists in mineflayer, requires lapis + XP
   - What's unclear: Reliability in headless mineflayer without GUI feedback; exact API for slot selection
   - Recommendation: Plan 1 should cover knowledge/prompt for enchanting only; Plan 2 adds `!enchant` tool if time permits. Mark GPL-07 as "partial" if only prompt coverage is delivered.

2. **Villager trading GUI (GPL-05)**
   - What we know: `bot.activateEntity(villagerEntity)` opens the trade window; `bot.trade(index, count)` executes a trade
   - What's unclear: How reliably the LLM can navigate trade options without seeing the GUI (no vision by default)
   - Recommendation: Start with knowledge chunks (villager professions → trade offers) and a `!trade` tool stub that opens the GUI and tries the first affordable trade. Full trade selection logic is a follow-on.

3. **Bone meal use in farming (GPL-02)**
   - What we know: `bot.activateBlock(cropBlock)` with bone_meal equipped accelerates growth. `farm.js` does not have this.
   - What's unclear: Whether to add bone_meal as an option to `!farm` or as a separate action in `!harvest`
   - Recommendation: Add `boneMeal:true` optional arg to `!farm seed:wheat_seeds count:8 boneMeal:true`. If `bone_meal` is in inventory and equipped, activate the farmland after planting. Keep it in the same skill to avoid a two-step awkwardness.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 20 is code/prompt/knowledge changes only. No new external services, databases, or CLIs needed. All dependencies (Node.js, mineflayer, minecraft-data, better-sqlite3) are existing project dependencies already confirmed working (473/473 smoke tests pass).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Custom smoke test runner — no framework (pure Node.js ESM assert functions) |
| Config file | none — run directly with `node tests/smoke.test.js` |
| Quick run command | `node tests/smoke.test.js` |
| Full suite command | `node tests/smoke.test.js` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GPL-01 | `breed` exported from body/skills/breed.js | unit (import) | `node tests/smoke.test.js` | Already passing |
| GPL-01 | Prompt contains FARMING hint section | source-level | `node tests/smoke.test.js` | ❌ Wave 0 |
| GPL-02 | `farm` exported from body/skills/farm.js | unit (import) | `node tests/smoke.test.js` | Already passing |
| GPL-02 | `harvest` exported from body/skills/harvest.js | unit (import) | `node tests/smoke.test.js` | ❌ Wave 0 |
| GPL-02 | Registry has `!harvest` command | source-level | `node tests/smoke.test.js` | ❌ Wave 0 |
| GPL-03 | `hunt` exported from body/skills/hunt.js | unit (import) | `node tests/smoke.test.js` | ❌ Wave 0 |
| GPL-03 | Registry has `!hunt` command | source-level | `node tests/smoke.test.js` | ❌ Wave 0 |
| GPL-03 | Prompt mentions `!hunt` | source-level | `node tests/smoke.test.js` | ❌ Wave 0 |
| GPL-04 | `explore` exported from body/skills/explore.js | unit (import) | `node tests/smoke.test.js` | ❌ Wave 0 |
| GPL-04 | Registry has `!explore` command | source-level | `node tests/smoke.test.js` | ❌ Wave 0 |
| GPL-04 | index.js calls logEvent for explore skill | source-level | `node tests/smoke.test.js` | ❌ Wave 0 |
| GPL-05 | Prompt mentions trading/villager | source-level | `node tests/smoke.test.js` | ❌ Wave 0 |
| GPL-06 | `smelt` exported from body/skills/smelt.js | unit (import) | `node tests/smoke.test.js` | Already passing |
| GPL-06 | RAG routing for smelt skill present in index.js | source-level | `node tests/smoke.test.js` | Already present |
| GPL-07 | Prompt mentions enchanting | source-level | `node tests/smoke.test.js` | ❌ Wave 0 |
| GPL-08 | Knowledge chunks contain nether strategy | source-level | `node tests/smoke.test.js` | ❌ Wave 0 |
| GPL-09 | Prompt mentions STORAGE section | source-level | `node tests/smoke.test.js` | ❌ Wave 0 |
| GPL-10 | buildProgressionHint exported from prompt.js | unit (import) | `node tests/smoke.test.js` | ❌ Wave 0 |
| GPL-10 | Progression hint injected into buildSystemPrompt | behavioral | `node tests/smoke.test.js` | ❌ Wave 0 |
| All | Registry command count updated (24 → 27) | source-level | `node tests/smoke.test.js` | ❌ Wave 0 |
| All | knowledge/gameplay-loops.md has ≥ 20 strategy chunks | source-level | `node tests/smoke.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node tests/smoke.test.js`
- **Per wave merge:** `node tests/smoke.test.js`
- **Phase gate:** Full suite green (all new assertions pass, 0 existing regressions) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `body/skills/harvest.js` — covers GPL-02
- [ ] `body/skills/hunt.js` — covers GPL-03
- [ ] `body/skills/explore.js` — covers GPL-04
- [ ] `knowledge/gameplay-loops.md` — covers GPL-01 through GPL-10 (knowledge chunks)
- [ ] Smoke test assertions for all new exports and registry entries
- [ ] Smoke test `registry has 27 commands` (update from 24)

---

## Sources

### Primary (HIGH confidence)
- Codebase direct read — `mind/registry.js` (24 registered commands, confirmed wired)
- Codebase direct read — `body/skills/farm.js` (till+plant only, no harvest)
- Codebase direct read — `body/skills/breed.js` (complete, all 8 animal types)
- Codebase direct read — `body/skills/combat.js` (reactive only, 16b radius)
- Codebase direct read — `body/skills/smelt.js` (complete, event-driven wait)
- Codebase direct read — `mind/prompt.js` (existing sections: ESSENTIAL KNOWLEDGE, COMBAT & MOBS, EXPLORING, BUILDING)
- Codebase direct read — `mind/index.js` (deriveRagQuery routing patterns)
- Codebase direct read — `mind/knowledge.js` (buildStrategyChunks reads from `knowledge/*.md`)
- Codebase direct read — `tests/smoke.test.js` (473/473 passing, registry count = 24)

### Secondary (MEDIUM confidence)
- Mineflayer docs pattern — `bot.findBlocks({ matching: fn })` lambda form for block state queries; confirmed available via farm.js + spatial.js usage

### Tertiary (LOW confidence)
- `bot.trade()` mineflayer villager trade API — referenced in standard mineflayer docs but not tested in this codebase; flag for validation when implementing GPL-05

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing skills confirmed by source read; new skill patterns follow established conventions
- Architecture: HIGH — prompt/RAG/knowledge pattern is established and working; new tools follow identical patterns to farm.js and breed.js
- Pitfalls: HIGH — derived from direct source inspection (harvest gap, combat radius, block state IDs, smoke test count)

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable stack; mineflayer APIs are stable)
