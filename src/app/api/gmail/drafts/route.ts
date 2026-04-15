import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { createGmailDraft, refreshAccessToken } from '@/lib/gmail';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const webhookSecret = req.headers.get('x-openclaw-secret');
  const expectedSecret = process.env.OPENCLAW_WEBHOOK_SECRET;
  const hasWebhookAuth = Boolean(expectedSecret && webhookSecret === expectedSecret);
  if (!userId && !hasWebhookAuth) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { to, subject, body: emailBody, threadId, inReplyTo, userId: bodyUserId } = body;

    if (!to || !subject || !emailBody) {
      return apiError('Missing required fields: to, subject, body', 400);
    }

    const user = userId
      ? await db.user.findUnique({ where: { clerkId: userId } })
      : bodyUserId
      ? await db.user.findFirst({
          where: { OR: [{ id: bodyUserId }, { clerkId: bodyUserId }] },
        })
      : null;
    if (!user) return apiError('User not found', 404);

    if (!user.gmailToken) {
      return apiError('Gmail not connected', 403);
    }

    try {
      const result = await createGmailDraft(user.gmailToken, user.gmailRefreshToken, {
        to, subject, body: emailBody, threadId, inReplyTo,
      });
      return apiSuccess(result);
    } catch (error: any) {
      if (user.gmailRefreshToken && (error.message?.includes('401') || error.message?.includes('invalid_grant'))) {
        const newToken = await refreshAccessToken(user.gmailRefreshToken);
        await db.user.update({ where: { id: user.id }, data: { gmailToken: newToken } });
        const result = await createGmailDraft(newToken, user.gmailRefreshToken, {
          to, subject, body: emailBody, threadId, inReplyTo,
        });
        return apiSuccess(result);
      }
      throw error;
    }
  } catch (error: any) {
    console.error('[gmail/drafts] Error:', error);
    return apiError(`Failed to create Gmail draft: ${error.message}`, 500);
  }
}
