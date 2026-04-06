/**
 * OWNER: Person 2 (Phillip/Backend)
 * PURPOSE: Canvas LMS scraper — pulls assignments, deadlines, and announcements
 * DEPENDENCIES: src/lib/canvas.ts, NightShift backend APIs
 * STATUS: LIVE — scrapes Canvas data into ChatMessage table
 *
 * Usage:
 *   node scrape-canvas.mjs --user-id=USER_ID
 *   node scrape-canvas.mjs --user-id=USER_ID --days-ahead=21
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Dynamic imports for ES modules
const canvasModule = await import('../src/lib/canvas.ts');
const { getCourses, getUpcomingAssignments, getAnnouncements, loadCanvasConfig } = canvasModule;

// ─── Config ──────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv.slice(2));
const USER_ID = args['user-id'];
const DAYS_AHEAD = parseInt(args['days-ahead'] || '14', 10);
const DAYS_BACK = parseInt(args['days-back'] || '14', 10);
const API_URL = args.api || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const DRY_RUN = args['dry-run'] !== undefined;

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

function log(msg) {
  console.log(`[canvas] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

function warn(msg) {
  console.warn(`[canvas] ⚠ ${msg}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  log('Starting Canvas LMS scraper');
  
  if (!USER_ID) {
    console.error('❌ Missing --user-id parameter');
    console.error('Usage: node scrape-canvas.mjs --user-id=USER_ID');
    process.exit(1);
  }

  log(`Config: user=${USER_ID}, days-ahead=${DAYS_AHEAD}, days-back=${DAYS_BACK}, dry-run=${DRY_RUN}`);

  // Load Canvas credentials
  const config = loadCanvasConfig(USER_ID);
  if (!config) {
    console.error('❌ No Canvas credentials found for this user');
    console.error('   Run POST /api/canvas/connect to save credentials first');
    process.exit(1);
  }

  log(`Using Canvas domain: ${config.domain}`);

  try {
    // Fetch courses
    log('Fetching enrolled courses...');
    const courses = await getCourses(config);
    log(`✅ Found ${courses.length} active courses`);

    // Fetch upcoming assignments
    log(`Fetching assignments due in next ${DAYS_AHEAD} days...`);
    const assignments = await getUpcomingAssignments(config, DAYS_AHEAD);
    log(`✅ Found ${assignments.length} upcoming assignments`);

    // Fetch recent announcements
    log(`Fetching announcements from last ${DAYS_BACK} days...`);
    const announcements = await getAnnouncements(config, DAYS_BACK);
    log(`✅ Found ${announcements.length} recent announcements`);

    // Convert to ChatMessage format
    const messages = [];

    // Add assignments as messages
    for (const assignment of assignments) {
      const course = courses.find(c => c.id === assignment.course_id);
      const courseName = course?.course_code || course?.name || `Course ${assignment.course_id}`;
      
      const dueDate = new Date(assignment.due_at);
      const dueDateStr = dueDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      // Clean description (remove HTML tags)
      const description = assignment.description 
        ? assignment.description.replace(/<[^>]*>/g, '').trim().slice(0, 500)
        : 'No description provided';

      const content = `Assignment: ${courseName} - ${assignment.name} due ${dueDateStr}. ${description}`;

      messages.push({
        role: 'user',
        content,
        sessionId: `canvas-${courseName}`,
        timestamp: new Date().toISOString(),
      });
    }

    // Add announcements as messages
    for (const announcement of announcements) {
      // Handle missing context_code
      const contextCode = announcement.context_code || 'unknown';
      const courseName = contextCode.replace('course_', 'Course ');
      
      const postedDate = new Date(announcement.posted_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      // Clean message (remove HTML tags)
      const message = announcement.message
        ? announcement.message.replace(/<[^>]*>/g, '').trim().slice(0, 500)
        : '';

      const content = `Announcement from ${courseName} (${postedDate}): ${announcement.title || 'Untitled'}. ${message}`;

      messages.push({
        role: 'assistant',
        content,
        sessionId: `canvas-${courseName}`,
        timestamp: announcement.posted_at,
      });
    }

    log(`Total messages to ingest: ${messages.length}`);

    if (messages.length === 0) {
      log('No new Canvas data to ingest');
      return;
    }

    // Send to ingest API
    if (DRY_RUN) {
      log('DRY RUN — would send this payload:');
      console.log(JSON.stringify({
        userId: USER_ID,
        source: 'canvas',
        messages: messages.slice(0, 3), // Show first 3 as sample
      }, null, 2));
      log(`... and ${messages.length - 3} more messages`);
    } else {
      await sendToApi(messages);
    }

    log('Done ✅');
  } catch (err) {
    console.error('[canvas] Fatal error:', err);
    process.exit(1);
  }
}

// ─── Send to NightShift ingest API ───────────────────────────────────────────

async function sendToApi(messages) {
  const ingestUrl = `${API_URL}/api/chat-history/ingest`;
  log(`Sending ${messages.length} messages to ${ingestUrl}...`);

  const BATCH_SIZE = 50;
  let totalIngested = 0;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const payload = {
      userId: USER_ID,
      source: 'canvas',
      messages: batch,
    };

    try {
      const res = await fetch(ingestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        totalIngested += batch.length;
        log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ingested ${batch.length} messages (${totalIngested}/${messages.length})`);
      } else {
        warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1} returned ${res.status}: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      warn(`Failed to reach API at ${ingestUrl}: ${err.message}`);
      return;
    }
  }

  log(`✅ All ${totalIngested} messages sent successfully`);
}

// ─── Run ─────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('[canvas] Unhandled error:', err);
  process.exit(1);
});
