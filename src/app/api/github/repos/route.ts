/**
 * GitHub Repos Endpoint
 * Lists user's repositories for selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { loadGitHubConfig, listRepos } from '@/lib/github';
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
      return NextResponse.json(
        { error: 'GitHub not connected' },
        { status: 400 }
      );
    }

    // Fetch repos from GitHub
    const repos = await listRepos(config.token);

    // Format for frontend
    const formattedRepos = repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      private: repo.private,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
    }));

    return NextResponse.json({
      success: true,
      data: formattedRepos,
    });
  } catch (error) {
    console.error('GitHub repos error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch repositories' },
      { status: 500 }
    );
  }
}
