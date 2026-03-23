// knowledgeStore.js — Hybrid BM25 + vector knowledge retrieval

import { LocalIndex } from 'vectra'
import MiniSearch from 'minisearch'
import { pipeline, env } from '@huggingface/transformers'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Module-level singleton state ──

let vectorIndex = null
let keywordIndex = null
let embedder = null
let chunkMap = null  // Map<chunkId, chunk> for O(1) lookup after retrieval

// ── RRF Fusion (internal, not exported) ──

// Reciprocal Rank Fusion — merges ranked ID lists into a single score map.
// k=60 is the empirically validated constant (Cormack et al. 2009).
function rrf(rankedIdLists, k = 60) {
  const scores = new Map()
  for (const list of rankedIdLists) {
    list.forEach((id, rankIdx) => {
      const prev = scores.get(id) || 0
      scores.set(id, prev + 1 / (k + rankIdx + 1))
    })
  }
  return scores
}

// ── Init ──

// initKnowledgeStore — build BM25 and vector indexes from the corpus chunks.
// Called once at startup after loadKnowledge(). Takes ~2-5s on first run (model download ~23MB).
// Model is cached in .cache/models/ after first download.
export async function initKnowledgeStore(chunks) {
  // Set cache dir so ONNX model files land in .cache/models/, not node_modules
  env.cacheDir = join(__dirname, '..', '.cache', 'models')

  // Load embedding model eagerly — agents are knowledge-ready from first tick
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')

  // Build O(1) chunk lookup map
  chunkMap = new Map(chunks.map(c => [c.id, c]))

  // Build MiniSearch BM25 index — both text and id fields indexed
  // id field boosted at search time so exact item lookups (e.g. "iron_pickaxe") rank first
  keywordIndex = new MiniSearch({
    fields: ['text', 'id'],
    storeFields: ['id'],
    idField: 'id',
  })
  keywordIndex.addAll(chunks)

  // Build Vectra vector index — rebuild from scratch every startup (no stale index risk)
  // deleteIfExists: true handles the case where the folder already exists from a prior run
  const indexPath = join(__dirname, '..', '.cache', 'knowledge-index')
  vectorIndex = new LocalIndex(indexPath)
  await vectorIndex.createIndex({ version: 1, deleteIfExists: true })

  // Embed chunks in batches of 32 and bulk-insert into Vectra
  // batchInsertItems defers file writes until endUpdate, avoiding per-item I/O overhead
  const BATCH_SIZE = 32
  const allItems = []
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const texts = batch.map(c => c.text)
    const output = await embedder(texts, { pooling: 'mean', normalize: true })
    const vectors = output.tolist()  // number[][] — one 384-dim vector per chunk
    for (let j = 0; j < batch.length; j++) {
      allItems.push({
        vector: vectors[j],
        metadata: { id: batch[j].id },
      })
    }
  }
  await vectorIndex.batchInsertItems(allItems)

  console.log(`[knowledgeStore] indexed ${chunks.length} chunks (BM25 + vector)`)
}

// ── Retrieval ──

// retrieveKnowledge — hybrid BM25 + vector search with RRF fusion.
// Returns top-K chunks sorted by fused relevance score, highest first.
export async function retrieveKnowledge(query, topK = 8) {
  // 1. BM25 keyword search — id field boosted 3x for exact item name lookups
  const bm25Results = keywordIndex.search(query, {
    boost: { id: 3 },
    fuzzy: 0.2,
    prefix: true,
  })
  const bm25Ids = bm25Results.slice(0, 50).map(r => r.id)

  // 2. Vector search — embed query as single string, get nearest neighbors
  const qOut = await embedder(query, { pooling: 'mean', normalize: true })
  const qVec = Array.from(qOut.data)  // Float32Array -> number[384]
  const vecResults = await vectorIndex.queryItems(qVec, '', 50)
  const vecIds = vecResults.map(r => r.item.metadata.id)

  // 3. RRF fusion — merge ranked lists by reciprocal rank (k=60)
  const rrfScores = rrf([bm25Ids, vecIds])

  // 4. Sort by score descending, take top-K, hydrate from chunkMap, filter undefined
  const sorted = [...rrfScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
  return sorted
    .map(([id, score]) => ({ chunk: chunkMap.get(id), score }))
    .filter(r => r.chunk !== undefined)
}
