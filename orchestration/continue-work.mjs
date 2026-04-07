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

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pushToGitHub, generatePRBody } from './github-push.mjs';
import { loadGitHubConfig } from '../src/lib/github.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ──────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 2000; // ~500 words for cost optimization

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
export async function continueWork(project, options = {}) {
  const apiKey = options.apiKey || ANTHROPIC_API_KEY;
  const apiUrl = options.apiUrl || API_BASE_URL;
  const dryRun = options.dryRun || false;
  const model = options.model || DEFAULT_MODEL;
  const maxTokens = options.maxTokens || DEFAULT_MAX_TOKENS;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌙 NightShift Work Continuation Agent');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📋 Project: ${project.name}`);
  console.log(`📊 Progress: ${project.progress}%`);
  console.log(`🎯 Next Step: ${project.context?.nextStep || 'Not specified'}`);
  console.log('');

  // Step 1: Build comprehensive context using context-builder
  console.log('🔍 Step 1: Building comprehensive project context...');
  const contextPackage = await buildProjectContext(project.id, apiUrl);
  console.log(`   ✅ Context built: ${contextPackage.relevantConversations.length} conversations, ${contextPackage.relatedEmails.length} emails`);
  console.log(`   📊 Context quality: ${contextPackage.contextQuality}`);
  console.log('');

  // Step 2: Build the continuation prompt
  console.log('🧠 Step 2: Building continuation prompt...');
  const prompt = buildContinuationPrompt(project, contextPackage);
  console.log(`   ✅ Prompt built (${prompt.system.length + prompt.user.length} chars)`);
  console.log('');

  // Step 3: Call Claude API
  console.log('🤖 Step 3: Calling Claude API to continue work...');
  const anthropic = new Anthropic({ apiKey });
  
  const response = await anthropic.messages.create({
    model: model,
    max_tokens: maxTokens,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  });

  const content = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n\n');

  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
  console.log(`   ✅ Generated ${content.length} chars (${tokensUsed} tokens)`);
  console.log('');

  if (dryRun) {
    console.log('🏃 Dry run mode — skipping save and action log');
    console.log('');
    console.log('─── Generated Content Preview ───');
    console.log(content.slice(0, 500) + (content.length > 500 ? '...' : ''));
    console.log('─────────────────────────────────');
    return { success: true, content, tokensUsed, dryRun: true };
  }

  // Step 4: Save output (GitHub PR for code, local file for documents)
  const classification = project.context?.classification || 'other';
  const githubConfig = loadGitHubConfig(project.userId);
  const useGitHub = classification === 'code_build' && githubConfig && githubConfig.token && githubConfig.defaultRepo;

  let outputPath;
  let prUrl = null;

  if (useGitHub) {
    console.log('💾 Step 4: Pushing code to GitHub...');
    
    // Determine file path and extension
    const safeName = project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Detect file extension from content
    let extension = '.js';
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('import react') || lowerContent.includes('export default')) {
      extension = '.tsx';
    } else if (lowerContent.includes('def ') || lowerContent.includes('import ')) {
      extension = '.py';
    }
    
    const filePath = `src/nightshift/${safeName}${extension}`;
    
    // Generate commit message and PR details
    const commitMessage = `feat: Continue work on ${project.name}\n\nGenerated by NightShift AI continuation agent.\nProgress: ${project.progress}%\nNext step: ${project.context?.nextStep || 'Continue development'}`;
    const prTitle = `NightShift: Continued work on ${project.name}`;
    const prBody = generatePRBody(
      project.name,
      project.description,
      project.context?.nextStep || 'Continue development',
      tokensUsed
    );
    
    try {
      const pushResult = await pushToGitHub({
        userId: project.userId,
        projectName: project.name,
        filePath,
        content,
        commitMessage,
        prTitle,
        prBody,
        dryRun: false,
      });
      
      outputPath = `GitHub PR: ${pushResult.branchName}`;
      prUrl = pushResult.prUrl;
      
      console.log(`   ✅ Pushed to GitHub: ${pushResult.branchName}`);
      console.log(`   🔗 Pull Request: ${prUrl}`);
    } catch (error) {
      console.warn(`   ⚠️  GitHub push failed: ${error.message}`);
      console.log('   📁 Falling back to local file save...');
      outputPath = await saveContinuation(project, content);
      console.log(`   ✅ Saved locally: ${outputPath}`);
    }
  } else {
    console.log('💾 Step 4: Saving continuation output...');
    outputPath = await saveContinuation(project, content);
    console.log(`   ✅ Saved to: ${outputPath}`);
    
    if (classification === 'code_build' && !useGitHub) {
      if (!githubConfig || !githubConfig.token) {
        console.log('   💡 Tip: Connect GitHub to push code directly to PRs');
      } else if (!githubConfig.defaultRepo) {
        console.log('   💡 Tip: Set a default repo to enable GitHub push');
      }
    }
  }
  console.log('');

  // Step 5: Log action to backend
  console.log('📝 Step 5: Logging action to backend...');
  await logAction(project, outputPath, tokensUsed, apiUrl, prUrl);
  console.log('   ✅ Action logged');
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Work continuation complete!');
  if (prUrl) {
    console.log(`� Pull Request: ${prUrl}`);
  } else {
    console.log(`�📄 Output: ${outputPath}`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return { success: true, outputPath, content, tokensUsed, prUrl };
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
function buildContinuationPrompt(project, contextPackage) {
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

  const system = [
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
    '- Focus on the most important next step, not the entire project',
    '- Reference specific context from their history when relevant',
    '- Be thorough and produce usable output',
  ].join('\n');

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
    '---',
    '',
    '**Your task:** Continue this work. Produce the next meaningful chunk of progress.',
    '**IMPORTANT:** Keep your output to a maximum of 500 words. Focus on the single most important next step.',
    'Output should be complete, usable, and ready for the user to review when they wake up.',
  ].join('\n');

  return { system, user };
}

/**
 * Save the continuation output to a file.
 */
async function saveContinuation(project, content) {
  const continuationsDir = path.join(__dirname, '..', 'data', 'continuations');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(continuationsDir)) {
    fs.mkdirSync(continuationsDir, { recursive: true });
  }

  const classification = project.context?.classification || 'other';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const safeName = project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  // Determine file extension based on classification
  let extension = '.md';
  let output = content;
  
  if (classification === 'code_build') {
    // Try to detect language from content or project name
    const lowerContent = content.toLowerCase();
    const lowerName = project.name.toLowerCase();
    
    if (lowerContent.includes('import react') || lowerContent.includes('export default') || 
        lowerContent.includes('const ') || lowerName.includes('react') || lowerName.includes('next')) {
      extension = '.tsx';
    } else if (lowerContent.includes('function ') || lowerContent.includes('const ') || 
               lowerContent.includes('let ') || lowerContent.includes('var ')) {
      extension = '.js';
    } else if (lowerContent.includes('def ') || lowerContent.includes('import ') || 
               lowerName.includes('python')) {
      extension = '.py';
    }
    
    // For code, don't add metadata header - just raw code
    output = content;
  } else {
    // For documents and academic work, add metadata header
    output = [
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
  }

  const filename = `${safeName}-${timestamp}${extension}`;
  const filepath = path.join(continuationsDir, filename);

  fs.writeFileSync(filepath, output, 'utf-8');
  return filepath;
}

/**
 * Log the action to the backend.
 */
async function logAction(project, outputPath, tokensUsed, apiUrl, prUrl = null) {
  try {
    const metadata = {
      projectId: project.id,
      projectName: project.name,
      outputPath,
      tokensUsed,
      timestamp: new Date().toISOString(),
    };
    
    if (prUrl) {
      metadata.prUrl = prUrl;
      metadata.pushedToGitHub = true;
    }
    
    const response = await fetch(`${apiUrl}/api/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      console.warn(`   ⚠️  Action log failed (${response.status}), but work was saved`);
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
