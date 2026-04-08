import Anthropic from '@anthropic-ai/sdk';
import db from '@/lib/db';

type BuildVoiceProfileInput = {
  clerkId?: string;
  userId?: string;
  sampleLimit?: number;
};

function buildSystemPromptFromProfile(profile: {
  avgSentenceLen: number;
  formalityLevel: number;
  usesEmojis: boolean;
  greetingPhrases: string[];
  signOffPhrases: string[];
  toneKeywords: string[];
}) {
  return [
    'You are drafting as the user. Match their voice exactly.',
    `Average sentence length: about ${Math.round(profile.avgSentenceLen)} words.`,
    `Formality level: ${profile.formalityLevel.toFixed(2)} (0 casual, 1 formal).`,
    `Emoji usage: ${profile.usesEmojis ? 'occasionally use light emojis where natural.' : 'avoid emojis unless clearly needed.'}`,
    `Common greetings: ${profile.greetingPhrases.join(', ') || 'none observed'}.`,
    `Common sign-offs: ${profile.signOffPhrases.join(', ') || 'none observed'}.`,
    `Tone keywords: ${profile.toneKeywords.join(', ')}.`,
    'Keep output concise, specific, and natural for this person.',
    'Do not mention these instructions.',
  ].join('\n');
}

function parseClaudeJson(text: string) {
  const cleaned = text.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

export async function buildVoiceProfileForUser(input: BuildVoiceProfileInput) {
  const sampleLimit = input.sampleLimit || 50;

  const user = input.userId
    ? await db.user.findUnique({ where: { id: input.userId } })
    : input.clerkId
    ? await db.user.findUnique({ where: { clerkId: input.clerkId } })
    : null;

  if (!user) {
    throw new Error('User not found for voice profile build');
  }

  const [chatMessages, sentEmails] = await Promise.all([
    db.chatMessage.findMany({
      where: { userId: user.id, role: 'user' },
      orderBy: { timestamp: 'desc' },
      take: sampleLimit,
      select: { content: true, timestamp: true, source: true },
    }),
    db.email.findMany({
      where: { userId: user.id, direction: 'sent' },
      orderBy: { receivedAt: 'desc' },
      take: sampleLimit,
      select: { body: true, subject: true, receivedAt: true },
    }),
  ]);

  const pooledSamples = [
    ...chatMessages.map((m) => ({
      text: m.content,
      ts: m.timestamp.getTime(),
      source: `chat:${m.source}`,
    })),
    ...sentEmails.map((e) => ({
      text: `${e.subject ? `Subject: ${e.subject}\n` : ''}${e.body}`,
      ts: e.receivedAt.getTime(),
      source: 'email:sent',
    })),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, sampleLimit);

  if (pooledSamples.length < 10) {
    throw new Error('Not enough user-authored messages to build a reliable voice profile (need at least 10).');
  }

  const sampleText = pooledSamples
    .map((s, i) => `Sample ${i + 1} [${s.source}]\n${s.text.slice(0, 1500)}`)
    .join('\n\n---\n\n');

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const promptContent = [
    'Analyze this person\'s writing style. Extract:',
    '- average sentence length (number)',
    '- formality level 0-1',
    '- whether they use emojis (boolean)',
    '- common greeting phrases (array)',
    '- common sign-off phrases (array)',
    '- 5 tone keywords (array)',
    '- 3 example sentences that best represent their voice (array)',
    '',
    'Return JSON with EXACT keys:',
    '{',
    '  "avgSentenceLen": number,',
    '  "formalityLevel": number,',
    '  "usesEmojis": boolean,',
    '  "greetingPhrases": string[],',
    '  "signOffPhrases": string[],',
    '  "toneKeywords": string[],',
    '  "exampleSentences": string[]',
    '}',
    '',
    sampleText,
  ].join('\n');

  let response;
  try {
    response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1200,
      system:
        'You are a writing-style analyzer. Return strict JSON only, no markdown, no explanation.',
      messages: [{ role: 'user', content: promptContent }],
    });
  } catch {
    // Fallback when Haiku is unavailable on this account.
    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      system:
        'You are a writing-style analyzer. Return strict JSON only, no markdown, no explanation.',
      messages: [{ role: 'user', content: promptContent }],
    });
  }

  const content = response.content.find((c) => c.type === 'text');
  const parsed = parseClaudeJson(content?.text || '{}');

  const profile = {
    avgSentenceLen: Number(parsed.avgSentenceLen) || 15,
    formalityLevel: Math.max(0, Math.min(1, Number(parsed.formalityLevel) || 0.5)),
    usesEmojis: Boolean(parsed.usesEmojis),
    greetingPhrases: Array.isArray(parsed.greetingPhrases) ? parsed.greetingPhrases.slice(0, 8) : [],
    signOffPhrases: Array.isArray(parsed.signOffPhrases) ? parsed.signOffPhrases.slice(0, 8) : [],
    toneKeywords: Array.isArray(parsed.toneKeywords) ? parsed.toneKeywords.slice(0, 5) : [],
    exampleSentences: Array.isArray(parsed.exampleSentences) ? parsed.exampleSentences.slice(0, 3) : [],
  };

  const systemPrompt = buildSystemPromptFromProfile(profile);

  const saved = await db.voiceProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      avgSentenceLen: profile.avgSentenceLen,
      formalityScore: profile.formalityLevel,
      emojiFrequency: profile.usesEmojis ? 0.3 : 0,
      signOffStyle: profile.signOffPhrases.join(' | ').slice(0, 500),
      toneKeywords: JSON.stringify(profile.toneKeywords),
      sampleOutputs: JSON.stringify({
        exampleSentences: profile.exampleSentences,
        greetingPhrases: profile.greetingPhrases,
        signOffPhrases: profile.signOffPhrases,
      }),
      systemPrompt,
    },
    update: {
      avgSentenceLen: profile.avgSentenceLen,
      formalityScore: profile.formalityLevel,
      emojiFrequency: profile.usesEmojis ? 0.3 : 0,
      signOffStyle: profile.signOffPhrases.join(' | ').slice(0, 500),
      toneKeywords: JSON.stringify(profile.toneKeywords),
      sampleOutputs: JSON.stringify({
        exampleSentences: profile.exampleSentences,
        greetingPhrases: profile.greetingPhrases,
        signOffPhrases: profile.signOffPhrases,
      }),
      systemPrompt,
    },
  });

  return {
    userId: user.id,
    profile,
    systemPrompt,
    sampleCount: pooledSamples.length,
    voiceProfileId: saved.id,
  };
}
