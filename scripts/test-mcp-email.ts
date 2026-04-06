/**
 * Test MCP Email Pipeline
 *
 * Calls Claude API with Gmail MCP server attached to read emails.
 *
 * Prerequisites:
 *   1. Get a Gmail MCP access token using the MCP Inspector:
 *      npx @modelcontextprotocol/inspector
 *      → Transport: Streamable HTTP
 *      → URL: https://gmail.mcp.claude.com/mcp
 *      → Open Auth Settings → Quick OAuth Flow → authorize Gmail
 *      → Copy the access_token
 *
 *   2. Set it as GMAIL_MCP_TOKEN in .env or pass as arg:
 *      npx tsx scripts/test-mcp-email.ts --token=YOUR_ACCESS_TOKEN
 */

import dotenv from 'dotenv';
dotenv.config();

import { readEmails, draftReply } from '../src/lib/mcp-email';

// Parse --token=xxx from CLI args
const tokenArg = process.argv.find((a) => a.startsWith('--token='));
const GMAIL_TOKEN = tokenArg?.split('=')[1] || process.env.GMAIL_MCP_TOKEN || '';

async function main() {
  if (!GMAIL_TOKEN) {
    console.error('❌ No Gmail MCP token provided.');
    console.error('   Set GMAIL_MCP_TOKEN in .env or pass --token=YOUR_TOKEN');
    console.error('');
    console.error('   To get a token, run:');
    console.error('     npx @modelcontextprotocol/inspector');
    console.error('   Then connect to https://gmail.mcp.claude.com/mcp');
    console.error('   and complete the OAuth flow.');
    process.exit(1);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 Test 1: Read last 5 emails via Claude + MCP');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const result = await readEmails('Show me my last 5 emails', GMAIL_TOKEN);

  if (result.success) {
    console.log(`\n✅ Got ${result.emails.length} emails (${result.tokensUsed} tokens)`);
    for (const email of result.emails) {
      console.log(`  📩 ${email.from} → ${email.subject}`);
      if (email.body) console.log(`     ${email.body.slice(0, 80)}...`);
    }
  } else {
    console.log('\n⚠️  No structured emails parsed. Raw response:');
    console.log(result.raw.slice(0, 500));
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✍️  Test 2: Draft a reply via Claude + MCP');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const draft = await draftReply(
    {
      from: 'sarah@company.com',
      subject: 'Re: Q2 Marketing Timeline',
      body: 'Hey, just checking in on the Q2 timeline. Are we still on track for the April launch? The team needs the updated schedule by Friday.',
    },
    undefined,
    GMAIL_TOKEN
  );

  console.log(`\n✅ Draft generated (confidence: ${draft.confidence.toFixed(2)}, ${draft.tokensUsed} tokens)`);
  console.log('─── Draft ───');
  console.log(draft.draft);
  console.log('──────────────');

  console.log('\n✅ All tests complete');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err.message || err);
  process.exit(1);
});
