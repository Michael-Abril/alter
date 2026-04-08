/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: POST — create a Google Doc in the user's NightShift Drive folder
 * DEPENDENCIES: @clerk/nextjs, Prisma, @/lib/google-drive
 * STATUS: LIVE
 */

import { auth } from '@clerk/nextjs/server';
import db from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { createGoogleDoc } from '@/lib/google-drive';

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const { title, content, projectId } = await req.json();

    if (!title || !content) {
      return apiError('Missing required fields: title, content', 400);
    }

    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return apiError('User not found', 404);

    const result = await createGoogleDoc(user.id, title, content);

    await db.driveDocument.create({
      data: {
        userId: user.id,
        driveId: result.docId,
        title,
        url: result.docUrl,
        projectId: projectId ?? null,
      },
    });

    return apiSuccess({
      docId: result.docId,
      docUrl: result.docUrl,
      title: result.title,
    });
  } catch (error) {
    console.error('[drive/create-doc] Error:', error);
    return apiError('Failed to create Google Doc', 500);
  }
}
