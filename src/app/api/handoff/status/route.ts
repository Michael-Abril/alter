import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import fs from 'fs';
import path from 'path';

const STATUS_DIR = path.join(process.cwd(), 'data');

function readRunStatus(userId: string) {
  const filePath = path.join(STATUS_DIR, `handoff-run-${userId}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  const db = (await import('@/lib/db')).default;
  const user = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
  if (!user) return apiSuccess({ state: 'idle' });

  const status = readRunStatus(user.id);
  if (!status) return apiSuccess({ state: 'idle' });

  return apiSuccess(status);
}
