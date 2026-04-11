/**
 * OpenClaw Client - AI Digital Twin Integration
 *
 * All AI calls should go through OpenClaw to ensure the user's personality
 * (SOUL.md) is applied consistently. OpenClaw thinks and acts like the user.
 *
 * Usage:
 *   import { callOpenClaw } from '@/lib/openclaw-client';
 *   const result = await callOpenClaw({ system: '...', user: '...' });
 */

const OPENCLAW_URL = process.env.OPENCLAW_API_URL;
const OPENCLAW_PASSWORD = process.env.OPENCLAW_GATEWAY_PASSWORD;

// Fallback to Anthropic if OpenClaw is not configured (for backwards compatibility)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export interface OpenClawRequest {
  system: string;
  user: string;
  maxTokens?: number;
  model?: string;
}

export interface OpenClawResponse {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Call OpenClaw (or fallback to Anthropic) for AI completion.
 * OpenClaw uses SOUL.md personality to act as the user's digital twin.
 */
export async function callOpenClaw(request: OpenClawRequest): Promise<OpenClawResponse> {
  const { system, user, maxTokens = 4096, model = 'openclaw' } = request;

  // Use OpenClaw if configured
  if (OPENCLAW_URL && OPENCLAW_PASSWORD) {
    const res = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCLAW_PASSWORD}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`OpenClaw error (${res.status}): ${error}`);
    }

    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || '',
      usage: {
        input_tokens: data.usage?.prompt_tokens ?? 0,
        output_tokens: data.usage?.completion_tokens ?? 0,
      },
    };
  }

  // Fallback to Anthropic if OpenClaw not configured
  if (ANTHROPIC_API_KEY) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Anthropic error (${res.status}): ${error}`);
    }

    const data = await res.json();
    return {
      content: data.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n\n') || '',
      usage: {
        input_tokens: data.usage?.input_tokens ?? 0,
        output_tokens: data.usage?.output_tokens ?? 0,
      },
    };
  }

  throw new Error('Neither OPENCLAW_API_URL nor ANTHROPIC_API_KEY is configured');
}

/**
 * Check if OpenClaw is configured and available
 */
export function isOpenClawConfigured(): boolean {
  return !!(OPENCLAW_URL && OPENCLAW_PASSWORD);
}

/**
 * Get the active AI backend name
 */
export function getActiveBackend(): 'openclaw' | 'anthropic' | 'none' {
  if (OPENCLAW_URL && OPENCLAW_PASSWORD) return 'openclaw';
  if (ANTHROPIC_API_KEY) return 'anthropic';
  return 'none';
}
