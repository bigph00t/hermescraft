// llm.js — Hermes LLM client with native function calling + conversation memory
// Uses vLLM with --enable-auto-tool-choice --tool-call-parser hermes
// Falls back to text parsing if tool calling is unavailable

import OpenAI from 'openai';
import { GAME_TOOLS } from './tools.js';

const VLLM_URL = process.env.VLLM_URL || 'http://localhost:8000/v1';
const MODEL_NAME = process.env.MODEL_NAME || 'Doradus/Hermes-4.3-36B-FP8';
const BASE_TEMPERATURE = parseFloat(process.env.TEMPERATURE || '0.6');
// No artificial token cap — let the model generate naturally
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;
const MAX_HISTORY_MESSAGES = parseInt(process.env.MAX_HISTORY || '90', 10);  // ~30 rounds; auto-trims on context overflow

// Detect OAuth token (sk-ant-oat01-*) vs API key
const rawKey = process.env.VLLM_API_KEY || process.env.ANTHROPIC_API_KEY || 'not-needed';
const isOAuth = rawKey.startsWith('sk-ant-oat');
const client = new OpenAI({
  baseURL: VLLM_URL,
  apiKey: rawKey,
  timeout: 120000,  // 120s — first call has no cache, 1024 tokens @ 15tok/s = 69s
  defaultHeaders: isOAuth ? {
    'Authorization': `Bearer ${rawKey}`,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'oauth-2025-04-20',
  } : {},
});

// ── Conversation Memory (L1 — Session Memory) ──

const conversationHistory = [];
let useToolCalling = true;  // Try tool calling first, disable on failure
let toolCallingFailures = 0;
let _textFallbackCount = 0;  // Track consecutive text fallbacks to break notepad loops
const MAX_TOOL_FAILURES = 3;  // Only permanently disable after 3 consecutive failures

export function clearConversation() {
  conversationHistory.length = 0
}

export function getConversationHistory() {
  return conversationHistory
}

export function setConversationHistory(history) {
  conversationHistory.length = 0
  if (Array.isArray(history)) {
    for (const msg of history) {
      conversationHistory.push(msg)
    }
  }
}

function trimHistory() {
  // Remove oldest conversation rounds to stay under limit.
  // A round is: user + assistant + optional tool_result (2 or 3 messages).
  while (conversationHistory.length > MAX_HISTORY_MESSAGES) {
    if (conversationHistory.length >= 3 &&
        conversationHistory[0].role === 'user' &&
        conversationHistory[1].role === 'assistant' &&
        conversationHistory[2].role === 'tool') {
      conversationHistory.splice(0, 3);  // Remove full round with tool result
    } else if (conversationHistory.length >= 2) {
      conversationHistory.splice(0, 2);  // Remove user+assistant pair
    } else {
      conversationHistory.splice(0, 1);
    }
  }
}

export function trimHistoryGraduated(fraction = 0.25) {
  // Remove the oldest fraction of messages on context overflow — graduated, not a full wipe.
  // Round-boundary-aware: removes complete rounds (user + assistant + optional tool) from
  // the front, never leaving an orphaned 'tool' message at index 0.
  if (conversationHistory.length === 0) return
  const targetRemove = Math.max(2, Math.ceil(conversationHistory.length * fraction))
  let removed = 0

  // Remove complete rounds from the front until we've removed enough
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

/**
 * Append a tool result to conversation history after action execution.
 * This completes the tool call protocol: user → assistant(tool_calls) → tool(result).
 */
export function completeToolCall(resultText) {
  if (conversationHistory.length < 1) return;
  const lastMsg = conversationHistory[conversationHistory.length - 1];
  if (lastMsg.role === 'assistant' && lastMsg.tool_calls && lastMsg.tool_calls.length > 0) {
    conversationHistory.push({
      role: 'tool',
      tool_call_id: lastMsg.tool_calls[0].id,
      content: typeof resultText === 'string' ? resultText : JSON.stringify(resultText),
    });
    trimHistory();
  }
}

// ── Adaptive Temperature ──
// Hermes recommended sampling: temp=0.6, top_p=0.95

export function getTemperature(phase, state) {
  if (!state || !phase) return BASE_TEMPERATURE;
  if ((state.health || 20) <= 6) return 0.3;
  if (state.dimension?.includes('nether')) return 0.5;
  if (state.dimension?.includes('end')) return 0.4;
  if (phase.id <= 2) return 0.6;
  return 0.6;
}

// ── Context overflow detection ──

function isContextOverflowError(err) {
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('context length') ||
    msg.includes('input tokens') ||
    msg.includes('maximum input length') ||
    msg.includes('too many tokens');
}

function isToolCallingUnsupported(err) {
  const msg = (err?.message || '').toLowerCase();
  return (err?.status === 400 || err?.status === 422) &&
    (msg.includes('tool') || msg.includes('function_call') || msg.includes('unrecognized'));
}

// ── Main Query Function ──

export async function queryLLM(systemPrompt, userMessage, opts = {}) {
  const temperature = opts.temperature ?? BASE_TEMPERATURE;
  const toolsOverride = opts.tools ?? null;  // Optional: restrict available tools (e.g. chat-only during Baritone)
  // Always force tool calls — thinking happens via 'reason' param, 'chat' tool, or 'notepad' tool
  const toolChoice = 'required';
  // no max_tokens cap
  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userMessage },
      ];

      let response;

      if (useToolCalling) {
        try {
          response = await client.chat.completions.create({
            model: MODEL_NAME,
            messages,
            tools: toolsOverride || GAME_TOOLS,
            tool_choice: toolChoice,
            temperature,
            //            // // top_p: 0.95, // Anthropic API rejects temperature + top_p together // Anthropic API rejects both temperature + top_p// Anthropic API rejects both temperature + top_p
          });
        } catch (toolErr) {
          if (isContextOverflowError(toolErr)) {
            // Context overflow — trim oldest 25% and retry (graduated, not a full wipe)
            if (conversationHistory.length > 0) {
              trimHistoryGraduated(0.25);
              throw toolErr; // Will retry with less history
            }
            // History already empty — pass through to outer retry
            throw toolErr;
          }
          if (isToolCallingUnsupported(toolErr)) {
            toolCallingFailures++;
            if (toolCallingFailures >= MAX_TOOL_FAILURES) {
              useToolCalling = false;  // Only permanently disable after repeated failures
            }
            // Fall back to text for THIS request
            response = await client.chat.completions.create({
              model: MODEL_NAME,
              messages,
              temperature,
            });
          } else {
            throw toolErr;
          }
        }
      } else {
        response = await client.chat.completions.create({
          model: MODEL_NAME,
          messages,
          temperature,
        });
      }

      const msg = response.choices?.[0]?.message;
      if (!msg) throw new Error('Empty response from LLM');

      let result;

      // Try to extract from tool_calls first
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        const toolCall = msg.tool_calls[0];
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (parseErr) {
          // Log but don't crash — empty args will be validated downstream
        }

        // Extract <think>...</think> content as reasoning
        const rawContent = msg.content || '';
        const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/);
        const reasoning = thinkMatch
          ? thinkMatch[1].trim()
          : rawContent.replace(/<think>|<\/think>/g, '').trim();

        toolCallingFailures = 0;  // Reset on successful tool call
        _textFallbackCount = 0;  // Reset fallback counter
        result = {
          reasoning,
          action: {
            type: toolCall.function.name,
            ...args,
          },
          raw: rawContent || JSON.stringify(msg.tool_calls),
          mode: 'tool_call',
        };

        // Store in conversation history — only if tool call args are valid JSON
        // (prevents corrupt tool calls from poisoning future requests)
        const cleanToolCalls = msg.tool_calls.filter(tc => {
          try { JSON.parse(tc.function.arguments); return true; } catch { return false; }
        });
        conversationHistory.push(
          { role: 'user', content: userMessage },
          {
            role: 'assistant',
            content: msg.content || null,
            tool_calls: cleanToolCalls.length > 0 ? cleanToolCalls : undefined,
          },
        );
      } else {
        // No structured tool call — try parsing from text (Hermes XML, JSON, etc)
        const text = msg.content || '';
        // Strip <think>...</think> blocks before parsing — MiniMax M2.7 wraps
        // all output in these, which can hide tool calls that come after them
        const textForParsing = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || text;
        result = parseResponseFallback(textForParsing);

        // Extract <think> content for reasoning
        const thinkFallback = text.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkFallback && (!result.reasoning || result.reasoning.length < thinkFallback[1].length)) {
          result.reasoning = thinkFallback[1].trim();
        }

        if (result.action) {
          result.mode = 'text_parsed';  // Got action from text parsing
          _textFallbackCount = 0;  // Reset fallback counter
        } else {
          result.mode = 'text_fallback';
          _textFallbackCount++
          // Smart fallback — if we've fallen back too many times, try mining wood
          // which is always productive and uses Baritone's search
          if (_textFallbackCount >= 3) {
            result.action = { type: 'mine', blockName: 'oak_log', reason: 'fallback: need wood' }
            _textFallbackCount = 0  // reset after forced action
          } else {
            result.action = { type: 'notepad', action: 'read', reason: 'thinking' }
          }
          result.reasoning = result.reasoning || text.replace(/<think>|<\/think>/g, '').trim();
        }

        conversationHistory.push(
          { role: 'user', content: userMessage },
          { role: 'assistant', content: text },
        );
      }

      trimHistory();
      return result;

    } catch (err) {
      lastError = err;

      // On context overflow, trim another 25% and retry immediately.
      // Each retry removes another quarter until history is empty, then we give up.
      if (isContextOverflowError(err)) {
        if (conversationHistory.length > 0) {
          trimHistoryGraduated(0.25);
          continue; // Retry immediately without delay
        }
        // No history left — nothing more we can trim, fail
        break;
      }

      // Corrupt tool call in history — graduated trim (not full wipe) and retry
      const errMsg = (err?.message || '').toLowerCase()
      if (err?.status === 400 && (errMsg.includes('invalid') || errMsg.includes('tool_call'))) {
        if (conversationHistory.length > 0) {
          trimHistoryGraduated(0.5)
          continue // Retry with trimmed history
        }
      }

      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  // Last resort after all retries exhausted: trim half the history, then throw.
  // A full wipe would lose all execution context — trim instead so the next call
  // starts with recent history intact rather than a blank slate.
  if (conversationHistory.length > 0) {
    trimHistoryGraduated(0.5);
  }
  throw new Error(`LLM failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

// ── Fallback Text Parser (original regex approach) ──

function parseResponseFallback(text) {
  let reasoning = '';
  let action = null;

  // 1. Try Hermes native <tool_call> XML format first
  const toolCallMatch = text.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/);
  if (toolCallMatch) {
    // Extract reasoning from text before the tool_call tag
    const beforeTag = text.slice(0, text.indexOf('<tool_call>')).trim();
    if (beforeTag) reasoning = beforeTag;

    try {
      // Hermes format: {"name": "mine", "arguments": {"blockName": "oak_log"}}
      // Fix common malformation: {"name": "mine"}, "arguments": {...}
      let jsonStr = toolCallMatch[1].trim();
      jsonStr = jsonStr.replace(/\}\s*,\s*"arguments"/, ', "arguments"');
      const parsed = JSON.parse(jsonStr);
      if (parsed.name) {
        action = { type: parsed.name, ...(parsed.arguments || {}) };
      }
    } catch {
      // Try extracting name and arguments separately
      const nameMatch = toolCallMatch[1].match(/"name"\s*:\s*"([^"]+)"/);
      const argsMatch = toolCallMatch[1].match(/"arguments"\s*:\s*(\{[^}]*\})/);
      if (nameMatch) {
        let args = {};
        if (argsMatch) {
          try { args = JSON.parse(argsMatch[1]); } catch {}
        }
        action = { type: nameMatch[1], ...args };
      }
    }
    if (action) return { reasoning, action, raw: text };
  }

  // 1b. Try <FunctionCall> XML format (MiniMax sometimes uses this)
  const funcCallMatch = text.match(/<FunctionCall>\s*([\s\S]*?)\s*<\/FunctionCall>/i)
  if (funcCallMatch) {
    const beforeTag = text.slice(0, text.indexOf('<FunctionCall')).trim()
    if (beforeTag) reasoning = beforeTag

    try {
      const nameMatch = funcCallMatch[1].match(/name\s*=\s*"([^"]+)"/)
      const paramsMatch = funcCallMatch[1].match(/parameters\s*=\s*"([\s\S]*?)"\s*$/m)
      if (nameMatch) {
        let args = {}
        if (paramsMatch) {
          try {
            // Parameters are JSON inside quotes, may have escaped newlines
            const cleanParams = paramsMatch[1].replace(/\n/g, '').trim()
            args = JSON.parse(cleanParams)
          } catch {
            // Try extracting JSON from the parameters block
            const jsonInParams = funcCallMatch[1].match(/\{[\s\S]*\}/)
            if (jsonInParams) {
              try { args = JSON.parse(jsonInParams[0]) } catch {}
            }
          }
        }
        action = { type: nameMatch[1], ...args }
      }
    } catch {}
    if (action) return { reasoning, action, raw: text }
  }

  // 2. Try REASONING: / ACTION: format
  const reasoningMatch = text.match(/REASONING:\s*(.+?)(?=\nACTION:|$)/s);
  if (reasoningMatch) {
    reasoning = reasoningMatch[1].trim();
  }

  const actionMatch = text.match(/ACTION:\s*(\{[\s\S]*?\})/);
  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1]);
    } catch {
      const actionSection = text.slice(text.indexOf('ACTION:'));
      const jsonMatch = actionSection.match(/\{[^{}]*\}/);
      if (jsonMatch) {
        try {
          action = JSON.parse(jsonMatch[0]);
        } catch {}
      }
    }
  }

  // 3. Last resort: find any JSON with a "name" or "type" field
  if (!action) {
    const jsonMatch = text.match(/\{[^{}]*"(?:name|type)"\s*:\s*"[^"]+?"[^{}]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.name || parsed.type) {
          action = { type: parsed.name || parsed.type, ...(parsed.arguments || {}) };
          // Remove type/name duplication
          delete action.name;
        }
      } catch {}
    }
  }

  // Fallback reasoning: use everything before ACTION or tool_call
  if (!reasoning && !reasoningMatch) {
    const beforeAction = text.split(/ACTION:|<tool_call>/)[0];
    if (beforeAction) reasoning = beforeAction.trim();
  }

  return { reasoning, action, raw: text };
}

// ── Utility ──

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isToolCallingEnabled() {
  return useToolCalling;
}
