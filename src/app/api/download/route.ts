/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Serve file downloads from local filesystem
 * DEPENDENCIES: fs, path
 * STATUS: LIVE — enables direct download from Activity page
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { tryAuthUser } from '@/lib/clerk-user';

export async function GET(req: NextRequest) {
  // Authenticate user
  const auth = await tryAuthUser();
  if (!auth.ok) return auth.response;

  const filePath = req.nextUrl.searchParams.get('path');

  if (!filePath) {
    return NextResponse.json({ error: 'Missing file path' }, { status: 400 });
  }

  // Security: Only allow downloads from the user's Documents/Alter directory
  const normalizedPath = path.normalize(filePath);
  const allowedPaths = [
    path.join(process.env.USERPROFILE || '', 'Documents', 'Alter'),
    path.join(process.env.USERPROFILE || '', 'Documents', 'NightShift'),
    path.join(process.cwd(), 'data', 'continuations'),
  ];

  const isAllowed = allowedPaths.some(allowed =>
    normalizedPath.toLowerCase().startsWith(allowed.toLowerCase())
  );

  if (!isAllowed) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Check if file exists
  if (!fs.existsSync(normalizedPath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  try {
    const fileBuffer = fs.readFileSync(normalizedPath);
    const fileName = path.basename(normalizedPath);
    const ext = path.extname(normalizedPath).toLowerCase();

    // Determine content type
    const contentTypes: Record<string, string> = {
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.pdf': 'application/pdf',
      '.md': 'text/markdown',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.ts': 'text/typescript',
      '.tsx': 'text/typescript',
      '.js': 'text/javascript',
      '.py': 'text/x-python',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
