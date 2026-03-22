---
status: awaiting_human_verify
trigger: "agent-ignores-game-progression — AI agents spawn fresh, immediately try to mine stone/iron with bare hands, skip wood/tool progression entirely"
created: 2026-03-21T00:00:00Z
updated: 2026-03-21T00:03:00Z
---

## Current Focus

hypothesis: CONFIRMED — Three root causes verified and fixed.
test: All three fixes applied. 13/13 unit tests pass for validatePreExecution. Skill suppression verified for open_ended fresh spawn. GAMEPLAY_INSTRUCTIONS verified to contain TOOL PROGRESSION section.
expecting: Agents on fresh world will now: (1) see explicit rule that bare-hand stone = nothing, (2) not receive iron-age skill until they have a pickaxe, (3) have break_block rejected by validatePreExecution if they try to mine stone bare-handed.
next_action: Human verification — restart agents on fresh world and confirm they punch trees first.

## Symptoms

expected: Agents spawn fresh, punch trees for wood first, craft wooden pickaxe, then mine stone, then craft stone pickaxe, then find iron. Standard Minecraft progression.
actual: Agents immediately try to break stone with bare hands (157 ticks / 5+ minutes per block). One agent navigated underground to Y=123 looking for iron. Both have empty inventories after several minutes. They completely ignore that they need tools.
errors: No code errors — agents run fine. The LLM just makes terrible decisions about what to do.
reproduction: Start agents on a fresh world with empty inventories and wiped memory. They immediately go for stone/iron instead of wood.
started: Observed immediately after deploying v1.1 code and doing a full world + memory reset.

## Eliminated

- hypothesis: planner.js provides early-game guidance
  evidence: planner.js system prompt says "what resources do we have? what do we need next?" and lists resource-gathering, but has ZERO mention of tool hierarchy or wood-first requirement. No tool-prerequisite awareness anywhere in planner prompt.
  timestamp: 2026-03-21

- hypothesis: seed skills are always appropriate to current state
  evidence: getActiveSkill() scores minecraft-iron-age and minecraft-resource-gathering via keyword matching without checking inventory state. Phase-0 general skills (minecraft-resource-gathering) are ALWAYS injected if they differ from topSkill. When mode=open_ended, phase match scoring is 0, so scoring falls to keyword matching — "mining" keyword can push iron-age skill to top even with empty inventory.
  timestamp: 2026-03-21

- hypothesis: validatePreExecution blocks premature stone/ore mining
  evidence: validatePreExecution has NO case for break_block. It checks craft, equip, eat, navigate, smelt, place, smart_place, breed, fish — but break_block handler is entirely absent. No guard at all.
  timestamp: 2026-03-21

## Evidence

- timestamp: 2026-03-21
  checked: agent/goals.js — getCurrentPhase() for open_ended mode
  found: Returns OPEN_PHASE = { id:0, name:'Open World', description:'Explore, survive, build, respond', objectives:[], tips:[] }. Zero objectives. Zero tips. The rich Phase 1 "First Night" objectives (punch trees, craft wooden pickaxe, mine stone, upgrade) and tips are NEVER seen by the LLM in open_ended mode.
  implication: Agents in open_ended mode receive no structured "what to do first" guidance at all.

- timestamp: 2026-03-21
  checked: agent/prompt.js — GAMEPLAY_INSTRUCTIONS constant (lines 46-68)
  found: Line 54 says "FIRST PRIORITY: Get wood! Check surfaceBlocks for oak_log". Line 55 says "Tool tiers: wood→stone→iron→diamond." This is the ONLY tool-progression mention. It is a single compressed bullet. There is NO explicit rule saying "you cannot mine stone bare-handed", "stone requires a pickaxe", or "breaking stone with fists takes 157 ticks and drops nothing".
  implication: LLM sees a vague tier list but no hard prohibition. "First priority: get wood" competes with phase/planner context about iron/mining and often loses to the more specific skill advice.

- timestamp: 2026-03-21
  checked: agent/skills/minecraft-resource-gathering/SKILL.md (phase: 0, general skill)
  found: Under "Gathering ore": "Equip stone_pickaxe for iron/coal, iron_pickaxe for diamonds/gold." This is correct, but the skill is ALWAYS included (it's the general skill). The LLM sees guidance about finding iron_ore and navigating to lower Y levels in EVERY prompt — even tick 1 of a fresh spawn.
  implication: Even if the phase-matched skill is first-night, the general skill's ore-gathering guidance is also injected and competes. The LLM may anchor on the iron/cave content.

- timestamp: 2026-03-21
  checked: agent/skills.js — getActiveSkill() scoring (lines 148-231)
  found: In open_ended mode, phase match scoring is 0 for all skills. Keyword scoring fires on goalText — but open_ended has no goalText. Fallback fires: "if parts.length === 0 && skills.length > 0, return first available skill." First skill is list-order dependent. Also: general skills (phase===0) are ALWAYS appended as a second skill regardless of topSkill score.
  implication: Fresh spawn with open_ended mode + empty inventory + no goal text → skill selection is essentially random/order-dependent. The general skill (minecraft-resource-gathering) with its ore-navigation advice is always injected.

- timestamp: 2026-03-21
  checked: agent/actions.js — validatePreExecution break_block case
  found: No case exists for break_block in the switch statement (lines 150-268). The function returns { valid: true } for all break_block calls unconditionally.
  implication: Nothing prevents the agent from attempting to break stone, iron_ore, or diamond_ore with fists/wrong tool tier. The mod will happily accept the command; it just takes 157 ticks and drops nothing.

- timestamp: 2026-03-21
  checked: planner.js — system prompt (lines 611-695)
  found: The planner prompt mentions scan_blocks, set_home, shop creation — but has no mention of early-game tool progression, wood-first rule, or tool-tier requirements. It asks "what resources do we have, what do we need next?" which is open-ended enough that a fresh agent concludes "we need iron" without realizing we need a pickaxe first.
  implication: The planner actively generates plans that skip to iron/stone mining on fresh worlds.

## Resolution

root_cause: Three cooperating causes: (1) open_ended mode receives no structured early-game objectives — OPEN_PHASE has empty objectives/tips, leaving the LLM with no guidance on what to do first. (2) GAMEPLAY_INSTRUCTIONS mentioned tool tiers in one vague bullet but never stated the hard rule: bare hands cannot mine stone (yields nothing) and you MUST get wood before any mining. (3) validatePreExecution had no break_block guard to reject attempts to mine stone/ore without the required tool tier.

fix: Three targeted changes applied:
  (1) agent/prompt.js — Added 9-line TOOL PROGRESSION section to GAMEPLAY_INSTRUCTIONS with explicit rules: bare hands = dirt/sand/leaves/logs only; breaking stone bare-handed = 157 ticks + drops nothing; PROGRESSION ORDER stated explicitly.
  (2) agent/skills.js — Added detectBootstrapState() helper and MINING_SKILL_NAMES blocklist. getActiveSkill() now filters out iron-age, diamonds, nether, blaze, ender-pearls, dragon-fight skills when agent has no pickaxe in inventory. Fresh spawn gets first-night + resource-gathering skills only.
  (3) agent/actions.js — Added break_block case to validatePreExecution with three-tier check: stone-class blocks require wooden_pickaxe; iron_ore/coal_ore/lapis require stone_pickaxe; diamond_ore/gold_ore/redstone/obsidian require iron_pickaxe. Error messages name the exact required crafting steps.

verification: 13/13 unit tests pass for break_block validation. Skill suppression verified: minecraft-iron-age absent from fresh spawn, present after stone_pickaxe added. GAMEPLAY_INSTRUCTIONS verified to contain new TOOL PROGRESSION block.
files_changed: [agent/prompt.js, agent/skills.js, agent/actions.js]
