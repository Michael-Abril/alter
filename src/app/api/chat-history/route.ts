/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: GET: return stored chat history for a user
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: Scaffold — returns mock data, needs real implementation
 */

import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';

// GET: Return stored chat history for the authenticated user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  // TODO: Person 3 (Royce) — Replace with real data from Prisma
  // const messages = await db.chatMessage.findMany({
  //   where: { user: { clerkId: userId } },
  //   orderBy: { timestamp: 'desc' },
  //   take: 100,
  // });

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

  return apiSuccess(mockMessages);
}
