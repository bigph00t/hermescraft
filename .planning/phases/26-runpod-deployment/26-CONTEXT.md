# Phase 26: RunPod Deployment - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Full 8-agent stack running on RunPod A6000 48GB with TTS proximity voice chat. This is the final deployment phase — everything built in Phases 14-25 gets deployed and validated on real hardware.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions. Key constraint: 8 agents (not 4), Qwen3.5-35B-A3B MoE via llama-server, Piper TTS on CPU, Simple Voice Chat plugin.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- infra/setup-pod.sh — pod provisioning (model download + Piper install)
- infra/start-models.sh — llama-server launch with mmproj
- infra/start-stack.sh — orchestrates MC server + models + TTS bridge + agents
- launch-agents.sh — 8-agent tmux launcher
- docker-compose.runpod.yml — RunPod-specific Docker config
- .env.runpod — RunPod environment variables
- tts-plugin/ — Paper TTS plugin (jar)
- infra/tts-bridge.py — Python TTS bridge

### Established Patterns
- deploy-fresh.sh exists as a deployment script template
- infra/ directory for all deployment scripts
- .env.runpod for RunPod-specific config

### Integration Points
- RunPod pod provisioning via setup-pod.sh
- Full stack launch via start-stack.sh
- All 8 agents connect to single llama-server on port 8000
- TTS bridge connects to Paper plugin on port 8765

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
