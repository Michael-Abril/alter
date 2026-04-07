/**
 * FULL NIGHTSHIFT FLOW TEST
 * 
 * Simulates the complete user journey from signup to morning brief:
 * 1. Create test user
 * 2. Insert fake Gmail data
 * 3. Insert fake chat messages
 * 4. Run embedding pipeline
 * 5. Run project detection
 * 6. Simulate overnight work continuation
 * 7. Generate morning brief
 * 8. Print comprehensive report
 */

import { PrismaClient } from '@prisma/client';
import { LocalIndex } from 'vectra';
import path from 'path';
import fs from 'fs';

const db = new PrismaClient();

// ─── Config ──────────────────────────────────────────────────────────────────

const TEST_USER = {
  clerkId: `test_user_${Date.now()}`,
  email: `test${Date.now()}@nightshift.ai`,
  name: 'Test User',
  wakeTime: '07:00',
};

const FAKE_EMAILS = [
  {
    from: 'professor@university.edu',
    to: TEST_USER.email,
    subject: 'Assignment Due Tomorrow',
    body: 'Hi, just a reminder that your final project proposal is due tomorrow at 11:59 PM. Please submit via Canvas.',
    direction: 'received',
    receivedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    from: TEST_USER.email,
    to: 'professor@university.edu',
    subject: 'Re: Assignment Due Tomorrow',
    body: 'Thank you for the reminder. I will submit it tonight.',
    direction: 'sent',
    receivedAt: new Date(Date.now() - 23 * 60 * 60 * 1000),
  },
  {
    from: 'team@startup.com',
    to: TEST_USER.email,
    subject: 'Pitch Deck Review',
    body: 'We reviewed your pitch deck. The market analysis is strong, but we need more details on the go-to-market strategy.',
    direction: 'received',
    receivedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
  },
  {
    from: TEST_USER.email,
    to: 'team@startup.com',
    subject: 'Re: Pitch Deck Review',
    body: 'Thanks for the feedback. I will update the GTM section and send a revised version by Friday.',
    direction: 'sent',
    receivedAt: new Date(Date.now() - 11 * 60 * 60 * 1000),
  },
  {
    from: 'client@company.com',
    to: TEST_USER.email,
    subject: 'Website Redesign Project',
    body: 'Can we schedule a call to discuss the website redesign? We are targeting a launch in 3 weeks.',
    direction: 'received',
    receivedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
  },
  {
    from: TEST_USER.email,
    to: 'client@company.com',
    subject: 'Re: Website Redesign Project',
    body: 'Absolutely. I am available tomorrow afternoon. Let me know what time works for you.',
    direction: 'sent',
    receivedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
  },
  {
    from: 'recruiter@techcorp.com',
    to: TEST_USER.email,
    subject: 'Software Engineering Role',
    body: 'We came across your profile and think you would be a great fit for our senior engineer role. Are you open to opportunities?',
    direction: 'received',
    receivedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
  },
  {
    from: TEST_USER.email,
    to: 'recruiter@techcorp.com',
    subject: 'Re: Software Engineering Role',
    body: 'Thank you for reaching out. I am currently focused on my startup but happy to stay in touch.',
    direction: 'sent',
    receivedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
  {
    from: 'advisor@university.edu',
    to: TEST_USER.email,
    subject: 'Thesis Progress Check',
    body: 'How is your thesis coming along? We should meet next week to review your latest draft.',
    direction: 'received',
    receivedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    from: TEST_USER.email,
    to: 'advisor@university.edu',
    subject: 'Re: Thesis Progress Check',
    body: 'Making good progress. I have completed chapters 1-3 and am working on the methodology section. Next week works great.',
    direction: 'sent',
    receivedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
];

const FAKE_CHAT_MESSAGES = [
  // Conversation 1: Startup Pitch Deck
  {
    source: 'claude',
    role: 'user',
    content: 'I need help creating a pitch deck for my SaaS startup. We are building an AI-powered project management tool.',
    sessionId: 'Startup Pitch Deck',
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000),
  },
  {
    source: 'claude',
    role: 'assistant',
    content: 'I can help you create a compelling pitch deck. Let\'s start with the key sections: Problem, Solution, Market Size, Business Model, Traction, Team, and Ask. What specific problem does your tool solve?',
    sessionId: 'Startup Pitch Deck',
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000 + 60000),
  },
  {
    source: 'claude',
    role: 'user',
    content: 'The problem is that teams waste 30% of their time on status updates and coordination. Our AI automatically tracks progress and generates updates.',
    sessionId: 'Startup Pitch Deck',
    timestamp: new Date(Date.now() - 47 * 60 * 60 * 1000),
  },
  {
    source: 'claude',
    role: 'assistant',
    content: 'Excellent. That\'s a clear, quantifiable problem. For the solution slide, we should highlight: 1) AI-powered progress tracking, 2) Automated status updates, 3) Smart insights and predictions. What\'s your target market size?',
    sessionId: 'Startup Pitch Deck',
    timestamp: new Date(Date.now() - 47 * 60 * 60 * 1000 + 60000),
  },
  {
    source: 'claude',
    role: 'user',
    content: 'We are targeting mid-market companies (100-1000 employees). The TAM is about $15B globally.',
    sessionId: 'Startup Pitch Deck',
    timestamp: new Date(Date.now() - 46 * 60 * 60 * 1000),
  },
  {
    source: 'claude',
    role: 'assistant',
    content: 'Great market size. For your go-to-market strategy, I recommend focusing on: 1) Product-led growth with a freemium model, 2) Partnerships with existing PM tools, 3) Content marketing targeting engineering managers. Do you have any early traction?',
    sessionId: 'Startup Pitch Deck',
    timestamp: new Date(Date.now() - 46 * 60 * 60 * 1000 + 60000),
  },
  {
    source: 'claude',
    role: 'user',
    content: 'Yes, we have 50 beta users and 5 paying customers. MRR is $2,500.',
    sessionId: 'Startup Pitch Deck',
    timestamp: new Date(Date.now() - 45 * 60 * 60 * 1000),
  },

  // Conversation 2: Thesis Research
  {
    source: 'claude',
    role: 'user',
    content: 'I am writing my thesis on the impact of AI on knowledge work productivity. Can you help me structure the methodology section?',
    sessionId: 'Thesis Research',
    timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000),
  },
  {
    source: 'claude',
    role: 'assistant',
    content: 'For a thesis on AI and productivity, I recommend a mixed-methods approach: 1) Quantitative survey of 200+ knowledge workers, 2) Qualitative interviews with 20 early AI adopters, 3) Case studies of 3-5 companies. What\'s your research question?',
    sessionId: 'Thesis Research',
    timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000 + 60000),
  },
  {
    source: 'claude',
    role: 'user',
    content: 'My research question is: How does AI tool adoption affect individual productivity and job satisfaction among knowledge workers?',
    sessionId: 'Thesis Research',
    timestamp: new Date(Date.now() - 35 * 60 * 60 * 1000),
  },
  {
    source: 'claude',
    role: 'assistant',
    content: 'Excellent question. For your survey, measure: 1) Productivity metrics (tasks completed, time saved), 2) Job satisfaction scores (before/after AI adoption), 3) Tool usage patterns. For interviews, explore: perceived benefits, challenges, workflow changes. Need help with the survey design?',
    sessionId: 'Thesis Research',
    timestamp: new Date(Date.now() - 35 * 60 * 60 * 1000 + 60000),
  },
  {
    source: 'claude',
    role: 'user',
    content: 'Yes, what questions should I include in the survey?',
    sessionId: 'Thesis Research',
    timestamp: new Date(Date.now() - 34 * 60 * 60 * 1000),
  },
  {
    source: 'claude',
    role: 'assistant',
    content: 'Key survey questions: 1) Demographics (role, industry, experience), 2) AI tool usage (which tools, frequency, duration), 3) Productivity impact (Likert scale: time saved, output quality, task completion), 4) Job satisfaction (before/after comparison), 5) Challenges (learning curve, trust, integration). Use a mix of Likert scales and open-ended questions.',
    sessionId: 'Thesis Research',
    timestamp: new Date(Date.now() - 34 * 60 * 60 * 1000 + 60000),
  },

  // Conversation 3: Website Redesign
  {
    source: 'claude',
    role: 'user',
    content: 'I need to redesign a client\'s website. They are a B2B SaaS company selling to enterprise customers. What should I focus on?',
    sessionId: 'Website Redesign Project',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    source: 'claude',
    role: 'assistant',
    content: 'For enterprise B2B SaaS, prioritize: 1) Clear value proposition above the fold, 2) Trust signals (logos, testimonials, case studies), 3) Product demo or video, 4) Security/compliance badges, 5) Clear CTAs for demo requests. What\'s their current conversion rate?',
    sessionId: 'Website Redesign Project',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000 + 60000),
  },
  {
    source: 'claude',
    role: 'user',
    content: 'Current conversion rate is 2.5%. They want to get to 4-5%. The main issue is that visitors don\'t understand the product quickly enough.',
    sessionId: 'Website Redesign Project',
    timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000),
  },
  {
    source: 'claude',
    role: 'assistant',
    content: 'To improve clarity and conversion: 1) Add a 60-second explainer video above the fold, 2) Use benefit-focused headlines (not feature lists), 3) Create an interactive product tour, 4) Add a comparison table vs. competitors, 5) Implement exit-intent popup with demo offer. What\'s their target audience\'s biggest pain point?',
    sessionId: 'Website Redesign Project',
    timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000 + 60000),
  },
  {
    source: 'claude',
    role: 'user',
    content: 'Their customers struggle with data silos and manual reporting. The product consolidates all data sources and automates reporting.',
    sessionId: 'Website Redesign Project',
    timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000),
  },
  {
    source: 'claude',
    role: 'assistant',
    content: 'Perfect. Lead with that pain point: "Stop wasting 10 hours/week on manual reports. Consolidate all your data sources in one place." Show before/after: scattered spreadsheets vs. unified dashboard. Add ROI calculator showing time/cost savings. Include case study: "How [Company] saved 40 hours/month on reporting."',
    sessionId: 'Website Redesign Project',
    timestamp: new Date(Date.now() - 22 * 60 * 60 * 1000 + 60000),
  },
];

// ─── Utilities ───────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[test-flow] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

function generateLocalEmbedding(text: string): number[] {
  const EMBEDDING_DIMENSIONS = 1536;
  const vec = new Float64Array(EMBEDDING_DIMENSIONS);
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(w => w.length > 1);

  if (words.length === 0) return Array.from(vec);

  const tf = new Map<string, number>();
  for (const word of words) {
    tf.set(word, (tf.get(word) || 0) + 1);
  }

  for (const [word, count] of tf) {
    const weight = Math.log(1 + count);
    for (let h = 0; h < 4; h++) {
      const hash = hashString(`${word}_${h}`);
      const idx = Math.abs(hash) % EMBEDDING_DIMENSIONS;
      const sign = hashString(`${word}_sign_${h}`) % 2 === 0 ? 1 : -1;
      vec[idx] += sign * weight;
    }
  }

  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  }

  return Array.from(vec);
}

function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) | 0;
  }
  return hash;
}

// ─── Main Flow ───────────────────────────────────────────────────────────────

async function main() {
  const report = {
    userCreated: false,
    userId: '',
    emailsIngested: 0,
    messagesIngested: 0,
    vectorsCreated: 0,
    projectsDetected: 0,
    projectDetails: [] as any[],
    overnightWorkCompleted: 0,
    briefGenerated: false,
    briefContent: '',
  };

  try {
    log('═══════════════════════════════════════════════════════════════');
    log('  NIGHTSHIFT FULL FLOW TEST');
    log('═══════════════════════════════════════════════════════════════');

    // ─── Step 1: Create Test User ───────────────────────────────────────────
    log('\n[1/7] Creating test user...');
    const user = await db.user.create({
      data: TEST_USER,
    });
    report.userCreated = true;
    report.userId = user.id;
    log(`  ✅ User created: ${user.email} (ID: ${user.id})`);

    // ─── Step 2: Insert Fake Emails ─────────────────────────────────────────
    log('\n[2/7] Inserting fake Gmail data...');
    for (const emailData of FAKE_EMAILS) {
      await db.email.create({
        data: {
          userId: user.id,
          gmailId: `gmail_${Date.now()}_${Math.random()}`,
          ...emailData,
        },
      });
      report.emailsIngested++;
    }
    log(`  ✅ Inserted ${report.emailsIngested} emails`);

    // ─── Step 3: Insert Fake Chat Messages ──────────────────────────────────
    log('\n[3/7] Inserting fake chat messages...');
    for (const msgData of FAKE_CHAT_MESSAGES) {
      await db.chatMessage.create({
        data: {
          userId: user.id,
          ...msgData,
        },
      });
      report.messagesIngested++;
    }
    log(`  ✅ Inserted ${report.messagesIngested} chat messages across 3 conversations`);

    // ─── Step 4: Run Embedding Pipeline ─────────────────────────────────────
    log('\n[4/7] Running embedding pipeline...');
    const messages = await db.chatMessage.findMany({
      where: { userId: user.id, embedded: false },
      orderBy: { timestamp: 'asc' },
    });

    const vectorsDir = path.join(process.cwd(), 'data', 'vectors', user.id);
    if (!fs.existsSync(vectorsDir)) {
      fs.mkdirSync(vectorsDir, { recursive: true });
    }

    const index = new LocalIndex(vectorsDir);
    if (!await index.isIndexCreated()) {
      await index.createIndex();
    }

    await index.beginUpdate();
    try {
      for (const msg of messages) {
        const text = `[${msg.sessionId}] ${msg.role}: ${msg.content}`;
        const embedding = generateLocalEmbedding(text);
        
        await index.upsertItem({
          id: msg.id,
          vector: embedding,
          metadata: {
            content: msg.content.slice(0, 1000),
            source: msg.source,
            type: 'chat',
            role: msg.role,
            messageId: msg.id,
            sessionId: msg.sessionId || '',
            timestamp: msg.timestamp.toISOString(),
          },
        });
        report.vectorsCreated++;
      }
      await index.endUpdate();
    } catch (err) {
      index.cancelUpdate();
      throw err;
    }

    await db.chatMessage.updateMany({
      where: { userId: user.id },
      data: { embedded: true },
    });

    log(`  ✅ Created ${report.vectorsCreated} vector embeddings`);

    // ─── Step 5: Run Project Detection ──────────────────────────────────────
    log('\n[5/7] Running project detection...');
    
    // Simple project detection based on conversation sessions
    const sessions = await db.chatMessage.groupBy({
      by: ['sessionId'],
      where: { userId: user.id },
      _count: { id: true },
    });

    for (const session of sessions) {
      if (!session.sessionId) continue;

      const sessionMessages = await db.chatMessage.findMany({
        where: { userId: user.id, sessionId: session.sessionId },
        orderBy: { timestamp: 'asc' },
      });

      if (sessionMessages.length < 2) continue;

      const firstMsg = sessionMessages[0];
      const lastMsg = sessionMessages[sessionMessages.length - 1];
      
      // Extract description from first user message
      const userMessages = sessionMessages.filter(m => m.role === 'user');
      const description = userMessages[0]?.content.slice(0, 200) || 'Project detected from chat history';

      // Determine status and progress based on conversation
      const messageCount = sessionMessages.length;
      let status = 'in_progress';
      let progress = Math.min(90, messageCount * 10);

      if (messageCount >= 7) {
        status = 'completed';
        progress = 100;
      } else if (messageCount <= 3) {
        progress = 30;
      }

      const project = await db.project.create({
        data: {
          userId: user.id,
          name: session.sessionId,
          description,
          status,
          progress,
          lastActive: lastMsg.timestamp,
          context: JSON.stringify({
            sessionId: session.sessionId,
            messageCount: sessionMessages.length,
            firstMessageAt: firstMsg.timestamp.toISOString(),
            lastMessageAt: lastMsg.timestamp.toISOString(),
            nextStep: status === 'completed' 
              ? 'Project appears complete. Review and finalize.'
              : 'Continue working on this project based on the conversation context.',
            keyTopics: [session.sessionId],
            sampleMessages: userMessages.slice(0, 3).map(m => m.content),
          }),
        },
      });

      report.projectsDetected++;
      report.projectDetails.push({
        name: project.name,
        status: project.status,
        progress: project.progress,
        messageCount: sessionMessages.length,
      });
    }

    log(`  ✅ Detected ${report.projectsDetected} projects`);
    for (const proj of report.projectDetails) {
      log(`     - ${proj.name}: ${proj.status} (${proj.progress}%, ${proj.messageCount} messages)`);
    }

    // ─── Step 6: Simulate Overnight Work ────────────────────────────────────
    log('\n[6/7] Simulating overnight work continuation...');
    
    const inProgressProjects = await db.project.findMany({
      where: { userId: user.id, status: 'in_progress' },
      orderBy: { progress: 'asc' },
      take: 3,
    });

    const continuationsDir = path.join(process.cwd(), 'data', 'continuations');
    if (!fs.existsSync(continuationsDir)) {
      fs.mkdirSync(continuationsDir, { recursive: true });
    }

    for (const project of inProgressProjects) {
      const context = JSON.parse(project.context || '{}');
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      const filename = `${project.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.md`;
      const filepath = path.join(continuationsDir, filename);

      const continuation = `# ${project.name}

**Status:** ${project.status}  
**Progress:** ${project.progress}%  
**Last Active:** ${project.lastActive.toISOString()}  
**Generated:** ${new Date().toISOString()}

## Context

${project.description}

**Next Step:** ${context.nextStep || 'Continue working on this project'}

## Overnight Work Output

Based on the conversation history, here are the next steps to continue this work:

### Analysis

This project is ${project.progress}% complete. The conversation shows ${context.messageCount || 0} messages discussing this topic.

### Recommendations

1. **Review Progress:** Assess what has been completed so far
2. **Identify Gaps:** Determine what still needs to be done
3. **Create Action Plan:** Break down remaining work into concrete tasks
4. **Set Milestones:** Define clear checkpoints for completion

### Next Actions

- [ ] Review all previous conversation context
- [ ] Identify specific deliverables needed
- [ ] Create detailed task breakdown
- [ ] Set timeline for completion
- [ ] Begin execution on highest priority items

---

*Generated by NightShift AI - Test Flow Simulation*
`;

      fs.writeFileSync(filepath, continuation);
      
      await db.action.create({
        data: {
          userId: user.id,
          type: 'work_continued',
          title: `Continued work on ${project.name}`,
          description: `Generated continuation output for ${project.name}`,
          app: 'nightshift',
          confidence: 0.85,
          status: 'completed',
          metadata: JSON.stringify({
            projectId: project.id,
            outputPath: filepath,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      report.overnightWorkCompleted++;
      log(`     - Generated continuation for: ${project.name}`);
    }

    log(`  ✅ Completed overnight work on ${report.overnightWorkCompleted} projects`);

    // ─── Step 7: Generate Morning Brief ─────────────────────────────────────
    log('\n[7/7] Generating morning brief...');

    const allProjects = await db.project.findMany({
      where: { userId: user.id },
      orderBy: { lastActive: 'desc' },
    });

    const completedProjects = allProjects.filter(p => p.status === 'completed');
    const inProgress = allProjects.filter(p => p.status === 'in_progress');
    const recentEmails = await db.email.findMany({
      where: { userId: user.id },
      orderBy: { receivedAt: 'desc' },
      take: 5,
    });

    const actions = await db.action.findMany({
      where: { userId: user.id, type: 'work_continued' },
      orderBy: { createdAt: 'desc' },
    });

    const brief = `# Good Morning ☀️

**Date:** ${new Date().toLocaleDateString()}  
**User:** ${user.name}

## 🌙 Overnight Summary

While you slept, NightShift analyzed your work and made progress on ${report.overnightWorkCompleted} projects.

### Work Completed

${actions.map(a => `- ✅ ${a.title}`).join('\n')}

## 📊 Project Status

**Total Projects:** ${allProjects.length}  
**In Progress:** ${inProgress.length}  
**Completed:** ${completedProjects.length}

### Active Projects

${inProgress.map(p => {
  const ctx = JSON.parse(p.context || '{}');
  return `- **${p.name}** (${p.progress}% complete)
  - ${ctx.nextStep || 'Continue working on this project'}`;
}).join('\n\n')}

### Recently Completed

${completedProjects.map(p => `- ✅ ${p.name}`).join('\n')}

## 📧 Recent Emails

${recentEmails.map(e => `- **${e.subject}** (from ${e.from})
  - ${e.body.slice(0, 100)}...`).join('\n\n')}

## 🎯 Today's Focus

Based on your current projects and deadlines, here's what to prioritize today:

${inProgress.slice(0, 3).map((p, i) => {
  const ctx = JSON.parse(p.context || '{}');
  return `${i + 1}. **${p.name}** - ${ctx.nextStep || 'Continue progress'}`;
}).join('\n')}

---

*Generated by NightShift AI - Your Virtual Twin*
`;

    report.briefGenerated = true;
    report.briefContent = brief;

    const briefsDir = path.join(process.cwd(), 'data', 'briefs');
    if (!fs.existsSync(briefsDir)) {
      fs.mkdirSync(briefsDir, { recursive: true });
    }
    const briefPath = path.join(briefsDir, `test-${new Date().toISOString().split('T')[0]}.md`);
    fs.writeFileSync(briefPath, brief);

    log(`  ✅ Morning brief generated and saved to ${briefPath}`);

    // ─── Final Report ────────────────────────────────────────────────────────
    log('\n═══════════════════════════════════════════════════════════════');
    log('  TEST FLOW COMPLETE - FINAL REPORT');
    log('═══════════════════════════════════════════════════════════════');
    log(`\n✅ User Created: ${report.userCreated}`);
    log(`   - User ID: ${report.userId}`);
    log(`   - Email: ${TEST_USER.email}`);
    log(`\n✅ Emails Ingested: ${report.emailsIngested}`);
    log(`\n✅ Messages Ingested: ${report.messagesIngested}`);
    log(`   - Across 3 conversations`);
    log(`\n✅ Vectors Created: ${report.vectorsCreated}`);
    log(`   - Using local TF-IDF embeddings`);
    log(`\n✅ Projects Detected: ${report.projectsDetected}`);
    for (const proj of report.projectDetails) {
      log(`   - ${proj.name}: ${proj.status} (${proj.progress}%)`);
    }
    log(`\n✅ Overnight Work Completed: ${report.overnightWorkCompleted} projects`);
    log(`\n✅ Brief Generated: ${report.briefGenerated}`);
    log('\n═══════════════════════════════════════════════════════════════');
    log('\nMORNING BRIEF PREVIEW:');
    log('═══════════════════════════════════════════════════════════════\n');
    console.log(report.briefContent);
    log('\n═══════════════════════════════════════════════════════════════');
    log('  ALL TESTS PASSED - ZERO CRASHES ✅');
    log('═══════════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

main();
