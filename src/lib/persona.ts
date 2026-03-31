/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Voice profile builder — analyzes user's writing to create a persona,
 * generates system prompts that make Claude write like the user
 * DEPENDENCIES: @/lib/claude, @/lib/db, @/types
 * STATUS: Scaffold — needs real implementation
 */

import type { VoiceProfile } from '@/types';

// ─── System Prompt Generation ────────────────────────────────────────────────

/**
 * Generate a system prompt from a voice profile that makes Claude write like the user
 * TODO: Person 4 — Build a comprehensive system prompt that captures:
 * - Writing tone and formality level
 * - Sentence structure patterns
 * - Common phrases and vocabulary
 * - Emoji and punctuation habits
 * - Sign-off style
 * - Context-specific behavior (formal for work, casual for friends)
 */
export function buildSystemPrompt(profile: VoiceProfile): string {
  const formalityLabel = getFormalityLabel(profile.formalityScore || 0.5);
  const toneKeywords = profile.toneKeywords || ['neutral'];
  const signOff = profile.signOffStyle || 'Best';

  // TODO: Person 4 — Make this much more sophisticated with few-shot examples
  return `You are writing on behalf of the user. Match their writing style exactly.

Writing Style Profile:
- Formality: ${formalityLabel}
- Tone: ${toneKeywords.join(', ')}
- Average sentence length: ${profile.avgSentenceLen || 15} words
- Emoji usage: ${getEmojiLabel(profile.emojiFrequency || 0)}
- Sign-off style: "${signOff}"

Rules:
1. Match the user's tone and formality level precisely
2. Use similar sentence structures and vocabulary
3. ${profile.emojiFrequency && profile.emojiFrequency > 0.1 ? 'Include emojis naturally as the user would' : 'Avoid emojis unless contextually appropriate'}
4. Sign off emails with "${signOff}" or similar
5. Never be more formal or informal than the user's natural style
6. Maintain consistency with the user's writing patterns across all outputs`;
}

/**
 * Build a context-aware prompt that includes relevant retrieved context
 * TODO: Person 4 — Add project-specific context, recent conversation history,
 * and relevant email threads
 */
export function buildContextPrompt(params: {
  systemPrompt: string;
  retrievedContext: string[];
  taskDescription: string;
  type: 'email' | 'doc' | 'code' | 'task';
}): { system: string; user: string } {
  const contextBlock = params.retrievedContext.length > 0
    ? `\n\nRelevant Context:\n${params.retrievedContext.map((c, i) => `[${i + 1}] ${c}`).join('\n\n')}`
    : '';

  return {
    system: params.systemPrompt,
    user: `Task: ${params.taskDescription}\nType: ${params.type}${contextBlock}`,
  };
}

// ─── Voice Analysis Helpers ──────────────────────────────────────────────────

/**
 * Extract writing samples from emails and chat messages for analysis
 * TODO: Person 4 — Filter for quality samples (skip very short messages,
 * auto-replies, forwarded content), weight recent samples higher
 */
export function selectWritingSamples(
  emails: { body: string; direction: string }[],
  chatMessages: { content: string; role: string }[]
): string[] {
  const samples: string[] = [];

  // Collect sent email bodies (user's own writing)
  const sentEmails = emails
    .filter((e) => e.direction === 'sent' && e.body.length > 50)
    .slice(0, 20);
  samples.push(...sentEmails.map((e) => e.body));

  // Collect user's chat messages
  const userMessages = chatMessages
    .filter((m) => m.role === 'user' && m.content.length > 30)
    .slice(0, 30);
  samples.push(...userMessages.map((m) => m.content));

  // TODO: Person 4 — Deduplicate, rank by quality, and limit to best samples
  return samples.slice(0, 50);
}

/**
 * Compute basic writing statistics locally (before sending to Claude for deeper analysis)
 * TODO: Person 4 — Add more metrics: vocabulary diversity, readability score,
 * paragraph length patterns, question frequency
 */
export function computeBasicStats(samples: string[]): {
  avgSentenceLen: number;
  avgWordLen: number;
  emojiFrequency: number;
} {
  if (samples.length === 0) {
    return { avgSentenceLen: 0, avgWordLen: 0, emojiFrequency: 0 };
  }

  let totalSentences = 0;
  let totalWords = 0;
  let totalChars = 0;
  let emojiCount = 0;

  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

  for (const sample of samples) {
    const sentences = sample.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const words = sample.split(/\s+/).filter((w) => w.length > 0);
    const emojis = sample.match(emojiRegex);

    totalSentences += sentences.length;
    totalWords += words.length;
    totalChars += words.reduce((sum, w) => sum + w.length, 0);
    emojiCount += emojis ? emojis.length : 0;
  }

  return {
    avgSentenceLen: totalSentences > 0 ? Math.round(totalWords / totalSentences) : 0,
    avgWordLen: totalWords > 0 ? Math.round((totalChars / totalWords) * 10) / 10 : 0,
    emojiFrequency: totalWords > 0 ? Math.round((emojiCount / totalWords) * 1000) / 1000 : 0,
  };
}

// ─── Label Helpers ───────────────────────────────────────────────────────────

function getFormalityLabel(score: number): string {
  if (score < 0.2) return 'Very Casual';
  if (score < 0.4) return 'Casual';
  if (score < 0.6) return 'Neutral';
  if (score < 0.8) return 'Formal';
  return 'Very Formal';
}

function getEmojiLabel(frequency: number): string {
  if (frequency < 0.01) return 'None';
  if (frequency < 0.05) return 'Rare';
  if (frequency < 0.1) return 'Occasional';
  return 'Frequent';
}
