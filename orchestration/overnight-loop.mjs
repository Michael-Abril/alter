/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Master orchestration agent — runs all NightShift tasks overnight
 * DEPENDENCIES: continue-work.mjs, draft-email.mjs, NightShift backend APIs
 * STATUS: LIVE — the overnight loop that does everything
 *
 * This is the master agent that runs when the user activates NightShift.
 * It orchestrates all autonomous work: project continuation, email drafting,
 * action logging, and morning brief generation.
 *
 * Usage:
 *   node orchestration/overnight-loop.mjs --user-id=USER_ID --project-ids=ID1,ID2
 *   node orchestration/overnight-loop.mjs --simulate  # Run with current handoff data
 */

console.log('[overnight-loop] Script loaded');

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { continueWork, persistContinuationOutput } from './continue-work.mjs';
import { draftEmailReply } from './draft-email.mjs';
import { resolveInternalUserId } from './user-resolver.mjs';

// ─── Config ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const SIMULATE = args.includes('--simulate');
const USER_ID_ARG = args.find(a => a.startsWith('--user-id='))?.split('=')[1];
const PROJECT_IDS_ARG = args.find(a => a.startsWith('--project-ids='))?.split('=')[1];
const INSTRUCTIONS_ARG = args.find(a => a.startsWith('--instructions='))?.split('=')[1];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const HAIKU_MODEL = 'claude-haiku-4-5-20251001'; // For classification/summarization
const SONNET_MODEL = 'claude-sonnet-4-20250514'; // For work continuation only

/** Hard cap per run (safety); within this we spend up to RUN_BUDGET_USD. */
const MAX_PROJECTS_PER_RUN = Math.max(1, Number(process.env.NIGHTSHIFT_MAX_PROJECTS_PER_RUN ?? 20));
/** Default $0.05 per overnight run — tune with NIGHTSHIFT_RUN_BUDGET_USD */
const RUN_BUDGET_USD = Number(process.env.NIGHTSHIFT_RUN_BUDGET_USD ?? 0.05);
const SONNET_PRICE_IN_PER_MTOK = Number(process.env.ANTHROPIC_SONNET_PRICE_IN_PER_MTOK ?? 3);
const SONNET_PRICE_OUT_PER_MTOK = Number(process.env.ANTHROPIC_SONNET_PRICE_OUT_PER_MTOK ?? 15);
const MAX_CONTINUATION_ITERATIONS = 3;

function usdForSonnetUsage(usage) {
  const inT = usage?.input_tokens ?? 0;
  const outT = usage?.output_tokens ?? 0;
  return (inT / 1e6) * SONNET_PRICE_IN_PER_MTOK + (outT / 1e6) * SONNET_PRICE_OUT_PER_MTOK;
}

function parseProjectContextJson(project) {
  if (!project.context) return {};
  if (typeof project.context === 'object') return { ...project.context };
  try {
    return JSON.parse(project.context);
  } catch {
    return {};
  }
}

function parseAcademicDueDate(ctx) {
  const raw = ctx.academicDueAt || ctx.canvasDueAt || ctx.deadline || ctx.dueAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function academicDueWithin48Hours(project) {
  const ctx = parseProjectContextJson(project);
  const cls = ctx.classification || classifyProject(project);
  if (cls !== 'academic_deliverable') return false;
  const d = parseAcademicDueDate(ctx);
  if (!d) return false;
  const now = Date.now();
  return d.getTime() > now && d.getTime() - now <= 48 * 60 * 60 * 1000;
}

function wordCountText(s) {
  return (s || '').trim().split(/\s+/).filter(Boolean).length;
}

function outputAppearsIncomplete(text, minWords, classification) {
  const t = (text || '').trim();
  const cls = classification || 'other';
  if (cls === 'code_build') {
    const fences = (t.match(/```/g) || []).length;
    if (fences % 2 === 1) return true;
    if (t.length < 200) return true;
    return false;
  }
  if (wordCountText(t) < minWords) return true;
  if (t.length < 120) return true;
  const fences = (t.match(/```/g) || []).length;
  if (fences % 2 === 1) return true;
  if (/[,;:]\s*$/.test(t)) return true;
  if (/\b(and|or|as follows|the following)\s*$/i.test(t)) return true;
  if (!/[.!?…"'")\]}]\s*$/.test(t)) return true;
  return false;
}

function sortProjectsForOvernight(projects) {
  return [...projects].sort((a, b) => {
    const ua = academicDueWithin48Hours(a) ? 0 : 1;
    const ub = academicDueWithin48Hours(b) ? 0 : 1;
    if (ua !== ub) return ua - ub;
    return (a.progress || 0) - (b.progress || 0);
  });
}

function scoreUndraftedEmail(e) {
  const subj = (e.subject || '').toLowerCase();
  let s = 0;
  if (/urgent|asap|important|invoice|contract|offer|deadline|action required|meeting|legal/.test(subj)) {
    s += 10;
  }
  if (/re:|fw:|fwd:/.test(subj)) s += 1;
  const ageDays = (Date.now() - new Date(e.receivedAt).getTime()) / 86400000;
  s += Math.max(0, 5 - Math.min(5, ageDays));
  return s;
}

async function postOvernightSummaryAction(apiUrl, userId, stats) {
  try {
    const res = await fetch(`${apiUrl}/api/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        type: 'overnight_run_summary',
        title: 'Overnight run — spend & output',
        description: `$${stats.spentUsd.toFixed(4)} spent, ${stats.totalTokensUsed} tokens, ${stats.filesGenerated} files`,
        app: 'nightshift',
        confidence: 1,
        status: 'completed',
        metadata: JSON.stringify(stats),
      }),
    });
    if (!res.ok) {
      console.warn(`   ⚠️  overnight_run_summary action failed (${res.status})`);
    }
  } catch (e) {
    console.warn('   ⚠️  Could not post overnight_run_summary action:', e.message);
  }
}

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Run the overnight loop - the master orchestration agent.
 * 
 * @param {Object} config - Configuration
 * @param {string} config.userId - User's internal ID
 * @param {string[]} config.projectIds - List of project IDs to work on
 * @param {string} config.instructions - Special instructions from user
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Complete morning brief
 */
export async function runOvernightLoop(config, options = {}) {
  const { userId, projectIds, instructions } = config;
  const resolvedUserId = await resolveInternalUserId(userId);
  const apiUrl = options.apiUrl || API_BASE_URL;
  const apiKey = options.apiKey || ANTHROPIC_API_KEY;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🌙 NightShift Overnight Loop');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`👤 User: ${resolvedUserId}`);
  console.log(`📋 Projects: ${projectIds.length} (up to ${MAX_PROJECTS_PER_RUN} per run, budget $${RUN_BUDGET_USD.toFixed(2)})`);
  if (instructions) console.log(`💬 Instructions: ${instructions}`);
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  console.log('');

  console.log('💰 Run budget:');
  console.log(`   Max spend this run: $${RUN_BUDGET_USD.toFixed(4)} (NIGHTSHIFT_RUN_BUDGET_USD)`);
  console.log(`   Sonnet pricing (est.): $${SONNET_PRICE_IN_PER_MTOK}/M in, $${SONNET_PRICE_OUT_PER_MTOK}/M out`);
  console.log('');

  if (!SIMULATE && !options.skipConfirmation) {
    console.log('⚠️  This will use real API credits. Run with --simulate to test without cost.');
    console.log('   Press Ctrl+C to cancel, or the script will continue in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const startTime = Date.now();
  const results = {
    projectsContinued: [],
    emailsDrafted: [],
    flaggedItems: [],
    errors: [],
    stats: {
      totalProjects: projectIds.length,
      successfulProjects: 0,
      failedProjects: 0,
      totalEmails: 0,
      draftedEmails: 0,
      totalActions: 0,
      totalTokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0,
      spentUsd: 0,
      budgetUsd: RUN_BUDGET_USD,
      filesGenerated: 0,
      duration: 0,
    },
  };

  // ─── Step 0: Sync external data sources ─────────────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 STEP 0: Syncing Data Sources');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const syncEndpoints = [
    { name: 'Gmail (sent+received)', path: '/api/gmail/sync', method: 'POST', body: { direction: 'both', sinceDays: 3 } },
    { name: 'GitHub Activity', path: '/api/github/sync', method: 'POST' },
    { name: 'Calendar Events', path: '/api/calendar/sync', method: 'POST' },
  ];

  for (const endpoint of syncEndpoints) {
    try {
      console.log(`   🔄 ${endpoint.name}...`);
      const syncRes = await fetch(`${apiUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' },
        body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
      });
      if (syncRes.ok) {
        const data = await syncRes.json();
        console.log(`   ✅ ${endpoint.name}: synced`);
      } else {
        console.log(`   ⚠️  ${endpoint.name}: skipped (${syncRes.status})`);
      }
    } catch (err) {
      console.log(`   ⚠️  ${endpoint.name}: unavailable (${err.message})`);
    }
  }
  console.log('');

  // ─── Step 1: Continue work on each project ──────────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📂 STEP 1: Project Continuation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const projectResponse = await fetch(`${apiUrl}/api/internal/projects?userId=${resolvedUserId}`);
  if (!projectResponse.ok) {
    console.error(`   ❌ Failed to fetch projects: ${projectResponse.status}`);
    results.errors.push({ type: 'project_fetch', error: `HTTP ${projectResponse.status}` });
  } else {
    const projectsData = await projectResponse.json();
    const allProjects = projectsData.data?.projects || [];
    const byId = new Map(allProjects.map(p => [p.id, p]));
    let queue = projectIds.map(id => byId.get(id)).filter(Boolean);
    queue = sortProjectsForOvernight(queue).slice(0, MAX_PROJECTS_PER_RUN);

    for (let i = 0; i < queue.length; i++) {
      if (results.stats.spentUsd >= RUN_BUDGET_USD - 1e-9) {
        console.log('   💸 Run budget exhausted — stopping project continuation.');
        break;
      }

      const project = queue[i];
      console.log(`[${i + 1}/${queue.length}] Processing project: ${project.id}`);
      console.log('');

      try {
        const ctx = parseProjectContextJson(project);
        const classification = ctx.classification || classifyProject(project);
        const urgentAcademic = academicDueWithin48Hours(project);
        const minWords = urgentAcademic ? 2000 : 500;
        const maxTokens = urgentAcademic ? 16000 : 4096;

        if (urgentAcademic) {
          console.log('   🎓 Academic deliverable due within 48h — minimum ~2000 words, higher token cap');
        }
        console.log(`   📋 ${project.name} (${project.progress}%) [${classification}]`);
        console.log('');

        let merged = '';
        let combinedUsage = { input_tokens: 0, output_tokens: 0 };
        let iterations = 0;
        let lastChunk = '';

        for (let iter = 0; iter < MAX_CONTINUATION_ITERATIONS; iter++) {
          if (results.stats.spentUsd >= RUN_BUDGET_USD - 1e-9) {
            console.log('   💸 Budget exhausted mid-project.');
            break;
          }

          const estNext = 0.002;
          if (results.stats.spentUsd + estNext > RUN_BUDGET_USD) {
            console.log('   💸 Insufficient budget for another model call.');
            break;
          }

          const chunk = await continueWork(
            { ...project, context: ctx },
            {
              apiKey,
              apiUrl,
              dryRun: false,
              model: SONNET_MODEL,
              maxTokens,
              minWordsTarget: minWords,
              continuationOf: iter === 0 ? null : merged,
              deferPersist: true,
              quietLog: iter > 0,
            }
          );

          if (!chunk.success || !chunk.content) {
            throw new Error('Continuation returned no content');
          }

          const u = chunk.usage || { input_tokens: 0, output_tokens: 0 };
          combinedUsage.input_tokens += u.input_tokens;
          combinedUsage.output_tokens += u.output_tokens;
          const sliceCost = usdForSonnetUsage(u);
          results.stats.spentUsd += sliceCost;
          results.stats.inputTokens += u.input_tokens;
          results.stats.outputTokens += u.output_tokens;
          results.stats.totalTokensUsed += u.input_tokens + u.output_tokens;

          lastChunk = chunk.content;
          merged = iter === 0 ? chunk.content : `${merged}\n\n${chunk.content}`;
          iterations++;

          const incomplete = outputAppearsIncomplete(lastChunk, minWords, classification);
          console.log(
            `   🔁 Iteration ${iterations}/${MAX_CONTINUATION_ITERATIONS} — ${lastChunk.length} chars, +$${sliceCost.toFixed(5)} (run total $${results.stats.spentUsd.toFixed(4)})`
          );
          if (!incomplete) {
            console.log('   ✅ Output looks complete — stopping iterations for this project.');
            break;
          }
        }

        if (!merged.trim()) {
          throw new Error('No continuation output produced');
        }

        const persisted = await persistContinuationOutput(
          { ...project, context: ctx },
          merged,
          combinedUsage.input_tokens + combinedUsage.output_tokens,
          {
            apiKey,
            apiUrl,
            logMetadata: {
              continuationIterations: iterations,
              academicUrgent: urgentAcademic,
              minWordsTarget: minWords,
              combinedInputTokens: combinedUsage.input_tokens,
              combinedOutputTokens: combinedUsage.output_tokens,
            },
          }
        );

        const progressIncrement = Math.min(25, 8 + iterations * 4);
        const newProgress = Math.min(100, (project.progress || 0) + progressIncrement);

        results.projectsContinued.push({
          projectId: project.id,
          projectName: project.name,
          progressBefore: project.progress,
          progressAfter: newProgress,
          outputPath: persisted.outputPath,
          contentLength: merged.length,
          tokensUsed: combinedUsage.input_tokens + combinedUsage.output_tokens,
          iterations,
          academicUrgent: urgentAcademic,
        });

        results.stats.successfulProjects++;
        results.stats.filesGenerated += 1;

        console.log(`   ✅ Saved (${iterations} iteration(s)): ${persisted.outputPath}`);
        console.log(`   📈 Progress estimate: ${project.progress}% → ${newProgress}%`);
        console.log('');
      } catch (err) {
        console.error(`   ❌ Error: ${err.message}`);
        console.log('');
        results.errors.push({
          type: 'project_continuation',
          projectId: project.id,
          error: err.message,
        });
        results.stats.failedProjects++;
      }
    }
  }

  // ─── Step 2: Draft replies for incoming emails ──────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📧 STEP 2: Email Draft Generation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  try {
    // Fetch incoming emails that don't have drafts yet
    const emailsResponse = await fetch(`${apiUrl}/api/internal/emails/undrafted?userId=${resolvedUserId}`);
    
    if (emailsResponse.ok) {
      const emailsData = await emailsResponse.json();
      const undraftedEmails = emailsData.data?.emails || [];

      results.stats.totalEmails = undraftedEmails.length;

      if (undraftedEmails.length === 0) {
        console.log('   ℹ️  No incoming emails requiring drafts');
        console.log('');
      } else {
        const ranked = [...undraftedEmails].sort((a, b) => scoreUndraftedEmail(b) - scoreUndraftedEmail(a));
        const topEmails = ranked.slice(0, 3);
        console.log(
          `   Found ${undraftedEmails.length} undrafted; drafting top ${topEmails.length} by importance (after projects, within budget)`
        );
        console.log('');

        for (let i = 0; i < topEmails.length; i++) {
          if (results.stats.spentUsd >= RUN_BUDGET_USD - 1e-9) {
            console.log('   💸 Budget exhausted — skipping remaining email drafts.');
            break;
          }

          const email = topEmails[i];
          console.log(`   [${i + 1}/${topEmails.length}] Drafting reply to: ${email.from}`);
          console.log(`   Subject: ${email.subject}`);
          console.log('');

          try {
            const draftResult = await draftEmailReply(
              {
                from: email.from,
                subject: email.subject,
                body: email.body,
              },
              resolvedUserId,
              { apiKey, apiUrl }
            );

            if (draftResult.success) {
              const u = draftResult.usage || { input_tokens: 0, output_tokens: 0 };
              const c = usdForSonnetUsage(u);
              results.stats.spentUsd += c;
              results.stats.inputTokens += u.input_tokens;
              results.stats.outputTokens += u.output_tokens;
              results.stats.totalTokensUsed += draftResult.tokensUsed || 0;

              results.emailsDrafted.push({
                emailId: email.id,
                from: email.from,
                subject: email.subject,
                draftId: draftResult.draftId,
                confidence: draftResult.confidence,
                tokensUsed: draftResult.tokensUsed || 0,
              });

              results.stats.draftedEmails++;
              results.stats.filesGenerated += 1;

              console.log(`   ✅ Draft created (confidence: ${draftResult.confidence.toFixed(2)}, +$${c.toFixed(5)})`);
              console.log('');
            }
          } catch (err) {
            console.error(`   ❌ Error drafting reply: ${err.message}`);
            console.log('');
            results.errors.push({
              type: 'email_draft',
              emailId: email.id,
              error: err.message,
            });
          }
        }
      }
    } else {
      console.log('   ⚠️  Email API unavailable, skipping email drafts');
      console.log('');
    }
  } catch (err) {
    console.error(`   ❌ Error fetching emails: ${err.message}`);
    console.log('');
    results.errors.push({
      type: 'email_fetch',
      error: err.message,
    });
  }

  // ─── Step 3: Check for flagged items ────────────────────────────────────────

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚩 STEP 3: Flagged Items Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Check for low-confidence drafts
  const lowConfidenceDrafts = results.emailsDrafted.filter(d => d.confidence < 0.7);
  if (lowConfidenceDrafts.length > 0) {
    console.log(`   ⚠️  ${lowConfidenceDrafts.length} email drafts with low confidence (<0.7)`);
    results.flaggedItems.push(...lowConfidenceDrafts.map(d => ({
      type: 'low_confidence_draft',
      subject: d.subject,
      confidence: d.confidence,
      draftId: d.draftId,
    })));
  }

  // Check for errors
  if (results.errors.length > 0) {
    console.log(`   ⚠️  ${results.errors.length} errors occurred during execution`);
    results.flaggedItems.push(...results.errors.map(e => ({
      type: 'error',
      errorType: e.type,
      message: e.error,
    })));
  }

  if (results.flaggedItems.length === 0) {
    console.log('   ✅ No items flagged for review');
  }
  console.log('');

  // ─── Step 4: Compile morning brief ──────────────────────────────────────────

  const endTime = Date.now();
  results.stats.duration = Math.round((endTime - startTime) / 1000);
  results.stats.totalActions = results.projectsContinued.length + results.emailsDrafted.length;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 STEP 4: Morning Brief Generation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  const brief = generateMorningBrief(results, {
    userId: resolvedUserId,
    instructions,
    startTime: new Date(startTime),
  });
  
  // Save brief to file
  const briefPath = saveBriefToFile(brief, startTime);
  console.log(`   ✅ Morning brief saved: ${briefPath}`);
  console.log('');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ NightShift Overnight Loop Complete');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`⏱️  Duration: ${results.stats.duration}s`);
  console.log(`📂 Projects: ${results.stats.successfulProjects}/${results.stats.totalProjects} completed`);
  console.log(`📧 Emails: ${results.stats.draftedEmails}/${results.stats.totalEmails} drafted`);
  console.log(`🚩 Flagged: ${results.flaggedItems.length} items`);
  console.log(`🪙 Tokens: ${results.stats.totalTokensUsed.toLocaleString()} (in ${results.stats.inputTokens} / out ${results.stats.outputTokens})`);
  console.log(`💸 Spend (est.): $${results.stats.spentUsd.toFixed(4)} / $${RUN_BUDGET_USD.toFixed(4)} budget`);
  console.log(`📄 Files generated: ${results.stats.filesGenerated}`);
  console.log('');

  await postOvernightSummaryAction(apiUrl, resolvedUserId, {
    spentUsd: results.stats.spentUsd,
    budgetUsd: RUN_BUDGET_USD,
    totalTokensUsed: results.stats.totalTokensUsed,
    inputTokens: results.stats.inputTokens,
    outputTokens: results.stats.outputTokens,
    filesGenerated: results.stats.filesGenerated,
    projectsContinued: results.projectsContinued.length,
    emailsDrafted: results.emailsDrafted.length,
    durationSec: results.stats.duration,
  });

  // Write run status for the handoff status endpoint
  writeRunStatus('completed', results, briefPath);

  return {
    success: true,
    brief,
    briefPath,
    results,
  };
}

function writeRunStatus(state, results = null, briefPath = null) {
  const statusPath = process.env.NIGHTSHIFT_RUN_STATUS_PATH;
  if (!statusPath) return;
  try {
    const payload = { state, finishedAt: new Date().toISOString() };
    if (results) {
      payload.projectsContinued = results.projectsContinued?.length || 0;
      payload.emailsDrafted = results.emailsDrafted?.length || 0;
      payload.totalTokensUsed = results.stats?.totalTokensUsed || 0;
      payload.inputTokens = results.stats?.inputTokens || 0;
      payload.outputTokens = results.stats?.outputTokens || 0;
      payload.spentUsd = results.stats?.spentUsd ?? 0;
      payload.budgetUsd = results.stats?.budgetUsd ?? RUN_BUDGET_USD;
      payload.filesGenerated = results.stats?.filesGenerated || 0;
      payload.duration = results.stats?.duration || 0;
      payload.outputs = (results.projectsContinued || []).map(p => p.outputPath);
    }
    if (briefPath) payload.briefPath = briefPath;
    fs.writeFileSync(statusPath, JSON.stringify(payload, null, 2));
  } catch (e) {
    console.warn('[overnight-loop] Failed to write run status:', e.message);
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function generateMorningBrief(results, metadata) {
  const { userId, instructions, startTime } = metadata;
  const date = new Date(startTime);
  const dateStr = date.toISOString().split('T')[0];

  const lines = [];
  
  lines.push('# NightShift Morning Brief');
  lines.push('');
  lines.push(`**Date:** ${date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Duration:** ${results.stats.duration}s`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary
  lines.push('## 📊 Summary');
  lines.push('');
  lines.push(`While you were away, NightShift completed **${results.stats.totalActions} autonomous actions**:`);
  lines.push('');
  lines.push(`- ✅ **${results.stats.successfulProjects}** projects continued`);
  lines.push(`- 📧 **${results.stats.draftedEmails}** email drafts created`);
  lines.push(`- 🚩 **${results.flaggedItems.length}** items flagged for review`);
  lines.push(`- 🪙 **${results.stats.totalTokensUsed.toLocaleString()}** tokens used (in+out)`);
  lines.push('');

  lines.push('## 💸 Overnight run economics');
  lines.push('');
  lines.push(`- **Estimated spend:** $${(results.stats.spentUsd ?? 0).toFixed(4)} (budget $${(results.stats.budgetUsd ?? RUN_BUDGET_USD).toFixed(4)})`);
  lines.push(`- **Tokens:** ${(results.stats.inputTokens ?? 0).toLocaleString()} in + ${(results.stats.outputTokens ?? 0).toLocaleString()} out = **${results.stats.totalTokensUsed.toLocaleString()}** total`);
  lines.push(`- **Files generated:** ${results.stats.filesGenerated ?? 0} (continuations + email drafts)`);
  lines.push('');

  if (instructions) {
    lines.push(`**Your instructions:** "${instructions}"`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Projects continued
  if (results.projectsContinued.length > 0) {
    lines.push('## 📂 Projects Continued');
    lines.push('');
    
    for (const proj of results.projectsContinued) {
      lines.push(`### ${proj.projectName}`);
      lines.push('');
      lines.push(`- **Progress:** ${proj.progressBefore}% → ${proj.progressAfter}% (+${proj.progressAfter - proj.progressBefore}%)`);
      lines.push(`- **Continuation iterations:** ${proj.iterations ?? 1} (max ${MAX_CONTINUATION_ITERATIONS})`);
      if (proj.academicUrgent) {
        lines.push('- **Academic urgent (≤48h):** expanded minimum length / token budget');
      }
      lines.push(`- **Output:** ${(proj.contentLength / 1000).toFixed(1)}k characters generated`);
      lines.push(`- **Tokens:** ${proj.tokensUsed.toLocaleString()}`);
      lines.push(`- **File:** \`${path.basename(String(proj.outputPath || 'output'))}\``);
      lines.push('');
    }
  }

  // Email drafts
  if (results.emailsDrafted.length > 0) {
    lines.push('## 📧 Email Drafts Created');
    lines.push('');
    
    for (const email of results.emailsDrafted) {
      const confidenceEmoji = email.confidence >= 0.9 ? '🟢' : email.confidence >= 0.7 ? '🟡' : '🔴';
      lines.push(`### ${confidenceEmoji} Reply to: ${email.from}`);
      lines.push('');
      lines.push(`- **Subject:** ${email.subject}`);
      lines.push(`- **Confidence:** ${(email.confidence * 100).toFixed(0)}%`);
      lines.push(`- **Draft ID:** \`${email.draftId}\``);
      lines.push(`- **Tokens:** ${email.tokensUsed.toLocaleString()}`);
      lines.push('');
    }
  }

  // Flagged items
  if (results.flaggedItems.length > 0) {
    lines.push('## 🚩 Items Flagged for Review');
    lines.push('');
    
    for (const item of results.flaggedItems) {
      if (item.type === 'low_confidence_draft') {
        lines.push(`- **Low confidence draft:** "${item.subject}" (${(item.confidence * 100).toFixed(0)}% confidence)`);
      } else if (item.type === 'error') {
        lines.push(`- **Error in ${item.errorType}:** ${item.message}`);
      }
    }
    lines.push('');
  }

  // Errors
  if (results.errors.length > 0) {
    lines.push('## ❌ Errors Encountered');
    lines.push('');
    
    for (const error of results.errors) {
      lines.push(`- **${error.type}:** ${error.error}`);
      if (error.projectId) lines.push(`  - Project ID: ${error.projectId}`);
      if (error.emailId) lines.push(`  - Email ID: ${error.emailId}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('**Next Steps:**');
  lines.push('');
  lines.push('1. Review the continuation outputs in `/data/continuations/`');
  lines.push('2. Check email drafts in the dashboard and approve/edit as needed');
  if (results.flaggedItems.length > 0) {
    lines.push('3. Address flagged items that need your attention');
  }
  lines.push('');

  return lines.join('\n');
}

function saveBriefToFile(brief, startTime) {
  const briefsDir = path.join(process.cwd(), 'data', 'briefs');
  
  if (!fs.existsSync(briefsDir)) {
    fs.mkdirSync(briefsDir, { recursive: true });
  }

  const date = new Date(startTime).toISOString().split('T')[0];
  const timestamp = new Date(startTime).toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `${date}-${timestamp}.md`;
  const filepath = path.join(briefsDir, filename);

  fs.writeFileSync(filepath, brief, 'utf-8');
  return filepath;
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────

// ─── Project Classification ──────────────────────────────────────────────────

function classifyProject(project) {
  const name = project.name.toLowerCase();
  const description = (project.description || '').toLowerCase();
  const topics = project.context?.keyTopics || [];
  const combined = `${name} ${description} ${topics.join(' ')}`.toLowerCase();

  // Casual - brainstorming, exploration, trip planning, personal projects (check FIRST)
  if (combined.match(/\b(trip|adventure|travel|peru|empanada|merchandise|sorority|adpi)\b/)) {
    return 'casual';
  }

  // Academic study - exam prep, quiz prep, study guides (check BEFORE deliverables)
  if (combined.match(/\b(study guide|exam|quiz|midterm|practice|review|prep)\b/)) {
    return 'academic_study';
  }

  // Quick tasks - one-off help, solved problems
  if (combined.match(/\b(verification|test|quick|solved)\b/) && project.progress > 50) {
    return 'quick_task';
  }

  // Academic deliverables - problem sets, papers, presentations with Canvas deadlines
  if (combined.match(/\b(homework|problem set|assignment|case study|deliverable|session \d+|abc|accounting|finance)\b/) ||
      (combined.match(/\b(presentation|paper)\b/) && combined.match(/\b(course|class|ent\d+|acc\d+|ecn\d+|mac)\b/))) {
    return 'academic_deliverable';
  }

  // Code builds - actively writing code for startups/businesses
  if (combined.match(/\b(nightshift|github|integration|setup|api|backend|frontend|deploy)\b/) ||
      (combined.match(/\b(website|web app|landing page|platform)\b/) && !combined.match(/\b(empanada|merchandise|sorority)\b/))) {
    return 'code_build';
  }

  // Document builds - proposals, pitch decks, business plans, papers
  if (combined.match(/\b(pitch deck|proposal|business plan|incubator|platform|model|presentation|analysis)\b/) &&
      !combined.match(/\b(study|exam|quiz|midterm|practice)\b/)) {
    return 'document_build';
  }

  // Default to document_build for unclassified projects
  return 'document_build';
}

function prioritizeProjects(projects) {
  // Classify all projects
  const classified = projects.map(p => ({
    ...p,
    classification: classifyProject(p),
  }));

  // Filter to continuable projects
  const continuable = classified.filter(p => 
    ['code_build', 'document_build', 'academic_deliverable'].includes(p.classification)
  );

  // Separate by type
  const codeBuilds = continuable.filter(p => p.classification === 'code_build');
  const documentBuilds = continuable.filter(p => p.classification === 'document_build');
  const academicDeliverables = continuable.filter(p => p.classification === 'academic_deliverable');

  // Priority order: code builds first, then document builds, then max 1 academic
  const prioritized = [
    ...codeBuilds,
    ...documentBuilds,
    ...academicDeliverables.slice(0, 1), // Cap at 1 academic deliverable
  ];

  return {
    prioritized,
    skipped: classified.filter(p => !prioritized.includes(p)),
    stats: {
      code_build: codeBuilds.length,
      document_build: documentBuilds.length,
      academic_deliverable: academicDeliverables.length,
      academic_study: classified.filter(p => p.classification === 'academic_study').length,
      quick_task: classified.filter(p => p.classification === 'quick_task').length,
      casual: classified.filter(p => p.classification === 'casual').length,
    },
  };
}

async function main() {
  if (SIMULATE) {
    // Simulate mode: fetch current handoff data and run immediately
    console.log('🧪 SIMULATE MODE: Running with current handoff data');
    console.log('');

    const userId = await resolveInternalUserId(process.env.TEST_USER_ID);

    // Fetch in-progress projects
    const projectsResponse = await fetch(`${API_BASE_URL}/api/internal/projects?userId=${userId}`);
    const projectsData = await projectsResponse.json();
    const projects = projectsData.data?.projects || [];
    const inProgressProjects = projects.filter(p => p.status === 'in_progress');

    if (inProgressProjects.length === 0) {
      console.error('❌ No in-progress projects found for simulation');
      process.exit(1);
    }

    // Classify and prioritize projects
    const { prioritized, skipped, stats } = prioritizeProjects(inProgressProjects);
    
    console.log('📊 Project Classification:');
    console.log(`   Code Builds: ${stats.code_build}`);
    console.log(`   Document Builds: ${stats.document_build}`);
    console.log(`   Academic Deliverables: ${stats.academic_deliverable} (max 1 will run)`);
    console.log(`   Academic Study: ${stats.academic_study} (skipped - reminders only)`);
    console.log(`   Quick Tasks: ${stats.quick_task} (skipped)`);
    console.log(`   Casual: ${stats.casual} (skipped)`);
    console.log('');
    console.log(`✅ Will continue: ${Math.min(prioritized.length, MAX_PROJECTS_PER_RUN)} projects`);
    console.log(`⏭️  Will skip: ${skipped.length} projects`);
    console.log('');

    const projectIds = prioritized.slice(0, MAX_PROJECTS_PER_RUN).map(p => p.id);
    
    console.log(`📋 Found ${projectIds.length} in-progress projects`);
    console.log('');

    const result = await runOvernightLoop({
      userId,
      projectIds,
      instructions: 'Simulation run - testing overnight loop with real data',
    }, {
      apiKey: ANTHROPIC_API_KEY,
      apiUrl: API_BASE_URL,
    });

    // Display the morning brief
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📄 MORNING BRIEF');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(result.brief);

    process.exit(0);
  }

  // Normal mode: require user ID and project IDs
  if (!USER_ID_ARG || !PROJECT_IDS_ARG) {
    console.error('❌ Missing required arguments');
    console.error('');
    console.error('Usage:');
    console.error('  node overnight-loop.mjs --user-id=USER_ID --project-ids=ID1,ID2');
    console.error('  node overnight-loop.mjs --simulate');
    process.exit(1);
  }

  const projectIds = PROJECT_IDS_ARG.split(',');

  const result = await runOvernightLoop({
    userId: USER_ID_ARG,
    projectIds,
    instructions: INSTRUCTIONS_ARG || '',
  }, {
    apiKey: ANTHROPIC_API_KEY,
    apiUrl: API_BASE_URL,
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📄 MORNING BRIEF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(result.brief);
}

// Run main if this is the entry point
if (process.argv[1]) {
  const scriptPath = process.argv[1].replace(/\\/g, '/');
  const expectedUrl = `file:///${scriptPath}`;
  
  if (import.meta.url === expectedUrl) {
    main().catch(err => {
      console.error('❌ Fatal error:', err);
      writeRunStatus('error');
      process.exit(1);
    });
  }
}
