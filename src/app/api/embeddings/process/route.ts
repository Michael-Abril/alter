/**
 * OWNER: Person 2 (Vectors)
 * PURPOSE: POST: trigger embedding pipeline for a user — processes unembedded emails and chat messages
 * DEPENDENCIES: Prisma, vectra, OpenAI embeddings
 * STATUS: LIVE — real embedding pipeline
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { LocalIndex } from 'vectra';
import path from 'path';
import fs from 'fs';

// Inline embedding functions
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

// POST: Trigger embedding pipeline for a user
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const sources = body.sources || ['emails', 'chat'];

    // Find user
    const user = await db.user.findUnique({ where: { clerkId: userId } });
    if (!user) return apiError('User not found', 404);

    console.log(`[embeddings/process] Processing for user ${user.id}, sources: ${sources}`);

    let emailsProcessed = 0;
    let chatProcessed = 0;

    // Get or create vectra index for this user
    const vectorsDir = path.join(process.cwd(), 'data', 'vectors', user.id);
    if (!fs.existsSync(vectorsDir)) {
      fs.mkdirSync(vectorsDir, { recursive: true });
    }
    const index = new LocalIndex(vectorsDir);
    if (!await index.isIndexCreated()) {
      await index.createIndex();
    }

    const BATCH_SIZE = 50;

    // Process emails if requested
    if (sources.includes('emails')) {
      const totalEmails = await db.email.count({
        where: { userId: user.id, embedded: false },
      });

      if (totalEmails > 0) {
        console.log(`[embeddings/process] Processing ${totalEmails} emails`);

        while (true) {
          const emails = await db.email.findMany({
            where: { userId: user.id, embedded: false },
            orderBy: { receivedAt: 'asc' },
            take: BATCH_SIZE,
          });

          if (emails.length === 0) break;

          const texts = emails.map(e => `Subject: ${e.subject}\n\n${e.body}`);
          const embeddings = await generateEmbeddingsForTexts(texts);

          await index.beginUpdate();
          try {
            for (let i = 0; i < emails.length; i++) {
              const email = emails[i];
              await index.upsertItem({
                id: email.id,
                vector: embeddings[i],
                metadata: {
                  content: email.body.slice(0, 1000),
                  subject: email.subject,
                  from: email.from,
                  to: email.to,
                  type: 'email',
                  direction: email.direction,
                  receivedAt: email.receivedAt.toISOString(),
                },
              });
            }
            await index.endUpdate();
          } catch (err) {
            index.cancelUpdate();
            throw err;
          }

          const emailIds = emails.map(e => e.id);
          await db.email.updateMany({
            where: { id: { in: emailIds } },
            data: { embedded: true },
          });

          emailsProcessed += emails.length;
        }
      }
    }

    // Process chat messages if requested
    if (sources.includes('chat')) {
      const totalChat = await db.chatMessage.count({
        where: { userId: user.id, embedded: false },
      });

      if (totalChat > 0) {
        console.log(`[embeddings/process] Processing ${totalChat} chat messages`);

        while (true) {
          const messages = await db.chatMessage.findMany({
            where: { userId: user.id, embedded: false },
            orderBy: { timestamp: 'asc' },
            take: BATCH_SIZE,
          });

          if (messages.length === 0) break;

          const texts = messages.map(m => {
            const prefix = m.sessionId ? `[${m.sessionId}] ` : '';
            return `${prefix}${m.role}: ${m.content}`;
          });

          const embeddings = await generateEmbeddingsForTexts(texts);

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

          const messageIds = messages.map(m => m.id);
          await db.chatMessage.updateMany({
            where: { id: { in: messageIds } },
            data: { embedded: true },
          });

          chatProcessed += messages.length;
        }
      }
    }

    console.log(`[embeddings/process] Done! Emails: ${emailsProcessed}, Chat: ${chatProcessed}`);

    return apiSuccess({
      processed: {
        emails: emailsProcessed,
        chat: chatProcessed,
      },
      vectorsCreated: emailsProcessed + chatProcessed,
      status: 'completed',
      backend: hasOpenAIKey() ? 'openai' : 'local-tfidf',
    });
  } catch (error: any) {
    console.error('[embeddings/process] Error:', error);
    return apiError(`Failed to process embeddings: ${error.message}`, 500);
  }
}
