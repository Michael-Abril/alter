/**
 * OWNER: Person 2 (Phillip/Backend)
 * PURPOSE: Canvas LMS connection endpoint
 * DEPENDENCIES: src/lib/canvas.ts
 * STATUS: LIVE — validates and stores Canvas credentials
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { validateCredentials, saveCanvasConfig } from '@/lib/canvas';
import db from '@/lib/db';

// POST: Connect Canvas account
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { token, domain } = body;

    if (!token || !domain) {
      return apiError('Missing token or domain', 400);
    }

    // Validate domain format
    if (!domain.includes('.') || domain.includes('http')) {
      return apiError('Invalid domain format. Use format: school.instructure.com', 400);
    }

    // Find user
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return apiError('User not found', 404);

    console.log(`[canvas/connect] Validating credentials for user ${user.id}...`);

    // Validate credentials by attempting to fetch user profile
    const config = { token, domain };
    const isValid = await validateCredentials(config);

    if (!isValid) {
      return apiError('Invalid Canvas credentials. Please check your token and domain.', 401);
    }

    // Save credentials to JSON file
    saveCanvasConfig(user.id, config);

    console.log(`[canvas/connect] ✅ Canvas connected for user ${user.id}`);

    return apiSuccess({
      success: true,
      message: 'Canvas account connected successfully',
      domain,
    });
  } catch (error) {
    console.error('[canvas/connect] Error:', error);
    return apiError('Failed to connect Canvas account', 500);
  }
}

// GET: Check Canvas connection status
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return apiError('User not found', 404);

    // Check if config exists
    const { loadCanvasConfig } = await import('@/lib/canvas');
    const config = loadCanvasConfig(user.id);

    if (!config) {
      return apiSuccess({
        connected: false,
        domain: null,
      });
    }

    return apiSuccess({
      connected: true,
      domain: config.domain,
    });
  } catch (error) {
    console.error('[canvas/connect] Error:', error);
    return apiError('Failed to check Canvas connection', 500);
  }
}

// DELETE: Disconnect Canvas account
export async function DELETE() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const user = await db.user.findUnique({ where: { clerkId } });
    if (!user) return apiError('User not found', 404);

    const { deleteCanvasConfig } = await import('@/lib/canvas');
    deleteCanvasConfig(user.id);

    console.log(`[canvas/connect] Canvas disconnected for user ${user.id}`);

    return apiSuccess({
      success: true,
      message: 'Canvas account disconnected',
    });
  } catch (error) {
    console.error('[canvas/connect] Error:', error);
    return apiError('Failed to disconnect Canvas account', 500);
  }
}
