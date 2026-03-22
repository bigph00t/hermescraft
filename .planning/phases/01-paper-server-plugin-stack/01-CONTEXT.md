# Phase 1: Paper Server + Plugin Stack - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate the Minecraft server from vanilla Fabric to Paper 1.21.1 and install 12 plugins. Both Fabric clients (HermesBridge + Baritone) must connect and work. All plugins verified functional.

</domain>

<decisions>
## Implementation Decisions

### Server Migration
- **D-01:** Download Paper 1.21.1 jar (build #133), run in Docker on Glass replacing the current Fabric server jar
- **D-02:** Migrate Survival Island world files — overworld copies directly, reorganize Nether/End dirs per Paper migration guide
- **D-03:** Keep server.properties settings: peaceful difficulty, survival mode, same world name
- **D-04:** Docker setup: same memory limits (3G max, 2G min), same port (25565)

### Plugin Installation
- **D-05:** Install all 12 plugins: Timber, VeinMiner, AutoPickup, EssentialsX+Vault, mcMMO, QuickShop-Hikari, LuckPerms, Skript, BlockBeacon, ServerTap, StopSpam, Chunky
- **D-06:** Download from official sources (Hangar, Modrinth, SpigotMC, GitHub)
- **D-07:** Configure LuckPerms: create "bot" group with access to all plugin commands
- **D-08:** Configure StopSpam: 5-second cooldown between messages, similarity detection enabled
- **D-09:** Configure EssentialsX economy: starting balance 100, enable /home /warp /back /pay
- **D-10:** Pre-generate world with Chunky: 2000 block radius from spawn

### Verification
- **D-11:** Test: chop one log → Timber fells whole tree
- **D-12:** Test: mine one ore → VeinMiner gets whole vein
- **D-13:** Test: break any block → AutoPickup sends to inventory
- **D-14:** Test: both Fabric clients connect, HermesBridge HTTP API works, Baritone pathfinding works
- **D-15:** Test: ServerTap REST API accessible at port 4567

### Claude's Discretion
- Plugin config details not specified above
- mcMMO skill multipliers and leveling curves
- QuickShop default settings
- Exact Chunky pre-gen parameters

</decisions>

<specifics>
## Specific Ideas

- Paper 1.21.1 build #133 from papermc.io
- VeinMiner by 2008Choco (GitHub)
- Timber from Hangar (hTreecapitator also acceptable)
- AutoPickup from Hangar (PickupBot from Modrinth also acceptable)
- EssentialsX from essentialsx.net + Vault from SpigotMC
- mcMMO latest for 1.21.x
- QuickShop-Hikari from SpigotMC
- LuckPerms from luckperms.net
- Skript from Hangar (SkriptLang)
- BlockBeacon from GitHub (ThreeFour-Plugins)
- ServerTap from GitHub (servertap-io)
- StopSpam from Hangar
- Chunky from Hangar

</specifics>

<deferred>
## Deferred Ideas

- Custom Java Paper plugin — using Skript instead for v2
- Plugin messaging channels between Fabric mod and Paper — HTTP bridge sufficient for now
- Additional plugins (Citizens, Denizen) — evaluate after core stack works

</deferred>

---

*Phase: 01-paper-server-plugin-stack*
*Context gathered: 2026-03-21 via autonomous — infrastructure phase*
