/**
 * Voice Profile Loader for Orchestration Scripts
 *
 * Fetches a user's voice profile from the API and provides helpers
 * to inject the profile into AI system prompts.
 *
 * Usage:
 *   import { loadVoiceProfile, injectVoiceProfile } from './lib/voice-profile.mjs';
 *
 *   const profile = await loadVoiceProfile(userId, apiUrl);
 *   const systemPrompt = injectVoiceProfile('You are an assistant.', profile);
 */

const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Load a user's voice profile from the API.
 *
 * @param {string} userId - The user's internal ID
 * @param {string} [apiUrl] - API base URL
 * @returns {Promise<Object|null>} - Voice profile or null if not found
 */
export async function loadVoiceProfile(userId, apiUrl = DEFAULT_API_URL) {
  try {
    const res = await fetch(
      `${apiUrl}/api/internal/voice-profile?userId=${encodeURIComponent(userId)}`
    );

    if (!res.ok) {
      console.log(`[voice-profile] No profile found for user ${userId.substring(0, 8)}...`);
      return null;
    }

    const data = await res.json();
    if (!data.success || !data.data) {
      return null;
    }

    const profile = data.data;
    console.log(`[voice-profile] Loaded profile for user ${userId.substring(0, 8)}...`);
    console.log(`   Formality: ${profile.formalityScore?.toFixed(2) || 'unknown'}`);
    console.log(`   Avg sentence length: ${profile.avgSentenceLen?.toFixed(0) || 'unknown'} words`);

    return profile;
  } catch (e) {
    console.warn(`[voice-profile] Failed to load: ${e.message}`);
    return null;
  }
}

/**
 * Inject a voice profile's system prompt into a base system prompt.
 *
 * @param {string} basePrompt - The base system prompt
 * @param {Object|null} voiceProfile - The user's voice profile
 * @returns {string} - Combined system prompt
 */
export function injectVoiceProfile(basePrompt, voiceProfile) {
  if (!voiceProfile?.systemPrompt) {
    return basePrompt;
  }

  // Voice profile first, then task-specific instructions
  return `${voiceProfile.systemPrompt}\n\n${basePrompt}`;
}

/**
 * Build a complete system prompt with voice profile for Alter.
 *
 * @param {Object} options
 * @param {string} options.task - Task description (e.g., 'continue this project')
 * @param {string} options.taskType - Task type (e.g., 'project_continuation', 'email_draft')
 * @param {Object|null} options.voiceProfile - User's voice profile
 * @returns {string} - Complete system prompt
 */
export function buildAlterSystemPrompt({ task, taskType, voiceProfile }) {
  const base = [
    'You are Alter, the user\'s AI digital twin.',
    'You work autonomously on behalf of the user, matching their voice, style, and preferences exactly.',
    '',
    `Task type: ${taskType}`,
    `Task: ${task}`,
    '',
    'Guidelines:',
    '- Match the user\'s communication style precisely',
    '- Be thorough but concise',
    '- Complete the work as if you were the user',
    '- Do not explain what you\'re doing — just do it',
  ].join('\n');

  return injectVoiceProfile(base, voiceProfile);
}

/**
 * Get voice profile stats for logging/display.
 *
 * @param {Object|null} voiceProfile
 * @returns {Object} - Stats object
 */
export function getVoiceProfileStats(voiceProfile) {
  if (!voiceProfile) {
    return {
      hasProfile: false,
      formality: null,
      avgSentenceLen: null,
      toneKeywords: [],
    };
  }

  let toneKeywords = [];
  try {
    if (voiceProfile.toneKeywords) {
      toneKeywords = typeof voiceProfile.toneKeywords === 'string'
        ? JSON.parse(voiceProfile.toneKeywords)
        : voiceProfile.toneKeywords;
    }
  } catch {
    toneKeywords = [];
  }

  return {
    hasProfile: true,
    formality: voiceProfile.formalityScore,
    avgSentenceLen: voiceProfile.avgSentenceLen,
    toneKeywords,
    hasSystemPrompt: !!voiceProfile.systemPrompt,
  };
}
