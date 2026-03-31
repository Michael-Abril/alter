/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Gmail API helpers — read emails, send emails, manage OAuth tokens
 * DEPENDENCIES: googleapis
 * STATUS: Scaffold — needs real implementation
 */

import { google } from 'googleapis';
import type { Email } from '@/types';

// ─── OAuth Setup ─────────────────────────────────────────────────────────────

/**
 * Create an OAuth2 client for Gmail API
 * TODO: Person 1 — Ensure redirect URI matches env config
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
}

/**
 * Generate the Gmail OAuth authorization URL
 * TODO: Person 1 — Add appropriate scopes (read, send, modify)
 */
export function getAuthUrl(): string {
  const oauth2Client = createOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
  });
}

/**
 * Exchange authorization code for tokens
 * TODO: Person 1 — Store tokens encrypted in the database
 */
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

// ─── Email Fetching ──────────────────────────────────────────────────────────

/**
 * Fetch recent sent emails from Gmail
 * TODO: Person 1 — Implement pagination, handle rate limits,
 * parse email body (handle HTML vs plain text), extract headers properly
 */
export async function fetchSentEmails(
  accessToken: string,
  refreshToken: string,
  maxResults: number = 50
): Promise<Partial<Email>[]> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // TODO: Person 1 — Implement full email fetching with pagination
  const response = await gmail.users.messages.list({
    userId: 'me',
    labelIds: ['SENT'],
    maxResults,
  });

  const messages = response.data.messages || [];
  const emails: Partial<Email>[] = [];

  for (const msg of messages) {
    if (!msg.id) continue;

    // TODO: Person 1 — Implement full message parsing
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'full',
    });

    const headers = detail.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    emails.push({
      gmailId: msg.id,
      threadId: detail.data.threadId || undefined,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      body: extractBody(detail.data.payload),
      direction: 'sent',
      receivedAt: new Date(parseInt(detail.data.internalDate || '0')).toISOString(),
    });
  }

  return emails;
}

/**
 * Extract email body from Gmail payload
 * TODO: Person 1 — Handle multipart messages, HTML stripping, attachments
 */
function extractBody(payload: Record<string, unknown> | undefined | null): string {
  if (!payload) return '';

  // TODO: Person 1 — Implement proper MIME parsing
  const body = payload.body as Record<string, unknown> | undefined;
  if (body?.data) {
    return Buffer.from(body.data as string, 'base64').toString('utf-8');
  }

  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts) {
    for (const part of parts) {
      const mimeType = part.mimeType as string;
      if (mimeType === 'text/plain') {
        const partBody = part.body as Record<string, unknown> | undefined;
        if (partBody?.data) {
          return Buffer.from(partBody.data as string, 'base64').toString('utf-8');
        }
      }
    }
  }

  return '';
}

/**
 * Send an email via Gmail
 * TODO: Person 1 — Implement with proper MIME encoding, CC/BCC support,
 * reply threading, and error handling
 */
export async function sendEmail(
  accessToken: string,
  refreshToken: string,
  params: { to: string; subject: string; body: string; threadId?: string }
): Promise<{ messageId: string }> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // TODO: Person 1 — Build proper MIME message
  const raw = Buffer.from(
    `To: ${params.to}\r\nSubject: ${params.subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${params.body}`
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw,
      threadId: params.threadId,
    },
  });

  return { messageId: response.data.id || '' };
}
