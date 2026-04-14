import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const user = await db.user.findFirst({
    where: { clerkId: 'user_3Bge5cdx4LkgxWgYXeYlU6Tm42a' },
  });
  
  if (user) {
    console.log(user.id);
  } else {
    console.error('User not found');
    process.exit(1);
  }
}

main().finally(() => db.$disconnect());
