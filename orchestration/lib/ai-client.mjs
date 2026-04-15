/**
 * AI Client - Akash ML API Only
 * Simple, direct, no fallbacks.
 * Includes 3-minute timeout to prevent hanging.
 */

import { fetchWithTimeout, TIMEOUTS } from './fetch-with-timeout.mjs';

const AKASH_ML_API_URL = 'https://api.akashml.com/v1';
const DEFAULT_MODEL = 'meta-llama/Llama-3.3-70B-Instruct';

export async function callAI({ system, user, maxTokens = 4096, temperature = 0.7, model = DEFAULT_MODEL }) {
  const apiKey = process.env.AKASH_ML_API_KEY;
  if (!apiKey) throw new Error('AKASH_ML_API_KEY not set');

  console.log(`[ai-client] Calling Akash ML (${model}) with ${TIMEOUTS.AI_CALL / 1000}s timeout...`);

  const res = await fetchWithTimeout(
    `${AKASH_ML_API_URL}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    },
    TIMEOUTS.AI_CALL // 3 minutes for AI calls
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Akash ML error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Akash ML');

  const tokensUsed = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);
  console.log(`[ai-client] Success (${tokensUsed} tokens)`);

  return {
    content,
    source: 'akash',
    model,
    tokensUsed,
    usage: {
      input_tokens: data.usage?.prompt_tokens || 0,
      output_tokens: data.usage?.completion_tokens || 0,
    },
  };
}

export function isAIAvailable() {
  return !!process.env.AKASH_ML_API_KEY;
}

export function getPrimaryAISource() {
  return process.env.AKASH_ML_API_KEY ? 'akash' : 'none';
}
