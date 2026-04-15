import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/utils';
import { tryAuthUser } from '@/lib/clerk-user';
import { buildConsistencyReport } from '@/lib/dev-consistency';

export async function GET(req: NextRequest) {
  const authResult = await tryAuthUser();
  if (!authResult.ok) return authResult.response;
  const { user } = authResult;

  try {
    const report = await buildConsistencyReport(user.id);
    const hasErrors = report.issues.some((i) => i.severity === 'error');
    const hasWarnings = report.issues.some((i) => i.severity === 'warn');

    return apiSuccess({
      ...report,
      healthy: !hasErrors,
      summary: hasErrors
        ? 'Consistency errors detected'
        : hasWarnings
        ? 'No blocking errors; warnings present'
        : 'All consistency checks passed',
    });
  } catch (error: any) {
    return apiError(`Consistency check failed: ${error?.message || 'unknown error'}`, 500);
  }
}
