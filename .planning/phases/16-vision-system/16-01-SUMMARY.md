---
phase: 16-vision-system
plan: 01
subsystem: vision
tags: [vision, canvas, minimap, spatial, vlm, scrot, xvfb, openai]

# Dependency graph
requires:
  - phase: 15-dual-brain-architecture
    provides: backgroundBrain.js OpenAI client pattern (port 8001) used as template for vision client (port 8002)
provides:
  - mind/vision.js with captureScreenshot (scrot+Xvfb), queryVLM (Qwen2.5-VL-7B), buildVisionForPrompt
  - mind/minimap.js with renderMinimap (top-down PNG via node-canvas), getMinimapSummary (text terrain summary)
  - mind/spatial.js Tier 4 entity awareness: hostile mobs, passive animals, players within 16 blocks
affects: [16-vision-system-02, mind/prompt.js, mind/registry.js]

# Tech tracking
tech-stack:
  added: [canvas 3.2.2 (node-canvas — top-down minimap rendering, Cairo-backed)]
  patterns:
    - Null-return error handling on every code path (never throw from vision modules)
    - Separate VLM client on port 8002 mirroring backgroundBrain.js port 8001 pattern
    - Entity awareness as Tier 4 appended to existing three-tier spatial system

key-files:
  created:
    - mind/vision.js
    - mind/minimap.js
  modified:
    - mind/spatial.js
    - package.json
    - package-lock.json

key-decisions:
  - "Use scrot + Xvfb screengrab instead of prismarine-viewer — zero new rendering pipeline, captures real GPU frame, already runs under Xvfb"
  - "VLM client on separate port 8002 (VISION_URL env var) distinct from background brain port 8001"
  - "Null-return on every failure path — VLM unavailability is expected, agent must continue without vision"
  - "Entity awareness capped at 16-block radius and top-4 per category to stay within token budget"
  - "VISION_MODEL defaults to Qwen/Qwen2.5-VL-7B-Instruct — separate from main and background brains"

patterns-established:
  - "Null-return pattern: every exported function in vision/minimap returns null on any failure, never throws"
  - "VLM client pattern: new OpenAI({ baseURL: VISION_URL, apiKey: 'not-needed', timeout: 30000 })"
  - "Entity awareness output format: 'HOSTILE: zombie 5b N hp:20, creeper 8b SE' — name + distance + direction + optional health"

requirements-completed: ["SPA-01", "SPA-04"]

# Metrics
duration: 2min
completed: 2026-03-23
---

# Phase 16 Plan 01: Vision System Core Modules Summary

**Screenshot capture via scrot+Xvfb, Qwen2.5-VL-7B VLM client, node-canvas minimap, and entity awareness Tier 4 in spatial.js**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T20:54:15Z
- **Completed:** 2026-03-23T20:56:24Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- Created mind/vision.js: on-demand screenshot capture (scrot), VLM query (Qwen2.5-VL-7B on port 8002), prompt formatting — all null-return on failure
- Created mind/minimap.js: top-down PNG minimap rendering and text terrain summary using node-canvas — no VLM needed
- Extended mind/spatial.js with Tier 4 entity awareness: HOSTILE_MOBS_SPATIAL (21 types), PASSIVE_MOBS (21 types), player detection, 16-block radius, distance + cardinal direction + health
- Installed canvas 3.2.2 npm dependency
- 319 smoke tests still passing after all changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create mind/vision.js and mind/minimap.js + install canvas** - `ed8c78f` (feat)
2. **Task 2: Extend mind/spatial.js with entity awareness (SPA-01)** - `9929d02` (feat)

## Files Created/Modified
- `mind/vision.js` - captureScreenshot (scrot), queryVLM (OpenAI VLM client), buildVisionForPrompt
- `mind/minimap.js` - renderMinimap (64x64 PNG), getMinimapSummary (text terrain counts)
- `mind/spatial.js` - Added HOSTILE_MOBS_SPATIAL, PASSIVE_MOBS, getEntityAwareness, Tier 4 integration
- `package.json` - canvas dependency added
- `package-lock.json` - lockfile updated

## Decisions Made
- Used scrot + Xvfb screengrab (not prismarine-viewer) — zero friction, client already runs under Xvfb
- Separate VISION_URL (port 8002) from BACKGROUND_BRAIN_URL (port 8001) — independent scaling
- Null-return on all failure paths — VLM being offline is a routine state, not an error
- Entity awareness radius 16 blocks, top 4 per category — token budget constraint
- y-walk starts at min(pos.y + 64, 320) downward to -64 — covers all overworld surface elevations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Verify script in Task 2 checked for `'HOSTILE: '` (single-quoted literal) but code uses template literals — acceptance criteria greps (`grep 'HOSTILE:' mind/spatial.js`) pass correctly. No code change needed.

## Known Stubs

None — all exported functions are fully implemented. renderMinimap is intentionally not wired into callers yet (deferred per plan objective — available for Plan 02 to wire in).

## Next Phase Readiness
- mind/vision.js and mind/minimap.js are production-ready, ready for Plan 02 to wire into !see command and prompt injection
- getMinimapSummary (SPA-04 area familiarity) ready for prompt injection in Plan 02
- Entity awareness (SPA-01) already active in every think() call via buildSpatialAwareness

---
*Phase: 16-vision-system*
*Completed: 2026-03-23*
