# Phase 16: Vision System - Research

**Researched:** 2026-03-23
**Domain:** Headless screenshot capture, VLM integration, top-down minimap, spatial awareness extension
**Confidence:** HIGH — all key decisions pre-researched in VISION-SCREENSHOTS.md; this document synthesizes and adds codebase integration specifics.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- On-demand `!see` tool via prismarine-viewer headless + Qwen2.5-VL-7B
- NOT per-tick vision — too expensive. On-demand via tool call + periodic via background brain
- prismarine-viewer processes 320×240 screenshot in ~100 tokens, 130ms on A100
- Top-down minimap as lightweight alternative (block data, no VLM needed)
- Screenshots stored in `data/<agent>/screenshots/` with timestamps

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Deferred Ideas (OUT OF SCOPE)
None — infrastructure phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPA-01 | Enhanced entity awareness — track nearby mobs, animals, villagers with types, distances, health | Extend mind/spatial.js; bot.entities API already available in the pattern |
| SPA-02 | Post-build scan integration — verify placed blocks match blueprint | scanArea() exists in body/skills/scan.js; needs post-build invocation hook in mind/index.js |
| SPA-04 | Area familiarity — agent knows what's been explored vs unknown territory | Top-down minimap from node-canvas provides terrain coverage map; inject summary to prompt |
</phase_requirements>

---

## Summary

Phase 16 delivers vision as a first-class capability in three tiers: (1) enhanced structured spatial awareness via `mind/spatial.js` extension (entity awareness + post-build scan), (2) on-demand Xvfb screenshot capture → Qwen2.5-VL-7B VLM description via a `!see` command, and (3) a lightweight top-down minimap generated from block data using `node-canvas`.

The lowest-friction, highest-value screenshot path for HermesCraft is the Xvfb screengrab approach. The system already runs each Minecraft client under Xvfb. `scrot` is confirmed installed on this machine (`/usr/bin/scrot`, version 1.10). This means zero new rendering pipeline, zero GPU overhead, and captures the GPU-rendered game frame directly. The alternative — prismarine-viewer headless — is significantly heavier (200-500 MB resident, system native lib dependencies, version pinning issues) and adds no value over the already-running client display.

The critical constraint is graceful degradation: the VLM (Qwen2.5-VL-7B on port 8001 via a second vLLM process) may be unavailable. Every vision call must return `null` on failure and the agent must continue functioning without it. The `backgroundBrain.js` pattern (port 8001, try/catch returning null, `_bgRunning` guard) is the template to follow.

**Primary recommendation:** Use Xvfb screengrab (`scrot`) for on-demand `!see` + `node-canvas` for minimap. Extend `spatial.js` for SPA-01/SPA-02/SPA-04. Wire VLM calls through the existing OpenAI client pattern. Graceful null returns on any failure.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `openai` | 4.104.0 (installed) | VLM API calls to Qwen2.5-VL-7B on port 8001 | Already in package.json; same client used by backgroundBrain.js for secondary model |
| `canvas` | 3.2.2 (npm) | Top-down minimap rendering — 2D Canvas, no WebGL | Pure Node.js, no display required, fast (~30ms for 64x64), Cairo-backed |
| `scrot` | 1.10 (installed at /usr/bin/scrot) | Xvfb screenshot capture | Already on host, captures actual game frame directly from Xvfb display |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `prismarine-viewer` | 1.33.0 (npm, NOT installed) | Headless Three.js render | Skip — Xvfb screengrab is strictly better for HermesCraft |
| `node-canvas-webgl` | 0.3.0 (npm, NOT installed) | WebGL canvas for prismarine-viewer | Skip — needed only if prismarine-viewer is used |
| `child_process` (Node built-in) | — | Shell out to `scrot` command | Always available in Node.js ESM |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| scrot + Xvfb | prismarine-viewer headless | Xvfb screengrab is strictly lower friction — client already runs under Xvfb, captures real GPU frame, no new npm deps. prismarine-viewer adds 200-500 MB RAM, native lib build requirements, and version pinning issues. No upside for HermesCraft. |
| scrot + Xvfb | Puppeteer + prismarine-web-client | Way heavier: 500 MB+ per instance; catastrophic at 10 bots. Rejected. |
| node-canvas (2D) minimap | VLM-based terrain description | node-canvas minimap is zero-latency, zero-cost, no VLM needed. Appropriate for area familiarity (SPA-04). |

**Installation (minimap only — scrot and openai already present):**
```bash
npm install canvas
```

**Version verification:**
- `canvas`: `npm view canvas version` → 3.2.2 (confirmed 2026-03-23)
- `openai`: 4.104.0 already in package-lock.json
- `scrot`: `/usr/bin/scrot --version` → 1.10 (confirmed installed)

---

## Architecture Patterns

### Recommended Project Structure
```
mind/
├── vision.js           # NEW: captureScreenshot(), queryVLM(), buildVisionForPrompt()
├── minimap.js          # NEW: renderMinimap(), getMinimapForPrompt()
├── spatial.js          # MODIFY: add entity awareness tier (SPA-01), expose postBuildScan (SPA-02)
├── index.js            # MODIFY: handle !see pre-dispatch, wire vision to background brain trigger
├── backgroundBrain.js  # MODIFY: call captureScreenshot + queryVLM periodically when Xvfb available
├── prompt.js           # MODIFY: add visionContext injection slot (Part 5.9), minimap slot (Part 5.10)
└── registry.js         # MODIFY: add !see command entry

body/
└── skills/
    └── scan.js         # KEEP: exists and works — used for SPA-02 post-build scan

data/<agent>/
└── screenshots/        # NEW: timestamped PNG files from scrot
    └── 2026-03-23T14-30-00.png
```

### Pattern 1: Xvfb Screenshot Capture

**What:** Shell out to `scrot` using the bot's Xvfb display number, base64-encode the result, send to VLM.
**When to use:** `!see` command dispatch, background brain periodic vision, death/stuck auto-trigger.
**Graceful failure:** Return `null` at every error boundary. The agent continues without vision.

```javascript
// mind/vision.js — Source: VISION-SCREENSHOTS.md §8 + backgroundBrain.js pattern
import { execSync } from 'child_process'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import OpenAI from 'openai'
import { join } from 'path'

const VISION_URL = process.env.VISION_URL || 'http://localhost:8001/v1'
const VISION_MODEL = process.env.VISION_MODEL_NAME || 'Qwen/Qwen2.5-VL-7B-Instruct'
const VISION_MAX_TOKENS = parseInt(process.env.VISION_MAX_TOKENS || '256', 10)
const XVFB_DISPLAY = process.env.XVFB_DISPLAY || '1'  // set per-bot in launch-duo.sh

const vlmClient = new OpenAI({ baseURL: VISION_URL, apiKey: 'not-needed', timeout: 30000 })

export async function captureScreenshot(dataDir, displayNum) {
  // Returns base64 PNG string or null on any failure
  try {
    const screensDir = join(dataDir, 'screenshots')
    if (!existsSync(screensDir)) mkdirSync(screensDir, { recursive: true })

    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    const outPath = join(screensDir, `${ts}.png`)

    execSync(`DISPLAY=:${displayNum} scrot -o "${outPath}"`, { timeout: 5000 })

    const buf = readFileSync(outPath)
    return buf.toString('base64')
  } catch {
    return null
  }
}

export async function queryVLM(base64Image, focusHint = '') {
  // Returns text description string or null on any failure — NEVER throws
  if (!base64Image) return null
  try {
    const prompt = focusHint
      ? `Describe this Minecraft screenshot. Focus on: ${focusHint}. Be concise (2-3 sentences).`
      : 'Describe what you see in this Minecraft screenshot. Note terrain, mobs, structures, hazards. Be concise.'

    const response = await vlmClient.chat.completions.create({
      model: VISION_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Image}` } },
          { type: 'text', text: prompt },
        ],
      }],
      max_tokens: VISION_MAX_TOKENS,
      temperature: 0.3,
    })
    return response.choices?.[0]?.message?.content || null
  } catch {
    return null  // VLM unavailable — callers handle null gracefully
  }
}

export function buildVisionForPrompt(description) {
  if (!description) return null
  return `## Visual Observation\n${description}`
}
```

### Pattern 2: Top-Down Minimap (node-canvas, no VLM)

**What:** Read `bot.world` block columns, color-map surface blocks to hex colors, render to 64×64 PNG.
**When to use:** Background brain periodic task (every 30s or on 50+ block move), area familiarity (SPA-04).
**No VLM needed.** Node-canvas only. ~30ms to render.

```javascript
// mind/minimap.js — Source: VISION-SCREENSHOTS.md §2 + §5
import { createCanvas } from 'canvas'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

// Color map for most common surface blocks
const BLOCK_COLORS = {
  grass_block: '#5A8E3A', stone: '#888888', water: '#3A7BD5',
  sand: '#DCB96A', gravel: '#888070', dirt: '#9A6B4B',
  oak_log: '#7A5C2E', birch_log: '#C8C8A0', spruce_log: '#5C3A1E',
  snow: '#F0F0F0', ice: '#A0D0F0', lava: '#FF6000',
  obsidian: '#222222', bedrock: '#444444', netherrack: '#8B3030',
  default: '#808080',
}

export function renderMinimap(bot, dataDir, radius = 32) {
  // Returns PNG file path or null on failure — never throws
  try {
    if (!bot?.entity?.position) return null
    const pos = bot.entity.position.floored()
    const size = radius * 2
    const canvas = createCanvas(size, size)
    const ctx = canvas.getContext('2d')

    for (let dx = -radius; dx < radius; dx++) {
      for (let dz = -radius; dz < radius; dz++) {
        // Walk down from above to find surface block
        let surfaceBlock = null
        for (let dy = 64; dy >= -64; dy--) {
          const block = bot.blockAt(pos.offset(dx, dy, dz))
          if (block && block.name !== 'air' && block.name !== 'cave_air') {
            surfaceBlock = block.name
            break
          }
        }
        const color = BLOCK_COLORS[surfaceBlock] || BLOCK_COLORS.default
        ctx.fillStyle = color
        ctx.fillRect(dx + radius, dz + radius, 1, 1)
      }
    }

    // Mark bot position
    ctx.fillStyle = '#FF0000'
    ctx.fillRect(radius - 1, radius - 1, 3, 3)

    const screensDir = join(dataDir, 'screenshots')
    if (!existsSync(screensDir)) mkdirSync(screensDir, { recursive: true })
    const outPath = join(screensDir, 'minimap.png')
    writeFileSync(outPath, canvas.toBuffer('image/png'))
    return outPath
  } catch {
    return null
  }
}

export function getMinimapSummary(bot, radius = 32) {
  // Returns a text description of terrain distribution — for prompt injection without VLM
  try {
    if (!bot?.entity?.position) return null
    const pos = bot.entity.position.floored()
    const counts = {}
    for (let dx = -radius; dx < radius; dx++) {
      for (let dz = -radius; dz < radius; dz++) {
        for (let dy = 64; dy >= -64; dy--) {
          const block = bot.blockAt(pos.offset(dx, dy, dz))
          if (block && block.name !== 'air' && block.name !== 'cave_air') {
            counts[block.name] = (counts[block.name] || 0) + 1
            break
          }
        }
      }
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    return `Terrain (${radius * 2}x${radius * 2} area): ` + sorted.map(([k, v]) => `${k}×${v}`).join(', ')
  } catch {
    return null
  }
}
```

### Pattern 3: Entity Awareness Tier (SPA-01)

**What:** Add entity awareness as Tier 4 to `mind/spatial.js` — filter `bot.entities` to nearby mobs, animals, villagers within 16 blocks.
**When to use:** Every `buildSpatialAwareness()` call (already in every think() cycle).
**Performance:** `bot.entities` is an in-memory object; filtering to <16 blocks takes <1ms.

```javascript
// In mind/spatial.js — add after Tier 3 getTerrainContext()
const HOSTILE_MOBS_SPATIAL = new Set([
  'zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch',
  'blaze', 'ghast', 'phantom', 'drowned', 'pillager', 'ravager',
])
const PASSIVE_MOBS = new Set(['cow', 'pig', 'sheep', 'chicken', 'horse', 'villager', 'wolf'])

function getEntityAwareness(bot) {
  // Source: bot.entities is an object keyed by entity ID
  if (!bot.entities || !bot.entity?.position) return { hostile: [], passive: [], players: [] }
  const botPos = bot.entity.position
  const hostile = [], passive = [], players = []

  for (const entity of Object.values(bot.entities)) {
    if (!entity?.position || entity === bot.entity) continue
    const dist = Math.round(entity.position.distanceTo(botPos))
    if (dist > 16) continue
    const name = entity.name || entity.type || 'unknown'
    const desc = `${name} ${dist}b ${cardinalDir(
      entity.position.x - botPos.x,
      entity.position.z - botPos.z
    )}`
    if (entity.type === 'player') players.push(desc)
    else if (HOSTILE_MOBS_SPATIAL.has(name)) hostile.push(desc)
    else if (PASSIVE_MOBS.has(name)) passive.push(desc)
  }
  return { hostile, passive, players }
}
```

### Pattern 4: Post-Build Scan Hook (SPA-02)

**What:** After `!build` or `!design` completes successfully, call `scanArea()` over the build AABB and store the result as a one-time context field in the next `think()`.
**Where:** In `mind/index.js`, after `build` dispatch returns `success: true`.
**How:** Store in module-level `_postBuildScan` variable, consumed and cleared in next `think()`.

```javascript
// In mind/index.js — after 'build' skill result
if (result.command === 'build' && skillResult.success) {
  // ... existing build recording ...
  // SPA-02: post-build scan for verification
  try {
    const bx = parseInt(result.args.x), by = parseInt(result.args.y), bz = parseInt(result.args.z)
    if (!isNaN(bx)) {
      const scanResult = scanArea(bot, bx - 2, by, bz - 2, bx + 12, by + 10, bz + 12)
      if (scanResult.success) {
        _postBuildScan = `Post-build scan: ${scanResult.total} solid blocks — ` +
          Object.entries(scanResult.blocks)
            .filter(([k]) => k !== 'air' && k !== 'unloaded')
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([k, v]) => `${k}×${v}`)
            .join(', ')
      }
    }
  } catch { /* non-fatal */ }
}
```

### Pattern 5: !see Command Pre-Dispatch Handling

**What:** Like `!design` and `!sethome`, `!see` is handled in `mind/index.js` think() BEFORE dispatch. It needs vision.js functions and returns a text description as a skill result.
**Registry entry:** Stub that returns a failure reason (same as `design` pattern).
**In think():** Check `result.command === 'see'` before `dispatch()`.

```javascript
// In mind/index.js think() — before dispatch
if (result.command === 'see') {
  const focus = result.args?.focus || ''
  console.log('[mind] !see triggered — capturing screenshot')
  skillRunning = true
  const displayNum = _config?.displayNum || process.env.XVFB_DISPLAY || '1'
  const base64 = await captureScreenshot(_config.dataDir, displayNum)
  const description = await queryVLM(base64, focus)
  skillRunning = false
  if (description) {
    _lastVisionResult = description  // injected into next think() prompt as visionContext
    console.log('[mind] !see result:', description.slice(0, 80))
  } else {
    console.log('[mind] !see: VLM unavailable or capture failed')
  }
  lastActionTime = Date.now()
  setTimeout(() => think(bot, { trigger: 'skill_complete', skillName: 'see',
    skillResult: { success: true, reason: description || 'vision unavailable' } }), 0)
  return
}
```

### Anti-Patterns to Avoid

- **Per-tick vision:** At 2s tick budget, a 400ms VLM call would run concurrently with everything. Use on-demand only.
- **prismarine-viewer in same process:** Memory + CPU conflict; not installed; Xvfb screengrab is better.
- **Blocking Xvfb detection:** Don't check for Xvfb at import time — check at call time, return null if DISPLAY env missing.
- **Background vision when main brain busy:** Mirror the `_bgRunning` guard from backgroundBrain.js — skip if `isSkillRunning() || isThinking()`.
- **Storing base64 images in brain-state.json:** Send to VLM immediately, store only the text description.
- **Hardcoding displayNum:** Pass `XVFB_DISPLAY` env var per-bot (set in `launch-duo.sh`); default to `:1` safely.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image encoding for VLM API | Custom base64 helper | `Buffer.toString('base64')` on `readFileSync()` result | Built into Node.js; 1 line |
| Screen capture on Linux | Xvfb + framebuffer pixel reading | `scrot` (`/usr/bin/scrot`) | Already installed; handles display selection cleanly |
| 2D rendering for minimap | Custom pixel writer | `canvas` npm package (node-canvas) | Cairo-backed, well-tested, pure Node.js |
| VLM API client | Custom fetch wrapper | `openai` npm (already installed) | Same client as backgroundBrain.js; handles streaming, retries, timeouts |
| Entity distance calculation | Custom Vec3 math | `entity.position.distanceTo(bot.entity.position)` | mineflayer Vec3 already imported in spatial.js |

**Key insight:** Every piece of infrastructure is either already installed (scrot, openai) or a simple install (canvas). The "hard part" is the integration and graceful failure, not the underlying tools.

---

## Runtime State Inventory

Not applicable — this is a greenfield addition phase. No rename/refactor. No runtime state changes to migrate.

---

## Common Pitfalls

### Pitfall 1: DISPLAY Environment Variable Missing
**What goes wrong:** `scrot` called without a valid `DISPLAY` — exits with error, capturing nothing.
**Why it happens:** When running in a test or non-Xvfb environment, `DISPLAY` is unset.
**How to avoid:** Check `process.env.DISPLAY || XVFB_DISPLAY` before calling `execSync`. If absent, skip capture and return null immediately. Wrap all `execSync` calls in try/catch with explicit timeout.
**Warning signs:** `execSync` throws with "Can't open display" or "No such file or directory".

### Pitfall 2: VLM Returns Null for Large Images
**What goes wrong:** A 1280x720 screenshot encodes to ~3 MB base64. Qwen2.5-VL-7B at 320×240 → ~100 tokens, but 1280×720 → ~1,330 tokens, potentially exceeding context window.
**Why it happens:** scrot captures at the Xvfb resolution, which may be set to 1280x1024 in launch scripts.
**How to avoid:** After capture, resize the PNG before encoding. Use `convert` (ImageMagick, `/usr/bin/convert`) to `convert input.png -resize 320x240 output.png`. Or pass `-t 320x240` to scrot if cropping is acceptable.
**Warning signs:** VLM returns truncated responses or "maximum tokens" errors.

### Pitfall 3: `canvas` npm Native Build Failure
**What goes wrong:** `npm install canvas` fails on systems missing Cairo dev libs.
**Why it happens:** `node-canvas` requires `libcairo2-dev`, `libpango1.0-dev`, `libpng-dev` on Ubuntu.
**How to avoid:** On RunPod: `apt-get install -y libcairo2-dev libpango1.0-dev libpng-dev libjpeg-dev libgif-dev` before `npm install canvas`. This is a Wave 0 task.
**Warning signs:** `npm install canvas` reports "gyp ERR! build error" or missing .h files.

### Pitfall 4: Background Vision Competing with Main Brain GPU
**What goes wrong:** Background brain periodic screenshot + VLM call fires while main brain is mid-LLM-call. Both hit port 8001 (secondary vLLM process) at the same time. Latency spikes.
**Why it happens:** Background brain interval fires on wallclock, not on idle state.
**How to avoid:** In `backgroundBrain.js` periodic vision trigger, check `isThinking()` before proceeding. This already exists as the `_bgRunning` guard pattern — extend it to also gate VLM vision calls.
**Warning signs:** LLM call latency increases from ~500ms to >2s during background brain cycles.

### Pitfall 5: screenshots/ Directory Missing
**What goes wrong:** `captureScreenshot` or `renderMinimap` throws ENOENT when writing the output file.
**Why it happens:** `data/<agent>/screenshots/` doesn't exist on first run.
**How to avoid:** Always call `mkdirSync(screensDir, { recursive: true })` before writing. Pattern already used in `backgroundBrain.js` for `DATA_DIR`.
**Warning signs:** `ENOENT: no such file or directory` on write.

### Pitfall 6: Vision Context Grows Unbounded in prompt
**What goes wrong:** Multiple `!see` calls accumulate in the prompt, burning token budget.
**Why it happens:** `_lastVisionResult` injected on every tick until replaced.
**How to avoid:** Only inject the single most recent vision result. Clear `_lastVisionResult` after injection (consume-once pattern, like `_lastDeath`). Cap the description at 400 chars.
**Warning signs:** System prompt grows longer than 6000 chars; context overflow errors.

---

## Code Examples

### Wiring !see into the command reference (mind/prompt.js)

```javascript
// Source: prompt.js Part 6 — add to command list
`  !see focus:"text"               — capture screenshot and describe what you see (terrain, mobs, builds)`
```

### Injecting vision context into system prompt (Part 5.9)

```javascript
// Source: prompt.js — new injection slot after brainState (Part 5.8)
// Part 5.9: Vision context — most recent !see result (consume-once, <400 chars)
if (options.visionContext) {
  parts.push(options.visionContext)
}
```

### Registry stub for !see (mind/registry.js)

```javascript
// !see is handled in mind/index.js think() BEFORE dispatch, like !design.
// This entry ensures listCommands() includes 'see' for help text.
['see', (_bot, _args) => {
  return Promise.resolve({ success: false, reason: 'see must be handled by the Mind loop — use focus:"what to look for"' })
}],
```

### Background brain periodic vision trigger

```javascript
// In runBackgroundCycle() — after writing brain-state.json
// Only fire vision if VLM available and display is set
if (process.env.DISPLAY && !isThinking()) {
  const base64 = await captureScreenshot(DATA_DIR, process.env.XVFB_DISPLAY || '1')
  if (base64) {
    const desc = await queryVLM(base64, 'terrain and nearby threats')
    if (desc) {
      // Store in brain-state.json as visionNote field
      mergedState.visionNote = { text: desc, ts: Date.now() }
    }
  }
}
```

### Smoke test additions (source-level validation)

```javascript
// Section 18: Vision Module
const vision = await import('../mind/vision.js')
assert('mind/vision: captureScreenshot exported', typeof vision.captureScreenshot === 'function')
assert('mind/vision: queryVLM exported', typeof vision.queryVLM === 'function')
assert('mind/vision: buildVisionForPrompt exported', typeof vision.buildVisionForPrompt === 'function')

// Section 19: Minimap Module
const minimap = await import('../mind/minimap.js')
assert('mind/minimap: renderMinimap exported', typeof minimap.renderMinimap === 'function')
assert('mind/minimap: getMinimapSummary exported', typeof minimap.getMinimapSummary === 'function')

// Source-level: graceful null returns
const _visionSrc = readFileSync(join(_here, '../mind/vision.js'), 'utf-8')
assert('vision.js never throws — returns null on failure', _visionSrc.includes('return null'))
assert('vision.js wraps execSync in try/catch', _visionSrc.includes('try') && _visionSrc.includes('execSync'))
assert('vision.js has VISION_URL env var', _visionSrc.includes('VISION_URL'))

// !see in registry
assert('registry has !see command', registry.listCommands().includes('see'))
assert('registry has 23 commands', registry.listCommands().length === 23)

// Spatial SPA-01: entity awareness in spatial.js
const _spatialSrc = readFileSync(join(_here, '../mind/spatial.js'), 'utf-8')
assert('spatial.js has getEntityAwareness', _spatialSrc.includes('getEntityAwareness'))
assert('spatial.js has HOSTILE_MOBS_SPATIAL set', _spatialSrc.includes('HOSTILE_MOBS_SPATIAL'))

// Prompt slots
const _promptSrc = readFileSync(join(_here, '../mind/prompt.js'), 'utf-8')
assert('prompt.js has visionContext injection slot (Part 5.9)', _promptSrc.includes('visionContext'))
assert('prompt.js mentions !see command', _promptSrc.includes('!see'))
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| prismarine-viewer headless (memory-heavy) | Xvfb screengrab via scrot | Decided in VISION-SCREENSHOTS.md | Zero additional memory; uses existing infrastructure |
| Per-tick vision (every 2s) | On-demand + background only | Research finding | Prevents GPU saturation; keeps tick budget intact |
| Replacing spatial.js with screenshots | Extending spatial.js + screenshots as supplement | ARCHITECTURE.md §3 decision | Structured data is more accurate; screenshots add spatial layout understanding only |
| Qwen2.5-VL on first vLLM process | Qwen2.5-VL-7B on second vLLM process (port 8001) | STATE.md v2.3 | Background brain already uses port 8001; vision shares same secondary process |

**Deprecated/outdated:**
- `prismarine-viewer` headless: valid technique but unnecessary here since Xvfb is already running. Skip for HermesCraft.
- STEVE-1 / MineCLIP / VPT approaches: require fine-tuned video-pretrained models; not applicable to LLM-based text agent.

---

## Open Questions

1. **Is Qwen2.5-VL-7B on the same port 8001 as the background brain?**
   - What we know: STATE.md says secondary brain is Qwen3.5-9B, vision is Qwen2.5-VL-7B — these are different models.
   - What's unclear: Do they share port 8001 or need separate ports (8001 for background brain, 8002 for vision)?
   - Recommendation: Plan for a separate `VISION_URL` env var defaulting to `http://localhost:8002/v1`. In practice, if RunPod has enough VRAM, both can run as separate vLLM processes on different ports. Add `VISION_URL` alongside `BACKGROUND_BRAIN_URL`. The planner should define `VISION_URL=http://localhost:8002/v1` as the default.

2. **What XVFB_DISPLAY value per bot in duo mode?**
   - What we know: `launch-duo.sh` launches two bots; each likely gets its own Xvfb display. `AGENT_NAME` differentiates data dirs.
   - What's unclear: Whether the display number is passed as an env var or baked in.
   - Recommendation: Add `XVFB_DISPLAY` to `loadAgentConfig()` with a sensible per-bot default (luna=:1, max=:2). Check `launch-duo.sh` for current Xvfb setup and align. The planner should read `launch-duo.sh` to confirm display assignment.

3. **ImageMagick `convert` availability for screenshot resize?**
   - What we know: `/usr/bin/import` is present (ImageMagick), `scrot` is present.
   - What's unclear: Whether `convert` is also available on RunPod pods.
   - Recommendation: In `captureScreenshot`, attempt resize with `convert` via try/catch — if it fails, use full-size image. The VLM will handle it, just consuming more tokens. Non-blocking.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `scrot` | Screenshot capture for `!see` | ✓ | 1.10 at /usr/bin/scrot | ImageMagick `import` (also present at /usr/bin/import) |
| `xvfb-run` | Xvfb headless display | ✓ | present at /usr/bin/xvfb-run | n/a — RunPod pods have Xvfb |
| `openai` npm | VLM API calls | ✓ | 4.104.0 installed | n/a — already installed |
| `canvas` npm | Minimap rendering | ✗ | 3.2.2 on npm, NOT installed | Text-based `getMinimapSummary()` with no image output |
| Qwen2.5-VL-7B vLLM | VLM description | ✗ (RunPod only) | — | Return null; agent continues without vision |
| `prismarine-viewer` npm | Alternative renderer | ✗ | 1.33.0 on npm, NOT installed | Not needed — Xvfb screengrab is chosen path |
| `child_process` (Node built-in) | execSync for scrot | ✓ | Node 24.11.1 built-in | n/a |

**Missing dependencies with no fallback:**
- None — all missing items have either a code-level fallback (return null on VLM unavailable) or a text alternative (minimap summary without canvas).

**Missing dependencies with fallback:**
- `canvas` npm: minimap renders as text summary if canvas not installed. Wave 0 should include `npm install canvas` + apt Cairo libs.
- Qwen2.5-VL-7B: every vision call returns null if VLM unreachable. Agent continues with structured spatial data only.

---

## Validation Architecture

> nyquist_validation is explicitly `false` in .planning/config.json — this section is skipped.

---

## Integration Points Summary

| Feature | Touch Points | New Files | Modified Files |
|---------|-------------|-----------|----------------|
| `!see` on-demand vision | mind/index.js, mind/registry.js, mind/prompt.js | `mind/vision.js` | `mind/index.js`, `mind/registry.js`, `mind/prompt.js` |
| Top-down minimap | mind/backgroundBrain.js, mind/prompt.js | `mind/minimap.js` | `mind/backgroundBrain.js`, `mind/prompt.js` |
| Entity awareness (SPA-01) | mind/spatial.js | — | `mind/spatial.js` |
| Post-build scan (SPA-02) | mind/index.js, body/skills/scan.js | — | `mind/index.js` |
| Area familiarity (SPA-04) | mind/minimap.js (new), mind/prompt.js | `mind/minimap.js` | `mind/prompt.js` |
| Screenshot storage | mind/vision.js | `data/<agent>/screenshots/*.png` | — |
| Smoke tests | tests/smoke.test.js | — | `tests/smoke.test.js` |

**Mind/Body boundary: UNCHANGED.** All new modules are in `mind/`. `scanArea` from `body/skills/scan.js` is already imported in `mind/registry.js` — calling it from `mind/index.js` is safe (same pattern as existing `build` and `getActiveBuild` calls).

---

## Sources

### Primary (HIGH confidence)
- `.planning/research/VISION-SCREENSHOTS.md` — headless rendering options, VLM performance data, Xvfb screengrab recommendation, implementation path
- `.planning/research/ARCHITECTURE.md` §3 — vision system integration decision: extend spatial.js, no screenshots replacing structured data
- `mind/spatial.js` (direct read) — existing three-tier pattern, block classification sets, cache pattern
- `mind/backgroundBrain.js` (direct read) — secondary LLM client pattern, ring buffers, graceful error handling, atomic writes
- `mind/index.js` (direct read) — think() guard pattern, pre-dispatch command handling, _lastDeath consume-once pattern
- `mind/registry.js` (direct read) — command stub pattern for pre-dispatch commands, listCommands() count = 22 currently
- `mind/prompt.js` (direct read) — injection slot numbering (Part 5.8 is brainState; 5.9 = visionContext, 5.10 = minimap)
- `tests/smoke.test.js` (direct read) — existing test structure, source-level assertion patterns
- Environment probes — `scrot` v1.10 confirmed at /usr/bin/scrot; `canvas` NOT installed; `openai` 4.104.0 installed

### Secondary (MEDIUM confidence)
- `npm view canvas version` → 3.2.2 (confirmed available for install)
- `.planning/STATE.md` — locked architecture decisions: Qwen2.5-VL-7B at 130ms TTFT on A100, port 8001 for secondary

### Tertiary (LOW confidence)
- Qwen2.5-VL token consumption formula (28×28 = 1 token) — from VISION-SCREENSHOTS.md which cites HuggingFace discussion; not independently re-verified this session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — scrot/openai confirmed installed; canvas version confirmed on npm; prismarine-viewer explicitly ruled out
- Architecture: HIGH — all integration points verified against direct codebase reads; patterns taken from existing backgroundBrain.js and spatial.js
- Pitfalls: HIGH — derived from VISION-SCREENSHOTS.md known issues + direct inspection of existing code patterns
- SPA-01/SPA-02/SPA-04: HIGH — bot.entities API exists in mineflayer; scanArea() confirmed working (smoke tests pass); minimap summarizer is straightforward block iteration

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain; Node.js canvas and mineflayer APIs are stable)
