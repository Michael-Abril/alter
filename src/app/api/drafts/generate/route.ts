/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: POST: generate a draft (email, doc, code) in the user's voice
 * DEPENDENCIES: Claude API, vectra, Prisma, @clerk/nextjs, persona, confidence
 * STATUS: LIVE — real vectra context retrieval + Claude generation + DB storage
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import { generateEmbedding } from '@/lib/embeddings';
import { queryVectors, getNamespaceStats } from '@/lib/pinecone';
import { buildSystemPrompt, buildContextPrompt } from '@/lib/persona';
import { assessConfidence } from '@/lib/confidence';
import type { VoiceProfile } from '@/types';

// POST: Generate a draft in the user's voice
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const body = await req.json();
    const { type, targetApp, projectId, instructions, title } = body;

    if (!type || !targetApp) {
      return apiError('Missing required fields: type, targetApp', 400);
    }

    // 1. Find user
    const user = await db.user.findUnique({ where: { clerkId: userId } });
    if (!user) return apiError('User not found', 404);

    console.log(`[drafts/generate] Generating ${type} draft for ${targetApp}, user: ${user.id}`);

    // 2. Fetch voice profile (or use defaults)
    const voiceProfile = await db.voiceProfile.findUnique({ where: { userId: user.id } });
    const systemPrompt = voiceProfile
      ? buildSystemPrompt({
          avgSentenceLen: voiceProfile.avgSentenceLen,
          formalityScore: voiceProfile.formalityScore,
          emojiFrequency: voiceProfile.emojiFrequency,
          signOffStyle: voiceProfile.signOffStyle,
          toneKeywords: voiceProfile.toneKeywords ? JSON.parse(voiceProfile.toneKeywords) as string[] : ['neutral'],
          systemPrompt: voiceProfile.systemPrompt,
          sampleOutputs: voiceProfile.sampleOutputs ? JSON.parse(voiceProfile.sampleOutputs) as string[] : null,
        } as VoiceProfile)
      : 'You are NightShift AI, writing on behalf of the user. Be clear, concise, and professional. Match any context clues about their writing style.';

    // 3. Retrieve relevant context from vectra
    const searchQuery = instructions || title || `${type} for ${targetApp}`;
    let retrievedContext: string[] = [];
    let contextRelevance = 0.5; // default mid-range

    const stats = await getNamespaceStats(user.id);
    if (stats.vectorCount > 0) {
      const queryVector = await generateEmbedding(searchQuery);
      const results = await queryVectors(user.id, queryVector, 5);
      retrievedContext = results
        .filter((r) => r.score > 0.3)
        .map((r) => r.content);
      contextRelevance = results.length > 0
        ? results.reduce((sum, r) => sum + r.score, 0) / results.length
        : 0.3;
      console.log(`[drafts/generate] Retrieved ${retrievedContext.length} context chunks (avg relevance: ${contextRelevance.toFixed(2)})`);
    }

    // 4. Fetch project context if projectId provided
    let projectContext = '';
    if (projectId) {
      const project = await db.project.findUnique({ where: { id: projectId } });
      if (project) {
        const ctx = project.context ? JSON.parse(project.context) : {};
        projectContext = `\nProject: ${project.name}\nDescription: ${project.description || 'N/A'}\nProgress: ${project.progress}%\nNext Step: ${ctx.nextStep || 'Continue work'}`;
      }
    }

    // 5. Build prompt using persona lib
    const taskDescription = [
      instructions || `Generate a ${type} draft`,
      projectContext,
    ].filter(Boolean).join('\n');

    const prompt = buildContextPrompt({
      systemPrompt,
      retrievedContext,
      taskDescription,
      type: type as 'email' | 'doc' | 'code' | 'task',
    });

    // 6. Call Claude API
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    });

    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n\n');

    // 7. Score confidence
    const assessment = assessConfidence({
      baseScore: 0.8,
      actionType: type === 'email' ? 'email_sent' : 'doc_edited',
      contextRelevance,
      voiceMatchScore: voiceProfile ? 0.75 : 0.5,
      autonomyLevel: user.autonomyLevel,
    });

    // 8. Store draft in DB
    const draftTitle = title || (type === 'email' ? content.split('\n')[0].slice(0, 100) : `${type} draft`);
    const draft = await db.draft.create({
      data: {
        userId: user.id,
        type,
        title: draftTitle,
        content,
        targetApp,
        confidenceScore: assessment.score,
        status: 'pending',
        context: JSON.stringify({
          projectId: projectId || null,
          retrievedSources: retrievedContext.length,
          contextRelevance,
          voiceProfileUsed: !!voiceProfile,
          recommendation: assessment.recommendation,
          reasons: assessment.reasons,
          tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        }),
      },
    });

    console.log(`[drafts/generate] Draft created: ${draft.id} (confidence: ${assessment.score}, recommendation: ${assessment.recommendation})`);

    return apiSuccess({
      id: draft.id,
      type: draft.type,
      title: draft.title,
      content: draft.content,
      targetApp: draft.targetApp,
      confidenceScore: draft.confidenceScore,
      status: draft.status,
      context: JSON.parse(draft.context || '{}'),
      recommendation: assessment.recommendation,
      confidenceLevel: assessment.level,
      reasons: assessment.reasons,
      createdAt: draft.createdAt.toISOString(),
      updatedAt: draft.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('[drafts/generate] Error:', error);
    return apiError('Failed to generate draft', 500);
  }
}
