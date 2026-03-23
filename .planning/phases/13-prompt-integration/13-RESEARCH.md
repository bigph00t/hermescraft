# Phase 13: Prompt Integration - Research

**Researched:** 2026-03-22
**Domain:** RAG prompt integration — injecting retrieved knowledge into LLM calls, chat command handling, and system prompt restructuring
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Inject on ANY action failure (craft, mine, build, smelt, navigate) — query the failed action + target item/block
- Top-3 chunks on failure injection (focused, actionable)
- Context-aware injection on every Mind `think()` call — derive query from current bot state (e.g. "mining iron_ore" → query "mining iron ore")
- Query strategy: use bot's current activity + target as the retrieval query
- `!wiki` triggered by players via chat: `!wiki <query>` — agent responds naturally in chat
- Agent synthesizes a natural response from retrieved chunks — doesn't dump raw chunk text
- Inject top-5 chunks into next LLM call as context, let the LLM form the answer
- `!wiki` with no query: agent responds "ask me anything about Minecraft!"
- Register as a new command in mind/registry.js
- Replace GAMEPLAY_INSTRUCTIONS with ~1,500 token always-present core (tool progression, key recipes, ore Y-levels, mob threat summary, food priority, day/night timing)
- RAG context injected as new section after memory, before command reference: `## RELEVANT KNOWLEDGE`
- Max 2,000 tokens RAG budget per call (~13 chunks at 150 tokens/chunk)
- Label injected chunks with `## RELEVANT KNOWLEDGE\n{chunks}\n` and include source attribution per chunk

### Claude's Discretion
- Exact always-present core content selection from existing GAMEPLAY_INSTRUCTIONS
- Context-aware query construction logic details
- How to format chunk text for natural reading in the prompt
- !wiki response formatting in chat
- How to handle cases where retrieval returns no relevant results

### Deferred Ideas (OUT OF SCOPE)
- Query expansion / rewriting for better retrieval
- Multi-query decomposition for complex questions
- Caching frequent queries to avoid redundant retrieval
- Agent self-querying !wiki during planning/reasoning
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RAG-07 | !wiki command — agent queries MC knowledge mid-gameplay, answer injected into next LLM call | Chat command pattern in respondToChat() confirmed. Registry.set pattern verified. retrieveKnowledge API confirmed from Phase 12. |
| RAG-08 | Auto-lookup on skill failure — when craft/mine/build fails, automatically retrieve and inject correct approach | skill_complete trigger with result.success=false confirmed in think(). Injection point: before buildSystemPrompt call in next think() cycle. |
| RAG-09 | Context-aware injection — relevant MC knowledge added to system prompt based on current activity (mining? ore info. building? material info) | think() has full bot state access. Query can be derived from bot inventory + recent skillName. ragContext option pattern confirmed from existing optional sections. |
| RAG-10 | Replace hardcoded MINECRAFT KNOWLEDGE prompt section with dynamic retrieval, reducing base prompt size | MINECRAFT KNOWLEDGE section measured at ~549 tokens. Full behavioral block (Part 2) is ~1,917 tokens. Reduction target: ~400 tokens by distilling to core essentials. |
</phase_requirements>

---

## Summary

Phase 13 wires the Phase 12 retrieval engine (`retrieveKnowledge`) into three callsites in `mind/index.js` and `mind/prompt.js`, and restructures the static `## MINECRAFT KNOWLEDGE` block in `buildSystemPrompt`. The system has no framework changes — everything works by adding to existing patterns already established in the codebase.

The key insight from reading the source: `think()` already has access to `skillResult` (the `{ success, reason }` return from dispatch), so failure detection is straightforward. The `buildSystemPrompt(bot, options)` function already follows an options-based pattern for optional sections (memory, players, locations, buildContext, buildHistory) — adding `options.ragContext` is a natural extension. The `respondToChat()` function processes every incoming chat message; `!wiki` detection is a simple string prefix check, identical to how `!design` is handled inline before dispatch.

The current `## MINECRAFT KNOWLEDGE` block in Part 2 of `buildSystemPrompt` is 2,194 chars (~549 tokens). The surrounding behavioral text (TALK, COOPERATION, GAMEPLAY SENSE, BUILDING A CITY) totals ~1,368 tokens more. The total non-optional base prompt (Part 2 + commands + examples + format instruction) is ~2,646 tokens. The distilled always-present core target of ~1,500 tokens means trimming about 400 tokens from the full Part 2 block by removing the `## MINECRAFT KNOWLEDGE` subsection and replacing it with a much shorter ~150-token essentials list, while moving details to RAG.

**Primary recommendation:** Three files change — `mind/prompt.js` (restructure Part 2, add ragContext handling), `mind/index.js` (add RAG queries in think() and respondToChat()), and `mind/registry.js` (register !wiki). No new files needed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| mind/knowledgeStore.js | Phase 12 output | `retrieveKnowledge(query, topK)` → `{chunk, score}[]` | Already built and wired in start.js; import directly |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mind/prompt.js `buildSystemPrompt` | existing | System prompt assembly with options pattern | Extended with `ragContext` option |
| mind/index.js `think()` | existing | Core decision function; the RAG query callsite | Two new await calls added here |
| mind/index.js `respondToChat()` | existing | Chat handler; !wiki detection point | Prefix check added before existing logic |
| mind/registry.js REGISTRY | existing | Command dispatch map | New `wiki` entry or inline in respondToChat |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline !wiki in respondToChat | Add to REGISTRY dispatch | respondToChat already bypasses registry (direct LLM call); !wiki needs the same pattern — inline is cleaner and consistent with !sethome/!design handling |
| Module-level ragContext state | Pass through options | Module-level state adds coupling; options pattern is established and clean |

**Installation:**
No new packages. Phase 12 already installed vectra, minisearch, @huggingface/transformers.

## Architecture Patterns

### Recommended Project Structure
```
mind/
├── prompt.js         # MODIFIED: restructure Part 2, add ragContext section injection
├── index.js          # MODIFIED: add RAG queries in think() and respondToChat()
├── registry.js       # MODIFIED: add !wiki to REGISTRY (or handle inline)
└── knowledgeStore.js # UNCHANGED: Phase 12 output — provides retrieveKnowledge
```

### Pattern 1: Optional Section in buildSystemPrompt (existing pattern, extended)
**What:** `buildSystemPrompt` already accepts optional sections via `options.*` and injects them with `if (options.X) { parts.push(options.X) }`. Adding `ragContext` follows the same pattern.
**When to use:** Any time retrieved knowledge is available for a call.
**Example:**
```javascript
// prompt.js — after options.locations and options.buildContext, before Part 6 (commands)
// Part 5.7: RAG context — dynamically retrieved knowledge relevant to current activity
if (options.ragContext) {
  parts.push(options.ragContext)
}
```

### Pattern 2: RAG Query Before buildSystemPrompt in think()
**What:** Derive a query from bot state, call retrieveKnowledge, format results, pass as ragContext option.
**When to use:** Every call to think() — the query adapts to current activity.
**Example:**
```javascript
// mind/index.js — in think(), BEFORE buildSystemPrompt call
// Derive context-aware RAG query from current activity
const ragQuery = deriveRagQuery(bot, context)
let ragContext = null
if (ragQuery) {
  const chunks = await retrieveKnowledge(ragQuery, 3)  // 3 chunks for context-aware
  if (chunks.length > 0) {
    ragContext = formatRagContext(chunks)
  }
}

const systemPrompt = buildSystemPrompt(bot, {
  soul: _config?.soulContent,
  memory: getMemoryForPrompt(),
  players: getPlayersForPrompt(bot),
  locations: getLocationsForPrompt(bot.entity?.position),
  buildContext,
  buildHistory: getBuildHistoryForPrompt(),
  ragContext,  // new
})
```

### Pattern 3: Failure Detection and RAG Injection
**What:** When `skillResult.success === false`, the `skill_complete` trigger fires with the failure reason. The NEXT think() call should inject failure-specific RAG context, not the current one. This requires storing the failed skill info in module-level state so the next think() can use it.

**Architectural decision:** The cleanest approach is a module-level `_lastFailure` variable in `mind/index.js`. When dispatch returns `{ success: false }`, set `_lastFailure = { command: result.command, args: result.args }`. In the next `think()` call, check `_lastFailure`, build a targeted query like `"how to craft iron_pickaxe"`, inject top-3 chunks, then clear `_lastFailure`.

**When to use:** After any `{ success: false }` skillResult.
**Example:**
```javascript
// mind/index.js — module-level state
let _lastFailure = null  // { command, args } from previous failed dispatch

// In think(), BEFORE ragQuery derivation
let ragQuery = deriveRagQuery(bot, context)
// Failure overrides context-aware query — more targeted
if (_lastFailure) {
  ragQuery = deriveFailureQuery(_lastFailure.command, _lastFailure.args)
  _lastFailure = null  // consume the failure
}

// In think(), AFTER dispatch() returns { success: false }
if (!skillResult.success) {
  _lastFailure = { command: result.command, args: result.args }
}
```

### Pattern 4: !wiki Command Handling in respondToChat
**What:** `respondToChat` processes every incoming chat message. Add a prefix check for `!wiki` before the existing LLM call. This matches how `!sethome` is handled inline in `think()` before dispatch — bypasses the normal flow.
**When to use:** When sender sends a message starting with `!wiki`.
**Example:**
```javascript
// mind/index.js — in respondToChat(), BEFORE the existing LLM call
// Handle !wiki before normal chat processing
if (message.trim().startsWith('!wiki')) {
  const query = message.trim().slice(5).trim()
  if (!query) {
    bot.chat('Ask me anything about Minecraft!')
    _chatResponseInFlight = false
    return
  }
  // Retrieve top-5 chunks for wiki query
  const chunks = await retrieveKnowledge(query, 5)
  if (chunks.length === 0) {
    bot.chat("Hmm, I'm not sure about that one.")
    _chatResponseInFlight = false
    return
  }
  // Inject chunks into next LLM call so model synthesizes a natural answer
  const ragContext = formatRagContext(chunks)
  const systemPrompt = buildSystemPrompt(bot, {
    soul: _config?.soulContent,
    memory: getMemoryForPrompt(),
    players: getPlayersForPrompt(bot),
    locations: getLocationsForPrompt(bot.entity?.position),
    ragContext,
  })
  const wikiMessage = buildUserMessage(bot, 'chat', {
    sender,
    message: `!wiki ${query} — answer this in chat using what you know`,
  })
  const result = await queryLLM(systemPrompt, wikiMessage)
  if (result.command === 'chat') {
    bot.chat(result.args?.message || "I know about that but couldn't form an answer.")
  }
  return  // Don't fall through to normal chat handling
}
```

### Pattern 5: RAG Context Formatter (helper function)
**What:** A pure function that takes `{chunk, score}[]` and produces a formatted string for injection. No library needed.
**Example:**
```javascript
// mind/index.js or mind/prompt.js — pure helper
function formatRagContext(results) {
  const lines = ['## RELEVANT KNOWLEDGE']
  for (const { chunk } of results) {
    lines.push(`[${chunk.source}] ${chunk.text}`)
    lines.push('')  // blank line between chunks
  }
  return lines.join('\n')
}
```

### Pattern 6: Context-Aware Query Construction
**What:** Derives a RAG query string from bot state and trigger context. Uses the current skill name (from the trigger) and bot inventory as signals.
**When to use:** Every think() call for baseline context injection.
**Example:**
```javascript
function deriveRagQuery(bot, context) {
  // After a skill, use the skill name + args for targeted retrieval
  if (context.trigger === 'skill_complete' && context.skillName) {
    const skill = context.skillName  // 'craft', 'mine', 'smelt', etc.
    const target = context.skillResult?.item || ''
    if (target) return `${skill} ${target}`
    return skill
  }
  // Idle or chat — use inventory contents to infer current activity
  // If has pickaxe + underground, likely mining. If has building materials, likely building.
  const items = bot.inventory.items().map(i => i.name)
  if (items.some(n => n.includes('_ore') || n === 'raw_iron' || n === 'raw_gold')) {
    return 'mining ore depths tools'
  }
  if (items.some(n => n.includes('planks') || n.includes('log') || n === 'cobblestone')) {
    return 'building materials crafting'
  }
  return null  // no clear context — skip injection
}
```

### Pattern 7: Failure Query Construction
**What:** Constructs a precise query for a failed skill to retrieve the right recovery info.
**Example:**
```javascript
function deriveFailureQuery(command, args) {
  if (command === 'craft') return `how to craft ${args.item || 'item'} recipe ingredients`
  if (command === 'mine') return `mine ${args.item || 'ore'} pickaxe tier required`
  if (command === 'smelt') return `smelt ${args.item || 'item'} furnace fuel`
  if (command === 'navigate') return 'navigation pathfinding blocked'
  if (command === 'build') return `build materials ${args.blueprint || 'structure'}`
  return `${command} ${Object.values(args || {}).join(' ')}`
}
```

### Anti-Patterns to Avoid
- **Awaiting retrieveKnowledge without try/catch:** If the vector index is somehow not initialized (e.g., crash during startup), `retrieveKnowledge` will throw on `keywordIndex.search` (null ref). Wrap every call in try/catch and degrade gracefully — inject nothing, continue normally.
- **Injecting RAG context on every tick unconditionally:** If `deriveRagQuery` returns null (no clear context), skip the retrieval entirely. An extra embedding + search on every tick adds latency even if results aren't useful.
- **Putting the formatRagContext helper in prompt.js:** prompt.js is a pure formatter with no imports from mind/. If formatRagContext needs to call retrieveKnowledge, it can't live in prompt.js. Keep it in index.js or a separate helpers module.
- **Adding !wiki to REGISTRY for dispatch:** Registry handlers are called from `dispatch()` which is inside `think()`. The `!wiki` command needs to fire from `respondToChat()` which has its own LLM call flow. Put it inline in `respondToChat()` instead.
- **Replacing ALL of Part 2 (the full behavioral block):** Only the `## MINECRAFT KNOWLEDGE` subsection should be removed and replaced with a shorter core. TALK, COOPERATION, GAMEPLAY SENSE, and BUILDING A CITY sections are behavioral, not knowledge — keep them as-is or with minor trim. The target is removing the 549-token knowledge list, not all 1,917 tokens.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Semantic search / BM25 retrieval | Custom similarity scoring | `retrieveKnowledge(query, topK)` from Phase 12 | Already built, tested, and wired. Hybrid BM25 + vector with RRF fusion. |
| Token counting | Custom tokenizer | Estimate at 4 chars/token for planning; trust the ~2,000 token RAG budget | Exact token counts are model-specific; rough estimates sufficient for prompt design |
| Chat command dispatch routing | Custom command parser | String prefix check (`message.trim().startsWith('!wiki')`) | The existing pattern in respondToChat is simple string matching, not a router |

**Key insight:** Every hard problem in this phase is already solved by Phase 12. The work here is purely wiring — adding callsites, formatting results, restructuring one text block.

## Common Pitfalls

### Pitfall 1: retrieveKnowledge Called Before Index Initialized
**What goes wrong:** If `think()` fires before `initKnowledgeStore()` completes (shouldn't happen per start.js ordering, but possible on crash/restart), `retrieveKnowledge` will throw on null `keywordIndex`.
**Why it happens:** start.js awaits `initKnowledgeStore` before `initMind`, so normal flow is safe. But if the module is somehow imported and used before startup completes (e.g., from a test), the null check will fail.
**How to avoid:** Wrap all `retrieveKnowledge` calls in `try/catch`. If it throws, log and skip injection — the agent still has the always-present core.
**Warning signs:** `TypeError: Cannot read properties of null (reading 'search')` in the mind log.

### Pitfall 2: RAG Injection Adds Latency to Every think() Call
**What goes wrong:** Each `retrieveKnowledge` call embeds the query (~5-10ms for a 384-dim model on CPU) and searches the index. On a loaded system, this could add 20-50ms per think cycle.
**Why it happens:** Vector embedding is always synchronous in the ONNX runtime even when called with await.
**How to avoid:** Only call `retrieveKnowledge` when `deriveRagQuery` returns a non-null query. When bot is in neutral state (no recent activity, no skill in progress), return null from `deriveRagQuery` and skip retrieval entirely.
**Warning signs:** think() latency increasing by consistent 30-50ms per cycle.

### Pitfall 3: Chunk Text Rendered Verbatim Reads Poorly
**What goes wrong:** Recipe chunks look like `Recipe: Iron Pickaxe\niron_pickaxe (craft from: iron_ingot, stick) -- iron_ingot (smelt raw_iron); stick (craft from: oak_planks) -- oak_planks (craft from: oak_log)`. Dumped verbatim into a prompt, this is machine-formatted text that models can read but is noisy.
**Why it happens:** Chunks were designed for embedding (dense, structured) not for LLM reading (natural language).
**How to avoid:** The formatRagContext helper should emit `[source] text` pairs with blank lines between chunks. The model reads the full chunk text — it's dense but semantically correct. This is acceptable. Don't try to reformat individual chunks — the LLM can handle structured text. The `[source]` attribution prefix (e.g., `[minecraft-data]` or `[hand-authored]`) is enough framing.
**Warning signs:** LLM produces garbled responses that mix chunk formatting artifacts into natural language.

### Pitfall 4: !wiki Fires Normal Chat LLM Path After Wiki Handling
**What goes wrong:** If the `!wiki` early-return fails (e.g., a thrown error), the code falls through to the normal chat LLM call, which doesn't have the wiki context. The agent responds with general chat instead of knowledge.
**Why it happens:** Missing `return` after wiki handling, or error in retrieval causes skip of the early return.
**How to avoid:** Use a try/catch around the entire !wiki block. In the catch, either send a fallback chat message or fall through to normal handling — but explicitly document the fallthrough. Also use `return` after every wiki path (empty query, no results, successful answer).
**Warning signs:** `!wiki diamond depth` causes the agent to respond with something unrelated to diamonds.

### Pitfall 5: prompt.js buildSystemPrompt Smoke Test Breaks After Part 2 Restructure
**What goes wrong:** `tests/smoke.test.js` Section 3 asserts `sysPrompt.includes('!design')` and other command mentions. It also checks behavioral content: `sysPrompt.includes('build something')`. If the MINECRAFT KNOWLEDGE section is replaced with a shorter version, these checks might still pass, but if the wrong content is removed, they will fail.
**Why it happens:** The smoke test validates content presence, not absence. Removing the wrong section could break existing assertions.
**How to avoid:** Run `node tests/smoke.test.js` after every prompt.js change. The Section 3 assertions are the guard: `promptCmds` list check + `'build something'` check. As long as the command reference (Part 6) stays intact and BUILDING A CITY stays in Part 2, these pass.
**Warning signs:** `FAIL  system prompt mentions !design` or `FAIL  system prompt mentions directed building guidance` in smoke test output.

### Pitfall 6: respondToChat and think() Import retrieveKnowledge Causing Circular Imports
**What goes wrong:** `mind/index.js` imports from `mind/knowledgeStore.js`. If `knowledgeStore.js` were to import from `mind/index.js`, there would be a circular dependency. This won't happen as designed, but is worth being explicit about.
**Why it happens:** Circular ESM imports in Node.js cause partially-initialized module objects — functions may be undefined at import time.
**How to avoid:** Import flows one direction only: `index.js` → `knowledgeStore.js`. `knowledgeStore.js` imports nothing from `mind/`.
**Warning signs:** `TypeError: retrieveKnowledge is not a function` despite the import being present.

## Code Examples

Verified patterns from source code read:

### Current options pattern in buildSystemPrompt (prompt.js line 103-246)
```javascript
// Source: mind/prompt.js lines 103-246 (read directly)
export function buildSystemPrompt(bot, options = {}) {
  const parts = []
  if (options.soul) { parts.push(options.soul) }
  parts.push(`...Part 2 behavioral...`)
  if (options.memory) { parts.push(options.memory) }
  if (options.players) { parts.push(options.players) }
  if (options.locations) { parts.push(options.locations) }
  if (options.buildContext) { parts.push(options.buildContext) }
  if (options.buildHistory) { parts.push(options.buildHistory) }
  // RAG section slots in here — between build history and command reference
  parts.push(`...Part 6 command reference...`)
  return parts.join('\n')
}
```

### Current think() buildSystemPrompt call (mind/index.js line 128-135)
```javascript
// Source: mind/index.js lines 128-135 (read directly)
const systemPrompt = buildSystemPrompt(bot, {
  soul: _config?.soulContent,
  memory: getMemoryForPrompt(),
  players: getPlayersForPrompt(bot),
  locations: getLocationsForPrompt(bot.entity?.position),
  buildContext,
  buildHistory: getBuildHistoryForPrompt(),
})
```

### Current respondToChat structure (mind/index.js lines 39-97)
```javascript
// Source: mind/index.js lines 39-97 (read directly)
async function respondToChat(bot, sender, message) {
  if (_chatResponseInFlight) {
    _pendingChat = { trigger: 'chat', sender, message }
    return
  }
  _chatResponseInFlight = true
  try {
    const systemPrompt = buildSystemPrompt(bot, { soul, memory, players, locations })
    const stateText = buildUserMessage(bot, 'chat', { sender, message })
    const result = await queryLLM(systemPrompt, stateText)
    if (result.command === 'chat') { bot.chat(result.args?.message || '') }
    // ...
  } finally {
    _chatResponseInFlight = false
  }
}
```

### Current REGISTRY pattern (mind/registry.js lines 23-109)
```javascript
// Source: mind/registry.js lines 23-109 (read directly)
const REGISTRY = new Map([
  ['gather', (bot, args) => gather(bot, args.item, parseInt(args.count) || 1)],
  // ... all commands ...
  ['design', (_bot, _args) => Promise.resolve({ success: false, reason: 'handled by mind loop' })],
])
```

### Current dispatch after skillResult (mind/index.js lines 210-237)
```javascript
// Source: mind/index.js lines 210-237 (read directly)
const skillResult = await dispatch(bot, result.command, result.args)
skillRunning = false
console.log('[mind] skill result:', result.command, skillResult.success ? 'OK' : skillResult.reason)
lastActionTime = Date.now()
// ... build recording ...
setTimeout(() => think(bot, { trigger: 'skill_complete', skillName: result.command, skillResult }), 0)
```

### MINECRAFT KNOWLEDGE block measurement
- Current size: ~2,194 chars, ~549 tokens
- Target always-present core: ~600 chars, ~150 tokens (tool tiers + ore Y-levels + essential resources)
- Tokens freed: ~400 tokens per call returned to RAG budget
- Net effect: Base prompt shrinks by ~400 tokens; RAG adds 0-2,000 tokens on demand

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded knowledge in system prompt | Dynamic RAG injection | Phase 13 (now) | Prompt stays compact; relevant knowledge appears only when needed |
| Single system prompt for all contexts | Context-aware prompt with ragContext section | Phase 13 (now) | Failure gets repair knowledge; mining gets ore info; building gets material info |
| !wiki unanswered or hallucinated | !wiki queries corpus and synthesizes answer | Phase 13 (now) | Reliable knowledge access via chat |

**Deprecated/outdated after this phase:**
- The `## MINECRAFT KNOWLEDGE` subsection in prompt.js Part 2: replaced by a shorter always-present core (~150 tokens) plus the dynamic `## RELEVANT KNOWLEDGE` RAG section.

## Open Questions

1. **Where to put formatRagContext and deriveRagQuery helpers**
   - What we know: They're pure functions that don't need external imports. They could live in index.js (co-located with callers) or be exported from prompt.js.
   - What's unclear: prompt.js already contains helpers like `timeLabel()` that are internal. But deriveRagQuery needs bot access which prompt.js also has. The functions are small enough (5-10 lines each) to live inline in index.js.
   - Recommendation: Put both helpers as unexported functions in `mind/index.js` directly above `think()`. They're internal implementation details of the think loop, not prompt formatting utilities.

2. **Whether to register !wiki in REGISTRY or handle inline in respondToChat**
   - What we know: !design has a stub in REGISTRY for listCommands() completeness, but the real handler is inline in think(). !wiki could follow the same pattern.
   - What's unclear: Does listCommands() need to include 'wiki'? The command reference in Part 6 of the system prompt lists commands for the LLM. !wiki is a player command, not an LLM command — it should NOT be in Part 6.
   - Recommendation: Handle !wiki entirely inline in respondToChat. Optionally add a stub in REGISTRY so `listCommands()` includes it (relevant for RAG-04 command documentation), but the dispatch stub should return `{ success: false, reason: 'wiki handled in chat response' }`.

3. **How aggressively to trim MINECRAFT KNOWLEDGE**
   - What we know: The current section is 549 tokens. The decision is to keep ~150 tokens of "always-present core." The 399-token reduction is the target for RAG-10.
   - What's unclear: Exactly which lines to keep. The CONTEXT.md says: "tool progression, key recipes, ore Y-levels, mob threat summary, food priority, day/night timing."
   - Recommendation (Claude's Discretion): Keep tool tiers (WOODEN/STONE/IRON/DIAMOND — what each can mine), 3-4 essential ore Y-level notes (diamond <16, iron 16-64, coal 0-128), and 2-3 food priority lines. Remove the full crafting chains list (those are in the RAG corpus as recipe chunks). Remove the building materials list (in the RAG corpus as fact/strategy chunks). This should land at ~150-200 tokens.

## Sources

### Primary (HIGH confidence)
- `mind/prompt.js` (read directly, lines 1-414) — buildSystemPrompt options pattern, Part 2 content and size, existing section structure
- `mind/index.js` (read directly, lines 1-431) — think() flow, respondToChat() flow, dispatch() result handling, module-level state pattern
- `mind/registry.js` (read directly, lines 1-144) — REGISTRY Map pattern, dispatch function, design stub pattern
- `mind/knowledgeStore.js` (read directly, lines 1-114) — retrieveKnowledge API signature, return type `{chunk, score}[]`
- `mind/knowledge.js` (read directly, lines 1-501) — chunk schema `{id, text, type, tags, source}`, corpus types
- `start.js` (read directly, lines 1-81) — initKnowledgeStore wiring location, startup sequence
- `tests/smoke.test.js` (read directly, sections 1-15) — test pattern, Section 3 prompt assertions that must not break

### Secondary (MEDIUM confidence)
- `.planning/phases/13-prompt-integration/13-CONTEXT.md` — locked decisions, integration points, specific configuration values (top-3 failure, top-5 wiki, 2,000 token RAG budget)
- `.planning/STATE.md` — accumulated architectural decisions from Phase 11-12
- `.planning/REQUIREMENTS.md` — RAG-07 through RAG-10 definitions

### Tertiary (LOW confidence)
- Token count estimates — computed at 4 chars/token (rough heuristic). Actual model tokenization varies ±20%.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all integration points read directly from source; no external libraries needed
- Architecture: HIGH — patterns are verified extensions of existing code in the same files
- Pitfalls: HIGH for code-level issues (verified from source); MEDIUM for latency estimates (not benchmarked)

**Research date:** 2026-03-22
**Valid until:** 2026-09-22 (stable codebase; re-verify if mind/index.js or mind/prompt.js structure changes significantly)
