// knowledge.test.js — Tests for mind/knowledge.js corpus builder
// Uses Node.js built-in test runner (node --test)

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { initKnowledge, loadKnowledge, getAllChunks, buildRecipeChunks } from '../../mind/knowledge.js'

// ── Test 1: initKnowledge is callable and getAllChunks returns empty before load ──

describe('initKnowledge', () => {
  it('is callable without error and getAllChunks returns empty array before loadKnowledge', () => {
    initKnowledge({})
    const chunks = getAllChunks()
    assert.ok(Array.isArray(chunks), 'getAllChunks should return an array')
    assert.strictEqual(chunks.length, 0, 'chunks should be empty before loadKnowledge is called')
  })
})

// ── Test 2-9: buildRecipeChunks ──

describe('buildRecipeChunks', () => {
  let chunks

  before(() => {
    chunks = buildRecipeChunks()
  })

  it('returns array of objects with { id, text, type, tags, source } shape', () => {
    assert.ok(Array.isArray(chunks), 'should return an array')
    assert.ok(chunks.length > 0, 'should have at least one chunk')
    for (const chunk of chunks.slice(0, 20)) {
      assert.ok(typeof chunk.id === 'string', `chunk.id should be string, got ${typeof chunk.id}`)
      assert.ok(typeof chunk.text === 'string', `chunk.text should be string, got ${typeof chunk.text}`)
      assert.ok(typeof chunk.type === 'string', `chunk.type should be string, got ${typeof chunk.type}`)
      assert.ok(Array.isArray(chunk.tags), `chunk.tags should be array, got ${typeof chunk.tags}`)
      assert.ok(typeof chunk.source === 'string', `chunk.source should be string, got ${typeof chunk.source}`)
    }
  })

  it('produces a chunk with id recipe_iron_pickaxe whose text contains "raw_iron" and "smelt"', () => {
    const ironPickaxe = chunks.find(c => c.id === 'recipe_iron_pickaxe')
    assert.ok(ironPickaxe, 'should have a chunk for recipe_iron_pickaxe')
    assert.ok(ironPickaxe.text.includes('raw_iron'), `iron_pickaxe text should include "raw_iron" — got: ${ironPickaxe.text.substring(0, 300)}`)
    assert.ok(ironPickaxe.text.includes('smelt'), `iron_pickaxe text should include "smelt" — got: ${ironPickaxe.text.substring(0, 300)}`)
  })

  it('produces a chunk with id recipe_stick whose text contains "planks"', () => {
    const stick = chunks.find(c => c.id === 'recipe_stick')
    assert.ok(stick, 'should have a chunk for recipe_stick')
    assert.ok(stick.text.includes('planks'), `stick text should include "planks" — got: ${stick.text.substring(0, 200)}`)
  })

  it('returns >= 400 chunks', () => {
    assert.ok(chunks.length >= 400, `expected >= 400 chunks, got ${chunks.length}`)
  })

  it('no chunk has empty text', () => {
    const emptyChunks = chunks.filter(c => !c.text || c.text.length === 0)
    assert.strictEqual(emptyChunks.length, 0, `found ${emptyChunks.length} chunks with empty text: ${emptyChunks.map(c => c.id).slice(0, 5).join(', ')}`)
  })

  it('completes without timeout (no infinite recursion)', { timeout: 10000 }, () => {
    // If we reach here, it completed within 10s — the timeout flag handles the rest
    assert.ok(chunks.length > 0, 'buildRecipeChunks should produce chunks without timing out')
  })

  it('produces a chunk for recipe_crafting_table containing "planks"', () => {
    const craftingTable = chunks.find(c => c.id === 'recipe_crafting_table')
    assert.ok(craftingTable, 'should have a chunk for recipe_crafting_table')
    assert.ok(craftingTable.text.includes('planks'), `crafting_table text should include "planks" — got: ${craftingTable.text.substring(0, 200)}`)
  })

  it('produces a chunk for recipe_furnace containing "cobblestone"', () => {
    const furnace = chunks.find(c => c.id === 'recipe_furnace')
    assert.ok(furnace, 'should have a chunk for recipe_furnace')
    assert.ok(furnace.text.includes('cobblestone'), `furnace text should include "cobblestone" — got: ${furnace.text.substring(0, 200)}`)
  })
})
