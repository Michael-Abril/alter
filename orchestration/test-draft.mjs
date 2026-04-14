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
import { resolveInternalUserId } from './user-resolver.mjs';

// ─── Config ──────────────────────────────────────────────────────────────────

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🧪 Email Draft Generation Test');
  console.log('');
  const userId = await resolveTestUserId();
  console.log(`👤 Using user ID: ${userId}`);
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
    const withoutVoice = await draftEmailReply(incomingEmail, userId, {
      apiKey: process.env.ANTHROPIC_API_KEY,
      useVoiceProfile: false,
    });
    const withVoice = await draftEmailReply(incomingEmail, userId, {
      apiKey: process.env.ANTHROPIC_API_KEY,
      useVoiceProfile: true,
    });

    if (withoutVoice.success && withVoice.success) {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📝 DRAFT COMPARISON');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('WITHOUT VOICE PROFILE');
      console.log('---------------------');
      console.log(withoutVoice.draft);
      console.log('');
      console.log('WITH VOICE PROFILE');
      console.log('------------------');
      console.log(withVoice.draft);
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Without profile confidence: ${withoutVoice.confidence.toFixed(2)}`);
      console.log(`With profile confidence: ${withVoice.confidence.toFixed(2)}`);
      console.log(`Without profile tokens: ${withoutVoice.tokensUsed}`);
      console.log(`With profile tokens: ${withVoice.tokensUsed}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      console.log('✅ Test complete! Compared draft quality with and without voice profile.');
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

async function resolveTestUserId() {
  return resolveInternalUserId(undefined);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
