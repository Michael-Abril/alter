/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: PATCH: update user settings (autonomy level, wake time, boundaries)
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE — persists settings to User model
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { tryAuthUser } from '@/lib/clerk-user';
import { loadGitHubConfig } from '@/lib/github';
import { loadCanvasConfig } from '@/lib/canvas';
import { getDefaultOutputDirectory, setOutputDirectory } from '@/lib/output';

// PATCH: Update user settings
export async function PATCH(req: NextRequest) {
  try {
    const authResult = await tryAuthUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const body = await req.json();
    const { autonomyLevel, wakeTime, boundaries, outputDirectory } = body;

    // Validate autonomyLevel if provided
    if (autonomyLevel !== undefined && (autonomyLevel < 0 || autonomyLevel > 3)) {
      return apiError('autonomyLevel must be between 0 and 3', 400);
    }

    // Validate wakeTime format if provided (HH:MM)
    if (wakeTime !== undefined && !/^\d{2}:\d{2}$/.test(wakeTime)) {
      return apiError('wakeTime must be in HH:MM format (e.g., "07:00")', 400);
    }

    if (outputDirectory !== undefined && (typeof outputDirectory !== 'string' || !outputDirectory.trim())) {
      return apiError('outputDirectory must be a non-empty string', 400);
    }

    // Update user settings
    const updateData: any = {};
    if (autonomyLevel !== undefined) updateData.autonomyLevel = autonomyLevel;
    if (wakeTime !== undefined) updateData.wakeTime = wakeTime;
    if (outputDirectory !== undefined) updateData.outputDirectory = outputDirectory.trim();

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: updateData,
    });

    if (outputDirectory !== undefined) {
      setOutputDirectory(outputDirectory.trim());
    }

    // Handle boundary rules if provided
    if (boundaries && Array.isArray(boundaries)) {
      // Delete existing boundaries
      await db.boundary.deleteMany({ where: { userId: user.id } });

      // Create new boundaries
      if (boundaries.length > 0) {
        await db.boundary.createMany({
          data: boundaries.map((b: any) => ({
            userId: user.id,
            rule: b.rule,
            category: b.category || 'general',
            action: b.action || 'flag',
            conditions: b.conditions ? JSON.stringify(b.conditions) : null,
          })),
        });
      }
    }

    console.log(`[user/settings] Settings updated for user ${user.id}: autonomyLevel=${updatedUser.autonomyLevel}, wakeTime=${updatedUser.wakeTime}`);

    return apiSuccess({
      message: 'Settings saved successfully',
      autonomyLevel: updatedUser.autonomyLevel,
      wakeTime: updatedUser.wakeTime,
      outputDirectory: updatedUser.outputDirectory || getDefaultOutputDirectory(),
      boundariesUpdated: boundaries ? boundaries.length : 0,
    });
  } catch (error: any) {
    console.error('[user/settings] Error:', error);
    return apiError(`Failed to save settings: ${error.message}`, 500);
  }
}

// GET: Fetch current user settings
export async function GET() {
  try {
    const authResult = await tryAuthUser();
    if (!authResult.ok) return authResult.response;
    const user = await db.user.findUnique({
      where: { id: authResult.user.id },
      include: { boundaries: true },
    });

    if (!user) {
      return apiError('User not found', 404, { code: 'USER_NOT_FOUND' });
    }

    const githubConnected = Boolean(loadGitHubConfig(user.clerkId)?.token || loadGitHubConfig(user.id)?.token);
    const canvasConnected = Boolean(loadCanvasConfig(user.id));

    return apiSuccess({
      autonomyLevel: user.autonomyLevel,
      wakeTime: user.wakeTime,
      gmailConnected: user.gmailConnected,
      githubConnected,
      canvasConnected,
      outputDirectory: user.outputDirectory || getDefaultOutputDirectory(),
      boundaries: user.boundaries.map((b) => ({
        id: b.id,
        rule: b.rule,
        category: b.category,
        action: b.action,
        conditions: b.conditions ? JSON.parse(b.conditions) : null,
      })),
    });
  } catch (error: any) {
    console.error('[user/settings] Error:', error);
    return apiError(`Failed to fetch settings: ${error.message}`, 500);
  }
}
