/**
 * OWNER: Person 2 (Vectors)
 * PURPOSE: Embedding generation using OpenAI text-embedding-3-small
 * DEPENDENCIES: openai
 * STATUS: Scaffold — needs real implementation
 */

import OpenAI from 'openai';

// ─── Client Initialization ──────────────────────────────────────────────────

let openaiClient: OpenAI | null = null;

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
export const EMBEDDING_DIMENSIONS = 1536;
export const MAX_CHUNK_TOKENS = 512;

// ─── Embedding Generation ────────────────────────────────────────────────────

/**
 * Generate an embedding for a single piece of text
 * TODO: Person 2 — Add input validation, token counting, and error handling
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getClient();

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a batch
 * TODO: Person 2 — Add batching for large inputs (max 2048 per request),
 * implement retry logic for rate limits
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<{ embedding: number[]; index: number }[]> {
  const client = getClient();

  // TODO: Person 2 — Chunk into batches of 2048 for OpenAI limits
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });

  return response.data.map((item) => ({
    embedding: item.embedding,
    index: item.index,
  }));
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
