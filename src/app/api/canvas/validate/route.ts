/**
 * OWNER: Person 3 (Orchestration)
 * PURPOSE: POST: validate Canvas API token and save credentials
 * DEPENDENCIES: Prisma, @clerk/nextjs, Canvas API, src/lib/canvas.ts
 * STATUS: LIVE — persists per-user config for loadCanvasConfig / tasks-today
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { saveCanvasConfig } from '@/lib/canvas';

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { token, domain } = body;

    if (!token || !domain) {
      return apiError('Missing token or domain', 400);
    }

    const testUrl = `https://${domain}/api/v1/users/self`;
    const testResponse = await fetch(testUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!testResponse.ok) {
      return apiError('Invalid Canvas token or domain', 401);
    }

    const userData = await testResponse.json();

    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) {
      return apiError('User not found — complete sign-up first', 404);
    }

    saveCanvasConfig(user.id, { token, domain });

    console.log('[canvas/validate] Canvas credentials validated and saved for user', user.id);

    return apiSuccess({
      valid: true,
      userName: userData.name,
      domain,
    });
  } catch (error: any) {
    console.error('[canvas/validate] Error:', error);
    return apiError(`Failed to validate Canvas credentials: ${error.message}`, 500);
  }
}
