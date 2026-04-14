/**
 * Shared ingest path for ChatMessage rows + onboarding fingerprints.
 * Now includes automatic embedding generation for vector search.
 */

import db from '@/lib/db';
import {
  buildMessageFingerprint,
  readFingerprints,
  writeFingerprints,
  syncSourceForIngest,
} from '@/lib/onboarding-sync';
import { generateEmbeddings, prepareChatForEmbedding } from '@/lib/embeddings';
import { upsertVectors } from '@/lib/pinecone';

export interface IngestMessageInput {
  role: string;
  content: string;
  sessionId?: string;
  timestamp?: string;
}

export async function ingestChatMessages(params: {
  prismaUserId: string;
  clerkId: string;
  source: string;
  messages: IngestMessageInput[];
}): Promise<{ count: number; dedupedInPayload: number }> {
  const { prismaUserId, clerkId, source, messages } = params;

  const validMessages = messages.filter(
    (msg) => msg.role && msg.content && msg.content.trim().length > 0
  );

  const dedupedMessages: IngestMessageInput[] = [];
  const seen = new Set<string>();
  for (const msg of validMessages) {
    const ts = msg.timestamp || '';
    const key = `${msg.role}|${msg.sessionId || ''}|${ts}|${msg.content.slice(0, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedMessages.push(msg);
  }

  if (dedupedMessages.length === 0) {
    return { count: 0, dedupedInPayload: validMessages.length - dedupedMessages.length };
  }

  const syncSource = syncSourceForIngest(source);
  const storedFingerprints = readFingerprints(clerkId, syncSource);
  const netNewMessages = dedupedMessages.filter((msg) => {
    const fp = buildMessageFingerprint({
      source,
      role: msg.role,
      content: msg.content,
      sessionId: msg.sessionId,
      timestamp: msg.timestamp,
    });
    if (storedFingerprints.has(fp)) return false;
    storedFingerprints.add(fp);
    return true;
  });

  if (netNewMessages.length === 0) {
    return { count: 0, dedupedInPayload: dedupedMessages.length };
  }

  const result = await db.chatMessage.createMany({
    data: netNewMessages.map((msg) => ({
      userId: prismaUserId,
      source,
      role: msg.role,
      content: msg.content,
      sessionId: msg.sessionId || null,
      timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
    })),
  });

  writeFingerprints(clerkId, syncSource, storedFingerprints);

  // Auto-embed new messages for vector search (runs in background, non-blocking)
  if (result.count > 0) {
    embedNewMessagesBackground(prismaUserId, source, netNewMessages).catch((err) => {
      console.warn(`[chat-ingest] Background embedding failed: ${err.message}`);
    });
  }

  return {
    count: result.count,
    dedupedInPayload: dedupedMessages.length - netNewMessages.length,
  };
}

/**
 * Embed new messages into vector store (runs in background).
 * This enables context retrieval for Alter's overnight work.
 */
async function embedNewMessagesBackground(
  userId: string,
  source: string,
  messages: IngestMessageInput[]
): Promise<void> {
  console.log(`[chat-ingest] Embedding ${messages.length} new messages for user ${userId}...`);

  try {
    // Prepare messages for embedding
    const allChunks: { text: string; metadata: Record<string, string>; id: string }[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const msgId = `${source}-${msg.sessionId || 'nosession'}-${i}-${Date.now()}`;
      const prepared = prepareChatForEmbedding({
        id: msgId,
        content: msg.content,
        source,
        role: msg.role,
        sessionId: msg.sessionId || null,
        timestamp: msg.timestamp || new Date().toISOString(),
      });

      for (const chunk of prepared) {
        allChunks.push({
          id: `${msgId}-chunk-${chunk.metadata.chunkIndex}`,
          text: chunk.text,
          metadata: { ...chunk.metadata, content: chunk.text },
        });
      }
    }

    if (allChunks.length === 0) return;

    // Generate embeddings in batch
    const texts = allChunks.map((c) => c.text);
    const embeddings = await generateEmbeddings(texts);

    // Prepare vectors for upsert
    const vectors = embeddings.map((emb) => ({
      id: allChunks[emb.index].id,
      values: emb.embedding,
      metadata: allChunks[emb.index].metadata,
    }));

    // Upsert to vector store
    await upsertVectors(userId, vectors);

    console.log(`[chat-ingest] ✅ Embedded ${vectors.length} chunks for user ${userId}`);
  } catch (err) {
    console.error(`[chat-ingest] Embedding error:`, err);
    // Don't throw - this is background work, shouldn't block message sync
  }
}
