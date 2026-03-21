# HermesCraft Agent Hardening & Workflow Overhaul

## What This Is

HermesCraft is a Minecraft AI agent system: a Node.js agent loop talks to an LLM (Hermes 4.3 via vLLM/LiteLLM) and controls a Minecraft client via a Fabric mod's HTTP bridge. The agent observes game state, reasons about what to do, and executes actions in a tick loop. This milestone focuses on fixing critical bugs in the memory/compression system and building a proper plan→execute→review workflow so the agent can handle complex multi-step tasks reliably.

## Core Value

The agent must never silently lose its execution context — and when given a complex task, it must plan, execute, and review its own work instead of fire-and-forget.

## Requirements

### Validated

- ✓ Observe→Think→Act tick loop with LLM integration — existing (`agent/index.js`)
- ✓ Multi-level memory: L1 session (conversation), L2 curated (MEMORY.md), L3 transcripts (JSONL), L4 skills — existing (`agent/memory.js`, `agent/skills.js`)
- ✓ Native tool calling with Hermes XML fallback parser — existing (`agent/llm.js`)
- ✓ Notepad tool for persistent scratch planning — existing (`agent/index.js:177-203`)
- ✓ Pinned context injection from `dataDir/context/` — existing (`agent/prompt.js:16-42`)
- ✓ Death recording with countermeasure generation — existing (`agent/memory.js:175-242`)
- ✓ Skill creation from phase completion — existing (`agent/skills.js:174-207`)
- ✓ Social/player tracking with sentiment — existing (`agent/social.js`)
- ✓ Location auto-detection — existing (`agent/locations.js`)
- ✓ Fabric mod HTTP bridge (state, action, recipes, chat) — existing (`mod/`)
- ✓ Multi-agent support via AGENT_NAME env var — existing (`agent/config.js`)
- ✓ Action pipelining for sustained actions — existing (`agent/index.js:620-637`)

### Active

- [ ] Fix `trimHistoryGraduated` boundary bug — must respect conversation round boundaries so a `tool` role message never becomes the first history entry
- [ ] Fix second full-wipe path in corrupt tool call handler (`llm.js:266-270`) — should use graduated trim instead of `conversationHistory.length = 0`
- [ ] Persist conversation history to disk — L1 session memory must survive OOM/SIGKILL, not just live in-memory
- [ ] Fix open-ended mode skill injection (`skills.js:146`) — returns `.content` but skills have `.body`, silently breaks skill injection
- [ ] Fix chat message deduplication — agent re-processes same messages every tick because `/chat` endpoint never clears and Node.js side has no tracking
- [ ] Fix `autoConnectAttempted` reset on disconnect — currently only resets in catch block, not when player gets kicked later
- [ ] Agent-writable pinned context — add a tool so the agent can save its own planning docs to `dataDir/context/` (currently only humans can populate)
- [ ] Plan→Execute→Review loop — build a proper multi-step task planning system: agent creates plan, tracks progress against it, reviews outcomes, iterates on failures
- [ ] Self-review quality gate — agent evaluates its own output/action before committing, with auto-correction for obviously wrong actions
- [ ] Task decomposition tool — agent can break complex instructions into subtasks and track completion

### Out of Scope

- Vision/screenshot integration — separate concern, LiteLLM vision model config is a deployment issue not an agent architecture issue
- Multi-agent coordination protocol — save for after single-agent workflows are solid
- External API integrations beyond Minecraft — no webhooks, Discord bots, etc. in this milestone
- Rewriting the Fabric mod in a different framework — Java mod is working, just needs bug fixes

## Context

**Codebase state:** ~1,300 lines of agent JS across 13 files, plus Java Fabric mod. The agent works but has reliability gaps that compound under load — the compression system can wipe all context, skills silently break in open-ended mode, and there's no mechanism for the agent to plan or review multi-step work.

**The triggering incident:** A Discord bot (Hermes) built up 562 messages (~443K tokens) of planning context, then auto-compressed to 7 messages (~837 tokens) — destroying all execution context. The graduated trim fix was applied but the deep dive found it still has a boundary bug that can cascade to a full wipe.

**Existing memory architecture:**
- L1: `conversationHistory[]` in llm.js — in-memory only, volatile
- L2: `MEMORY.md` — lessons, strategies, world knowledge — persisted to disk
- L3: Session JSONL transcripts — append-only log files
- L4: Skills — SKILL.md files in per-agent directories
- Notepad: `notepad.txt` — persistent scratch space
- Pinned context: `dataDir/context/*.md` — injected into system prompt every tick

**Key architectural constraint:** The agent runs a 2-second tick loop. Any new planning/review system must fit within this loop without blocking for multiple seconds.

## Constraints

- **Tick budget**: Agent tick runs every 2s. Planning/review must be lightweight enough to not starve the game loop. Consider async/background processing for heavy work.
- **Token budget**: System prompt + user message + history must fit in the model's context window. Pinned context is already capped at 5 files × 8000 chars.
- **LLM latency**: vLLM with Hermes 4.3 36B at FP8. First call ~2s uncached, subsequent ~0.5-1s. Can't afford multiple LLM calls per tick for review.
- **Mod stability**: Java mod changes require rebuild and Minecraft restart. Minimize mod changes.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Graduated trim respects round boundaries | Prevents orphaned `tool` messages that cascade to full wipes | — Pending |
| Persist L1 to disk on periodic save | Conversation history survives crashes without per-tick I/O overhead | — Pending |
| Plan/review via notepad extension, not separate LLM calls | Fits within tick budget — agent writes plan to notepad, references it each tick | — Pending |
| Chat dedup via timestamp tracking on Node.js side | Simpler than modifying Java mod — just track last-seen message | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-20 after initialization*
