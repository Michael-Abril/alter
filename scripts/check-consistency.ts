import db from '@/lib/db';
import { buildConsistencyReport } from '@/lib/dev-consistency';

async function main() {
  const userArg = process.argv.find((arg) => arg.startsWith('--user-id='))?.split('=')[1];

  let userId = userArg;
  if (!userId) {
    const firstUser = await db.user.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    userId = firstUser?.id;
  }

  if (!userId) {
    console.error('No users found. Pass --user-id=<id>.');
    process.exit(1);
  }

  const report = await buildConsistencyReport(userId);
  console.log(JSON.stringify(report, null, 2));

  const hasErrors = report.issues.some((i) => i.severity === 'error');
  process.exit(hasErrors ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
