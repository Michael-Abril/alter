/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: One-command beta readiness verifier
 * STATUS: LIVE — prints WORKS / PARTIAL / BROKEN matrix for each surface
 *
 * Usage:
 *   node orchestration/beta-check.mjs [--api-url=http://localhost:3000]
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = process.argv.find(a => a.startsWith('--api-url='))?.split('=')[1] || 'http://localhost:3000';

const db = new PrismaClient();

const results = [];

function report(name, status, detail = '') {
  const icon = status === 'WORKS' ? '✅' : status === 'PARTIAL' ? '⚠️' : '❌';
  results.push({ name, status, detail });
  console.log(`${icon} ${status.padEnd(7)} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function checkDatabase() {
  try {
    const userCount = await db.user.count();
    if (userCount === 0) {
      report('Database: Users', 'BROKEN', 'No users in database');
      return null;
    }
    report('Database: Users', 'WORKS', `${userCount} user(s)`);
    const user = await db.user.findFirst({ orderBy: { createdAt: 'desc' } });
    return user;
  } catch (e) {
    report('Database: Connection', 'BROKEN', e.message);
    return null;
  }
}

async function checkProjects(userId) {
  const projects = await db.project.findMany({ where: { userId } });
  if (projects.length === 0) {
    report('Dashboard: Projects', 'PARTIAL', 'No projects detected — run project detection first');
    return [];
  }
  const inProgress = projects.filter(p => p.status === 'in_progress').length;
  report('Dashboard: Projects', 'WORKS', `${projects.length} total, ${inProgress} in-progress`);
  return projects;
}

async function checkActions(userId) {
  const actions = await db.action.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 });
  if (actions.length === 0) {
    report('Dashboard: Activity', 'PARTIAL', 'No actions logged yet — activate handoff first');
    return;
  }
  const withFiles = actions.filter(a => {
    try {
      const m = JSON.parse(a.metadata || '{}');
      return m.filePath || m.outputPath;
    } catch { return false; }
  }).length;
  report('Dashboard: Activity', 'WORKS', `${actions.length} action(s), ${withFiles} with file paths`);
}

async function checkDrafts(userId) {
  const drafts = await db.draft.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 });
  if (drafts.length === 0) {
    report('Dashboard: Drafts', 'PARTIAL', 'No drafts created yet — activate handoff first');
    return;
  }
  const pending = drafts.filter(d => d.status === 'pending').length;
  const approved = drafts.filter(d => d.status === 'approved' || d.status === 'sent').length;
  report('Dashboard: Drafts', 'WORKS', `${drafts.length} draft(s) — ${pending} pending, ${approved} approved/sent`);
}

async function checkDraftApprovalRoute() {
  try {
    const res = await fetch(`${API_URL}/api/drafts`, { headers: { 'Content-Type': 'application/json' } });
    if (res.status === 401) {
      report('API: GET /api/drafts', 'WORKS', 'Returns 401 for unauthenticated (expected)');
    } else if (res.ok) {
      report('API: GET /api/drafts', 'WORKS', `Status ${res.status}`);
    } else {
      report('API: GET /api/drafts', 'BROKEN', `Status ${res.status}`);
    }
  } catch (e) {
    report('API: GET /api/drafts', 'BROKEN', `Server not reachable: ${e.message}`);
  }
}

async function checkSettingsRoute() {
  try {
    const res = await fetch(`${API_URL}/api/user/settings`);
    if (res.status === 401) {
      report('API: GET /api/user/settings', 'WORKS', 'Returns 401 for unauthenticated (expected)');
    } else if (res.ok) {
      report('API: GET /api/user/settings', 'WORKS', `Status ${res.status}`);
    } else {
      report('API: GET /api/user/settings', 'BROKEN', `Status ${res.status}`);
    }
  } catch (e) {
    report('API: GET /api/user/settings', 'BROKEN', `Server not reachable: ${e.message}`);
  }
}

async function checkHandoffStatusRoute() {
  try {
    const res = await fetch(`${API_URL}/api/handoff/status`);
    if (res.status === 401) {
      report('API: GET /api/handoff/status', 'WORKS', 'Returns 401 for unauthenticated (expected)');
    } else {
      report('API: GET /api/handoff/status', res.ok ? 'WORKS' : 'BROKEN', `Status ${res.status}`);
    }
  } catch (e) {
    report('API: GET /api/handoff/status', 'BROKEN', `Server not reachable: ${e.message}`);
  }
}

async function checkGmailConnection(user) {
  if (user.gmailConnected && user.gmailToken) {
    report('Gmail: Connection', 'WORKS', 'Token present');
  } else if (user.gmailConnected && !user.gmailToken) {
    report('Gmail: Connection', 'PARTIAL', 'Marked connected but no token — may need re-auth');
  } else {
    report('Gmail: Connection', 'PARTIAL', 'Not connected — email drafts won\'t send');
  }
}

async function checkGitHubConfig(userId) {
  const configPath = path.join(__dirname, '..', 'data', 'github-config.json');
  if (!fs.existsSync(configPath)) {
    report('GitHub: Config', 'PARTIAL', 'No config file — code_build PRs won\'t be created');
    return;
  }
  try {
    const configs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const cfg = configs[userId];
    if (!cfg || !cfg.token) {
      report('GitHub: Config', 'PARTIAL', 'No token for this user — code_build PRs won\'t be created');
    } else if (!cfg.defaultRepo) {
      report('GitHub: Config', 'PARTIAL', 'Token present but no default repo set');
    } else {
      report('GitHub: Config', 'WORKS', `${cfg.defaultOwner}/${cfg.defaultRepo}`);
    }
  } catch (e) {
    report('GitHub: Config', 'BROKEN', `Parse error: ${e.message}`);
  }
}

async function checkVoiceProfile(userId) {
  try {
    const profile = await db.voiceProfile.findFirst({ where: { userId } });
    if (!profile) {
      report('Voice Profile', 'PARTIAL', 'Not built yet — drafts will use generic style');
    } else {
      report('Voice Profile', 'WORKS', `Built ${profile.updatedAt.toISOString().split('T')[0]}`);
    }
  } catch (e) {
    report('Voice Profile', 'PARTIAL', `Table may not exist: ${e.message}`);
  }
}

async function checkOutputFiles() {
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  const nsDir = path.join(userHome, 'Documents', 'NightShift');
  if (!fs.existsSync(nsDir)) {
    report('Output: Documents/NightShift', 'PARTIAL', 'Directory does not exist yet');
    return;
  }
  try {
    const files = fs.readdirSync(nsDir);
    const docxFiles = files.filter(f => f.endsWith('.docx'));
    if (docxFiles.length === 0) {
      report('Output: Documents/NightShift', 'PARTIAL', 'Directory exists but no .docx files');
    } else {
      report('Output: Documents/NightShift', 'WORKS', `${docxFiles.length} .docx file(s)`);
    }
  } catch (e) {
    report('Output: Documents/NightShift', 'BROKEN', e.message);
  }
}

async function checkChatMessages(userId) {
  const count = await db.chatMessage.count({ where: { userId } });
  if (count === 0) {
    report('Data: Chat Messages', 'PARTIAL', 'No messages imported — run scraper or onboarding');
  } else {
    report('Data: Chat Messages', 'WORKS', `${count} message(s)`);
  }
}

async function checkOrchestratorFiles() {
  const requiredFiles = [
    'orchestration/overnight-loop.mjs',
    'orchestration/continue-work.mjs',
    'orchestration/draft-email.mjs',
    'orchestration/github-push.mjs',
    'orchestration/user-resolver.mjs',
  ];
  const missing = requiredFiles.filter(f => !fs.existsSync(path.join(__dirname, '..', f)));
  if (missing.length > 0) {
    report('Orchestration: Scripts', 'BROKEN', `Missing: ${missing.join(', ')}`);
  } else {
    report('Orchestration: Scripts', 'WORKS', `All ${requiredFiles.length} core scripts present`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   NightShift Beta Readiness Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   API: ${API_URL}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const user = await checkDatabase();
  if (!user) {
    console.log('\n❌ Cannot proceed without a user in the database.\n');
    await db.$disconnect();
    process.exit(1);
  }

  await checkChatMessages(user.id);
  await checkProjects(user.id);
  await checkActions(user.id);
  await checkDrafts(user.id);
  await checkGmailConnection(user);
  await checkGitHubConfig(user.id);
  await checkVoiceProfile(user.id);
  await checkOutputFiles();
  await checkOrchestratorFiles();

  console.log('');
  console.log('── API Route Checks ──');
  console.log('');
  await checkDraftApprovalRoute();
  await checkSettingsRoute();
  await checkHandoffStatusRoute();

  // Summary
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const works = results.filter(r => r.status === 'WORKS').length;
  const partial = results.filter(r => r.status === 'PARTIAL').length;
  const broken = results.filter(r => r.status === 'BROKEN').length;
  console.log(`   WORKS: ${works}   PARTIAL: ${partial}   BROKEN: ${broken}`);

  if (broken > 0) {
    console.log('');
    console.log('   ❌ BROKEN items (must fix before beta):');
    results.filter(r => r.status === 'BROKEN').forEach(r => {
      console.log(`      • ${r.name}: ${r.detail}`);
    });
  }

  if (partial > 0) {
    console.log('');
    console.log('   ⚠️  PARTIAL items (nice to fix):');
    results.filter(r => r.status === 'PARTIAL').forEach(r => {
      console.log(`      • ${r.name}: ${r.detail}`);
    });
  }

  if (broken === 0) {
    console.log('');
    console.log('   🚀 Beta ready' + (partial > 0 ? ' (with caveats)' : '') + '!');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  await db.$disconnect();
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  db.$disconnect();
  process.exit(1);
});
