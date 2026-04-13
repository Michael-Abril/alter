/**
 * OWNER: Person 4 (Voice/UI) + Person 3 (Orchestration)
 * PURPOSE: GET/PATCH: view or approve/reject a specific draft
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE — real draft approval triggers Gmail send
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { tryAuthUser } from '@/lib/clerk-user';

// GET: View a specific draft
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  try {
    const authResult = await tryAuthUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const draft = await db.draft.findFirst({
      where: { id, userId: user.id },
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
      context: draft.context ? JSON.parse(draft.context) : null,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(`[drafts/${id}] Error:`, error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to fetch draft',
      500
    );
  }
}

// PATCH: Update draft status (approve/reject)
export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;

  try {
    const authResult = await tryAuthUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const body = await req.json();
    const { status, content, rejectionReason } = body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return apiError('Invalid status. Must be "approved" or "rejected"', 400);
    }

    const draft = await db.draft.findFirst({
      where: { id, userId: user.id },
    });

    if (!draft) return apiError('Draft not found', 404);

    // Handle rejection
    if (status === 'rejected') {
      const prevCtx = draft.context ? JSON.parse(draft.context) : {};
      await db.draft.update({
        where: { id },
        data: {
          status: 'rejected',
          context: rejectionReason
            ? JSON.stringify({ ...prevCtx, rejectionReason })
            : draft.context,
        },
      });

      await db.action.create({
        data: {
          userId: user.id,
          type: 'draft_rejected',
          title: `Rejected draft: ${draft.title}`,
          description: rejectionReason || 'User rejected this draft',
          app: draft.targetApp,
          confidence: draft.confidenceScore,
          status: 'completed',
          metadata: JSON.stringify({
            draftId: draft.id,
            draftType: draft.type,
            rejectionReason: rejectionReason || null,
            feedbackKind: 'rejected',
          }),
        },
      });

      console.log(`[drafts/${id}] Draft rejected${rejectionReason ? `: ${rejectionReason}` : ''}`);

      return apiSuccess({
        id,
        status: 'rejected',
        message: 'Draft rejected',
      });
    }

    // Handle approval
    if (status === 'approved') {
      // Non-email drafts: just approve
      if (draft.type !== 'email') {
        await db.draft.update({
          where: { id },
          data: {
            status: 'approved',
            content: content || draft.content,
          },
        });

        const finalContent = content ?? draft.content;
        const userEdited =
          typeof content === 'string' && content.trim() !== (draft.content || '').trim();
        await db.action.create({
          data: {
            userId: user.id,
            type: 'task_completed',
            title: `Approved ${draft.type}: ${draft.title}`,
            description: `User approved ${draft.type} draft`,
            app: draft.targetApp,
            confidence: draft.confidenceScore,
            status: 'completed',
            metadata: JSON.stringify({
              draftId: draft.id,
              draftType: draft.type,
              feedbackKind: 'approved',
              userEdited,
              voiceProfileFeedback: userEdited
                ? {
                    originalSnippet: (draft.content || '').slice(0, 4000),
                    approvedSnippet: finalContent.slice(0, 4000),
                  }
                : undefined,
            }),
          },
        });

        console.log(`[drafts/${id}] Non-email draft approved (type: ${draft.type})`);

        return apiSuccess({
          id,
          status: 'approved',
          message: `${draft.type} draft approved successfully`,
          type: draft.type,
        });
      }

      // Email drafts: create native Gmail draft (user can review in Gmail)
      const context = draft.context ? JSON.parse(draft.context) : {};
      const recipientEmail = context.recipientEmail;
      const threadId = context.threadId;
      const inReplyTo = context.inReplyTo;

      if (!recipientEmail) {
        return apiError('Draft context missing recipient email address', 400);
      }

      if (!user.gmailConnected || !user.gmailToken) {
        await db.draft.update({ where: { id }, data: { status: 'approved' } });
        return apiSuccess({
          id, status: 'approved',
          message: 'Draft approved but Gmail draft not created — connect Gmail in Settings.',
          errorCode: 'GMAIL_NOT_CONNECTED',
        });
      }

      try {
        const { createGmailDraft, refreshAccessToken } = await import('@/lib/gmail');
        let accessToken = user.gmailToken;

        let result;
        try {
          result = await createGmailDraft(accessToken, user.gmailRefreshToken, {
            to: recipientEmail,
            subject: draft.title,
            body: content || draft.content,
            threadId, inReplyTo,
          });
        } catch (err: any) {
          if (user.gmailRefreshToken && (err.message?.includes('401') || err.message?.includes('invalid_grant'))) {
            accessToken = await refreshAccessToken(user.gmailRefreshToken);
            await db.user.update({ where: { id: user.id }, data: { gmailToken: accessToken } });
            result = await createGmailDraft(accessToken, user.gmailRefreshToken, {
              to: recipientEmail, subject: draft.title,
              body: content || draft.content, threadId, inReplyTo,
            });
          } else { throw err; }
        }

        await db.draft.update({
          where: { id },
          data: {
            status: 'approved',
            context: JSON.stringify({
              ...context,
              gmailDraftId: result.draftId,
              gmailDraftUrl: result.draftUrl,
              approvedAt: new Date().toISOString(),
            }),
          },
        });

        const finalBody = content || draft.content;
        const userEditedEmail =
          typeof content === 'string' && content.trim() !== (draft.content || '').trim();
        await db.action.create({
          data: {
            userId: user.id,
            type: 'email_sent',
            title: draft.title,
            description: `Created Gmail draft for ${recipientEmail}`,
            app: 'gmail',
            confidence: draft.confidenceScore,
            status: 'completed',
            metadata: JSON.stringify({
              recipientEmail,
              subject: draft.title,
              gmailDraftId: result.draftId,
              gmailDraftUrl: result.draftUrl,
              draftId: draft.id,
              feedbackKind: 'approved',
              userEdited: userEditedEmail,
              voiceProfileFeedback: userEditedEmail
                ? {
                    originalSnippet: (draft.content || '').slice(0, 4000),
                    approvedSnippet: finalBody.slice(0, 4000),
                  }
                : undefined,
            }),
          },
        });

        return apiSuccess({
          id,
          status: 'approved',
          message: 'Gmail draft created — open it in Gmail to review and send.',
          gmailDraftUrl: result.draftUrl,
          recipientEmail,
        });
      } catch (sendError: any) {
        console.error(`[drafts/${id}] Gmail draft error:`, sendError);

        const errMsg = sendError.message || '';
        let errorCode = 'GMAIL_SEND_FAILED';
        let userMessage = `Draft approved but Gmail draft failed: ${errMsg}`;

        if (errMsg.includes('not been used in project') || errMsg.includes('is disabled')) {
          errorCode = 'GMAIL_API_NOT_ENABLED';
          userMessage = 'Draft approved but Gmail draft not created — enable Gmail API in Google Cloud Console.';
        }

        await db.draft.update({ where: { id }, data: { status: 'approved' } });
        return apiSuccess({ id, status: 'approved', message: userMessage, errorCode });
      }
    }

    return apiError('Invalid status', 400);
  } catch (error) {
    console.error(`[drafts/${id}] Error:`, error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to update draft',
      500
    );
  }
}
