/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Complete data refresh pipeline orchestrator
 * DEPENDENCIES: scrape-canvas.mjs, embed-chat-history.ts, detect-projects.ts
 * STATUS: LIVE — runs entire refresh pipeline in one command
 *
 * This script orchestrates the complete NightShift data refresh pipeline:
 * 1. Scrape Canvas for new assignments
 * 2. Embed any new un-embedded messages
 * 3. Run project detection in incremental mode
 * 4. Classify all projects for current categories
 * 5. Print summary of what was refreshed
 *
 * Usage:
 *   node orchestration/refresh-all.mjs
 *   node orchestration/refresh-all.mjs --watch  # Re-run every 15 minutes
 *   node orchestration/refresh-all.mjs --user-id=USER_ID
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ─── Config ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const WATCH_MODE = args.includes('--watch');
const USER_ID = args.find(a => a.startsWith('--user-id='))?.split('=')[1] || 'cmndvesaa000011r5gk3avaoo';
const WATCH_INTERVAL = 15 * 60 * 1000; // 15 minutes

// ─── Helper Functions ────────────────────────────────────────────────────────

function log(msg) {
  console.log(`[refresh] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: cwd || process.cwd(),
      stdio: 'pipe',
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

function extractNumber(text, pattern) {
  const match = text.match(pattern);
  return match ? parseInt(match[1], 10) : 0;
}

// ─── Main Pipeline ───────────────────────────────────────────────────────────

async function runRefreshPipeline() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 NightShift Data Refresh Pipeline');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`👤 User: ${USER_ID}`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log('');

  const stats = {
    newMessages: 0,
    vectorsCreated: 0,
    projectsUpdated: 0,
    deadlinesFound: 0,
  };

  try {
    // Step 1: Scrape Canvas for new assignments
    log('Step 1/4: Scraping Canvas for new assignments...');
    try {
      const canvasResult = await runCommand(
        'node',
        ['orchestration/scrape-canvas.mjs', `--user-id=${USER_ID}`],
        process.cwd()
      );
      
      // Extract message count from output
      const messageMatch = canvasResult.stdout.match(/Total messages to ingest: (\d+)/);
      if (messageMatch) {
        stats.newMessages = parseInt(messageMatch[1], 10);
        log(`✅ Canvas: ${stats.newMessages} new messages`);
      } else {
        log('✅ Canvas: No new messages');
      }
    } catch (err) {
      // Canvas scrape might fail if no credentials - that's okay
      if (err.message.includes('No Canvas credentials')) {
        log('⏭️  Canvas: No credentials configured (skipped)');
      } else {
        log(`⚠️  Canvas scrape failed: ${err.message}`);
      }
    }

    // Step 2: Embed any new un-embedded messages
    log('Step 2/4: Embedding new messages...');
    try {
      const embedResult = await runCommand(
        'npx',
        ['tsx', 'scripts/embed-chat-history.ts'],
        process.cwd()
      );
      
      // Extract embedded count from output
      const embeddedMatch = embedResult.stdout.match(/Done! Embedded (\d+) messages/);
      if (embeddedMatch) {
        stats.vectorsCreated = parseInt(embeddedMatch[1], 10);
        log(`✅ Embedded: ${stats.vectorsCreated} vectors created`);
      } else {
        log('✅ Embedded: No new messages to embed');
      }
    } catch (err) {
      log(`❌ Embedding failed: ${err.message}`);
    }

    // Step 3: Run project detection in incremental mode
    log('Step 3/4: Detecting projects (incremental mode)...');
    try {
      const detectResult = await runCommand(
        'npx',
        ['tsx', 'scripts/detect-projects.ts'],
        process.cwd()
      );
      
      // Extract project counts from output
      const createdMatch = detectResult.stdout.match(/Created: (\d+)/);
      const updatedMatch = detectResult.stdout.match(/Updated: (\d+)/);
      const created = createdMatch ? parseInt(createdMatch[1], 10) : 0;
      const updated = updatedMatch ? parseInt(updatedMatch[1], 10) : 0;
      stats.projectsUpdated = created + updated;
      
      log(`✅ Projects: ${created} created, ${updated} updated`);
    } catch (err) {
      log(`❌ Project detection failed: ${err.message}`);
    }

    // Step 4: Count Canvas deadlines (from database)
    log('Step 4/4: Counting Canvas deadlines...');
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_URL}/api/chat-history/stats`);
      const data = await response.json();
      
      if (data.success && data.data.sources) {
        stats.deadlinesFound = data.data.sources.canvas || 0;
        log(`✅ Deadlines: ${stats.deadlinesFound} Canvas items in database`);
      }
    } catch (err) {
      log(`⚠️  Could not count deadlines: ${err.message}`);
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Refresh Complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    // One-line summary
    const summary = `Refreshed: ${stats.newMessages} new messages, ${stats.vectorsCreated} vectors created, ${stats.projectsUpdated} projects updated, ${stats.deadlinesFound} deadlines found.`;
    console.log(summary);
    console.log('');

    return stats;
  } catch (err) {
    console.error('❌ Refresh pipeline failed:', err);
    throw err;
  }
}

// ─── Watch Mode ──────────────────────────────────────────────────────────────

async function watchMode() {
  console.log('👁️  WATCH MODE: Will refresh every 15 minutes');
  console.log('   Press Ctrl+C to stop');
  console.log('');

  while (true) {
    try {
      await runRefreshPipeline();
    } catch (err) {
      console.error('❌ Pipeline error:', err.message);
    }

    console.log(`⏳ Waiting 15 minutes until next refresh...`);
    console.log('');
    await new Promise(resolve => setTimeout(resolve, WATCH_INTERVAL));
  }
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

async function main() {
  if (WATCH_MODE) {
    await watchMode();
  } else {
    await runRefreshPipeline();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
