/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Internal API for fetching incoming emails without drafts
 * DEPENDENCIES: Prisma
 * STATUS: LIVE — returns received emails that need draft replies
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

// GET: Return incoming emails that don't have corresponding drafts yet
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return apiError('Missing userId parameter', 400);
    }

    const user = await db.user.findFirst({
      where: { OR: [{ id: userId }, { clerkId: userId }] },
      select: { id: true },
    });
    if (!user) {
      return apiSuccess({ emails: [], count: 0, totalReceived: 0 });
    }

    const internalUserId = user.id;

    // Get all received emails
    const receivedEmails = await db.email.findMany({
      where: {
        userId: internalUserId,
        direction: 'received',
      },
      orderBy: { receivedAt: 'desc' },
      take: 20, // Limit to most recent 20
    });

    // Get all drafts to check which emails already have drafts
    const drafts = await db.draft.findMany({
      where: {
        userId: internalUserId,
        type: 'email',
      },
      select: { context: true },
    });

    // Extract email subjects from draft contexts
    const draftedSubjects = new Set<string>();
    for (const draft of drafts) {
      try {
        const context = JSON.parse(draft.context || '{}');
        if (context.incomingSubject) {
          draftedSubjects.add(context.incomingSubject.toLowerCase());
        }
      } catch {
        // Skip invalid JSON
      }
    }

    // Filter out emails that already have drafts
    const undraftedEmails = receivedEmails.filter(email => {
      return !draftedSubjects.has(email.subject.toLowerCase());
    });

    return apiSuccess({
      emails: undraftedEmails,
      count: undraftedEmails.length,
      totalReceived: receivedEmails.length,
    });
  } catch (error) {
    console.error('[internal/emails/undrafted] Error:', error);
    return apiError('Failed to fetch undrafted emails', 500);
  }
}
