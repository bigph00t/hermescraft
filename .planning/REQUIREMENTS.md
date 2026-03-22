# Requirements: HermesCraft

**Defined:** 2026-03-22
**Core Value:** Agents must feel and play like real people — creative, emotional, with the ability to interact with the world around them

## v2.0 Requirements

Requirements for Mineflayer Rewrite milestone.

### Bot Foundation

- [x] **BOT-01**: Mineflayer bot connects to Paper 1.21.1 server in offline mode and spawns successfully
- [x] **BOT-02**: Bot navigates to any reachable coordinate using mineflayer-pathfinder with wall-clock timeout on unreachable goals
- [x] **BOT-03**: Bot digs blocks using bot.dig() with post-dig verification (block actually changed)
- [x] **BOT-04**: Bot places blocks using bot.placeBlock() with post-place verification
- [x] **BOT-05**: Cooperative interrupt system — all skill functions check interrupt flag and yield cleanly

### Gameplay Skills

- [x] **SKILL-01**: Gather skill — collect N of a resource (find nearest, pathfind, dig, repeat)
- [x] **SKILL-02**: Mine skill — mine ore with auto-best-tool selection
- [x] **SKILL-03**: Craft skill — resolve full dependency chain and craft (BFS solver)
- [x] **SKILL-04**: Smelt skill — place/find furnace, load fuel + input, wait for output
- [x] **SKILL-05**: Build skill — place blocks from a structured plan, verify each placement
- [x] **SKILL-06**: Combat skill — attack hostile mobs, flee when low health
- [x] **SKILL-07**: Chest skill — deposit/withdraw items from chests, remember chest locations
- [x] **SKILL-08**: Inventory management — equip best tools/armor, eat when hungry

### Mind Loop

- [x] **MIND-01**: Event-driven LLM — fires on idle (2s no action), chat received, or skill completion
- [x] **MIND-02**: Command registry — LLM calls skills by name (!command pattern)
- [x] **MIND-03**: Conversation history — 40-turn rolling window with graduated trimming
- [x] **MIND-04**: Self-prompter — when idle with no goal, LLM re-evaluates and picks next action

### Autonomous Modes

- [x] **MODE-01**: Self-preservation — auto-eat, flee fire/lava/drowning, no LLM needed
- [x] **MODE-02**: Self-defense — attack hostile mobs targeting the bot
- [x] **MODE-03**: Unstuck detection — detect and recover from pathfinder hangs or wall-stuck
- [x] **MODE-04**: Idle behaviors — look at nearby entities randomly, feel alive
- [x] **MODE-05**: Item collection — auto-pickup nearby dropped items

### Personality & Social

- [x] **SOUL-01**: SOUL file loading — Jeffrey and John with distinct personalities, creative drives
- [x] **SOUL-02**: Persistent memory — lessons, strategies, world knowledge across sessions
- [x] **SOUL-03**: Natural grounded chat — only reference real game state, never hallucinate
- [x] **SOUL-04**: Multi-agent coordination — 2 bots on same server, chat naturally, cooperate
- [x] **SOUL-05**: Day/night behavior — work during day, shelter at night, social in evening

### Creative Building

- [x] **BUILD-01**: Agents build real structures — walls, roof, floor — not single blocks
- [ ] **BUILD-02**: Emergent creative behavior — agents choose what to build based on personality and context
- [ ] **BUILD-03**: Base expansion over time — keep improving builds across sessions

## Future Requirements

### Scaling
- **SCALE-01**: Support 5-10 agents simultaneously
- **SCALE-02**: Agent personality generation from templates

### Advanced Gameplay
- **ADV-01**: Nether exploration
- **ADV-02**: Enchanting and brewing
- **ADV-03**: Redstone contraptions and automated farms
- **ADV-04**: Ender Dragon quest line

## Out of Scope

| Feature | Reason |
|---------|--------|
| Fabric client mod (HermesBridge) | Replaced by Mineflayer |
| Baritone | Replaced by mineflayer-pathfinder |
| Vision/screenshots (Claude Haiku) | Mineflayer provides world state directly |
| 3-loop architecture | Replaced by Mind + Body |
| HTTP bridge | Mineflayer is direct API |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BOT-01 | Phase 1 | Complete |
| BOT-02 | Phase 1 | Complete |
| BOT-03 | Phase 1 | Complete |
| BOT-04 | Phase 1 | Complete |
| BOT-05 | Phase 1 | Complete |
| SKILL-01 | Phase 1 | Complete |
| SKILL-02 | Phase 1 | Complete |
| SKILL-03 | Phase 2 | Complete |
| SKILL-04 | Phase 2 | Complete |
| SKILL-05 | Phase 6 | Complete |
| SKILL-06 | Phase 4 | Complete |
| SKILL-07 | Phase 2 | Complete |
| SKILL-08 | Phase 2 | Complete |
| MIND-01 | Phase 3 | Complete |
| MIND-02 | Phase 3 | Complete |
| MIND-03 | Phase 3 | Complete |
| MIND-04 | Phase 3 | Complete |
| MODE-01 | Phase 4 | Complete |
| MODE-02 | Phase 4 | Complete |
| MODE-03 | Phase 4 | Complete |
| MODE-04 | Phase 4 | Complete |
| MODE-05 | Phase 4 | Complete |
| SOUL-01 | Phase 5 | Complete |
| SOUL-02 | Phase 5 | Complete |
| SOUL-03 | Phase 5 | Complete |
| SOUL-04 | Phase 5 | Complete |
| SOUL-05 | Phase 5 | Complete |
| BUILD-01 | Phase 6 | Complete |
| BUILD-02 | Phase 6 | Pending |
| BUILD-03 | Phase 6 | Pending |

**Coverage:**
- v2.0 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 — traceability populated after v2.0 roadmap creation*
