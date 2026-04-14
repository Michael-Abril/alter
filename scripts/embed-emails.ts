/**
 * OWNER: Person 2 (Vectors)
 * PURPOSE: Pull un-embedded Email records, generate embeddings, store in vectra, mark as embedded
 * DEPENDENCIES: Prisma, vectra, src/lib/embeddings, src/lib/pinecone
 * 
 * Usage:
 *   npx tsx scripts/embed-emails.ts
 *   npx tsx scripts/embed-emails.ts --reset   # Re-embed everything
 *   npx tsx scripts/embed-emails.ts --user=USER_ID  # Specific user only
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
    console.log('   Using OpenAI embeddings');
    return generateOpenAIEmbeddings(texts);
  } else {
    console.log('   Using local TF-IDF embeddings (no OpenAI key)');
    return texts.map(t => generateLocalEmbedding(t));
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

const db = new PrismaClient();

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 Email Embedding Script');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (RESET) {
    console.log('⚠️  RESET mode: will re-embed all emails');
  }

  // Get all users (or filter by specific user)
  const users = USER_FILTER
    ? await db.user.findMany({ where: { id: USER_FILTER } })
    : await db.user.findMany();

  if (users.length === 0) {
    console.log('❌ No users found');
    process.exit(1);
  }

  console.log(`📊 Processing ${users.length} user(s)`);
  console.log('');

  let totalEmbedded = 0;

  for (const user of users) {
    console.log(`👤 User: ${user.email} (${user.id})`);

    // Get un-embedded emails (or all if RESET)
    const emails = await db.email.findMany({
      where: {
        userId: user.id,
        ...(RESET ? {} : { embedded: false }),
      },
      orderBy: { receivedAt: 'asc' },
    });

    if (emails.length === 0) {
      console.log('   ℹ️  No un-embedded emails found');
      console.log('');
      continue;
    }

    console.log(`   📧 Found ${emails.length} un-embedded emails`);

    // Get or create vector index for this user
    const vectorsPath = path.join(process.cwd(), 'data', 'vectors', user.id);
    if (!fs.existsSync(vectorsPath)) {
      fs.mkdirSync(vectorsPath, { recursive: true });
    }

    const index = new LocalIndex(vectorsPath);
    if (!await index.isIndexCreated()) {
      await index.createIndex();
      console.log('   ✅ Created new vector index');
    }

    // Process in batches
    for (let i = 0; i < emails.length; i += BATCH_SIZE) {
      const batch = emails.slice(i, i + BATCH_SIZE);
      console.log(`   📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(emails.length / BATCH_SIZE)} (${batch.length} emails)`);

      // Prepare text for embedding: subject + body
      const texts = batch.map(email => 
        `Subject: ${email.subject}\n\n${email.body.slice(0, 2000)}`
      );

      // Generate embeddings
      const embeddings = await generateEmbeddingsForTexts(texts);

      // Store in vectra
      await index.beginUpdate();
      try {
        for (let j = 0; j < batch.length; j++) {
          const email = batch[j];
          const embedding = embeddings[j];

          await index.upsertItem({
            id: `email-${email.id}`,
            vector: embedding,
            metadata: {
              source: 'email',
              type: email.direction,
              emailId: email.id,
              from: email.from,
              to: email.to,
              subject: email.subject,
              timestamp: email.receivedAt.toISOString(),
              content: `Subject: ${email.subject}\n\n${email.body.slice(0, 300)}`,
            },
          });
        }
        await index.endUpdate();
      } catch (err) {
        index.cancelUpdate();
        throw err;
      }

      // Mark as embedded in database
      const emailIds = batch.map(m => m.id);
      await db.email.updateMany({
        where: { id: { in: emailIds } },
        data: { embedded: true },
      });

      totalEmbedded += batch.length;
      console.log(`   ✅ Embedded ${batch.length} emails`);
    }

    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Complete! Embedded ${totalEmbedded} emails total`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
