/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Test the email draft generation pipeline
 * DEPENDENCIES: draft-email.mjs, NightShift backend
 * STATUS: Test script
 *
 * Usage:
 *   node orchestration/test-draft.mjs
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { draftEmailReply } from './draft-email.mjs';

// ─── Config ──────────────────────────────────────────────────────────────────

const USER_ID = 'cmndvesaa000011r5gk3avaoo'; // Default user ID

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧪 Email Draft Generation Test');
  console.log('');

  // Create a fake incoming email
  const incomingEmail = {
    from: 'leo@client.com',
    subject: 'Following up on project timeline',
    body: 'Hey, just wanted to check in on where things stand with the deliverables we discussed last week. When can I expect the first draft?',
  };

  console.log('📧 Fake Incoming Email:');
  console.log(`   From: ${incomingEmail.from}`);
  console.log(`   Subject: ${incomingEmail.subject}`);
  console.log(`   Body: ${incomingEmail.body}`);
  console.log('');

  try {
    const result = await draftEmailReply(incomingEmail, USER_ID, {
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    if (result.success) {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📝 GENERATED DRAFT');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log(result.draft);
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📊 Confidence Score: ${result.confidence.toFixed(2)}`);
      console.log(`🆔 Draft ID: ${result.draftId}`);
      console.log(`🆔 Action ID: ${result.actionId}`);
      console.log(`🪙 Tokens Used: ${result.tokensUsed}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('✅ Test complete! NightShift drafted an email based on your chat history.');
    }
  } catch (error) {
    console.error('');
    console.error('❌ Error running draft pipeline:');
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
