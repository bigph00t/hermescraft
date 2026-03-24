// knowledgeStore.js — Hybrid BM25 + vector knowledge retrieval

import { LocalIndex } from 'vectra'
import MiniSearch from 'minisearch'
import { pipeline, env } from '@huggingface/transformers'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

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
// If a pre-built vector index exists on disk, loads it instantly (~1s).
// Otherwise embeds all chunks (~30-60s on CPU) and persists to disk.
// Run `node mind/knowledgeStore.js` standalone to pre-embed.
export async function initKnowledgeStore(chunks) {
  // Set cache dir so ONNX model files land in .cache/models/, not node_modules
  env.cacheDir = join(__dirname, '..', '.cache', 'models')

  // Build O(1) chunk lookup map
  chunkMap = new Map(chunks.map(c => [c.id, c]))

  // Build MiniSearch BM25 index (always rebuilt — fast, ~50ms)
  keywordIndex = new MiniSearch({
    fields: ['text', 'id'],
    storeFields: ['id'],
    idField: 'id',
  })
  keywordIndex.addAll(chunks)

  // Check for pre-built vector index on disk
  const indexPath = join(__dirname, '..', '.cache', 'knowledge-index')
  vectorIndex = new LocalIndex(indexPath)

  if (existsSync(join(indexPath, 'index.json'))) {
    // Pre-built index found — load embedder + existing index (fast)
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' })
    console.log(`[knowledgeStore] loaded pre-built index from disk (${chunks.length} chunks, BM25 + vector)`)
    return
  }

  // No pre-built index — embed everything and save to disk
  console.log(`[knowledgeStore] no pre-built index found — embedding ${chunks.length} chunks (this takes ~30-60s)...`)
  embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'q8' })
  await vectorIndex.createIndex({ version: 1, deleteIfExists: true })

  const BATCH_SIZE = 32
  const allItems = []
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const texts = batch.map(c => c.text)
    const output = await embedder(texts, { pooling: 'mean', normalize: true })
    const vectors = output.tolist()
    for (let j = 0; j < batch.length; j++) {
      allItems.push({
        vector: vectors[j],
        metadata: { id: batch[j].id },
      })
    }
    if ((i + BATCH_SIZE) % 256 === 0) console.log(`[knowledgeStore] embedded ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length}...`)
  }
  await vectorIndex.batchInsertItems(allItems)

  console.log(`[knowledgeStore] indexed ${chunks.length} chunks (BM25 + vector) — saved to disk`)
}

// ── Retrieval ──

// retrieveKnowledge — hybrid BM25 + vector search with RRF fusion.
// Returns top-K chunks sorted by fused relevance score, highest first.
export async function retrieveKnowledge(query, topK = 8) {
  if (!embedder || !keywordIndex || !vectorIndex) return []

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

// ── Standalone pre-embed script ──
// Run: node mind/knowledgeStore.js
// Embeds all chunks and saves index to disk. Agents then start instantly.

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const { initKnowledge, loadKnowledge } = await import('./knowledge.js')
  initKnowledge({ dataDir: '/tmp', name: 'pre-embed' })
  const chunks = loadKnowledge()
  console.log(`Pre-embedding ${chunks.length} chunks...`)
  const start = Date.now()
  await initKnowledgeStore(chunks)
  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`)
}
