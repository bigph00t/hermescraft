# Phase 6: Cooperation & Exploration - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Agents work together as a community and explore the world beyond their base. Coordination happens ONLY through the Minecraft world (chat + proximity). No behind-the-scenes shared state.

</domain>

<decisions>
## Implementation Decisions

### Task Division
- **D-01:** Agents announce what they're doing in chat ("going mining", "building a farm"). Other agents read this and avoid duplicating work.
- **D-02:** Planner loop tracks what other agents said they're doing (from chat-history). Suggests complementary tasks.

### Resource Sharing
- **D-03:** Agent can drop items for others using existing `drop` action. Planner suggests sharing when it notices another agent mentioned needing something.
- **D-04:** Shared chests: agents can stock communal chests and announce contents in chat.

### Collective Building
- **D-05:** Agents discuss building plans in chat ("let's build a house by the beach"). One agent starts, others join by reading the chat and navigating to the build site.
- **D-06:** No formal build coordination system — emergence through chat and proximity, like real players.

### Exploration
- **D-07:** Agent marks home, ventures out, discovers interesting locations, navigates back.
- **D-08:** Agent reports findings via chat ("found a cave with iron at 200,40,100").
- **D-09:** Planner tracks "unexplored directions" — nudges agent toward areas it hasn't been.
- **D-10:** Named locations shared via chat — other agents can navigate to reported locations.

### Claude's Discretion
- How far to explore before returning
- When to suggest sharing resources
- Chat frequency during exploration

</decisions>

<canonical_refs>
## Canonical References

- `agent/chat-history.js` — Phase 3 chat history (coordination source)
- `agent/locations.js` — Named locations
- `agent/planner.js` — Planner loop (coordination logic)
- `agent/social.js` — Relationship tracking

</canonical_refs>

<specifics>
## Specific Ideas

- Coordination must feel natural — not robotic task assignment
- Agents should disagree sometimes ("I think we should build HERE not there")
- Exploration creates stories — agent comes back excited about what it found

</specifics>

<deferred>
## Deferred Ideas

- Formal trading system — future
- Leadership/role assignment — future
- Map sharing — future

</deferred>

---

*Phase: 06-cooperation*
*Context gathered: 2026-03-21*
