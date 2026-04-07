/**
 * GitHub OAuth Connect Endpoint
 * Redirects user to GitHub authorization page
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Load GitHub OAuth config
    const configPath = path.join(process.cwd(), 'data', 'github-oauth-config.json');
    
    if (!fs.existsSync(configPath)) {
      return NextResponse.json(
        { error: 'GitHub OAuth not configured. Please set up github-oauth-config.json' },
        { status: 500 }
      );
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    
    if (!config.clientId || !config.clientSecret) {
      return NextResponse.json(
        { error: 'GitHub OAuth credentials not configured' },
        { status: 500 }
      );
    }

    // Build GitHub OAuth URL
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: 'repo',
      state: userId, // Pass userId as state for security
    });

    const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

    // Redirect to GitHub
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('GitHub connect error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate GitHub OAuth' },
      { status: 500 }
    );
  }
}
