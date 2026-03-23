# Phase 12: KnowledgeStore - Research

**Researched:** 2026-03-22
**Domain:** Hybrid RAG retrieval — BM25 (MiniSearch) + vector search (Vectra) + local embeddings (@huggingface/transformers)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Module at `mind/knowledgeStore.js` — follows mind/ convention with camelCase naming
- RRF fusion with k=60 (standard reciprocal rank fusion formula)
- Return top-8 chunks per query
- Rebuild index at startup from corpus — no stale index risk
- Eager load embedding model at init — agents knowledge-ready from first tick
- BM25 searches both `text` and `id` fields — weight `id` higher so exact item lookups rank first
- No deduplication within retrieval results — dedup by ID within each retrieval call
- Export: `retrieveKnowledge(query, topK=8)` → `Promise<{chunk, score}[]>`
- `initKnowledgeStore(chunks)` called after `loadKnowledge()` — takes full chunk array, builds both indexes
- Vectra for in-process vector store (file-backed)
- MiniSearch for BM25 keyword search
- `@huggingface/transformers` for local ONNX embeddings (all-MiniLM-L6-v2)
- Wire in `start.js` after `loadKnowledge()`, before `initMind`

### Claude's Discretion
- Internal index data structure details
- Vectra vs alternative in-process vector store implementation choice (locked to Vectra but internals free)
- MiniSearch configuration (stemming, fuzzy matching thresholds)
- Embedding batch size and caching strategy
- Error handling for embedding model load failures

### Deferred Ideas (OUT OF SCOPE)
- Persistent index caching (rebuild-on-hash-change)
- Query expansion / rewriting
- Multi-query retrieval (decompose complex questions into sub-queries)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RAG-05 | Hybrid vector + BM25 search (Vectra + MiniSearch) with RRF fusion returning top-K chunks | Vectra API, MiniSearch API, RRF formula all verified — see Standard Stack and Code Examples |
| RAG-06 | Local embeddings via all-MiniLM-L6-v2 through @huggingface/transformers (no external API) | @huggingface/transformers pipeline API verified, model ~23MB ONNX download, Node.js ESM compatible |
</phase_requirements>

---

## Summary

Phase 12 builds `mind/knowledgeStore.js` — the retrieval bridge between the Phase 11 corpus (2,677 chunks) and Phase 13's prompt injection. The module must: (1) embed all chunks at startup using `all-MiniLM-L6-v2` via `@huggingface/transformers`, (2) index them in Vectra for cosine similarity search and MiniSearch for BM25 keyword search, and (3) fuse both result sets using Reciprocal Rank Fusion (k=60) to return the top-8 most relevant chunks for any query string.

All three libraries are verified against their current published versions (vectra 0.12.3, minisearch 7.2.0, @huggingface/transformers 3.8.1). None are installed yet in the project — all three must be added to package.json. The embedding model downloads ~23MB ONNX on first run and caches locally; subsequent startups skip the download.

The critical performance question is how long it takes to embed 2,677 chunks. `all-MiniLM-L6-v2` is a 6-layer transformer with 384-dim output. Running via ONNX in Node.js (CPU), embedding in batches of 32 is the recommended approach. No public throughput benchmarks were found for this exact scenario, so startup time must be measured empirically — the 2-5 second budget from CONTEXT.md is a reasonable target but not guaranteed without testing.

**Primary recommendation:** Build `initKnowledgeStore(chunks)` as a single async function that runs embedding in batches (size 32), inserts into Vectra, and adds to MiniSearch — then `retrieveKnowledge(query, topK=8)` embeds the query, runs both searches, applies RRF, deduplicates by chunk ID, and returns `{chunk, score}[]`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vectra | 0.12.3 | In-process file-backed vector store for cosine similarity search | Locked decision; zero-infrastructure, fully in-memory queries, Node.js native |
| minisearch | 7.2.0 | In-memory BM25+ full-text search | Locked decision; tiny bundle, BM25+ algorithm, field boosting, no server needed |
| @huggingface/transformers | 3.8.1 | Local ONNX inference for all-MiniLM-L6-v2 embeddings | Locked decision; no external API calls, downloads ~23MB model once and caches |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| minecraft-data | ^3.105.0 | Already installed — provides the corpus | Used by knowledge.js, not knowledgeStore.js directly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vectra | hnswlib-node | HNSW is faster at scale but requires native binary, vectra is pure JS and simpler |
| vectra | @lancedb/lancedb | LanceDB is more feature-rich but heavier and locked to Vectra anyway |
| minisearch | flexsearch | FlexSearch is faster but less accurate BM25+ ranking; MiniSearch is more correct |
| @huggingface/transformers | openai embeddings API | External API = external dependency, violates RAG-06 |

**Installation:**
```bash
npm install vectra minisearch @huggingface/transformers
```

**Version verification:** Verified 2026-03-22 against npm registry:
- vectra: 0.12.3
- minisearch: 7.2.0
- @huggingface/transformers: 3.8.1

## Architecture Patterns

### Recommended Project Structure
```
mind/
├── knowledge.js          # Phase 11: corpus builder (exists)
├── knowledgeStore.js     # Phase 12: NEW — retrieval engine
└── index.js              # mind loop (existing, unchanged)

.cache/
└── models/               # ONNX model cache (gitignored)
```

### Pattern 1: Module-Level Singleton State
**What:** knowledgeStore.js holds its indexes in module-level variables, following the same pattern as memory.js, social.js, and locations.js in this codebase.
**When to use:** Always — this matches the established mind/ module pattern.
**Example:**
```javascript
// knowledgeStore.js — Hybrid BM25 + vector knowledge retrieval
import { LocalIndex } from 'vectra'
import MiniSearch from 'minisearch'
import { pipeline, env } from '@huggingface/transformers'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

let vectorIndex = null
let keywordIndex = null
let embedder = null
```

### Pattern 2: Eager Embedding at Init (Batch Processing)
**What:** Embed all 2,677 chunks during `initKnowledgeStore()` in batches, not lazily at query time.
**When to use:** Always — required by locked decision (eager load).
**Example:**
```javascript
// Source: @huggingface/transformers official docs (Xenova/all-MiniLM-L6-v2)
export async function initKnowledgeStore(chunks) {
  // Set cache dir so model files don't land in node_modules
  env.cacheDir = join(__dirname, '..', '.cache', 'models')

  // Load model (downloads ~23MB ONNX on first run, cached thereafter)
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')

  // Build MiniSearch BM25 index
  keywordIndex = new MiniSearch({
    fields: ['text', 'id'],        // both fields indexed for BM25
    storeFields: ['id'],           // only need id to look up chunk later
    idField: 'id',
  })
  keywordIndex.addAll(chunks)

  // Build Vectra vector index
  const indexPath = join(__dirname, '..', '.cache', 'knowledge-index')
  vectorIndex = new LocalIndex(indexPath)
  if (!await vectorIndex.isIndexCreated()) {
    await vectorIndex.createIndex({ version: 1 })
  }

  // Embed chunks in batches of 32
  const BATCH_SIZE = 32
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const texts = batch.map(c => c.text)
    const output = await embedder(texts, { pooling: 'mean', normalize: true })
    const vectors = output.tolist()  // number[][] — one 384-dim vector per chunk
    for (let j = 0; j < batch.length; j++) {
      await vectorIndex.insertItem({
        vector: vectors[j],
        metadata: { id: batch[j].id },
      })
    }
  }

  console.log(`[knowledgeStore] indexed ${chunks.length} chunks`)
}
```

### Pattern 3: RRF Fusion
**What:** Merge BM25 and vector ranked lists by reciprocal rank — avoids score normalization problems because scores are incomparable across methods (BM25 scores are unbounded, cosine similarity is 0-1).
**When to use:** Every call to `retrieveKnowledge`.
**Example:**
```javascript
// RRF formula: score(d) = sum over rankers of: 1 / (k + rank(d))
// k=60 is empirically validated constant (see Cormack et al. 2009)
function rrf(rankedLists, k = 60) {
  const scores = {}  // chunkId -> accumulated RRF score
  for (const list of rankedLists) {
    list.forEach((id, rank) => {
      scores[id] = (scores[id] || 0) + 1 / (k + rank + 1)
    })
  }
  return scores
}
```

### Pattern 4: Full `retrieveKnowledge` Flow
**What:** Embed query → run BM25 search → run vector search → RRF fusion → dedup → return top-K with scores.
**Example:**
```javascript
// Source: Combines verified APIs from all three libraries
export async function retrieveKnowledge(query, topK = 8) {
  // 1. BM25 search — boost id field to rank exact item matches first
  const bm25Results = keywordIndex.search(query, {
    fields: ['text', 'id'],
    boost: { id: 3 },
    fuzzy: 0.2,
  })
  const bm25Ids = bm25Results.slice(0, 50).map(r => r.id)

  // 2. Vector search — embed query, find nearest neighbors
  const qOut = await embedder(query, { pooling: 'mean', normalize: true })
  const qVec = Array.from(qOut.data)  // Float32Array -> number[]
  const vecResults = await vectorIndex.queryItems(qVec, '', 50)
  const vecIds = vecResults.map(r => r.item.metadata.id)

  // 3. RRF fusion
  const rrfScores = rrf([bm25Ids, vecIds])

  // 4. Sort by RRF score, dedup, return top-K with chunk objects
  const sorted = Object.entries(rrfScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)

  // chunkMap built during initKnowledgeStore for O(1) lookup
  return sorted.map(([id, score]) => ({ chunk: chunkMap.get(id), score }))
    .filter(r => r.chunk !== undefined)
}
```

### Pattern 5: `start.js` Wiring
**What:** `initKnowledgeStore(chunks)` inserted after `loadKnowledge()`, before `initMind`.
**Example:**
```javascript
// start.js — add these two lines after step 3.6
import { initKnowledgeStore } from './mind/knowledgeStore.js'

// Step 3.7 — build retrieval indexes (async, ~2-5s on first run)
const allChunks = loadKnowledge()  // returns chunks array
await initKnowledgeStore(allChunks)
```
Note: `loadKnowledge()` currently returns `chunks` implicitly and also sets the module-level `chunks` variable. Confirm its return value is the full array before wiring (it does — line 30 of knowledge.js: `return chunks`).

### Anti-Patterns to Avoid
- **Lazy embedding at query time:** Embedding a chunk on first retrieval causes variable latency, violates the 50ms target, and is excluded by the eager-load decision.
- **Not setting `env.cacheDir`:** Default cache is `node_modules/@huggingface/transformers/.cache/` which gets wiped on `npm install`. Set to `.cache/` at project root.
- **Passing raw Float32Array to vectra:** Vectra's `insertItem` expects `number[]`, not `Float32Array`. Use `Array.from(tensor.data)` for single-item embedding or `output.tolist()[j]` for batches.
- **Re-creating the Vectra index on every startup without checking `isIndexCreated()`:** Since we rebuild the index every startup anyway (locked decision), use `deleteIfExists: true` or delete and recreate — but note `createIndex` with existing folder throws without cleanup.
- **MiniSearch `addAll` with missing `id` field:** Chunks from knowledge.js all have `id` — confirm no chunk has `id: undefined` or MiniSearch throws.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cosine similarity + nearest neighbor | Custom vector math + brute-force loop | vectra LocalIndex | Already handles normalization, brute-force scan, and cosine similarity correctly |
| BM25 scoring with IDF/TF | Custom term frequency counter | MiniSearch | BM25+ is non-trivial; MiniSearch handles document frequency, tokenization, stemming |
| Sentence embedding | Custom tokenizer + transformer inference | @huggingface/transformers pipeline | ONNX runtime, tokenization, pooling, and normalization are all handled |
| Score normalization across BM25/vector | Min-max scaling heuristics | RRF | RRF avoids the normalization problem entirely by using ranks not scores |

**Key insight:** BM25 scores are unbounded (Lucene-style TF-IDF variants can produce scores of 10+) while cosine similarity is 0-1. Any custom score fusion requires calibration that drifts with corpus changes. RRF's rank-based fusion is corpus-invariant and requires zero tuning.

## Common Pitfalls

### Pitfall 1: Vectra Rewrites Index Files on Every Insert
**What goes wrong:** Calling `insertItem` in a tight loop for 2,677 chunks triggers 2,677 file writes to `index.json`, making startup catastrophically slow (potentially 10+ seconds).
**Why it happens:** Vectra's `insertItem` is atomic — it reads, modifies, and rewrites `index.json` every call.
**How to avoid:** Two options: (a) use `beginUpdate()` / `endUpdate()` if Vectra exposes a batch transaction API (check source — not confirmed in docs), or (b) delete the index folder and rebuild with a single bulk write. The safest approach: delete the old index, rebuild it fresh, and use a single `createIndex` + loop of `insertItem`. If startup is still slow, file an issue against vectra or switch the Vectra path to in-memory-only by storing vectors in a plain array and computing cosine similarity manually (vectra is file-backed by design).
**Warning signs:** `initKnowledgeStore` taking >5 seconds for 2,677 chunks.

### Pitfall 2: Model Download Blocks Startup on Cold Start
**What goes wrong:** First-ever run downloads the 23MB ONNX model from HuggingFace Hub. If the network is slow, startup blocks for 30+ seconds.
**Why it happens:** `pipeline()` call downloads the model synchronously before returning.
**How to avoid:** `env.cacheDir` must point to a persistent directory (not node_modules). After the first run, the model is cached and startup is fast. Document the cold-start behavior in the module header comment.
**Warning signs:** First startup takes >10 seconds.

### Pitfall 3: Single vs Batch Embedding Output Shape
**What goes wrong:** When embedding a single string (query time), `output.data` is a flat Float32Array of 384 values. When embedding a batch, `output.tolist()` returns `number[][]`. Mixing up the two shapes produces wrong vectors.
**Why it happens:** The pipeline accepts string or string[] — output shape changes accordingly.
**How to avoid:**
- Batch (init time): `const vectors = output.tolist()` → `vectors[j]` is a `number[384]`
- Single (query time): `const qVec = Array.from(output.data)` → `number[384]`
**Warning signs:** Vectra `insertItem` throws "vector must be an array" or similarity scores are nonsensical (all near 0 or all near 1).

### Pitfall 4: MiniSearch Returns `id` Not Full Chunk
**What goes wrong:** MiniSearch's `search()` only returns fields in `storeFields`. If only `id` is stored, callers get `{ id, score, match }` — not the full chunk object.
**Why it happens:** MiniSearch is a search index, not a document store. It returns IDs for lookup.
**How to avoid:** Build a `chunkMap = new Map(chunks.map(c => [c.id, c]))` at init time. After retrieval, use `chunkMap.get(id)` to hydrate results. This is `O(1)` per lookup.
**Warning signs:** `TypeError: Cannot read properties of undefined` when accessing `chunk.text`.

### Pitfall 5: Vectra `createIndex` Fails on Existing Folder
**What goes wrong:** If the `.cache/knowledge-index` folder already exists from a previous run, `createIndex()` throws without `deleteIfExists: true`.
**Why it happens:** Since we rebuild every startup (locked decision), the folder always exists after the first run.
**How to avoid:** Either pass `{ deleteIfExists: true }` to `createIndex`, or check `isIndexCreated()` and call a delete/recreate pattern. Given the rebuild-every-startup decision, `deleteIfExists: true` is simpler.
**Warning signs:** `Error: Index already exists` on second startup.

### Pitfall 6: Chunk Text Exceeds 256-Token Window
**What goes wrong:** all-MiniLM-L6-v2 has a 256-token context limit. Recipe chain texts in knowledge.js are capped at 600 characters (~150 tokens) — safe. Strategy chunks (H2 sections from Markdown) may be longer.
**Why it happens:** The model silently truncates input beyond 256 tokens; the embedding still succeeds but captures only the beginning of the text.
**How to avoid:** knowledge.js already caps recipe chains at 600 chars. Strategy chunks are typically H2 sections from concise Markdown — unlikely to exceed the limit. No pre-truncation needed, but log a warning if any chunk text exceeds ~900 chars (approximate 256-token threshold for English prose).
**Warning signs:** Semantic search for content that appears late in a long chunk returns no results.

## Code Examples

Verified patterns from official sources:

### Embed a Batch of Texts (Init Time)
```javascript
// Source: https://huggingface.co/Xenova/all-MiniLM-L6-v2
const output = await embedder(texts, { pooling: 'mean', normalize: true })
// output.dims = [batchSize, 384], output.type = 'float32'
const vectors = output.tolist()  // number[][] — one 384-dim array per text
```

### Embed a Single Query (Query Time)
```javascript
// Source: https://philna.sh/blog/2024/09/25/how-to-create-vector-embeddings-in-node-js/
const out = await embedder(queryString, { pooling: 'mean', normalize: true })
const qVec = Array.from(out.data)  // Float32Array -> number[384]
```

### MiniSearch: Index + BM25 Search with Field Boosting
```javascript
// Source: https://lucaong.github.io/minisearch/
import MiniSearch from 'minisearch'

const ms = new MiniSearch({
  fields: ['text', 'id'],
  storeFields: ['id'],
  idField: 'id',
})
ms.addAll(chunks)

// Search with id field boosted 3x so "iron_pickaxe" query ranks recipe_iron_pickaxe first
const results = ms.search('iron pickaxe', {
  boost: { id: 3 },
  fuzzy: 0.2,
  prefix: true,
})
// results: [{ id: 'recipe_iron_pickaxe', score: 12.4, match: {...} }, ...]
```

### Vectra: Insert + Query
```javascript
// Source: https://github.com/Stevenic/vectra
import { LocalIndex } from 'vectra'

const index = new LocalIndex('./my-index')
await index.createIndex({ version: 1, deleteIfExists: true })

await index.insertItem({
  vector: vectors[j],           // number[384]
  metadata: { id: chunk.id },
})

// Query: pass query vector, empty queryString, topK, no filter
const results = await index.queryItems(qVec, '', 50)
// results: [{ score: 0.94, item: { id: '...', vector: [...], metadata: { id: 'recipe_iron_pickaxe' } } }]
```

### RRF Fusion (k=60)
```javascript
// Source: Cormack et al. 2009 / https://www.paradedb.com/learn/search-concepts/reciprocal-rank-fusion
function rrf(rankedIdLists, k = 60) {
  const scores = new Map()
  for (const list of rankedIdLists) {
    list.forEach((id, rankIdx) => {
      const prev = scores.get(id) || 0
      scores.set(id, prev + 1 / (k + rankIdx + 1))
      // rankIdx is 0-based; +1 so rank 0 gives 1/(60+1) not 1/60
    })
  }
  return scores  // Map<chunkId, rrfScore>
}
```

### `env.cacheDir` Pattern for Model Caching
```javascript
// Source: https://huggingface.co/docs/transformers.js/en/tutorials/node
import { pipeline, env } from '@huggingface/transformers'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
env.cacheDir = join(__dirname, '..', '.cache', 'models')

const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External embedding API (OpenAI) | Local ONNX via @huggingface/transformers | ~2023-2024 | No API key, no latency, no cost per call |
| Custom BM25 implementation | MiniSearch (BM25+) | Stable since 2018 | Better IDF handling with BM25+ vs plain BM25 |
| Score-based fusion (normalize then add) | Rank-based RRF fusion | ~2023 mainstream | Eliminates need to calibrate score scales |
| Server-based vector DB (Pinecone, Weaviate) | In-process vectra | HermesCraft decision | Zero ops, zero latency for network, works offline |

**Deprecated/outdated:**
- `Xenova/` model prefix: The Xenova/ HuggingFace org is the legacy prefix for Transformers.js-compatible ONNX models. `Xenova/all-MiniLM-L6-v2` still works as of v3.8.1 — `onnx-community/all-MiniLM-L6-v2-ONNX` is the newer equivalent but `Xenova/all-MiniLM-L6-v2` remains functional and documented.

## Open Questions

1. **Vectra batch insert performance**
   - What we know: `insertItem` is atomic with file I/O per call
   - What's unclear: Whether vectra exposes a batch transaction API (`beginUpdate`/`endUpdate`) that defers writes — not confirmed in public docs
   - Recommendation: Start with per-item inserts; measure startup time empirically. If >5 seconds, either switch vector storage to a plain in-memory array with manual cosine similarity (defeating vectra's purpose but matching the performance need) or check vectra source for batch API.

2. **2,677 chunk embedding throughput**
   - What we know: all-MiniLM-L6-v2 is a 6-layer, 22M parameter model; ONNX quantized ~23MB; batch processing supported
   - What's unclear: Actual CPU throughput in this Node.js/ONNX runtime environment — no benchmarks found for this specific hardware/software stack
   - Recommendation: Measure on first implementation. If >5 seconds total, reduce batch size to 16 or add progress logging. If still too slow, consider pre-computing embeddings to a JSON file (but this conflicts with the rebuild-every-startup decision).

3. **Vectra `deleteIfExists` option name**
   - What we know: The pattern is documented; exact option name `deleteIfExists` is from the GitHub README example
   - What's unclear: Whether this is `deleteIfExists` or `delete_if_exists` in the actual published API
   - Recommendation: Check the vectra TypeScript definitions after install: `node_modules/vectra/dist/LocalIndex.d.ts`. Fallback: manually delete the index folder with `rmSync` if `createIndex` throws.

## Sources

### Primary (HIGH confidence)
- `https://github.com/Stevenic/vectra` — LocalIndex API, insertItem, queryItems, createIndex, file structure, queryString parameter behavior
- `https://lucaong.github.io/minisearch/` — MiniSearch constructor, addAll, search, boost option, BM25+ algorithm
- `https://huggingface.co/Xenova/all-MiniLM-L6-v2` — Code example: pipeline creation, batch embedding, output.tolist(), output shape (dims, type, data)
- `https://huggingface.co/docs/transformers.js/en/tutorials/node` — Node.js ESM import, env.cacheDir, singleton pattern, cache location
- `https://philna.sh/blog/2024/09/25/how-to-create-vector-embeddings-in-node-js/` — Single-string embedding, Array.from(response.data) pattern

### Secondary (MEDIUM confidence)
- `https://www.paradedb.com/learn/search-concepts/reciprocal-rank-fusion` — RRF formula details, k=60 rationale
- `https://www.npmjs.com/package/vectra` — Version 0.12.3 confirmed
- npm registry — minisearch 7.2.0, @huggingface/transformers 3.8.1, vectra 0.12.3 confirmed

### Tertiary (LOW confidence)
- Vectra batch insert performance characteristics — inferred from file-backed architecture, not benchmarked
- 2-5 second startup time estimate — from CONTEXT.md user decision, not empirically measured in this environment

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all three libraries verified against npm registry, APIs confirmed from official docs/GitHub
- Architecture: HIGH — RRF formula is standard, API calls are verified, patterns match existing codebase conventions
- Pitfalls: HIGH for API shape issues (confirmed from docs); MEDIUM for performance (inferred, not benchmarked)

**Research date:** 2026-03-22
**Valid until:** 2026-09-22 (libraries are stable; @huggingface/transformers moves faster, re-verify if >6 months)
