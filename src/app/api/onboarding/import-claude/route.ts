/**
 * OWNER: Person 3 (Orchestration)
 * PURPOSE: POST: trigger Claude conversation scraper for onboarding
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    console.log('[onboarding/import-claude] Starting Claude scraper...');

    // Run the Claude scraper in the background
    // Note: In production, this should be a background job
    execAsync('node orchestration/scrape-claude.mjs').catch(err => {
      console.error('[onboarding/import-claude] Scraper error:', err);
    });

    return apiSuccess({
      message: 'Claude import started',
      status: 'processing',
    });
  } catch (error: any) {
    console.error('[onboarding/import-claude] Error:', error);
    return apiError(`Failed to start Claude import: ${error.message}`, 500);
  }
}
