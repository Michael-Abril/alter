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
import {
  canvasHostCandidates,
  normalizeCanvasDomain,
  saveCanvasConfig,
  tryParseCanvasJson,
} from '@/lib/canvas';

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { token, domain } = body;

    if (!token || !domain) {
      return apiError('Missing token or domain', 400);
    }

    const host = normalizeCanvasDomain(domain);
    if (!host.includes('.') || host.includes('http')) {
      return apiError('Invalid domain. Use only the hostname, e.g. yourschool.instructure.com', 400);
    }

    const hosts = canvasHostCandidates(host);
    let lastDetail = 'Invalid Canvas token or domain';

    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) {
      return apiError('User not found — complete sign-up first', 404);
    }

    for (const tryHost of hosts) {
      const testUrl = `https://${tryHost}/api/v1/users/self`;
      const testResponse = await fetch(testUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      });

      const bodyText = await testResponse.text();
      const userData = tryParseCanvasJson(bodyText);

      if (!testResponse.ok) {
        lastDetail = `Canvas API returned ${testResponse.status} for ${tryHost}`;
        continue;
      }

      if (!userData) {
        lastDetail =
          'Canvas returned a web page instead of API data. Use the hostname from your browser address bar — often school.instructure.com (not canvas.school.edu).';
        continue;
      }

      saveCanvasConfig(user.id, { token, domain: tryHost });

      console.log('[canvas/validate] Canvas credentials validated and saved for user', user.id, tryHost);

      return apiSuccess({
        valid: true,
        userName: typeof userData.name === 'string' ? userData.name : undefined,
        domain: tryHost,
      });
    }

    return apiError(lastDetail, 401);
  } catch (error: any) {
    console.error('[canvas/validate] Error:', error);
    return apiError(`Failed to validate Canvas credentials: ${error.message}`, 500);
  }
}
