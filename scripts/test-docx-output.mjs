/**
 * Test script to verify .docx output generation
 */

import { continueWork } from '../orchestration/continue-work.mjs';
import db from '../src/lib/db.js';

console.log('🧪 Testing .docx Output Generation');
console.log('');

// Find a document_build or academic_deliverable project
const projects = await db.project.findMany({
  where: {
    OR: [
      { context: { contains: 'document_build' } },
      { context: { contains: 'academic_deliverable' } }
    ]
  },
  take: 2
});

if (projects.length === 0) {
  console.log('❌ No document or academic projects found in database');
  process.exit(1);
}

console.log(`Found ${projects.length} projects to test:`);
projects.forEach(p => {
  const ctx = p.context ? JSON.parse(p.context) : {};
  console.log(`  - ${p.name} (${ctx.classification})`);
});
console.log('');

for (const project of projects) {
  const ctx = project.context ? JSON.parse(project.context) : {};
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Testing: ${project.name}`);
  console.log(`Classification: ${ctx.classification}`);
  console.log('');
  
  try {
    const result = await continueWork(
      {
        id: project.id,
        name: project.name,
        description: project.description,
        progress: project.progress,
        context: ctx,
        userId: project.userId,
      },
      {
        maxTokens: 500, // Keep it short for testing
        dryRun: false, // Actually save the file
      }
    );
    
    console.log('✅ Success!');
    console.log(`📄 Output saved to: ${result.outputPath}`);
    console.log(`📊 Tokens used: ${result.tokensUsed}`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('');
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Test complete! Check C:\\Users\\royce\\Documents\\NightShift for .docx files');

process.exit(0);
