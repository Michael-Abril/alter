import { PrismaClient } from '@prisma/client';

const DEFAULT_CLERK_ID = 'user_3Bge5cdx4LkgxWgYXeYlU6Tm42a';

/**
 * Resolve a user identifier into the internal DB user id.
 * Accepts either internal user id or Clerk id.
 */
export async function resolveInternalUserId(userIdentifier, options = {}) {
  const db = new PrismaClient();
  try {
    if (userIdentifier) {
      const byEither = await db.user.findFirst({
        where: {
          OR: [{ id: userIdentifier }, { clerkId: userIdentifier }],
        },
        select: { id: true },
      });
      if (byEither) return byEither.id;
    }

    const explicit = options.testUserId || process.env.TEST_USER_ID;
    if (explicit) {
      const byExplicit = await db.user.findFirst({
        where: {
          OR: [{ id: explicit }, { clerkId: explicit }],
        },
        select: { id: true },
      });
      if (byExplicit) return byExplicit.id;
    }

    const clerkId = options.testClerkId || process.env.TEST_CLERK_ID || DEFAULT_CLERK_ID;
    const byClerk = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (byClerk) return byClerk.id;

    const fallback = await db.user.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!fallback) throw new Error('No user found while resolving user id');
    return fallback.id;
  } finally {
    await db.$disconnect();
  }
}
