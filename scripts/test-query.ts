/**
 * Quick test: query the local vector store directly.
 * Usage: npx tsx scripts/test-query.ts "NightShift AI virtual twin"
 */

import { LocalIndex } from 'vectra';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const EMBEDDING_DIMENSIONS = 1536;

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

async function main() {
  const query = process.argv[2] || 'NightShift AI virtual twin';
  const topK = parseInt(process.argv[3] || '5', 10);

  console.log(`\nQuery: "${query}"`);
  console.log(`Top K: ${topK}`);
  console.log('─'.repeat(60));

  const db = new PrismaClient();

  // Find first user
  const user = await db.user.findFirst();
  if (!user) {
    console.log('No users found in database.');
    await db.$disconnect();
    return;
  }
  console.log(`User: ${user.id} (${user.clerkId})`);

  // Load index
  const vectorsDir = path.join(process.cwd(), 'data', 'vectors', user.id);
  if (!fs.existsSync(vectorsDir)) {
    console.log(`No vector index found at ${vectorsDir}`);
    await db.$disconnect();
    return;
  }

  const index = new LocalIndex(vectorsDir);
  const stats = await index.getIndexStats();
  console.log(`Vector index: ${stats.items} vectors`);
  console.log('─'.repeat(60));

  // Generate query embedding
  const queryVector = generateLocalEmbedding(query);

  // Search
  const results = await index.queryItems(queryVector, '', topK);

  console.log(`\nTop ${results.length} results:\n`);

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const content = (r.item.metadata?.content as string) || '';
    const source = r.item.metadata?.source || 'unknown';
    const role = r.item.metadata?.role || 'unknown';
    const sessionId = r.item.metadata?.sessionId || '';

    console.log(`${i + 1}. [score: ${r.score.toFixed(4)}] [${source}/${role}] ${sessionId}`);
    console.log(`   ${content.slice(0, 200)}${content.length > 200 ? '...' : ''}`);
    console.log('');
  }

  await db.$disconnect();
}

main().catch(console.error);
