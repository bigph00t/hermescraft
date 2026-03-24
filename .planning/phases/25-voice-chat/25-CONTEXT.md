# Phase 25: Voice Chat - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Text-to-speech for all 8 agents via Simple Voice Chat plugin — each agent has a distinct voice, proximity-based so players hear nearby agents talking. Piper TTS on CPU, triggered by !chat actions.

</domain>

<decisions>
## Implementation Decisions

### TTS Engine & Architecture
- Piper TTS — lightweight, CPU-only, fast (<100ms per utterance). Does NOT use GPU VRAM (reserved for LLM)
- TTS bridge runs on the RunPod pod CPU alongside llama-server
- Audio delivered via Simple Voice Chat mod API — inject PCM audio as if from a player at the agent's position
- Audio format: 16kHz mono PCM (Simple Voice Chat native format, no transcoding)

### Voice Personality Mapping
- Use distinct Piper voice models for each of the 8 agents — Piper has ~30 English voices with varied pitch/speed/gender
- Voice is player-facing only — agents communicate via text chat, they don't "hear" each other's voice
- TTS triggers on every !chat action — TTS bridge watches agent chat messages and converts to audio
- Use Simple Voice Chat's built-in proximity attenuation — no custom distance curve code needed

### Claude's Discretion
- Which specific Piper voice model maps to which agent personality
- Python TTS bridge architecture (watch chat log vs webhook vs poll)
- Simple Voice Chat plugin configuration details
- How the TTS bridge discovers agent positions for spatial audio
- docker-compose.runpod.yml plugin installation method

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- docker-compose.yml / docker-compose.runpod.yml — existing server container config
- infra/start-stack.sh — orchestrates model + server + agent startup
- launch-agents.sh — 8-agent launcher (Phase 24)
- mind/index.js — dispatches !chat actions, could emit events for TTS bridge

### Established Patterns
- Python scripts in infra/ directory for tooling
- Agent chat messages visible in Minecraft server log
- Agents already have position data in /state endpoint

### Integration Points
- infra/start-stack.sh — needs to launch TTS bridge process
- docker-compose.runpod.yml — needs Simple Voice Chat plugin jar
- Agent chat output — TTS bridge needs to intercept chat messages
- Simple Voice Chat server-side API — for injecting audio

</code_context>

<specifics>
## Specific Ideas

- Piper models are small (~50-100MB each) — 8 models = ~800MB, negligible on pod
- Simple Voice Chat has a server-side API for audio injection (no client mod needed per agent)
- TTS bridge can tail the MC server log for chat messages (simplest architecture)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
