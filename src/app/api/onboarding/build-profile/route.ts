import { auth } from '@clerk/nextjs/server';
import { apiError, apiSuccess } from '@/lib/utils';
import { buildVoiceProfileForUser } from '@/lib/voice-profile-builder';

export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return apiError('Unauthorized', 401);

  try {
    const result = await buildVoiceProfileForUser({ clerkId, sampleLimit: 50 });
    return apiSuccess({
      status: 'complete',
      voiceProfileId: result.voiceProfileId,
      sampleCount: result.sampleCount,
      toneKeywords: result.profile.toneKeywords,
    });
  } catch (error: any) {
    console.error('[onboarding/build-profile] Error:', error);
    return apiError(`Failed to build voice profile: ${error.message}`, 500);
  }
}
