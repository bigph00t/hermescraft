---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Minecraft RAG
status: ready_to_plan
last_updated: "2026-03-23T02:30:00.000Z"
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Agents feel and play like real people — with deep game knowledge
**Current focus:** Phase 11 — Knowledge Corpus (ready to plan)

## Current Position

Phase: 11 of 13 (Knowledge Corpus)
Plan: —
Status: Ready to plan
Last activity: 2026-03-23 — Roadmap created for v2.2 Minecraft RAG

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*

## Accumulated Context

### Key Architecture Decisions

- Mind + Body split enforced; KnowledgeStore sits between prompt builder and corpus
- Vectra (in-process, file-backed) for vector search; MiniSearch for BM25 keyword search
- Hybrid RRF fusion of BM25 + vector results (k=60 formula)
- Local all-MiniLM-L6-v2 via @huggingface/transformers — no external API calls
- minecraft-data covers recipes/items/blocks/entities; strategic knowledge must be hand-authored
- Retrieval triggers: explicit !wiki call, skill failure, phase change — NOT every tick
- Always-present core (~1,500 tokens) replaces GAMEPLAY_INSTRUCTIONS; RAG adds 0-4,000 on demand

### Pending Todos

None yet.

### Blockers/Concerns

- Embedding model cold start (~2-5s) must not block tick loop — initialize before tick loop starts
- Vectra index rebuild needed if hand-authored Markdown files change — hash-check at startup

## Session Continuity

Last session: 2026-03-23
Stopped at: Roadmap written, ready to plan Phase 11
Resume file: None
