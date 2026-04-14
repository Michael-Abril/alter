#!/usr/bin/env node
/**
 * Embed Email Messages
 * Generates embeddings for un-embedded emails and stores them in vectra
 */

import { PrismaClient } from '@prisma/client';
import { LocalIndex } from 'vectra';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new PrismaClient();

const EMBEDDING_DIMENSIONS = 1536;

function hasOpenAIKey() {
  return !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-openai-api-key');
}

function hashString(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) | 0;
  }
  return hash;
}

function generateLocalEmbedding(text) {
  const vec = new Float64Array(EMBEDDING_DIMENSIONS);
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(w => w.length > 1);

  if (words.length === 0) return Array.from(vec);

  const tf = new Map();
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

async function generateOpenAIEmbeddings(texts) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const results = [];
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

async function embedEmails() {
  console.log('🔮 Starting email embedding...\n');

  try {
    const user = await db.user.findFirst();
    
    if (!user) {
      console.log('❌ No user found');
      return;
    }

    console.log(`✓ Found user: ${user.email || user.clerkId}`);
    console.log(`  Using: ${hasOpenAIKey() ? 'OpenAI embeddings' : 'Local TF-IDF embeddings'}`);

    // Count un-embedded emails
    const totalUnembedded = await db.email.count({
      where: { userId: user.id, embedded: false }
    });

    console.log(`\n📧 Found ${totalUnembedded} un-embedded emails`);

    if (totalUnembedded === 0) {
      console.log('✅ All emails already embedded!');
      return;
    }

    // Get or create vectra index
    const vectorsDir = path.join(process.cwd(), 'data', 'vectors', user.id);
    if (!fs.existsSync(vectorsDir)) {
      fs.mkdirSync(vectorsDir, { recursive: true });
    }
    const index = new LocalIndex(vectorsDir);
    if (!await index.isIndexCreated()) {
      await index.createIndex();
      console.log(`✓ Created vector index at ${vectorsDir}`);
    }

    // Process in batches
    const BATCH_SIZE = 50;
    let totalEmbedded = 0;

    while (true) {
      const emails = await db.email.findMany({
        where: { userId: user.id, embedded: false },
        orderBy: { receivedAt: 'asc' },
        take: BATCH_SIZE,
      });

      if (emails.length === 0) break;

      // Prepare texts
      const texts = emails.map(e => `Subject: ${e.subject}\n\n${e.body}`);

      // Generate embeddings
      const embeddings = hasOpenAIKey() 
        ? await generateOpenAIEmbeddings(texts)
        : texts.map(t => generateLocalEmbedding(t));

      // Store in vectra
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

      // Mark as embedded
      const emailIds = emails.map(e => e.id);
      await db.email.updateMany({
        where: { id: { in: emailIds } },
        data: { embedded: true },
      });

      totalEmbedded += emails.length;
      console.log(`   Embedded ${totalEmbedded}/${totalUnembedded}...`);
    }

    console.log(`\n✅ Email embedding complete!`);
    console.log(`   Total embedded: ${totalEmbedded} emails`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.$disconnect();
  }
}

embedEmails();
