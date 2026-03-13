// llm.js — Hermes LLM client with native function calling + conversation memory
// Uses vLLM with --enable-auto-tool-choice --tool-call-parser hermes
// Falls back to text parsing if tool calling is unavailable

import OpenAI from 'openai';
import { GAME_TOOLS } from './tools.js';

const VLLM_URL = process.env.VLLM_URL || 'http://localhost:8000/v1';
const MODEL_NAME = process.env.MODEL_NAME || 'solidrust/Hermes-3-Llama-3.1-8B-AWQ';
const BASE_TEMPERATURE = parseFloat(process.env.TEMPERATURE || '0.7');
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '512', 10);
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;
const MAX_HISTORY_MESSAGES = 30;  // ~15 ticks of conversation context

const client = new OpenAI({
  baseURL: VLLM_URL,
  apiKey: process.env.VLLM_API_KEY || 'not-needed',
});

// ── Conversation Memory (L1 — Session Memory) ──

const conversationHistory = [];
let useToolCalling = true;  // Try tool calling first, disable on failure

export function clearConversation() {
  conversationHistory.length = 0;
}

function trimHistory() {
  while (conversationHistory.length > MAX_HISTORY_MESSAGES) {
    conversationHistory.splice(0, 2);  // Remove oldest user+assistant pair
  }
}

// ── Adaptive Temperature ──

export function getTemperature(phase, state) {
  if (!state || !phase) return BASE_TEMPERATURE;
  if ((state.health || 20) <= 6) return 0.3;        // Precise survival decisions
  if (state.dimension?.includes('nether')) return 0.5; // Careful in danger
  if (state.dimension?.includes('end')) return 0.4;    // Very careful in End
  if (phase.id <= 2) return 0.7;                       // Creative early exploration
  return 0.6;
}

// ── Main Query Function ──

export async function queryLLM(systemPrompt, userMessage, opts = {}) {
  const temperature = opts.temperature ?? BASE_TEMPERATURE;
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
            tool_choice: 'required',
            temperature,
            max_tokens: MAX_TOKENS,
          });
        } catch (toolErr) {
          // Tool calling not supported — fall back permanently
          if (toolErr.status === 400 || toolErr.message?.includes('tool')) {
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
        } catch {}

        result = {
          reasoning: msg.content || '',
          action: {
            type: toolCall.function.name,
            ...args,
          },
          raw: msg.content || JSON.stringify(msg.tool_calls),
          mode: 'tool_call',
        };

        // Store in conversation history with proper format
        conversationHistory.push(
          { role: 'user', content: userMessage },
          {
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.tool_calls,
          },
        );
      } else {
        // Fallback to text parsing
        const text = msg.content || '';
        result = parseResponseFallback(text);
        result.mode = 'text_fallback';

        conversationHistory.push(
          { role: 'user', content: userMessage },
          { role: 'assistant', content: text },
        );
      }

      trimHistory();
      return result;

    } catch (err) {
      lastError = err;
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

  // Extract REASONING
  const reasoningMatch = text.match(/REASONING:\s*(.+?)(?=\nACTION:|$)/s);
  if (reasoningMatch) {
    reasoning = reasoningMatch[1].trim();
  }

  // Extract ACTION — look for JSON after ACTION:
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

  // Fallback: if no REASONING marker, use everything before ACTION as reasoning
  if (!reasoning && !reasoningMatch) {
    const beforeAction = text.split(/ACTION:/)[0];
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
