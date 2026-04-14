/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: GET: return stored chat history for a user
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE — returns real data from DB, falls back to mock when empty
 */

import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

// GET: Return stored chat history for the authenticated user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    // Query real data from the database
    const messages = await db.chatMessage.findMany({
      where: { user: { clerkId: userId } },
      orderBy: { timestamp: 'desc' },
      take: 100,
      select: {
        id: true,
        source: true,
        role: true,
        content: true,
        sessionId: true,
        timestamp: true,
        embedded: true,
      },
    });

    // If we have real data, return it
    if (messages.length > 0) {
      return apiSuccess({
        messages,
        count: messages.length,
        source: 'database',
      });
    }

    // Fall back to mock data when database is empty for this user
    const mockMessages = [
      {
        id: 'chat_1',
        source: 'claude',
        role: 'user',
        content: 'Can you help me draft an email to the Fanzley team about the proposal timeline?',
        sessionId: 'session_abc',
        timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
        embedded: true,
      },
      {
        id: 'chat_2',
        source: 'claude',
        role: 'assistant',
        content: 'Of course! Here\'s a draft email for the Fanzley team regarding the proposal timeline...',
        sessionId: 'session_abc',
        timestamp: new Date(Date.now() - 3600000 * 8 + 60000).toISOString(),
        embedded: true,
      },
      {
        id: 'chat_3',
        source: 'chatgpt',
        role: 'user',
        content: 'Write me a Python script to parse CSV files and generate a summary report',
        sessionId: 'session_def',
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        embedded: true,
      },
    ];

    return apiSuccess({
      messages: mockMessages,
      count: mockMessages.length,
      source: 'mock',
    });
  } catch (error) {
    console.error('[chat-history] Error:', error);
    return apiError('Failed to fetch chat history', 500);
  }
}
