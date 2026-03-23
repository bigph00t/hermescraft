---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Minecraft RAG
status: Ready to execute
stopped_at: Roadmap written, ready to plan Phase 11
last_updated: "2026-03-23T03:16:04.873Z"
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 3
  completed_plans: 1
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Agents feel and play like real people — with deep game knowledge
**Current focus:** Phase 11 — Knowledge Corpus

## Current Position

Phase: 11 (Knowledge Corpus) — EXECUTING
Plan: 2 of 3

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

### Pending Todos

None yet.

### Blockers/Concerns

- Embedding model cold start (~2-5s) must not block tick loop — initialize before tick loop starts
- Vectra index rebuild needed if hand-authored Markdown files change — hash-check at startup

## Session Continuity

Last session: 2026-03-23
Stopped at: Completed 11-01-PLAN.md — mind/knowledge.js recipe chain resolver with 782 chunks
Resume file: None
