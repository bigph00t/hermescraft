// llm.test.js — Tests for MEM-01, MEM-02 fixes in llm.js
// Run with: node --test agent/tests/llm.test.js

import { describe, it, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

// We need to test trimHistoryGraduated (private) and the new exports.
// Import the module and use setConversationHistory / getConversationHistory to set up state,
// then trigger trim via direct export.
import {
  clearConversation,
  getConversationHistory,
  setConversationHistory,
  isToolCallingEnabled,
} from '../llm.js'

// We also need to test trimHistoryGraduated directly.
// Since it's private, we'll import it if exported, else test via behavior.
// The plan requires it to be tested. We'll expose it via a testable path.
// For now we'll check behaviors through getConversationHistory after calling the function.

// Helper to build a simple message sequence
function makeMsg(role, content = 'x') {
  return { role, content }
}

describe('MEM-01: trimHistoryGraduated respects round boundaries', () => {
  beforeEach(() => {
    clearConversation()
  })

  it('removes complete rounds from front — never leaves tool at index 0', async () => {
    // Import trimHistoryGraduated directly — it must be exported
    const { trimHistoryGraduated } = await import('../llm.js')
    assert.ok(typeof trimHistoryGraduated === 'function', 'trimHistoryGraduated must be exported')

    // [user, assistant, tool, user, assistant, user, assistant, tool]
    setConversationHistory([
      makeMsg('user', 'u1'),
      makeMsg('assistant', 'a1'),
      makeMsg('tool', 't1'),
      makeMsg('user', 'u2'),
      makeMsg('assistant', 'a2'),
      makeMsg('user', 'u3'),
      makeMsg('assistant', 'a3'),
      makeMsg('tool', 't3'),
    ])

    trimHistoryGraduated(0.25)

    const history = getConversationHistory()
    // After trim with fraction=0.25 on 8 messages (targetRemove=2):
    // Should remove first round (user+assistant+tool = 3 messages) since round boundary
    // First message must NOT be 'tool'
    assert.ok(history.length > 0, 'history should not be empty after partial trim')
    assert.notEqual(history[0].role, 'tool', 'first message must not be role=tool after trim')
    assert.notEqual(history[0].role, 'assistant', 'first message must not be role=assistant after trim')
  })

  it('removes orphaned tool message at front (already broken state)', async () => {
    const { trimHistoryGraduated } = await import('../llm.js')

    // [tool, user, assistant] — orphaned tool at front
    setConversationHistory([
      makeMsg('tool', 'orphan'),
      makeMsg('user', 'u1'),
      makeMsg('assistant', 'a1'),
    ])

    trimHistoryGraduated(0.25)

    const history = getConversationHistory()
    // Orphaned tool message must be removed
    assert.notEqual(history[0]?.role, 'tool', 'orphaned tool message must be removed from front')
  })

  it('is a no-op on empty history', async () => {
    const { trimHistoryGraduated } = await import('../llm.js')

    clearConversation()
    trimHistoryGraduated(0.25)

    const history = getConversationHistory()
    assert.equal(history.length, 0, 'empty history remains empty after trim')
  })

  it('removes at least one complete round worth of messages', async () => {
    const { trimHistoryGraduated } = await import('../llm.js')

    // Start with a clean 2-message round
    setConversationHistory([
      makeMsg('user', 'u1'),
      makeMsg('assistant', 'a1'),
      makeMsg('user', 'u2'),
      makeMsg('assistant', 'a2'),
    ])

    const before = getConversationHistory().length
    trimHistoryGraduated(0.25)
    const after = getConversationHistory().length

    assert.ok(after < before, 'trim must remove at least some messages')
    assert.ok(before - after >= 2, 'trim must remove at least one round (2 messages)')
  })

  it('after trim, first message is always role=user', async () => {
    const { trimHistoryGraduated } = await import('../llm.js')

    setConversationHistory([
      makeMsg('user', 'u1'),
      makeMsg('assistant', 'a1'),
      makeMsg('tool', 't1'),
      makeMsg('user', 'u2'),
      makeMsg('assistant', 'a2'),
    ])

    trimHistoryGraduated(0.5)

    const history = getConversationHistory()
    if (history.length > 0) {
      assert.equal(history[0].role, 'user', 'first message after trim must be user')
    }
  })
})

describe('MEM-02: Corrupt tool call handler uses graduated trim, not full wipe', () => {
  it('llm.js does NOT contain conversationHistory.length = 0 outside clearConversation and setConversationHistory', async () => {
    const { readFileSync } = await import('node:fs')
    const { join, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')

    const __dirname = dirname(fileURLToPath(import.meta.url))
    const llmPath = join(__dirname, '..', 'llm.js')
    const src = readFileSync(llmPath, 'utf-8')

    // Split into lines and find all occurrences of conversationHistory.length = 0
    const lines = src.split('\n')
    const wipeLines = lines
      .map((line, i) => ({ line: line.trim(), num: i + 1 }))
      .filter(({ line }) => line.includes('conversationHistory.length = 0'))

    // Each occurrence must be inside clearConversation or setConversationHistory
    // We'll check by context — look at surrounding lines
    for (const { num, line } of wipeLines) {
      // Get context: 10 lines before
      const contextStart = Math.max(0, num - 10)
      const context = lines.slice(contextStart, num).join('\n')
      const isInClearConversation = context.includes('function clearConversation') ||
        context.includes('function setConversationHistory')
      assert.ok(
        isInClearConversation,
        `Line ${num}: "${line}" — conversationHistory.length = 0 must only appear in clearConversation or setConversationHistory`
      )
    }
  })

  it('corrupt tool call handler contains trimHistoryGraduated(0.5)', async () => {
    const { readFileSync } = await import('node:fs')
    const { join, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')

    const __dirname = dirname(fileURLToPath(import.meta.url))
    const llmPath = join(__dirname, '..', 'llm.js')
    const src = readFileSync(llmPath, 'utf-8')

    assert.ok(
      src.includes('trimHistoryGraduated(0.5)'),
      'corrupt tool call handler must call trimHistoryGraduated(0.5)'
    )
  })
})

describe('New exports: getConversationHistory and setConversationHistory', () => {
  it('getConversationHistory returns the current history array', () => {
    clearConversation()
    const h = getConversationHistory()
    assert.ok(Array.isArray(h), 'getConversationHistory must return an array')
    assert.equal(h.length, 0, 'empty after clearConversation')
  })

  it('setConversationHistory replaces history with provided array', () => {
    const messages = [
      makeMsg('user', 'hello'),
      makeMsg('assistant', 'world'),
    ]
    setConversationHistory(messages)
    const h = getConversationHistory()
    assert.equal(h.length, 2, 'history length should match set messages')
    assert.equal(h[0].role, 'user')
    assert.equal(h[1].role, 'assistant')
  })

  it('setConversationHistory handles non-array gracefully', () => {
    setConversationHistory(null)
    const h = getConversationHistory()
    assert.equal(h.length, 0, 'null input should result in empty history')
  })
})
