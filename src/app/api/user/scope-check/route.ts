import { apiSuccess } from '@/lib/utils';
import db from '@/lib/db';
import { CURRENT_SCOPES_VERSION, needsScopeUpgrade } from '@/lib/google-auth';
import { tryAuthUser } from '@/lib/clerk-user';

export async function GET() {
  const authResult = await tryAuthUser();
  if (!authResult.ok) return authResult.response;

  const user = await db.user.findUnique({
    where: { id: authResult.user.id },
    select: { googleScopesVersion: true, gmailConnected: true },
  });

  if (!user) {
    return apiSuccess({ needsUpgrade: false, connected: false });
  }

  return apiSuccess({
    connected: user.gmailConnected,
    currentVersion: user.googleScopesVersion,
    requiredVersion: CURRENT_SCOPES_VERSION,
    needsUpgrade: user.gmailConnected && needsScopeUpgrade(user.googleScopesVersion),
  });
}
