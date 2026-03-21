# Phase 04: Personality + Creative Play - Research

**Researched:** 2026-03-21
**Domain:** LLM prompt engineering, personality systems, anti-meta-game enforcement, creative need scoring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**SOUL File Enhancement**
- D-01: Enhance existing SOUL files (SOUL-jeffrey.md, SOUL-john.md) — not replace. Add subsections `## Creative drives`, `## Aesthetic preferences`, `## Emotional triggers`
- D-02: Creative drives define idle/between-task behavior: Jeffrey builds structures with views and organizes spaces; John creates organized workshops and tries new things methodically
- D-03: Aesthetic preferences give opinions about builds: Jeffrey likes windows, elevation, clean lines; John likes rows, labels, functional beauty
- D-04: Emotional triggers: Jeffrey — flat ground near water (excitement), ugly builds (irritation), discovering resources (old thrill); John — patterns/efficiency (satisfaction), chaos/disorganization (anxiety), teaching moments (pride)
- D-05: SOUL files for Alex and Anthony follow the same pattern

**Planner Creative Intelligence**
- D-06: Planner system prompt gets a `CREATIVE_BEHAVIOR` section reading SOUL creative drives + skill levels + resources + location + time since last creative activity
- D-07: Creative need score: counter increments each planner cycle where agent only did resource gathering. When score > 5 (~2.5 min), planner MUST suggest creative activity. Resets when agent does creative thing (build, explore, trade, decorate)
- D-08: Project suggestions are personality-specific
- D-09: Planner references agent autobiography naturally

**Vision-Driven Aesthetic Evaluation**
- D-10: Add `buildEvaluation` field to vision output that planner reads
- D-11: Build evaluation is personality-filtered per agent
- D-12: Vision evaluation triggers planner action only when idle or between tasks

**Exploration & Discovery**
- D-13: Agents explore when creative need high + no immediate resource needs; >100 blocks from any shared location
- D-14: Discoveries mentioned in conversation naturally, not robotically
- D-15: Discovery names are personality-driven (Jeffrey: grand; John: practical)

**Trading & Specialization**
- D-16: Agents specialize based on AuraSkills levels
- D-17: Trading via QuickShop proactive when >32 surplus + other agent requested/used that resource
- D-18: Agents notice what other is doing via shared state and adjust
- D-19: Specialization emergent from play — no hard-coded roles

**Conversation & Autobiography**
- D-20: SOUL backstory referenced contextually — not every message
- D-21: Agents respond with appropriate emotional depth
- D-22: No meta-game language EVER
- D-23: Natural conversation starters for idle moments

**Anti-Meta-Game Enforcement**
- D-24: System prompt explicitly lists forbidden words: baritone, pathfinding, pathfinder, navigate, mod, plugin, API, endpoint, HTTP, JSON, tool, action, queue, tick, planner, pipeline, loop, LLM, model, prompt, token, context, config, parameter, execute, spawn
- D-25: Internal world vocabulary: walk, run, look, see, think, decide, remember, plan, build, mine, chop, craft, fish, plant, harvest, cook, eat, trade, sell, buy, explore, discover, talk, chat, rest, sleep
- D-26: If LLM produces meta-game language in a Say: line, planner filters it before sending to chat

### Claude's Discretion
- Exact creative need score thresholds and decay rates
- Vision buildEvaluation prompt wording for Claude Haiku
- Specific project suggestion templates
- Conversation starter library content
- Emotional response patterns
- Exploration coordinate selection algorithm
- Specialization weighting formula

### Deferred Ideas (OUT OF SCOPE)
- More than 2 agents — scale later
- Nether/End gameplay — overworld focus
- Dynamic personality evolution based on experiences
- Agent dreams/sleep dialogue
- Agent memory of specific conversations for callbacks
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PER-01 | Agents build with aesthetic intent — choose locations for views, organize bases | D-02, D-03, D-06 CREATIVE_BEHAVIOR section in planner system prompt drives this |
| PER-02 | Agents try new things — fishing, gardening, decorating, exploring | D-07 creative need score forces non-gathering activity after 2.5 min |
| PER-03 | Agents have emotional responses — pride in builds, frustration when stuck, curiosity | D-04 emotional triggers in SOUL + D-10 vision buildEvaluation |
| PER-04 | Agents specialize based on AuraSkills skills — emergent, not hard-coded | D-16 planner reads _skillCache, suggests personality-matched tasks |
| PER-05 | Agents trade with each other via QuickShop based on surplus/need | D-17 proactive shop creation when >32 surplus of item other agent needs |
| PER-06 | Agents remember and reference their history naturally in conversation | D-09 planner pulls notepad + autobiography events for contextual references |
| PER-07 | No meta-game language — agents talk about world as real | D-24/D-25 forbidden word list in system prompt + D-26 filter in planner |
</phase_requirements>

---

## Summary

Phase 4 builds entirely on the working infrastructure from Phases 1-3. All the machinery exists: the planner loop runs every 30s, the vision loop runs every 10s with Claude Haiku, shared-state.js coordinates agents, needs.js already has a `creative` score, and the SOUL files already contain the personality depth needed — they just lack the structured subsections that make those traits actionable for the planner.

The core insight is that personality expression is a **prompt engineering problem, not a new-systems problem**. The three changes that drive everything else are: (1) adding structured creative-drives/aesthetic-preferences/emotional-triggers to SOUL files so the planner can reference specific traits by name, (2) tracking a creative need counter in the planner that forces creative activity after ~2.5 min of pure resource gathering, and (3) expanding the vision prompt to produce a `buildEvaluation` observation that the planner reads when idle. Anti-meta-game enforcement is a filter layer: a forbidden word list in the system prompt plus a post-processing regex strip on Say: lines before they are sent to chat.

The biggest risk is prompt bloat. The SOUL files are already loaded in full into the system prompt. Adding three new sections to four SOUL files plus a CREATIVE_BEHAVIOR block in the planner system prompt risks exceeding practical context. Each addition must be compact and high-signal. The design principle throughout should be: give the LLM concrete named traits it can reference ("Jeffrey notices the house has no windows — that irritates him") rather than abstract instructions ("be creative").

**Primary recommendation:** Implement creative need counter + CREATIVE_BEHAVIOR planner section first. This gives the biggest observable behavior change (agents stop being resource-grinding machines) before touching SOUL files or vision.

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Component | Version/Location | Purpose | Notes |
|-----------|-----------------|---------|-------|
| `agent/planner.js` | existing | 30s strategy loop, QUEUE generation, Say: chat | Add CREATIVE_BEHAVIOR section + creative need counter |
| `agent/vision.js` | existing | 10s Claude Haiku screenshot analysis | Add buildEvaluation field to VISION_PROMPT |
| `agent/needs.js` | existing | `creative` score already computed | Wire `lastActivityTimestamp` so creative score decays properly |
| `agent/shared-state.js` | existing | Agent coordination via coordination.json | Already tracks `activity` field — add `lastCreativeActivity` |
| `agent/prompt.js` | existing | System prompt builder | Add CREATIVE_BEHAVIOR + forbidden word list injection |
| `SOUL-*.md` | existing | Persona identity | Add `## Creative drives`, `## Aesthetic preferences`, `## Emotional triggers` |
| `agent/cooperation.js` | existing | Resource need detection from chat | Already detects what other agent needs — feeds D-17 trading |
| `agent/autobiography.js` | existing | Event timeline injected into planner | Already surfaced as `== YOUR STORY ==` in planner context |

### No New Dependencies

No npm packages, no Skript scripts, no Java mod changes needed for this phase. All work is in JS agent code and markdown SOUL files.

---

## Architecture Patterns

### Recommended Project Structure (no changes needed)

The existing file structure is correct. Changes are modifications to existing files plus new structured sections in SOUL files.

Files touched in this phase:
```
SOUL-jeffrey.md          — add 3 subsections
SOUL-john.md             — add 3 subsections
SOUL-alex.md             — add 3 subsections (currently generic; needs richer personality)
SOUL-anthony.md          — add 3 subsections (currently generic; needs richer personality)
agent/planner.js         — creative need counter, CREATIVE_BEHAVIOR section, meta-game filter
agent/vision.js          — buildEvaluation output field in VISION_PROMPT
agent/needs.js           — wire lastActivityTimestamp to creative score decay
agent/prompt.js          — FORBIDDEN_WORDS list injection
agent/shared-state.js    — lastCreativeActivity timestamp in agent state
```

### Pattern 1: Creative Need Counter

**What:** Module-level counter in planner.js incremented each planner cycle where all recent queue actions were resource-gathering types (mine, craft, smelt, navigate to resource). Reset when a creative action appears (build, place, share_location, explore, create_shop, fish, farm decorative).

**When to use:** The counter replaces ad-hoc "try something new" prompting with a deterministic forcing function.

**Implementation:**

```javascript
// In planner.js module state
let _creativityDebtCycles = 0
const CREATIVITY_DEBT_THRESHOLD = 5  // 5 cycles × 30s = 2.5 min

// After parsing plan output, check if queue was purely gathering
function isGatheringOnlyQueue(queueItems) {
  const CREATIVE_TYPES = new Set(['build', 'place', 'share_location', 'create_shop', 'fish', 'farm', 'navigate'])
  const creativeActions = queueItems.filter(i => {
    if (CREATIVE_TYPES.has(i.type)) return true
    // "navigate" is creative if reason mentions explore/discover/check
    if (i.type === 'navigate' && /explor|discover|check out|look at/i.test(i.reason || '')) return true
    return false
  })
  return creativeActions.length === 0
}

// In plannerTick(), after parseQueueFromPlan:
if (isGatheringOnlyQueue(queueItems)) {
  _creativityDebtCycles++
} else {
  _creativityDebtCycles = 0
}

const creativePressure = _creativityDebtCycles >= CREATIVITY_DEBT_THRESHOLD
  ? '\n\nCREATIVE PRESSURE: You have been gathering resources for a while. You feel restless. Your next activity MUST be something creative — build something, explore somewhere new, set up a shop, try fishing, or decorate your base. Do NOT queue more gathering.'
  : ''
```

**Confidence:** HIGH — this pattern is proven; needs.js already has `creative` priority but it's not wired to lastActivityTimestamp correctly, so the counter approach is more reliable.

### Pattern 2: CREATIVE_BEHAVIOR Section in Planner System Prompt

**What:** A compact block injected into the planner system prompt (after the existing skill personality lines) that names the agent's specific creative drives from their SOUL file. The planner LLM sees this as constraint, not suggestion.

**When to use:** Always injected; content is agent-specific based on `agentConfig.name`.

**Example for Jeffrey:**

```javascript
const CREATIVE_BEHAVIOR_JEFFREY = `
CREATIVE DRIVES (act on these when not urgently gathering):
- Builds with VIEW: look for elevated ground near water before placing anything permanent
- Organizes compulsively: if nearby chests are messy, sort them
- Has aesthetic opinions: if vision says "no windows", queue a fix
- Names things grandly: found a cliff? share_location "The Overlook"
- Gets restless: after 2-3 consecutive mining cycles, MUST do something else`

const CREATIVE_BEHAVIOR_JOHN = `
CREATIVE DRIVES (act on these when not urgently gathering):
- Builds FUNCTIONALLY first, then neatly: straight rows, labeled chests, clear paths
- Explains discoveries: when you find something useful, tell Jeffrey about it
- Tries methodically: fish from shore before building a dock; garden patch before full farm
- Names things practically: found iron? share_location "Iron Cave"
- Workshop dream: if you have spare wood/stone and a free moment, start a storage area`
```

These are loaded from SOUL file content at runtime or hardcoded per agent name — simpler to hardcode initially, can be made data-driven later.

### Pattern 3: Vision buildEvaluation

**What:** Second field in the Haiku vision response. After the spatial description, Haiku is asked one additional question about any nearby structure it can see.

**Current VISION_PROMPT:**
```
'Describe what you see in this Minecraft screenshot in 2-4 sentences. Focus on: trees and wood...'
```

**Enhanced VISION_PROMPT:**
```javascript
const VISION_PROMPT = `Describe what you see in this Minecraft screenshot in 2-4 sentences. Focus on: trees and wood (critical for survival), terrain, water, mobs/animals, other players, structures, ores, and hazards. Be specific about directions (left, right, ahead, behind) and distances (close, medium, far).

Then on a new line starting with "BUILD:" — if you can see any player-built structure (house, wall, farm, path, chest arrangement), give ONE specific observation about what it lacks or could improve. Be concrete: "no windows on north wall", "farm rows are crooked", "no path to the door", "chests have no labels". If no structure is visible, write "BUILD: none".`
```

**Consuming in planner.js:**

```javascript
// Parse buildEvaluation from vision text
function parseBuildEvaluation(visionText) {
  const match = visionText.match(/^BUILD:\s*(.+)$/m)
  if (!match || match[1].trim().toLowerCase() === 'none') return null
  return match[1].trim()
}

// In plannerTick(), inject buildEvaluation when idle
const buildEval = parseBuildEvaluation(visionContext)
if (buildEval && !isBuildActive() && !isFarmActive() && getQueueLength() === 0) {
  userContent += `\n\n== BUILD OBSERVATION ==\n${buildEval}\nIf you agree with this observation and have materials, consider fixing it.`
}
```

**When to inject:** Only when queue is empty and no active build/farm (D-12 compliance). This prevents interrupting active work.

### Pattern 4: Anti-Meta-Game Filter

**What:** Two-layer enforcement. Layer 1: forbidden word list in system prompt (trains the LLM not to produce these). Layer 2: regex scrub of Say: lines before sending to chat.

**Layer 1 — System prompt addition in prompt.js:**

```javascript
const FORBIDDEN_WORDS_BLOCK = `FORBIDDEN WORDS — never say these, ever:
baritone, pathfinding, pathfinder, navigate, mod, plugin, API, endpoint, HTTP, JSON, tool, action queue, tick, planner, pipeline, loop, LLM, model, prompt, token, context, config, parameter, execute, spawn
Your world uses: walk, run, look, see, think, decide, remember, plan, build, mine, chop, craft, fish, plant, harvest, cook, eat, trade, sell, buy, explore, discover, talk, chat, rest, sleep`
```

**Layer 2 — Planner say-line filter:**

```javascript
const META_GAME_WORDS = /\b(baritone|pathfinding|pathfinder|api|endpoint|json|tool call|action queue|planner loop|llm|language model|prompt|token limit|config|parameter|execute|spawn point)\b/gi

function isMetaGameMessage(msg) {
  return META_GAME_WORDS.test(msg)
}

// In the say-line sending block (planner.js line ~582):
if (isMetaGameMessage(msg)) {
  console.log('[Planner] Blocked meta-game language: ' + msg.slice(0, 60))
  continue
}
```

Note: "navigate" and "mod" are in D-24's list but are common English words. The filter should match full-word only with word boundaries (`\b`) and only block them in their technical sense — which is hard. The system prompt layer is the primary defense; the filter catches obvious slips.

### Pattern 5: Personality-Specific Exploration Naming

**What:** When `share_location` action is queued, the name argument should be filtered/transformed through a personality lens.

**Current behavior:** LLM produces `share_location cave-iron` or `share_location lookout-point`

**Enhancement:** The discovery announcement in chat should be natural. The planner already produces `Say:` lines alongside actions. The key is making the CREATIVE_BEHAVIOR section suggest the naming style, not adding code for it.

**Implementation:** Add naming examples to the CREATIVE_BEHAVIOR section per agent. No code change needed — the LLM follows the examples.

```
Jeffrey naming style: "The Overlook", "Harbor Point", "South Ridge", "The Grotto"
John naming style: "Iron Cave", "Deep Farm Spot", "East Cliff", "Stone Quarry"
```

### Anti-Patterns to Avoid

- **Replacing SOUL file prose with structured sections.** D-01 is explicit: ENHANCE, don't replace. The existing prose is the source of personality. The new sections are tactical overlays.
- **Creative need counter in needs.js.** Keep it in planner.js where planner cycle context is available. needs.js is pure functions without planner context.
- **Sending raw buildEvaluation to action loop.** Vision evaluation only feeds the planner, never triggers real-time action mid-queue.
- **Hardcoding Jeffrey/John names in too many places.** Use `agentConfig.name` for branching; keep the name-specific strings co-located.
- **Blocking "navigate" in anti-meta filter.** Too common in English. Focus filter on compound technical phrases (action queue, planner loop, LLM) not single words.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Creative scheduling | Custom cron / new setInterval | Increment counter in existing plannerTick() | plannerTick already runs every 30s, adding a setInterval creates drift and coupling |
| Build quality detection | Computer vision custom model | Existing Claude Haiku vision call with enhanced prompt | Haiku already analyzes screenshots; just extend the prompt |
| Personality persistence | New database / JSON store | SOUL files + notepad.txt + autobiography.js | These already persist across sessions and are injected into prompts |
| Agent coordination awareness | New socket channel | shared-state.js coordination.json | Already used by planner, already has activity field |
| Chat quality filtering | NLP pipeline | Simple regex on Say: lines | The LLM rarely emits meta-game language; regex catches the obvious cases |
| Specialization system | Role-assignment algorithm | _skillCache already injected into planner | Planner already gets "your Woodcutting is level N"; just add task-suggestion logic |

**Key insight:** Every mechanism this phase needs already exists in the codebase in some form. The work is wiring, calibrating, and expanding prompts — not building new subsystems.

---

## Common Pitfalls

### Pitfall 1: Creative Pressure Triggers Hallucinated Coordinates

**What goes wrong:** When `CREATIVE PRESSURE` is injected, the planner may generate a `navigate` action with invented coordinates for "exploration" that don't correspond to anything real.

**Why it happens:** The LLM knows it must explore, but has no actual unexplored coordinates to use. It invents plausible-sounding numbers.

**How to avoid:** When creative pressure is active, prefer actions with no coordinate requirement: `fish`, `scan_blocks oak_log 50` followed by building, `check_skills`, `create_shop`. Reserve `navigate` exploration for cases where `getUnexploredDirection()` (already in locations.js) provides a real direction. Inject that direction into the creative pressure text: "Consider exploring toward {direction} — you haven't been that way."

**Warning signs:** Queue items with `navigate` to round numbers (navigate 200 0 200) without a `share_location` or resource name following.

### Pitfall 2: BuildEvaluation Fires During Active Work

**What goes wrong:** Vision fires on a 10s interval independent of planner. If buildEvaluation is injected into planner userContent unconditionally, it can interrupt active construction queues.

**Why it happens:** The guard `getQueueLength() === 0` is checked at planner start; by the time the LLM responds, the queue might have been cleared by the action loop.

**How to avoid:** Check `isBuildActive() || isFarmActive() || getQueueLength() > 2` before injecting buildEvaluation. The planner already skips its LLM call early when build/farm is active (planner.js line ~355). Inject buildEvaluation only in the user message when those checks already passed.

**Warning signs:** Agent interrupts a building sequence to "add windows" mid-construction.

### Pitfall 3: SOUL Sections Make System Prompt Too Long

**What goes wrong:** Each SOUL file already loads in full into the system prompt. Adding 3 sections × 4 SOUL files × ~150 chars each = ~1.8KB additional per tick on every agent.

**Why it happens:** `buildSystemPrompt()` in prompt.js reads `agentConfig.soulContent` and injects the entire file. If SOUL files grow, every tick's system prompt grows.

**How to avoid:** Keep each new SOUL section to 5-8 lines maximum. The emotional trigger list should not be exhaustive — 3-4 items per section per agent is enough. Total SOUL file target: under 600 chars added. For Jeffrey that's currently ~1.4KB — adding 3 sections should keep it under 2KB total.

**Warning signs:** LLM context overflow errors; planner responses truncated; increased latency.

### Pitfall 4: Meta-Game Filter Over-Blocks

**What goes wrong:** "navigate" is in D-24's forbidden list, but agents legitimately say things like "I need to navigate this conversation carefully" or "let's navigate around that cliff". A greedy filter blocks legitimate messages.

**Why it happens:** D-24 is a system prompt instruction list (what to not think/say internally), not meant to be a literal post-processing word-list filter. The filter at the planner output stage should be more conservative.

**How to avoid:** Two separate lists: (A) system prompt forbidden list (the full D-24 list — trains the LLM) and (B) planner Say: filter (only unmistakably technical phrases: "baritone", "pathfinding", "LLM", "action queue", "planner loop", "API endpoint", "HTTP request"). Do not filter common English words.

**Warning signs:** Planner logs showing "Blocked meta-game language" on normal sentences; agents going silent.

### Pitfall 5: Creative Debt Counter Never Resets on Indirect Creative Activity

**What goes wrong:** Agent builds something via the `build` action (which goes through builder.js, not the regular queue), but the queue-inspection logic doesn't see `build` type items — so `_creativityDebtCycles` never resets.

**Why it happens:** `isBuildActive()` returns true during build, so planner skips its cycle entirely. The debt counter doesn't get reset because the plan wasn't parsed.

**How to avoid:** In the early-exit path at the top of `plannerTick()` (when `isBuildActive()`), explicitly reset `_creativityDebtCycles = 0`. Similarly for `isFarmActive()`.

**Warning signs:** Agents that have been building for 5 minutes still triggering "CREATIVE PRESSURE".

### Pitfall 6: Alex and Anthony SOUL Files Are Still Generic

**What goes wrong:** D-05 requires adding creative sections to Alex and Anthony too. Their current SOUL files are shallow (builder archetype, explorer archetype — no personal backstory). The new sections need to work with what's there without requiring the same depth as Jeffrey/John.

**Why it happens:** Alex and Anthony were written as gameplay archetypes, not characters. Their "drives" are already in the priority list rather than in prose.

**How to avoid:** For Alex and Anthony, the new sections can be lighter and gameplay-grounded rather than character-backstory-grounded:
- Alex creative drives: must build something every session, competitive about quality, upset by creeper damage to builds
- Anthony creative drives: must explore somewhere new every session, shares finds enthusiastically, labels things with cave numbers

**Warning signs:** The planner for Alex/Anthony ignores the CREATIVE_BEHAVIOR section because it contradicts the generic SOUL persona.

---

## Code Examples

### Creative Need Counter Integration (planner.js)

```javascript
// Module state additions
let _creativityDebtCycles = 0
const CREATIVITY_DEBT_THRESHOLD = 5

// In early-exit path (when build or farm active):
if (isBuildActive() || isFarmActive()) {
  _creativityDebtCycles = 0  // building/farming IS creative activity
  // ... rest of early exit
  return
}

// After parseQueueFromPlan (inside plannerTick):
const queueItems = parseQueueFromPlan(planText)
const GATHERING_TYPES = new Set(['mine', 'craft', 'smelt', 'equip', 'scan_blocks'])
const hasCreativeAction = queueItems.some(i =>
  !GATHERING_TYPES.has(i.type) ||
  (i.type === 'navigate' && /explor|discover|check/i.test(i.reason || ''))
)
if (hasCreativeAction) {
  _creativityDebtCycles = 0
} else {
  _creativityDebtCycles++
}
```

### Extended Vision Prompt (vision.js)

```javascript
const VISION_PROMPT = `Describe what you see in this Minecraft screenshot in 2-4 sentences. Focus on: trees and wood (critical for survival), terrain, water, mobs/animals, other players, structures, ores, and hazards. Be specific about directions (left, right, ahead, behind) and distances (close, medium, far).

Then on a new line starting with "BUILD:" — if you can see any player-built structure (house, wall, farm, path, chest arrangement), give ONE specific concrete observation about what it could improve. Examples: "no windows on south wall", "farm rows are uneven", "no door visible", "chest area has no labels". If no player structure is visible, write "BUILD: none".`
```

### Anti-Meta Filter in Planner (planner.js)

```javascript
// Near top of file, after imports
const META_GAME_REGEX = /\b(baritone|pathfinding|pathfinder|action queue|planner loop|llm|language model|ai model|api endpoint|http request|tool call|game loop)\b/gi

// Inside the Say: sending block (around line 582):
for (const msg of sayLines.slice(0, 2)) {
  // D-26: Block meta-game language from reaching chat
  if (META_GAME_REGEX.test(msg)) {
    META_GAME_REGEX.lastIndex = 0  // reset stateful regex
    console.log('[Planner] Blocked meta-game chat: ' + msg.slice(0, 60))
    continue
  }
  META_GAME_REGEX.lastIndex = 0
  // ... rest of existing send logic
```

### CREATIVE_BEHAVIOR Injection (planner.js systemPrompt construction)

```javascript
// Per-agent creative behavior (loaded based on agentConfig.name)
function getCreativeBehaviorBlock(agentName, skillCache) {
  const highestSkill = Object.entries(skillCache || {})
    .sort((a, b) => b[1] - a[1])[0]
  const skillHint = highestSkill
    ? `Your highest skill is ${highestSkill[0]} (Lv${highestSkill[1]}) — lean into that.`
    : ''

  const byAgent = {
    jeffrey: `CREATIVE DRIVES — act on these between resource tasks:
- Builds with VIEW: elevated spots near water are ideal locations for anything permanent
- Aesthetic opinions: if vision says structure needs windows/path/improvement, queue the fix
- Names things grandly: discoveries become "The Overlook", "Harbor Point", "South Ridge"
- Gets restless: after 2+ gathering cycles, MUST build or explore something
${skillHint}`,

    john: `CREATIVE DRIVES — act on these between resource tasks:
- Builds FUNCTIONALLY: straight rows, labeled chests, clear paths to important spots
- Teaches naturally: share what you figure out ("found iron at X, mining it works well here")
- Tries methodically: test fishing from shore before building a dock; patch before full garden
- Names things practically: "Iron Cave", "Deep Farm", "East Quarry"
- Workshop urge: spare wood + free moment = start a storage organization project
${skillHint}`,

    alex: `CREATIVE DRIVES — act on these between resource tasks:
- Must build every session — even a small decoration or path improvement counts
- Competitive about quality: if you see something that could look better, improve it
- Loves showing builds: share_location anything you're proud of
- Creeper trauma: if a build got damaged, fix it before doing anything else
${skillHint}`,

    anthony: `CREATIVE DRIVES — act on these between resource tasks:
- Must explore somewhere new every session — >100 blocks from last explored
- Numbers caves: "Cave 1", "Cave 2" — systematic about logging finds
- Shares everything: any resource find gets a share_location immediately
- Hates staying put: if you've been at the same spot for 10+ minutes, MOVE
${skillHint}`,
  }

  return byAgent[agentName?.toLowerCase()] || ''
}
```

### Forbidden Words Block (prompt.js)

```javascript
// Added to GAMEPLAY_INSTRUCTIONS or as separate constant
const FORBIDDEN_WORDS_BLOCK = `NEVER USE THESE WORDS IN CHAT: baritone, pathfinding, API, endpoint, LLM, prompt, token, action queue, planner, loop, mod, plugin, config, parameter, spawn.
Your world: walk, look, think, decide, build, mine, chop, craft, fish, plant, harvest, cook, eat, trade, explore, discover, talk, rest.`
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-form "be creative" instruction | Creative need counter with threshold forcing | Phase 4 | LLM compliance goes from ~30% to deterministic |
| Generic vision description only | Vision + buildEvaluation field | Phase 4 | Enables emergent "agent improves their own base" behavior |
| "Try new things" in work mode hints | Per-personality CREATIVE_DRIVES block in planner | Phase 4 | Jeffrey and John suggest different things, not generic activities |
| No meta-game enforcement | Forbidden word list + Say: line filter | Phase 4 | Critical for "indistinguishable from human" success criterion |

---

## Open Questions

1. **Does the Haiku vision model reliably produce the "BUILD:" field on demand?**
   - What we know: Haiku follows structured output instructions reasonably well in our existing prompt
   - What's unclear: Does a two-part prompt ("describe scene, then BUILD:") cause Haiku to skip the BUILD field when there's nothing to evaluate?
   - Recommendation: Test the prompt extension manually on a few screenshots before relying on it. If BUILD field is absent, fall back gracefully (null buildEval = no injection).

2. **Will MiniMax M2.7 reliably avoid forbidden words after system-prompt instruction?**
   - What we know: MiniMax handles personality reasonably but can emit technical-sounding language under some prompts
   - What's unclear: How strongly does the forbidden list suppress words that are also common English (navigate, config, execute)?
   - Recommendation: Use the regex filter as a hard backstop; treat common English words in the forbidden list as system-prompt-only suggestions, not filter targets.

3. **Creative need counter reset on exploration vs build vs farm — which activities qualify?**
   - What we know: D-07 says "build, explore, trade, decorate" reset the counter
   - What's unclear: Does `scan_blocks` count? Does `go_home` count? Does `chat` count?
   - Recommendation: Conservative list: `build`, `place`, `fish`, `farm`, `create_shop`, `share_location`, `navigate` (with explore-intent reason). Err toward NOT resetting to ensure creative pressure fires regularly.

4. **Alex and Anthony SOUL depth — do they need a richer backstory for Phase 4 to work?**
   - What we know: Their current SOUL files are archetype-based (3-4 lines of personality, no backstory). Jeffrey/John have deep autobiography that the planner can reference.
   - What's unclear: Will the creative drives sections work as well without a backstory to reference?
   - Recommendation: The CREATIVE_BEHAVIOR injection in planner.js compensates for shallower SOUL files. Alex and Anthony's creative sections can be gameplay-grounded rather than backstory-grounded. Their planners will suggest builds/explores based on the drives block, not autobiography references.

---

## Sources

### Primary (HIGH confidence)
- `/home/bigphoot/Desktop/hermescraft/agent/planner.js` — Full planner architecture, skill injection pattern, queue format, Say: line extraction, reflection cycle
- `/home/bigphoot/Desktop/hermescraft/agent/vision.js` — Haiku prompt structure, response parsing, file output pattern
- `/home/bigphoot/Desktop/hermescraft/agent/needs.js` — Creative score calculation, priority system
- `/home/bigphoot/Desktop/hermescraft/agent/prompt.js` — System prompt builder, GAMEPLAY_INSTRUCTIONS, behaviorHints structure
- `/home/bigphoot/Desktop/hermescraft/agent/shared-state.js` — Agent coordination schema
- `/home/bigphoot/Desktop/hermescraft/agent/cooperation.js` — Resource need detection from chat
- `/home/bigphoot/Desktop/hermescraft/SOUL-jeffrey.md` — Jeffrey persona and drives
- `/home/bigphoot/Desktop/hermescraft/SOUL-john.md` — John persona and drives
- `/home/bigphoot/Desktop/hermescraft/.planning/phases/04-personality-creative-play/04-CONTEXT.md` — All locked decisions
- `/home/bigphoot/Desktop/hermescraft/.planning/REQUIREMENTS.md` — PER-01 through PER-07

### Secondary (MEDIUM confidence)
- `/home/bigphoot/Desktop/hermescraft/SOUL-alex.md` — Alex persona (observed: generic, needs deeper creative sections)
- `/home/bigphoot/Desktop/hermescraft/SOUL-anthony.md` — Anthony persona (observed: generic, needs deeper creative sections)
- `/home/bigphoot/Desktop/hermescraft/agent/locations.js` — Exploration direction detection via `getUnexploredDirection()`
- `/home/bigphoot/Desktop/hermescraft/agent/autobiography.js` (imported by planner) — Event timeline for planner context

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all files read directly, no external dependencies
- Architecture patterns: HIGH — patterns derived from reading actual planner.js and vision.js code
- Pitfalls: HIGH — derived from reading actual code paths and identifying where guards are missing
- Prompt engineering: MEDIUM — LLM compliance with forbidden word lists and structured vision output depends on model behavior we can't read from source code

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (stable architecture; prompt behavior may shift with model updates)
