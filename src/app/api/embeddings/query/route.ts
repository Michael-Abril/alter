/**
 * OWNER: Person 2 (Vectors)
 * PURPOSE: POST: query vector DB for similar context — used by draft generation to retrieve relevant info
 * DEPENDENCIES: vectra, src/lib/embeddings, src/lib/pinecone
 * STATUS: LIVE — searches local vectra vector store
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { generateEmbedding, getEmbeddingBackend } from '@/lib/embeddings';
import { queryVectors, getNamespaceStats } from '@/lib/pinecone';
import db from '@/lib/db';

// POST: Query vector DB for similar context
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { query, topK = 5, filter } = body;

    if (!query) {
      return apiError('Missing required field: query', 400);
    }

    // Find the user's internal ID
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) {
      return apiError('User not found', 404);
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
    return apiError('Failed to query embeddings', 500);
  }
}
