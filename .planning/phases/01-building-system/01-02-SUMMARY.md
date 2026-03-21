---
phase: 01-building-system
plan: 02
subsystem: vision
tags: [screenshot, framebuffer, openai-vision, minimax, spatial-awareness]

# Dependency graph
requires: []
provides:
  - "GET /screenshot endpoint on Fabric mod HTTP server returning framebuffer as PNG"
  - "Vision loop module (agent/vision.js) with start/stop/get exports"
  - "Vision config in agent/config.js (interval, enabled, model)"
  - "Spatial awareness text output to {dataDir}/vision-context.txt"
affects: [01-building-system, 01-04, prompt-builder, planner-loop]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Render-thread-safe framebuffer capture via CompletableFuture + client.execute()"
    - "Separate OpenAI client per async loop to prevent conversation state interference"
    - "Non-fatal async loop pattern: catch all errors, log, continue"

key-files:
  created:
    - "agent/vision.js"
  modified:
    - "mod/src/main/java/hermescraft/HttpServer.java"
    - "mod/src/main/java/hermescraft/HermesBridgeMod.java"
    - "agent/config.js"

key-decisions:
  - "Used temp file for NativeImage PNG export since MC 1.21.1 NativeImage.writeTo only takes Path, not OutputStream"
  - "Vision loop uses its own OpenAI client instance to prevent interference with action loop"
  - "Vision-context.txt written to dataDir root (not context/ subdir) for Plan 04 prompt injection"

patterns-established:
  - "Async loop pattern: setInterval + async tick function with full try/catch wrapping"
  - "Mod screenshot via CompletableFuture bridging HTTP thread to render thread"

requirements-completed: [BUILD-01, BUILD-02]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 01 Plan 02: Vision System Summary

**Screenshot endpoint on Fabric mod + agent vision loop capturing spatial awareness via MiniMax M2.7 vision model**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T05:18:11Z
- **Completed:** 2026-03-21T05:20:37Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Mod serves framebuffer as PNG on GET /screenshot with render-thread-safe capture via CompletableFuture
- Agent vision loop module captures screenshots every ~10s, sends to MiniMax vision, writes spatial awareness to vision-context.txt
- Vision config (interval, enabled flag, model) added to agent config system

## Task Commits

Each task was committed atomically:

1. **Task 1: Add /screenshot endpoint to Fabric mod** - `0914443` (feat)
2. **Task 2: Create agent vision loop module** - `0cf5d98` (feat)

## Files Created/Modified
- `mod/src/main/java/hermescraft/HermesBridgeMod.java` - Added captureScreenshot() method with render-thread CompletableFuture pattern
- `mod/src/main/java/hermescraft/HttpServer.java` - Added ScreenshotHandler class and /screenshot endpoint registration
- `agent/vision.js` - Vision loop module with startVisionLoop, stopVisionLoop, getVisionContext exports
- `agent/config.js` - Added visionEnabled, visionIntervalMs, visionModel to agent config

## Decisions Made
- Used temp file for NativeImage PNG export: MC 1.21.1 NativeImage.writeTo only accepts Path, not OutputStream. Temp file is created, read, then deleted.
- Vision loop uses its own OpenAI client instance (not shared from llm.js) to prevent conversation state interference between vision and action loops.
- Vision-context.txt is written to dataDir root, not the context/ subdirectory. Plan 04 will update the prompt builder to inject it.
- No access widener changes needed: ScreenshotRecorder.takeScreenshot, NativeImage.writeTo, and Framebuffer are all public in MC 1.21.1.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Screenshot endpoint ready for vision loop consumption
- Vision module ready to be started from index.js (integration in Plan 04)
- getVisionContext() available for prompt builder injection (Plan 04)
- Planner loop (Plan 03) can follow same async loop pattern established here

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 01-building-system*
*Completed: 2026-03-21*
