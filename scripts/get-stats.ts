import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const db = new PrismaClient();

async function main() {
  const stats = {
    messages: await db.chatMessage.count(),
    embedded: await db.chatMessage.count({ where: { embedded: true } }),
    projects: await db.project.count(),
    inProgressProjects: await db.project.count({ where: { status: 'in_progress' } }),
    completedProjects: await db.project.count({ where: { status: 'completed' } }),
    actions: await db.action.count(),
    drafts: await db.draft.count(),
    emails: await db.email.count(),
  };

  // Count continuation files
  const continuationsDir = path.join(process.cwd(), 'data', 'continuations');
  let continuationFiles = 0;
  if (fs.existsSync(continuationsDir)) {
    continuationFiles = fs.readdirSync(continuationsDir).filter(f => f.endsWith('.md')).length;
  }

  // Count vectors
  const vectorsDir = path.join(process.cwd(), 'data', 'vectors');
  let totalVectors = 0;
  if (fs.existsSync(vectorsDir)) {
    const userDirs = fs.readdirSync(vectorsDir);
    for (const userDir of userDirs) {
      const indexPath = path.join(vectorsDir, userDir, 'index.json');
      if (fs.existsSync(indexPath)) {
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
        totalVectors += index.items?.length || 0;
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 NIGHTSHIFT AI - FINAL STATS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('💬 CHAT MESSAGES');
  console.log(`   Total Messages: ${stats.messages}`);
  console.log(`   Embedded: ${stats.embedded}`);
  console.log(`   Vectors in DB: ${totalVectors}`);
  console.log('');
  console.log('📂 PROJECTS');
  console.log(`   Total Projects: ${stats.projects}`);
  console.log(`   In Progress: ${stats.inProgressProjects}`);
  console.log(`   Completed: ${stats.completedProjects}`);
  console.log('');
  console.log('🤖 AUTONOMOUS WORK');
  console.log(`   Total Actions: ${stats.actions}`);
  console.log(`   Email Drafts: ${stats.drafts}`);
  console.log(`   Continuations Generated: ${continuationFiles}`);
  console.log('');
  console.log('📧 EMAILS');
  console.log(`   Total Emails: ${stats.emails}`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ END-TO-END PIPELINE COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  await db.$disconnect();
}

main();
