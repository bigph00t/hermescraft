---
name: v2.3 dual-brain architecture with RunPod
description: User wants custom Qwen3.5-27B model on RunPod, dual-brain (main agent + background brain for memory/spatial), screenshot vision, tool auto-equipping
type: project
---

v2.3 expanded scope (2026-03-23):

- **Custom model**: Qwen3.5-27B-Claude-4.6-Opus-Reasoning-Distilled on RunPod (replacing MiniMax M2.7)
- **RunPod**: 48GB+ VRAM pod. At FP8: main model ~27GB + secondary small model ~7GB = ~34GB. 48GB A6000 works, 80GB A100 for headroom.
- **Dual-brain architecture**: Main agent (fast per-tick decisions) + Background brain (memory consolidation, spatial analysis, planning)
- **Screenshot vision**: Real screenshots processed into spatial understanding database. Captures from prismarine-viewer or Mineflayer render.
- **Secondary brain**: Smaller Qwen3.5 variant for background tasks (memory, spatial processing)
- **Tool equipping bug**: Agents mine without pickaxes — needs auto-equip before mining actions

**Why:** User wants to move off MiniMax to a custom powerful model, add a thinking layer that runs in background for deeper reasoning, and bring vision back through screenshots (not API calls — local model processing on RunPod).

**How to apply:** Add infrastructure phase (RunPod setup + model deployment) as Phase 14, shift other phases. Add dual-brain architecture as core system change. Screenshot vision replaces the "no vision" decision from v2.2.
