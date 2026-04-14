/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Generate and download files from Draft content (no local filesystem needed)
 * DEPENDENCIES: docx-generator, prisma
 * STATUS: LIVE — works on Vercel without local file storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { tryAuthUser } from '@/lib/clerk-user';
import db from '@/lib/db';
import { generateDocx } from '@/lib/docx-generator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await tryAuthUser();
  if (!auth.ok) return auth.response;
  const { user } = auth;

  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Missing draft ID' }, { status: 400 });
  }

  try {
    // Fetch draft from database
    const draft = await db.draft.findUnique({
      where: { id },
    });

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    // Security: Ensure user owns this draft
    if (draft.userId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Parse context for additional metadata
    let context: Record<string, unknown> = {};
    try {
      context = draft.context ? JSON.parse(draft.context) : {};
    } catch {
      // Ignore parse errors
    }

    // Determine file format based on draft type
    const format = req.nextUrl.searchParams.get('format') || 'docx';
    const sanitizedTitle = draft.title.replace(/[^a-zA-Z0-9-_ ]/g, '').slice(0, 50);

    if (format === 'docx') {
      // Generate .docx file on-the-fly
      const buffer = await generateDocx({
        title: draft.title,
        content: draft.content,
        author: 'Alter',
        subject: context.classification as string || draft.type,
      });

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${sanitizedTitle}.docx"`,
          'Content-Length': buffer.length.toString(),
        },
      });
    } else if (format === 'md' || format === 'txt') {
      // Return as markdown/text
      const content = `# ${draft.title}\n\n${draft.content}`;
      const ext = format === 'md' ? 'md' : 'txt';

      return new NextResponse(content, {
        headers: {
          'Content-Type': format === 'md' ? 'text/markdown' : 'text/plain',
          'Content-Disposition': `attachment; filename="${sanitizedTitle}.${ext}"`,
        },
      });
    } else {
      return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
    }
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Failed to generate file' }, { status: 500 });
  }
}
