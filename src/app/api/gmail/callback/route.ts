/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Gmail OAuth callback — validates state, exchanges code for tokens, stores in DB
 * DEPENDENCIES: Prisma, Gmail API, @clerk/nextjs
 * STATUS: LIVE — real OAuth callback with state validation and token storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { exchangeCodeForTokens } from '@/lib/gmail';
import { apiError } from '@/lib/utils';
import db from '@/lib/db';

function redirectWithContext(
  req: NextRequest,
  path: string,
  clearOnboardingCookie = true
) {
  const response = NextResponse.redirect(new URL(path, req.url));
  if (clearOnboardingCookie) {
    response.cookies.delete('ns_gmail_onboarding');
  }
  return response;
}

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return redirectWithContext(req, '/sign-in?redirect=/api/gmail/callback');
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const error = req.nextUrl.searchParams.get('error');

  // Handle OAuth errors from Google
  if (error) {
    console.error('[gmail/callback] OAuth error:', error);
    return Response.redirect(new URL('/onboarding?step=gmail&gmail=error&reason=' + encodeURIComponent(error), req.url));
  }

  if (!code) {
    console.error('[gmail/callback] Missing authorization code');
    return Response.redirect(new URL('/onboarding?step=gmail&gmail=error&reason=missing_code', req.url));
  }

  if (!state) {
    console.error('[gmail/callback] Missing state parameter');
    return redirectWithContext(req, '/onboarding?step=gmail&gmail=error&reason=missing_state');
  }

  try {
    const onboardingFromCookie = req.cookies.get('ns_gmail_onboarding')?.value === '1';

    // Validate state contains our clerkId and is recent (within 10 minutes)
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch (parseError) {
      console.error('[gmail/callback] Invalid state format:', parseError);
      const errorPath = onboardingFromCookie
        ? '/onboarding?step=gmail&gmail=error&reason=invalid_state'
        : '/dashboard/settings?gmail=error&reason=invalid_state';
      return redirectWithContext(req, errorPath);
    }

    const fromOnboarding = Boolean(stateData.onboarding) || onboardingFromCookie;

    if (!stateData.clerkId || stateData.clerkId !== clerkId) {
      console.error('[gmail/callback] State clerkId mismatch:', { stateClerkId: stateData.clerkId, sessionClerkId: clerkId });
      const errorPath = fromOnboarding
        ? '/onboarding?step=gmail&gmail=error&reason=state_mismatch'
        : '/dashboard/settings?gmail=error&reason=state_mismatch';
      return redirectWithContext(req, errorPath);
    }

    const stateAge = Date.now() - (stateData.ts || 0);
    if (stateAge > 10 * 60 * 1000) { // 10 minutes
      console.error('[gmail/callback] State too old:', stateAge);
      const errorPath = fromOnboarding
        ? '/onboarding?step=gmail&gmail=error&reason=state_expired'
        : '/dashboard/settings?gmail=error&reason=state_expired';
      return redirectWithContext(req, errorPath);
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.access_token) {
      console.error('[gmail/callback] No access token in response');
      const errorPath = fromOnboarding
        ? '/onboarding?step=gmail&gmail=error&reason=no_token'
        : '/dashboard/settings?gmail=error&reason=no_token';
      return redirectWithContext(req, errorPath);
    }

    // Ensure DB user exists for first-run accounts before writing tokens.
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(clerkId);
    const primaryEmail =
      clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId)
        ?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

    if (!primaryEmail) {
      const errorPath = fromOnboarding
        ? '/onboarding?step=gmail&gmail=error&reason=missing_email'
        : '/dashboard/settings?gmail=error&reason=missing_email';
      return redirectWithContext(req, errorPath);
    }

    const scopesVersion = stateData.scopesVersion || 1;

    await db.user.upsert({
      where: { clerkId },
      create: {
        clerkId,
        email: primaryEmail,
        name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null,
        gmailConnected: true,
        gmailToken: tokens.access_token,
        gmailRefreshToken: tokens.refresh_token || null,
        googleScopesVersion: scopesVersion,
      },
      update: {
        email: primaryEmail,
        gmailConnected: true,
        gmailToken: tokens.access_token,
        gmailRefreshToken: tokens.refresh_token || null,
        googleScopesVersion: scopesVersion,
      },
    });

    console.log(`[gmail/callback] Successfully connected Gmail for user ${clerkId}`);
    
    // Check if we came from onboarding (state contains onboarding flag)
    const redirectUrl = fromOnboarding
      ? '/onboarding?step=github&gmail=connected'
      : '/dashboard/settings?gmail=connected';
    
    return redirectWithContext(req, redirectUrl);
  } catch (error) {
    console.error('[gmail/callback] Error exchanging code:', error);
    const onboardingFromCookie = req.cookies.get('ns_gmail_onboarding')?.value === '1';
    const errorPath = onboardingFromCookie
      ? '/onboarding?step=gmail&gmail=error&reason=exchange_failed'
      : '/dashboard/settings?gmail=error&reason=exchange_failed';
    return redirectWithContext(req, errorPath);
  }
}
