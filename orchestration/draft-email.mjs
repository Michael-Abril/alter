/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Generate email reply drafts using Claude + vector context
 * DEPENDENCIES: Anthropic API, NightShift backend APIs
 * STATUS: LIVE — drafts emails based on user's communication style
 *
 * This takes an incoming email, retrieves similar past messages from the vector DB,
 * and asks Claude to draft a reply that matches the user's style.
 */

// Uses shared AI client with OpenClaw -> Anthropic fallback
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveInternalUserId } from './user-resolver.mjs';
import { callAI } from './lib/ai-client.mjs';
import { actionsPostHeaders } from './lib/openclaw-headers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ─── Config ──────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2048;

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Draft an email reply using Claude + vector context retrieval.
 * 
 * @param {Object} incomingEmail - The email to reply to
 * @param {string} incomingEmail.from - Sender email address
 * @param {string} incomingEmail.subject - Email subject
 * @param {string} incomingEmail.body - Email body
 * @param {string} userId - User's internal ID
 * @param {Object} options - Additional options
 * @param {string} options.apiKey - Anthropic API key
 * @param {string} options.apiUrl - API base URL
 * @returns {Promise<Object>} - { success, draft, confidence, draftId, actionId }
 */
export async function draftEmailReply(incomingEmail, userId, options = {}) {
  const apiKey = options.apiKey || ANTHROPIC_API_KEY;
  const apiUrl = options.apiUrl || API_BASE_URL;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const resolvedUserId = await resolveInternalUserId(userId);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✉️  Email Draft Generator');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📨 From: ${incomingEmail.from}`);
  console.log(`📋 Subject: ${incomingEmail.subject}`);
  console.log('');

  // Step 1: Query vector DB for similar past messages
  console.log('🔍 Step 1: Retrieving similar past messages from vector DB...');
  const contextResults = await queryVectorDB(incomingEmail, resolvedUserId, apiUrl);
  console.log(`   ✅ Retrieved ${contextResults.length} relevant messages`);
  console.log('');

  // Calculate confidence based on context quality
  const confidence = calculateConfidence(contextResults);
  console.log(`📊 Confidence score: ${confidence.toFixed(2)} (${contextResults.length} relevant vectors)`);
  console.log('');

  // Step 2: Build the draft prompt
  console.log('🧠 Step 2: Building draft prompt with context...');
  const voiceProfile =
    options.useVoiceProfile === false ? null : await loadVoiceProfile(resolvedUserId, apiUrl);
  const prompt = buildDraftPrompt(incomingEmail, contextResults, voiceProfile);
  console.log('   ✅ Prompt built');
  console.log('');

  // Step 3: Call AI (OpenClaw with Anthropic fallback)
  console.log('🤖 Step 3: Calling AI to generate draft...');

  const aiResult = await callAI({
    system: prompt.system,
    user: prompt.user,
    maxTokens: MAX_TOKENS,
  });

  const draft = aiResult.content;
  const tokensUsed = aiResult.tokensUsed || 0;

  // Compatibility: create usage object for downstream consumers
  const usage = {
    input_tokens: Math.floor(tokensUsed * 0.3),
    output_tokens: Math.floor(tokensUsed * 0.7),
  };
  console.log(`   ✅ Generated draft via ${aiResult.source} (${draft.length} chars, ${tokensUsed} tokens)`);
  console.log('');

  // Step 4: Save draft to database
  console.log('💾 Step 4: Saving draft to database...');
  const draftResult = await saveDraft(
    resolvedUserId,
    incomingEmail,
    draft,
    confidence,
    tokensUsed,
    apiUrl
  );
  console.log(`   ✅ Draft saved (ID: ${draftResult.draftId})`);
  console.log('');

  // Step 5: Log action
  console.log('📝 Step 5: Logging action...');
  const actionResult = await logAction(
    resolvedUserId,
    incomingEmail,
    draftResult.draftId,
    confidence,
    apiUrl
  );
  console.log(`   ✅ Action logged (ID: ${actionResult.actionId})`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Email draft complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return {
    success: true,
    draft,
    confidence,
    draftId: draftResult.draftId,
    actionId: actionResult.actionId,
    tokensUsed,
    usage,
  };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Query the vector DB for similar past messages using direct embeddings query.
 * For emails, we don't have a project context, so we query directly.
 */
async function queryVectorDB(incomingEmail, userId, apiUrl) {
  // Build search query from email subject + body
  const searchQuery = `${incomingEmail.subject} ${incomingEmail.body}`;

  try {
    const response = await fetch(`${apiUrl}/api/internal/embeddings/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        query: searchQuery,
        topK: 5,
      }),
    });

    if (!response.ok) {
      console.warn(`   ⚠️  Vector query failed (${response.status}), continuing without context`);
      return [];
    }

    const data = await response.json();
    return data.data?.results || [];
  } catch (err) {
    console.warn(`   ⚠️  Vector query error: ${err.message}, continuing without context`);
    return [];
  }
}

/**
 * Calculate confidence score based on context quality.
 */
function calculateConfidence(contextResults) {
  if (contextResults.length >= 3) return 0.9;
  if (contextResults.length >= 1) return 0.7;
  return 0.5;
}

/**
 * Build the draft prompt for Claude.
 */
function buildDraftPrompt(incomingEmail, contextResults, voiceProfile = null) {
  const baseSystem = [
    'You are NightShift AI, drafting email replies on behalf of the user.',
    'You have access to examples of the user\'s past messages to learn their communication style.',
    'Match their tone, formality level, sentence structure, and vocabulary.',
    'Be concise and professional. Output ONLY the reply body — no subject line, no "Here\'s a draft:", no metadata.',
  ].join('\n');
  const system = voiceProfile?.systemPrompt
    ? `${voiceProfile.systemPrompt}\n\n${baseSystem}`
    : baseSystem;

  const contextSection = contextResults.length > 0
    ? [
        '## Examples of User\'s Past Messages',
        '',
        ...contextResults.map((result, i) => [
          `### Example ${i + 1} (relevance: ${(result.score * 100).toFixed(0)}%)`,
          result.content,
          '',
        ].join('\n')),
      ].join('\n')
    : '(No past message examples available — draft in a professional, concise tone)';

  const user = [
    '# Incoming Email to Reply To',
    '',
    `**From:** ${incomingEmail.from}`,
    `**Subject:** ${incomingEmail.subject}`,
    '',
    '**Body:**',
    incomingEmail.body,
    '',
    '---',
    '',
    contextSection,
    '',
    '---',
    '',
    '**Your task:** Draft a reply to this email. Match the user\'s communication style based on the examples above.',
    'Output only the reply body text.',
  ].join('\n');

  return { system, user };
}

async function loadVoiceProfile(userId, apiUrl) {
  try {
    const res = await fetch(`${apiUrl}/api/internal/voice-profile?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;
    return data.data || null;
  } catch {
    return null;
  }
}

/**
 * Save the draft to the database via POST /api/drafts.
 */
async function saveDraft(userId, incomingEmail, draft, confidence, tokensUsed, apiUrl) {
  try {
    const response = await fetch(`${apiUrl}/api/drafts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        type: 'email',
        title: `Reply to: ${incomingEmail.subject}`,
        content: draft,
        targetApp: 'gmail',
        confidenceScore: confidence,
        status: 'pending',
        context: JSON.stringify({
          recipientEmail: incomingEmail.from, // For send pipeline
          threadId: incomingEmail.threadId || null, // Gmail thread ID
          inReplyTo: incomingEmail.messageId || null, // For email headers
          incomingFrom: incomingEmail.from,
          incomingSubject: incomingEmail.subject,
          tokensUsed,
        }),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save draft: ${response.status}`);
    }

    const data = await response.json();
    return { draftId: data.data?.id || data.data?.draftId || 'unknown' };
  } catch (err) {
    console.warn(`   ⚠️  Failed to save draft: ${err.message}`);
    return { draftId: 'not-saved' };
  }
}

/**
 * Log the action to the database via POST /api/actions.
 */
async function logAction(userId, incomingEmail, draftId, confidence, apiUrl) {
  try {
    const response = await fetch(`${apiUrl}/api/actions`, {
      method: 'POST',
      headers: actionsPostHeaders(),
      body: JSON.stringify({
        userId,
        type: 'email_drafted',
        title: `Drafted reply to ${incomingEmail.from}`,
        description: `Subject: ${incomingEmail.subject}`,
        app: 'gmail',
        confidence,
        status: 'completed',
        metadata: JSON.stringify({
          draftId,
          incomingFrom: incomingEmail.from,
          incomingSubject: incomingEmail.subject,
        }),
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to log action: ${response.status}`);
    }

    const data = await response.json();
    return { actionId: data.data?.actionId || 'unknown' };
  } catch (err) {
    console.warn(`   ⚠️  Failed to log action: ${err.message}`);
    return { actionId: 'not-logged' };
  }
}
