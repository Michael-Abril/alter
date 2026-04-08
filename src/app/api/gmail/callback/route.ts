/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Gmail OAuth callback — validates state, exchanges code for tokens, stores in DB
 * DEPENDENCIES: Prisma, Gmail API, @clerk/nextjs
 * STATUS: LIVE — real OAuth callback with state validation and token storage
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { exchangeCodeForTokens } from '@/lib/gmail';
import { apiError } from '@/lib/utils';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return Response.redirect(new URL('/sign-in?redirect=/api/gmail/callback', req.url));
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
    return Response.redirect(new URL('/onboarding?step=gmail&gmail=error&reason=missing_state', req.url));
  }

  try {
    // Validate state contains our clerkId and is recent (within 10 minutes)
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    } catch (parseError) {
      console.error('[gmail/callback] Invalid state format:', parseError);
      return Response.redirect(new URL('/dashboard/settings?gmail=error&reason=invalid_state', req.url));
    }

    if (!stateData.clerkId || stateData.clerkId !== clerkId) {
      console.error('[gmail/callback] State clerkId mismatch:', { stateClerkId: stateData.clerkId, sessionClerkId: clerkId });
      return Response.redirect(new URL('/dashboard/settings?gmail=error&reason=state_mismatch', req.url));
    }

    const stateAge = Date.now() - (stateData.ts || 0);
    if (stateAge > 10 * 60 * 1000) { // 10 minutes
      console.error('[gmail/callback] State too old:', stateAge);
      return Response.redirect(new URL('/dashboard/settings?gmail=error&reason=state_expired', req.url));
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.access_token) {
      console.error('[gmail/callback] No access token in response');
      return Response.redirect(new URL('/dashboard/settings?gmail=error&reason=no_token', req.url));
    }

    // Store tokens in database
    await db.user.update({
      where: { clerkId },
      data: {
        gmailConnected: true,
        gmailToken: tokens.access_token,
        gmailRefreshToken: tokens.refresh_token || null,
      },
    });

    console.log(`[gmail/callback] Successfully connected Gmail for user ${clerkId}`);
    
    // Check if we came from onboarding (state contains onboarding flag)
    const redirectUrl = stateData.onboarding 
      ? '/onboarding?step=github&gmail=connected'
      : '/dashboard/settings?gmail=connected';
    
    return Response.redirect(new URL(redirectUrl, req.url));
  } catch (error) {
    console.error('[gmail/callback] Error exchanging code:', error);
    return Response.redirect(new URL('/dashboard/settings?gmail=error&reason=exchange_failed', req.url));
  }
}
