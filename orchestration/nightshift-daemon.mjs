/**
 * NightShift Autonomous Daemon
 * 
 * The main background process that runs NightShift autonomously.
 * 
 * Features:
 * - Every 15 minutes: Refresh all data (Canvas, embeddings, project detection)
 * - At bedtime (default 11pm): Run overnight loop on handoff queue or top 3 projects
 * - At wake time (default 7am): Generate morning brief and email it
 * - Logs everything to /data/logs/daemon-{date}.log
 * - API endpoints for status, start, and stop
 * 
 * Usage:
 *   node orchestration/nightshift-daemon.mjs
 *   node orchestration/nightshift-daemon.mjs --test  # Compressed schedule for testing
 */

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveInternalUserId } from './user-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

// ─── Config ──────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));
const TEST_MODE = args.test !== undefined;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const USER_ID = args['user-id'];

// Schedule configuration
const SCHEDULE = TEST_MODE ? {
  REFRESH_INTERVAL: 30 * 1000,      // 30 seconds in test mode
  OVERNIGHT_DELAY: 2 * 60 * 1000,   // 2 minutes in test mode
  BRIEF_DELAY: 3 * 60 * 1000,       // 3 minutes in test mode
  BEDTIME_HOUR: null,               // Use delays instead
  WAKE_HOUR: null,
} : {
  REFRESH_INTERVAL: 15 * 60 * 1000, // 15 minutes
  OVERNIGHT_DELAY: null,
  BRIEF_DELAY: null,
  BEDTIME_HOUR: 23,                 // 11pm
  WAKE_HOUR: 7,                     // 7am
};

// State tracking
const state = {
  running: false,
  pid: process.pid,
  lastRefresh: null,
  lastOvernightRun: null,
  lastBriefGenerated: null,
  nextOvernightRun: null,
  nextBrief: null,
  startTime: null,
  refreshCount: 0,
  overnightRunCount: 0,
  briefCount: 0,
  lastUpdate: null,
};
let RESOLVED_USER_ID = null;

// Logging
let logStream = null;

function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      result[key] = val ?? '';
    }
  }
  return result;
}

// ─── Logging ─────────────────────────────────────────────────────────────────

function initializeLogging() {
  const logsDir = path.join(process.cwd(), 'data', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const logPath = path.join(logsDir, `daemon-${date}.log`);
  
  logStream = fs.createWriteStream(logPath, { flags: 'a' });
  
  return logPath;
}

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] ${message}`;
  
  console.log(logLine);
  
  if (logStream) {
    logStream.write(logLine + '\n');
  }
}

function writeStatusFile() {
  try {
    const statusDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(statusDir)) {
      fs.mkdirSync(statusDir, { recursive: true });
    }
    
    const statusPath = path.join(statusDir, 'daemon-status.json');
    state.lastUpdate = new Date().toISOString();
    
    fs.writeFileSync(statusPath, JSON.stringify({
      ...state,
      testMode: TEST_MODE,
      refreshInterval: SCHEDULE.REFRESH_INTERVAL,
    }, null, 2));
  } catch (err) {
    logError('Failed to write status file', err);
  }
}

function logError(message, error) {
  const errorMsg = error ? `${message}: ${error.message}` : message;
  log(errorMsg, 'ERROR');
  if (error && error.stack) {
    log(error.stack, 'ERROR');
  }
}

// ─── Configuration ───────────────────────────────────────────────────────────

async function loadDaemonConfig() {
  const configPath = path.join(process.cwd(), 'data', 'daemon-config.json');
  
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      log(`Loaded daemon config: bedtime=${config.bedtimeHour}, waketime=${config.wakeHour}`);
      return config;
    } catch (err) {
      logError('Failed to load daemon config, using defaults', err);
    }
  }
  
  // Try to fetch from User model
  try {
    const res = await fetch(`${API_BASE_URL}/api/internal/user-config?userId=${RESOLVED_USER_ID}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data) {
        const wakeHour = parseInt(data.data.wakeTime?.split(':')[0] || '7');
        const bedtimeHour = wakeHour >= 8 ? wakeHour - 8 : wakeHour + 16;
        
        log(`Loaded config from User model: bedtime=${bedtimeHour}, waketime=${wakeHour}`);
        return { bedtimeHour, wakeHour };
      }
    }
  } catch (err) {
    logError('Failed to fetch user config', err);
  }
  
  // Default config
  return {
    bedtimeHour: SCHEDULE.BEDTIME_HOUR || 23,
    wakeHour: SCHEDULE.WAKE_HOUR || 7,
  };
}

// ─── Refresh Logic ───────────────────────────────────────────────────────────

async function runRefresh() {
  log('Starting refresh cycle...');
  const startTime = Date.now();
  
  try {
    // Step 1: Scrape Canvas
    log('  → Scraping Canvas for new assignments...');
    try {
      await execAsync(`node orchestration/scrape-canvas.mjs --user-id=${RESOLVED_USER_ID}`);
      log('  ✅ Canvas scrape complete');
    } catch (err) {
      logError('  ⚠️  Canvas scrape failed', err);
    }
    
    // Step 2: Embed new messages
    log('  → Embedding new messages...');
    try {
      const { stdout } = await execAsync('npx tsx scripts/embed-chat-history.ts');
      const match = stdout.match(/Embedded (\d+) messages/);
      const count = match ? parseInt(match[1]) : 0;
      log(`  ✅ Embedded ${count} new messages`);
    } catch (err) {
      logError('  ⚠️  Embedding failed', err);
    }
    
    // Step 3: Run incremental project detection
    log('  → Running project detection...');
    try {
      const { stdout } = await execAsync('npx tsx scripts/detect-projects.ts');
      const match = stdout.match(/Detected (\d+) projects/);
      const count = match ? parseInt(match[1]) : 0;
      log(`  ✅ Detected ${count} projects`);
    } catch (err) {
      logError('  ⚠️  Project detection failed', err);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    state.lastRefresh = new Date().toISOString();
    state.refreshCount++;
    
    log(`Refresh cycle complete in ${duration}s`);
    writeStatusFile();
    
  } catch (err) {
    logError('Refresh cycle failed', err);
  }
}

// ─── Overnight Loop ──────────────────────────────────────────────────────────

async function runOvernightLoop() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('Starting overnight loop...');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const startTime = Date.now();
  
  try {
    // Fetch projects from handoff queue
    log('  → Fetching handoff queue...');
    const res = await fetch(`${API_BASE_URL}/api/projects?userId=${RESOLVED_USER_ID}`);
    const data = await res.json();
    
    if (!data.success) {
      throw new Error('Failed to fetch projects');
    }
    
    const projects = data.data?.projects || [];
    const inProgress = projects.filter(p => p.status === 'in_progress');
    
    log(`  Found ${inProgress.length} in-progress projects`);
    
    let projectsToRun = [];
    
    if (inProgress.length === 0) {
      log('  No projects in handoff queue, auto-selecting top 3...');
      
      // Auto-select top 3 by classification and priority
      const allProjects = projects.filter(p => p.status !== 'completed');
      
      // Use the classification system from overnight-loop.mjs
      const classified = allProjects.map(p => ({
        ...p,
        classification: classifyProject(p),
      }));
      
      const continuable = classified.filter(p => 
        ['code_build', 'document_build', 'academic_deliverable'].includes(p.classification)
      );
      
      const codeBuilds = continuable.filter(p => p.classification === 'code_build');
      const documentBuilds = continuable.filter(p => p.classification === 'document_build');
      const academicDeliverables = continuable.filter(p => p.classification === 'academic_deliverable');
      
      projectsToRun = [
        ...codeBuilds,
        ...documentBuilds,
        ...academicDeliverables.slice(0, 1),
      ].slice(0, 3);
      
      log(`  Auto-selected ${projectsToRun.length} projects: ${projectsToRun.map(p => p.name).join(', ')}`);
    } else {
      projectsToRun = inProgress.slice(0, 3);
      log(`  Using handoff queue: ${projectsToRun.map(p => p.name).join(', ')}`);
    }
    
    if (projectsToRun.length === 0) {
      log('  No projects to run overnight loop on');
      state.lastOvernightRun = new Date().toISOString();
      state.overnightRunCount++;
      writeStatusFile();
      return;
    }
    
    // Run overnight loop
    log(`  → Running overnight loop on ${projectsToRun.length} projects...`);
    
    const projectIds = projectsToRun.map(p => p.id).join(',');
    const cmd = `node orchestration/overnight-loop.mjs --simulate --projects=${projectIds}`;
    
    await execAsync(cmd);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    state.lastOvernightRun = new Date().toISOString();
    state.overnightRunCount++;
    
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    log(`Overnight loop complete in ${duration}s - ${projectsToRun.length} projects continued`);
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    writeStatusFile();
    
  } catch (err) {
    logError('Overnight loop failed', err);
  }
}

// Project classification (from overnight-loop.mjs)
function classifyProject(project) {
  const name = project.name.toLowerCase();
  const description = (project.description || '').toLowerCase();
  const combined = `${name} ${description}`.toLowerCase();

  if (combined.match(/\b(trip|adventure|travel|peru|empanada|merchandise|sorority|adpi)\b/)) {
    return 'casual';
  }

  if (combined.match(/\b(study guide|exam|quiz|midterm|practice|review|prep)\b/)) {
    return 'academic_study';
  }

  if (combined.match(/\b(verification|test|quick|solved)\b/) && project.progress > 50) {
    return 'quick_task';
  }

  if (combined.match(/\b(homework|problem set|assignment|case study|deliverable|session \d+|abc|accounting|finance)\b/) ||
      (combined.match(/\b(presentation|paper)\b/) && combined.match(/\b(course|class|ent\d+|acc\d+|ecn\d+|mac)\b/))) {
    return 'academic_deliverable';
  }

  if (combined.match(/\b(nightshift|github|integration|setup|api|backend|frontend|deploy)\b/) ||
      (combined.match(/\b(website|web app|landing page|platform)\b/) && !combined.match(/\b(empanada|merchandise|sorority)\b/))) {
    return 'code_build';
  }

  if (combined.match(/\b(pitch deck|proposal|business plan|incubator|platform|model|presentation|analysis)\b/) &&
      !combined.match(/\b(study|exam|quiz|midterm|practice)\b/)) {
    return 'document_build';
  }

  return 'document_build';
}

// ─── Morning Brief ───────────────────────────────────────────────────────────

async function generateMorningBrief() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('Generating morning brief...');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const startTime = Date.now();
  
  try {
    // Generate brief via API
    log('  → Calling /api/brief...');
    const res = await fetch(`${API_BASE_URL}/api/brief`);
    const data = await res.json();
    
    if (!data.success) {
      throw new Error('Failed to generate brief');
    }
    
    const brief = data.data;
    log(`  ✅ Brief generated: ${brief.stats?.actionsCompleted || 0} actions, ${brief.stats?.upcomingDeadlines || 0} deadlines`);
    
    // Check if Gmail is connected
    log('  → Checking Gmail connection...');
    const gmailRes = await fetch(`${API_BASE_URL}/api/gmail/status`);
    const gmailData = await gmailRes.json();
    
    if (gmailData.success && gmailData.data?.connected) {
      log('  → Sending brief via email...');
      
      // Get user email
      const userRes = await fetch(`${API_BASE_URL}/api/internal/user?userId=${RESOLVED_USER_ID}`);
      const userData = await userRes.json();
      
      if (userData.success && userData.data?.email) {
        const emailRes = await fetch(`${API_BASE_URL}/api/gmail/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: userData.data.email,
            subject: `NightShift Morning Brief - ${new Date().toLocaleDateString()}`,
            body: formatBriefForEmail(brief),
          }),
        });
        
        if (emailRes.ok) {
          log('  ✅ Brief emailed successfully');
        } else {
          log('  ⚠️  Failed to email brief');
        }
      }
    } else {
      log('  ⚠️  Gmail not connected, skipping email');
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    state.lastBriefGenerated = new Date().toISOString();
    state.briefCount++;
    
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    log(`Morning brief complete in ${duration}s`);
    log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    writeStatusFile();
    
  } catch (err) {
    logError('Morning brief generation failed', err);
  }
}

function formatBriefForEmail(brief) {
  // Convert brief to plain text email format
  let email = `NightShift Morning Brief\n`;
  email += `${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
  email += `${brief.summary}\n\n`;
  email += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  email += `📂 Work Completed Overnight: ${brief.stats?.actionsCompleted || 0} actions\n\n`;
  email += `📅 Deadlines Coming Up: ${brief.stats?.upcomingDeadlines || 0} deadlines\n\n`;
  email += `📧 Emails Needing Attention: ${brief.stats?.emailsDrafted || 0} drafts\n\n`;
  email += `🎯 Today's Focus: ${brief.stats?.focusItems || 0} items\n\n`;
  
  email += `View full brief: ${API_BASE_URL}/dashboard\n`;
  
  return email;
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

async function calculateNextRuns(config) {
  const now = new Date();
  
  if (TEST_MODE) {
    // In test mode, use delays from start time
    const nextOvernight = new Date(state.startTime.getTime() + SCHEDULE.OVERNIGHT_DELAY);
    const nextBrief = new Date(state.startTime.getTime() + SCHEDULE.BRIEF_DELAY);
    
    state.nextOvernightRun = nextOvernight.toISOString();
    state.nextBrief = nextBrief.toISOString();
    
    log(`Test mode schedule:`);
    log(`  Next overnight run: ${nextOvernight.toLocaleTimeString()} (in ${Math.round((nextOvernight - now) / 1000)}s)`);
    log(`  Next brief: ${nextBrief.toLocaleTimeString()} (in ${Math.round((nextBrief - now) / 1000)}s)`);
  } else {
    // Calculate next bedtime
    const nextBedtime = new Date(now);
    nextBedtime.setHours(config.bedtimeHour, 0, 0, 0);
    if (nextBedtime <= now) {
      nextBedtime.setDate(nextBedtime.getDate() + 1);
    }
    
    // Calculate next wake time
    const nextWake = new Date(now);
    nextWake.setHours(config.wakeHour, 0, 0, 0);
    if (nextWake <= now) {
      nextWake.setDate(nextWake.getDate() + 1);
    }
    
    state.nextOvernightRun = nextBedtime.toISOString();
    state.nextBrief = nextWake.toISOString();
    
    log(`Production schedule:`);
    log(`  Next overnight run: ${nextBedtime.toLocaleString()}`);
    log(`  Next brief: ${nextWake.toLocaleString()}`);
  }
  
  writeStatusFile();
}

function shouldRunOvernight() {
  if (!state.nextOvernightRun) return false;
  
  const now = new Date();
  const scheduledTime = new Date(state.nextOvernightRun);
  const timeSinceScheduled = now - scheduledTime;
  
  // Run if we're past the scheduled time and haven't run in the last hour
  if (timeSinceScheduled > 0 && timeSinceScheduled < 60 * 60 * 1000) {
    if (!state.lastOvernightRun) return true;
    
    const lastRun = new Date(state.lastOvernightRun);
    if ((now - lastRun) > 60 * 60 * 1000) {
      return true;
    }
  }
  
  return false;
}

function shouldGenerateBrief() {
  if (!state.nextBrief) return false;
  
  const now = new Date();
  const scheduledTime = new Date(state.nextBrief);
  const timeSinceScheduled = now - scheduledTime;
  
  // Run if we're past the scheduled time and haven't run in the last hour
  if (timeSinceScheduled > 0 && timeSinceScheduled < 60 * 60 * 1000) {
    if (!state.lastBriefGenerated) return true;
    
    const lastBrief = new Date(state.lastBriefGenerated);
    if ((now - lastBrief) > 60 * 60 * 1000) {
      return true;
    }
  }
  
  return false;
}

// ─── Main Loop ───────────────────────────────────────────────────────────────

async function mainLoop() {
  const config = await loadDaemonConfig();
  await calculateNextRuns(config);
  
  // Initial refresh
  await runRefresh();
  
  // Set up refresh interval
  const refreshInterval = setInterval(async () => {
    if (!state.running) {
      clearInterval(refreshInterval);
      return;
    }
    
    await runRefresh();
  }, SCHEDULE.REFRESH_INTERVAL);
  
  // Main scheduler loop
  const schedulerInterval = setInterval(async () => {
    if (!state.running) {
      clearInterval(schedulerInterval);
      return;
    }
    
    // Check if it's time for overnight run
    if (shouldRunOvernight()) {
      await runOvernightLoop();
      
      // Recalculate next overnight run
      const config = await loadDaemonConfig();
      await calculateNextRuns(config);
    }
    
    // Check if it's time for morning brief
    if (shouldGenerateBrief()) {
      await generateMorningBrief();
      
      // Recalculate next brief
      const config = await loadDaemonConfig();
      await calculateNextRuns(config);
    }
  }, 10000); // Check every 10 seconds
  
  log('Daemon main loop started');
}

// ─── Daemon Control ──────────────────────────────────────────────────────────

async function startDaemon() {
  if (state.running) {
    log('Daemon already running');
    return;
  }
  
  RESOLVED_USER_ID = await resolveInternalUserId(USER_ID);
  state.running = true;
  state.startTime = new Date();
  
  const logPath = initializeLogging();
  
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('NightShift Daemon Starting');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`Mode: ${TEST_MODE ? 'TEST' : 'PRODUCTION'}`);
  log(`User: ${RESOLVED_USER_ID}`);
  log(`Refresh interval: ${SCHEDULE.REFRESH_INTERVAL / 1000}s`);
  log(`Log file: ${logPath}`);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  await mainLoop();
}

function stopDaemon() {
  if (!state.running) {
    log('Daemon not running');
    return;
  }
  
  state.running = false;
  
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('NightShift Daemon Stopping');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log(`Total runtime: ${((Date.now() - state.startTime) / 1000 / 60).toFixed(1)} minutes`);
  log(`Refreshes: ${state.refreshCount}`);
  log(`Overnight runs: ${state.overnightRunCount}`);
  log(`Briefs generated: ${state.briefCount}`);
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (logStream) {
    logStream.end();
  }
  
  process.exit(0);
}

// Export state for API endpoints
export function getDaemonState() {
  return {
    ...state,
    testMode: TEST_MODE,
    refreshInterval: SCHEDULE.REFRESH_INTERVAL,
  };
}

// ─── Run ─────────────────────────────────────────────────────────────────────

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Received SIGINT, shutting down...');
  stopDaemon();
});

process.on('SIGTERM', () => {
  log('Received SIGTERM, shutting down...');
  stopDaemon();
});

// Start daemon
startDaemon().catch(err => {
  logError('Fatal error in daemon', err);
  process.exit(1);
});
