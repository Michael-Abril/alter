#!/usr/bin/env node
/**
 * Test Gmail OAuth and Email Sync Flow
 * Run this after setting up Gmail OAuth credentials
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function testGmailFlow() {
  console.log('🔍 Testing Gmail Integration...\n');

  try {
    // 1. Check if user has Gmail connected
    const user = await db.user.findFirst();
    
    if (!user) {
      console.log('❌ No user found in database');
      return;
    }

    console.log(`✓ Found user: ${user.email || user.clerkId}`);
    console.log(`  Gmail connected: ${user.gmailConnected ? '✅ YES' : '❌ NO'}`);
    
    if (user.gmailToken) {
      console.log(`  Token exists: ✅ YES (${user.gmailToken.substring(0, 20)}...)`);
    } else {
      console.log(`  Token exists: ❌ NO`);
    }

    // 2. Check email count
    const emailCount = await db.email.count({
      where: { userId: user.id }
    });
    
    console.log(`\n📧 Email Stats:`);
    console.log(`  Total emails: ${emailCount}`);
    
    if (emailCount > 0) {
      const sentCount = await db.email.count({
        where: { userId: user.id, direction: 'sent' }
      });
      const receivedCount = await db.email.count({
        where: { userId: user.id, direction: 'received' }
      });
      const embeddedCount = await db.email.count({
        where: { userId: user.id, embedded: true }
      });
      
      console.log(`  Sent: ${sentCount}`);
      console.log(`  Received: ${receivedCount}`);
      console.log(`  Embedded: ${embeddedCount}`);
      
      // Show sample emails
      const sampleEmails = await db.email.findMany({
        where: { userId: user.id },
        take: 3,
        orderBy: { receivedAt: 'desc' }
      });
      
      console.log(`\n📬 Sample Emails:`);
      sampleEmails.forEach((email, i) => {
        console.log(`  ${i + 1}. [${email.direction}] ${email.subject}`);
        console.log(`     From: ${email.from} → To: ${email.to}`);
        console.log(`     Date: ${email.receivedAt.toISOString()}`);
        console.log(`     Embedded: ${email.embedded ? '✅' : '❌'}`);
      });
    }

    // 3. Check drafts
    const draftCount = await db.draft.count({
      where: { userId: user.id, type: 'email' }
    });
    
    console.log(`\n✍️  Email Drafts: ${draftCount}`);
    
    if (draftCount > 0) {
      const drafts = await db.draft.findMany({
        where: { userId: user.id, type: 'email' },
        take: 3,
        orderBy: { createdAt: 'desc' }
      });
      
      drafts.forEach((draft, i) => {
        console.log(`  ${i + 1}. ${draft.title || 'Untitled'}`);
        console.log(`     Status: ${draft.status}`);
        console.log(`     Created: ${draft.createdAt.toISOString()}`);
      });
    }

    console.log('\n✅ Gmail flow test complete!');
    
    if (!user.gmailConnected) {
      console.log('\n📝 Next Steps:');
      console.log('1. Set up Google Cloud credentials (see instructions above)');
      console.log('2. Add GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to .env');
      console.log('3. Visit http://localhost:3000/api/gmail/connect');
      console.log('4. Run: npm run gmail:sync');
      console.log('5. Run: npm run embed:emails');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.$disconnect();
  }
}

testGmailFlow();
