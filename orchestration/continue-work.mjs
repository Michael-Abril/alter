/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Core NightShift agent — continues unfinished work autonomously
 * DEPENDENCIES: Anthropic API, NightShift backend APIs
 * STATUS: LIVE — the actual work continuation engine
 *
 * This is the heart of NightShift. It takes a project, retrieves all relevant
 * context from the vector DB, and asks Claude to continue the work from where
 * the user left off. The output is saved as a continuation file.
 */

// Uses shared AI client with OpenClaw -> Anthropic fallback
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pushToGitHub, generatePRBody } from './github-push.mjs';
import { loadGitHubConfig } from '../src/lib/github.ts';
import { getOutputPath } from '../src/lib/output.ts';
import { saveDocx } from '../src/lib/docx-generator.ts';
import { resolveInternalUserId } from './user-resolver.mjs';
import { callAI } from './lib/ai-client.mjs';
import { actionsPostHeaders } from './lib/openclaw-headers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ──────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 4096;

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Continue work on a project using Claude + vector context retrieval.
 * 
 * @param {Object} project - The project to continue
 * @param {string} project.id - Project ID
 * @param {string} project.name - Project name
 * @param {string} project.description - Project description
 * @param {number} project.progress - Progress percentage (0-100)
 * @param {Object} project.context - Parsed context JSON
 * @param {string} project.context.nextStep - What to do next
 * @param {string[]} project.context.keyTopics - Key topics/keywords
 * @param {string} project.userId - User's internal ID
 * @param {string} options.apiKey - Anthropic API key (optional, uses env var if not provided)
 * @param {string} options.apiUrl - API base URL (optional, uses env var if not provided)
 * @param {boolean} options.dryRun - If true, don't save output or log action
 * @returns {Promise<Object>} - { success, outputPath, content, tokensUsed }
 */
function normalizeProjectContext(project) {
  const raw = project.context;
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Save + log only (after multi-iteration merge in overnight loop).
 */
export async function persistContinuationOutput(project, content, tokensUsed, options = {}) {
  const apiKey = options.apiKey || ANTHROPIC_API_KEY;
  const apiUrl = options.apiUrl || API_BASE_URL;
  const dryRun = options.dryRun || false;
  if (dryRun) {
    return { success: true, content, tokensUsed, dryRun: true };
  }
  const resolvedUserId = await resolveInternalUserId(project.userId);
  const normalizedProject = { ...project, userId: resolvedUserId, context: normalizeProjectContext(project) };

  const classification = normalizedProject.context?.classification || 'other';
  const githubConfig = loadGitHubConfig(normalizedProject.userId);
  const useGitHub = classification === 'code_build' && githubConfig && githubConfig.token && githubConfig.defaultRepo;

  let outputPath;
  let prUrl = null;
  let prSkipReason = null;

  if (useGitHub) {
    const safeName = project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    let extension = '.js';
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('import react') || lowerContent.includes('export default')) {
      extension = '.tsx';
    } else if (lowerContent.includes('def ') || lowerContent.includes('import ')) {
      extension = '.py';
    }
    const filePath = `src/nightshift/${safeName}${extension}`;
    const commitMessage = `feat: Continue work on ${normalizedProject.name}\n\nNightShift merged continuation.\n`;
    const prTitle = `NightShift: Continued work on ${normalizedProject.name}`;
    const prBody = generatePRBody(
      normalizedProject.name,
      normalizedProject.description,
      normalizedProject.context?.nextStep || 'Continue development',
      tokensUsed
    );
    try {
      const pushResult = await pushToGitHub({
        userId: normalizedProject.userId,
        projectName: normalizedProject.name,
        filePath,
        content,
        commitMessage,
        prTitle,
        prBody,
        dryRun: false,
      });
      outputPath = `GitHub PR: ${pushResult.branchName}`;
      prUrl = pushResult.prUrl;
    } catch (error) {
      prSkipReason = `push_failed: ${error.message}`;
      outputPath = await saveContinuation(normalizedProject, content);
    }
  } else {
    outputPath = await saveContinuation(normalizedProject, content);
    if (classification === 'code_build' && !useGitHub) {
      if (!githubConfig || !githubConfig.token) prSkipReason = 'missing_token';
      else if (!githubConfig.defaultRepo) prSkipReason = 'missing_default_repo';
    }
  }

  await logAction(normalizedProject, outputPath, tokensUsed, apiUrl, prUrl, prSkipReason, options.logMetadata);
  return { success: true, outputPath, content, tokensUsed, prUrl };
}

export async function continueWork(project, options = {}) {
  const apiKey = options.apiKey || ANTHROPIC_API_KEY;
  const apiUrl = options.apiUrl || API_BASE_URL;
  const dryRun = options.dryRun || false;
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS;
  const deferPersist = Boolean(options.deferPersist);
  const continuationOf =
    typeof options.continuationOf === 'string' && options.continuationOf.trim().length > 0
      ? options.continuationOf.trim()
      : null;
  const minWordsTarget =
    typeof options.minWordsTarget === 'number' && options.minWordsTarget > 0
      ? options.minWordsTarget
      : 500;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const resolvedUserId = await resolveInternalUserId(project.userId);
  const normalizedProject = {
    ...project,
    userId: resolvedUserId,
    context: normalizeProjectContext(project),
  };

  if (!options.quietLog) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌙 NightShift Work Continuation Agent');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Project: ${normalizedProject.name}`);
    console.log(`📊 Progress: ${normalizedProject.progress}%`);
    console.log(`🎯 Next Step: ${normalizedProject.context?.nextStep || 'Not specified'}`);
    if (continuationOf) console.log('🔁 Continuation pass (prior output appended)');
    console.log('');
  }

  // Step 1: Build comprehensive context using context-builder
  if (!options.quietLog) console.log('🔍 Step 1: Building comprehensive project context...');
  const contextPackage = await buildProjectContext(normalizedProject.id, apiUrl);
  if (!options.quietLog) {
    console.log(`   ✅ Context built: ${contextPackage.relevantConversations.length} conversations, ${contextPackage.relatedEmails.length} emails`);
    console.log(`   📊 Context quality: ${contextPackage.contextQuality}`);
    console.log('');
  }

  // Step 2: Build the continuation prompt
  if (!options.quietLog) console.log('🧠 Step 2: Building continuation prompt...');
  const voiceProfile = await loadVoiceProfile(normalizedProject.userId, apiUrl);
  const prompt = buildContinuationPrompt(normalizedProject, contextPackage, voiceProfile, {
    continuationOf,
    minWordsTarget,
  });
  if (!options.quietLog) {
    console.log(`   ✅ Prompt built (${prompt.system.length + prompt.user.length} chars)`);
    console.log('');
  }

  // Step 3: Call AI (OpenClaw with Anthropic fallback)
  if (!options.quietLog) console.log('🤖 Step 3: Calling AI to continue work...');

  const aiResult = await callAI({
    system: prompt.system,
    user: prompt.user,
    maxTokens,
  });

  const content = aiResult.content;
  const tokensUsed = aiResult.tokensUsed || 0;

  if (!options.quietLog) {
    console.log(`   ✅ Generated ${content.length} chars via ${aiResult.source} (${tokensUsed} tokens)`);
    console.log('');
  }

  // Compatibility: create usage object for downstream consumers
  const usage = {
    input_tokens: Math.floor(tokensUsed * 0.3), // Estimate
    output_tokens: Math.floor(tokensUsed * 0.7), // Estimate
  };

  if (dryRun) {
    console.log('🏃 Dry run mode — skipping save and action log');
    console.log('');
    console.log('─── Generated Content Preview ───');
    console.log(content.slice(0, 500) + (content.length > 500 ? '...' : ''));
    console.log('─────────────────────────────────');
    return { success: true, content, tokensUsed, usage, dryRun: true };
  }

  if (deferPersist) {
    return { success: true, content, tokensUsed, usage, deferred: true };
  }

  console.log('💾 Step 4–5: Saving & logging...');
  const persisted = await persistContinuationOutput(normalizedProject, content, tokensUsed, {
    apiKey,
    apiUrl,
    dryRun: false,
  });
  console.log(`   ✅ ${persisted.outputPath}`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Work continuation complete!');
  if (persisted.prUrl) {
    console.log(`🔗 Pull Request: ${persisted.prUrl}`);
  } else {
    console.log(`📄 Output: ${persisted.outputPath}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return {
    success: true,
    outputPath: persisted.outputPath,
    content,
    tokensUsed,
    prUrl: persisted.prUrl,
    usage,
  };
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Build comprehensive project context using the context-builder.
 */
async function buildProjectContext(projectId, apiUrl) {
  try {
    const response = await fetch(`${apiUrl}/api/internal/context-build`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });

    if (!response.ok) {
      console.warn(`   ⚠️  Context builder unavailable (${response.status}), using minimal context`);
      return {
        relevantConversations: [],
        relatedEmails: [],
        suggestedNextSteps: [],
        contextQuality: 'low',
      };
    }

    const data = await response.json();
    return {
      relevantConversations: data.data?.relevantConversations || [],
      relatedEmails: data.data?.relatedEmails || [],
      suggestedNextSteps: data.data?.suggestedNextSteps || [],
      contextQuality: data.data?.metadata?.contextQuality || 'low',
    };
  } catch (err) {
    console.warn(`   ⚠️  Context builder error: ${err.message}`);
    return {
      relevantConversations: [],
      relatedEmails: [],
      suggestedNextSteps: [],
      contextQuality: 'low',
    };
  }
}

/**
 * Build the continuation prompt for Claude using the comprehensive context package.
 */
function buildContinuationPrompt(project, contextPackage, voiceProfile = null, opts = {}) {
  const continuationOf =
    typeof opts.continuationOf === 'string' && opts.continuationOf.trim().length > 0
      ? opts.continuationOf.trim()
      : null;
  const minWordsTarget = typeof opts.minWordsTarget === 'number' && opts.minWordsTarget > 0 ? opts.minWordsTarget : 500;
  const tail = continuationOf
    ? continuationOf.length > 12000
      ? continuationOf.slice(-12000)
      : continuationOf
    : '';

  const classification = project.context?.classification || 'other';
  
  // Build classification-specific system prompts
  let classificationInstructions = '';
  
  if (classification === 'code_build') {
    classificationInstructions = [
      'CRITICAL: This is a CODE BUILD project.',
      'Generate the actual code for the next component or feature.',
      'Include real function implementations, not descriptions of what to build.',
      'Output should be copy-pasteable into a codebase.',
      'Use proper syntax, imports, and error handling.',
      'Write production-ready code with comments only where necessary.',
      'Do NOT write pseudo-code or outlines - write REAL, WORKING CODE.',
    ].join('\n');
  } else if (classification === 'document_build') {
    classificationInstructions = [
      'CRITICAL: This is a DOCUMENT BUILD project.',
      'Write the actual next section of this document in the user\'s voice.',
      'This should read like a real document section, not a plan or outline.',
      'Include specific details, numbers, and arguments.',
      'Match the tone and style from the conversation history.',
      'Write complete paragraphs with proper flow and transitions.',
      'Do NOT write bullet points or outlines - write ACTUAL PROSE.',
    ].join('\n');
  } else if (classification === 'academic_deliverable') {
    classificationInstructions = [
      'CRITICAL: This is an ACADEMIC DELIVERABLE project.',
      'Complete the next portion of this assignment.',
      'Show real work — if it\'s a problem set, solve the problems with full work shown.',
      'If it\'s a paper, write the next paragraphs with proper citations and arguments.',
      'If it\'s a study guide, create actual study materials with examples.',
      'Use academic language and proper formatting.',
      'Do NOT write plans or outlines - produce ACTUAL ACADEMIC WORK.',
    ].join('\n');
  } else {
    classificationInstructions = [
      'Produce concrete, actionable next steps.',
      'Focus on moving the project forward with specific recommendations.',
    ].join('\n');
  }

  const baseSystem = [
    'You are NightShift AI, an autonomous work continuation agent.',
    'Your job is to pick up where the user left off and continue their work.',
    'You have access to their chat history, emails, project context, and notes.',
    '',
    classificationInstructions,
    '',
    'General Guidelines:',
    '- Analyze what was being built and where they stopped',
    '- Continue the work in the same style and direction',
    '- Produce a meaningful next chunk of work',
    '- Prioritize the most important unfinished thread (length targets below may require a large single response)',
    '- Reference specific context from their history when relevant',
    '- Be thorough and produce usable output',
  ].join('\n');

  const shouldUseVoice =
    voiceProfile?.systemPrompt &&
    (classification === 'document_build' || classification === 'academic_deliverable');
  const system = shouldUseVoice
    ? `${voiceProfile.systemPrompt}\n\n${baseSystem}`
    : baseSystem;

  // Build conversations section
  const conversationsSection = contextPackage.relevantConversations.length > 0
    ? [
        '## Retrieved Conversations from User\'s History',
        '',
        ...contextPackage.relevantConversations.slice(0, 10).map((conv, i) => [
          `### Conversation ${i + 1} (relevance: ${(conv.score * 100).toFixed(0)}%)`,
          conv.content,
          '',
        ].join('\n')),
      ].join('\n')
    : '(No conversation history available)';

  // Build emails section
  const emailsSection = contextPackage.relatedEmails.length > 0
    ? [
        '## Related Emails',
        '',
        ...contextPackage.relatedEmails.slice(0, 5).map((email, i) => [
          `### Email ${i + 1} (relevance: ${(email.relevanceScore * 100).toFixed(0)}%)`,
          `**From:** ${email.from}`,
          `**Subject:** ${email.subject}`,
          `**Date:** ${email.receivedAt.toISOString().split('T')[0]}`,
          email.body,
          '',
        ].join('\n')),
      ].join('\n')
    : '';

  // Build suggested steps section
  const stepsSection = contextPackage.suggestedNextSteps.length > 0
    ? [
        '## Suggested Next Steps',
        ...contextPackage.suggestedNextSteps.map((step, i) => `${i + 1}. ${step}`),
      ].join('\n')
    : '';

  const continuationSection = continuationOf
    ? [
        '## Prior output (continue from the end — do not repeat this verbatim)',
        '',
        '```output-so-far',
        tail,
        '```',
        '',
        'Continue exactly where this leaves off. Close open lists, sections, proofs, or code blocks.',
        '',
      ].join('\n')
    : '';

  const lengthGuidance =
    minWordsTarget >= 2000
      ? [
          '**DELIVERABLE LENGTH (deadline-critical):** Produce at least 2000 words of substantive work in this response.',
          'Aim for the most complete next installment possible (full sections, finished arguments, or completed code paths).',
        ].join('\n')
      : [
          `**Target length:** At least ${minWordsTarget} words of substantive output in this response.`,
          'Stop at a natural section boundary when possible.',
        ].join('\n');

  const user = [
    '# Project to Continue',
    '',
    `**Name:** ${project.name}`,
    `**Description:** ${project.description || 'Not provided'}`,
    `**Progress:** ${project.progress}%`,
    `**Status:** ${project.status}`,
    `**Context Quality:** ${contextPackage.contextQuality}`,
    '',
    '## What to Do Next',
    project.context?.nextStep || 'Continue the work based on the context below.',
    '',
    '## Key Topics',
    project.context?.keyTopics?.length > 0
      ? project.context.keyTopics.map(t => `- ${t}`).join('\n')
      : '(None specified)',
    '',
    conversationsSection,
    '',
    emailsSection,
    '',
    stepsSection,
    '',
    continuationSection,
    '---',
    '',
    '**Your task:** Continue this work. Produce the next meaningful chunk of progress.',
    lengthGuidance,
    'Output should be complete, usable, and ready for the user to review when they wake up.',
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
 * Save the continuation output to a file in the proper format.
 */
async function saveContinuation(project, content) {
  const classification = project.context?.classification || 'other';
  
  // Code projects: save as code files
  if (classification === 'code_build') {
    const lowerContent = content.toLowerCase();
    const lowerName = project.name.toLowerCase();
    
    let extension = 'js';
    if (lowerContent.includes('import react') || lowerContent.includes('export default') || 
        lowerName.includes('react') || lowerName.includes('next')) {
      extension = 'tsx';
    } else if (lowerContent.includes('def ') || lowerContent.includes('import ') || 
               lowerName.includes('python')) {
      extension = 'py';
    }
    
    const filepath = getOutputPath(project.name, extension);
    fs.writeFileSync(filepath, content, 'utf-8');
    return filepath;
  }
  
  // Document and academic projects: save as .docx
  if (classification === 'document_build' || classification === 'academic_deliverable') {
    // Check if this involves a spreadsheet
    const lowerContent = content.toLowerCase();
    const lowerName = project.name.toLowerCase();
    const isSpreadsheet = lowerContent.includes('excel') || lowerContent.includes('spreadsheet') || 
                          lowerContent.includes('table') || lowerName.includes('excel') || 
                          lowerName.includes('spreadsheet');
    
    let docContent = content;
    
    if (isSpreadsheet) {
      // Add note about spreadsheet
      docContent = [
        '# ⚠️ Spreadsheet Project Detected',
        '',
        '**Note:** This project involves an Excel template or spreadsheet. NightShift generated the content below — paste it into your spreadsheet.',
        '',
        '---',
        '',
        content,
      ].join('\n');
    }
    
    const filepath = getOutputPath(project.name, 'docx');
    
    // Generate .docx file
    await saveDocx(filepath, {
      title: project.name,
      content: docContent,
      author: 'NightShift AI',
      subject: `${classification} - ${project.context?.nextStep || 'Continued work'}`,
    });
    
    return filepath;
  }
  
  // Other projects: save as markdown
  const filepath = getOutputPath(project.name, 'md');
  const output = [
    '# NightShift Work Continuation',
    '',
    `**Project:** ${project.name}`,
    `**Classification:** ${classification}`,
    `**Generated:** ${new Date().toISOString()}`,
    `**Progress Before:** ${project.progress}%`,
    `**Next Step:** ${project.context?.nextStep || 'N/A'}`,
    '',
    '---',
    '',
    content,
  ].join('\n');
  
  fs.writeFileSync(filepath, output, 'utf-8');
  return filepath;
}

/**
 * Log the action to the backend.
 */
async function logAction(project, outputPath, tokensUsed, apiUrl, prUrl = null, prSkipReason = null, extraMeta = null) {
  try {
    const metadata = {
      projectId: project.id,
      projectName: project.name,
      outputPath,
      filePath: outputPath,
      tokensUsed,
      timestamp: new Date().toISOString(),
      ...(extraMeta && typeof extraMeta === 'object' ? extraMeta : {}),
    };

    if (prUrl) {
      metadata.prUrl = prUrl;
      metadata.pushedToGitHub = true;
    }

    if (prSkipReason) {
      metadata.prSkipReason = prSkipReason;
      metadata.pushedToGitHub = false;
    }
    
    const response = await fetch(`${apiUrl}/api/actions`, {
      method: 'POST',
      headers: actionsPostHeaders(),
      body: JSON.stringify({
        userId: project.userId,
        type: 'work_continued',
        title: prUrl ? `Opened PR: ${project.name}` : `Continued work on ${project.name}`,
        description: prUrl 
          ? `Created GitHub pull request (${tokensUsed} tokens used)`
          : `Generated continuation output (${tokensUsed} tokens used)`,
        app: 'nightshift',
        confidence: 0.8, // Base confidence for autonomous work
        status: 'completed',
        metadata: JSON.stringify(metadata),
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn(
        `   ⚠️  Action log failed (${response.status}), but work was saved${errText ? `: ${errText.slice(0, 500)}` : ''}`
      );
    }
  } catch (err) {
    console.warn(`   ⚠️  Action log error: ${err.message}, but work was saved`);
  }
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('❌ This script requires a project object as input.');
  console.error('   Use test-continue.mjs to run a test, or import this module programmatically.');
  process.exit(1);
}
