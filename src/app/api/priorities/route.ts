import { apiSuccess, apiError } from '@/lib/utils';
import { prioritize } from '@/lib/prioritizer';
import { tryAuthUser } from '@/lib/clerk-user';

export async function GET() {
  try {
    const authResult = await tryAuthUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const items = await prioritize(user.id);
    return apiSuccess({ items: items.slice(0, 15) });
  } catch (error: any) {
    console.error('[priorities] Error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to generate priorities',
      500
    );
  }
}
