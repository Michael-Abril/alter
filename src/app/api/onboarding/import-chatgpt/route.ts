/**
 * OWNER: Person 3 (Orchestration)
 * PURPOSE: POST: trigger ChatGPT scraper or handle file upload for onboarding
 * DEPENDENCIES: Prisma, @clerk/nextjs
 * STATUS: LIVE
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { apiSuccess, apiError } from '@/lib/utils';
import db from '@/lib/db';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return apiError('Unauthorized', 401);

  try {
    const contentType = req.headers.get('content-type') || '';

    // Check if this is a scraper trigger (no file upload)
    if (contentType.includes('application/json')) {
      console.log('[onboarding/import-chatgpt] Starting ChatGPT scraper...');

      // Run the ChatGPT scraper in the background
      execAsync(`node orchestration/scrape-chatgpt.mjs --user=${userId}`).catch(err => {
        console.error('[onboarding/import-chatgpt] Scraper error:', err);
      });

      return apiSuccess({
        message: 'ChatGPT import started',
        status: 'processing',
      });
    }

    // Otherwise, handle file upload (fallback option)
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return apiError('No file uploaded', 400);
    }

    // Read the file content
    const content = await file.text();
    const chatData = JSON.parse(content);

    // Find user
    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return apiError('User not found', 404);
    }

    // Process ChatGPT export format
    // ChatGPT exports are typically an array of conversations
    let messagesImported = 0;

    if (Array.isArray(chatData)) {
      for (const conversation of chatData) {
        if (conversation.mapping) {
          // ChatGPT export format with mapping
          for (const [nodeId, node] of Object.entries(conversation.mapping as Record<string, any>)) {
            const message = node.message;
            if (message && message.content && message.content.parts) {
              const content = message.content.parts.join('\n');
              const role = message.author?.role || 'unknown';
              
              if (content.trim()) {
                await db.chatMessage.create({
                  data: {
                    userId: user.id,
                    source: 'chatgpt',
                    role: role === 'user' ? 'user' : 'assistant',
                    content,
                    timestamp: message.create_time 
                      ? new Date(message.create_time * 1000) 
                      : new Date(),
                    embedded: false,
                  },
                });
                messagesImported++;
              }
            }
          }
        }
      }
    }

    console.log(`[onboarding/import-chatgpt] Imported ${messagesImported} messages from file`);

    return apiSuccess({
      messagesImported,
      status: 'complete',
    });
  } catch (error: any) {
    console.error('[onboarding/import-chatgpt] Error:', error);
    return apiError(`Failed to import ChatGPT data: ${error.message}`, 500);
  }
}
