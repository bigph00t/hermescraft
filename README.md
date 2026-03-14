<p align="center">
  <img src="hermescraft.png" alt="HermesCraft" width="100%">
</p>

# HermesCraft

An autonomous AI agent that plays Minecraft survival from scratch — powered by [NousResearch Hermes](https://nousresearch.com/) models running locally via vLLM. No human input. The agent controls a real Minecraft client through a custom Fabric mod, thinks through problems with visible reasoning chains, learns from every death, and works through 7 phases to defeat the Ender Dragon.

Works with any Hermes model (8B, 14B, 36B, 70B) — just set `MODEL_NAME` in your `.env`. We currently run [Hermes 4.3 36B FP8](https://huggingface.co/Doradus/Hermes-4.3-36B-FP8) on an A40 GPU.

Built around the Hermes philosophy of individual alignment — the model is a conscious, strategic thinker ("God of Cunning"), not a scripted bot.

## How It Works

Every 3 seconds, the agent runs an **observe → think → act** loop:

1. **Observe** — Fetch full game state from the HermesBridge mod (position, health, inventory, nearby blocks/entities, open GUI contents)
2. **Think** — The model reasons inside `<think>` tags: evaluates the plan, weighs options, considers risks. Thinking is visible to stream viewers.
3. **Act** — Call one tool via Hermes native function calling (mine, craft, navigate, attack, smelt, etc.)

The agent maintains multi-turn conversation history with tool results, learns from deaths, creates reusable skills from successful phases, and adapts its strategy over time.

### Terminal Output (Designed for Livestreaming)

```
──────────────────────────────────────────────────────────────────────
  ♥♥♥♥♥♥♥♥♥♥ HP:20  🍖🍖🍖🍖🍖 Food:20  ☀ overworld (100, 64, -200)

  💭 Hermes:
  │ I have 4 oak logs. My plan says I need to craft planks first,
  │ then a crafting table. Let me craft oak_planks — 1 log gives 4
  │ planks, so 4 logs = 16 planks. More than enough for a table
  │ and sticks. Craft planks first.

  ▶ craft {"item":"oak_planks"}
  ✓ Crafted oak_planks
```

## Features

### Hermes Native Tool Calling
24 tools defined in OpenAI function-calling format, parsed by vLLM's built-in Hermes tool parser. `tool_choice: 'auto'` lets the model reason naturally before choosing a tool — no forced calls.

### Visible Thinking
The model produces `<think>` reasoning before tool calls. Viewers see the strategic mind at work — planning, weighing tradeoffs, reacting to danger. Works with any Hermes model that supports thinking mode.

### Multi-Level Memory
- **L1 Session**: Multi-round conversation history with tool results
- **L2 Curated**: Lessons from deaths, strategies, world knowledge (persisted to disk)
- **L3 Transcripts**: Full session logs in JSONL
- **L4 Skills**: Learned strategies per phase in [agentskills.io](https://agentskills.io) format, auto-created on phase completion

### Visual Crafting & Smelting
Crafting and smelting are sustained multi-tick actions — the GUI opens visually and items are placed one per tick so viewers can see the process. Screen contents (crafting grid, furnace slots) are reported in game state.

### 7-Phase Goal Progression
Phase objectives and tips are injected into the system prompt. Progress tracking shows completed/remaining items. The model knows what it needs to do and what it's already done.

### Death Learning & Stuck Recovery
Deaths trigger cause analysis (mob, fall, fire, etc.) with contextual factors. Lessons are stored and injected into future prompts. Stuck detection forces reassessment after 3 repeated failures.

### Notepad (LLM-Driven Planning)
The model maintains a persistent notepad — its strategic journal. It writes plans, tracks progress, and updates as it learns. The notepad persists across ticks and deaths.

### Information Tools
- **recipes** — Look up crafting recipes by item name
- **wiki** — Search the Minecraft wiki for game mechanics
- **notepad** — Read/write persistent strategic notes

## Prerequisites

- **GPU**: Depends on model — 8GB+ (8B), 24GB+ (14B), 40GB+ (36B FP8)
- **Minecraft**: Java Edition 1.21.1 with [Fabric](https://fabricmc.net/) loader + [Baritone](https://github.com/cabaletta/baritone) mod
- **Node.js**: 20+
- **Python**: 3.10+ with [vLLM](https://docs.vllm.ai/) installed
- **Java**: JDK 21 (for building the mod)

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/hermescraft/hermescraft.git
cd hermescraft
cp .env.example .env
npm install

# 2. Build the HermesBridge mod
cd mod && ./gradlew build
cp build/libs/hermesbridge-*.jar /path/to/minecraft/mods/
cd ..

# 3. Start vLLM (separate terminal — takes ~2 min to load)
./vllm.sh

# 4. Launch Minecraft 1.21.1 with Fabric + HermesBridge + Baritone
#    Open a singleplayer survival world

# 5. Start the agent
./start.sh
```

## Configuration

Edit `.env`:

```bash
VLLM_URL=http://localhost:8000/v1
MODEL_NAME=Doradus/Hermes-4.3-36B-FP8   # Any Hermes model works
MOD_URL=http://localhost:3001
TICK_MS=3000
```

Any model from the [Hermes collection](https://huggingface.co/collections/NousResearch/hermes-4-collection-68a731bfd452e20816725728) works — 8B for quick experiments, 14B for decent play, 36B+ for serious autonomous runs. Just set `MODEL_NAME` and adjust `vllm.sh` flags for your GPU.

### vLLM Tuning

`vllm.sh` defaults are tuned for a 40-48GB GPU with the 36B model. Adjust for your setup:

| Setting | Default | Notes |
|---------|---------|-------|
| `--max-model-len` | 16384 | Lower for smaller GPUs (8192 fits most setups) |
| `--gpu-memory-utilization` | 0.95 | Lower if you get OOM on startup |
| `--max-num-seqs` | 1 | Increase if running multiple agents |
| `--tool-call-parser` | hermes | Required for native function calling |
| `--enable-prefix-caching` | on | Caches system prompt + tool schemas across ticks |

## Architecture

```
hermescraft/
├── agent/                    # Node.js agent
│   ├── index.js              # Main observe-think-act loop
│   ├── llm.js                # LLM client (OpenAI-compatible, tool calling + fallback)
│   ├── prompt.js             # System prompt builder (identity + phase context)
│   ├── tools.js              # 24 tool definitions (OpenAI function format)
│   ├── actions.js            # Action dispatch to mod API
│   ├── state.js              # Game state reader + summarizer
│   ├── goals.js              # 7-phase progression system
│   ├── memory.js             # Multi-level memory (L1-L4)
│   ├── skills.js             # Learned skill creation (agentskills.io)
│   └── logger.js             # Stream-quality terminal output
├── mod/                      # HermesBridge Fabric 1.21.1 mod (Java)
│   └── src/main/java/hermescraft/
│       ├── HermesBridgeMod.java       # Mod entry + tick registration
│       ├── HttpServer.java            # HTTP API (port 3001)
│       ├── ActionExecutor.java        # Action execution (instant + sustained)
│       ├── StateReader.java           # Game state extraction
│       ├── BaritoneIntegration.java   # Pathfinding integration
│       └── RecipeLookup.java          # Recipe query system
├── config/                   # Agent config + OBS scene layout
├── vllm.sh                   # vLLM launcher (auto-restart + zombie cleanup)
├── start.sh                  # Agent launcher (preflight + auto-restart)
└── .env.example              # Environment variables template
```

### HermesBridge Mod API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Mod status check |
| `/state` | GET | Full game state (vitals, inventory, nearby blocks/entities, open screen contents) |
| `/action` | POST | Execute action (24 types: navigate, mine, craft, smelt, attack, place, eat, equip, look, break_block, walk, chat, etc.) |
| `/recipes?item=X` | GET | Recipe lookup by item name |

### The 7 Phases

| # | Phase | Key Objectives |
|---|-------|---------------|
| 1 | First Night | Wood, tools, stone, furnace, shelter |
| 2 | Iron Age | Iron ore, smelt ingots, iron gear, shield |
| 3 | Diamonds | Mine to Y=-59, diamond gear, obsidian |
| 4 | Nether | Build portal, enter Nether |
| 5 | Blaze Rods | Find fortress, 7+ blaze rods |
| 6 | Ender Pearls | Hunt endermen, 12+ Eyes of Ender |
| 7 | Dragon Fight | Find stronghold, enter End, kill the dragon |

## Why Hermes?

HermesCraft is built around [NousResearch's Hermes](https://nousresearch.com/) model family because of:

- **Native function calling** — Hermes models have dedicated `<tool_call>` tokens trained with binary-reward accuracy. Tool calls are single tokens, not generated character-by-character.
- **Thinking + tool calling** — `<think>` tags interleave naturally with tool calls in a single response. The model reasons then acts.
- **Individual alignment** — Hermes follows system prompts precisely. No corporate guardrails refusing to play a game or overriding the agent personality.
- **Open weights** — Fully local, no API keys, no rate limits, runs 24/7. Models from 8B to 405B.
- **Steerable identity** — Hermes adopts whatever persona the system prompt defines. The "God of Cunning" identity gives it strategic depth rather than robotic task execution.

The vLLM integration uses `--tool-call-parser hermes` which understands the native Hermes tool format. The agent code also includes a three-tier text fallback parser (Hermes XML, REASONING/ACTION format, raw JSON) for maximum compatibility across model sizes and serving configurations.

## License

MIT
