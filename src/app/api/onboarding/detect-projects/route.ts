/**
 * OWNER: Person 3 (Orchestration)
 * PURPOSE: POST: run project detection for onboarding
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const ONBOARDING_LOOKBACK_DAYS = 3;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const urlDays = req.nextUrl.searchParams.get('sinceDays');
    const body = await req.json().catch(() => ({}));
    const lookbackDays = Math.max(
      1,
      Math.min(30, Number(urlDays || body?.days) || ONBOARDING_LOOKBACK_DAYS)
    );
    console.log('[onboarding/detect-projects] Starting project detection...');

    // Run the project detection script
    const { stdout } = await execAsync(
      `npx tsx scripts/detect-projects.ts --recent-days=${lookbackDays}`
    );
    
    // Parse output to get count of projects detected
    const match = stdout.match(/Detected (\d+) projects/);
    const projectsDetected = match ? parseInt(match[1]) : 0;

    console.log(`[onboarding/detect-projects] Detected ${projectsDetected} projects`);

    return apiSuccess({
      projectsDetected,
      status: 'complete',
      lookbackDays,
    });
  } catch (error: any) {
    console.error('[onboarding/detect-projects] Error:', error);
    return apiError(`Failed to run project detection: ${error.message}`, 500);
  }
}
