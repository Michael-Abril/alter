/**
 * GitHub Status Endpoint
 * Returns connection status and default repo
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { loadGitHubConfig } from '@/lib/github';
import db from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get internal user ID
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const config = loadGitHubConfig(user.id);

    if (!config || !config.token) {
      return NextResponse.json({
        success: true,
        data: {
          connected: false,
          defaultOwner: null,
          defaultRepo: null,
          defaultBranch: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        connected: true,
        defaultOwner: config.defaultOwner,
        defaultRepo: config.defaultRepo,
        defaultBranch: config.defaultBranch,
      },
    });
  } catch (error) {
    console.error('GitHub status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get GitHub status' },
      { status: 500 }
    );
  }
}
