/**
 * OWNER: Person 1 (Backend) + Person 3 (Orchestration)
 * PURPOSE: POST: send email via Gmail API with OAuth token handling
 * DEPENDENCIES: Prisma, @clerk/nextjs, googleapis
 * STATUS: LIVE — sends emails via Gmail API with token refresh
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { sendEmail, refreshAccessToken } from '@/lib/gmail';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { to, subject, body: emailBody, threadId, inReplyTo } = body;

    if (!to || !subject || !emailBody) {
      return apiError('Missing required fields: to, subject, body', 400);
    }

    // Find user with Gmail tokens
    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return apiError('User not found', 404);
    }

    if (!user.gmailToken || !user.gmailRefreshToken) {
      return apiError('Gmail not connected. Please connect your Gmail account first.', 403);
    }

    let accessToken = user.gmailToken;

    // Try sending with current access token
    try {
      const result = await sendEmail(accessToken, user.gmailRefreshToken, {
        to,
        subject,
        body: emailBody,
        threadId,
        inReplyTo,
      });

      console.log(`[gmail/send] Email sent successfully: ${result.messageId}`);

      return apiSuccess({
        messageId: result.messageId,
        to,
        subject,
        sentAt: new Date().toISOString(),
      });
    } catch (error: any) {
      // If token expired, try refreshing
      if (error.message?.includes('invalid_grant') || error.message?.includes('401')) {
        console.log('[gmail/send] Access token expired, refreshing...');
        
        try {
          accessToken = await refreshAccessToken(user.gmailRefreshToken);
          
          // Update user with new access token
          await db.user.update({
            where: { id: user.id },
            data: { gmailToken: accessToken },
          });

          // Retry sending with new token
          const result = await sendEmail(accessToken, user.gmailRefreshToken, {
            to,
            subject,
            body: emailBody,
            threadId,
            inReplyTo,
          });

          console.log(`[gmail/send] Email sent successfully after token refresh: ${result.messageId}`);

          return apiSuccess({
            messageId: result.messageId,
            to,
            subject,
            sentAt: new Date().toISOString(),
            tokenRefreshed: true,
          });
        } catch (refreshError: any) {
          console.error('[gmail/send] Token refresh failed:', refreshError);
          return apiError('Failed to refresh Gmail token. Please reconnect your Gmail account.', 401);
        }
      }

      // Other errors
      throw error;
    }
  } catch (error: any) {
    console.error('[gmail/send] Error:', error);
    return apiError(`Failed to send email: ${error.message}`, 500);
  }
}
