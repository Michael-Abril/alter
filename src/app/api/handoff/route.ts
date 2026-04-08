/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: GET: unfinished tasks, POST: submit handoff selections
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: Scaffold — returns mock data, needs real implementation
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';

// GET: Return unfinished tasks detected for the user
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  const user = await db.user.findUnique({ where: { clerkId } });
  if (!user) return apiSuccess([]);

  const projects = await db.project.findMany({
    where: { userId: user.id, status: 'in_progress' },
    orderBy: { lastActive: 'desc' },
  });

  const tasks = projects.map((p) => {
    const ctx = p.context ? JSON.parse(p.context) : {};
    return {
      id: p.id,
      projectId: p.id,
      title: p.name,
      description: ctx.nextStep || p.description || `${p.progress}% complete — continue this work`,
      app: 'claude',
      estimatedConfidence: p.progress / 100,
      selected: false,
    };
  });

  return apiSuccess(tasks);
}

// POST: Submit handoff selections — activate NightShift for tonight
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { projectIds, instructions } = body;

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return apiError('No projects selected for handoff', 400);
    }

    // Find user (with auto-link fallback for dev)
    let user = await db.user.findUnique({ where: { clerkId } });
    if (!user) {
      const testUser = await db.user.findUnique({ where: { clerkId: 'user_test_123' } });
      if (testUser) {
        user = await db.user.update({
          where: { id: testUser.id },
          data: { clerkId },
        });
        console.log(`[handoff] Auto-linked Clerk user ${clerkId} to internal user ${user.id}`);
      } else {
        return apiError('User not found', 404);
      }
    }

    console.log(`[handoff] Triggering overnight loop for user ${user.id} with ${projectIds.length} projects`);

    const { spawn } = await import('child_process');
    const pathMod = await import('path');
    const fsMod = await import('fs');
    const scriptPath = pathMod.join(process.cwd(), 'orchestration', 'overnight-loop.mjs');

    const runStatusPath = pathMod.join(process.cwd(), 'data', `handoff-run-${user.id}.json`);
    const statusDir = pathMod.dirname(runStatusPath);
    if (!fsMod.existsSync(statusDir)) fsMod.mkdirSync(statusDir, { recursive: true });

    fsMod.writeFileSync(runStatusPath, JSON.stringify({
      state: 'running',
      projectIds,
      startedAt: new Date().toISOString(),
      projectsQueued: projectIds.length,
    }, null, 2));

    const loopArgs = [
      scriptPath,
      `--user-id=${user.id}`,
      `--project-ids=${projectIds.join(',')}`,
      '--skip-confirmation',
    ];

    if (instructions) {
      loopArgs.push(`--instructions=${instructions}`);
    }

    const child = spawn('node', loopArgs, {
      detached: true,
      stdio: 'ignore',
      cwd: process.cwd(),
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
        NIGHTSHIFT_RUN_STATUS_PATH: runStatusPath,
      },
    });

    child.unref();

    console.log(`[handoff] Overnight loop started (PID: ${child.pid})`);

    return apiSuccess({
      success: true,
      message: 'NightShift overnight loop activated',
      projectsQueued: projectIds.length,
      processId: child.pid,
      estimatedCompletion: 'Check morning brief for results',
    });
  } catch (error) {
    console.error('[handoff] Fatal error:', error);
    return apiError('Failed to activate NightShift', 500);
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

async function queryVectorContext(project: any, context: any) {
  // Try to use sample messages from project context
  if (context?.sampleMessages?.length > 0) {
    return context.sampleMessages.map((msg: string, i: number) => ({
      id: `context-${i}`,
      score: 0.8,
      content: msg,
      metadata: { source: 'project_context' },
    }));
  }
  return [];
}

function buildPrompt(project: any, context: any, contextResults: any[], instructions?: string) {
  const system = [
    'You are NightShift AI, an autonomous work continuation agent.',
    'Your job is to pick up where the user left off and continue their work.',
    'Be thorough and complete — produce real, usable output.',
    instructions ? `Special instructions: ${instructions}` : '',
  ].filter(Boolean).join('\n');

  const contextSection = contextResults.length > 0
    ? contextResults.map((r, i) => `### Context ${i + 1}\n${r.content}`).join('\n\n')
    : '(No additional context available)';

  const user = [
    `# Project: ${project.name}`,
    `**Description:** ${project.description || 'Not provided'}`,
    `**Progress:** ${project.progress}%`,
    `**Next Step:** ${context?.nextStep || 'Continue based on context'}`,
    '',
    '## Context',
    contextSection,
    '',
    '**Your task:** Continue this work. Produce the next meaningful chunk of progress.',
  ].join('\n');

  return { system, user };
}

async function generateContinuation(prompt: { system: string; user: string }) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    system: prompt.system,
    messages: [{ role: 'user', content: prompt.user }],
  });

  const content = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n\n');

  return {
    content,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    length: content.length,
  };
}

async function saveContinuationFile(project: any, continuation: any) {
  const continuationsDir = path.join(process.cwd(), 'data', 'continuations');
  
  if (!fs.existsSync(continuationsDir)) {
    fs.mkdirSync(continuationsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const safeName = project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  const filename = `${safeName}-${timestamp}.md`;
  const filepath = path.join(continuationsDir, filename);

  const output = [
    '# NightShift Work Continuation',
    '',
    `**Project:** ${project.name}`,
    `**Generated:** ${new Date().toISOString()}`,
    `**Progress Before:** ${project.progress}%`,
    '',
    '---',
    '',
    continuation.content,
  ].join('\n');

  fs.writeFileSync(filepath, output, 'utf-8');
  return filepath;
}
