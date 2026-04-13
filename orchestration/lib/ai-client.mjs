/**
 * Shared AI Client for Orchestration Scripts
 *
 * Provides unified AI calling with:
 * 1. OpenClaw as primary (if configured)
 * 2. Anthropic as fallback
 * 3. Proper error handling and logging
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Call AI with automatic fallback from OpenClaw to Anthropic
 * @param {Object} options
 * @param {string} options.system - System prompt
 * @param {string} options.user - User message
 * @param {number} [options.maxTokens=4096] - Max tokens to generate
 * @returns {Promise<{content: string, source: 'openclaw'|'anthropic', tokensUsed?: number}>}
 */
export async function callAI({ system, user, maxTokens = 4096 }) {
  const OPENCLAW_URL = process.env.OPENCLAW_API_URL;
  const OPENCLAW_PASSWORD = process.env.OPENCLAW_GATEWAY_PASSWORD;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  // Try OpenClaw first (if configured)
  if (OPENCLAW_URL && OPENCLAW_PASSWORD) {
    try {
      console.log(`[ai-client] Calling OpenClaw at ${OPENCLAW_URL.substring(0, 30)}...`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENCLAW_PASSWORD}`,
        },
        body: JSON.stringify({
          model: 'openclaw',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          max_tokens: maxTokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error body');
        throw new Error(`OpenClaw HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();

      if (!data.choices?.[0]?.message?.content) {
        throw new Error('OpenClaw returned empty response');
      }

      console.log(`[ai-client] OpenClaw success`);
      return {
        content: data.choices[0].message.content,
        source: 'openclaw',
        tokensUsed: data.usage?.total_tokens,
      };
    } catch (e) {
      const errorMsg = e.name === 'AbortError' ? 'Request timeout (60s)' : e.message;
      console.warn(`[ai-client] OpenClaw failed: ${errorMsg}`);
      console.warn(`[ai-client] Falling back to Anthropic...`);
    }
  } else {
    console.log(`[ai-client] OpenClaw not configured, using Anthropic directly`);
  }

  // Fallback to Anthropic
  if (!ANTHROPIC_API_KEY) {
    throw new Error(
      'AI unavailable: Neither OPENCLAW_API_URL+OPENCLAW_GATEWAY_PASSWORD nor ANTHROPIC_API_KEY is configured'
    );
  }

  try {
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    console.log(`[ai-client] Calling Anthropic (claude-sonnet-4-20250514)...`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const content = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n\n');

    console.log(`[ai-client] Anthropic success (${response.usage.input_tokens + response.usage.output_tokens} tokens)`);

    return {
      content,
      source: 'anthropic',
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
  } catch (e) {
    console.error(`[ai-client] Anthropic failed: ${e.message}`);
    throw new Error(`AI call failed: ${e.message}`);
  }
}

/**
 * Check if AI is available (either OpenClaw or Anthropic configured)
 * @returns {boolean}
 */
export function isAIAvailable() {
  const hasOpenClaw = !!(process.env.OPENCLAW_API_URL && process.env.OPENCLAW_GATEWAY_PASSWORD);
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  return hasOpenClaw || hasAnthropic;
}

/**
 * Get the primary AI source that will be used
 * @returns {'openclaw'|'anthropic'|'none'}
 */
export function getPrimaryAISource() {
  if (process.env.OPENCLAW_API_URL && process.env.OPENCLAW_GATEWAY_PASSWORD) {
    return 'openclaw';
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return 'anthropic';
  }
  return 'none';
}
