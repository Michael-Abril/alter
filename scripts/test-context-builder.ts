/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Test the context builder on a real project
 * DEPENDENCIES: src/lib/context-builder, Prisma
 * STATUS: Test script
 *
 * Usage:
 *   npx tsx scripts/test-context-builder.ts
 *   npx tsx scripts/test-context-builder.ts --project-id=PROJECT_ID
 */

import { PrismaClient } from '@prisma/client';
import { buildContext } from '../src/lib/context-builder';

const db = new PrismaClient();

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Context Builder Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Get project ID from args or use first in-progress project
  const args = process.argv.slice(2);
  const projectIdArg = args.find(a => a.startsWith('--project-id='))?.split('=')[1];

  let projectId: string;

  if (projectIdArg) {
    projectId = projectIdArg;
    console.log(`📋 Using specified project ID: ${projectId}`);
  } else {
    // Find first in-progress project
    const project = await db.project.findFirst({
      where: { status: 'in_progress' },
      orderBy: { progress: 'asc' }, // Lowest progress first
    });

    if (!project) {
      console.error('❌ No in-progress projects found');
      process.exit(1);
    }

    projectId = project.id;
    console.log(`📋 Using first in-progress project: ${project.name} (${project.progress}%)`);
  }

  console.log('');

  // Build context
  const context = await buildContext(projectId);

  // Display results
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📦 CONTEXT PACKAGE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  console.log('## PROJECT SUMMARY');
  console.log(`   Name: ${context.projectSummary.name}`);
  console.log(`   Status: ${context.projectSummary.status}`);
  console.log(`   Progress: ${context.projectSummary.progress}%`);
  console.log(`   Description: ${context.projectSummary.description || 'N/A'}`);
  console.log(`   Last Active: ${context.projectSummary.lastActive.toISOString()}`);
  
  if (context.projectSummary.context.nextStep) {
    console.log(`   Next Step: ${context.projectSummary.context.nextStep}`);
  }
  
  if (context.projectSummary.context.keyTopics?.length) {
    console.log(`   Key Topics: ${context.projectSummary.context.keyTopics.join(', ')}`);
  }
  
  console.log('');

  console.log('## RELEVANT CONVERSATIONS');
  console.log(`   Total: ${context.relevantConversations.length}`);
  console.log('');
  
  context.relevantConversations.slice(0, 5).forEach((conv, i) => {
    console.log(`   ${i + 1}. [${(conv.score * 100).toFixed(0)}% relevance] ${conv.source}`);
    console.log(`      ${conv.content.slice(0, 150)}...`);
    console.log('');
  });

  if (context.relevantConversations.length > 5) {
    console.log(`   ... and ${context.relevantConversations.length - 5} more conversations`);
    console.log('');
  }

  console.log('## RELATED EMAILS');
  console.log(`   Total: ${context.relatedEmails.length}`);
  console.log('');
  
  context.relatedEmails.slice(0, 3).forEach((email, i) => {
    console.log(`   ${i + 1}. [${(email.relevanceScore * 100).toFixed(0)}% relevance] ${email.direction.toUpperCase()}`);
    console.log(`      From: ${email.from}`);
    console.log(`      Subject: ${email.subject}`);
    console.log(`      Date: ${email.receivedAt.toISOString().split('T')[0]}`);
    console.log('');
  });

  if (context.relatedEmails.length > 3) {
    console.log(`   ... and ${context.relatedEmails.length - 3} more emails`);
    console.log('');
  }

  console.log('## SUGGESTED NEXT STEPS');
  context.suggestedNextSteps.forEach((step, i) => {
    console.log(`   ${i + 1}. ${step}`);
  });
  console.log('');

  console.log('## METADATA');
  console.log(`   Context Quality: ${context.metadata.contextQuality.toUpperCase()}`);
  console.log(`   Total Conversations: ${context.metadata.totalConversations}`);
  console.log(`   Total Emails: ${context.metadata.totalEmails}`);
  console.log(`   Generated At: ${context.metadata.generatedAt}`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Context package complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Output full JSON for inspection
  console.log('');
  console.log('📄 Full JSON output:');
  console.log(JSON.stringify(context, null, 2));
}

main()
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
