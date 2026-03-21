# Requirements: HermesCraft Life Simulation

**Defined:** 2026-03-20
**Core Value:** Agents must feel alive — indistinguishable from real players at casual glance

## v1 Requirements

### Building

- [x] **BUILD-01**: Agent can construct a basic 5x5 house (walls, roof, door, floor)
- [x] **BUILD-02**: Agent chooses contextually appropriate materials (wood near forests, stone near caves)
- [x] **BUILD-03**: Agent can build a fenced animal pen
- [x] **BUILD-04**: Agent can build a crop farm plot (tilled rows with water source)

### Farming & Food

- [ ] **FARM-01**: Agent can till soil, plant seeds, and harvest wheat
- [ ] **FARM-02**: Agent can breed animals (cows with wheat, chickens with seeds)
- [ ] **FARM-03**: Agent can craft fishing rod and fish
- [ ] **FARM-04**: Agent can cook food in furnace
- [ ] **FARM-05**: Agent plants saplings to renew wood supply

### Memory

- [ ] **MEM-01**: Agent remembers home location and navigates back from anywhere
- [ ] **MEM-02**: Agent remembers contents of chests it placed
- [ ] **MEM-03**: Agent remembers past conversations and references them naturally
- [ ] **MEM-04**: Agent maintains autobiographical memory ("I built this on day 1")
- [ ] **MEM-05**: Agent tracks relationship trust/sentiment that persists across sessions

### Behavior

- [ ] **BEHAV-01**: Agent works during day, seeks shelter at night
- [ ] **BEHAV-02**: Agent has idle behaviors (look around, organize inventory, wander near home)
- [ ] **BEHAV-03**: Agent responds to needs (hunger → find food, danger → fight/flee, boredom → explore)
- [ ] **BEHAV-04**: Agent socializes at night (chat by fire, share stories)

### Skills

- [ ] **SKILL-01**: Agent learns new skills from experience (first successful craft = remembered)
- [ ] **SKILL-02**: Background reflection updates long-term memory periodically
- [ ] **SKILL-03**: Agent avoids repeating mistakes (death lessons applied automatically)

### Cooperation

- [ ] **COOP-01**: Agents can divide tasks ("I'll get wood, you mine stone")
- [ ] **COOP-02**: Agents share resources (drop items for each other)
- [ ] **COOP-03**: Agents agree on building locations and build collectively

### Navigation

- [ ] **NAV-01**: Agent establishes and returns to home base
- [ ] **NAV-02**: Agent explores and reports findings to group via chat
- [ ] **NAV-03**: Agent names and remembers discovered locations

## v2 Requirements

### Advanced Building
- **BUILD-05**: Multi-room structures
- **BUILD-06**: Glass windows, lantern lighting
- **BUILD-07**: Bridges and pathways

### Advanced Social
- **DRAMA-01**: Disagreements that affect cooperation
- **DRAMA-02**: Personality-driven resource hoarding/sharing
- **COOP-04**: Barter trading system
- **SKILL-04**: Agents teach each other skills

### Advanced Navigation
- **NAV-04**: Boat crafting and ocean exploration
- **NAV-05**: Map creation and sharing

### Vision
- **VIS-01**: Screenshot capture from mod
- **VIS-02**: MiniMax vision model for spatial awareness

## Out of Scope

| Feature | Reason |
|---------|--------|
| Redstone circuits | Too complex, low visual impact |
| Nether/End progression | Overworld island focus |
| PvP combat systems | Conflict from personality, not mechanics |
| Custom mod features | Keep mod thin |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUILD-01..04 | Phase 1 | Complete |
| FARM-01..05 | Phase 2 | Pending |
| MEM-01..05 | Phase 3 | Pending |
| BEHAV-01..04 | Phase 4 | Pending |
| SKILL-01..03 | Phase 5 | Pending |
| COOP-01..03, NAV-01..03 | Phase 6 | Pending |

**Coverage:** 26 v1 requirements, 26 mapped, 0 unmapped ✓

---
*Requirements defined: 2026-03-20*
