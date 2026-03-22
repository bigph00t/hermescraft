# Requirements: HermesCraft

**Defined:** 2026-03-21
**Core Value:** Agents must feel and play like real people — creative, emotional, with desires, aesthetic sense, and the ability to interact with what they see

## v1.1 Requirements

Requirements for Tool Quality & Building Intelligence milestone. Each maps to roadmap phases.

### Tool Fixes

- [x] **TOOL-01**: Agent can place blocks reliably using support block + face direction (auto-equip from full inventory)
- [x] **TOOL-02**: All LLM-generated item names are normalized to valid MC 1.21.1 registry names before dispatch
- [x] **TOOL-03**: Mine action is removed — all block breaking uses look_at_block + break_block only
- [x] **TOOL-04**: Sustained action lock timeout clears properly so subsequent actions are never permanently blocked

### Chest Interaction

- [x] **CHEST-01**: Agent can deposit items into a nearby chest
- [x] **CHEST-02**: Agent can withdraw specific items from a nearby chest

### Crafting Intelligence

- [ ] **CRAFT-01**: Agent has access to full MC 1.21.1 recipe database via minecraft-data
- [ ] **CRAFT-02**: Agent can resolve crafting dependency chains (e.g. oak_log → planks → sticks → wooden_pickaxe) in a single plan step

### Building Intelligence

- [ ] **BUILD-01**: Agent can design structures via LLM-generated markdown building plans stored in context files
- [ ] **BUILD-02**: Agent executes building plans block-by-block using smart place action
- [ ] **BUILD-03**: Agent tracks all placed blocks persistently (block type, position, timestamp)
- [ ] **BUILD-04**: Agent verifies completed builds against original plan using vision + block tracking

### Spatial Memory

- [ ] **SPACE-01**: Agent maintains typed resource patches (ore veins, tree clusters, build sites) in persistent spatial memory
- [ ] **SPACE-02**: Spatial memory is proximity-filtered when injected into prompts (prevents unbounded growth)

### Server Scripts

- [ ] **SCRIPT-01**: New Skript wrappers provide server-side assistance for agent operations (e.g. /where, /nearbyplayers, /checkblock)

## v1.0 Requirements (Validated)

All shipped and verified in v1.0 milestone. See MILESTONES.md for details.

- ✓ Paper 1.21.1 server with 12 plugins — v1.0
- ✓ Brain-hands-eyes 3-loop architecture — v1.0
- ✓ Surface-first spatial awareness — v1.0
- ✓ 37 agent tools (29 game + 8 plugin) — v1.0
- ✓ Creative intelligence with BUILD vision evaluation — v1.0
- ✓ Deep SOUL personalities with anti-meta-game enforcement — v1.0

## Future Requirements

Deferred to next milestone. Tracked but not in current roadmap.

### Navigation

- **NAV-01**: Agent auto-navigates home when >150 blocks from base (base tether)

### Communication

- **COMM-01**: Agent always responds to human messages before any other action (priority response)

### Scaling

- **SCL-01**: Support 5-10 agents simultaneously
- **SCL-02**: Agent personality generation from templates

### Advanced Gameplay

- **ADV-01**: Nether exploration and resource gathering
- **ADV-02**: Enchanting and brewing systems
- **ADV-03**: Redstone contraptions and automated farms

### Social

- **SOC-01**: Agent-to-agent conflict and resolution
- **SOC-02**: Leadership emergence and role specialization
- **SOC-03**: Shared building projects with role assignment

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mineflayer integration | Different architecture — fix existing mod-based primitives instead |
| LLM-generated block coordinates | Root cause of current failures — LLM designs high-level, agent executes deterministically |
| Real-time voxel world map | Enormous memory cost for marginal gain over named POI map |
| Automatic recipe discovery | Non-deterministic, hard to debug — use static recipe database |
| Chest auto-scan every tick | Causes visual glitch, rate limiting — scan only on explicit interaction |
| Baritone #mine re-use | Routes underground regardless of surface intent — committed to look+break |
| AuraSkills PlaceholderAPI | Not blocking gameplay — skill levels show as 0 |
| ServerTap Docker exposure | Monitoring nicety, not blocking agent behavior |
| Multi-agent cooperation tasks | Agents must be individually functional first |
| Scoreboard display | User doesn't want it |
| Custom Java Paper plugin | Use Skript instead for rapid iteration |
| Hostile mob combat | Peaceful mode — focus on building/cooperation |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOOL-01 | Phase 5 | Complete |
| TOOL-02 | Phase 5 | Complete |
| TOOL-03 | Phase 5 | Complete |
| TOOL-04 | Phase 5 | Complete |
| CHEST-01 | Phase 5 | Complete |
| CHEST-02 | Phase 5 | Complete |
| CRAFT-01 | Phase 6 | Pending |
| CRAFT-02 | Phase 6 | Pending |
| BUILD-01 | Phase 7 | Pending |
| BUILD-02 | Phase 7 | Pending |
| BUILD-03 | Phase 7 | Pending |
| BUILD-04 | Phase 7 | Pending |
| SPACE-01 | Phase 8 | Pending |
| SPACE-02 | Phase 8 | Pending |
| SCRIPT-01 | Phase 8 | Pending |

**Coverage:**
- v1.1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 — v1.1 roadmap created, all 15 requirements mapped*
