/**
 * OWNER: Person 2 (Vectors)
 * PURPOSE: Embedding generation using OpenAI text-embedding-3-small with TF-IDF fallback
 * DEPENDENCIES: openai (optional)
 * STATUS: LIVE — uses OpenAI when key available, falls back to local TF-IDF
 */

import OpenAI from 'openai';

// ─── Client Initialization ──────────────────────────────────────────────────

let openaiClient: OpenAI | null = null;

function hasOpenAIKey(): boolean {
  return !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your-openai-api-key');
}

function getClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }
  return openaiClient;
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536; // Used for both OpenAI and local fallback
export const MAX_CHUNK_TOKENS = 512;

// ─── Embedding Generation ────────────────────────────────────────────────────

/**
 * Generate an embedding for a single piece of text.
 * Uses OpenAI if key is available, otherwise falls back to local TF-IDF hashing.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (hasOpenAIKey()) {
    return generateOpenAIEmbedding(text);
  }
  return generateLocalEmbedding(text);
}

/**
 * Generate embeddings for multiple texts in a batch.
 * Uses OpenAI if key is available, otherwise falls back to local TF-IDF hashing.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<{ embedding: number[]; index: number }[]> {
  if (hasOpenAIKey()) {
    return generateOpenAIEmbeddings(texts);
  }
  return texts.map((text, index) => ({
    embedding: generateLocalEmbeddingSync(text),
    index,
  }));
}

/**
 * Returns which embedding backend is active.
 */
export function getEmbeddingBackend(): 'openai' | 'local' {
  return hasOpenAIKey() ? 'openai' : 'local';
}

// ─── OpenAI Backend ──────────────────────────────────────────────────────────

async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

async function generateOpenAIEmbeddings(
  texts: string[]
): Promise<{ embedding: number[]; index: number }[]> {
  const client = getClient();
  // Batch in chunks of 2048 (OpenAI limit)
  const results: { embedding: number[]; index: number }[] = [];
  const batchSize = 2048;

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    for (const item of response.data) {
      results.push({
        embedding: item.embedding,
        index: i + item.index,
      });
    }
  }

  return results;
}

// ─── Local TF-IDF / Hash-based Fallback ──────────────────────────────────────

/**
 * Deterministic hash-based embedding that captures word-level semantics.
 * Uses term frequency with positional hashing to produce a fixed-length vector.
 * Not as good as OpenAI but works offline and is fast.
 */
function generateLocalEmbeddingSync(text: string): number[] {
  const vec = new Float64Array(EMBEDDING_DIMENSIONS);
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(w => w.length > 1);

  if (words.length === 0) return Array.from(vec);

  // Build term frequency map
  const tf = new Map<string, number>();
  for (const word of words) {
    tf.set(word, (tf.get(word) || 0) + 1);
  }

  // Hash each word into multiple dimensions with TF weighting
  for (const [word, count] of tf) {
    const weight = Math.log(1 + count); // log-scaled TF
    // Use multiple hash positions per word for better distribution
    for (let h = 0; h < 4; h++) {
      const hash = hashString(`${word}_${h}`);
      const idx = Math.abs(hash) % EMBEDDING_DIMENSIONS;
      // Alternate positive/negative based on secondary hash
      const sign = hashString(`${word}_sign_${h}`) % 2 === 0 ? 1 : -1;
      vec[idx] += sign * weight;
    }

    // Bigrams for phrase-level signal
    const wordArr = [...tf.keys()];
    const wordIdx = wordArr.indexOf(word);
    if (wordIdx < wordArr.length - 1) {
      const bigram = `${word}_${wordArr[wordIdx + 1]}`;
      const bigramHash = Math.abs(hashString(bigram)) % EMBEDDING_DIMENSIONS;
      vec[bigramHash] += weight * 0.5;
    }
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  }

  return Array.from(vec);
}

async function generateLocalEmbedding(text: string): Promise<number[]> {
  return generateLocalEmbeddingSync(text);
}

/** Simple FNV-1a hash */
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) | 0;
  }
  return hash;
}

// ─── Text Chunking ───────────────────────────────────────────────────────────

/**
 * Chunk text into smaller pieces suitable for embedding
 * TODO: Person 2 — Implement smart chunking that respects sentence boundaries,
 * paragraph breaks, and maintains context overlap between chunks
 */
export function chunkText(
  text: string,
  maxChunkLength: number = 1000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];

  if (text.length <= maxChunkLength) {
    return [text];
  }

  let start = 0;
  while (start < text.length) {
    let end = start + maxChunkLength;

    // Try to break at a sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > start + maxChunkLength / 2) {
        end = breakPoint + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

// ─── Email Processing ────────────────────────────────────────────────────────

/**
 * Process an email into embeddable chunks with metadata
 * TODO: Person 2 — Enhance metadata extraction (detect recipients, topics, urgency)
 */
export function prepareEmailForEmbedding(email: {
  id: string;
  subject: string;
  body: string;
  from: string;
  to: string;
  direction: string;
  receivedAt: string;
}): { text: string; metadata: Record<string, string> }[] {
  const fullText = `Subject: ${email.subject}\nFrom: ${email.from}\nTo: ${email.to}\n\n${email.body}`;
  const chunks = chunkText(fullText);

  return chunks.map((chunk, index) => ({
    text: chunk,
    metadata: {
      source: 'email',
      type: email.direction,
      emailId: email.id,
      subject: email.subject,
      chunkIndex: String(index),
      timestamp: email.receivedAt,
    },
  }));
}

/**
 * Process a chat message into embeddable chunks with metadata
 * TODO: Person 2 — Add conversation context (include surrounding messages for context)
 */
export function prepareChatForEmbedding(message: {
  id: string;
  content: string;
  source: string;
  role: string;
  sessionId: string | null;
  timestamp: string;
}): { text: string; metadata: Record<string, string> }[] {
  const chunks = chunkText(message.content);

  return chunks.map((chunk, index) => ({
    text: chunk,
    metadata: {
      source: message.source,
      type: 'chat',
      role: message.role,
      messageId: message.id,
      sessionId: message.sessionId || '',
      chunkIndex: String(index),
      timestamp: message.timestamp,
    },
  }));
}
