/**
 * OWNER: Person 2 (Vectors)
 * PURPOSE: POST: trigger embedding pipeline for onboarding — processes un-embedded chat messages
 * DEPENDENCIES: Prisma, vectra, src/lib/embeddings
 * STATUS: LIVE
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { LocalIndex } from 'vectra';
import path from 'path';
import fs from 'fs';

// Inline embedding functions to avoid import issues
const EMBEDDING_DIMENSIONS = 1536;

function hasOpenAIKey(): boolean {
  return !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-openai-api-key');
}

function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) | 0;
  }
  return hash;
}

function generateLocalEmbedding(text: string): number[] {
  const vec = new Float64Array(EMBEDDING_DIMENSIONS);
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(w => w.length > 1);

  if (words.length === 0) return Array.from(vec);

  const tf = new Map<string, number>();
  for (const word of words) {
    tf.set(word, (tf.get(word) || 0) + 1);
  }

  for (const [word, count] of tf) {
    const weight = Math.log(1 + count);
    for (let h = 0; h < 4; h++) {
      const hash = hashString(`${word}_${h}`);
      const idx = Math.abs(hash) % EMBEDDING_DIMENSIONS;
      const sign = hashString(`${word}_sign_${h}`) % 2 === 0 ? 1 : -1;
      vec[idx] += sign * weight;
    }

    const wordArr = [...tf.keys()];
    const wordIdx = wordArr.indexOf(word);
    if (wordIdx < wordArr.length - 1) {
      const bigram = `${word}_${wordArr[wordIdx + 1]}`;
      const bigramHash = Math.abs(hashString(bigram)) % EMBEDDING_DIMENSIONS;
      vec[bigramHash] += weight * 0.5;
    }
  }

  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  }

  return Array.from(vec);
}

async function generateOpenAIEmbeddings(texts: string[]): Promise<number[][]> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const results: number[][] = [];
  const batchSize = 2048;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    });
    for (const item of response.data) {
      results.push(item.embedding);
    }
  }
  return results;
}

async function generateEmbeddingsForTexts(texts: string[]): Promise<number[][]> {
  if (hasOpenAIKey()) {
    return generateOpenAIEmbeddings(texts);
  }
  return texts.map(t => generateLocalEmbedding(t));
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const sinceDaysParam = req.nextUrl.searchParams.get('sinceDays');
    const fullHistory = req.nextUrl.searchParams.get('fullHistory') === '1';
    const sinceDays = fullHistory ? 3650 : sinceDaysParam ? Math.max(1, parseInt(sinceDaysParam, 10)) : 3;
    const cutoffDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

    // Find user
    const user = await db.user.findUnique({ where: { clerkId: userId } });
    if (!user) return apiError('User not found', 404);

    const unembeddedWhere = fullHistory
      ? { userId: user.id, embedded: false }
      : { userId: user.id, embedded: false, timestamp: { gte: cutoffDate } };

    // Count un-embedded messages
    const totalUnembedded = await db.chatMessage.count({
      where: unembeddedWhere,
    });

    console.log(
      `[onboarding/embed] Found ${totalUnembedded} un-embedded recent messages for user ${user.id} (last ${sinceDays} days)`
    );

    if (totalUnembedded === 0) {
    return apiSuccess({
      messagesEmbedded: 0,
      status: 'complete',
      backend: hasOpenAIKey() ? 'openai' : 'local-tfidf',
      fullHistory,
    });
    }

    // Get or create vectra index for this user
    const vectorsDir = path.join(process.cwd(), 'data', 'vectors', user.id);
    if (!fs.existsSync(vectorsDir)) {
      fs.mkdirSync(vectorsDir, { recursive: true });
    }
    const index = new LocalIndex(vectorsDir);
    if (!await index.isIndexCreated()) {
      await index.createIndex();
      console.log(`[onboarding/embed] Created vector index at ${vectorsDir}`);
    }

    // Fetch messages in batches
    const BATCH_SIZE = 50;
    let totalEmbedded = 0;

    while (true) {
      const messages = await db.chatMessage.findMany({
        where: unembeddedWhere,
        orderBy: { timestamp: 'asc' },
        take: BATCH_SIZE,
      });

      if (messages.length === 0) break;

      // Prepare texts
      const texts = messages.map(m => {
        const prefix = m.sessionId ? `[${m.sessionId}] ` : '';
        return `${prefix}${m.role}: ${m.content}`;
      });

      // Generate embeddings
      const embeddings = await generateEmbeddingsForTexts(texts);

      // Store in vectra
      await index.beginUpdate();
      try {
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          await index.upsertItem({
            id: msg.id,
            vector: embeddings[i],
            metadata: {
              content: msg.content.slice(0, 1000),
              source: msg.source,
              type: 'chat',
              role: msg.role,
              messageId: msg.id,
              sessionId: msg.sessionId || '',
              timestamp: msg.timestamp.toISOString(),
            },
          });
        }
        await index.endUpdate();
      } catch (err) {
        index.cancelUpdate();
        throw err;
      }

      // Mark as embedded in the database
      const messageIds = messages.map(m => m.id);
      await db.chatMessage.updateMany({
        where: { id: { in: messageIds } },
        data: { embedded: true },
      });

      totalEmbedded += messages.length;
      console.log(`[onboarding/embed] Embedded ${totalEmbedded}/${totalUnembedded}`);
    }

    console.log(`[onboarding/embed] Done! Embedded ${totalEmbedded} messages`);

    return apiSuccess({
      messagesEmbedded: totalEmbedded,
      status: 'complete',
      backend: hasOpenAIKey() ? 'openai' : 'local-tfidf',
      sinceDays,
      fullHistory,
    });
  } catch (error: any) {
    console.error('[onboarding/embed] Error:', error);
    return apiError(`Failed to embed messages: ${error.message}`, 500);
  }
}
