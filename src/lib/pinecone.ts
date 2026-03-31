/**
 * OWNER: Person 2 (Vectors)
 * PURPOSE: Pinecone vector database client initialization and helper functions
 * DEPENDENCIES: @pinecone-database/pinecone
 * STATUS: Scaffold — needs real implementation
 */

import { Pinecone } from '@pinecone-database/pinecone';
import type { EmbeddingQueryResult } from '@/types';

// ─── Client Initialization ──────────────────────────────────────────────────

let pineconeClient: Pinecone | null = null;

export function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pineconeClient;
}

export function getIndex() {
  const client = getPineconeClient();
  return client.index(process.env.PINECONE_INDEX || 'nightshift');
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Upsert vectors into Pinecone for a specific user
 * TODO: Person 2 — Implement batch upsert with proper namespace (userId)
 * Should handle chunking for large batches (max 100 vectors per upsert)
 */
export async function upsertVectors(
  userId: string,
  vectors: { id: string; values: number[]; metadata: Record<string, unknown> }[]
): Promise<void> {
  const index = getIndex();
  const namespace = index.namespace(userId);

  // TODO: Person 2 — Implement batch upsert (chunk into batches of 100)
  await namespace.upsert(vectors);
}

/**
 * Query Pinecone for similar vectors
 * TODO: Person 2 — Add proper filtering, handle empty results gracefully
 */
export async function queryVectors(
  userId: string,
  queryVector: number[],
  topK: number = 10,
  filter?: Record<string, unknown>
): Promise<EmbeddingQueryResult[]> {
  const index = getIndex();
  const namespace = index.namespace(userId);

  const results = await namespace.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
    filter,
  });

  return (results.matches || []).map((match) => ({
    id: match.id,
    score: match.score || 0,
    content: (match.metadata?.content as string) || '',
    metadata: {
      source: (match.metadata?.source as string) || 'unknown',
      type: (match.metadata?.type as string) || 'unknown',
      timestamp: (match.metadata?.timestamp as string) || '',
      ...((match.metadata as Record<string, unknown>) || {}),
    },
  }));
}

/**
 * Delete all vectors for a user (used for re-indexing)
 * TODO: Person 2 — Implement with confirmation safeguard
 */
export async function deleteUserVectors(userId: string): Promise<void> {
  const index = getIndex();
  const namespace = index.namespace(userId);

  // TODO: Person 2 — Implement delete all vectors in namespace
  await namespace.deleteAll();
}

/**
 * Get stats about a user's vector namespace
 * TODO: Person 2 — Implement to show embedding progress on dashboard
 */
export async function getNamespaceStats(userId: string): Promise<{ vectorCount: number }> {
  // TODO: Person 2 — Use Pinecone describe_index_stats with namespace filter
  console.log(`[pinecone] Getting stats for namespace: ${userId}`);
  return { vectorCount: 0 };
}
