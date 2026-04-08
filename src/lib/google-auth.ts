/**
 * Shared Google OAuth client — provides authenticated API clients for
 * Gmail, Drive, and Calendar from stored user tokens.
 */

import { google } from 'googleapis';
import db from '@/lib/db';

const SCOPES_V2 = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.events.readonly',
];

export const CURRENT_SCOPES_VERSION = 2;
export { SCOPES_V2 as GOOGLE_SCOPES };

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI,
  );
}

/**
 * Returns an authenticated OAuth2Client for the given internal user ID.
 * Automatically refreshes the access token when a refresh token is available.
 */
export async function getGoogleAuthClient(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { gmailToken: true, gmailRefreshToken: true, id: true },
  });

  if (!user?.gmailToken) {
    throw new Error('Google not connected for this user');
  }

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: user.gmailToken,
    refresh_token: user.gmailRefreshToken,
  });

  client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      try {
        await db.user.update({
          where: { id: userId },
          data: { gmailToken: tokens.access_token },
        });
      } catch {
        // Best-effort token persistence
      }
    }
  });

  return client;
}

export async function getGmailClient(userId: string) {
  const auth = await getGoogleAuthClient(userId);
  return google.gmail({ version: 'v1', auth });
}

export async function getDriveClient(userId: string) {
  const auth = await getGoogleAuthClient(userId);
  return google.drive({ version: 'v3', auth });
}

export async function getCalendarClient(userId: string) {
  const auth = await getGoogleAuthClient(userId);
  return google.calendar({ version: 'v3', auth });
}

/**
 * Check whether a user needs to re-authorize to get the expanded scopes
 * (Drive, Calendar, gmail.compose).
 */
export function needsScopeUpgrade(googleScopesVersion: number): boolean {
  return googleScopesVersion < CURRENT_SCOPES_VERSION;
}
