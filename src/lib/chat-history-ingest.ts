/**
 * Shared ingest path for ChatMessage rows + onboarding fingerprints.
 */

import db from '@/lib/db';
import {
  buildMessageFingerprint,
  readFingerprints,
  writeFingerprints,
  syncSourceForIngest,
} from '@/lib/onboarding-sync';

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

  return {
    count: result.count,
    dedupedInPayload: dedupedMessages.length - netNewMessages.length,
  };
}
