import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: ['error', 'warn'] });

async function main() {
  const user = await db.user.findUnique({ where: { clerkId: 'user_test_123' } });
  console.log('User:', user ? user.id : 'NOT FOUND');

  if (!user) {
    console.log('No user found, exiting');
    return;
  }

  const count = await db.chatMessage.count({ where: { userId: user.id } });
  console.log('Existing messages:', count);

  try {
    const result = await db.chatMessage.create({
      data: {
        userId: user.id,
        source: 'test',
        role: 'user',
        content: 'test message from script',
        timestamp: new Date(),
      },
    });
    console.log('Insert OK:', result.id);

    // Clean up
    await db.chatMessage.delete({ where: { id: result.id } });
    console.log('Cleanup OK');
  } catch (e: any) {
    console.error('INSERT ERROR:', e.message);
    console.error('Full error:', e);
  }
}

main().finally(() => db.$disconnect());
