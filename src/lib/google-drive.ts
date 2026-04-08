/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Google Drive API helpers — folder management, doc creation, file upload, listing
 * DEPENDENCIES: googleapis, @/lib/google-auth
 * STATUS: LIVE — real Google Drive API integration
 */

import { google } from 'googleapis';
import { getGoogleAuthClient } from '@/lib/google-auth';

// ─── In-Memory Folder Cache ─────────────────────────────────────────────────

const folderCache = new Map<string, string>();

// ─── Markdown → HTML Conversion ─────────────────────────────────────────────

function markdownToSimpleHtml(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```\w*\n?/, '').replace(/```$/, '');
      return `<pre>${code}</pre>`;
    });

  // Convert bullet lists (consecutive lines starting with - or *)
  html = html.replace(/(?:^[\t ]*[-*] .+$\n?)+/gm, (block) => {
    const items = block
      .trim()
      .split('\n')
      .map((line) => `<li>${line.replace(/^[\t ]*[-*] /, '')}</li>`)
      .join('');
    return `<ul>${items}</ul>`;
  });

  // Wrap remaining bare lines in paragraphs
  html = html
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (/^<(h[1-6]|ul|ol|li|pre|blockquote)/.test(trimmed)) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .join('\n');

  return html;
}

// ─── Drive Helpers ──────────────────────────────────────────────────────────

async function getDriveClient(userId: string) {
  const authClient = await getGoogleAuthClient(userId);
  return google.drive({ version: 'v3', auth: authClient });
}

// ─── Folder Management ──────────────────────────────────────────────────────

export async function getOrCreateNightShiftFolder(
  userId: string
): Promise<{ folderId: string }> {
  const cached = folderCache.get(userId);
  if (cached) return { folderId: cached };

  try {
    const drive = await getDriveClient(userId);

    // Search for existing NightShift folder
    const search = await drive.files.list({
      q: "name = 'NightShift' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (search.data.files?.length && search.data.files[0].id) {
      const folderId = search.data.files[0].id;
      folderCache.set(userId, folderId);
      console.log(`[google-drive] Found existing NightShift folder: ${folderId}`);
      return { folderId };
    }

    // Create the folder
    const folder = await drive.files.create({
      requestBody: {
        name: 'NightShift',
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });

    const folderId = folder.data.id!;
    folderCache.set(userId, folderId);
    console.log(`[google-drive] Created NightShift folder: ${folderId}`);
    return { folderId };
  } catch (error) {
    console.error('[google-drive] Error in getOrCreateNightShiftFolder:', error);
    throw error;
  }
}

// ─── Document Creation ──────────────────────────────────────────────────────

export async function createGoogleDoc(
  userId: string,
  title: string,
  markdownContent: string
): Promise<{ docId: string; docUrl: string; title: string }> {
  try {
    const drive = await getDriveClient(userId);
    const { folderId } = await getOrCreateNightShiftFolder(userId);

    const htmlContent = markdownToSimpleHtml(markdownContent);

    const file = await drive.files.create({
      requestBody: {
        name: title,
        mimeType: 'application/vnd.google-apps.document',
        parents: [folderId],
      },
      media: {
        mimeType: 'text/html',
        body: htmlContent,
      },
      fields: 'id',
    });

    const docId = file.data.id!;
    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

    console.log(`[google-drive] Created doc "${title}": ${docUrl}`);
    return { docId, docUrl, title };
  } catch (error) {
    console.error('[google-drive] Error in createGoogleDoc:', error);
    throw error;
  }
}

// ─── Generic File Upload ────────────────────────────────────────────────────

export async function uploadFileToDrive(
  userId: string,
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ fileId: string; fileUrl: string }> {
  try {
    const drive = await getDriveClient(userId);
    const { folderId } = await getOrCreateNightShiftFolder(userId);

    const { Readable } = await import('stream');
    const stream = Readable.from(buffer);

    const file = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
      },
      media: {
        mimeType,
        body: stream,
      },
      fields: 'id, webViewLink',
    });

    const fileId = file.data.id!;
    const fileUrl = file.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`;

    console.log(`[google-drive] Uploaded file "${filename}": ${fileUrl}`);
    return { fileId, fileUrl };
  } catch (error) {
    console.error('[google-drive] Error in uploadFileToDrive:', error);
    throw error;
  }
}

// ─── File Listing ───────────────────────────────────────────────────────────

export async function listNightShiftFiles(
  userId: string
): Promise<
  Array<{
    id: string;
    name: string;
    url: string;
    mimeType: string;
    createdTime: string;
  }>
> {
  try {
    const drive = await getDriveClient(userId);
    const { folderId } = await getOrCreateNightShiftFolder(userId);

    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, webViewLink, mimeType, createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 100,
    });

    return (res.data.files ?? []).map((f) => ({
      id: f.id!,
      name: f.name!,
      url: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
      mimeType: f.mimeType!,
      createdTime: f.createdTime!,
    }));
  } catch (error) {
    console.error('[google-drive] Error in listNightShiftFiles:', error);
    throw error;
  }
}
