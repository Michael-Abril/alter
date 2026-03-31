/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Gmail API helpers — OAuth, email fetching with pagination, send, token refresh
 * DEPENDENCIES: googleapis
 * STATUS: LIVE — real Google OAuth + Gmail API integration
 */

import { google } from 'googleapis';
import type { gmail_v1 } from 'googleapis';

// ─── OAuth Setup ─────────────────────────────────────────────────────────────

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  );
}

/**
 * Generate the Gmail OAuth authorization URL with a state param
 * for CSRF protection that encodes the Clerk userId.
 */
export function getAuthUrl(clerkUserId: string): string {
  const oauth2Client = createOAuth2Client();

  const state = Buffer.from(JSON.stringify({ clerkId: clerkUserId, ts: Date.now() }))
    .toString('base64url');

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
    state,
  });
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Create an authenticated Gmail client from stored tokens.
 * Automatically refreshes the access token if a refresh token is available.
 */
export function createGmailClient(accessToken: string, refreshToken: string | null) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return {
    gmail: google.gmail({ version: 'v1', auth: oauth2Client }),
    oauth2Client,
  };
}

/**
 * Refresh the access token using the refresh token.
 * Returns the new access token string.
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token');
  }
  return credentials.access_token;
}

// ─── Email Fetching ──────────────────────────────────────────────────────────

export interface FetchedEmail {
  gmailId: string;
  threadId: string | null;
  from: string;
  to: string;
  subject: string;
  body: string;
  direction: 'sent' | 'received';
  receivedAt: Date;
}

/**
 * Fetch sent emails from Gmail with full pagination.
 * Pulls up to `maxTotal` emails across multiple pages.
 */
export async function fetchSentEmails(
  accessToken: string,
  refreshToken: string | null,
  maxTotal: number = 200
): Promise<FetchedEmail[]> {
  const { gmail } = createGmailClient(accessToken, refreshToken);

  // Step 1: Collect message IDs with pagination
  const messageIds: string[] = [];
  let pageToken: string | undefined;

  while (messageIds.length < maxTotal) {
    const remaining = maxTotal - messageIds.length;
    const pageSize = Math.min(remaining, 100); // Gmail API max per page is 100

    const response = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['SENT'],
      maxResults: pageSize,
      pageToken,
    });

    const messages = response.data.messages || [];
    for (const msg of messages) {
      if (msg.id) messageIds.push(msg.id);
    }

    pageToken = response.data.nextPageToken || undefined;
    if (!pageToken || messages.length === 0) break;
  }

  console.log(`[gmail] Found ${messageIds.length} sent message IDs`);

  // Step 2: Fetch full message details in batches of 20
  const emails: FetchedEmail[] = [];
  const BATCH_SIZE = 20;

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((id) =>
        gmail.users.messages.get({ userId: 'me', id, format: 'full' })
      )
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const detail = result.value.data;
      if (!detail.id) continue;

      const headers = detail.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const body = extractBody(detail.payload);

      emails.push({
        gmailId: detail.id,
        threadId: detail.threadId || null,
        from: getHeader('From'),
        to: getHeader('To'),
        subject: getHeader('Subject'),
        body: body.slice(0, 50000), // cap body at 50k chars
        direction: 'sent',
        receivedAt: new Date(parseInt(detail.internalDate || '0')),
      });
    }

    if (i + BATCH_SIZE < messageIds.length) {
      console.log(`[gmail] Fetched ${Math.min(i + BATCH_SIZE, messageIds.length)}/${messageIds.length} messages`);
    }
  }

  console.log(`[gmail] Parsed ${emails.length} emails total`);
  return emails;
}

// ─── MIME Body Extraction ────────────────────────────────────────────────────

/**
 * Recursively extract email body from Gmail MIME payload.
 * Prefers text/plain, falls back to text/html with tag stripping.
 */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';

  // Direct body on the payload itself (simple non-multipart messages)
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  // Multipart: recurse into parts
  if (payload.parts && payload.parts.length > 0) {
    // First pass: look for text/plain
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }

    // Second pass: recurse into nested multipart/* parts looking for text/plain
    for (const part of payload.parts) {
      if (part.mimeType?.startsWith('multipart/') || part.parts) {
        const nested = extractBody(part);
        if (nested) return nested;
      }
    }

    // Third pass: fall back to text/html with tag stripping
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return stripHtml(decodeBase64Url(part.body.data));
      }
    }
  }

  // Fallback: if payload itself has body data regardless of mimeType
  if (payload.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType === 'text/html') return stripHtml(decoded);
    return decoded;
  }

  return '';
}

function decodeBase64Url(data: string): string {
  // Gmail uses URL-safe base64 (- instead of +, _ instead of /)
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Send Email ──────────────────────────────────────────────────────────────

export async function sendEmail(
  accessToken: string,
  refreshToken: string | null,
  params: { to: string; subject: string; body: string; threadId?: string; inReplyTo?: string }
): Promise<{ messageId: string }> {
  const { gmail } = createGmailClient(accessToken, refreshToken);

  const headers = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
  ];
  if (params.inReplyTo) {
    headers.push(`In-Reply-To: ${params.inReplyTo}`);
    headers.push(`References: ${params.inReplyTo}`);
  }

  const raw = Buffer.from(headers.join('\r\n') + '\r\n\r\n' + params.body)
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
