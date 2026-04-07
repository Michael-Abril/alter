/**
 * GitHub Save Token Endpoint (Fallback)
 * Allows manual token entry if OAuth isn't configured
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { saveGitHubConfig, getUser } from '@/lib/github';
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
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Verify token by fetching user info
    try {
      const userData = await getUser(token);

      if (!userData.login) {
        return NextResponse.json(
          { error: 'Invalid GitHub token' },
          { status: 400 }
        );
      }

      // Save token to config
      saveGitHubConfig(user.id, {
        token,
        defaultOwner: userData.login,
        defaultRepo: '',
        defaultBranch: 'main',
      });

      return NextResponse.json({
        success: true,
        data: {
          username: userData.login,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid GitHub token' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('GitHub save token error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save GitHub token' },
      { status: 500 }
    );
  }
}
