/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Gmail OAuth initiation — redirects user to Google's OAuth consent screen
 * DEPENDENCIES: @/lib/gmail, @clerk/nextjs
 * STATUS: LIVE — real OAuth flow with state param
 */

import { NextRequest } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getAuthUrl } from '@/lib/gmail';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

// GET: Redirect to Google OAuth (for onboarding flow)
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return apiError('Unauthorized', 401);
  }

  // Check if this is from onboarding
  const onboarding = req.nextUrl.searchParams.get('onboarding') === 'true';

  // Generate auth URL with Clerk userId encoded in state for CSRF protection
  const authUrl = getAuthUrl(userId, onboarding);
  return Response.redirect(authUrl);
}

// POST: Use Clerk's stored Google token (alternative method)
export async function POST() {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const clerk = await clerkClient();
    const tokenResponse = await clerk.users.getUserOauthAccessToken(userId, 'google');
    const token = tokenResponse.data?.[0];

    if (!token?.token) {
      return apiError(
        'No Google token found. Make sure you signed in with Google and that Gmail scopes are enabled in Clerk dashboard.',
        400
      );
    }

    await db.user.update({
      where: { clerkId: userId },
      data: {
        gmailConnected: true,
        gmailToken: token.token,
        gmailRefreshToken: null, // Clerk manages refresh internally
      },
    });

    console.log(`[gmail/connect] Connected Gmail for user ${userId} via Clerk token`);
    return apiSuccess({ connected: true });
  } catch (error: any) {
    console.error('[gmail/connect] Error:', error);
    return apiError(`Failed to connect Gmail: ${error.message}`, 500);
  }
}
