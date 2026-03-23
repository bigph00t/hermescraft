---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Minecraft RAG
status: Ready to execute
stopped_at: Completed 13-01-PLAN.md
last_updated: "2026-03-23T04:48:15.172Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 6
  completed_plans: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Agents feel and play like real people — with deep game knowledge
**Current focus:** Phase 13 — Prompt Integration

## Current Position

Phase: 13 (Prompt Integration) — EXECUTING
Plan: 2 of 2

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
| Phase 11-knowledge-corpus P01 | 2 | 1 tasks | 2 files |
| Phase 11-knowledge-corpus P02 | 35 | 2 tasks | 7 files |
| Phase 11-knowledge-corpus P03 | 10 | 2 tasks | 3 files |
| Phase 12-knowledgestore P01 | 5m | 2 tasks | 5 files |
| Phase 13-prompt-integration P01 | 2m | 2 tasks | 2 files |

## Accumulated Context

### Key Architecture Decisions

- Mind + Body split enforced; KnowledgeStore sits between prompt builder and corpus
- Vectra (in-process, file-backed) for vector search; MiniSearch for BM25 keyword search
- Hybrid RRF fusion of BM25 + vector results (k=60 formula)
- Local all-MiniLM-L6-v2 via @huggingface/transformers — no external API calls
- minecraft-data covers recipes/items/blocks/entities; strategic knowledge must be hand-authored
- Retrieval triggers: explicit !wiki call, skill failure, phase change — NOT every tick
- Always-present core (~1,500 tokens) replaces GAMEPLAY_INSTRUCTIONS; RAG adds 0-4,000 on demand
- [11-01] Hardcode SMELT_FROM table (20 pairs) — minecraft-data v3.105.0 has no furnace recipe data for 1.21.1
- [11-01] Pass new Set(visited) to each recursive sub-call so siblings do not falsely block each other in DFS
- [11-01] Recipe tiebreak: prefer cobblestone/oak variants — mcData returns cobbled_deepslate first for furnace by coincidence
- [13-01] ESSENTIAL KNOWLEDGE core: tool tiers + ore Y-levels + essential chains + food priority (~150 tokens); crafting chains/building materials/survival details moved to RAG
- [13-01] ragContext slot (Part 5.7) in buildSystemPrompt between buildHistory and command reference; caller formats with ## RELEVANT KNOWLEDGE header

### Pending Todos

None yet.

### Blockers/Concerns

- Embedding model cold start (~2-5s) must not block tick loop — initialize before tick loop starts
- Vectra index rebuild needed if hand-authored Markdown files change — hash-check at startup

## Session Continuity

Last session: 2026-03-23T04:48:15.170Z
Stopped at: Completed 13-01-PLAN.md
Resume file: None
