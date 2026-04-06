/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Test the work continuation agent on real project data
 * DEPENDENCIES: continue-work.mjs, NightShift backend
 * STATUS: Test script
 *
 * Usage:
 *   node orchestration/test-continue.mjs
 *   node orchestration/test-continue.mjs --dry-run
 *   node orchestration/test-continue.mjs --project-id=PROJECT_ID
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory (root of project)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { continueWork } from './continue-work.mjs';

// ─── Config ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const PROJECT_ID_ARG = args.find(a => a.startsWith('--project-id='))?.split('=')[1];
const USER_ID_ARG = args.find(a => a.startsWith('--user-id='))?.split('=')[1];
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Default user ID (from memory: user_3Bge5cdx4LkgxWgYXeYlU6Tm42a → cmndvesaa000011r5gk3avaoo)
const USER_ID = USER_ID_ARG || 'cmndvesaa000011r5gk3avaoo';

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧪 NightShift Continuation Agent Test');
  console.log('');

  // Step 1: Fetch projects from the API
  console.log('📡 Fetching projects from internal API...');
  const projectsResponse = await fetch(`${API_URL}/api/internal/projects?userId=${USER_ID}`);
  
  if (!projectsResponse.ok) {
    console.error(`❌ Failed to fetch projects: ${projectsResponse.status} ${projectsResponse.statusText}`);
    process.exit(1);
  }

  const projectsData = await projectsResponse.json();
  const projects = projectsData.data?.projects || projectsData.data || [];

  if (projects.length === 0) {
    console.error('❌ No projects found in the database.');
    console.error('   Run: npx tsx scripts/detect-projects.ts');
    process.exit(1);
  }

  console.log(`✅ Found ${projects.length} projects`);
  console.log('');

  // Step 2: Select project to continue
  let selectedProject;

  if (PROJECT_ID_ARG) {
    // Use specified project ID
    selectedProject = projects.find(p => p.id === PROJECT_ID_ARG);
    if (!selectedProject) {
      console.error(`❌ Project with ID ${PROJECT_ID_ARG} not found`);
      process.exit(1);
    }
    console.log(`🎯 Using specified project: ${selectedProject.name}`);
  } else {
    // Find the project with the lowest progress percentage (most in need of work)
    const inProgressProjects = projects.filter(p => p.status !== 'completed');
    
    if (inProgressProjects.length === 0) {
      console.error('❌ No in-progress projects found. All projects are completed!');
      process.exit(1);
    }

    selectedProject = inProgressProjects.reduce((lowest, current) => 
      current.progress < lowest.progress ? current : lowest
    );

    console.log(`🎯 Selected project with lowest progress: ${selectedProject.name} (${selectedProject.progress}%)`);
  }

  console.log('');
  console.log('📋 Project Details:');
  console.log(`   Name: ${selectedProject.name}`);
  console.log(`   Description: ${selectedProject.description || 'N/A'}`);
  console.log(`   Status: ${selectedProject.status}`);
  console.log(`   Progress: ${selectedProject.progress}%`);
  console.log(`   Last Active: ${selectedProject.lastActive}`);
  
  // Parse context if it's a string
  let context = selectedProject.context;
  if (typeof context === 'string') {
    try {
      context = JSON.parse(context);
    } catch (err) {
      console.warn('   ⚠️  Failed to parse context JSON');
      context = {};
    }
  }

  if (context?.nextStep) {
    console.log(`   Next Step: ${context.nextStep}`);
  }
  if (context?.keyTopics?.length > 0) {
    console.log(`   Key Topics: ${context.keyTopics.join(', ')}`);
  }

  console.log('');

  // Step 3: Run the continuation agent
  if (DRY_RUN) {
    console.log('🏃 Running in DRY RUN mode (no files saved, no actions logged)');
    console.log('');
  }

  try {
    const result = await continueWork(
      {
        ...selectedProject,
        context: context || {},
      },
      {
        apiKey: process.env.ANTHROPIC_API_KEY,
        apiUrl: API_URL,
        dryRun: DRY_RUN,
      }
    );

    if (result.success) {
      console.log('');
      console.log('🎉 Success! NightShift produced work output.');
      
      if (!DRY_RUN) {
        console.log('');
        console.log('📂 Output saved to:');
        console.log(`   ${result.outputPath}`);
        console.log('');
        console.log('💡 Next steps:');
        console.log('   1. Review the generated continuation file');
        console.log('   2. Check the dashboard to see the logged action');
        console.log('   3. Run this again on other projects to see NightShift work on multiple tasks');
      } else {
        console.log('');
        console.log('─── Generated Content Preview (first 800 chars) ───');
        console.log(result.content.slice(0, 800));
        if (result.content.length > 800) {
          console.log('...');
          console.log(`(${result.content.length - 800} more characters)`);
        }
        console.log('───────────────────────────────────────────────────');
      }
    }
  } catch (error) {
    console.error('');
    console.error('❌ Error running continuation agent:');
    console.error(error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
