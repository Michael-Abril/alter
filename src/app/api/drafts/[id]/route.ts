/**
 * OWNER: Person 4 (Voice/UI) + Person 3 (Orchestration)
 * PURPOSE: GET/PATCH: view or approve/reject a specific draft
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE — real draft approval triggers Gmail send
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

// GET: View a specific draft
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({ where: { clerkId: userId } });
    if (!user) return apiError('User not found', 404);

    const draft = await db.draft.findFirst({
      where: { id: params.id, userId: user.id },
    });

    if (!draft) return apiError('Draft not found', 404);

    return apiSuccess({
      id: draft.id,
      type: draft.type,
      title: draft.title,
      content: draft.content,
      targetApp: draft.targetApp,
      confidenceScore: draft.confidenceScore,
      status: draft.status,
      context: draft.context,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(`[drafts/${params.id}] Error:`, error);
    return apiError('Failed to fetch draft', 500);
  }
}

// PATCH: Update draft status (approve/reject)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { status, content, rejectionReason } = body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return apiError('Invalid status. Must be "approved" or "rejected"', 400);
    }

    // Find user and draft
    const user = await db.user.findUnique({ where: { clerkId: userId } });
    if (!user) return apiError('User not found', 404);

    const draft = await db.draft.findFirst({
      where: { id: params.id, userId: user.id },
    });

    if (!draft) return apiError('Draft not found', 404);

    // Handle rejection
    if (status === 'rejected') {
      await db.draft.update({
        where: { id: params.id },
        data: {
          status: 'rejected',
          context: rejectionReason
            ? JSON.stringify({ ...JSON.parse(draft.context || '{}'), rejectionReason })
            : draft.context,
        },
      });

      console.log(`[drafts/${params.id}] Draft rejected${rejectionReason ? `: ${rejectionReason}` : ''}`);

      return apiSuccess({
        id: params.id,
        status: 'rejected',
        message: 'Draft rejected',
      });
    }

    // Handle approval - trigger send flow
    if (status === 'approved') {
      // Parse context to get recipient info
      const context = draft.context ? JSON.parse(draft.context) : {};
      const recipientEmail = context.recipientEmail;
      const threadId = context.threadId;
      const inReplyTo = context.inReplyTo;

      if (!recipientEmail) {
        return apiError('Draft context missing recipient email address', 400);
      }

      // Call Gmail send endpoint
      try {
        const sendResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/gmail/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': req.headers.get('cookie') || '', // Forward auth cookies
          },
          body: JSON.stringify({
            to: recipientEmail,
            subject: draft.title,
            body: content || draft.content,
            threadId,
            inReplyTo,
          }),
        });

        const sendResult = await sendResponse.json();

        if (!sendResponse.ok) {
          console.error(`[drafts/${params.id}] Gmail send failed:`, sendResult);
          return apiError(`Failed to send email: ${sendResult.error || 'Unknown error'}`, 500);
        }

        // Update draft status to sent
        await db.draft.update({
          where: { id: params.id },
          data: {
            status: 'sent',
            context: JSON.stringify({
              ...context,
              sentAt: new Date().toISOString(),
              messageId: sendResult.data?.messageId,
            }),
          },
        });

        // Create Action record
        await db.action.create({
          data: {
            userId: user.id,
            type: 'email_sent',
            title: draft.title,
            description: `Sent email to ${recipientEmail}`,
            app: 'gmail',
            confidence: draft.confidenceScore,
            status: 'completed',
            metadata: JSON.stringify({
              recipientEmail,
              subject: draft.title,
              messageId: sendResult.data?.messageId,
              draftId: draft.id,
            }),
          },
        });

        console.log(`[drafts/${params.id}] Email sent successfully to ${recipientEmail}`);

        return apiSuccess({
          id: params.id,
          status: 'sent',
          message: 'Email sent successfully',
          messageId: sendResult.data?.messageId,
          recipientEmail,
        });
      } catch (sendError: any) {
        console.error(`[drafts/${params.id}] Send error:`, sendError);
        return apiError(`Failed to send email: ${sendError.message}`, 500);
      }
    }

    return apiError('Invalid status', 400);
  } catch (error) {
    console.error(`[drafts/${params.id}] Error:`, error);
    return apiError('Failed to update draft', 500);
  }
}
