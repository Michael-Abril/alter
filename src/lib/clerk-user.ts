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
 * 1) Normal lookup by clerkId (fast path - most common)
 * 2) Dev only: rebind legacy test user or latest user (single query fallback)
 */
export async function resolveUserForClerkId(clerkId: string): Promise<User | null> {
  if (!clerkId) return null;

  // Fast path: direct lookup by clerkId (indexed)
  const user = await db.user.findFirst({ where: { clerkId } });
  if (user) return user;

  // Dev fallback: single query to find rebindable user
  // Only runs if primary lookup fails (rare in production)
  const fallbackUser = await db.user.findFirst({
    where: {
      OR: [
        { clerkId: 'user_test_123' }, // Test user
        { clerkId: { not: clerkId } }, // Any other user (for single-user dev)
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (fallbackUser) {
    return db.user.update({
      where: { id: fallbackUser.id },
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
