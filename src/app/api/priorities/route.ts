import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { prioritize } from '@/lib/prioritizer';

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!user) return apiError('User not found', 404);

    const items = await prioritize(user.id);
    return apiSuccess({ items: items.slice(0, 15) });
  } catch (error: any) {
    console.error('[priorities] Error:', error);
    return apiError('Failed to generate priorities', 500);
  }
}
