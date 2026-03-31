/**
 * OWNER: Person 2 (Vectors)
 * PURPOSE: POST: query vector DB for similar context — used by draft generation to retrieve relevant info
 * DEPENDENCIES: Pinecone, OpenAI embeddings
 * STATUS: Scaffold — returns mock data, needs real implementation
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';

// POST: Query vector DB for similar context
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { query, topK = 10, filter } = body;

    if (!query) {
      return apiError('Missing required field: query', 400);
    }

    // TODO: Person 2 — Implement real vector query:
    // 1. Generate embedding for the query using generateEmbedding() from @/lib/embeddings
    // 2. Query Pinecone using queryVectors() from @/lib/pinecone
    // 3. Return results with metadata

    console.log(`[embeddings/query] Query: "${query}", topK: ${topK}, filter:`, filter);

    // Mock response with realistic results
    const mockResults = [
      {
        id: 'vec_1',
        score: 0.94,
        content: 'Re: Q2 Marketing Timeline — Hey Sarah, confirming our Tuesday meeting. I\'ll have the updated timeline ready by then.',
        metadata: {
          source: 'email',
          type: 'sent',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
        },
      },
      {
        id: 'vec_2',
        score: 0.87,
        content: 'The Fanzley proposal needs sections on pricing, timeline, and terms. Use the rates from Q1 as a baseline.',
        metadata: {
          source: 'claude',
          type: 'chat',
          timestamp: new Date(Date.now() - 172800000).toISOString(),
        },
      },
      {
        id: 'vec_3',
        score: 0.82,
        content: 'Project timeline has been updated. New launch date is March 22 instead of March 15.',
        metadata: {
          source: 'email',
          type: 'sent',
          timestamp: new Date(Date.now() - 259200000).toISOString(),
        },
      },
    ];

    return apiSuccess(mockResults);
  } catch (error) {
    console.error('[embeddings/query] Error:', error);
    return apiError('Failed to query embeddings', 500);
  }
}
