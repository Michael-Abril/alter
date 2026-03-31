/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: GET: fetch stored emails from DB, POST: trigger email sync from Gmail
 * DEPENDENCIES: Prisma, Gmail API, @clerk/nextjs
 * STATUS: LIVE — real email data with pagination and sync trigger
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';

// GET: Return stored emails for the authenticated user
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const direction = searchParams.get('direction') as 'sent' | 'received' | undefined;

    // Build query
    const where: any = { user: { clerkId: userId } };
    if (direction) where.direction = direction;

    // Fetch emails with pagination
    const emails = await db.email.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        gmailId: true,
        threadId: true,
        from: true,
        to: true,
        subject: true,
        body: true,
        direction: true,
        isRead: true,
        receivedAt: true,
        createdAt: true,
        embedded: true,
      },
    });

    // Get total count for pagination
    const total = await db.email.count({ where });

    return apiSuccess({
      emails,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + emails.length < total,
      },
    });
  } catch (error) {
    console.error('[gmail/emails] GET error:', error);
    return apiError('Failed to fetch emails', 500);
  }
}

// POST: Trigger a fresh email sync from Gmail
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    // Forward to the sync endpoint to avoid duplication
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/gmail/sync`, {
      method: 'POST',
      headers: {
        'Cookie': req.headers.get('Cookie') || '',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      return apiError(`Sync failed: ${error}`, response.status);
    }

    const result = await response.json();
    return apiSuccess(result.data);
  } catch (error) {
    console.error('[gmail/emails] POST error:', error);
    return apiError('Failed to trigger email sync', 500);
  }
}
