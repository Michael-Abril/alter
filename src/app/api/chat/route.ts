/**
 * Chat API - Talk to Alter (your AI digital twin)
 * Uses Akash ML API (Llama 3.3 70B)
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const AKASH_ML_API_URL = 'https://api.akashml.com/v1';
const DEFAULT_MODEL = 'meta-llama/Llama-3.3-70B-Instruct';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  history?: ChatMessage[];
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const apiKey = process.env.AKASH_ML_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'AI service not configured' },
      { status: 503 }
    );
  }

  try {
    const body: ChatRequest = await request.json();
    const { message, history = [] } = body;

    if (!message?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // Build messages array with system prompt and history
    const messages = [
      {
        role: 'system',
        content: `You are Alter, an AI digital twin assistant. You help users with their work, answer questions, and assist with tasks in a helpful, conversational manner.

Key traits:
- You are knowledgeable and helpful
- You communicate clearly and concisely
- You're proactive about offering relevant suggestions
- You maintain context from the conversation history

The user is chatting with you through the Alter app. Help them with whatever they need.`,
      },
      // Include conversation history
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      // Add current message
      {
        role: 'user',
        content: message,
      },
    ];

    const res = await fetch(`${AKASH_ML_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages,
        max_tokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('[chat] Akash ML error:', error);
      return NextResponse.json(
        { success: false, error: 'AI service error' },
        { status: 502 }
      );
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      reply,
      usage: {
        input_tokens: data.usage?.prompt_tokens ?? 0,
        output_tokens: data.usage?.completion_tokens ?? 0,
      },
    });
  } catch (error) {
    console.error('[chat] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
