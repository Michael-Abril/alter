/**
 * GitHub Set Default Repo Endpoint
 * Saves user's selected default repository
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { loadGitHubConfig, saveGitHubConfig } from '@/lib/github';
import db from '@/lib/db';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { owner, repo, defaultBranch } = body;

    if (!owner || !repo) {
      return NextResponse.json(
        { error: 'Owner and repo are required' },
        { status: 400 }
      );
    }

    const config = loadGitHubConfig(user.id);

    if (!config || !config.token) {
      return NextResponse.json(
        { error: 'GitHub not connected' },
        { status: 400 }
      );
    }

    // Update config with selected repo
    saveGitHubConfig(user.id, {
      ...config,
      defaultOwner: owner,
      defaultRepo: repo,
      defaultBranch: defaultBranch || 'main',
    });

    return NextResponse.json({
      success: true,
      data: {
        owner,
        repo,
        defaultBranch: defaultBranch || 'main',
      },
    });
  } catch (error) {
    console.error('GitHub set repo error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to set default repository' },
      { status: 500 }
    );
  }
}
