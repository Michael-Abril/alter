/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Gmail OAuth initiation — redirects user to Google's OAuth consent screen
 * DEPENDENCIES: @/lib/gmail, @clerk/nextjs
 * STATUS: Scaffold — needs real implementation
 */

import { auth } from '@clerk/nextjs/server';
import { getAuthUrl } from '@/lib/gmail';
import { apiError } from '@/lib/utils';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return apiError('Unauthorized', 401);
  }

  // TODO: Person 1 — Store userId in state param for callback verification
  const authUrl = getAuthUrl();
  return Response.redirect(authUrl);
}
