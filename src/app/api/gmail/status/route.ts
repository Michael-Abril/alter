/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: GET: check if user has Gmail connected
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE
 */

import { NextRequest } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    let user = await db.user.findUnique({
      where: { clerkId: userId },
      select: { gmailConnected: true },
    });

    if (!user) {
      // First-run fallback: create user record from Clerk so onboarding can continue.
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(userId);
      const primaryEmail =
        clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId)
          ?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

      if (!primaryEmail) {
        return apiError('Unable to resolve user email from Clerk profile', 400);
      }

      const created = await db.user.create({
        data: {
          clerkId: userId,
          email: primaryEmail,
          name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null,
        },
        select: { gmailConnected: true },
      });
      user = created;
    }

    return apiSuccess({
      connected: user.gmailConnected,
    });
  } catch (error) {
    console.error('[gmail/status] Error:', error);
    return apiError('Failed to check Gmail status', 500);
  }
}
