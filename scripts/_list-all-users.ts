import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const users = await db.user.findMany();
  console.log('All users:', JSON.stringify(users, null, 2));
}
main().finally(() => db.$disconnect());
