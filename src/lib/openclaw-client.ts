/**
 * AI Client - Akash ML API Only
 * Simple, direct, no fallbacks.
 */

const AKASH_ML_API_URL = 'https://api.akashml.com/v1';
const DEFAULT_MODEL = 'meta-llama/Llama-3.3-70B-Instruct';

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
 * Call Akash ML API for AI completion.
 * (Function named callOpenClaw for backward compatibility)
 */
export async function callOpenClaw(request: OpenClawRequest): Promise<OpenClawResponse> {
  const { system, user, maxTokens = 4096 } = request;
  const apiKey = process.env.AKASH_ML_API_KEY;

  if (!apiKey) {
    throw new Error('AKASH_ML_API_KEY is not configured');
  }

  const res = await fetch(`${AKASH_ML_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Akash ML error (${res.status}): ${error}`);
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

// Alias for new code
export const callAI = callOpenClaw;

export function isOpenClawConfigured(): boolean {
  return !!process.env.AKASH_ML_API_KEY;
}

export function getActiveBackend(): 'akash' | 'none' {
  return process.env.AKASH_ML_API_KEY ? 'akash' : 'none';
}
