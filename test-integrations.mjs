import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import { PrismaClient } from '@prisma/client';
import { loadGitHubConfig } from './src/lib/github.ts';

const db = new PrismaClient();

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI,
  );
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  NightShift Integration Test');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const user = await db.user.findFirst();
  if (!user) { console.log('❌ No user found in DB'); return; }

  console.log(`\n👤 User: ${user.email}`);
  console.log(`   Gmail connected: ${user.gmailConnected}`);
  console.log(`   Google scopes version: ${user.googleScopesVersion}`);
  console.log(`   Has token: ${!!user.gmailToken}`);
  console.log(`   Has refresh token: ${!!user.gmailRefreshToken}`);

  if (!user.gmailToken) {
    console.log('\n❌ No Google token — you need to connect Google first in Settings');
    return;
  }

  const auth = createOAuth2Client();
  auth.setCredentials({
    access_token: user.gmailToken,
    refresh_token: user.gmailRefreshToken,
  });

  // Auto-refresh and save new token
  auth.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await db.user.update({ where: { id: user.id }, data: { gmailToken: tokens.access_token } });
      console.log('   🔄 Token refreshed and saved');
    }
  });

  // Test 1: Calendar
  console.log('\n━━ TEST 1: Google Calendar ━━');
  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const now = new Date();
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 10,
    });
    const events = res.data.items || [];
    console.log(`✅ Calendar: ${events.length} upcoming events (next 7 days)`);
    for (const e of events.slice(0, 5)) {
      const when = e.start?.dateTime || e.start?.date || '';
      console.log(`   📅 ${e.summary} — ${new Date(when).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`);
    }
  } catch (err) {
    console.log(`❌ Calendar failed: ${err.message}`);
    if (err.message.includes('insufficient') || err.message.includes('scope') || err.message.includes('403')) {
      console.log('   💡 You need to re-authorize Google with Calendar scope — go to Settings → Disconnect → Connect');
    }
  }

  // Test 2: Gmail inbox
  console.log('\n━━ TEST 2: Gmail Inbox ━━');
  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const since = new Date();
    since.setDate(since.getDate() - 3);
    const q = `after:${since.getFullYear()}/${since.getMonth() + 1}/${since.getDate()} in:inbox`;
    const res = await gmail.users.messages.list({ userId: 'me', q, maxResults: 10 });
    const count = res.data.messages?.length || 0;
    console.log(`✅ Gmail inbox: ${count} messages (last 3 days)`);

    if (count > 0) {
      const first = await gmail.users.messages.get({ userId: 'me', id: res.data.messages[0].id, format: 'metadata', metadataHeaders: ['Subject', 'From'] });
      const subject = first.data.payload?.headers?.find(h => h.name === 'Subject')?.value || '(no subject)';
      const from = first.data.payload?.headers?.find(h => h.name === 'From')?.value || '(unknown)';
      console.log(`   📧 Latest: "${subject}" from ${from.split('<')[0].trim()}`);
    }
  } catch (err) {
    console.log(`❌ Gmail inbox failed: ${err.message}`);
  }

  // Test 3: Google Drive
  console.log('\n━━ TEST 3: Google Drive ━━');
  try {
    const drive = google.drive({ version: 'v3', auth });
    
    // Try to create a test doc
    const file = await drive.files.create({
      requestBody: {
        name: 'NightShift Test Doc',
        mimeType: 'application/vnd.google-apps.document',
      },
      media: {
        mimeType: 'text/html',
        body: '<h1>Hello from NightShift</h1><p>This test doc was created automatically to verify Google Drive integration.</p><ul><li>Integration working</li><li>Drive connected</li></ul>',
      },
      fields: 'id',
    });
    const docId = file.data.id;
    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
    console.log(`✅ Drive: Created test doc`);
    console.log(`   🔗 ${docUrl}`);
    console.log(`   (You can delete this test doc from Drive later)`);
  } catch (err) {
    console.log(`❌ Drive failed: ${err.message}`);
    if (err.message.includes('insufficient') || err.message.includes('scope') || err.message.includes('403')) {
      console.log('   💡 You need to re-authorize Google with Drive scope — go to Settings → Disconnect → Connect');
    }
  }

  // Test 4: GitHub
  console.log('\n━━ TEST 4: GitHub Activity ━━');
  try {
    const config = loadGitHubConfig(user.id);
    if (!config || !config.token) {
      console.log('⚠️  GitHub not connected — skipping');
    } else {
      const since = new Date();
      since.setDate(since.getDate() - 3);
      const res = await fetch(`https://api.github.com/repos/${config.defaultOwner}/${config.defaultRepo}/commits?since=${since.toISOString()}&per_page=5`, {
        headers: { Authorization: `Bearer ${config.token}`, 'User-Agent': 'NightShift-AI' },
      });
      if (res.ok) {
        const commits = await res.json();
        console.log(`✅ GitHub: ${commits.length} recent commits from ${config.defaultOwner}/${config.defaultRepo}`);
        for (const c of commits.slice(0, 3)) {
          console.log(`   📦 ${c.commit?.message?.split('\n')[0]?.slice(0, 60)}`);
        }
      } else {
        console.log(`❌ GitHub API: ${res.status} ${res.statusText}`);
      }
    }
  } catch (err) {
    console.log(`❌ GitHub failed: ${err.message}`);
  }

  // Test 5: DB stats
  console.log('\n━━ TEST 5: Database Stats ━━');
  const [projects, emails, chats, actions, drafts] = await Promise.all([
    db.project.count({ where: { userId: user.id } }),
    db.email.count({ where: { userId: user.id } }),
    db.chatMessage.count({ where: { userId: user.id } }),
    db.action.count({ where: { userId: user.id } }),
    db.draft.count({ where: { userId: user.id, status: 'pending' } }),
  ]);
  console.log(`   📂 Projects: ${projects}`);
  console.log(`   📧 Emails: ${emails}`);
  console.log(`   💬 Chat messages: ${chats}`);
  console.log(`   ⚡ Actions: ${actions}`);
  console.log(`   📝 Pending drafts: ${drafts}`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Tests complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (user.googleScopesVersion < 2) {
    console.log('\n⚠️  IMPORTANT: Your Google scopes version is ' + user.googleScopesVersion);
    console.log('   Calendar and Drive may fail until you re-authorize.');
    console.log('   Go to localhost:3000/dashboard/settings → Disconnect Google → Connect');
    console.log('   This will request the new expanded permissions.');
  }

  await db.$disconnect();
}

main().catch(err => {
  console.error('Fatal:', err);
  db.$disconnect();
  process.exit(1);
});
