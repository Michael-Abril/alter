import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!user) return apiError('User not found', 404);

    const docs = await db.driveDocument.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return apiSuccess(docs);
  } catch (error: any) {
    console.error('[drive/files] Error:', error);
    return apiError('Failed to fetch drive documents', 500);
  }
}
