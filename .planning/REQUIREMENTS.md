# Requirements: HermesCraft

**Defined:** 2026-03-22
**Core Value:** Agents must feel and play like real people — creative, emotional, with the ability to interact with the world around them

## v2.1 Requirements

Requirements for Creative Building + Bug Fixes milestone.

### Bug Fixes

- [x] **FIX-01**: v2.0 live testing — bot connects, stays alive, and responds to chat on Paper 1.21.1 server
- [x] **FIX-02**: v2.0 live testing — all 11 registry commands (!gather through !withdraw) execute without errors

### Creative Building

- [ ] **CBUILD-01**: Player says "build a dock here" and the bot generates a valid blueprint JSON and begins placing blocks at the specified location
- [ ] **CBUILD-02**: Player says "use stone on this wall" and the bot modifies the active build plan to use the specified material
- [x] **CBUILD-03**: Bot generates structurally valid JSON blueprints from natural language descriptions (floor, walls, roof layers in correct order)
- [x] **CBUILD-04**: System prompt includes 10+ reference blueprints as few-shot examples for LLM-generated designs
- [ ] **CBUILD-05**: Bot scans a 3D region with bot.blockAt() and reports what blocks exist, enabling it to see its own builds

### Build Memory

- [ ] **BMEM-01**: Build history (what was built, where, when, by whom) persists across sessions in per-agent data dir
- [ ] **BMEM-02**: Bot returns to a previous build site and extends/modifies the structure without being told which blocks are already placed (uses scan)

## Future Requirements

### Gameplay Progression
- **GAME-01**: Tier advancement — progress through wood → stone → iron → diamond
- **GAME-02**: Exploration — discover and name new areas
- **GAME-03**: Farming — automated crop and animal farms

### Scaling
- **SCALE-01**: Support 5-10 agents simultaneously
- **SCALE-02**: Agent personality generation from templates

## Out of Scope

| Feature | Reason |
|---------|--------|
| Fabric client mod | Replaced by Mineflayer in v2.0 |
| Vision/screenshots | Mineflayer provides world state via blockAt() |
| Nether exploration | Future milestone |
| Redstone contraptions | Future milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 7 | Complete |
| FIX-02 | Phase 7 | Complete |
| CBUILD-03 | Phase 8 | Complete |
| CBUILD-04 | Phase 8 | Complete |
| CBUILD-01 | Phase 9 | Pending |
| CBUILD-02 | Phase 9 | Pending |
| CBUILD-05 | Phase 9 | Pending |
| BMEM-01 | Phase 10 | Pending |
| BMEM-02 | Phase 10 | Pending |

**Coverage:**
- v2.1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
