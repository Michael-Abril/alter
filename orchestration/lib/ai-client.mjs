/**
 * Shared AI Client for Orchestration Scripts
 *
 * OpenClaw primary (OPENCLAW_API_URL + OPENCLAW_GATEWAY_PASSWORD), Anthropic fallback.
 * Uses node:undici with IPv4-first connect to avoid common Windows/DNS fetch failures.
 */

import Anthropic from '@anthropic-ai/sdk';
import { fetch as undiciFetch, Agent } from 'undici';

function buildOpenClawAgent() {
  const insecure = ['1', 'true', 'yes'].includes(
    String(process.env.OPENCLAW_TLS_INSECURE ?? '').toLowerCase()
  );
  /** @type {import('undici').Agent.Options} */
  const opts = {
    connect: {
      family: 4,
      ...(insecure ? { rejectUnauthorized: false } : {}),
    },
    headersTimeout: 120_000,
    bodyTimeout: 120_000,
  };
  return new Agent(opts);
}

function normalizeOpenClawBaseUrl(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw.trim().replace(/\/+$/, '');
}

function formatErr(e) {
  if (!e) return String(e);
  const base = e.message || String(e);
  const c = e.cause;
  if (c) {
    return `${base} | cause: ${c.message || c}${c.code ? ` (${c.code})` : ''}`;
  }
  return base;
}

/**
 * Call AI with automatic fallback from OpenClaw to Anthropic (unless OPENCLAW_FALLBACK_ANTHROPIC=0|false)
 */
export async function callAI({ system, user, maxTokens = 4096 }) {
  const OPENCLAW_URL = normalizeOpenClawBaseUrl(process.env.OPENCLAW_API_URL);
  const OPENCLAW_PASSWORD = process.env.OPENCLAW_GATEWAY_PASSWORD;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const allowAnthropicFallback = !['0', 'false', 'no'].includes(
    String(process.env.OPENCLAW_FALLBACK_ANTHROPIC ?? 'true').toLowerCase()
  );

  if (OPENCLAW_URL && OPENCLAW_PASSWORD) {
    const rawPath = process.env.OPENCLAW_CHAT_PATH || '/v1/chat/completions';
    const pathPart = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const url = `${OPENCLAW_URL}${pathPart}`;
    const openclawAgent = buildOpenClawAgent();
    try {
      console.log(`[ai-client] Calling OpenClaw at ${OPENCLAW_URL.substring(0, 48)}...`);
      if (process.env.OPENCLAW_TLS_INSECURE === '1' || process.env.OPENCLAW_TLS_INSECURE === 'true') {
        console.warn('[ai-client] OPENCLAW_TLS_INSECURE enabled — TLS verification disabled for OpenClaw only (dev)');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      const response = await undiciFetch(url, {
        method: 'POST',
        dispatcher: openclawAgent,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENCLAW_PASSWORD}`,
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
        throw new Error(`OpenClaw HTTP ${response.status}: ${errorText.substring(0, 400)}`);
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
      const errorMsg = e.name === 'AbortError' ? 'Request timeout (120s)' : formatErr(e);
      console.warn(`[ai-client] OpenClaw failed: ${errorMsg}`);
      if (!allowAnthropicFallback) {
        throw new Error(`OpenClaw failed (fallback disabled): ${errorMsg}`);
      }
      console.warn(`[ai-client] Falling back to Anthropic...`);
    }
  } else {
    console.log(`[ai-client] OpenClaw not configured (OPENCLAW_API_URL + OPENCLAW_GATEWAY_PASSWORD), using Anthropic directly`);
  }

  if (!ANTHROPIC_API_KEY) {
    throw new Error(
      'AI unavailable: Configure OPENCLAW_API_URL+OPENCLAW_GATEWAY_PASSWORD or ANTHROPIC_API_KEY'
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
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n\n');

    console.log(
      `[ai-client] Anthropic success (${response.usage.input_tokens + response.usage.output_tokens} tokens)`
    );

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

export function isAIAvailable() {
  const hasOpenClaw = !!(normalizeOpenClawBaseUrl(process.env.OPENCLAW_API_URL) && process.env.OPENCLAW_GATEWAY_PASSWORD);
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  return hasOpenClaw || hasAnthropic;
}

export function getPrimaryAISource() {
  if (normalizeOpenClawBaseUrl(process.env.OPENCLAW_API_URL) && process.env.OPENCLAW_GATEWAY_PASSWORD) {
    return 'openclaw';
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return 'anthropic';
  }
  return 'none';
}
