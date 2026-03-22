---
status: fixing
trigger: "agents declare base complete after placing 1-2 blocks"
created: 2026-03-22T00:00:00Z
updated: 2026-03-22T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — four files lacked architectural standards, letting any block placement satisfy "build a base"
test: Applied fixes to all four identified files
expecting: LLM now sees explicit minimum structure requirements in planner system prompt, updated building.md, concrete OPEN_PHASE objectives, and creative behavior blocks that demand real structures
next_action: await human verification

## Symptoms

expected: Agent plans and executes multi-block structures (walls, roof, floor, door). Building takes many minutes. Build goal persists across planner cycles. Base expands over time.
actual: Agent places 1-2 blocks (a plank, a crafting table) and declares "base complete". Planner moves on. No persistence of building ambition.
errors: Not a code error — the LLM doesn't understand what constitutes a real building in Minecraft.
reproduction: Let agents run for 5-10 minutes. Watch them "build a base" by placing a single block.
started: Ongoing since agents started building.

## Eliminated

- hypothesis: freestyle.js execution is broken / not being called
  evidence: The planner output format shows "freestyle plan_file.md | reason" as a valid action. The module exists and has proper parse/execute logic. Code path is functional.
  timestamp: 2026-03-22T00:00:00Z

- hypothesis: The old blueprint system is causing tiny buildings
  evidence: blueprints.js still exists but knowledge/building.md references build(blueprint="small-cabin"). However the actual size issue is not the blueprint — it's that the LLM never even gets to blueprints or freestyle. It places 1-2 blocks manually via smart_place and declares done.
  timestamp: 2026-03-22T00:00:00Z

## Evidence

- timestamp: 2026-03-22T00:00:00Z
  checked: agent/knowledge/building.md
  found: Entire building knowledge document describes OLD blueprint system (build tool, small-cabin blueprint). No mention of freestyle system. No mention of minimum structure size. No architectural standards.
  implication: The LLM is taught "build(blueprint='small-cabin')" but that tool likely doesn't exist anymore, or the LLM ignores it. No guidance on what a real building looks like.

- timestamp: 2026-03-22T00:00:00Z
  checked: planner.js lines 676-688 (building plan format in system prompt)
  found: Planner shows only the freestyle format template with no examples of a real structure. No minimum size requirement. No concept of walls/roof/floor/door. No statement that "placing 1 block is not a structure".
  implication: LLM sees a format but has no standard to meet. Easy path is to place 1 block and call it done.

- timestamp: 2026-03-22T00:00:00Z
  checked: goals.js OPEN_PHASE objectives
  found: "Build a shelter before nightfall" and "Build something you are proud of" — completely vague. No block count, no room requirement, no minimum dimensions.
  implication: LLM satisfies "Build a shelter" by placing a crafting table.

- timestamp: 2026-03-22T00:00:00Z
  checked: planner.js getCreativeBehaviorBlock() for jeffrey/john/alex/anthony
  found: Jeffrey: "Builds with VIEW: elevated spots near water". John: "FUNCTIONALLY: straight rows, labeled chests". Alex: "must build something every session — even a window or path extension counts". None define minimum structure requirements.
  implication: Alex's "even a window counts" actively encourages micro-builds. Jeffrey/John have no floor/wall/roof expectations.

- timestamp: 2026-03-22T00:00:00Z
  checked: prompt.js GAMEPLAY_INSTRUCTIONS work mode hint
  found: "When you build, think about WHERE and WHY" and "Look at what you've built. Does it look good? Could you add something? A window? A porch?" — adds on to existing build but doesn't define minimum build size.
  implication: Good reinforcement but no floor for what "build" means.

- timestamp: 2026-03-22T00:00:00Z
  checked: freestyle.js block cap
  found: Blocks truncated to 200 max. Soft cap with warning. This is fine — 200 blocks is more than enough for a cabin.
  implication: Not the bottleneck.

## Resolution

root_cause: Four compounding failures:
  1. agent/knowledge/building.md was entirely wrong — described old blueprint system (build tool + small-cabin), taught the LLM nothing about real structure design, no minimum sizes.
  2. Planner system prompt showed only the freestyle FORMAT with no STANDARDS — no minimum size, no required components (walls/roof/door), no definition of when a structure is "done".
  3. OPEN_PHASE objectives in goals.js were vague — "Build a shelter" with no block count or dimension requirement. The LLM satisfied this with one block.
  4. Creative behavior blocks lacked concrete building expectations — Alex's "even a window counts" actively encouraged micro-builds.

fix: Applied to four files:
  1. agent/knowledge/building.md — full rewrite: what counts as a shelter (5x5+, 3-block walls, roof, entrance, ~100 blocks), what does NOT count (single blocks, crafting tables), worked example, freestyle workflow, expansion expectations.
  2. agent/planner.js — added BUILDING STANDARDS block before the "Consider:" section: explicit rules that A SHELTER = 5x5 floor + 3-block walls + roof, a single block is not a structure, never declare done until walls+roof+floor are placed, base is never truly done.
  3. agent/goals.js — updated OPEN_PHASE objectives: "Build a real shelter: 5x5 or larger, 3-block walls on all sides, roof, entrance — use the freestyle system"
  4. agent/planner.js getCreativeBehaviorBlock() — updated jeffrey/john/alex/anthony to require real structures: removed "even a window counts", added "building means 5x5+ floor, walls, roof, door — not decorating with single blocks"
  5. agent/prompt.js work mode hint — replaced "add a window?" with "COMMIT to a real structure: walls on all 4 sides, 3 blocks tall, roof, entrance. A shelter is 100+ blocks placed, not 1-2."

verification: empty until verified
files_changed:
  - agent/knowledge/building.md
  - agent/planner.js
  - agent/goals.js
  - agent/prompt.js
