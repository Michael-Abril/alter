/**
 * OWNER: Person 2 (Phillip/Backend)
 * PURPOSE: Canvas integration test harness
 * DEPENDENCIES: scrape-canvas.mjs, src/lib/canvas.ts
 * STATUS: LIVE — tests Canvas pipeline with mock Babson data
 *
 * Usage:
 *   node test-canvas.mjs --mock
 *   node test-canvas.mjs --user-id=USER_ID (uses real Canvas API)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { resolveInternalUserId } from './user-resolver.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const args = parseArgs(process.argv.slice(2));
const MOCK_MODE = args.mock !== undefined;
const USER_ID = args['user-id'];
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

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

// ─── Mock Babson Course Data ─────────────────────────────────────────────────

function generateMockCanvasData() {
  const now = new Date();
  
  const courses = [
    {
      id: 1001,
      name: 'Managerial Accounting',
      course_code: 'ACC2002',
      enrollment_term_id: 1,
      workflow_state: 'available',
    },
    {
      id: 1002,
      name: 'Macroeconomics',
      course_code: 'ECN2000',
      enrollment_term_id: 1,
      workflow_state: 'available',
    },
    {
      id: 1003,
      name: 'Entrepreneurial Thinking & Action',
      course_code: 'ENT3000',
      enrollment_term_id: 1,
      workflow_state: 'available',
    },
  ];

  const assignments = [
    {
      id: 2001,
      name: 'Midterm Exam',
      description: '<p>Comprehensive exam covering chapters 4-8 on cost analysis, activity-based costing, and variance analysis. Bring a calculator. No notes allowed.</p>',
      due_at: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days from now
      points_possible: 100,
      course_id: 1001,
      html_url: 'https://babson.instructure.com/courses/1001/assignments/2001',
      submission_types: ['online_quiz'],
    },
    {
      id: 2002,
      name: 'Problem Set 3: Cost-Volume-Profit Analysis',
      description: '<p>Complete problems 5-8 from Chapter 6. Show all work. Submit as PDF.</p>',
      due_at: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
      points_possible: 50,
      course_id: 1001,
      html_url: 'https://babson.instructure.com/courses/1001/assignments/2002',
      submission_types: ['online_upload'],
    },
    {
      id: 2003,
      name: 'Quiz 4: Fiscal and Monetary Policy',
      description: '<p>20 multiple choice questions. 30 minutes. One attempt.</p>',
      due_at: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      points_possible: 20,
      course_id: 1002,
      html_url: 'https://babson.instructure.com/courses/1002/assignments/2003',
      submission_types: ['online_quiz'],
    },
    {
      id: 2004,
      name: 'Group Presentation: Startup Pitch Deck',
      description: '<p>10-minute presentation of your team\'s startup idea. Include market analysis, business model, and financial projections. All team members must present.</p>',
      due_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      points_possible: 150,
      course_id: 1003,
      html_url: 'https://babson.instructure.com/courses/1003/assignments/2004',
      submission_types: ['online_upload', 'media_recording'],
    },
    {
      id: 2005,
      name: 'Reading Response: GDP and Economic Growth',
      description: '<p>Write a 500-word response to the assigned readings on GDP measurement and economic indicators. Due before class.</p>',
      due_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
      points_possible: 25,
      course_id: 1002,
      html_url: 'https://babson.instructure.com/courses/1002/assignments/2005',
      submission_types: ['online_text_entry'],
    },
  ];

  const announcements = [
    {
      id: 3001,
      title: 'Midterm Exam Study Session',
      message: '<p>I\'ll be holding a review session on Wednesday at 4pm in Olin 220. Bring your questions!</p>',
      posted_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      author: { display_name: 'Prof. Sarah Chen' },
      context_code: 'course_1001',
    },
    {
      id: 3002,
      title: 'Office Hours Change',
      message: '<p>Office hours this week moved to Thursday 2-4pm instead of Tuesday. Email me if you need to meet at a different time.</p>',
      posted_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Yesterday
      author: { display_name: 'Prof. Michael Rodriguez' },
      context_code: 'course_1002',
    },
    {
      id: 3003,
      title: 'Guest Speaker Next Week',
      message: '<p>We have a special guest speaker next Tuesday - Maria Santos, founder of GreenTech Solutions. Attendance is mandatory and counts toward participation.</p>',
      posted_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      author: { display_name: 'Prof. David Kim' },
      context_code: 'course_1003',
    },
  ];

  return { courses, assignments, announcements };
}

// ─── Mock Canvas API Functions ───────────────────────────────────────────────

async function mockGetCourses() {
  const { courses } = generateMockCanvasData();
  return courses;
}

async function mockGetUpcomingAssignments() {
  const { assignments } = generateMockCanvasData();
  return assignments;
}

async function mockGetAnnouncements() {
  const { announcements } = generateMockCanvasData();
  return announcements;
}

// ─── Main Test Function ──────────────────────────────────────────────────────

async function main() {
  const resolvedUserId = await resolveInternalUserId(USER_ID);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎓 Canvas LMS Integration Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  if (MOCK_MODE) {
    console.log('🧪 MOCK MODE: Using fake Babson course data');
    console.log('');

    // Generate mock data
    const courses = await mockGetCourses();
    const assignments = await mockGetUpcomingAssignments();
    const announcements = await mockGetAnnouncements();

    console.log('📚 Mock Courses:');
    for (const course of courses) {
      console.log(`   ${course.course_code}: ${course.name}`);
    }
    console.log('');

    console.log('📝 Mock Assignments:');
    for (const assignment of assignments) {
      const course = courses.find(c => c.id === assignment.course_id);
      const dueDate = new Date(assignment.due_at);
      const daysUntil = Math.ceil((dueDate - new Date()) / (1000 * 60 * 60 * 24));
      console.log(`   [${course.course_code}] ${assignment.name}`);
      console.log(`      Due: ${dueDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} (${daysUntil} days)`);
      console.log(`      Points: ${assignment.points_possible}`);
    }
    console.log('');

    console.log('📢 Mock Announcements:');
    for (const announcement of announcements) {
      const courseName = announcement.context_code.replace('course_', '');
      const course = courses.find(c => c.id === parseInt(courseName));
      console.log(`   [${course?.course_code || 'Unknown'}] ${announcement.title}`);
      console.log(`      By: ${announcement.author.display_name}`);
    }
    console.log('');

    // Convert to ChatMessage format
    const messages = [];

    for (const assignment of assignments) {
      const course = courses.find(c => c.id === assignment.course_id);
      const courseName = course?.course_code || `Course ${assignment.course_id}`;
      
      const dueDate = new Date(assignment.due_at);
      const dueDateStr = dueDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

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

    for (const announcement of announcements) {
      const courseName = announcement.context_code.replace('course_', '');
      const course = courses.find(c => c.id === parseInt(courseName));
      const courseCode = course?.course_code || 'Unknown';
      const postedDate = new Date(announcement.posted_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });

      const message = announcement.message
        ? announcement.message.replace(/<[^>]*>/g, '').trim().slice(0, 500)
        : '';

      const content = `Announcement from ${courseCode} (${postedDate}): ${announcement.title}. ${message}`;

      messages.push({
        role: 'assistant',
        content,
        sessionId: `canvas-${courseCode}`,
        timestamp: announcement.posted_at,
      });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📨 Ingesting Canvas Data into NightShift');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`Total messages to ingest: ${messages.length}`);
    console.log('');

    // Send to ingest API
    const ingestUrl = `${API_URL}/api/chat-history/ingest`;
    const payload = {
      userId: resolvedUserId,
      source: 'canvas',
      messages,
    };

    try {
      const res = await fetch(ingestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        console.log('✅ Canvas data ingested successfully');
        console.log(`   Response: ${JSON.stringify(data)}`);
      } else {
        console.error(`❌ Ingest failed: ${res.status}`);
        console.error(`   ${JSON.stringify(data)}`);
      }
    } catch (err) {
      console.error('❌ Failed to reach ingest API:', err.message);
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 Running Project Detector on Canvas Data');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // Run project detector
    await runProjectDetector();

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Canvas Integration Test Complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📊 Summary:');
    console.log(`   Courses: ${courses.length}`);
    console.log(`   Assignments: ${assignments.length}`);
    console.log(`   Announcements: ${announcements.length}`);
    console.log(`   Total Messages: ${messages.length}`);
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Check the database for new Canvas messages');
    console.log('   2. Run the embedding pipeline to make them searchable');
    console.log('   3. Check detected projects for academic deadlines');
    console.log('   4. Test context builder with Canvas deadlines');
    console.log('');

  } else {
    console.log('🔗 LIVE MODE: Using real Canvas API');
    console.log('');
    console.log('Running scrape-canvas.mjs...');
    console.log('');

    // Run the real scraper
    const scriptPath = path.join(__dirname, 'scrape-canvas.mjs');
    const child = spawn('node', [scriptPath, `--user-id=${resolvedUserId}`], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('');
        console.log('✅ Canvas scrape complete');
      } else {
        console.error(`❌ Scraper exited with code ${code}`);
      }
    });
  }
}

// ─── Run Project Detector ────────────────────────────────────────────────────

function runProjectDetector() {
  return new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'detect-projects.ts');
    const child = spawn('npx', ['tsx', scriptPath, '--force'], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Project detection complete');
      } else {
        console.error(`⚠️  Project detector exited with code ${code}`);
      }
      resolve();
    });

    child.on('error', (err) => {
      console.error('❌ Failed to run project detector:', err.message);
      resolve();
    });
  });
}

// ─── Run ─────────────────────────────────────────────────────────────────────

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
