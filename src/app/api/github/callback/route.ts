/**
 * GitHub OAuth Callback Endpoint
 * Exchanges authorization code for access token
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { saveGitHubConfig } from '@/lib/github';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // This is the userId

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/onboarding?error=github_auth_failed', request.url)
      );
    }

    const userId = state;

    // Load GitHub OAuth config
    const configPath = path.join(process.cwd(), 'data', 'github-oauth-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error || !tokenData.access_token) {
      console.error('GitHub token exchange error:', tokenData);
      return NextResponse.redirect(
        new URL('/onboarding?error=github_token_failed', request.url)
      );
    }

    const accessToken = tokenData.access_token;

    // Get user's GitHub info to verify token
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const userData = await userResponse.json();

    if (!userData.login) {
      return NextResponse.redirect(
        new URL('/onboarding?error=github_user_failed', request.url)
      );
    }

    // Save token to config (without default repo yet - user will select that)
    saveGitHubConfig(userId, {
      token: accessToken,
      defaultOwner: userData.login,
      defaultRepo: '', // Will be set when user selects repo
      defaultBranch: 'main',
    });

    // Redirect back to onboarding with success flag
    const baseUrl = new URL(request.url).origin;
    return NextResponse.redirect(`${baseUrl}/onboarding?github_connected=true`);
  } catch (error) {
    console.error('GitHub callback error:', error);
    return NextResponse.redirect(
      new URL('/onboarding?error=github_callback_failed', request.url)
    );
  }
}
