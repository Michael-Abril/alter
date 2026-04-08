#!/usr/bin/env node
/**
 * Sync Gmail Emails
 * Pulls sent and received emails and stores them in the database
 */

import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';

const db = new PrismaClient();

async function syncGmail() {
  console.log('📧 Starting Gmail sync...\n');

  try {
    // Find user with Gmail connected
    const user = await db.user.findFirst({
      where: { gmailConnected: true }
    });

    if (!user || !user.gmailToken) {
      console.log('❌ No user with Gmail connected found');
      console.log('   Please connect Gmail first via /api/gmail/connect');
      return;
    }

    console.log(`✓ Found user: ${user.email || user.clerkId}`);

    // Set up Gmail API client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: user.gmailToken,
      refresh_token: user.gmailRefreshToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch sent emails
    console.log('\n📤 Fetching sent emails...');
    const sentResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:sent',
      maxResults: 100,
    });

    const sentMessages = sentResponse.data.messages || [];
    console.log(`   Found ${sentMessages.length} sent emails`);

    // Fetch received emails
    console.log('\n📥 Fetching received emails...');
    const receivedResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:inbox',
      maxResults: 50,
    });

    const receivedMessages = receivedResponse.data.messages || [];
    console.log(`   Found ${receivedMessages.length} received emails`);

    // Process all messages
    const allMessages = [
      ...sentMessages.map(m => ({ ...m, direction: 'sent' })),
      ...receivedMessages.map(m => ({ ...m, direction: 'received' }))
    ];

    let imported = 0;
    let skipped = 0;

    for (const msg of allMessages) {
      try {
        // Check if already exists
        const existing = await db.email.findUnique({
          where: { gmailId: msg.id }
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Fetch full message
        const fullMsg = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });

        const headers = fullMsg.data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const to = headers.find(h => h.name === 'To')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';

        // Extract body
        let body = '';
        if (fullMsg.data.payload.body?.data) {
          body = Buffer.from(fullMsg.data.payload.body.data, 'base64').toString('utf-8');
        } else if (fullMsg.data.payload.parts) {
          const textPart = fullMsg.data.payload.parts.find(p => p.mimeType === 'text/plain');
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }
        }

        // Store in database
        await db.email.create({
          data: {
            userId: user.id,
            gmailId: msg.id,
            threadId: fullMsg.data.threadId || msg.id,
            subject,
            from,
            to,
            body: body.substring(0, 10000), // Limit body size
            direction: msg.direction,
            receivedAt: new Date(date),
            embedded: false,
          }
        });

        imported++;
        
        if (imported % 10 === 0) {
          console.log(`   Processed ${imported}/${allMessages.length}...`);
        }

      } catch (err) {
        console.error(`   Error processing message ${msg.id}:`, err.message);
      }
    }

    console.log(`\n✅ Gmail sync complete!`);
    console.log(`   Imported: ${imported} new emails`);
    console.log(`   Skipped: ${skipped} existing emails`);
    console.log(`\n📝 Next step: Run embedding pipeline`);
    console.log(`   npm run embed:emails`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  } finally {
    await db.$disconnect();
  }
}

syncGmail();
