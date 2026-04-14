/**
 * Link the existing test user to a real Clerk user ID.
 * Usage: npx tsx scripts/link-clerk-user.ts <clerk-user-id>
 * 
 * If no argument provided, lists current users.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

async function main() {
  const db = new PrismaClient();
  const newClerkId = process.argv[2];

  const users = await db.user.findMany();
  console.log('Current users:');
  for (const u of users) {
    console.log(`  id=${u.id} clerkId=${u.clerkId} email=${u.email}`);
  }

  if (!newClerkId) {
    console.log('\nUsage: npx tsx scripts/link-clerk-user.ts <your-clerk-user-id>');
    console.log('Find your Clerk ID in the Clerk dashboard or browser devtools.');
    process.exit(0);
  }

  // Find the test user
  const testUser = users.find(u => u.clerkId === 'user_test_123');
  if (!testUser) {
    console.log('\nNo user_test_123 found. Nothing to link.');
    process.exit(0);
  }

  // Check if there's already a user with this clerkId
  const existing = await db.user.findUnique({ where: { clerkId: newClerkId } });
  if (existing && existing.id !== testUser.id) {
    // Merge: move all data from testUser to existing user
    console.log(`\nClerk user ${newClerkId} already exists (id=${existing.id}). Migrating data...`);
    await db.chatMessage.updateMany({ where: { userId: testUser.id }, data: { userId: existing.id } });
    await db.project.updateMany({ where: { userId: testUser.id }, data: { userId: existing.id } });
    await db.user.delete({ where: { id: testUser.id } });
    console.log('Data migrated and test user deleted.');
  } else {
    // Just update the clerkId
    await db.user.update({
      where: { id: testUser.id },
      data: { clerkId: newClerkId },
    });
    console.log(`\nUpdated user ${testUser.id} clerkId: user_test_123 → ${newClerkId}`);
  }

  process.exit(0);
}
main();
