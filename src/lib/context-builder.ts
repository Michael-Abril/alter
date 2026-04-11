/**
 * OWNER: Person 3 (Royce/OpenClaw)
 * PURPOSE: Centralized context builder — packages everything Alter knows about a project
 * DEPENDENCIES: Prisma, vectra, embeddings
 * STATUS: LIVE — builds comprehensive context packages for projects
 *
 * This is the single source of truth for project context. Instead of each orchestration
 * script making its own queries, they all call buildContext() to get a complete picture.
 */

import db from '@/lib/db';
import { generateEmbedding } from '@/lib/embeddings';
import { queryVectors } from '@/lib/pinecone';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProjectContext {
  projectSummary: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    progress: number;
    lastActive: Date;
    context: {
      nextStep?: string;
      keyTopics?: string[];
      sampleMessages?: string[];
      sessionId?: string;
      messageCount?: number;
      firstMessageAt?: string;
      lastMessageAt?: string;
    };
  };
  relevantConversations: Array<{
    id: string;
    score: number;
    content: string;
    source: string;
    role?: string;
    timestamp?: string;
  }>;
  relatedEmails: Array<{
    id: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    direction: string;
    receivedAt: Date;
    relevanceScore: number;
  }>;
  canvasDeadlines: Array<{
    id: string;
    content: string;
    timestamp: string;
    relevanceScore: number;
  }>;
  upcomingCalendarEvents: Array<{
    id: string;
    title: string;
    description: string | null;
    startTime: Date;
    isDeadline: boolean;
  }>;
  githubActivity: Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    url: string;
    authoredAt: Date;
  }>;
  suggestedNextSteps: string[];
  metadata: {
    totalConversations: number;
    totalEmails: number;
    totalCanvasDeadlines: number;
    totalCalendarEvents: number;
    totalGitHubActivities: number;
    contextQuality: 'high' | 'medium' | 'low';
    generatedAt: string;
  };
}

// ─── Main Function ───────────────────────────────────────────────────────────

/**
 * Build a comprehensive context package for a project.
 * 
 * @param projectId - The project ID to build context for
 * @returns Complete context package with all relevant information
 */
export async function buildContext(projectId: string): Promise<ProjectContext> {
  console.log(`[context-builder] Building context for project: ${projectId}`);

  // Step 1: Load project from database
  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  console.log(`[context-builder] ✅ Loaded project: ${project.name}`);

  // Parse context JSON
  const context = project.context ? JSON.parse(project.context) : {};

  // Step 2: Query vector DB for relevant conversations
  console.log(`[context-builder] 🔍 Querying vector DB for relevant conversations...`);
  const relevantConversations = await queryRelevantConversations(project, context);
  console.log(`[context-builder] ✅ Found ${relevantConversations.length} relevant conversations`);

  // Step 3: Pull related emails
  console.log(`[context-builder] 📧 Searching for related emails...`);
  const relatedEmails = await findRelatedEmails(project, context);
  console.log(`[context-builder] ✅ Found ${relatedEmails.length} related emails`);

  // Step 4: Fetch calendar events
  console.log(`[context-builder] 📅 Fetching calendar events...`);
  const upcomingCalendarEvents = await queryCalendarEvents(project);
  console.log(`[context-builder] ✅ Found ${upcomingCalendarEvents.length} upcoming events`);

  // Step 5: Fetch GitHub activity
  console.log(`[context-builder] 🐙 Fetching GitHub activity...`);
  const githubActivity = await queryGitHubActivity(project, context);
  console.log(`[context-builder] ✅ Found ${githubActivity.length} GitHub activities`);

  // Step 6: Generate suggested next steps
  console.log(`[context-builder] 💡 Generating suggested next steps...`);
  const suggestedNextSteps = generateNextSteps(project, context, relevantConversations, relatedEmails);
  console.log(`[context-builder] ✅ Generated ${suggestedNextSteps.length} suggestions`);

  // Step 7: Calculate context quality
  const contextQuality = calculateContextQuality(relevantConversations, relatedEmails);

  const canvasDeadlines = await queryCanvasDeadlines(project, context);

  const contextPackage: ProjectContext = {
    projectSummary: {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      progress: project.progress,
      lastActive: project.lastActive,
      context,
    },
    relevantConversations,
    relatedEmails,
    canvasDeadlines,
    upcomingCalendarEvents,
    githubActivity,
    suggestedNextSteps,
    metadata: {
      totalConversations: relevantConversations.length,
      totalEmails: relatedEmails.length,
      totalCanvasDeadlines: canvasDeadlines.length,
      totalCalendarEvents: upcomingCalendarEvents.length,
      totalGitHubActivities: githubActivity.length,
      contextQuality,
      generatedAt: new Date().toISOString(),
    },
  };

  console.log(`[context-builder] ✅ Context package built (quality: ${contextQuality})`);

  return contextPackage;
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Query vector DB for conversations relevant to this project.
 */
async function queryRelevantConversations(
  project: any,
  context: any
): Promise<Array<{ id: string; score: number; content: string; source: string; role?: string; timestamp?: string }>> {
  try {
    // Build search query from project metadata
    const searchQuery = [
      project.name,
      project.description,
      ...(context?.keyTopics || []),
      context?.nextStep,
    ].filter(Boolean).join(' ');

    // Generate embedding for the query
    const queryVector = await generateEmbedding(searchQuery);

    // Search the vector store (top 20 results)
    const results = await queryVectors(project.userId, queryVector, 20, {
      // Filter by sessionId if available to prioritize conversation context
      ...(context?.sessionId ? { sessionId: context.sessionId } : {}),
    });

    return results.map(r => ({
      id: r.id,
      score: r.score,
      content: r.content,
      source: r.metadata.source as string,
      role: r.metadata.role as string | undefined,
      timestamp: r.metadata.timestamp as string | undefined,
    }));
  } catch (err) {
    console.warn(`[context-builder] Vector query failed: ${err instanceof Error ? err.message : err}`);
    
    // Fallback to sample messages from project context
    if (context?.sampleMessages?.length > 0) {
      return context.sampleMessages.map((msg: string, i: number) => ({
        id: `fallback-${i}`,
        score: 0.8,
        content: msg,
        source: 'project_context',
      }));
    }
    
    return [];
  }
}

/**
 * Find emails related to this project by searching for contacts and keywords.
 */
async function findRelatedEmails(
  project: any,
  context: any
): Promise<Array<{
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  direction: string;
  receivedAt: Date;
  relevanceScore: number;
}>> {
  try {
    // Extract keywords and topics from project
    const keywords = [
      project.name.toLowerCase(),
      ...(context?.keyTopics || []).map((t: string) => t.toLowerCase()),
    ];

    // High-signal mail only (sent + Gmail Important), matched by project keywords
    const emails = await db.email.findMany({
      where: {
        userId: project.userId,
        ingestChannel: { in: ['sent', 'important_inbox'] },
        OR: [
          ...keywords.map((keyword) => ({
            subject: { contains: keyword, mode: 'insensitive' as const },
          })),
          ...keywords.map((keyword) => ({
            body: { contains: keyword, mode: 'insensitive' as const },
          })),
        ],
      },
      orderBy: { receivedAt: 'desc' },
      take: 10,
    });

    // Calculate relevance score for each email
    return emails.map(email => {
      let relevanceScore = 0;
      const emailText = `${email.subject} ${email.body}`.toLowerCase();
      
      // Score based on keyword matches
      for (const keyword of keywords) {
        const matches = (emailText.match(new RegExp(keyword, 'gi')) || []).length;
        relevanceScore += matches * 0.2;
      }
      
      if (email.ingestChannel === 'important_inbox') relevanceScore += 0.15;
      if (email.ingestChannel === 'sent') relevanceScore += 0.1;

      // Boost recent emails
      const daysSinceReceived = (Date.now() - email.receivedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceReceived < 7) relevanceScore += 0.3;
      else if (daysSinceReceived < 30) relevanceScore += 0.1;
      
      // Cap at 1.0
      relevanceScore = Math.min(1.0, relevanceScore);

      return {
        id: email.id,
        from: email.from,
        to: email.to,
        subject: email.subject,
        body: email.body.slice(0, 500), // Truncate body
        direction: email.direction,
        receivedAt: email.receivedAt,
        relevanceScore,
      };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  } catch (err) {
    console.warn(`[context-builder] Email search failed: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

/**
 * Query Canvas deadlines relevant to this project.
 */
async function queryCanvasDeadlines(
  project: any,
  context: any
): Promise<Array<{ id: string; content: string; timestamp: string; relevanceScore: number }>> {
  try {
    // Fetch Canvas messages from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const canvasMessages = await db.chatMessage.findMany({
      where: {
        userId: project.userId,
        source: 'canvas',
        timestamp: {
          gte: thirtyDaysAgo,
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    if (canvasMessages.length === 0) {
      return [];
    }

    // Score relevance based on keyword matching with project
    const projectKeywords = [
      project.name.toLowerCase(),
      ...(context?.keyTopics || []).map((t: string) => t.toLowerCase()),
    ];

    return canvasMessages.map(msg => {
      let relevanceScore = 0.3; // Base score for all Canvas items

      // Check for keyword matches
      const contentLower = msg.content.toLowerCase();
      for (const keyword of projectKeywords) {
        if (contentLower.includes(keyword)) {
          relevanceScore += 0.3;
        }
      }

      // Boost score for upcoming deadlines (assignments with "due")
      if (contentLower.includes('due') && contentLower.includes('assignment')) {
        relevanceScore += 0.4;
      }

      // Cap at 1.0
      relevanceScore = Math.min(1.0, relevanceScore);

      return {
        id: msg.id,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        relevanceScore,
      };
    })
    .filter(item => item.relevanceScore > 0.4) // Only include reasonably relevant items
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10); // Top 10 most relevant
  } catch (err) {
    console.warn(`[context-builder] Canvas deadline search failed: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

/**
 * Fetch upcoming calendar events relevant to this project.
 */
async function queryCalendarEvents(
  project: any,
): Promise<Array<{ id: string; title: string; description: string | null; startTime: Date; isDeadline: boolean }>> {
  try {
    const oneWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const events = await db.calendarEvent.findMany({
      where: {
        userId: project.userId,
        startTime: { gte: new Date(), lte: oneWeek },
      },
      orderBy: { startTime: 'asc' },
      take: 10,
    });

    const deadlineKeywords = ['due', 'deadline', 'quiz', 'exam', 'assignment', 'submit'];
    return events.map(e => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startTime: e.startTime,
      isDeadline: deadlineKeywords.some(k => e.title.toLowerCase().includes(k)),
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch recent GitHub activity relevant to this project.
 */
async function queryGitHubActivity(
  project: any,
  context: any,
): Promise<Array<{ id: string; type: string; title: string; body: string | null; url: string; authoredAt: Date }>> {
  try {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const activities = await db.githubActivity.findMany({
      where: {
        userId: project.userId,
        authoredAt: { gte: threeDaysAgo },
      },
      orderBy: { authoredAt: 'desc' },
      take: 15,
    });

    const projectKeywords = [
      project.name.toLowerCase(),
      ...(context?.keyTopics || []).map((t: string) => t.toLowerCase()),
    ];

    return activities
      .filter(a => {
        const text = `${a.title} ${a.body || ''}`.toLowerCase();
        return projectKeywords.some(k => text.includes(k)) || true;
      })
      .slice(0, 10)
      .map(a => ({
        id: a.id,
        type: a.type,
        title: a.title,
        body: a.body?.slice(0, 500) || null,
        url: a.url,
        authoredAt: a.authoredAt,
      }));
  } catch {
    return [];
  }
}

/**
 * Generate suggested next steps based on project state and context.
 */
function generateNextSteps(
  project: any,
  context: any,
  conversations: any[],
  emails: any[]
): string[] {
  const steps: string[] = [];

  // Add the explicit next step from project context
  if (context?.nextStep) {
    steps.push(context.nextStep);
  }

  // Suggest based on progress
  if (project.progress < 30) {
    steps.push('Define core requirements and scope');
    steps.push('Set up initial project structure');
  } else if (project.progress < 70) {
    steps.push('Continue implementation of key features');
    steps.push('Review progress with stakeholders');
  } else {
    steps.push('Finalize remaining tasks');
    steps.push('Prepare for launch/delivery');
  }

  // Suggest based on recent emails
  if (emails.length > 0) {
    const recentEmail = emails[0];
    if (recentEmail.direction === 'received') {
      steps.push(`Follow up on email from ${recentEmail.from.split('@')[0]}`);
    }
  }

  // Suggest based on status
  if (project.status === 'stalled') {
    steps.push('Review blockers and dependencies');
    steps.push('Re-engage with project stakeholders');
  }

  // Limit to top 5 suggestions
  return steps.slice(0, 5);
}

/**
 * Calculate overall context quality based on available information.
 */
function calculateContextQuality(
  conversations: any[],
  emails: any[]
): 'high' | 'medium' | 'low' {
  const conversationScore = Math.min(conversations.length / 10, 1.0); // 10+ conversations = max
  const emailScore = Math.min(emails.length / 5, 1.0); // 5+ emails = max
  
  const avgRelevance = conversations.length > 0
    ? conversations.reduce((sum, c) => sum + c.score, 0) / conversations.length
    : 0;

  const totalScore = (conversationScore * 0.4) + (emailScore * 0.3) + (avgRelevance * 0.3);

  if (totalScore >= 0.7) return 'high';
  if (totalScore >= 0.4) return 'medium';
  return 'low';
}
