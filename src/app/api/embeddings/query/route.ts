/**
 * OWNER: Person 2 (Vectors)
 * PURPOSE: POST: query vector DB for similar context — used by draft generation to retrieve relevant info
 * DEPENDENCIES: vectra, src/lib/embeddings, src/lib/pinecone
 * STATUS: LIVE — searches local vectra vector store
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { generateEmbedding, getEmbeddingBackend } from '@/lib/embeddings';
import { queryVectors, getNamespaceStats } from '@/lib/pinecone';
import { tryAuthUser } from '@/lib/clerk-user';

// POST: Query vector DB for similar context
export async function POST(req: NextRequest) {
  try {
    const authResult = await tryAuthUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const body = await req.json();
    const { query, topK = 5, filter } = body;

    if (!query) {
      return apiError('Missing required field: query', 400);
    }

    // Check if user has any vectors
    const stats = await getNamespaceStats(user.id);
    if (stats.vectorCount === 0) {
      return apiSuccess({
        results: [],
        query,
        backend: getEmbeddingBackend(),
        message: 'No embeddings found. Run the embed script first: npx tsx scripts/embed-chat-history.ts',
      });
    }

    console.log(`[embeddings/query] Query: "${query}", topK: ${topK}, user: ${user.id}, backend: ${getEmbeddingBackend()}`);

    // Generate embedding for the query
    const queryVector = await generateEmbedding(query);

    // Search the vector store
    const results = await queryVectors(user.id, queryVector, topK, filter);

    return apiSuccess({
      results,
      query,
      topK,
      backend: getEmbeddingBackend(),
      vectorCount: stats.vectorCount,
    });
  } catch (error) {
    console.error('[embeddings/query] Error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to query embeddings',
      500
    );
  }
}
