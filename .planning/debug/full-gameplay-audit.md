---
status: resolved
trigger: "comprehensive code audit of HermesCraft v2 Mineflayer bot"
created: 2026-03-22T00:00:00Z
updated: 2026-03-22T00:00:00Z
---

## Full Gameplay Audit — v2 Mineflayer Bot

Comprehensive code review of every file in body/ and mind/.
All bugs fixed in a single atomic commit.

---

## Bugs Found and Fixed

### BUG 1: modes.js torch placement uses plain object instead of Vec3 [CRITICAL]
- **File:** `body/modes.js:313`
- **Issue:** `bot.placeBlock(belowBlock, { x: 0, y: 1, z: 0 })` passes a plain JS object as the face vector. Mineflayer `placeBlock` requires a `Vec3` instance. This causes torch auto-placement to silently fail (caught by the try/catch but never works).
- **Fix:** Import `Vec3` from `vec3` and use `new Vec3(0, 1, 0)`.

### BUG 2: !drop command ignores count, tosses entire stack [MEDIUM]
- **File:** `mind/registry.js:30-42`
- **Issue:** `bot.tossStack(item)` always drops the full stack regardless of the `count` argument. If LLM says `!drop item:cobblestone count:1`, all 64 cobblestone get dropped.
- **Fix:** Use `bot.toss(item.type, null, Math.min(count, item.count))` to respect the count argument.

### BUG 3: !combat engages non-hostile mobs (cows, sheep, etc.) [MEDIUM]
- **File:** `mind/registry.js:44-48`
- **Issue:** `bot.nearestEntity(e => e.type === 'mob')` matches ANY mob entity including passive animals. The LLM says `!combat` expecting to fight a zombie, but the bot attacks the nearest cow.
- **Fix:** Import `HOSTILE_MOBS` from combat.js and filter by `HOSTILE_MOBS.has(e.name)`.

### BUG 4: farm.js uses stale hoe item reference [LOW]
- **File:** `body/skills/farm.js:73`
- **Issue:** The hoe Item object is found once at function start. If inventory slots shift during the farming loop (equipping seeds then re-equipping hoe), the original reference may point to a moved/consumed slot. Also, if the hoe breaks during use, the stale reference causes equip to fail.
- **Fix:** Re-find hoe from inventory each iteration. Add break if hoe is depleted.

### BUG 5: locations.js saveLocation never persists to disk [MEDIUM]
- **File:** `mind/locations.js:55-63`
- **Issue:** `saveLocation()` updates the in-memory `locations` object but never calls `saveLocations()` to write to disk. Build locations, custom waypoints, etc. are lost on crash. They only survive if the 60-second periodic save in start.js fires first.
- **Fix:** Call `saveLocations()` at the end of `saveLocation()`.

### BUG 6: messagestr handler uses UUID as username lookup key [CRITICAL]
- **File:** `mind/index.js:303-316`
- **Issue:** The `messagestr` event passes `sender` as a UUID string (MC 1.16+). The code does `bot.players?.[sender]?.username` but `bot.players` is keyed by USERNAME, not UUID. So `bot.players[uuid]` is always undefined, and the fallback gives a truncated UUID string (e.g. "a1b2c3d4") as the "username". This means:
  - Social tracking records interactions under a UUID, not the player's name
  - The LLM sees "[chat from a1b2c3d4: hello]" instead of "[chat from bigphoot: hello]"
  - Partner detection fails (compares "jeffrey"/"john" to a UUID)
- **Fix:** Search `bot.players` entries for matching `.uuid` field.

### BUG 7: breed.js wolf food is bone (taming), not meat (breeding) [LOW]
- **File:** `body/skills/breed.js:14`
- **Issue:** `wolf: 'bone'` — bones are used to TAME wolves, not breed them. Breeding tamed wolves requires any meat item.
- **Fix:** Changed to `wolf: 'cooked_beef'`.

### BUG 8: crafter.js solver undercounts multi-consumer dependencies [CRITICAL]
- **File:** `body/crafter.js:103-196`
- **Issue:** The BFS solver used a `visited` Set that prevented re-resolution of items needed by multiple consumers. For wooden_pickaxe (3 planks + 2 sticks where sticks need 2 planks = 5 planks total), the solver only planned 1 oak_planks craft (4 planks) because the second call to resolve('oak_planks') for sticks was blocked by the visited set. Result: bot.craft fails mid-chain with "missing materials" for items the solver said were available.
- **Root cause:** `visited` set served double duty — cycle prevention AND dedup. Cycle prevention needed it permanent; re-resolution needed it temporary.
- **Fix:** Complete rewrite of the resolve function:
  - Replaced `visited` with `inProgress` set that's active only during recursion (cleared on function exit)
  - Added immediate consumption deduction: `simInventory[item] -= alreadyHave` on entry
  - Credits only surplus production (not full output) to simInventory
  - Merges duplicate steps for the same item instead of blocking re-resolution

### BUG 9: chest.js uses deprecated bot.openChest [LOW]
- **File:** `body/skills/chest.js:130, 181`
- **Issue:** `bot.openChest()` is deprecated in mineflayer 4.x in favor of `bot.openContainer()`. Still works as an alias but may be removed.
- **Fix:** Use `bot.openContainer()` with fallback to `bot.openChest()`.

---

## Enhancements Applied

### Debug Logging Added
- `[navigate]` — logs arrival and failure with coordinates and reason
- `[craft]` — logs missing materials, crafting table equip, and individual craft steps (already had some)
- `[smelt]` — logs furnace open with item/fuel counts
- `[drop]` — logs dropped item and count
- `[combat]` — logs engaged target name and distance
- `[farm]` — logs hoe depletion

### build.js Equip Improvement
- `build.js:291-296` — Re-fetches Item object from inventory before equip instead of using mcData ID directly. Passing the actual Item object is more reliable as mineflayer matches the exact inventory slot.

---

## Files Audited — No Issues Found

| File | Status | Notes |
|------|--------|-------|
| body/bot.js | CLEAN | checkTimeoutInterval=120000 correctly set |
| body/navigate.js | ENHANCED | Added debug logging |
| body/dig.js | CLEAN | Post-dig verification correct |
| body/place.js | CLEAN | Post-place verification correct |
| body/interrupt.js | CLEAN | Cooperative interrupt pattern solid |
| body/normalizer.js | CLEAN | Alias maps and plural stripping work correctly |
| body/skills/gather.js | CLEAN | Interrupt checks after every await, unreachable blocks skipped |
| body/skills/mine.js | CLEAN | Harvest tool check, hard stop on wrong tier |
| body/skills/scan.js | CLEAN | Volume cap, coordinate normalization |
| body/skills/boat.js | CLEAN | Mount/dismount with interrupt checks |
| body/skills/look.js | CLEAN | openContainer fallback already present |
| body/skills/give.js | CLEAN | Distance check, item normalization |
| body/skills/combat.js | CLEAN | Health retreat, GoalFollow chase, attack cooldown |
| body/skills/inventory.js | CLEAN | Armor tier sorting, food set lookup |
| mind/llm.js | CLEAN | Graduated trimming, context overflow handling, think tag stripping |
| mind/prompt.js | CLEAN | System prompt construction, game state summary |
| mind/config.js | CLEAN | SOUL discovery, data dir, partner derivation |
| mind/memory.js | CLEAN | MEMORY.md parse/render, session logging, periodic save |
| mind/social.js | CLEAN | Sentiment tracking, partner chat injection |
| mind/build-history.js | CLEAN | Shared build history, prompt injection |
| start.js | CLEAN | Init order correct, all subsystems wired |

---

## Verified Correct Patterns

- `checkTimeoutInterval: 120000` in bot.js prevents 30s keepalive disconnects
- Every skill returns `{ success, reason }` on all code paths
- All `placeBlock` calls preceded by equip (craft.js, build.js, farm.js)
- Interrupt checks after every await in all skill loops
- `bot.equip` accepts both Item objects and numeric IDs (mineflayer API verified)
- `bot.findBlock` matching function receives Block objects with `.type` and `.name` properties
- `normalizeBlockName` vs `normalizeItemName` distinction correctly applied (iron_ore is block-only)
- vec3 import in farm.js uses correct CJS interop pattern
- openai client configured for vLLM with no OAuth complexity
