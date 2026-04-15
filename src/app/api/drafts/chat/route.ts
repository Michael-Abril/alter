/**
 * Draft Chat API - Edit drafts with AI assistance
 * Uses Akash ML API (Llama 3.3 70B)
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { callOpenClaw, isOpenClawConfigured } from '@/lib/openclaw-client';

interface ChatRequest {
  draftId: string;
  draftContent: string;
  message: string;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  if (!isOpenClawConfigured()) {
    return NextResponse.json(
      { success: false, error: 'AI service not configured' },
      { status: 503 }
    );
  }

  try {
    const body: ChatRequest = await request.json();
    const { draftContent, message } = body;

    if (!draftContent || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing draftContent or message' },
        { status: 400 }
      );
    }

    const system = `You are an AI assistant helping a user edit a draft they wrote. Your job is to apply their requested changes while preserving their voice and intent.

The current draft is:
---
${draftContent}
---

Instructions:
1. Apply the user's requested changes
2. Keep the overall tone and style consistent
3. Return a brief acknowledgment of what you changed
4. Return the FULL updated draft (not just the changes)

IMPORTANT: You MUST respond with valid JSON in this exact format:
{
  "reply": "Brief description of what you changed (1-2 sentences)",
  "updatedContent": "The full updated draft content"
}

Do not include any text outside the JSON object.`;

    const response = await callOpenClaw({
      system,
      user: message,
      maxTokens: 2000,
    });

    // Try to parse as JSON
    try {
      // Clean the response - sometimes models add markdown code blocks
      let cleanedContent = response.content.trim();
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleanedContent);
      return NextResponse.json({
        success: true,
        reply: parsed.reply || 'Updated the draft.',
        updatedContent: parsed.updatedContent || null,
      });
    } catch {
      // If parsing fails, return the raw response as the reply
      return NextResponse.json({
        success: true,
        reply: response.content,
        updatedContent: null,
      });
    }
  } catch (error) {
    console.error('[drafts/chat] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
