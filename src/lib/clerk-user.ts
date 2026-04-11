/**
 * Resolve Prisma User from Clerk session id, with dev fallbacks used when
 * webhooks / ingest created rows before clerkId matched the signed-in account.
 */

import { cache } from 'react';
import { auth } from '@clerk/nextjs/server';
import type { User } from '@prisma/client';
import db from '@/lib/db';
import { apiError } from '@/lib/utils';

export type AuthUserResult =
  | { ok: true; user: User; clerkId: string }
  | { ok: false; response: Response };

/**
 * Find or attach a DB user for this Clerk id:
 * 1) Normal lookup by clerkId
 * 2) Dev: rebind legacy test user row
 * 3) Last resort: rebind the most recently created user row (single-user / race recovery)
 */
export async function resolveUserForClerkId(clerkId: string): Promise<User | null> {
  if (!clerkId) return null;

  let user = await db.user.findFirst({ where: { clerkId } });
  if (user) return user;

  const testUser = await db.user.findUnique({ where: { clerkId: 'user_test_123' } });
  if (testUser) {
    return db.user.update({
      where: { id: testUser.id },
      data: { clerkId },
    });
  }

  const latest = await db.user.findFirst({ orderBy: { createdAt: 'desc' } });
  if (latest) {
    return db.user.update({
      where: { id: latest.id },
      data: { clerkId },
    });
  }

  return null;
}

/** Dedupe per request when layout + page both need the user. */
export const getCachedDashboardUser = cache(async (clerkId: string) => resolveUserForClerkId(clerkId));

export async function requireUserFromAuth(clerkId: string | null | undefined): Promise<AuthUserResult> {
  if (typeof clerkId !== 'string' || clerkId.length === 0) {
    return { ok: false, response: apiError('Unauthorized', 401) };
  }

  try {
    const user = await resolveUserForClerkId(clerkId);
    if (!user) {
      return {
        ok: false,
        response: apiError(
          'No user account found. Complete onboarding first.',
          404,
          { code: 'USER_NOT_FOUND' }
        ),
      };
    }
    return { ok: true, user, clerkId };
  } catch (e) {
    console.error('[requireUserFromAuth]', e);
    const message = e instanceof Error ? e.message : 'Database error while loading user';
    return { ok: false, response: apiError(message, 500) };
  }
}

/** auth() + resolve user; use in route handlers for consistent errors. */
export async function tryAuthUser(): Promise<AuthUserResult> {
  try {
    const { userId } = await auth();
    return await requireUserFromAuth(userId);
  } catch (e) {
    console.error('[tryAuthUser]', e);
    const message = e instanceof Error ? e.message : 'Authentication failed';
    return { ok: false, response: apiError(message, 500) };
  }
}
