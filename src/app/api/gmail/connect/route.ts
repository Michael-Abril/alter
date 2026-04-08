/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Gmail connect — fetches Google OAuth token from Clerk (no separate OAuth flow needed)
 * DEPENDENCIES: @clerk/nextjs/server, Prisma
 * STATUS: LIVE — uses Clerk's stored Google token, no GMAIL_CLIENT_ID required
 */

import { auth, clerkClient } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

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
