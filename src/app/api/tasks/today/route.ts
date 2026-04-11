/**
 * GET /api/tasks/today — merged prioritized task list (Canvas, projects, email).
 */

import { apiSuccess, apiError } from '@/lib/utils';
import { tryAuthUser } from '@/lib/clerk-user';
import { buildTodayTasks } from '@/lib/tasks-today';

export async function GET() {
  try {
    const authResult = await tryAuthUser();
    if (!authResult.ok) return authResult.response;
    const { user } = authResult;

    const tasks = await buildTodayTasks(user.id);
    return apiSuccess({ tasks });
  } catch (error) {
    console.error('[api/tasks/today]', error);
    const message = error instanceof Error ? error.message : 'Failed to load tasks';
    return apiError(message, 500);
  }
}
