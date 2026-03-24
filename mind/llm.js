// llm.js — LLM client with conversation memory, graduated trimming, and !command parser
// Targets Qwen3.5-35B-A3B MoE (natively multimodal) via vLLM; compatible with any OpenAI-compat endpoint

import OpenAI from 'openai'

const VLLM_URL = process.env.VLLM_URL || 'http://localhost:8000/v1'
const MODEL_NAME = process.env.MODEL_NAME || 'Qwen3.5-35B-A3B'
const BASE_TEMPERATURE = parseFloat(process.env.TEMPERATURE || '0.6')
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '384', 10)
const MAX_RETRIES = 3
const RETRY_BASE_MS = 1000
const MAX_HISTORY_MESSAGES = 20  // 10 turns — matched to 8192 token context window (system prompt ~3500 + user ~800 + output 512 = 4812, leaving ~3380 for history)

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
  // Also handle "key: value" (space after colon) — common LLM hallucination
  const namedSpans = []  // track character ranges consumed by named args
  for (const m of argStr.matchAll(/(\w+):\s*("([^"]*?)"|(\S+))/g)) {
    const k = m[1]
    const quoted = m[3]
    const unquoted = m[4]
    args[k] = quoted !== undefined ? quoted : unquoted
    namedSpans.push([m.index, m.index + m[0].length])
  }

  // Chat special case: everything after !chat is the message
  if (name === 'chat' && Object.keys(args).length === 0 && argStr.trim()) {
    let msg = argStr.trim()
    // Strip wrapping quotes — LLM often writes !chat "hello" instead of !chat hello
    if ((msg.startsWith('"') && msg.endsWith('"')) || (msg.startsWith("'") && msg.endsWith("'"))) {
      msg = msg.slice(1, -1)
    }
    // Also strip message: prefix if LLM wrote !chat message: "text" (space after colon)
    if (msg.startsWith('message:')) msg = msg.slice(8).trim()
    if ((msg.startsWith('"') && msg.endsWith('"')) || (msg.startsWith("'") && msg.endsWith("'"))) {
      msg = msg.slice(1, -1)
    }
    args.message = msg
    return { command: name, args }
  }

  // Description-based commands: everything after the command is the description
  const DESC_COMMANDS = new Set(['design', 'plan', 'see'])
  if (DESC_COMMANDS.has(name) && Object.keys(args).length === 0 && argStr.trim()) {
    args.description = argStr.trim()
    return { command: name, args }
  }

  // Positional fallback: extract orphaned words not consumed by named args.
  // Handles mixed forms like "!gather coal_ore count:1" where coal_ore is positional.
  const orphaned = []
  const trimmed = argStr.trim()
  if (trimmed) {
    let pos = 0
    for (const word of trimmed.split(/\s+/)) {
      const idx = argStr.indexOf(word, pos)
      const inSpan = namedSpans.some(([s, e]) => idx >= s && idx < e)
      if (!inSpan && word && !word.includes(':')) {
        orphaned.push(word)
      }
      pos = idx + word.length
    }
  }
  if (!args.item && orphaned.length > 0) {
    args.item = orphaned[0]
    // If second orphan is numeric, treat as count
    if (!args.count && orphaned[1] && !isNaN(orphaned[1])) {
      args.count = parseInt(orphaned[1], 10)
    }
  }

  return { command: name, args }
}

// ── Main Query Function ──

// Query the LLM with systemPrompt + conversationHistory + userMessage.
// Optional image: base64-encoded JPEG string — when provided, the user message becomes
// a multimodal content array [{type:'image_url',...}, {type:'text',...}].
// Qwen3.5 is natively multimodal — every call can optionally include an image.
//
// Returns: { reasoning, command, args, raw }
//   - reasoning: text before/after <think> tags (stripped)
//   - command: the !command name (null if no command found)
//   - args: key:value object from the command
//   - raw: the full original LLM response
//
// On context overflow: trims 25% of history and retries (up to MAX_RETRIES).
// On all retries exhausted: trims 50% then throws.
// opts: { image?: string, maxTokens?: number, isolated?: boolean }
//   image: base64 JPEG for multimodal calls
//   maxTokens: override MAX_TOKENS (e.g. 2048 for !design blueprint generation)
//   isolated: if true, don't read or write conversation history (for design/wiki calls)
export async function queryLLM(systemPrompt, userMessage, imageOrOpts = null) {
  // Backwards compat: if third arg is a string, treat as image (old call signature)
  let image = null, maxTokens = MAX_TOKENS, isolated = false
  if (typeof imageOrOpts === 'string') {
    image = imageOrOpts
  } else if (imageOrOpts && typeof imageOrOpts === 'object') {
    image = imageOrOpts.image || null
    maxTokens = imageOrOpts.maxTokens || MAX_TOKENS
    isolated = imageOrOpts.isolated || false
  }

  let lastError

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Build user content — multimodal if image provided, plain text otherwise
      let userContent
      if (image) {
        userContent = [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image}` } },
          { type: 'text', text: userMessage },
        ]
      } else {
        userContent = userMessage
      }

      const historyToUse = isolated ? [] : conversationHistory
      const messages = [
        { role: 'system', content: systemPrompt },
        ...historyToUse,
        { role: 'user', content: userContent },
      ]

      const response = await client.chat.completions.create({
        model: MODEL_NAME,
        messages,
        temperature: BASE_TEMPERATURE,
        max_tokens: maxTokens,
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

      let parsed = parseCommand(strippedText)

      // Fallback: if no !command found but the text looks like chat directed at another player,
      // convert it to a !chat command. Catches cases like the LLM writing "hey john, let's mine"
      // instead of "!chat message:\"hey john, let's mine\""
      if (!parsed && strippedText) {
        const chatLine = strippedText.split('\n').find(l => l.trim().length > 5)
        if (chatLine && !chatLine.startsWith('!') && /^[A-Za-z@"']/.test(chatLine.trim())) {
          // Heuristic: if the text is short conversational text (not a game state dump), treat as chat
          const trimmed = chatLine.trim()
          if (trimmed.length < 200 && !/^(pos:|health:|inventory:|time:)/i.test(trimmed)) {
            parsed = { command: 'chat', args: { message: trimmed } }
          }
        }
      }

      const command = parsed ? parsed.command : null
      const args = parsed ? parsed.args : {}

      // Push user + assistant to conversation history, then trim to cap.
      // Always store text-only in history — images are per-tick and would bloat context.
      // Isolated calls (design, wiki) don't touch history — they have their own context.
      if (!isolated) {
        conversationHistory.push(
          { role: 'user', content: userMessage },
          { role: 'assistant', content: rawContent },
        )
        trimHistory()
      }

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
