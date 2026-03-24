// llm.js — LLM client with conversation memory, graduated trimming, and !command parser
// Targets Qwen3.5-35B-A3B MoE via llama-server; compatible with any OpenAI-compat endpoint

import OpenAI from 'openai'

const VLLM_URL = process.env.VLLM_URL || 'http://localhost:8000/v1'
const MODEL_NAME = process.env.MODEL_NAME || 'Qwen3.5-35B-A3B'
const BASE_TEMPERATURE = parseFloat(process.env.TEMPERATURE || '0.6')
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '128', 10)
const MAX_RETRIES = 3
const RETRY_BASE_MS = 1000
const MAX_HISTORY_MESSAGES = 80  // 40 turns — MIND-03 requirement

// NO OAuth detection — v2 uses direct vLLM, not Anthropic SDK
const client = new OpenAI({
  baseURL: VLLM_URL,
  apiKey: process.env.VLLM_API_KEY || 'not-needed',
  timeout: 120000,  // 120s — first call has no cache; large models can be slow on cold start
})

// ── Conversation Memory (L1 — Session Memory) ──

const conversationHistory = []

export function clearConversation() {
  conversationHistory.length = 0
}

export function getHistory() {
  return conversationHistory
}

// Remove oldest complete rounds (user+assistant) from front when over cap.
// A round is user + assistant (2 messages) — no tool messages in text mode.
function trimHistory() {
  while (conversationHistory.length > MAX_HISTORY_MESSAGES) {
    if (conversationHistory.length >= 3 &&
        conversationHistory[0].role === 'user' &&
        conversationHistory[1].role === 'assistant' &&
        conversationHistory[2].role === 'tool') {
      conversationHistory.splice(0, 3)  // Remove full round with tool result
    } else if (conversationHistory.length >= 2) {
      conversationHistory.splice(0, 2)  // Remove user+assistant pair
    } else {
      conversationHistory.splice(0, 1)
    }
  }
}

// Remove the oldest `fraction` of messages on context overflow — graduated, not a full wipe.
// Round-boundary-aware: removes complete rounds from the front, never leaving an orphaned
// 'tool' message at index 0. Ported verbatim from agent/llm.js lines 72-105.
export function trimHistoryGraduated(fraction = 0.25) {
  if (conversationHistory.length === 0) return
  const targetRemove = Math.max(2, Math.ceil(conversationHistory.length * fraction))
  let removed = 0

  while (removed < targetRemove && conversationHistory.length > 0) {
    // Skip any orphaned tool messages at the front (cleanup from prior bugs)
    if (conversationHistory[0].role === 'tool') {
      conversationHistory.splice(0, 1)
      removed++
      continue
    }
    // A round starts with 'user', followed by 'assistant', optionally followed by 'tool'
    if (conversationHistory[0].role === 'user') {
      let roundSize = 1
      if (conversationHistory.length > 1 && conversationHistory[1].role === 'assistant') {
        roundSize = 2
        if (conversationHistory.length > 2 && conversationHistory[2].role === 'tool') {
          roundSize = 3
        }
      }
      conversationHistory.splice(0, roundSize)
      removed += roundSize
    } else {
      // Unexpected role at front (assistant without user) — remove it
      conversationHistory.splice(0, 1)
      removed++
    }
  }
}

// ── Context Overflow Detection ──

function isContextOverflowError(err) {
  const msg = (err?.message || '').toLowerCase()
  return msg.includes('context length') ||
    msg.includes('input tokens') ||
    msg.includes('maximum input length') ||
    msg.includes('too many tokens')
}

// ── !command Parser ──
// Extracts the first !command from LLM response text.
// Supports named args (item:oak_log count:10), quoted args (message:"hello there"),
// and positional fallback (!gather oak_log 10 → { item, count }).
// NOT exported — internal helper only.

function parseCommand(text) {
  const match = text.match(/!(\w+)(?:\s+(.*))?/)
  if (!match) return null

  const name = match[1]
  const argStr = match[2] || ''
  const args = {}

  // Named args: key:value or key:"quoted value"
  for (const [, k, , quoted, unquoted] of argStr.matchAll(/(\w+):("([^"]*?)"|(\S+))/g)) {
    args[k] = quoted !== undefined ? quoted : unquoted
  }

  // Positional fallback: !gather oak_log 10 → { item: 'oak_log', count: 10 }
  if (Object.keys(args).length === 0) {
    const parts = argStr.trim().split(/\s+/).filter(Boolean)
    if (parts[0]) args.item = parts[0]
    if (parts[1] && !isNaN(parts[1])) args.count = parseInt(parts[1], 10)
  }

  return { command: name, args }
}

// ── Main Query Function ──

// Query the LLM with systemPrompt + conversationHistory + userMessage.
// Returns: { reasoning, command, args, raw }
//   - reasoning: text before/after <think> tags (stripped)
//   - command: the !command name (null if no command found)
//   - args: key:value object from the command
//   - raw: the full original LLM response
//
// On context overflow: trims 25% of history and retries (up to MAX_RETRIES).
// On all retries exhausted: trims 50% then throws.
export async function queryLLM(systemPrompt, userMessage) {
  let lastError

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ]

      const response = await client.chat.completions.create({
        model: MODEL_NAME,
        messages,
        temperature: BASE_TEMPERATURE,
        max_tokens: MAX_TOKENS,
        // No tool_choice — TEXT MODE ONLY per research: !command text is
        // more reliable than tool_choice:'required'
      })

      const msg = response.choices?.[0]?.message
      if (!msg) throw new Error('Empty response from LLM')

      const rawContent = msg.content || ''

      // Strip <think>...</think> blocks before command parsing.
      // MiniMax M2.7 wraps reasoning in think tags; the actual !command comes after </think>.
      // Pitfall 2: don't parse commands from inside think blocks (thinking-aloud, not final action).
      const strippedText = rawContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

      // Extract reasoning from think tag content (or fallback to stripped text)
      const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/)
      const reasoning = thinkMatch ? thinkMatch[1].trim() : strippedText

      const parsed = parseCommand(strippedText)
      const command = parsed ? parsed.command : null
      const args = parsed ? parsed.args : {}

      // Push user + assistant to conversation history, then trim to cap
      conversationHistory.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: rawContent },
      )
      trimHistory()

      return { reasoning, command, args, raw: rawContent }

    } catch (err) {
      lastError = err

      // Context overflow — trim oldest 25% and retry immediately
      if (isContextOverflowError(err)) {
        if (conversationHistory.length > 0) {
          trimHistoryGraduated(0.25)
          continue
        }
        break  // History empty — nothing more to trim
      }

      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_BASE_MS * Math.pow(2, attempt))
      }
    }
  }

  // Last resort: trim half the history so next call starts with recent context, then throw
  if (conversationHistory.length > 0) {
    trimHistoryGraduated(0.5)
  }
  throw new Error(`LLM failed after ${MAX_RETRIES} attempts: ${lastError?.message}`)
}

// ── Utility ──

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
