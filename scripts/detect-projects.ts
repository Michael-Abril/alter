/**
 * OWNER: Person 2 (Vectors) + Person 3 (Royce/OpenClaw)
 * PURPOSE: Run project detector against all embedded messages, save to Project table
 * 
 * Usage:
 *   npx tsx scripts/detect-projects.ts
 *   npx tsx scripts/detect-projects.ts --reset   # Clear existing projects first
 *   npx tsx scripts/detect-projects.ts --dry-run  # Print results without saving
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// ─── Inline project detector (avoid path alias issues in standalone scripts) ─

// Types
interface DetectedProject {
  name: string;
  description: string;
  status: 'in_progress' | 'completed' | 'stalled';
  progress: number;
  nextStep: string;
  lastActive: Date;
  sessionId: string;
  messageCount: number;
  context: {
    keyTopics: string[];
    sampleMessages: string[];
    firstMessageAt: string;
    lastMessageAt: string;
  };
}

interface ConversationGroup {
  sessionId: string;
  messages: {
    role: string;
    content: string;
    timestamp: Date;
  }[];
}

// ─── Config ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const DRY_RUN = args.includes('--dry-run');

function log(msg: string) {
  console.log(`[detect] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

function hasAnthropicKey(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-'));
}

// ─── Claude API Analysis ─────────────────────────────────────────────────────

async function analyzeWithClaude(conv: ConversationGroup): Promise<DetectedProject | null> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const timestamps = conv.messages.map(m => m.timestamp);
  const firstMsg = new Date(Math.min(...timestamps.map(t => t.getTime())));
  const lastMsg = new Date(Math.max(...timestamps.map(t => t.getTime())));
  const userMessages = conv.messages.filter(m => m.role === 'user');

  // Build transcript (truncate to ~6000 chars for token limits)
  const transcript = conv.messages
    .map(m => `[${m.role}]: ${m.content.slice(0, 400)}`)
    .join('\n')
    .slice(0, 6000);

  const prompt = `Analyze this conversation and extract project information. Respond ONLY with valid JSON, no markdown fences, no explanation.

Conversation title: "${conv.sessionId}"
Message count: ${conv.messages.length}
Time span: ${firstMsg.toISOString()} to ${lastMsg.toISOString()}

Transcript:
${transcript}

Respond with this exact JSON structure:
{
  "name": "short project name (3-6 words max)",
  "description": "one sentence describing what's being built or discussed",
  "status": "in_progress" or "completed" or "stalled",
  "progress": <number 0-100 estimating how complete the work is>,
  "nextStep": "one specific actionable sentence describing what should happen next",
  "keyTopics": ["topic1", "topic2", "topic3"]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    // Strip markdown fences if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      name: parsed.name || conv.sessionId,
      description: parsed.description || '',
      status: parsed.status || 'in_progress',
      progress: Math.min(100, Math.max(0, parsed.progress || 50)),
      nextStep: parsed.nextStep || '',
      lastActive: lastMsg,
      sessionId: conv.sessionId,
      messageCount: conv.messages.length,
      context: {
        keyTopics: parsed.keyTopics || [],
        sampleMessages: userMessages.slice(0, 3).map(m => m.content.slice(0, 200)),
        firstMessageAt: firstMsg.toISOString(),
        lastMessageAt: lastMsg.toISOString(),
      },
    };
  } catch (err) {
    log(`  ⚠️  Claude API failed for "${conv.sessionId}": ${err}`);
    log(`  Falling back to keyword analysis...`);
    return analyzeConversation(conv);
  }
}

// ─── Stop words & signals ────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall',
  'this', 'that', 'these', 'those', 'it', 'its', 'i', 'me', 'my', 'we', 'us', 'our',
  'you', 'your', 'he', 'she', 'they', 'them', 'their', 'what', 'which', 'who', 'whom',
  'so', 'if', 'then', 'than', 'not', 'no', 'yes', 'just', 'also', 'very', 'too', 'here',
  'there', 'when', 'where', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
  'some', 'any', 'such', 'only', 'same', 'other', 'new', 'like', 'about', 'up', 'out',
  'get', 'got', 'make', 'made', 'know', 'think', 'want', 'need', 'use', 'try', 'let',
  'say', 'said', 'tell', 'give', 'take', 'come', 'go', 'see', 'look', 'way', 'thing',
  'well', 'back', 'much', 'good', 'still', 'right', 'now', 'even', 'going', 'don',
  'really', 'sure', 'something', 'okay', 'thanks', 'thank', 'please', 'yeah', 'ok',
]);

const COMPLETION_SIGNALS = [
  'done', 'finished', 'completed', 'shipped', 'deployed', 'launched', 'merged',
  'looks good', 'perfect', 'works great', 'all set', 'ready to go', 'final version',
  'pushed to', 'commit', 'live now',
];

const IN_PROGRESS_SIGNALS = [
  'working on', 'building', 'implementing', 'creating', 'coding', 'developing',
  'fixing', 'debugging', 'updating', 'adding', 'next step', 'todo', 'need to',
  'figure out', 'trying to', 'how do i', 'how to', 'help me', 'can you',
];

const STALLED_SIGNALS = [
  'stuck', 'blocked', 'error', 'failed', 'broken', 'not working', 'issue',
  'problem', 'bug', 'crash',
];

// ─── Analysis functions ──────────────────────────────────────────────────────

function countSignals(text: string, signals: string[]): number {
  let count = 0;
  for (const signal of signals) {
    const regex = new RegExp(signal, 'gi');
    const matches = text.match(regex);
    if (matches) count += matches.length;
  }
  return count;
}

function extractKeyTopics(text: string): string[] {
  const words = text.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const tf = new Map<string, number>();

  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    tf.set(word, (tf.get(word) || 0) + 1);
  }

  for (let i = 0; i < words.length - 1; i++) {
    if (STOP_WORDS.has(words[i]) || STOP_WORDS.has(words[i + 1])) continue;
    const bigram = `${words[i]} ${words[i + 1]}`;
    tf.set(bigram, (tf.get(bigram) || 0) + 1);
  }

  return [...tf.entries()]
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

function analyzeConversation(conv: ConversationGroup): DetectedProject | null {
  const allText = conv.messages.map(m => m.content).join(' ').toLowerCase();
  const userMessages = conv.messages.filter(m => m.role === 'user');
  const timestamps = conv.messages.map(m => m.timestamp);
  const firstMsg = new Date(Math.min(...timestamps.map(t => t.getTime())));
  const lastMsg = new Date(Math.max(...timestamps.map(t => t.getTime())));
  const ageHours = (Date.now() - lastMsg.getTime()) / (1000 * 60 * 60);

  const keyTopics = extractKeyTopics(allText);

  // ── Project name: use conversation title ──
  const name = conv.sessionId.replace(/[^\w\s:/-]/g, '').trim().slice(0, 80);

  // ── Description from first user message ──
  let description = '';
  const firstUserMsg = conv.messages.find(m => m.role === 'user');
  if (firstUserMsg) {
    const snippet = firstUserMsg.content.slice(0, 150).replace(/\n/g, ' ').trim();
    description = snippet.length > 20
      ? snippet + (firstUserMsg.content.length > 150 ? '...' : '')
      : `Project involving ${keyTopics.slice(0, 3).join(', ')}`;
  } else {
    description = `Conversation with ${conv.messages.length} messages`;
  }

  // ── Status ──
  const recentText = conv.messages.slice(-5).map(m => m.content).join(' ').toLowerCase();
  const completionScore = countSignals(recentText, COMPLETION_SIGNALS);
  const progressScore = countSignals(recentText, IN_PROGRESS_SIGNALS);
  const stalledScore = countSignals(recentText, STALLED_SIGNALS);

  let status: 'in_progress' | 'completed' | 'stalled' = 'in_progress';
  if (completionScore > progressScore && completionScore > stalledScore) {
    status = 'completed';
  } else if (ageHours > 48) {
    status = 'stalled';
  } else if (stalledScore > progressScore && ageHours > 24) {
    status = 'stalled';
  }

  // ── Progress ──
  let progress = Math.min(80, Math.floor(conv.messages.length * 3));
  progress += completionScore * 5;
  const recentProgressSignals = countSignals(
    conv.messages.slice(-3).map(m => m.content).join(' ').toLowerCase(),
    IN_PROGRESS_SIGNALS
  );
  if (recentProgressSignals > 2) progress -= 10;
  if (status === 'completed') progress = 95;
  if (status === 'stalled') progress = Math.min(progress, 60);
  progress = Math.min(90, Math.max(10, progress));
  if (status === 'completed') progress = 95;

  // ── Next step ──
  let nextStep = '';
  const lastUserMsg = [...conv.messages].reverse().find(m => m.role === 'user');
  const lastAssistantMsg = [...conv.messages].reverse().find(m => m.role === 'assistant');

  if (status === 'completed') {
    nextStep = 'Project appears complete. Review for any follow-up tasks.';
  } else if (status === 'stalled') {
    if (lastUserMsg) {
      const snippet = lastUserMsg.content.slice(0, 100).replace(/\n/g, ' ').trim();
      nextStep = `Stalled — last request was: "${snippet}". Resume this conversation.`;
    } else {
      nextStep = 'Stalled — revisit and determine if this project is still active.';
    }
  } else if (lastAssistantMsg) {
    const actionPatterns = [
      /next[,:]?\s+(.{20,80})/i,
      /you should\s+(.{20,80})/i,
      /you can\s+(.{20,80})/i,
      /try\s+(.{20,80})/i,
      /run\s+(.{20,80})/i,
    ];
    for (const pattern of actionPatterns) {
      const match = lastAssistantMsg.content.match(pattern);
      if (match) {
        nextStep = match[1].replace(/\n/g, ' ').trim().slice(0, 150);
        break;
      }
    }
    if (!nextStep && lastUserMsg) {
      const snippet = lastUserMsg.content.slice(0, 100).replace(/\n/g, ' ').trim();
      nextStep = `Continue from last message: "${snippet}"`;
    }
  }

  if (!nextStep) {
    nextStep = `Continue work on ${keyTopics.slice(0, 2).join(' and ') || 'this project'}`;
  }

  return {
    name,
    description,
    status,
    progress,
    nextStep,
    lastActive: lastMsg,
    sessionId: conv.sessionId,
    messageCount: conv.messages.length,
    context: {
      keyTopics: keyTopics.slice(0, 5),
      sampleMessages: userMessages.slice(0, 3).map(m => m.content.slice(0, 200)),
      firstMessageAt: firstMsg.toISOString(),
      lastMessageAt: lastMsg.toISOString(),
    },
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const db = new PrismaClient();

  log('═══════════════════════════════════════════════════');
  log('  NightShift AI — Project State Detector');
  log('═══════════════════════════════════════════════════');
  const backend = hasAnthropicKey() ? 'claude-api' : 'local-keyword';
  log(`Backend: ${backend}`);
  log(`Reset: ${RESET} | Dry run: ${DRY_RUN}`);

  try {
    // Get all users with embedded messages
    const users = await db.chatMessage.groupBy({
      by: ['userId'],
      where: { embedded: true },
      _count: { id: true },
    });

    if (users.length === 0) {
      log('No embedded messages found. Run embed script first.');
      await db.$disconnect();
      return;
    }

    let totalProjects = 0;

    for (const userGroup of users) {
      const userId = userGroup.userId;
      log(`\nProcessing user: ${userId} (${userGroup._count.id} embedded messages)`);

      // Reset existing projects for this user if requested
      if (RESET && !DRY_RUN) {
        const deleted = await db.project.deleteMany({ where: { userId } });
        log(`  Cleared ${deleted.count} existing projects`);
      }

      // Fetch all embedded messages grouped by sessionId
      const messages = await db.chatMessage.findMany({
        where: { userId, embedded: true },
        orderBy: { timestamp: 'asc' },
      });

      // Group by sessionId
      const groups = new Map<string, ConversationGroup>();
      for (const msg of messages) {
        const sid = msg.sessionId || 'unknown';
        if (!groups.has(sid)) {
          groups.set(sid, { sessionId: sid, messages: [] });
        }
        groups.get(sid)!.messages.push({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        });
      }

      log(`  Found ${groups.size} conversations`);

      // Analyze each conversation
      const projects: DetectedProject[] = [];
      for (const [sid, conv] of groups) {
        if (conv.messages.length < 2) {
          log(`  Skipping "${sid}" (only ${conv.messages.length} message)`);
          continue;
        }

        const result = backend === 'claude-api'
          ? await analyzeWithClaude(conv)
          : analyzeConversation(conv);
        if (result) {
          projects.push(result);
        }
      }

      log(`  Detected ${projects.length} projects:`);
      console.log('');

      for (const proj of projects) {
        const statusEmoji = proj.status === 'completed' ? '✅' :
                           proj.status === 'stalled' ? '⏸️' : '🔧';
        log(`  ${statusEmoji} ${proj.name}`);
        log(`     Status: ${proj.status} | Progress: ${proj.progress}% | Messages: ${proj.messageCount}`);
        log(`     Description: ${proj.description.slice(0, 100)}`);
        log(`     Next step: ${proj.nextStep.slice(0, 100)}`);
        log(`     Topics: ${proj.context.keyTopics.join(', ')}`);
        log(`     Last active: ${proj.lastActive.toISOString()}`);
        console.log('');
      }

      // Save to database
      if (!DRY_RUN) {
        for (const proj of projects) {
          await db.project.upsert({
            where: {
              // Use a composite lookup — find existing project by user + name
              id: await findExistingProjectId(db, userId, proj.sessionId) || 'new',
            },
            update: {
              name: proj.name,
              description: proj.description,
              status: proj.status,
              progress: proj.progress,
              lastActive: proj.lastActive,
              context: JSON.stringify({
                ...proj.context,
                nextStep: proj.nextStep,
                sessionId: proj.sessionId,
                messageCount: proj.messageCount,
                detectedAt: new Date().toISOString(),
              }),
            },
            create: {
              userId,
              name: proj.name,
              description: proj.description,
              status: proj.status,
              progress: proj.progress,
              lastActive: proj.lastActive,
              context: JSON.stringify({
                ...proj.context,
                nextStep: proj.nextStep,
                sessionId: proj.sessionId,
                messageCount: proj.messageCount,
                detectedAt: new Date().toISOString(),
              }),
            },
          });
        }
        log(`  Saved ${projects.length} projects to database`);
      } else {
        log(`  [DRY RUN] Would save ${projects.length} projects`);
      }

      totalProjects += projects.length;
    }

    log('\n═══════════════════════════════════════════════════');
    log(`Done! Detected ${totalProjects} projects total`);
    log('═══════════════════════════════════════════════════');

  } catch (error) {
    console.error('[detect] Fatal error:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

async function findExistingProjectId(
  db: PrismaClient,
  userId: string,
  sessionId: string
): Promise<string | null> {
  // Find a project whose context JSON contains this sessionId
  const existing = await db.project.findFirst({
    where: {
      userId,
      context: { contains: sessionId },
    },
    select: { id: true },
  });
  return existing?.id || null;
}

main();
