# Phase 4: Human-Like Behavior - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents behave like real people: work during day, seek shelter at night, have idle behaviors, respond to needs (hunger/safety/social/boredom), and socialize during downtime.

</domain>

<decisions>
## Implementation Decisions

### Day/Night Cycle
- **D-01:** Planner loop detects time of day from game state. Writes behavior mode to plan-context.txt: "work" (day), "shelter" (dusk), "social" (night in shelter), "sleep" (late night).
- **D-02:** Action loop reads behavior mode and adjusts: during "work" → gather/build/farm. During "shelter" → navigate home. During "social" → chat with nearby players. During "sleep" → stay in shelter, occasional notepad updates.

### Needs System
- **D-03:** Planner loop calculates needs every 60s from game state: hunger (food level), safety (health, nearby hostiles), social (time since last chat), creative (time since last build). Writes priority need to plan-context.txt.
- **D-04:** Action loop prioritizes actions based on highest need: hungry → eat/farm. Unsafe → fight/flee/shelter. Lonely → chat/find players. Bored → explore/build.

### Idle Behavior
- **D-05:** When no urgent need and daytime, agent picks from idle behaviors: look around (random yaw changes), organize inventory, wander near home, inspect own builds via vision.
- **D-06:** Idle behaviors are just regular tool calls — no new tools needed. LLM picks based on "no urgent task" context from planner.

### Night Socialization
- **D-07:** When in shelter at night with other players nearby, agent prioritizes chatting. Planner writes "social time — chat with nearby players about the day" to context.
- **D-08:** Agent references autobiography entries (from Phase 3) to have natural conversations about shared experiences.

### Claude's Discretion
- Exact need thresholds
- Idle behavior weighting
- How long "social time" lasts at night

</decisions>

<canonical_refs>
## Canonical References

### Phase Dependencies
- `agent/planner.js` — Planner loop (needs system + behavior mode calculated here)
- `agent/prompt.js` — Prompt builder (injects behavior mode + needs)
- `agent/index.js` — Action loop (reads behavior context)
- Phase 3 autobiography for natural conversation references

</canonical_refs>

<specifics>
## Specific Ideas

- Behavior should feel emergent, not scripted. The planner suggests, the LLM decides.
- Night socialization is what makes agents feel real — sitting by a fire chatting about the day.
- Needs system drives behavior naturally — hungry agent farms, scared agent builds walls, bored agent explores.

</specifics>

<deferred>
## Deferred Ideas

- Emotional state display (showing mood in chat) — future
- Complex social dynamics (jealousy, competition) — Phase 6

</deferred>

---

*Phase: 04-human-behavior*
*Context gathered: 2026-03-21 via smart discuss*
