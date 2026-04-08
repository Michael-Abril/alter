import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { CURRENT_SCOPES_VERSION, needsScopeUpgrade } from '@/lib/google-auth';

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  const user = await db.user.findUnique({
    where: { clerkId },
    select: { googleScopesVersion: true, gmailConnected: true },
  });

  if (!user) return apiSuccess({ needsUpgrade: false, connected: false });

  return apiSuccess({
    connected: user.gmailConnected,
    currentVersion: user.googleScopesVersion,
    requiredVersion: CURRENT_SCOPES_VERSION,
    needsUpgrade: user.gmailConnected && needsScopeUpgrade(user.googleScopesVersion),
  });
}
