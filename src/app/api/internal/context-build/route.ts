/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Internal API for building comprehensive project context
 * DEPENDENCIES: src/lib/context-builder
 * STATUS: LIVE — returns full context packages for projects
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { buildContext } from '@/lib/context-builder';

// POST: Build comprehensive context for a project
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return apiError('Missing required field: projectId', 400);
    }

    console.log(`[internal/context-build] Building context for project: ${projectId}`);

    // Build the context package
    const context = await buildContext(projectId);

    return apiSuccess(context);
  } catch (error) {
    console.error('[internal/context-build] Error:', error);
    return apiError(
      error instanceof Error ? error.message : 'Failed to build context',
      500
    );
  }
}
