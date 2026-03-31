/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Sync Gmail emails — pull last 200 sent emails and store in Email table
 * DEPENDENCIES: Prisma, Gmail API, @clerk/nextjs
 * STATUS: LIVE — pulls and stores emails with deduplication
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchSentEmails, refreshAccessToken } from '@/lib/gmail';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

// POST: Trigger email sync from Gmail
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    // Get user's Gmail tokens
    const user = await db.user.findUnique({
      where: { clerkId },
      select: {
        id: true,
        gmailConnected: true,
        gmailToken: true,
        gmailRefreshToken: true,
      },
    });

    if (!user || !user.gmailConnected || !user.gmailToken) {
      return apiError('Gmail not connected', 400);
    }

    console.log(`[gmail/sync] Starting sync for user ${user.id}`);

    // Try to fetch emails, refreshing token if needed
    let emails;
    try {
      emails = await fetchSentEmails(user.gmailToken, user.gmailRefreshToken, 200);
    } catch (fetchError: any) {
      // If it's an auth error, try refreshing the token
      if (fetchError.code === 401 || fetchError.message?.includes('401')) {
        if (!user.gmailRefreshToken) {
          return apiError('Gmail token expired and no refresh token available', 401);
        }

        console.log('[gmail/sync] Refreshing access token');
        const newAccessToken = await refreshAccessToken(user.gmailRefreshToken);

        // Update stored access token
        await db.user.update({
          where: { id: user.id },
          data: { gmailToken: newAccessToken },
        });

        // Retry fetch with new token
        emails = await fetchSentEmails(newAccessToken, user.gmailRefreshToken, 200);
      } else {
        throw fetchError;
      }
    }

    console.log(`[gmail/sync] Fetched ${emails.length} emails from Gmail`);

    // Store emails in database with deduplication
    let newEmails = 0;
    let skippedEmails = 0;

    for (const email of emails) {
      // Check if email already exists
      const existing = await db.email.findUnique({
        where: { gmailId: email.gmailId },
      });

      if (existing) {
        skippedEmails++;
        continue;
      }

      // Store new email
      await db.email.create({
        data: {
          userId: user.id,
          gmailId: email.gmailId,
          threadId: email.threadId,
          from: email.from,
          to: email.to,
          subject: email.subject,
          body: email.body,
          direction: email.direction,
          isRead: true, // Sent emails are always read
          receivedAt: email.receivedAt,
        },
      });

      newEmails++;
    }

    console.log(`[gmail/sync] Sync complete: ${newEmails} new, ${skippedEmails} skipped`);

    return apiSuccess({
      message: 'Email sync completed',
      totalFetched: emails.length,
      newEmails,
      skippedEmails,
    });
  } catch (error) {
    console.error('[gmail/sync] Error:', error);
    return apiError('Failed to sync emails', 500);
  }
}
