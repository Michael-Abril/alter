/**
 * OWNER: Person 2 (Vectors)
 * PURPOSE: Local vector store using vectra (swap to Pinecone later)
 * DEPENDENCIES: vectra
 * STATUS: LIVE — stores embeddings as JSON in /data/vectors
 */

import { LocalIndex } from 'vectra';
import path from 'path';
import type { EmbeddingQueryResult } from '@/types';

// ─── Index Cache ─────────────────────────────────────────────────────────────

const indexCache = new Map<string, LocalIndex>();

function getVectorsPath(): string {
  return path.join(process.cwd(), 'data', 'vectors');
}

/**
 * Get or create a LocalIndex for a given namespace (userId).
 * Each user gets their own index folder: data/vectors/{userId}/
 */
export async function getIndex(namespace: string = 'default'): Promise<LocalIndex> {
  if (indexCache.has(namespace)) {
    return indexCache.get(namespace)!;
  }

  const folderPath = path.join(getVectorsPath(), namespace);
  const index = new LocalIndex(folderPath);

  // Create index if it doesn't exist
  if (!await index.isIndexCreated()) {
    await index.createIndex();
    console.log(`[vectors] Created new index at ${folderPath}`);
  }

  indexCache.set(namespace, index);
  return index;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Upsert vectors into the local vector store for a specific user.
 */
export async function upsertVectors(
  userId: string,
  vectors: { id: string; values: number[]; metadata: Record<string, string | number | boolean> }[]
): Promise<void> {
  const index = await getIndex(userId);

  // vectra doesn't have a native batch upsert, so we use beginUpdate/endUpdate
  await index.beginUpdate();
  try {
    for (const vec of vectors) {
      await index.upsertItem({
        id: vec.id,
        vector: vec.values,
        metadata: vec.metadata,
      });
    }
    await index.endUpdate();
  } catch (err) {
    index.cancelUpdate();
    throw err;
  }
}

/**
 * Query the local vector store for similar vectors.
 */
export async function queryVectors(
  userId: string,
  queryVector: number[],
  topK: number = 10,
  filter?: Record<string, unknown>
): Promise<EmbeddingQueryResult[]> {
  const index = await getIndex(userId);

  const results = await index.queryItems(queryVector, '', topK, filter as any);

  return results.map((result) => ({
    id: result.item.id,
    score: result.score,
    content: (result.item.metadata?.content as string) || '',
    metadata: {
      source: (result.item.metadata?.source as string) || 'unknown',
      type: (result.item.metadata?.type as string) || 'unknown',
      timestamp: (result.item.metadata?.timestamp as string) || '',
      ...(result.item.metadata || {}),
    },
  }));
}

/**
 * Delete all vectors for a user (used for re-indexing).
 */
export async function deleteUserVectors(userId: string): Promise<void> {
  const index = await getIndex(userId);
  await index.deleteIndex();
  indexCache.delete(userId);
  console.log(`[vectors] Deleted index for user: ${userId}`);
}

/**
 * Get stats about a user's vector index.
 */
export async function getNamespaceStats(userId: string): Promise<{ vectorCount: number }> {
  const index = await getIndex(userId);
  try {
    const stats = await index.getIndexStats();
    return { vectorCount: stats.items };
  } catch {
    return { vectorCount: 0 };
  }
}
