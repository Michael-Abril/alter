/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Gmail OAuth initiation — redirects user to Google's OAuth consent screen
 * DEPENDENCIES: @/lib/gmail, @clerk/nextjs
 * STATUS: LIVE — real OAuth flow with state param
 */

import { auth } from '@clerk/nextjs/server';
import { getAuthUrl } from '@/lib/gmail';
import { apiError } from '@/lib/utils';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return apiError('Unauthorized', 401);
  }

  // Generate auth URL with Clerk userId encoded in state for CSRF protection
  const authUrl = getAuthUrl(userId);
  return Response.redirect(authUrl);
}
