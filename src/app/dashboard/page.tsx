/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Main dashboard — Morning Brief view showing overnight activity summary
 * DEPENDENCIES: @clerk/nextjs, components/brief/*, components/layout/*
 * STATUS: Scaffold — needs real data integration
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import BriefSummary from '@/components/brief/BriefSummary';
import CompletedActions from '@/components/brief/CompletedActions';
import FlaggedItems from '@/components/brief/FlaggedItems';

// TODO: Person 4 — Replace with real data fetch from /api/brief
const mockBrief = {
  summary:
    'While you slept, I finished the Fanzley proposal doc, sent 3 follow-up emails, and flagged 2 items for review.',
  actionsCompleted: 5,
  flaggedForReview: 2,
  completedActions: [
    {
      id: 'act_1',
      userId: 'user_1',
      type: 'email_sent' as const,
      title: 'Follow-up email to Sarah Chen',
      description: 'Sent re: Q2 marketing timeline — confirmed Tuesday meeting',
      app: 'gmail',
      confidence: 0.92,
      status: 'completed' as const,
      metadata: null,
      createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: 'act_2',
      userId: 'user_1',
      type: 'doc_edited' as const,
      title: 'Fanzley Proposal — Final Draft',
      description: 'Completed sections 3-5, added pricing table, formatted for review',
      app: 'gdocs',
      confidence: 0.87,
      status: 'completed' as const,
      metadata: null,
      createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: 'act_3',
      userId: 'user_1',
      type: 'email_sent' as const,
      title: 'Reply to Mike about API specs',
      description: 'Sent technical specification summary per his request',
      app: 'gmail',
      confidence: 0.89,
      status: 'completed' as const,
      metadata: null,
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      id: 'act_4',
      userId: 'user_1',
      type: 'email_sent' as const,
      title: 'Weekly standup notes to team',
      description: 'Sent compiled standup notes from this week',
      app: 'gmail',
      confidence: 0.94,
      status: 'completed' as const,
      metadata: null,
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'act_5',
      userId: 'user_1',
      type: 'task_completed' as const,
      title: 'Updated project timeline in Notion',
      description: 'Adjusted milestones based on new deadline',
      app: 'notion',
      confidence: 0.85,
      status: 'completed' as const,
      metadata: null,
      createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
    },
  ],
  flaggedItems: [
    {
      id: 'act_6',
      userId: 'user_1',
      type: 'flagged' as const,
      title: 'Email from CEO — urgent tone detected',
      description:
        'Received at 2:14 AM. Appears to need a personalized response. Draft created but held for your review.',
      app: 'gmail',
      confidence: 0.45,
      status: 'flagged' as const,
      metadata: null,
      createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    },
    {
      id: 'act_7',
      userId: 'user_1',
      type: 'flagged' as const,
      title: 'Merge conflict in feature branch',
      description:
        'Detected conflict in src/api/auth.ts. Unable to auto-resolve — needs manual review.',
      app: 'github',
      confidence: 0.3,
      status: 'flagged' as const,
      metadata: null,
      createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
  ],
  suggestedFocus: [
    {
      title: 'Review CEO email draft',
      reason: 'Flagged as high-priority — response expected this morning',
      priority: 'high' as const,
    },
    {
      title: 'Resolve merge conflict',
      reason: 'Blocking CI pipeline — needs manual attention',
      priority: 'high' as const,
    },
    {
      title: 'Review Fanzley proposal',
      reason: 'Auto-completed overnight — verify before sending to client',
      priority: 'medium' as const,
    },
  ],
  generatedAt: new Date().toISOString(),
};

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-5xl space-y-6">
            <h1 className="text-2xl font-bold">Good Morning ☀️</h1>
            <BriefSummary
              summary={mockBrief.summary}
              actionsCompleted={mockBrief.actionsCompleted}
              flaggedForReview={mockBrief.flaggedForReview}
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <CompletedActions actions={mockBrief.completedActions} />
              <FlaggedItems items={mockBrief.flaggedItems} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
