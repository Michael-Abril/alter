/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Internal API for vector queries - no auth required for server-side scripts
 * DEPENDENCIES: vectra, src/lib/embeddings, src/lib/pinecone
 * STATUS: LIVE — searches local vectra vector store by userId
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { generateEmbedding, getEmbeddingBackend } from '@/lib/embeddings';
import { queryVectors, getNamespaceStats } from '@/lib/pinecone';

// POST: Query vector DB for similar context (internal, no auth)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, query, topK = 5, filter } = body;

    if (!userId || !query) {
      return apiError('Missing required fields: userId, query', 400);
    }

    // Check if user has any vectors
    const stats = await getNamespaceStats(userId);
    if (stats.vectorCount === 0) {
      return apiSuccess({
        results: [],
        query,
        backend: getEmbeddingBackend(),
        message: 'No embeddings found for this user',
      });
    }

    console.log(`[internal/embeddings/query] Query: "${query.slice(0, 50)}...", topK: ${topK}, user: ${userId}`);

    // Generate embedding for the query
    const queryVector = await generateEmbedding(query);

    // Search the vector store
    const results = await queryVectors(userId, queryVector, topK, filter);

    return apiSuccess({
      results,
      query,
      topK,
      backend: getEmbeddingBackend(),
      vectorCount: stats.vectorCount,
    });
  } catch (error) {
    console.error('[internal/embeddings/query] Error:', error);
    return apiError('Failed to query embeddings', 500);
  }
}
