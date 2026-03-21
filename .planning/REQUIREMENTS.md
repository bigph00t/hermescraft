# Requirements: HermesCraft v2

**Defined:** 2026-03-21
**Core Value:** Agents feel and play like real people with spatial awareness, creativity, and genuine interaction

## v1 Requirements

### Server Migration

- [x] **SRV-01**: Paper 1.21.1 server running in Docker on Glass, replacing vanilla Fabric server
- [x] **SRV-02**: Existing Survival Island world migrated to Paper with correct directory structure
- [x] **SRV-03**: Both Fabric clients (HermesBridge + Baritone) connect and function on Paper server
- [x] **SRV-04**: World pre-generated with Chunky (2000 block radius) to eliminate exploration lag

### Plugin Stack

- [x] **PLG-01**: Timber/hTreecapitator installed — chop one log, whole tree falls
- [x] **PLG-02**: VeinMiner installed — mine one ore, get whole vein
- [x] **PLG-03**: AutoPickup/PickupBot installed — mined items go straight to inventory
- [x] **PLG-04**: EssentialsX + Vault installed — /home, /warp, /back, /pay, economy
- [x] **PLG-05**: mcMMO installed — RPG skill progression (mining, woodcutting, excavation, etc.) [AuraSkills used as equivalent alternative]
- [x] **PLG-06**: QuickShop-Hikari installed — player-to-player chest shops
- [x] **PLG-07**: LuckPerms installed — bot permissions configured
- [x] **PLG-08**: Skript installed — custom command framework
- [ ] **PLG-09**: BlockBeacon installed — /findblock for resource location [plugin not found, deferred to Skript]
- [x] **PLG-10**: ServerTap installed — REST API on port 4567 [port 4567 Docker exposure pending]
- [x] **PLG-11**: StopSpam installed — server-side chat dedup + rate limiting [5s cooldown, similarity detection configured]
- [x] **PLG-12**: Chunky installed — world pre-generation

### Spatial Awareness

- [x] **SAW-01**: Mod adds surfaceBlocks to state (isSkyVisible filter, Y-level restriction)
- [x] **SAW-02**: Agent uses look_at_block + break_block as PRIMARY interaction for visible blocks
- [x] **SAW-03**: Baritone #mine only used as FALLBACK when no visible blocks nearby
- [x] **SAW-04**: Baritone minYLevelWhileMining set to 55 for surface resources (logs, crops)
- [x] **SAW-05**: Switch to baritone-api-fabric jar for real isPathing() and programmatic settings
- [x] **SAW-06**: Vision (Haiku) descriptions drive block targeting — "trees to the left" → navigate left → look_at + break

### Agent Architecture

- [x] **ARC-01**: Brain-hands-eyes: planner writes action queue, action loop pops and executes without LLM
- [x] **ARC-02**: Action loop only calls LLM when queue empty, emergency, or chat received
- [x] **ARC-03**: Baritone tracker knows when mine/navigate is active, skips ticks while running
- [x] **ARC-04**: Chat messages sent by planner (Say: lines), not action loop
- [x] **ARC-05**: Chat dedup: planner tracks recent messages, skips similar content
- [x] **ARC-06**: No artificial token limits on any LLM call

### Plugin Integration

- [x] **INT-01**: Custom Skript: /scan <block> <radius> surface — find surface blocks with coords
- [x] **INT-02**: Custom Skript: /share-location <name> — broadcast location to all players
- [x] **INT-03**: Agent queries mcMMO skill levels and adapts behavior (specialize in what they're good at)
- [x] **INT-04**: Agent uses /home and /warp for fast travel
- [x] **INT-05**: Agent can set up QuickShop chest shops to trade surplus items
- [x] **INT-06**: Agent uses /findblock to locate specific resources
- [x] **INT-07**: Agent queries ServerTap REST API for server-side state when needed

### Agent Personality

- [x] **PER-01**: Agents build with aesthetic intent — choose locations for views, organize bases
- [x] **PER-02**: Agents try new things — fishing, gardening, decorating, exploring
- [x] **PER-03**: Agents have emotional responses — pride in builds, frustration when stuck, curiosity about new areas
- [x] **PER-04**: Agents specialize based on mcMMO skills — Jeffrey becomes a miner, John a builder (emergent)
- [x] **PER-05**: Agents trade with each other via QuickShop based on surplus/need
- [x] **PER-06**: Agents remember and reference their history naturally in conversation
- [x] **PER-07**: No meta-game language — agents talk about their world as real, never mention baritone/pathfinding/API

## v2 Requirements

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
| Scoreboard display | User doesn't want it |
| Custom Java Paper plugin | Use Skript instead for rapid iteration |
| Hostile mob combat | Peaceful mode — focus on building/cooperation |
| Multiple server instances | Single server is sufficient |
| Mod changes for plugin channels | HTTP bridge works fine, plugin channels are overkill |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SRV-01..04 | Phase 1 | Pending |
| PLG-01..12 | Phase 1 | Pending |
| SAW-01..06 | Phase 2 | Pending |
| ARC-01..06 | Phase 2 | Pending |
| INT-01..07 | Phase 3 | Pending |
| PER-01..07 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
