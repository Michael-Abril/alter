import 'dotenv/config';
import { buildVoiceProfileForUser } from '@/lib/voice-profile-builder';

function getArg(name: string): string | undefined {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  return raw ? raw.split('=')[1] : undefined;
}

async function main() {
  const clerkId = getArg('clerk-id');
  const userId = getArg('user-id');
  const limit = parseInt(getArg('limit') || '50', 10);

  if (!clerkId && !userId) {
    throw new Error('Provide --clerk-id=<id> or --user-id=<id>');
  }

  const result = await buildVoiceProfileForUser({
    clerkId,
    userId,
    sampleLimit: limit,
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Voice profile built');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`User ID: ${result.userId}`);
  console.log(`Samples analyzed: ${result.sampleCount}`);
  console.log(`Avg sentence len: ${result.profile.avgSentenceLen}`);
  console.log(`Formality: ${result.profile.formalityLevel}`);
  console.log(`Uses emojis: ${result.profile.usesEmojis}`);
  console.log(`Greetings: ${result.profile.greetingPhrases.join(', ') || '(none)'}`);
  console.log(`Sign-offs: ${result.profile.signOffPhrases.join(', ') || '(none)'}`);
  console.log(`Tone keywords: ${result.profile.toneKeywords.join(', ')}`);
  console.log('Example sentences:');
  result.profile.exampleSentences.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s}`);
  });
}

main().catch((err) => {
  console.error('Failed to build voice profile:', err.message || err);
  process.exit(1);
});
