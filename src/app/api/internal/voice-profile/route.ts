import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/utils';
import db from '@/lib/db';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) return apiError('Missing userId', 400);

  try {
    const profile = await db.voiceProfile.findUnique({
      where: { userId },
      select: {
        avgSentenceLen: true,
        formalityScore: true,
        emojiFrequency: true,
        signOffStyle: true,
        toneKeywords: true,
        sampleOutputs: true,
        systemPrompt: true,
      },
    });
    return apiSuccess(profile || null);
  } catch (error: any) {
    return apiError(`Failed to load voice profile: ${error.message}`, 500);
  }
}
