/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Gmail OAuth initiation — redirects user to Google's OAuth consent screen
 * DEPENDENCIES: @/lib/gmail, @clerk/nextjs
 * STATUS: LIVE — real OAuth flow with state param
 */

import { NextRequest, NextResponse } from 'next/server';
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
  const response = NextResponse.redirect(authUrl);

  // Preserve onboarding context through OAuth round-trip as a fallback.
  if (onboarding) {
    response.cookies.set('ns_gmail_onboarding', '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60, // 10 minutes
      path: '/',
    });
  }

  return response;
}

// POST: Use Clerk's stored Google token (alternative method)
export async function POST() {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    const primaryEmail =
      clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId)
        ?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

    if (!primaryEmail) {
      return apiError('Unable to resolve user email from Clerk profile', 400);
    }

    const tokenResponse = await clerk.users.getUserOauthAccessToken(userId, 'google');
    const token = tokenResponse.data?.[0];

    if (!token?.token) {
      return apiError(
        'No Google token found. Make sure you signed in with Google and that Gmail scopes are enabled in Clerk dashboard.',
        400
      );
    }

    await db.user.upsert({
      where: { clerkId: userId },
      create: {
        clerkId: userId,
        email: primaryEmail,
        name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null,
        gmailConnected: true,
        gmailToken: token.token,
        gmailRefreshToken: null,
      },
      update: {
        email: primaryEmail,
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

// DELETE: Disconnect Gmail account
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({ where: { clerkId: userId } });
    if (!user) return apiError('User not found', 404);

    await db.user.update({
      where: { id: user.id },
      data: {
        gmailConnected: false,
        gmailToken: null,
        gmailRefreshToken: null,
      },
    });

    console.log(`[gmail/connect] Disconnected Gmail for user ${userId}`);
    return apiSuccess({ connected: false, message: 'Gmail disconnected' });
  } catch (error: any) {
    console.error('[gmail/connect] Disconnect error:', error);
    return apiError(`Failed to disconnect Gmail: ${error.message}`, 500);
  }
}
