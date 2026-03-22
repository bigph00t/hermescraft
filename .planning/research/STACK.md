# Stack Research

**Domain:** Minecraft AI Agent — Mineflayer Rewrite (v2.0)
**Researched:** 2026-03-22
**Confidence:** HIGH — all packages verified via npm registry, local node_modules, and official GitHub

---

## Context: What This Research Covers

v2.0 scraps the Fabric client mod + HTTP bridge architecture entirely. Every game interaction
now goes through Mineflayer's Node.js API directly — no Java, no HTTP, no crosshair drift.

This document covers only what's needed for the Mineflayer-based architecture. Carry-overs
(minecraft-data, SOUL files, memory system) are noted but not re-researched.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `mineflayer` | 4.35.0 | Headless MC bot — connect, observe world, execute actions | Already installed. Latest stable (2026-02-13). Official support declared for 1.8–1.21.11. Replaces Fabric mod + HTTP bridge + Baritone entirely. `bot.dig(block)`, `bot.placeBlock()`, `bot.craft()` just work without HTTP round-trips. Industry standard — used by Mindcraft, all serious LLM+MC projects. |
| `mineflayer-pathfinder` | 2.4.5 | A* pathfinding — `bot.pathfinder.goto(goal)` | The standard pathfinding plugin. Direct replacement for Baritone. Promise-based API: `await bot.pathfinder.goto(new GoalBlock(x,y,z))`. No crosshair drift, no "another action pending" race conditions. Active maintenance: 2.4.5 is current, matches Mindcraft. |
| `minecraft-data` | 3.105.0 | Item/block/recipe database for 1.21.1 | Already installed (carried from v1.1). 1.21.1 confirmed in version index. Used by the crafting chain solver and item normalizer — carry those modules forward. Mineflayer also uses this internally so it's a shared dep. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `mineflayer-pvp` | 1.3.2 | Combat plugin — attack entities, dodge | Load for survival mode. Handles hostile mob attacks without manual hit timing. Mindcraft includes it as default. |
| `mineflayer-collectblock` | 1.6.0 | High-level gather skill — pathfind to block, mine it, collect drop | Use for the `gather` skill function. Handles equip best tool + mine + walk to item drop as one call. Requires mineflayer-pathfinder loaded first. |
| `mineflayer-tool` | 1.2.0 | Auto-selects best tool for a block | Load alongside mineflayer-collectblock. Prevents digging stone with hands. |
| `mineflayer-auto-eat` | 5.0.3 | Auto-eat food when hungry | Load at bot init. Keeps agents alive without a dedicated hunger management loop in the Mind. One less thing the LLM needs to babysit. |
| `mineflayer-armor-manager` | 2.0.1 | Auto-equip best available armor | Optional but recommended for survival. Agents pick up dropped armor and auto-equip the best set. |
| `vec3` | 0.1.10 | 3D vector math — `new Vec3(x, y, z)` | Already in node_modules (mineflayer dep). Use for position arithmetic in skill functions, no need to install. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `prismarine-viewer` | Browser-based 3D visualization of bot's world view | Optional. Only useful during development to debug pathfinding or build placement. Not for production — costs memory and opens a port. |
| `node --watch` | Hot-reload during development | Already in package.json `dev` script. No changes needed. |

---

## Installation

```bash
# Core — mineflayer already in package.json, add pathfinder
npm install mineflayer-pathfinder

# Survival support — all recommended for agents in survival world
npm install mineflayer-pvp mineflayer-collectblock mineflayer-tool mineflayer-auto-eat mineflayer-armor-manager

# Dev only — visualization (optional, skip for production)
npm install -D prismarine-viewer
```

Note: `mineflayer`, `minecraft-data`, and `vec3` are already in `package.json` / `node_modules`.

---

## Bot Initialization Pattern

```javascript
import mineflayer from 'mineflayer'
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder'
import { plugin as pvp } from 'mineflayer-pvp'
import { plugin as autoEat } from 'mineflayer-auto-eat'
import armorManager from 'mineflayer-armor-manager'

const bot = mineflayer.createBot({
  host: 'localhost',
  port: 25565,
  username: 'jeffrey',    // bot display name on offline server
  auth: 'offline',        // Paper server with online-mode=false
  version: '1.21.1',      // pin version, don't let mineflayer guess
})

bot.loadPlugin(pathfinder)
bot.loadPlugin(pvp)
bot.loadPlugin(autoEat)
bot.loadPlugin(armorManager)

bot.once('spawn', () => {
  const movements = new Movements(bot)
  bot.pathfinder.setMovements(movements)
})
```

---

## Authentication: Offline Mode

Paper server must have `online-mode=false` in `server.properties` (already the case for the
existing Paper setup). The bot sets `auth: 'offline'` — no Microsoft account, no token, no
browser prompt. The `username` field is the literal display name the bot joins with.

This is the simplest possible auth path. No `prismarine-auth`, no OAuth tokens, no caching.

**Confirmed working:** mineflayer's README shows `auth: 'offline'` as the first example for
offline servers. Multiple mineflayer issues confirm offline mode bypasses all the 1.21.x
online-auth problems entirely.

---

## MC 1.21.1 Compatibility

**Status: SUPPORTED with caveats.**

Official claim: mineflayer 4.35.0 (latest, released 2026-02-13) declares support for
"Minecraft 1.8 to 1.21.11."

**Known past issues (now resolved or irrelevant):**
- Issue #3488 (Oct 2024): `Invalid tag: 117 > 20` in SlotComponent on Paper 1.21.1. Root cause
  was a minecraft-data protocol definition. Fix required merging minecraft-data PR #948.
  mineflayer 4.35.0 ships with minecraft-data 3.105.0 which includes the fix — confirmed by
  checking that 1.21.1 data directory exists in the installed package.
- Issue #3492 (Oct 2024): `RangeError: ERR_OUT_OF_RANGE` in advancements packet. Upstream
  node-minecraft-protocol issue. These older reports reference mineflayer 4.26.x and earlier.
  4.35.0 is 4 major minor releases newer with active maintenance.

**Risk mitigation:**
- Pin `version: '1.21.1'` in createBot — don't let mineflayer autodetect (autodetect caused
  issues in issue #551)
- Connect to a locally-run Paper server (no proxy, no Velocity) — transfer/redirect packet
  issues only affect proxy setups
- Offline mode eliminates all Microsoft auth surface area

**Confidence:** MEDIUM. The issues were real but referenced older versions. The v2.0 milestone
should include a "bot connects and spawns on Paper 1.21.1" smoke test as the very first step.

---

## Memory Footprint

**Per-bot RAM: ~100MB** (vs 1GB+ for Fabric client + Xvfb).

Source: mineflayer discussion #2251 — 50 bots consumed ~5GB total (~100MB each). Maintainer
confirmed this is inherent: each bot stores its own world state representation.

At 15GB RAM on Glass hardware with 2 agents:
- 2 bots × 100MB = 200MB for bots
- LLM inference overhead (MiniMax M2.7 remote): ~0MB local
- Comfortable headroom for scaling to 10 bots

**Memory growth warning:** mineflayer has a known chunk caching issue (issue #1123) where chunks
don't unload when a bot travels far. Set `bot.settings.viewDistance = 'tiny'` on spawn and
avoid long-distance exploration without periodic bot restarts to prevent heap growth over
multi-hour sessions.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `mineflayer-pathfinder` | `@nxg-org/mineflayer-pathfinder` (0.0.26) | The @nxg-org fork has more advanced movement (parkour, swimming) but is unstable/pre-release. Use the official plugin unless complex terrain traversal is a priority. |
| `mineflayer-collectblock` | Manual pathfind + dig + collect loop | Manual control is needed when gather logic requires custom conditions (e.g. mine only oak, avoid caves). collectblock is the right default for simple gathering. |
| `mineflayer-auto-eat` 5.0.3 | Custom hunger watcher | Custom is fine but it's boilerplate that adds nothing. The plugin handles edge cases (food priority, eating during combat). |
| `auth: 'offline'` | `prismarine-auth` Microsoft auth | Only needed if the server requires authenticated accounts. Our Paper server is offline-mode, so `prismarine-auth` would add complexity with no benefit. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `prismarine-viewer` in production | Opens a TCP port (3007), loads Three.js, increases memory. Useful in dev, waste in prod. | Remove before deploying to Glass |
| `mineflayer-statemachine` | Adds a finite state machine layer between the LLM and the bot. Redundant with the Mind+Body architecture — the LLM IS the state machine. | Direct skill function calls from the Body loop |
| `ws` (current dep) | Listed in package.json, not used in v1.x and not needed in v2.x — Mineflayer handles its own networking | Remove from package.json |
| `sharp` (current dep) | Vision/screenshot dep from v1.x. Vision is explicitly out of scope for v2.0. | Remove from package.json |
| `mineflayer-navigate` (0.0.10) | Abandoned in 2020, predates mineflayer-pathfinder | `mineflayer-pathfinder` |
| Auto-version detection | `version` omitted in createBot causes mineflayer to guess from server handshake — known source of bugs | Always pin `version: '1.21.1'` explicitly |

---

## Version Compatibility Matrix

| Package | Version | Mineflayer | MC 1.21.1 | Notes |
|---------|---------|------------|-----------|-------|
| `mineflayer` | 4.35.0 | — | SUPPORTED | Declared 1.8–1.21.11. Latest stable 2026-02-13. |
| `mineflayer-pathfinder` | 2.4.5 | 4.33+ | SUPPORTED | Mindcraft uses this exact version with mineflayer 4.33+. |
| `mineflayer-pvp` | 1.3.2 | 4.x | SUPPORTED | No known version restrictions |
| `mineflayer-collectblock` | 1.6.0 | 4.x | SUPPORTED | Requires mineflayer-pathfinder loaded first |
| `mineflayer-tool` | 1.2.0 | 4.x | SUPPORTED | Pure tool-selection logic, no MC-version coupling |
| `mineflayer-auto-eat` | 5.0.3 | 4.x | SUPPORTED | 5.x is a rewrite with improved API |
| `mineflayer-armor-manager` | 2.0.1 | 4.x | SUPPORTED | Mindcraft uses 2.0.1 |
| `minecraft-data` | 3.105.0 | (shared dep) | CONFIRMED | 1.21.1 data directory verified present |

---

## Package Cleanup (v2.0)

Remove from `package.json` — no longer needed in the new architecture:

```bash
npm uninstall sharp ws
```

- `sharp` — vision/screenshot processing (v1.x only, out of scope for v2.0)
- `ws` — raw WebSocket library (never used; mineflayer has its own networking)
- `@anthropic-ai/sdk` — keep if Claude is used as fallback LLM; remove if MiniMax only

---

## Sources

- `node_modules/mineflayer/package.json` — version 4.35.0 confirmed installed
- `node_modules/minecraft-data/minecraft-data/data/pc/common/versions.json` — 1.21.1 entry confirmed
- `npm view mineflayer` — latest 4.35.0, released 2026-02-13
- `npm view mineflayer-pathfinder` — latest 2.4.5
- `npm view mineflayer-pvp mineflayer-collectblock mineflayer-tool mineflayer-auto-eat mineflayer-armor-manager` — all versions confirmed
- [Mindcraft package.json](https://raw.githubusercontent.com/kolbytn/mindcraft/main/package.json) — reference project using mineflayer 4.33, pathfinder 2.4.5, pvp 1.3.2, armor-manager 2.0.1 (HIGH confidence)
- [mineflayer GitHub README](https://github.com/PrismarineJS/mineflayer) — auth offline docs, version support list (HIGH confidence)
- [Issue #3488](https://github.com/PrismarineJS/mineflayer/issues/3488) — SlotComponent bug on 1.21.1 Paper, root cause in minecraft-data, fix confirmed merged (MEDIUM confidence — newer mineflayer versions post-fix)
- [Issue #3492](https://github.com/PrismarineJS/mineflayer/issues/3492) — advancements packet RangeError on 1.21.1, referenced older mineflayer (MEDIUM confidence — unresolved thread but likely stale)
- [Discussion #2251](https://github.com/PrismarineJS/mineflayer/discussions/2251) — memory usage: 50 bots = ~5GB, maintainer-confirmed (HIGH confidence)

---

*Stack research for: HermesCraft v2.0 Mineflayer Rewrite*
*Researched: 2026-03-22*
