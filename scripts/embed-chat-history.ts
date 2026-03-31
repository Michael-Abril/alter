/**
 * OWNER: Person 2 (Vectors)
 * PURPOSE: Pull un-embedded ChatMessage records, generate embeddings, store in vectra, mark as embedded
 * DEPENDENCIES: Prisma, vectra, src/lib/embeddings, src/lib/pinecone
 * 
 * Usage:
 *   npx tsx scripts/embed-chat-history.ts
 *   npx tsx scripts/embed-chat-history.ts --reset   # Re-embed everything
 *   npx tsx scripts/embed-chat-history.ts --user=USER_ID  # Specific user only
 */

import { PrismaClient } from '@prisma/client';
import { LocalIndex } from 'vectra';
import path from 'path';
import fs from 'fs';

// ─── Config ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const USER_FILTER = args.find(a => a.startsWith('--user='))?.split('=')[1];
const BATCH_SIZE = 50;

// ─── Inline embedding (avoid path alias issues in scripts) ───────────────────

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

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[embed] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const db = new PrismaClient();
  const backend = hasOpenAIKey() ? 'openai' : 'local-tfidf';
  
  log('═══════════════════════════════════════════════════');
  log('  NightShift AI — Chat History Embedding Pipeline');
  log('═══════════════════════════════════════════════════');
  log(`Backend: ${backend}`);
  log(`Reset mode: ${RESET}`);
  log(`User filter: ${USER_FILTER || 'all'}`);

  try {
    // If reset, mark all messages as un-embedded first
    if (RESET) {
      const where = USER_FILTER ? { userId: USER_FILTER } : {};
      const resetResult = await db.chatMessage.updateMany({
        where,
        data: { embedded: false },
      });
      log(`Reset ${resetResult.count} messages to un-embedded`);
    }

    // Find all un-embedded messages
    const where: any = { embedded: false };
    if (USER_FILTER) where.userId = USER_FILTER;

    const totalUnembedded = await db.chatMessage.count({ where });
    log(`Found ${totalUnembedded} un-embedded messages`);

    if (totalUnembedded === 0) {
      log('Nothing to embed. Done.');
      await db.$disconnect();
      return;
    }

    // Process in batches, grouped by user
    const users = await db.chatMessage.groupBy({
      by: ['userId'],
      where,
      _count: { id: true },
    });

    let totalEmbedded = 0;

    for (const userGroup of users) {
      const userId = userGroup.userId;
      const userMsgCount = userGroup._count.id;
      log(`\nProcessing user ${userId} (${userMsgCount} messages)`);

      // Get or create vectra index for this user
      const vectorsDir = path.join(process.cwd(), 'data', 'vectors', userId);
      if (!fs.existsSync(vectorsDir)) {
        fs.mkdirSync(vectorsDir, { recursive: true });
      }
      const index = new LocalIndex(vectorsDir);
      if (!await index.isIndexCreated()) {
        await index.createIndex();
        log(`  Created vector index at ${vectorsDir}`);
      }

      // Fetch messages in batches (always take first N un-embedded since we mark them as embedded each batch)
      let batchNum = 0;
      while (true) {
        const messages = await db.chatMessage.findMany({
          where: { ...where, userId },
          orderBy: { timestamp: 'asc' },
          take: BATCH_SIZE,
        });

        if (messages.length === 0) break;
        batchNum++;

        log(`  Batch ${batchNum}: embedding ${messages.length} messages...`);

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
                content: msg.content.slice(0, 1000), // Truncate for metadata storage
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
        log(`  ✅ Embedded ${totalEmbedded}/${totalUnembedded}`);
      }

      // Print index stats
      const stats = await index.getIndexStats();
      log(`  Index stats for ${userId}: ${stats.items} vectors`);
    }

    log('\n═══════════════════════════════════════════════════');
    log(`Done! Embedded ${totalEmbedded} messages using ${backend}`);
    log('═══════════════════════════════════════════════════');

  } catch (error) {
    console.error('[embed] Fatal error:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
