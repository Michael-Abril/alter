/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: GET: fetch stored emails, POST: trigger email pull from Gmail
 * DEPENDENCIES: Prisma, Gmail API, @clerk/nextjs
 * STATUS: Scaffold — returns mock data, needs real implementation
 */

import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';

// GET: Return stored emails for the authenticated user
export async function GET() {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  // TODO: Person 1 — Fetch real emails from Prisma
  // const emails = await db.email.findMany({ where: { user: { clerkId: userId } }, orderBy: { receivedAt: 'desc' }, take: 50 });
  const mockEmails = [
    {
      id: 'email_1',
      gmailId: 'msg_abc123',
      threadId: 'thread_1',
      from: 'you@example.com',
      to: 'sarah@company.com',
      subject: 'Re: Q2 Marketing Timeline',
      body: 'Hey Sarah, confirming our Tuesday meeting. I\'ll have the updated timeline ready by then. Best, User',
      direction: 'sent',
      isRead: true,
      receivedAt: new Date(Date.now() - 86400000).toISOString(),
      embedded: true,
    },
    {
      id: 'email_2',
      gmailId: 'msg_def456',
      threadId: 'thread_2',
      from: 'mike@engineering.com',
      to: 'you@example.com',
      subject: 'API Specs Request',
      body: 'Hey, can you send over the technical specification summary when you get a chance? Need it for the review.',
      direction: 'received',
      isRead: true,
      receivedAt: new Date(Date.now() - 172800000).toISOString(),
      embedded: true,
    },
  ];

  return apiSuccess(mockEmails);
}

// POST: Trigger a fresh email pull from Gmail
export async function POST() {
  const { userId } = auth();
  if (!userId) return apiError('Unauthorized', 401);

  // TODO: Person 1 — Fetch user's Gmail tokens from DB, call fetchSentEmails,
  // store new emails in DB, return count of new emails
  // const user = await db.user.findUnique({ where: { clerkId: userId } });
  // if (!user?.gmailConnected) return apiError('Gmail not connected', 400);
  // const emails = await fetchSentEmails(user.gmailToken, user.gmailRefreshToken);

  return apiSuccess({ message: 'Email pull triggered', newEmails: 0 });
}
