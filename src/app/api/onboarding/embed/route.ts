/**
 * OWNER: Person 3 (Orchestration)
 * PURPOSE: POST: run embedding pipeline for onboarding
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
    console.log('[onboarding/embed] Starting embedding pipeline...');

    // Run the embedding script
    const { stdout } = await execAsync('npx tsx scripts/embed-chat-history.ts');
    
    // Parse output to get count of messages embedded
    const match = stdout.match(/Embedded (\d+) messages/);
    const messagesEmbedded = match ? parseInt(match[1]) : 0;

    console.log(`[onboarding/embed] Embedded ${messagesEmbedded} messages`);

    return apiSuccess({
      messagesEmbedded,
      status: 'complete',
    });
  } catch (error: any) {
    console.error('[onboarding/embed] Error:', error);
    return apiError(`Failed to run embedding pipeline: ${error.message}`, 500);
  }
}
