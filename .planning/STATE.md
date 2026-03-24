---
gsd_state_version: 1.0
milestone: v2.3
milestone_name: Persistent Memory & Ambitious Building
status: Milestone complete — ready for v2.4
stopped_at: All phases complete. Deployed 8 agents on Qwen3-8B. Prompt overhaul + SOUL-driven personalities.
last_updated: "2026-03-24T20:59:00.000Z"
progress:
  total_phases: 13
  completed_phases: 13
  total_plans: 23
  completed_plans: 23
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-24)

**Core value:** Agents that learn, grow, remember, and build ambitiously — playing Minecraft like real humans
**Current focus:** v2.3 complete — all phases shipped

## Current Position

Milestone: v2.3 COMPLETE
All 13 phases shipped.

## What happened this session (2026-03-24)

### Deployment
- Switched main brain from Qwen3.5-35B-A3B to **Qwen3-8B** (4x faster)
- vLLM config: `--max-model-len 4096 --max-num-seqs 16 --enforce-eager`
- Scaled from 6 to **8 agents** (luna, max, ivy, rust, ember, flint, sage, wren)
- MAX_TOKENS reduced 2048→384, MAX_HISTORY reduced 80→40
- Background brain (CPU llama.cpp) still running Qwen3-8B Q4_K_M on port 8001

### Prompt overhaul (major)
- Stripped ~200 lines of prescriptive gameplay instructions (FARMING, HUNTING, TRADING, etc.)
- System prompt now: SOUL personality + grounding + essential knowledge + commands
- Removed buildProgressionHint injection, forced chat responses, chat loop warnings
- Removed "stay in shelter" time labels
- SOUL files now drive all behavior — personality first, not rulebook

### SOUL file rewrite
- All 8 agents have unique, human personalities (not cartoonish)
- Removed pre-loaded inter-agent relationships — agents meet naturally
- Only Luna+Max know each other (arrived together)
- Everyone else discovers and forms relationships through play

### Chat system
- Added @name/@all directed chat — agents only process messages meant for them
- Real player messages always pass through (no prefix needed)
- No back-to-back chat rule — must do a game action between messages
- Prevents chat loops without killing natural conversation

### Bug fixes
- Death messages now injected into agent context
- Chat command parser fixed (all text after !chat = message)
- Simple Voice Chat mod installed on local Prism Launcher instance
- Voice chat port issue identified (RunPod no UDP) — TTS deferred to custom mod approach

## Pod Details
- Pod: RunPod A6000 48GB — `36xrd453rq0sy8-64410d88@ssh.runpod.io`
- Pod IP: `38.147.83.16:25565`
- SSH: must use `expect` (RunPod rejects non-PTY)
- Key: `~/.ssh/id_ed25519`

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260324-jfe | Comprehensive building overhaul: blueprints, design prompt, terrain clearing, roads, auto-torch | 2026-03-24 | 0f822f5 | [260324-jfe](./quick/260324-jfe-comprehensive-agent-building-overhaul-be/) |

## Next steps (v2.4 candidates)
- Custom Fabric mod for TTS over TCP (plugin channels, no UDP needed)
- Observe agent behavior with lean prompts — tune if needed
- Combat responsiveness testing with faster model
- Consider model quality vs speed tradeoffs
