/**
 * OWNER: Person 2 (Vectors) + Person 3 (Royce/OpenClaw)
 * PURPOSE: Smart project detector with incremental detection, merge logic, and cross-source analysis
 * 
 * Features:
 * - Incremental: Only analyzes new un-analyzed messages
 * - Merge: Updates existing projects instead of creating duplicates
 * - Cross-source: Analyzes both chat messages AND emails
 * 
 * Usage:
 *   npx tsx scripts/detect-projects.ts
 *   npx tsx scripts/detect-projects.ts --reset   # Clear existing projects first
 *   npx tsx scripts/detect-projects.ts --dry-run  # Print results without saving
 *   npx tsx scripts/detect-projects.ts --force    # Re-analyze all messages
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
const FORCE = args.includes('--force');

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
  "keyTopics": ["topic1", "topic2", "topic3"],
  "classification": "code_build" or "document_build" or "academic_deliverable" or "other"
}

Classification guide:
- "code_build": Building software, apps, websites, scripts, or any programming project
- "document_build": Writing documents, reports, presentations, pitch decks, or content
- "academic_deliverable": Homework, assignments, papers, thesis, or academic work
- "other": Everything else (planning, research, casual discussions)`;

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
      classification: parsed.classification || 'other',
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
  log('  NightShift AI — Smart Project Detector');
  log('═══════════════════════════════════════════════════');
  const backend = hasAnthropicKey() ? 'claude-api' : 'local-keyword';
  log(`Backend: ${backend}`);
  log(`Mode: ${FORCE ? 'FORCE (re-analyze all)' : 'INCREMENTAL (new only)'}`);
  log(`Reset: ${RESET} | Dry run: ${DRY_RUN}`);

  try {
    // Get all users with embedded messages or emails
    const chatUsers = await db.chatMessage.groupBy({
      by: ['userId'],
      where: { embedded: true },
      _count: { id: true },
    });
    
    const emailUsers = await db.email.groupBy({
      by: ['userId'],
      where: { embedded: true },
      _count: { id: true },
    });

    // Merge user lists
    const userIds = new Set([...chatUsers.map(u => u.userId), ...emailUsers.map(u => u.userId)]);

    if (userIds.size === 0) {
      log('No embedded messages or emails found. Run embed scripts first.');
      await db.$disconnect();
      return;
    }

    let totalProjects = 0;
    let totalUpdated = 0;
    let totalCreated = 0;

    for (const userId of userIds) {
      const chatCount = chatUsers.find(u => u.userId === userId)?._count.id || 0;
      const emailCount = emailUsers.find(u => u.userId === userId)?._count.id || 0;
      log(`\nProcessing user: ${userId}`);
      log(`  Chat messages: ${chatCount} | Emails: ${emailCount}`);

      // Reset existing projects for this user if requested
      if (RESET && !DRY_RUN) {
        const deleted = await db.project.deleteMany({ where: { userId } });
        log(`  Cleared ${deleted.count} existing projects`);
      }

      // Get last analysis timestamp for incremental detection
      const lastAnalysis = FORCE ? null : await getLastAnalysisTime(db, userId);
      if (lastAnalysis && !FORCE) {
        log(`  Incremental mode: analyzing messages since ${lastAnalysis.toISOString()}`);
      }

      // Fetch chat messages (incremental or all)
      const messageWhere = FORCE
        ? { userId, embedded: true }
        : lastAnalysis
        ? { userId, embedded: true, timestamp: { gt: lastAnalysis } }
        : { userId, embedded: true };
      
      const messages = await db.chatMessage.findMany({
        where: messageWhere,
        orderBy: { timestamp: 'asc' },
      });
      
      // Fetch emails (incremental or all)
      const emailWhere = FORCE
        ? { userId, embedded: true }
        : lastAnalysis
        ? { userId, embedded: true, receivedAt: { gt: lastAnalysis } }
        : { userId, embedded: true };
      
      const emails = await db.email.findMany({
        where: emailWhere,
        orderBy: { receivedAt: 'asc' },
      });

      if (messages.length === 0 && emails.length === 0) {
        log(`  No new messages or emails to analyze`);
        continue;
      }

      log(`  Analyzing ${messages.length} new chat messages and ${emails.length} new emails`);

      // Group chat messages by sessionId
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

      // Extract project signals from emails
      const emailProjects = extractProjectsFromEmails(emails);
      log(`  Found ${groups.size} chat conversations and ${emailProjects.length} email-based projects`);

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
      
      // Add email-based projects
      projects.push(...emailProjects);

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

      // Save to database with smart merge logic
      if (!DRY_RUN) {
        for (const proj of projects) {
          // Try to find existing project by sessionId or name similarity
          const existingId = await findOrMergeProject(db, userId, proj);
          
          if (existingId) {
            // Update existing project
            await db.project.update({
              where: { id: existingId },
              data: {
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
                  classification: proj.classification || 'other',
                  detectedAt: new Date().toISOString(),
                  lastAnalyzed: new Date().toISOString(),
                }),
              },
            });
            totalUpdated++;
            log(`  ↻ Updated: ${proj.name}`);
          } else {
            // Create new project
            await db.project.create({
              data: {
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
                  classification: proj.classification || 'other',
                  detectedAt: new Date().toISOString(),
                  lastAnalyzed: new Date().toISOString(),
                }),
              },
            });
            totalCreated++;
            log(`  ✨ Created: ${proj.name}`);
          }
        }
        log(`  Processed ${projects.length} projects (${totalCreated} created, ${totalUpdated} updated)`);
      } else {
        log(`  [DRY RUN] Would process ${projects.length} projects`);
      }

      totalProjects += projects.length;
    }

    log('\n═══════════════════════════════════════════════════');
    log(`Done! Processed ${totalProjects} projects total`);
    log(`  Created: ${totalCreated} | Updated: ${totalUpdated}`);
    log('═══════════════════════════════════════════════════');

  } catch (error) {
    console.error('[detect] Fatal error:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

async function getLastAnalysisTime(db: PrismaClient, userId: string): Promise<Date | null> {
  const lastProject = await db.project.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true, context: true },
  });
  
  if (!lastProject) return null;
  
  try {
    const context = JSON.parse(lastProject.context || '{}');
    return context.lastAnalyzed ? new Date(context.lastAnalyzed) : lastProject.updatedAt;
  } catch {
    return lastProject.updatedAt;
  }
}

function calculateNameSimilarity(name1: string, name2: string): number {
  const n1 = name1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const n2 = name2.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (n1 === n2) return 1.0;
  if (n1.includes(n2) || n2.includes(n1)) return 0.8;
  
  // Calculate Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= n1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= n2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= n1.length; i++) {
    for (let j = 1; j <= n2.length; j++) {
      const cost = n1[i - 1] === n2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const distance = matrix[n1.length][n2.length];
  const maxLen = Math.max(n1.length, n2.length);
  return 1 - (distance / maxLen);
}

async function findOrMergeProject(
  db: PrismaClient,
  userId: string,
  project: DetectedProject
): Promise<string | null> {
  // First, try to find by sessionId
  const bySession = await db.project.findFirst({
    where: {
      userId,
      context: { contains: project.sessionId },
    },
    select: { id: true, name: true },
  });
  
  if (bySession) {
    return bySession.id;
  }
  
  // Second, try to find by name similarity (>75% match)
  const allProjects = await db.project.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  
  for (const existing of allProjects) {
    const similarity = calculateNameSimilarity(existing.name, project.name);
    if (similarity >= 0.75) {
      log(`  🔗 Merging "${project.name}" with existing "${existing.name}" (${(similarity * 100).toFixed(0)}% match)`);
      return existing.id;
    }
  }
  
  return null;
}

function extractProjectsFromEmails(emails: any[]): DetectedProject[] {
  if (emails.length === 0) return [];
  
  // Group emails by subject similarity
  const threads = new Map<string, any[]>();
  
  for (const email of emails) {
    // Normalize subject (remove Re:, Fwd:, etc.)
    const normalizedSubject = email.subject
      .replace(/^(re|fwd|fw):\s*/gi, '')
      .toLowerCase()
      .trim()
      .slice(0, 50);
    
    if (!threads.has(normalizedSubject)) {
      threads.set(normalizedSubject, []);
    }
    threads.get(normalizedSubject)!.push(email);
  }
  
  const projects: DetectedProject[] = [];
  
  for (const [subject, threadEmails] of threads) {
    if (threadEmails.length < 2) continue; // Need at least 2 emails to be a project
    
    const allText = threadEmails.map(e => `${e.subject} ${e.body}`).join(' ').toLowerCase();
    const keyTopics = extractKeyTopics(allText);
    
    const timestamps = threadEmails.map(e => e.receivedAt);
    const firstEmail = new Date(Math.min(...timestamps.map((t: Date) => t.getTime())));
    const lastEmail = new Date(Math.max(...timestamps.map((t: Date) => t.getTime())));
    
    // Determine status based on recency
    const daysSinceLastEmail = (Date.now() - lastEmail.getTime()) / (1000 * 60 * 60 * 24);
    let status: 'in_progress' | 'completed' | 'stalled' = 'in_progress';
    if (daysSinceLastEmail > 14) status = 'stalled';
    
    const progress = Math.min(80, threadEmails.length * 15);
    
    projects.push({
      name: subject.slice(0, 60) || 'Email Thread',
      description: `Email thread with ${threadEmails.length} messages about ${keyTopics.slice(0, 2).join(', ')}`,
      status,
      progress,
      nextStep: `Follow up on email thread: "${subject}"`,
      lastActive: lastEmail,
      sessionId: `email-${subject.replace(/[^a-z0-9]/g, '-')}`,
      messageCount: threadEmails.length,
      context: {
        keyTopics: keyTopics.slice(0, 5),
        sampleMessages: threadEmails.slice(0, 3).map(e => `From: ${e.from}\nSubject: ${e.subject}\n${e.body.slice(0, 150)}`),
        firstMessageAt: firstEmail.toISOString(),
        lastMessageAt: lastEmail.toISOString(),
      },
    });
  }
  
  return projects;
}

main();
