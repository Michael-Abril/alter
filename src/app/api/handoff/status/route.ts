import { apiSuccess, apiError } from '@/lib/utils';
import fs from 'fs';
import path from 'path';
import { tryAuthUser } from '@/lib/clerk-user';

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
  try {
    const authResult = await tryAuthUser();
    if (!authResult.ok) return authResult.response;

    const db = (await import('@/lib/db')).default;
    const status = readRunStatus(authResult.user.id);
    if (!status) return apiSuccess({ state: 'idle' });

    return apiSuccess(status);
  } catch (e) {
    console.error('[handoff/status]', e);
    return apiError(e instanceof Error ? e.message : 'Failed to read handoff status', 500);
  }
}
