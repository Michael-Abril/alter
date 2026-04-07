/**
 * Test script to generate morning brief without auth
 */

import db from '../src/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';

async function testBrief() {
  const userId = 'cmndvesaa000011r5gk3avaoo';

  // Find the user
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error('User not found');
    process.exit(1);
  }

  // ─── Section 1: Work Completed Overnight ────────────────────────────────
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const recentActions = await db.action.findMany({
    where: {
      userId: user.id,
      createdAt: { gte: yesterday },
      type: 'work_continued',
    },
    orderBy: { createdAt: 'desc' },
  });

  const workCompleted = recentActions.map(action => {
    const metadata = action.metadata ? JSON.parse(action.metadata) : {};
    return {
      projectName: action.title,
      description: action.description || '',
      outputFile: metadata.outputPath || null,
      tokensUsed: metadata.tokensUsed || 0,
      completedAt: action.createdAt.toISOString(),
    };
  });

  // ─── Section 2: Deadlines Coming Up ─────────────────────────────────────
  const canvasMessages = await db.chatMessage.findMany({
    where: {
      userId: user.id,
      source: 'canvas',
      content: { contains: 'due' },
    },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  // Parse deadlines from Canvas messages
  const deadlines = canvasMessages
    .map(msg => {
      const match = msg.content.match(/Assignment: ([A-Z]+\d+).*?due (.*?)\./i);
      if (!match) return null;
      
      const courseName = match[1];
      const dueDateStr = match[2];
      const dueDate = new Date(msg.timestamp);
      
      // Extract actual due date from content if possible
      const dateMatch = msg.content.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),? (\w+ \d+)/i);
      if (dateMatch) {
        const dateStr = dateMatch[2];
        const year = new Date().getFullYear();
        const parsedDate = new Date(`${dateStr} ${year}`);
        if (!isNaN(parsedDate.getTime())) {
          dueDate.setTime(parsedDate.getTime());
        }
      }

      return {
        courseName,
        assignmentName: msg.content.split(' - ')[1]?.split(' due ')[0] || 'Assignment',
        dueDate: dueDate.toISOString(),
        daysUntil: Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        content: msg.content,
      };
    })
    .filter(d => d !== null && d.daysUntil >= 0 && d.daysUntil <= 7)
    .sort((a, b) => a!.daysUntil - b!.daysUntil)
    .slice(0, 10);

  // ─── Section 3: Emails Needing Attention ────────────────────────────────
  const recentDrafts = await db.draft.findMany({
    where: {
      userId: user.id,
      type: 'email',
      status: 'pending',
      createdAt: { gte: yesterday },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const emailsNeedingAttention = recentDrafts.map(draft => ({
    subject: draft.title,
    draftSummary: draft.content.slice(0, 200) + '...',
    confidenceScore: draft.confidenceScore,
    status: draft.confidenceScore >= 0.7 ? 'ready_to_review' : 'flagged_low_confidence',
    createdAt: draft.createdAt.toISOString(),
  }));

  // ─── Section 4: Today's Focus ───────────────────────────────────────────
  const projects = await db.project.findMany({
    where: { userId: user.id, status: 'in_progress' },
    orderBy: { lastActive: 'desc' },
  });

  const urgentDeadlines = deadlines.filter(d => d!.daysUntil <= 2);
  const workedOnProjects = workCompleted.map(w => w.projectName);
  
  const todaysFocus: Array<{ task: string; reason: string; priority: 'urgent' | 'high' | 'medium' }> = [];

  // Add urgent deadlines
  urgentDeadlines.forEach(d => {
    todaysFocus.push({
      task: `${d!.courseName}: ${d!.assignmentName}`,
      reason: `Due ${d!.daysUntil === 0 ? 'today' : d!.daysUntil === 1 ? 'tomorrow' : `in ${d!.daysUntil} days`}`,
      priority: 'urgent',
    });
  });

  // Add projects worked on overnight
  workedOnProjects.slice(0, 2).forEach(projectName => {
    if (todaysFocus.length < 3) {
      todaysFocus.push({
        task: projectName,
        reason: 'Continued overnight — review the output and keep momentum',
        priority: 'high',
      });
    }
  });

  // Add high-priority in-progress projects
  projects
    .filter(p => !workedOnProjects.includes(p.name))
    .slice(0, 3 - todaysFocus.length)
    .forEach(p => {
      const ctx = p.context ? JSON.parse(p.context) : {};
      todaysFocus.push({
        task: p.name,
        reason: ctx.nextStep || `${p.progress}% complete`,
        priority: 'medium',
      });
    });

  // ─── Generate Natural Language Summary with Haiku ───────────────────────
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  
  const summaryPrompt = [
    'Generate a 2-sentence natural language morning greeting based on this data:',
    '',
    `Work completed overnight: ${workCompleted.length} projects`,
    workCompleted.slice(0, 2).map(w => `- ${w.projectName}`).join('\n'),
    '',
    `Urgent deadlines: ${urgentDeadlines.length}`,
    urgentDeadlines.slice(0, 2).map(d => `- ${d!.courseName} ${d!.assignmentName} due ${d!.daysUntil === 0 ? 'today' : d!.daysUntil === 1 ? 'tomorrow' : `in ${d!.daysUntil} days`}`).join('\n'),
    '',
    'Write a friendly, concise 2-sentence summary. Start with "Good morning."',
  ].join('\n');

  const summaryResponse = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: summaryPrompt }],
  });

  const naturalLanguageSummary = summaryResponse.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join(' ');

  // ─── Build Brief ─────────────────────────────────────────────────────────
  const briefsDir = path.join(process.cwd(), 'data', 'briefs');
  if (!fs.existsSync(briefsDir)) {
    fs.mkdirSync(briefsDir, { recursive: true });
  }

  const date = new Date().toISOString().split('T')[0];
  const briefPath = path.join(briefsDir, `${date}.md`);

  const briefMarkdown = [
    '# NightShift Morning Brief',
    '',
    `**Date:** ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '---',
    '',
    naturalLanguageSummary,
    '',
    '---',
    '',
    '## 📂 Work Completed Overnight',
    '',
    workCompleted.length > 0
      ? workCompleted.map(w => [
          `### ${w.projectName}`,
          w.description,
          w.outputFile ? `📄 Output: \`${w.outputFile}\`` : '',
          `⏱️  Completed: ${new Date(w.completedAt).toLocaleTimeString()}`,
          '',
        ].filter(Boolean).join('\n')).join('\n')
      : 'No work completed overnight.',
    '',
    '## 📅 Deadlines Coming Up',
    '',
    deadlines.length > 0
      ? deadlines.map(d => `- **${d!.courseName}**: ${d!.assignmentName} — Due ${d!.daysUntil === 0 ? 'today' : d!.daysUntil === 1 ? 'tomorrow' : `in ${d!.daysUntil} days`}`).join('\n')
      : 'No upcoming deadlines in the next 7 days.',
    '',
    '## 📧 Emails Needing Attention',
    '',
    emailsNeedingAttention.length > 0
      ? emailsNeedingAttention.map(e => [
          `### ${e.subject}`,
          `Confidence: ${(e.confidenceScore * 100).toFixed(0)}% ${e.status === 'flagged_low_confidence' ? '⚠️ (Low confidence)' : '✅'}`,
          e.draftSummary,
          '',
        ].join('\n')).join('\n')
      : 'No emails needing attention.',
    '',
    '## 🎯 Today\'s Focus',
    '',
    todaysFocus.length > 0
      ? todaysFocus.map((f, i) => `${i + 1}. **${f.task}** ${f.priority === 'urgent' ? '🔴' : f.priority === 'high' ? '🟡' : '🟢'}\n   ${f.reason}`).join('\n\n')
      : 'No specific focus items for today.',
    '',
  ].join('\n');

  fs.writeFileSync(briefPath, briefMarkdown, 'utf-8');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Morning Brief Generated');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(briefMarkdown);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Saved to: ${briefPath}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

testBrief().catch(console.error);
