---
phase: 12-knowledgestore
plan: "01"
subsystem: knowledge-retrieval
tags: [rag, retrieval, embeddings, bm25, vector-search, rrf]
dependency_graph:
  requires: [mind/knowledge.js, start.js]
  provides: [mind/knowledgeStore.js]
  affects: [start.js, tests/smoke.test.js]
tech_stack:
  added:
    - vectra@0.12.3
    - minisearch@7.2.0
    - "@huggingface/transformers@3.8.1"
  patterns:
    - Module-level singleton state (matches memory.js, social.js pattern)
    - Eager embedding at init (all chunks pre-embedded at startup)
    - RRF fusion (reciprocal rank fusion k=60 merges BM25 + vector)
    - batchInsertItems for single Vectra file write (avoids per-item I/O slowness)
key_files:
  created:
    - mind/knowledgeStore.js
  modified:
    - package.json
    - package-lock.json
    - .gitignore
    - start.js
    - tests/smoke.test.js
decisions:
  - "Use batchInsertItems instead of looping insertItem — avoids per-item file I/O (Vectra pitfall 1)"
  - "createIndex({ deleteIfExists: true }) instead of rmSync — cleaner rebuild-every-startup pattern"
  - "Vectra queryItems(qVec, '', 50) — empty string for query param, topK as 3rd arg (verified from .d.ts)"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-23"
  tasks_completed: 2
  files_created: 1
  files_modified: 4
  assertions_added: 11
  total_assertions: 267
requirements_fulfilled: [RAG-05, RAG-06]
---

# Phase 12 Plan 01: KnowledgeStore Summary

## One-liner

Hybrid BM25 + vector retrieval engine using MiniSearch, Vectra, and local all-MiniLM-L6-v2 ONNX embeddings with RRF (k=60) fusion over 2,677 chunks.

## What Was Built

`mind/knowledgeStore.js` — a complete hybrid retrieval module that:
- Exports `initKnowledgeStore(chunks)` — async init called once at startup after `loadKnowledge()`; loads all-MiniLM-L6-v2 ONNX model (~23MB, cached to `.cache/models/`), builds MiniSearch BM25 index and Vectra vector index with 384-dim embeddings of all 2,677 chunks
- Exports `retrieveKnowledge(query, topK=8)` — async retrieval that runs BM25 + vector search in parallel, fuses ranked lists via RRF (k=60), returns `{chunk, score}[]` sorted by fused score
- Uses `batchInsertItems` to avoid Vectra's per-item file I/O bottleneck (pitfall from research)
- Caches model in `.cache/models/` (gitignored), rebuilds Vectra index at every startup with `deleteIfExists: true`

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install dependencies and create mind/knowledgeStore.js | a611fa1 | mind/knowledgeStore.js, package.json, .gitignore |
| 2 | Wire into start.js and add smoke tests | cd8bec6 | start.js, tests/smoke.test.js |

## Verification Results

All plan verification checks passed:
- `Object.keys(knowledgeStore)` = `['initKnowledgeStore', 'retrieveKnowledge']` (exactly 2 exports)
- `node tests/smoke.test.js` — 267 passed, 0 failed (256 existing + 11 new)
- `grep 'initKnowledgeStore' start.js` — shows import and await call
- `grep '.cache/' .gitignore` — cache directory gitignored
- All 3 dependencies present in package.json (vectra, minisearch, @huggingface/transformers)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written, with one improvement on Vectra insertion:

**[Rule 2 - Enhancement] Used batchInsertItems instead of per-item insertItem loop**
- **Found during:** Task 1 implementation
- **Issue:** Research (Pitfall 1) warned that `insertItem` in a tight loop causes per-item file I/O for 2,677 items and could take 10+ seconds
- **Fix:** The `.d.ts` inspection revealed `batchInsertItems(items[])` API that defers all writes to a single `endUpdate()` call. Used this instead.
- **Impact:** Significantly faster startup — all 2,677 items inserted in a single batch write
- **Files modified:** mind/knowledgeStore.js

**[Rule 2 - Enhancement] Used createIndex({ deleteIfExists: true }) instead of rmSync**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified `rmSync` + `createIndex()` as the safer fallback for Pitfall 5 (existing index folder)
- **Fix:** The `.d.ts` confirmed `deleteIfExists?: boolean` exists in `CreateIndexConfig`. Used this directly — cleaner than manual filesystem cleanup.
- **Files modified:** mind/knowledgeStore.js

## Key Decisions Made

1. `batchInsertItems` preferred over `insertItem` loop — avoids per-item file I/O; all 2,677 vectors inserted in one atomic write
2. `createIndex({ version: 1, deleteIfExists: true })` — eliminates need for manual `rmSync` on existing index
3. `queryItems(qVec, '', 50)` — confirmed via LocalIndex.d.ts: signature is `(vector, query, topK, filter?, isBm25?)`. Empty string for query is correct when using pure vector search.

## Self-Check: PASSED

- FOUND: mind/knowledgeStore.js
- FOUND: start.js
- FOUND: tests/smoke.test.js
- FOUND: a611fa1 (Task 1 commit)
- FOUND: cd8bec6 (Task 2 commit)
- Smoke tests: 267 passed, 0 failed
