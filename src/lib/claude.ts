/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: AI API wrapper for draft generation, persona modeling, and confidence scoring
 * DEPENDENCIES: Akash ML API via openclaw-client
 * STATUS: LIVE — uses Akash ML API
 */

import { callOpenClaw } from '@/lib/openclaw-client';

const DEFAULT_MODEL = 'meta-llama/Llama-3.3-70B-Instruct';

// ─── Draft Generation ────────────────────────────────────────────────────────

/**
 * Generate a draft in the user's voice using their persona system prompt
 */
export async function generateDraft(params: {
  systemPrompt: string;
  context: string;
  instructions: string;
  type: 'email' | 'doc' | 'code' | 'task';
  fewShotExamples?: string[];
}): Promise<{ content: string; model: string }> {
  const res = await callOpenClaw({
    system: params.systemPrompt,
    user: `Context:\n${params.context}\n\nInstructions:\n${params.instructions}`,
    maxTokens: 4096,
  });

  return {
    content: res.content || '',
    model: DEFAULT_MODEL,
  };
}

// ─── Confidence Scoring ──────────────────────────────────────────────────────

/**
 * Score how confident we should be in a draft
 */
export async function scoreConfidence(params: {
  draft: string;
  userVoiceSamples: string[];
  taskDescription: string;
  riskLevel: 'low' | 'medium' | 'high';
}): Promise<{ score: number; reasoning: string }> {
  const res = await callOpenClaw({
    system: 'You are a confidence scoring system. Evaluate the following draft and return a JSON object with "score" (0-1) and "reasoning" (string). Return ONLY valid JSON, no markdown.',
    user: `Draft:\n${params.draft}\n\nTask: ${params.taskDescription}\nRisk Level: ${params.riskLevel}\n\nUser voice samples:\n${params.userVoiceSamples.join('\n---\n')}`,
    maxTokens: 1024,
  });

  try {
    const cleaned = res.content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      score: parsed.score || 0.5,
      reasoning: parsed.reasoning || 'Unable to assess confidence',
    };
  } catch {
    return { score: 0.5, reasoning: 'Failed to parse confidence response' };
  }
}

// ─── Persona Analysis ────────────────────────────────────────────────────────

/**
 * Analyze writing samples to build a voice profile
 */
export async function analyzeWritingStyle(samples: string[]): Promise<{
  avgSentenceLen: number;
  formalityScore: number;
  emojiFrequency: number;
  toneKeywords: string[];
  systemPrompt: string;
}> {
  const res = await callOpenClaw({
    system: 'Analyze the following writing samples and return a JSON object describing the writing style. Return ONLY valid JSON, no markdown.',
    user: `Analyze these writing samples:\n\n${samples.join('\n\n---\n\n')}`,
    maxTokens: 2048,
  });

  try {
    const cleaned = res.content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      avgSentenceLen: parsed.avgSentenceLen || 15,
      formalityScore: parsed.formalityScore || 0.5,
      emojiFrequency: parsed.emojiFrequency || 0,
      toneKeywords: parsed.toneKeywords || ['neutral'],
      systemPrompt: parsed.systemPrompt || '',
    };
  } catch {
    return {
      avgSentenceLen: 15,
      formalityScore: 0.5,
      emojiFrequency: 0,
      toneKeywords: ['neutral'],
      systemPrompt: '',
    };
  }
}
