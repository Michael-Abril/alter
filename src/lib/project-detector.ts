/**
 * OWNER: Person 2 (Vectors) + Person 3 (Royce/OpenClaw)
 * PURPOSE: Analyze chat conversations to detect active projects, status, and next steps
 * DEPENDENCIES: Prisma, Akash ML API
 * STATUS: LIVE — uses Akash ML API when available, falls back to keyword/recency analysis
 */

import { callOpenClaw, isOpenClawConfigured } from '@/lib/openclaw-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DetectedProject {
  name: string;
  description: string;
  status: 'in_progress' | 'completed' | 'stalled';
  progress: number; // 0-100
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

export interface ConversationGroup {
  sessionId: string;
  messages: {
    role: string;
    content: string;
    timestamp: Date;
  }[];
}

// ─── Backend Detection ───────────────────────────────────────────────────────

function hasAkashKey(): boolean {
  return isOpenClawConfigured();
}

export function getDetectorBackend(): 'akash' | 'local' {
  return hasAkashKey() ? 'akash' : 'local';
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Detect projects from grouped conversations.
 */
export async function detectProjects(
  conversations: ConversationGroup[]
): Promise<DetectedProject[]> {
  if (hasAkashKey()) {
    return detectWithAkash(conversations);
  }
  return detectWithKeywords(conversations);
}

// ─── Akash ML API Backend ──────────────────────────────────────────────────────

async function detectWithAkash(
  conversations: ConversationGroup[]
): Promise<DetectedProject[]> {
  const projects: DetectedProject[] = [];

  for (const conv of conversations) {
    if (conv.messages.length < 2) continue;

    // Build conversation summary (truncate to ~4000 chars to stay within limits)
    const transcript = conv.messages
      .map(m => `[${m.role}]: ${m.content.slice(0, 300)}`)
      .join('\n')
      .slice(0, 4000);

    const prompt = `Analyze this conversation and extract project information. Respond ONLY with valid JSON, no markdown.

Conversation title/session: "${conv.sessionId}"
Message count: ${conv.messages.length}
First message: ${conv.messages[0].timestamp.toISOString()}
Last message: ${conv.messages[conv.messages.length - 1].timestamp.toISOString()}

Transcript:
${transcript}

Respond with this exact JSON structure:
{
  "name": "short project name (3-6 words max)",
  "description": "one sentence describing what's being built or discussed",
  "status": "in_progress" or "completed" or "stalled",
  "progress": number 0-100 estimating how complete the work is,
  "nextStep": "one sentence describing what should happen next to continue this work",
  "keyTopics": ["topic1", "topic2", "topic3"]
}`;

    try {
      const response = await callOpenClaw({
        system: 'You are a project analyzer. Return ONLY valid JSON, no markdown, no explanation.',
        user: prompt,
        maxTokens: 500,
      });

      const text = response.content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(text);

      const timestamps = conv.messages.map(m => m.timestamp);

      projects.push({
        name: parsed.name || conv.sessionId,
        description: parsed.description || '',
        status: parsed.status || 'in_progress',
        progress: Math.min(100, Math.max(0, parsed.progress || 50)),
        nextStep: parsed.nextStep || '',
        lastActive: new Date(Math.max(...timestamps.map(t => t.getTime()))),
        sessionId: conv.sessionId,
        messageCount: conv.messages.length,
        context: {
          keyTopics: parsed.keyTopics || [],
          sampleMessages: conv.messages.slice(0, 3).map(m => m.content.slice(0, 200)),
          firstMessageAt: new Date(Math.min(...timestamps.map(t => t.getTime()))).toISOString(),
          lastMessageAt: new Date(Math.max(...timestamps.map(t => t.getTime()))).toISOString(),
        },
      });
    } catch (err) {
      console.error(`[project-detector] Akash ML API error for "${conv.sessionId}":`, err);
      // Fall back to keyword detection for this conversation
      const fallback = analyzeConversationLocally(conv);
      if (fallback) projects.push(fallback);
    }
  }

  return projects;
}

// ─── Local Keyword/Recency Backend ───────────────────────────────────────────

function detectWithKeywords(
  conversations: ConversationGroup[]
): Promise<DetectedProject[]> {
  const projects: DetectedProject[] = [];

  for (const conv of conversations) {
    if (conv.messages.length < 2) continue;
    const result = analyzeConversationLocally(conv);
    if (result) projects.push(result);
  }

  return Promise.resolve(projects);
}

function analyzeConversationLocally(conv: ConversationGroup): DetectedProject | null {
  const allText = conv.messages.map(m => m.content).join(' ').toLowerCase();
  const userMessages = conv.messages.filter(m => m.role === 'user');
  const assistantMessages = conv.messages.filter(m => m.role === 'assistant');
  const timestamps = conv.messages.map(m => m.timestamp);
  const firstMsg = new Date(Math.min(...timestamps.map(t => t.getTime())));
  const lastMsg = new Date(Math.max(...timestamps.map(t => t.getTime())));
  const ageHours = (Date.now() - lastMsg.getTime()) / (1000 * 60 * 60);

  // ── Extract key topics via TF-IDF-like scoring ──
  const keyTopics = extractKeyTopics(allText);
  const projectName = deriveProjectName(conv.sessionId, keyTopics);
  const description = deriveDescription(conv, keyTopics);

  // ── Determine status ──
  const status = determineStatus(conv, ageHours, allText);

  // ── Estimate progress ──
  const progress = estimateProgress(conv, status, allText);

  // ── Determine next step ──
  const nextStep = determineNextStep(conv, status, keyTopics);

  return {
    name: projectName,
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

// ─── Analysis Helpers ────────────────────────────────────────────────────────

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

function extractKeyTopics(text: string): string[] {
  const words = text.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const tf = new Map<string, number>();

  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    tf.set(word, (tf.get(word) || 0) + 1);
  }

  // Also extract bigrams
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

function deriveProjectName(sessionId: string, _keyTopics: string[]): string {
  // The sessionId IS the conversation title from Claude, which is usually a good project name
  // Clean it up slightly
  return sessionId
    .replace(/[^\w\s:/-]/g, '')
    .trim()
    .slice(0, 80);
}

function deriveDescription(conv: ConversationGroup, keyTopics: string[]): string {
  // Use the first user message as the basis for description
  const firstUserMsg = conv.messages.find(m => m.role === 'user');
  if (firstUserMsg) {
    const snippet = firstUserMsg.content.slice(0, 150).replace(/\n/g, ' ').trim();
    if (snippet.length > 20) {
      return snippet + (firstUserMsg.content.length > 150 ? '...' : '');
    }
  }

  // Fallback: use key topics
  if (keyTopics.length >= 3) {
    return `Project involving ${keyTopics.slice(0, 3).join(', ')}`;
  }

  return `Conversation with ${conv.messages.length} messages`;
}

// ── Completion/action indicators ──

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

function countSignals(text: string, signals: string[]): number {
  let count = 0;
  for (const signal of signals) {
    const regex = new RegExp(signal, 'gi');
    const matches = text.match(regex);
    if (matches) count += matches.length;
  }
  return count;
}

function determineStatus(
  conv: ConversationGroup,
  ageHours: number,
  allText: string
): 'in_progress' | 'completed' | 'stalled' {
  // Look at the last few messages for signals
  const recentText = conv.messages
    .slice(-5)
    .map(m => m.content)
    .join(' ')
    .toLowerCase();

  const completionScore = countSignals(recentText, COMPLETION_SIGNALS);
  const progressScore = countSignals(recentText, IN_PROGRESS_SIGNALS);
  const stalledScore = countSignals(recentText, STALLED_SIGNALS);

  // If very recent and has completion signals in last messages
  if (completionScore > progressScore && completionScore > stalledScore) {
    return 'completed';
  }

  // If older than 48 hours with no recent activity → stalled
  if (ageHours > 48) {
    return 'stalled';
  }

  // If has stalled signals and older than 24 hours
  if (stalledScore > progressScore && ageHours > 24) {
    return 'stalled';
  }

  return 'in_progress';
}

function estimateProgress(
  conv: ConversationGroup,
  status: string,
  allText: string
): number {
  if (status === 'completed') return 95; // 95 not 100 — there might be follow-ups

  // Heuristics based on conversation length and signals
  const msgCount = conv.messages.length;
  const completionSignals = countSignals(allText, COMPLETION_SIGNALS);
  const progressSignals = countSignals(allText, IN_PROGRESS_SIGNALS);

  // Base progress from message count (more messages = more work done)
  let base = Math.min(80, Math.floor(msgCount * 3));

  // Boost for completion signals
  base += completionSignals * 5;

  // Reduce for in-progress signals still present in recent messages
  const recentText = conv.messages.slice(-3).map(m => m.content).join(' ').toLowerCase();
  const recentProgress = countSignals(recentText, IN_PROGRESS_SIGNALS);
  if (recentProgress > 2) base -= 10;

  if (status === 'stalled') base = Math.min(base, 60);

  return Math.min(90, Math.max(10, base));
}

function determineNextStep(
  conv: ConversationGroup,
  status: string,
  keyTopics: string[]
): string {
  const lastUserMsg = [...conv.messages].reverse().find(m => m.role === 'user');
  const lastAssistantMsg = [...conv.messages].reverse().find(m => m.role === 'assistant');

  if (status === 'completed') {
    return 'Project appears complete. Review for any follow-up tasks.';
  }

  if (status === 'stalled') {
    if (lastUserMsg) {
      const snippet = lastUserMsg.content.slice(0, 100).replace(/\n/g, ' ').trim();
      return `Stalled — last request was: "${snippet}". Resume this conversation.`;
    }
    return 'Stalled — revisit and determine if this project is still active.';
  }

  // In-progress: look at what was last discussed
  if (lastAssistantMsg) {
    const content = lastAssistantMsg.content.toLowerCase();

    // Check for action items or next steps mentioned by assistant
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
        return match[1].replace(/\n/g, ' ').trim().slice(0, 150);
      }
    }
  }

  if (lastUserMsg) {
    const snippet = lastUserMsg.content.slice(0, 100).replace(/\n/g, ' ').trim();
    return `Continue from last message: "${snippet}"`;
  }

  return `Continue work on ${keyTopics.slice(0, 2).join(' and ') || 'this project'}`;
}
