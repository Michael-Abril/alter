/**
 * Test continuation agent with different project classifications
 * Shows output quality difference between code_build, document_build, and academic_deliverable
 */

import 'dotenv/config';
import { continueWork } from './continue-work.mjs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Testing Classification-Specific Continuation Outputs');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    // Find one project of each classification type
    const projects = await db.project.findMany({
      where: {
        status: 'in_progress',
      },
      include: {
        user: true,
      },
    });

    const projectsByClassification = {};
    
    for (const project of projects) {
      const context = JSON.parse(project.context || '{}');
      const classification = context.classification || 'other';
      
      if (!projectsByClassification[classification]) {
        projectsByClassification[classification] = project;
      }
    }

    console.log('Found projects:');
    for (const [classification, project] of Object.entries(projectsByClassification)) {
      console.log(`  - ${classification}: ${project.name}`);
    }
    console.log('');

    // Test each classification type
    const testClassifications = ['code_build', 'document_build', 'academic_deliverable'];
    
    for (const classification of testClassifications) {
      const project = projectsByClassification[classification];
      
      if (!project) {
        console.log(`\n⚠️  No ${classification} project found, skipping...`);
        continue;
      }

      console.log('\n' + '═'.repeat(80));
      console.log(`Testing: ${classification.toUpperCase()}`);
      console.log(`Project: ${project.name}`);
      console.log('═'.repeat(80));
      console.log('');

      // Parse context
      const context = JSON.parse(project.context || '{}');

      // Prepare project object for continuation
      const projectData = {
        id: project.id,
        name: project.name,
        description: project.description,
        progress: project.progress,
        status: project.status,
        userId: project.userId,
        context: context,
      };

      // Run continuation
      const result = await continueWork(projectData, {
        maxTokens: 4000, // Increase for better output
      });

      if (result.success) {
        console.log('\n📄 OUTPUT PREVIEW:');
        console.log('─'.repeat(80));
        console.log(result.content.slice(0, 1000));
        if (result.content.length > 1000) {
          console.log('\n... (truncated, see full output in file)');
        }
        console.log('─'.repeat(80));
        console.log(`\n✅ Full output saved to: ${result.outputPath}`);
        console.log(`📊 Tokens used: ${result.tokensUsed}`);
      }

      // Wait a bit between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n' + '━'.repeat(80));
    console.log('✅ All tests complete!');
    console.log('━'.repeat(80));
    console.log('\nCompare the outputs in /data/continuations/ to see the difference:');
    console.log('  - code_build: Should contain actual, copy-pasteable code');
    console.log('  - document_build: Should contain real prose, not outlines');
    console.log('  - academic_deliverable: Should contain actual academic work');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.$disconnect();
  }
}

main();
