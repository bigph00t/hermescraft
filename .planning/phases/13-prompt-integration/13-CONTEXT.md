# Phase 13: Prompt Integration - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the RAG retrieval engine into the agent's brain. The agent automatically gets relevant Minecraft knowledge injected into every LLM call — on failure, on activity context, and on explicit !wiki queries. Replace the hardcoded GAMEPLAY_INSTRUCTIONS with a smaller always-present core plus dynamic RAG retrieval. The agent becomes inherently knowledgeable about Minecraft without bloating every prompt.

</domain>

<decisions>
## Implementation Decisions

### Auto-Injection Triggers
- Inject on ANY action failure (craft, mine, build, smelt, navigate) — query the failed action + target item/block
- Top-3 chunks on failure injection (focused, actionable)
- Context-aware injection on every Mind `think()` call — derive query from current bot state (e.g. "mining iron_ore" → query "mining iron ore")
- Query strategy: use bot's current activity + target as the retrieval query

### !wiki Command
- Triggered by players via chat: `!wiki <query>` — agent responds naturally in chat
- Agent synthesizes a natural response from the retrieved chunks — doesn't dump raw chunk text
- Inject top-5 chunks into next LLM call as context, let the LLM form the answer
- `!wiki` with no query: agent responds "ask me anything about Minecraft!"
- Register as a new command in mind/registry.js

### Prompt Restructuring
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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `mind/knowledgeStore.js` — `retrieveKnowledge(query, topK=8)` returns `{chunk, score}[]`
- `mind/prompt.js` — `buildSystemPrompt(bot, options)` with existing optional sections pattern
- `mind/registry.js` — REGISTRY Map for adding !wiki command
- `mind/index.js` — `think(bot, trigger, options)` and `respondToChat(bot, sender, message)` — event handlers where injection happens

### Established Patterns
- Optional prompt sections via `options` object: `{ soul, memory, players, locations, buildContext, buildHistory }`
- Action failures return `{ success: false, error: '...' }` — checked in mind/index.js
- Chat commands parsed in `respondToChat()` — pattern: `if (message.startsWith('!wiki'))`
- Registry commands: `REGISTRY.set('wiki', handler)` pattern

### Integration Points
- `mind/prompt.js` `buildSystemPrompt()` — add `ragContext` option, restructure GAMEPLAY_INSTRUCTIONS
- `mind/index.js` `think()` — add RAG query before building prompt
- `mind/index.js` `respondToChat()` — handle !wiki command
- `mind/registry.js` — register !wiki if needed (or handle directly in respondToChat)

</code_context>

<specifics>
## Specific Ideas

- The always-present core should be the distilled version of the current GAMEPLAY_INSTRUCTIONS — keep what agents need on EVERY call, move details to RAG
- On failure: `retrieveKnowledge("how to craft iron_pickaxe")` → inject recipe chain + tips
- Context-aware: if agent is mining, inject ore depths + tool info; if building, inject material + technique info
- !wiki answers should feel like the agent KNOWS the answer, not like it's reading from a database

</specifics>

<deferred>
## Deferred Ideas

- Query expansion / rewriting for better retrieval
- Multi-query decomposition for complex questions
- Caching frequent queries to avoid redundant retrieval
- Agent self-querying !wiki during planning/reasoning

</deferred>
