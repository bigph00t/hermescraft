# Phase 5: Automatic Skill Learning - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents automatically get better over time — learning from successes, avoiding past mistakes, building reusable skill knowledge without explicit programming.

</domain>

<decisions>
## Implementation Decisions

### Experience-Based Skills
- **D-01:** When agent completes a multi-step task successfully (built house, farmed crops, survived night), planner loop auto-generates a skill entry capturing the action sequence.
- **D-02:** Skills stored in existing agent/data/{name}/skills/ directory using SKILL.md format.
- **D-03:** Skill effectiveness tracked — skills that lead to deaths or failures get downgraded.

### Background Reflection
- **D-04:** Planner loop already runs every 60s. Extend with reflection: "what worked well this session? what went wrong? what should I do differently?"
- **D-05:** Reflection output written to autobiography.jsonl as "reflection" type entries.
- **D-06:** Every 5 minutes, planner does a deeper review — consolidates recent actions into lessons.

### Death Avoidance
- **D-07:** Existing death recording (memory.js) already captures lessons. Extend: planner reads death lessons and injects "avoid doing X near Y" into plan-context.txt when agent is in similar situation.
- **D-08:** Pattern matching: if agent is near coordinates where it died before, planner warns via context.

### Claude's Discretion
- Skill quality threshold (how many successes before a skill is "learned")
- Reflection prompt wording
- How many skills to inject into prompt (token budget)

</decisions>

<canonical_refs>
## Canonical References

- `agent/skills.js` — Existing skill system
- `agent/memory.js` — Death recording, lessons
- `agent/planner.js` — Planner loop (reflection lives here)

</canonical_refs>

<specifics>
## Specific Ideas

- Skills should feel like muscle memory — agent gets faster and more efficient at repeated tasks
- Reflection should be brief — not essays, just key takeaways

</specifics>

<deferred>
## Deferred Ideas

- Skill sharing between agents — Phase 6
- Semantic skill retrieval — future

</deferred>

---

*Phase: 05-skill-learning*
*Context gathered: 2026-03-21*
