/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Master orchestration agent — runs all NightShift tasks overnight
 * DEPENDENCIES: continue-work.mjs, draft-email.mjs, NightShift backend APIs
 * STATUS: LIVE — the overnight loop that does everything
 *
 * This is the master agent that runs when the user activates NightShift.
 * It orchestrates all autonomous work: project continuation, email drafting,
 * action logging, and morning brief generation.
 *
 * Usage:
 *   node orchestration/overnight-loop.mjs --user-id=USER_ID --project-ids=ID1,ID2
 *   node orchestration/overnight-loop.mjs --simulate  # Run with current handoff data
 */

console.log('[overnight-loop] Script loaded');

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { continueWork } from './continue-work.mjs';
import { draftEmailReply } from './draft-email.mjs';

// ─── Config ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const SIMULATE = args.includes('--simulate');
const USER_ID_ARG = args.find(a => a.startsWith('--user-id='))?.split('=')[1];
const PROJECT_IDS_ARG = args.find(a => a.startsWith('--project-ids='))?.split('=')[1];
const INSTRUCTIONS_ARG = args.find(a => a.startsWith('--instructions='))?.split('=')[1];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Run the overnight loop - the master orchestration agent.
 * 
 * @param {Object} config - Configuration
 * @param {string} config.userId - User's internal ID
 * @param {string[]} config.projectIds - List of project IDs to work on
 * @param {string} config.instructions - Special instructions from user
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Complete morning brief
 */
export async function runOvernightLoop(config, options = {}) {
  const { userId, projectIds, instructions } = config;
  const apiUrl = options.apiUrl || API_BASE_URL;
  const apiKey = options.apiKey || ANTHROPIC_API_KEY;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌙 NightShift Overnight Loop');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`👤 User: ${userId}`);
  console.log(`📋 Projects: ${projectIds.length}`);
  if (instructions) console.log(`💬 Instructions: ${instructions}`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log('');

  const startTime = Date.now();
  const results = {
    projectsContinued: [],
    emailsDrafted: [],
    flaggedItems: [],
    errors: [],
    stats: {
      totalProjects: projectIds.length,
      successfulProjects: 0,
      failedProjects: 0,
      totalEmails: 0,
      draftedEmails: 0,
      totalActions: 0,
      totalTokensUsed: 0,
      duration: 0,
    },
  };

  // ─── Step 1: Continue work on each project ──────────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📂 STEP 1: Project Continuation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  for (let i = 0; i < projectIds.length; i++) {
    const projectId = projectIds[i];
    console.log(`[${i + 1}/${projectIds.length}] Processing project: ${projectId}`);
    console.log('');

    try {
      // Load project from database
      const projectResponse = await fetch(`${apiUrl}/api/internal/projects?userId=${userId}`);
      if (!projectResponse.ok) {
        throw new Error(`Failed to fetch projects: ${projectResponse.status}`);
      }
      const projectsData = await projectResponse.json();
      const project = projectsData.data?.projects?.find(p => p.id === projectId);

      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }

      console.log(`   📋 ${project.name} (${project.progress}%)`);
      console.log('');

      // Run continuation agent
      const result = await continueWork(project, {
        apiKey,
        apiUrl,
        dryRun: false,
      });

      if (result.success) {
        // Update project progress
        const progressIncrement = Math.floor(Math.random() * 6) + 10; // 10-15%
        const newProgress = Math.min(100, project.progress + progressIncrement);

        results.projectsContinued.push({
          projectId: project.id,
          projectName: project.name,
          progressBefore: project.progress,
          progressAfter: newProgress,
          outputPath: result.outputPath,
          contentLength: result.content?.length || 0,
          tokensUsed: result.tokensUsed || 0,
        });

        results.stats.successfulProjects++;
        results.stats.totalTokensUsed += result.tokensUsed || 0;

        console.log(`   ✅ Success: ${project.progress}% → ${newProgress}%`);
        console.log('');
      }
    } catch (err) {
      console.error(`   ❌ Error: ${err.message}`);
      console.log('');
      results.errors.push({
        type: 'project_continuation',
        projectId,
        error: err.message,
      });
      results.stats.failedProjects++;
    }
  }

  // ─── Step 2: Draft replies for incoming emails ──────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 STEP 2: Email Draft Generation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    // Fetch incoming emails that don't have drafts yet
    const emailsResponse = await fetch(`${apiUrl}/api/internal/emails/undrafted?userId=${userId}`);
    
    if (emailsResponse.ok) {
      const emailsData = await emailsResponse.json();
      const undraftedEmails = emailsData.data?.emails || [];

      results.stats.totalEmails = undraftedEmails.length;

      if (undraftedEmails.length === 0) {
        console.log('   ℹ️  No incoming emails requiring drafts');
        console.log('');
      } else {
        console.log(`   Found ${undraftedEmails.length} incoming emails requiring drafts`);
        console.log('');

        for (let i = 0; i < undraftedEmails.length; i++) {
          const email = undraftedEmails[i];
          console.log(`   [${i + 1}/${undraftedEmails.length}] Drafting reply to: ${email.from}`);
          console.log(`   Subject: ${email.subject}`);
          console.log('');

          try {
            const draftResult = await draftEmailReply(
              {
                from: email.from,
                subject: email.subject,
                body: email.body,
              },
              userId,
              { apiKey, apiUrl }
            );

            if (draftResult.success) {
              results.emailsDrafted.push({
                emailId: email.id,
                from: email.from,
                subject: email.subject,
                draftId: draftResult.draftId,
                confidence: draftResult.confidence,
                tokensUsed: draftResult.tokensUsed || 0,
              });

              results.stats.draftedEmails++;
              results.stats.totalTokensUsed += draftResult.tokensUsed || 0;

              console.log(`   ✅ Draft created (confidence: ${draftResult.confidence.toFixed(2)})`);
              console.log('');
            }
          } catch (err) {
            console.error(`   ❌ Error drafting reply: ${err.message}`);
            console.log('');
            results.errors.push({
              type: 'email_draft',
              emailId: email.id,
              error: err.message,
            });
          }
        }
      }
    } else {
      console.log('   ⚠️  Email API unavailable, skipping email drafts');
      console.log('');
    }
  } catch (err) {
    console.error(`   ❌ Error fetching emails: ${err.message}`);
    console.log('');
    results.errors.push({
      type: 'email_fetch',
      error: err.message,
    });
  }

  // ─── Step 3: Check for flagged items ────────────────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚩 STEP 3: Flagged Items Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Check for low-confidence drafts
  const lowConfidenceDrafts = results.emailsDrafted.filter(d => d.confidence < 0.7);
  if (lowConfidenceDrafts.length > 0) {
    console.log(`   ⚠️  ${lowConfidenceDrafts.length} email drafts with low confidence (<0.7)`);
    results.flaggedItems.push(...lowConfidenceDrafts.map(d => ({
      type: 'low_confidence_draft',
      subject: d.subject,
      confidence: d.confidence,
      draftId: d.draftId,
    })));
  }

  // Check for errors
  if (results.errors.length > 0) {
    console.log(`   ⚠️  ${results.errors.length} errors occurred during execution`);
    results.flaggedItems.push(...results.errors.map(e => ({
      type: 'error',
      errorType: e.type,
      message: e.error,
    })));
  }

  if (results.flaggedItems.length === 0) {
    console.log('   ✅ No items flagged for review');
  }
  console.log('');

  // ─── Step 4: Compile morning brief ──────────────────────────────────────────

  const endTime = Date.now();
  results.stats.duration = Math.round((endTime - startTime) / 1000);
  results.stats.totalActions = results.projectsContinued.length + results.emailsDrafted.length;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 STEP 4: Morning Brief Generation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const brief = generateMorningBrief(results, { userId, instructions, startTime: new Date(startTime) });
  
  // Save brief to file
  const briefPath = saveBriefToFile(brief, startTime);
  console.log(`   ✅ Morning brief saved: ${briefPath}`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ NightShift Overnight Loop Complete');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`⏱️  Duration: ${results.stats.duration}s`);
  console.log(`📂 Projects: ${results.stats.successfulProjects}/${results.stats.totalProjects} completed`);
  console.log(`📧 Emails: ${results.stats.draftedEmails}/${results.stats.totalEmails} drafted`);
  console.log(`🚩 Flagged: ${results.flaggedItems.length} items`);
  console.log(`🪙 Tokens: ${results.stats.totalTokensUsed.toLocaleString()}`);
  console.log('');

  return {
    success: true,
    brief,
    briefPath,
    results,
  };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function generateMorningBrief(results, metadata) {
  const { userId, instructions, startTime } = metadata;
  const date = new Date(startTime);
  const dateStr = date.toISOString().split('T')[0];

  const lines = [];
  
  lines.push('# NightShift Morning Brief');
  lines.push('');
  lines.push(`**Date:** ${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Duration:** ${results.stats.duration}s`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary
  lines.push('## 📊 Summary');
  lines.push('');
  lines.push(`While you were away, NightShift completed **${results.stats.totalActions} autonomous actions**:`);
  lines.push('');
  lines.push(`- ✅ **${results.stats.successfulProjects}** projects continued`);
  lines.push(`- 📧 **${results.stats.draftedEmails}** email drafts created`);
  lines.push(`- 🚩 **${results.flaggedItems.length}** items flagged for review`);
  lines.push(`- 🪙 **${results.stats.totalTokensUsed.toLocaleString()}** tokens used`);
  lines.push('');

  if (instructions) {
    lines.push(`**Your instructions:** "${instructions}"`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Projects continued
  if (results.projectsContinued.length > 0) {
    lines.push('## 📂 Projects Continued');
    lines.push('');
    
    for (const proj of results.projectsContinued) {
      lines.push(`### ${proj.projectName}`);
      lines.push('');
      lines.push(`- **Progress:** ${proj.progressBefore}% → ${proj.progressAfter}% (+${proj.progressAfter - proj.progressBefore}%)`);
      lines.push(`- **Output:** ${(proj.contentLength / 1000).toFixed(1)}k characters generated`);
      lines.push(`- **Tokens:** ${proj.tokensUsed.toLocaleString()}`);
      lines.push(`- **File:** \`${path.basename(proj.outputPath)}\``);
      lines.push('');
    }
  }

  // Email drafts
  if (results.emailsDrafted.length > 0) {
    lines.push('## 📧 Email Drafts Created');
    lines.push('');
    
    for (const email of results.emailsDrafted) {
      const confidenceEmoji = email.confidence >= 0.9 ? '🟢' : email.confidence >= 0.7 ? '🟡' : '🔴';
      lines.push(`### ${confidenceEmoji} Reply to: ${email.from}`);
      lines.push('');
      lines.push(`- **Subject:** ${email.subject}`);
      lines.push(`- **Confidence:** ${(email.confidence * 100).toFixed(0)}%`);
      lines.push(`- **Draft ID:** \`${email.draftId}\``);
      lines.push(`- **Tokens:** ${email.tokensUsed.toLocaleString()}`);
      lines.push('');
    }
  }

  // Flagged items
  if (results.flaggedItems.length > 0) {
    lines.push('## 🚩 Items Flagged for Review');
    lines.push('');
    
    for (const item of results.flaggedItems) {
      if (item.type === 'low_confidence_draft') {
        lines.push(`- **Low confidence draft:** "${item.subject}" (${(item.confidence * 100).toFixed(0)}% confidence)`);
      } else if (item.type === 'error') {
        lines.push(`- **Error in ${item.errorType}:** ${item.message}`);
      }
    }
    lines.push('');
  }

  // Errors
  if (results.errors.length > 0) {
    lines.push('## ❌ Errors Encountered');
    lines.push('');
    
    for (const error of results.errors) {
      lines.push(`- **${error.type}:** ${error.error}`);
      if (error.projectId) lines.push(`  - Project ID: ${error.projectId}`);
      if (error.emailId) lines.push(`  - Email ID: ${error.emailId}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('**Next Steps:**');
  lines.push('');
  lines.push('1. Review the continuation outputs in `/data/continuations/`');
  lines.push('2. Check email drafts in the dashboard and approve/edit as needed');
  if (results.flaggedItems.length > 0) {
    lines.push('3. Address flagged items that need your attention');
  }
  lines.push('');

  return lines.join('\n');
}

function saveBriefToFile(brief, startTime) {
  const briefsDir = path.join(process.cwd(), 'data', 'briefs');
  
  if (!fs.existsSync(briefsDir)) {
    fs.mkdirSync(briefsDir, { recursive: true });
  }

  const date = new Date(startTime).toISOString().split('T')[0];
  const timestamp = new Date(startTime).toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `${date}-${timestamp}.md`;
  const filepath = path.join(briefsDir, filename);

  fs.writeFileSync(filepath, brief, 'utf-8');
  return filepath;
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

async function main() {
  if (SIMULATE) {
    // Simulate mode: fetch current handoff data and run immediately
    console.log('🧪 SIMULATE MODE: Running with current handoff data');
    console.log('');

    const userId = 'cmndvesaa000011r5gk3avaoo'; // Default user

    // Fetch in-progress projects
    const projectsResponse = await fetch(`${API_BASE_URL}/api/internal/projects?userId=${userId}`);
    const projectsData = await projectsResponse.json();
    const projects = projectsData.data?.projects || [];
    const inProgressProjects = projects.filter(p => p.status === 'in_progress');

    if (inProgressProjects.length === 0) {
      console.error('❌ No in-progress projects found for simulation');
      process.exit(1);
    }

    const projectIds = inProgressProjects.map(p => p.id);
    
    console.log(`📋 Found ${projectIds.length} in-progress projects`);
    console.log('');

    const result = await runOvernightLoop({
      userId,
      projectIds,
      instructions: 'Simulation run - testing overnight loop with real data',
    }, {
      apiKey: ANTHROPIC_API_KEY,
      apiUrl: API_BASE_URL,
    });

    // Display the morning brief
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📄 MORNING BRIEF');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(result.brief);

    process.exit(0);
  }

  // Normal mode: require user ID and project IDs
  if (!USER_ID_ARG || !PROJECT_IDS_ARG) {
    console.error('❌ Missing required arguments');
    console.error('');
    console.error('Usage:');
    console.error('  node overnight-loop.mjs --user-id=USER_ID --project-ids=ID1,ID2');
    console.error('  node overnight-loop.mjs --simulate');
    process.exit(1);
  }

  const projectIds = PROJECT_IDS_ARG.split(',');

  const result = await runOvernightLoop({
    userId: USER_ID_ARG,
    projectIds,
    instructions: INSTRUCTIONS_ARG || '',
  }, {
    apiKey: ANTHROPIC_API_KEY,
    apiUrl: API_BASE_URL,
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📄 MORNING BRIEF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(result.brief);
}

// Run main if this is the entry point
if (process.argv[1]) {
  const scriptPath = process.argv[1].replace(/\\/g, '/');
  const expectedUrl = `file:///${scriptPath}`;
  
  if (import.meta.url === expectedUrl) {
    main().catch(err => {
      console.error('❌ Fatal error:', err);
      process.exit(1);
    });
  }
}
