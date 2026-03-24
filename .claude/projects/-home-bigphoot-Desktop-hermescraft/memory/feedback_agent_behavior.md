---
name: Agent behavior tuning priorities
description: Key behavioral issues observed during live testing — chat frequency, tool equipping, spatial awareness, building ambition
type: feedback
---

Agents need to chat MORE and from the START. Two best friends playing together — always talking back and forth. The model tends to prioritize actions over chat in early game. Need strong social nudging.

Agents sometimes mine with fists instead of equipping their pickaxe. RAG should inject "equip your best tool before mining" when mining actions happen.

Spatial awareness needs work — agents mine themselves into tunnels then complain they're stuck in a pit. They need to understand that if they just mined blocks, they created the hole and can walk back the way they came.

Building should be ambitious — large, diverse, creative structures. Not just tiny shelters. Encourage them to think big and build a real settlement with varied architecture.

**Why:** Live testing showed agents being too quiet, too survival-focused, not creative enough. User wants best-friends-playing-together energy with ambitious building.

**How to apply:** Prompt tuning, RAG query improvements, spatial context enrichment. Always err on the side of more social, more creative, more ambitious.
