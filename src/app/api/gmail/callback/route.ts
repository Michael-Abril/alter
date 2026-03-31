/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Gmail OAuth callback — exchanges auth code for tokens, stores in DB
 * DEPENDENCIES: Prisma, Gmail API, @clerk/nextjs
 * STATUS: Scaffold — needs real implementation
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { exchangeCodeForTokens } from '@/lib/gmail';
import { apiError } from '@/lib/utils';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return apiError('Unauthorized', 401);
  }

  const code = req.nextUrl.searchParams.get('code');
  if (!code) {
    return apiError('Missing authorization code', 400);
  }

  try {
    // TODO: Person 1 — Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // TODO: Person 1 — Encrypt tokens before storing
    await db.user.update({
      where: { clerkId },
      data: {
        gmailConnected: true,
        gmailToken: tokens.access_token || null,
        gmailRefreshToken: tokens.refresh_token || null,
      },
    });

    // Redirect to settings with success message
    return Response.redirect(new URL('/dashboard/settings?gmail=connected', req.url));
  } catch (error) {
    console.error('[gmail/callback] Error exchanging code:', error);
    return Response.redirect(new URL('/dashboard/settings?gmail=error', req.url));
  }
}
