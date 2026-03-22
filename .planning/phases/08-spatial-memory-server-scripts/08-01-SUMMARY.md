---
phase: 08-spatial-memory-server-scripts
plan: 01
subsystem: spatial-memory
tags: [locations, resources, proximity-filtering, chests, agent-memory]
dependency_graph:
  requires: []
  provides: [saveResourcePatch, getResourcesForPrompt, proximity-filtered-locations, proximity-filtered-chests]
  affects: [agent/index.js, agent/planner.js, agent/locations.js, agent/chests.js]
tech_stack:
  added: []
  patterns: [proximity-filter, growth-management, auto-detection]
key_files:
  created: []
  modified:
    - agent/locations.js
    - agent/chests.js
    - agent/index.js
    - agent/planner.js
decisions:
  - "Use _resources key in locations.json to avoid collision with any location named 'resources'"
  - "Horizontal distance only (sqrt(dx*dx + dz*dz)) for proximity checks — ignores Y so underground resources register correctly"
  - "autoDetectLocations normalises deepslate ore variants (deepslate_iron_ore -> iron_vein) so name generation stays clean"
  - "getLocationsForPrompt backward compat: if no position arg, return all entries (existing callers unaffected)"
metrics:
  duration: ~5min
  completed: "2026-03-22"
  tasks_completed: 2
  files_modified: 4
---

# Phase 08 Plan 01: Spatial Memory — Typed Resource Patches & Proximity Filtering Summary

Adds typed resource patch memory (ore veins, tree clusters, build sites) to persistent spatial memory with 150-block proximity filtering on all three spatial prompt functions so long-running sessions with 100+ accumulated entries don't blow the LLM context budget.

## What Was Built

### Task 1: locations.js + chests.js extensions

**agent/locations.js:**
- `saveResourcePatch(name, type, x, y, z, metadata)` — stores typed entries under `_resources` in `locations.json`. Type validated against `VALID_RESOURCE_TYPES` set; defaults to `'poi'` on invalid type.
- `getResourcesForPrompt(position)` — proximity-filtered (150 blocks horizontal), sorted by distance, capped at 20, formatted with cardinal direction labels (N/S/E/W). Returns empty string if nothing in range.
- `getLocationsForPrompt(position)` — updated to accept optional `position` param; when provided, filters to 150 blocks and caps at 10. Falls back to unfiltered behavior if position is null.
- `pruneResources()` — internal; removes oldest same-type duplicates within 10 blocks when entries exceed 500.
- `autoDetectLocations(state)` — extended to scan `state.surfaceBlocks` for ore blocks (2+ of same type → ore_vein) and log blocks (3+ → tree_cluster). Both deduplicate against existing entries within 15 blocks.
- `saveLocations()` — merges `_resources` into JSON under `_resources` key before writing.
- `initLocations(agentConfig)` — extracts `_resources` from loaded JSON and removes it from the main `locations` object.

**agent/chests.js:**
- `getChestsForPrompt(position)` — updated to accept optional `position` param; when provided, parses `"x,y,z"` key format, filters to 150 blocks, sorts by distance, caps at 10.

### Task 2: index.js + planner.js wiring

**agent/index.js:**
- Added `getResourcesForPrompt` to import from `./locations.js`
- `getLocationsForPrompt(state.position)` now passes position
- `getResourcesForPrompt(state.position)` called after locationText
- `fullMemoryText` includes `resourceText`

**agent/planner.js:**
- Added `getResourcesForPrompt` to import from `./locations.js`
- `getChestsForPrompt(state.position)` now passes position
- `getLocationsForPrompt(state.position)` now passes position
- `getResourcesForPrompt(state.position)` injected as `== NEARBY RESOURCES ==` section in `consolidateMemory()`

## Commits

| Hash | Message |
|------|---------|
| 4503d76 | feat(08-01): typed resource patches, proximity filtering, growth management |
| 2e678af | feat(08-01): wire resource prompt injection into index.js and planner.js |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
