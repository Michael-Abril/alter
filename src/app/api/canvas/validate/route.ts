/**
 * OWNER: Person 3 (Orchestration)
 * PURPOSE: POST: validate Canvas API token and save credentials
 * DEPENDENCIES: Prisma, @clerk/nextjs, Canvas API
 * STATUS: LIVE
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { token, domain } = body;

    if (!token || !domain) {
      return apiError('Missing token or domain', 400);
    }

    // Validate token by making a test API call to Canvas
    const testUrl = `https://${domain}/api/v1/users/self`;
    const testResponse = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!testResponse.ok) {
      return apiError('Invalid Canvas token or domain', 401);
    }

    const userData = await testResponse.json();

    // Save Canvas credentials to /data/canvas-config.json
    const configPath = path.join(process.cwd(), 'data', 'canvas-config.json');
    const configDir = path.dirname(configPath);

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const config = {
      apiToken: token,
      baseUrl: `https://${domain}`,
      userId: userData.id,
      userName: userData.name,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log('[canvas/validate] Canvas credentials validated and saved');

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
