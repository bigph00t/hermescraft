// llm.js — Hermes LLM client with native function calling + conversation memory
// Uses vLLM with --enable-auto-tool-choice --tool-call-parser hermes
// Falls back to text parsing if tool calling is unavailable

import OpenAI from 'openai';
import { GAME_TOOLS } from './tools.js';

const VLLM_URL = process.env.VLLM_URL || 'http://localhost:8000/v1';
const MODEL_NAME = process.env.MODEL_NAME || 'Doradus/Hermes-4.3-36B-FP8';
const BASE_TEMPERATURE = parseFloat(process.env.TEMPERATURE || '0.6');
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '384', 10);
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;
const MAX_HISTORY_MESSAGES = 15;  // 5 rounds of context (user + assistant + tool_result)

const client = new OpenAI({
  baseURL: VLLM_URL,
  apiKey: process.env.VLLM_API_KEY || 'not-needed',
  timeout: 120000,  // 120s — first call has no cache, 1024 tokens @ 15tok/s = 69s
});

// ── Conversation Memory (L1 — Session Memory) ──

const conversationHistory = [];
let useToolCalling = true;  // Try tool calling first, disable on failure

export function clearConversation() {
  conversationHistory.length = 0;
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
  // Adaptive tool_choice: 'required' normally, 'auto' when stuck/failed so model can think
  const toolChoice = opts.needsThinking ? 'auto' : 'required';
  const maxTokens = opts.needsThinking ? 512 : MAX_TOKENS;  // More room for thinking + tool call
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
            tools: GAME_TOOLS,
            tool_choice: toolChoice,
            temperature,
            max_tokens: maxTokens,
            top_p: 0.95,
          });
        } catch (toolErr) {
          if (isContextOverflowError(toolErr)) {
            // Context overflow — trim history aggressively and retry
            if (conversationHistory.length > 0) {
              const trimCount = Math.max(2, Math.ceil(conversationHistory.length / 2));
              conversationHistory.splice(0, trimCount);
              throw toolErr; // Will retry with less history
            }
            // History already empty — pass through to outer retry
            throw toolErr;
          }
          if (isToolCallingUnsupported(toolErr)) {
            // Tool calling not supported — fall back permanently
            useToolCalling = false;
            response = await client.chat.completions.create({
              model: MODEL_NAME,
              messages,
              temperature,
              max_tokens: MAX_TOKENS,
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
          max_tokens: MAX_TOKENS,
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

        result = {
          reasoning,
          action: {
            type: toolCall.function.name,
            ...args,
          },
          raw: rawContent || JSON.stringify(msg.tool_calls),
          mode: 'tool_call',
        };

        // Store in conversation history (tool result added later via completeToolCall)
        conversationHistory.push(
          { role: 'user', content: userMessage },
          {
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.tool_calls,
          },
        );
      } else {
        // No structured tool call — try parsing from text (Hermes XML, JSON, etc)
        const text = msg.content || '';
        result = parseResponseFallback(text);

        // Extract <think> content for reasoning
        const thinkFallback = text.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkFallback && (!result.reasoning || result.reasoning.length < thinkFallback[1].length)) {
          result.reasoning = thinkFallback[1].trim();
        }

        if (result.action) {
          result.mode = 'text_parsed';  // Got action from text parsing
        } else {
          result.mode = 'text_fallback';
          result.action = { type: 'wait' };  // Default to wait if nothing parseable
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

      // On context overflow, aggressively trim and retry immediately
      if (isContextOverflowError(err)) {
        if (conversationHistory.length > 0) {
          conversationHistory.splice(0, Math.max(2, conversationHistory.length));
          continue; // Retry immediately without delay
        }
        // No history left — nothing more we can trim, fail
        break;
      }

      if (attempt < MAX_RETRIES - 1) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
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
