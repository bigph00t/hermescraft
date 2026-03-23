# Vision & Screenshots for Headless Mineflayer Bots

Research date: 2026-03-23

---

## Summary

Capturing a true first-person screenshot from a headless Mineflayer bot is possible but non-trivial.
The canonical tool is **prismarine-viewer's headless module** backed by `node-canvas-webgl` / `headless-gl`.
It does not need a physical GPU (Mesa software renderer suffices) but historically needed Xvfb on Linux.
Newer headless-gl builds using ANGLE can work without Xvfb at all.

For HermesCraft's use-case the cost/benefit math heavily favors **structured text alternatives** over
real screenshot capture — with vision as an optional on-demand enrichment, not a per-tick requirement.

---

## 1. prismarine-viewer — Headless Rendering

### What it is
A PrismarineJS library that renders the bot's world view using Three.js WebGL. Can output:
- A web browser viewer (serves on a port)
- A video file (`output.mp4`) via headless mode
- Individual PNG frames via `canvas.toBuffer()` (from the `examples/exporter/screenshot.js`)

### Headless API

```js
import { headless } from 'prismarine-viewer'

bot.once('spawn', () => {
  headless(bot, {
    output: 'output.mp4',   // or host:port for TCP stream
    frames: 200,            // -1 for infinite
    width: 512,
    height: 512,
    viewDistance: 6,        // chunks
  })
})
```

For PNG frame capture, use the `examples/exporter/screenshot.js` pattern which calls `canvas.toBuffer('image/png')` directly from the node-canvas-webgl canvas object.

### Dependencies

```
npm install prismarine-viewer
npm install PrismarineJS/node-canvas-webgl   # pinned to GitHub, not npm registry
# or install headless-gl + node-canvas separately
```

System packages needed (Ubuntu/Debian):
```
apt-get install libxi-dev libxext-dev libglu1-mesa-dev libglew-dev pkg-config build-essential xvfb
```

### GPU / Display Requirements

**node-canvas-webgl** combines two libraries:
- `node-canvas` — 2D canvas (uses Cairo, pure CPU)
- `headless-gl` — WebGL via ANGLE/EGL (the tricky part)

**headless-gl** can use Mesa's software renderer (llvmpipe/softpipe) — no dedicated GPU needed.
On cloud Linux instances without a GPU, Mesa software rendering is the expected path.

**Xvfb requirement**: Historically required (`xvfb-run -s "-ac -screen 0 1280x1024x24" node script.js`).
Newer headless-gl versions using EGL directly may not need Xvfb — but Mesa's swrast EGL support is
incomplete in some distros. Safest bet: always wrap with `xvfb-run` on Linux servers.

RunPod pods with NVIDIA GPUs: headless-gl will use the GPU's EGL automatically — fast and no Xvfb needed.

### Performance

- Software render (llvmpipe): slow. Expect 1-5 fps at 512×512 for a loaded world.
- GPU render (NVIDIA EGL): significantly faster; exact fps depends on GPU.
- Not suitable for every-tick capture. Appropriate for on-demand snapshots.
- Memory: Three.js + loaded chunk geometry is expensive. Expect 200-500 MB resident.

### Known Issues

- `createCanvas is not a function` — missing `canvas` npm package (install explicitly)
- `getUniformLocation of null` — WebGL context failed; need Xvfb or proper EGL setup
- Module resolution errors on fresh installs — `npm install canvas` fixes it
- Not maintained aggressively; issues go stale. Versions must be pinned carefully.

### Screenshot Resolution and View Distance

- Default 512×512. Can go up to 1280×720 or higher with GPU.
- `viewDistance: 6` renders a 12-chunk diameter sphere. Lower = faster.
- For AI vision purposes 320×240 at viewDistance 3-4 is likely sufficient.

---

## 2. Other Rendering Options

### mineflayer-panorama

- Plugin that renders 360° panoramas from bot world data
- Uses the same node-canvas-webgl stack
- Output: JPEG panorama files
- Same headless requirements as prismarine-viewer
- Useful for "what's around me" queries but heavy weight

### Puppeteer + prismarine-web-client

- `prismarine-web-client` runs the Minecraft renderer in a browser (Three.js in Chrome)
- Puppeteer controls headless Chrome and can call `page.screenshot()`
- Chrome headless with `--no-sandbox --disable-gpu` uses software rendering (Swiftshader)
- This is the most browser-friendly path but heaviest: ~500 MB+ per instance
- Scales poorly for multi-bot setups (one Chrome per bot)
- **Not recommended for HermesCraft** — resource cost too high for 10+ bots

### Xvfb + real Minecraft client

- HermesCraft already does this for the Fabric mod client
- Could `import-screenshot` or use `scrot`/`import` to capture the display
- Fast (captures GPU rendered frame directly)
- Already running in the stack — lowest-friction option for the actual game view
- Command: `DISPLAY=:${DISPLAY_NUM} import -window root -crop 1024x768+0+0 screenshot.png`
- Or: `DISPLAY=:${DISPLAY_NUM} scrot screenshot.png`
- **This is already available in HermesCraft's existing architecture.**

### node-canvas (2D only) — Top-Down Map Render

- No WebGL needed — pure Cairo/2D
- Render a top-down grid of block colors from `bot.world` chunk data
- ~30ms to render a 64×64 block area at full resolution
- Output: PNG via `canvas.toBuffer()`
- **Lightweight, no display/GPU needed, pure Node.js**
- Cannot render 3D perspective but gives spatial/terrain overview

---

## 3. Vision Model Processing

### Qwen2.5-VL on vLLM

Token consumption (28×28 pixels = 1 token formula):
- 256×256 image → ~84 tokens (minimum useful)
- 512×512 image → ~336 tokens
- Recommended range: 256–1280 tokens per image (set via `min_pixels`/`max_pixels`)
- A 320×240 Minecraft screenshot at 28px patch = ~100 tokens — very manageable

Inference speed (Qwen2.5-VL-7B on A100, from vLLM benchmark):
- Time to first token (TTFT): ~130ms
- Output throughput: ~1,455 tokens/s
- Roughly: a single image + 200-token description takes ~270ms total

**Can two models run on the same GPU?**

vLLM does not natively support multiple models on one GPU as separate services.
Workaround: use `gpu_memory_utilization` to partition VRAM between two vLLM instances.
Example: Hermes 36B FP8 uses ~36 GB; a 7B VLM in FP8 uses ~8 GB. On an 80 GB A100 this is
feasible. Each runs as a separate vLLM process with its own port.

Alternatively: use a **multimodal unified model** that handles both text and vision in one call
(e.g., Qwen2.5-VL-72B, or wait for Hermes 4 multimodal variant if released).

### Qwen3-VL (2025)

The Qwen3-VL architecture is available (via `github.com/QwenLM/Qwen3-VL`).
Mindcraft-CE built Andy-4.1 on Qwen3 VL (3B multimodal) — very fast on a single GPU.
Worth considering for HermesCraft if a small dedicated VLM is desired.

### What VLMs Extract vs. Block Data

Things a VLM can see that structured block data cannot easily express:
- **Relative spatial layout**: "there's a cliff to the left with a cave entrance mid-height"
- **Aesthetic state**: "this area looks burnt / flooded / built-up"
- **Entity behavior**: "a creeper is sneaking up from behind, half-hidden by a tree"
- **Biome/lighting ambiance**: "it's dusk, desert biome, no hostile mobs visible"
- **Build progress**: "the wall is half-built, missing the top two rows"
- **Danger cues**: "lava flowing 3 blocks ahead"

Things block data already handles better:
- Exact block type at coordinate (always accurate, no hallucination)
- Inventory contents
- Health/hunger/XP
- Entity list with positions
- Distance measurements

**Conclusion**: VLM vision adds the most value for spatial layout understanding, danger
detection at range, and build quality assessment. It does NOT add value for inventory,
crafting, or precise coordinate work.

---

## 4. What Other MC AI Projects Do

### Voyager (2023)
- **No vision** — pure text/code-based LLM agent
- Reads structured game state (inventory, position, nearby blocks, biome) as text
- GPT-4 generates JavaScript skill functions that mineflayer executes
- Proves that complex long-horizon tasks are achievable without screenshots

### STEVE-1 (2023)
- **Full vision** — uses MineCLIP + VPT (Video Pretraining model)
- Processes raw pixel frames at game speed (~20 fps)
- Requires fine-tuned vision model trained on MC video data
- Not applicable to LLM-based text agent architecture

### Mindcraft (2024-2025)
- **Optional vision** via configurable `vision_model`
- Uses prismarine-viewer to capture screenshots
- Supports `vision: "off" | "prompted" | "always"` modes
- `"prompted"` = only capture when the agent explicitly requests it (smart default)
- Separate vision model config (can be different provider/model from chat model)
- Andy-4.1 (Mindcraft-CE) is a 3B multimodal that does chat+vision in one model

### Ghost in the Minecraft / GITM (2024)
- **No vision** — entirely text-based with structured observation descriptions
- Uses `!nearbyBlocks`, `!craftable` style tool calls
- Paper explicitly found: "vision inputs do not dramatically affect performance" vs text-only

### Optimus-2 (CVPR 2025)
- **Full vision** — Goal-Observation-Action conditioned policy
- End-to-end multimodal model (DeepSeek-VL-1.3B backbone + behavior encoder)
- Trained on 25,000 MC videos (30M action pairs)
- Research system, not deployable as a drop-in agent

### Conclusion from Prior Work
Text-based structured observations perform nearly as well as full vision for most tasks.
Vision adds meaningful value for: terrain navigation, build inspection, hostile mob detection.
The "prompted" mode (on-demand vision) from Mindcraft is the right design pattern.

---

## 5. Alternatives to Screenshots

### Structured Block Grid → Text Description

```js
// Example: render 9x9x5 box around bot as text grid
function describeNearby(bot, radius = 4, height = 3) {
  const pos = bot.entity.position.floored()
  const layers = []
  for (let y = -1; y <= height; y++) {
    const row = []
    for (let z = -radius; z <= radius; z++) {
      const line = []
      for (let x = -radius; x <= radius; x++) {
        const block = bot.blockAt(pos.offset(x, y, z))
        line.push(block ? block.name.replace('minecraft:', '').slice(0, 3) : '???')
      }
      row.push(line.join(' '))
    }
    layers.push(`Y${y > 0 ? '+' : ''}${y}:\n` + row.join('\n'))
  }
  return layers.join('\n\n')
}
```

Output token cost: ~200-500 tokens for a 9×9 area. Interpretable by the text LLM directly.
No rendering pipeline needed. Always accurate. Zero latency.

### Top-Down 2D Map (node-canvas)

Render chunk surface heights as a colored image:
- Each pixel = 1 block column, colored by surface block type
- 64×64 block area → 64×64 PNG → ~50 tokens as image with Qwen2.5-VL
- Useful for navigation planning, terrain overview
- Pure node-canvas (no WebGL) — lightweight, no display needed
- Requires a texture-to-color mapping table for the ~100 most common blocks

### Xvfb Screengrab (Already Available)

HermesCraft already runs each bot's Minecraft client under Xvfb.
Existing infrastructure can capture screenshots trivially:

```bash
DISPLAY=:${XVFB_DISPLAY} import -window root screenshot.png
# or
DISPLAY=:${XVFB_DISPLAY} scrot -o screenshot.png
```

This captures the actual rendered game frame — the highest fidelity option, zero additional
rendering overhead, uses the GPU already driving the Minecraft client.

Cost: `scrot` or `import` from ImageMagick is ~50-100ms. Base64 encode + send to VLM adds ~10ms.

**This is the lowest-friction, highest-quality path for HermesCraft.**

---

## 6. Recommended Architecture

### Tier 1: Always-On (every tick)
- Structured block observation text (`!nearbyBlocks` equivalent)
- Entity list with distances and health
- Bot status (health, food, position, time of day)

### Tier 2: On-Demand (agent-triggered tool call)
- `capture_screenshot` tool that:
  1. Runs `scrot`/`import` on the bot's Xvfb display (already running)
  2. Encodes to base64
  3. Sends to local Qwen2.5-VL-7B vLLM endpoint
  4. Returns text description to agent
- Agent calls this when it needs spatial/visual understanding
- Budget: ~400ms total (100ms capture + 130ms TTFT + 170ms generation)

### Tier 3: Background Map (every 30-60 seconds or on significant move)
- Render top-down 2D minimap from chunk data using node-canvas
- Save as PNG to `agent/data/{name}/minimap.png`
- Optionally send to VLM for description; or just display in logs
- No GPU, no display dependency

### Anti-patterns to avoid
- Per-tick screenshot capture (too slow: 400ms >> 2s tick budget if multiple per tick)
- Running prismarine-viewer headless in the same Node.js process as the agent (memory + CPU conflict)
- Using Puppeteer per-bot (unacceptable memory: 500MB × 10 bots = 5 GB)
- Requiring a second GPU just for the VLM (manageable on one A100 80GB with memory partitioning)

---

## 7. Capture Frequency Recommendations

| Mode | Frequency | Rationale |
|------|-----------|-----------|
| Block data observation | Every tick (2s) | Zero cost, already in state |
| On-demand screenshot | Agent-triggered | ~400ms budget, amortized |
| Minimap render | Every 30s or on 50-block move | Low cost, navigation aid |
| Death/stuck trigger | On event | Diagnose what happened |
| Build inspection | End of build phase | Quality check |

Research from Mindcraft suggests 500ms minimum interval for PNG capture on fast hardware.
For VLM processing overhead, 5-10 seconds minimum recommended between vision calls.
Never capture every tick — even at 2s intervals this would saturate a 7B VLM.

---

## 8. Implementation Path for HermesCraft

### Phase A: Xvfb screenshot → VLM (lowest friction, highest value)

1. Add `captureScreenshot(agentName, displayNum)` to a new `agent/vision.js`:
   - Shell out to `scrot -o /tmp/hermes-${agentName}.png -d 0 --display :${displayNum}`
   - Read file, base64 encode
   - POST to local Qwen2.5-VL-7B endpoint (separate vLLM process on same RunPod pod)
   - Return text description

2. Add `see` tool to `agent/tools.js`:
   ```js
   {
     name: 'see',
     description: 'Capture and analyze a screenshot of what you currently see in-game. Use for spatial understanding, danger detection, build inspection.',
     parameters: { type: 'object', properties: {
       focus: { type: 'string', description: 'What to focus the analysis on' }
     }, required: [] }
   }
   ```

3. Launch second vLLM process on RunPod for Qwen2.5-VL-7B:
   ```bash
   python -m vllm.entrypoints.openai.api_server \
     --model Qwen/Qwen2.5-VL-7B-Instruct \
     --port 8001 \
     --gpu-memory-utilization 0.15  # ~12GB on 80GB A100
   ```

4. Add `VISION_URL` env var (default `http://localhost:8001/v1`)

### Phase B: Top-Down Minimap (no vision model needed)

1. `agent/minimap.js` — pure node-canvas (no WebGL)
2. Reads `bot.world` chunk data every 30s
3. Renders surface blocks as colored 64×64 PNG
4. Saves to `agent/data/{name}/minimap.png`
5. Optionally inject description into system prompt as "terrain overview"

### Phase C: Context-aware vision triggers

- Trigger vision call automatically on:
  - Death event (what killed me?)
  - Stuck detection (what's blocking me?)
  - Build phase completion (how does it look?)
  - Low health + hostile nearby (what's attacking me?)

---

## References

- [prismarine-viewer GitHub](https://github.com/PrismarineJS/prismarine-viewer)
- [headless.js example](https://github.com/PrismarineJS/prismarine-viewer/blob/master/examples/headless.js)
- [mineflayer screenshot with node-canvas-webgl README](https://github.com/PrismarineJS/mineflayer/blob/master/examples/screenshot-with-node-canvas-webgl/README.md)
- [headless-gl (stackgl)](https://github.com/stackgl/headless-gl)
- [node-canvas-webgl](https://github.com/akira-cn/node-canvas-webgl)
- [Qwen2.5-VL-7B-Instruct (Hugging Face)](https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct)
- [Qwen2-VL image token count discussion](https://huggingface.co/Qwen/Qwen2-VL-7B-Instruct/discussions/47)
- [vLLM multi-model GPU discussion](https://discuss.vllm.ai/t/speeding-up-vllm-inference-for-qwen2-5-vl/615)
- [vLLM Qwen2.5-VL benchmark (A100 TTFT 130ms)](https://github.com/vllm-project/vllm/issues/24728)
- [Mindcraft GitHub](https://github.com/mindcraft-bots/mindcraft)
- [Mindcraft-CE (Andy-4.1 multimodal)](https://github.com/mindcraft-ce/mindcraft-ce)
- [Voyager (no vision)](https://github.com/MineDojo/Voyager)
- [STEVE-1 (MineCLIP vision)](https://github.com/Shalev-Lifshitz/STEVE-1)
- [Ghost in the Minecraft / GITM](https://github.com/OpenGVLab/GITM)
- [Optimus-2 CVPR 2025](https://github.com/JiuTian-VL/Optimus-2)
- [MineStudio framework](https://arxiv.org/abs/2412.18293)
- [mineflayer-panorama](https://github.com/IceTank/mineflayer-panorama)
- [prismarine-viewer headless issue #128](https://github.com/PrismarineJS/prismarine-viewer/issues/128)
- [prismarine-viewer exporter README](https://github.com/PrismarineJS/prismarine-viewer/blob/master/examples/exporter/README.md)
