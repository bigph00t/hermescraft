# Phase 24: Four Agents + Prompt Polish - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

4 unique agent personalities with less prescriptive prompting — creative behavior emerges from knowledge + tools, not explicit instructions. Proximity-based chat so agents only hear nearby agents. launch-quad.sh for 4-agent deployment.

</domain>

<decisions>
## Implementation Decisions

### Prompt Reduction Strategy
- Remove forced chat frequency rules from "TALK. A LOT." section — let personality (SOUL files) drive chattiness naturally
- Remove example dialogue lines from Part 2 — SOUL files already define each agent's voice, generic examples fight personality
- Remove "Your first action should ALWAYS be !chat" — too prescriptive, SOULs should drive greetings naturally
- Keep gameplay tips (BUILDING, FARMING, HUNTING, etc.) — these are knowledge, not personality. Trim wordiness

### Group Social Architecture
- Replace "YOU TWO" section with "YOUR GROUP" — mention all agents exist, relationships emerge from SOUL files, no forced pair-bonding
- Inject partner names dynamically from connected agents list into prompt
- Remove "best friends" framing — let SOULs define relationships (Luna/Max are close but Ivy/Rust have their own dynamics)
- Chat loop prevention: keep 3-consecutive-chat limit but per-partner (not global) — prevents chatloop with one agent while still talking to others

### Proximity Chat & Vision
- 32-block proximity chat range — filter incoming chat messages by sender distance before injecting into conversation history
- Filter chat agent-side in mind/ — check sender position before injecting into history (no mod rebuild needed)
- Add 1-2 sentences to each SOUL file about when they look around (Rust scouts terrain, Luna evaluates builds) — prompt doesn't force it
- launch-quad.sh stagger interval: 30 seconds between agents (per existing launch-duo.sh pattern)

### Claude's Discretion
- Exact wording of trimmed Part 2 sections
- launch-quad.sh implementation details (tmux pane layout, port allocation)
- How dynamic partner names are gathered (mod API endpoint or file-based)
- Per-partner chat counter implementation details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- SOUL files already exist for all 4 agents: SOUL-luna.md, SOUL-max.md, SOUL-ivy.md, SOUL-rust.md
- launch-duo.sh — launch script pattern for 2 agents (Luna + Max), template for launch-quad.sh
- mind/prompt.js — system prompt builder with Part 1 (SOUL), Part 2 (rules), Part 3 (memory) structure
- mind/social.js — existing social/chat handling module
- mind/coordination.js — multi-agent coordination (task registry, activity broadcasting)

### Established Patterns
- AGENT_NAME env var selects SOUL file (SOUL-{name}.md)
- launch-duo.sh uses tmux panes with staggered starts and unique ports per agent
- Part 2 of prompt is a single large template literal in prompt.js buildSystemPrompt()
- Chat messages received via mod bridge HTTP API at /state endpoint

### Integration Points
- mind/prompt.js buildSystemPrompt() — where Part 2 lives, where "YOU TWO" section is
- mind/social.js — where chat messages are processed and filtered
- mind/index.js — where chat counter and loop prevention live
- infra/start-stack.sh — calls launch-duo.sh, needs update to launch-quad.sh
- config.js — loads AGENT_NAME and SOUL file

</code_context>

<specifics>
## Specific Ideas

- Luna SOUL already has rich personality — use as reference for how much personality should drive behavior vs prompt rules
- Per-partner chat tracking should reset on non-chat action (existing pattern from Phase 21 COO-02)
- Proximity filtering should use bot position data already available in /state response

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
