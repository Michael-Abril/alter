# NightShift Work Continuation

**Project:** NightShift AI Virtual Twin
**Generated:** 2026-04-06T17:00:14.178Z
**Progress Before:** 15%
**Next Step:** Define MVP scope and assign development roles to the 4-person vibe coding team for one-month timeline.

---

# NightShift AI MVP Development Plan & Role Assignments

Based on your conversation history, I'm defining the MVP scope and assigning specific roles to your 4-person team for the one-month timeline. You're right that this needs to be realistic for vibe coders while still delivering something people will pay for.

## MVP Scope Definition

### What We're Building (Month 1)
**Core Product**: Gmail-first work continuation engine that learns your voice and completes email tasks overnight.

**Specific Features**:
1. **Gmail Integration**: OAuth connection, email ingestion, real-time monitoring
2. **Voice Learning**: Analyze your sent emails to build a writing style profile  
3. **Context Awareness**: Understand email threads, relationships, and patterns
4. **Draft Generation**: Create replies that sound like you for incoming emails
5. **Approval Workflow**: Morning dashboard showing drafts for review/send
6. **Night Handoff**: Evening interface to select what emails to handle overnight
7. **Activity Logging**: Track what was processed and confidence scores

### What We're NOT Building (Month 1)
- Multi-app integration (Notion, Slack, etc.)
- Auto-sending without approval
- Complex confidence scoring with auditor models
- Screen watching/computer monitoring
- Shopify or e-commerce automation

## Team Role Assignments

### Person 1: Data Foundation Engineer
**Primary Responsibility**: Email data ingestion and voice profile building

**Specific Tasks**:
- Gmail API integration and OAuth setup
- Email parsing and conversation threading
- Sent email analysis for voice pattern extraction
- Basic embeddings generation for style matching
- Database schema for storing email data and profiles

**Deliverables**:
- Working Gmail connection that pulls email history
- Voice profile generator that analyzes writing style
- Database populated with user's email patterns
- API endpoints for querying voice characteristics

**Success Metric**: Given a user's Gmail, can extract and query their writing patterns

---

### Person 2: Intelligence Engine Developer  
**Primary Responsibility**: Context understanding and draft generation

**Specific Tasks**:
- Thread context analysis (understanding email conversations)
- Relationship mapping (who is this person, what's our history)
- Draft generation using voice profile from Person 1
- Priority scoring (which emails need responses first)
- Integration with Claude API for text generation

**Deliverables**:
- Context analyzer that understands email relationships
- Draft generator that creates replies in user's voice
- Priority engine that identifies important emails
- Integration layer with LLM APIs

**Success Metric**: Given an incoming email and user profile, generates a contextually appropriate draft reply

---

### Person 3: Integration & Orchestration Lead
**Primary Responsibility**: Connecting all the pieces and handling the automation workflow

**Specific Tasks**:
- Email monitoring system (detecting new emails)
- Workflow orchestration (when to generate drafts, when to notify user)
- OpenClaw integration for reliable automation
- Notification system and error handling
- Background processing and queue management

**Deliverables**:
- Real-time email monitoring system
- Automated workflow that processes emails overnight
- Error handling and logging system
- OpenClaw workflows for reliable execution

**Success Metric**: System runs overnight, processes new emails, and presents results in the morning without manual intervention

---

### Person 4: User Experience & Interface Designer
**Primary Responsibility**: Frontend dashboard and user interaction flows

**Specific Tasks**:
- Morning Brief dashboard (show overnight activity)
- Tonight's Handoff interface (select emails to process)
- Draft review and approval interface
- Activity log and settings pages
- Mobile-responsive design with dark mode

**Deliverables**:
- Complete React/Next.js frontend with Tailwind CSS
- Three main dashboard views (Morning, Evening, Activity)
- Approval workflow for draft emails
- Settings and configuration interface

**Success Metric**: Users can easily review overnight work and approve/edit drafts through an intuitive interface

## Technical Architecture

### Core Stack
- **Frontend**: Next.js + Tailwind CSS + TypeScript
- **Backend**: FastAPI (Python) or Express.js (Node)
- **Database**: PostgreSQL for structured data, Redis for caching
- **Vector DB**: Pinecone for voice profile embeddings
- **LLM**: Claude API for draft generation
- **Email**: Gmail API with OAuth 2.0
- **Orchestration**: OpenClaw for workflow reliability
- **Auth**: Clerk for user management

### Data Flow
1. User connects Gmail → Person 1 ingests email history
2. Person 1 builds voice profile → Person 2 uses for context analysis
3. Person 3 monitors for new emails → triggers Person 2's draft generation
4. Person 4's dashboard displays drafts → user reviews and approves
5. Person 3 sends approved emails → logs activity

## Development Timeline (4 Weeks)

### Week 1: Foundation
- Person 1: Gmail API connection and basic email ingestion
- Person 2: Start voice analysis with mock data
- Person 3: Basic email monitoring setup
- Person 4: Core dashboard components

### Week 2: Integration
- Person 1: Voice profile generation working
- Person 2: Draft generation with Claude API
- Person 3: Workflow orchestration between components  
- Person 4: Complete dashboard with real data

### Week 3: Polish & Testing
- All: Integration testing and bug fixes
- Person 4: UI polish and mobile responsiveness
- Person 3: Error handling and reliability improvements
- Person 2: Draft quality improvements

### Week 4: Launch Prep
- All: End-to-end testing with real Gmail accounts
- Documentation and deployment setup
- Security review and OAuth approval process
- Performance optimization

## Success Metrics for MVP

**User Journey Success**: 
1. User connects Gmail ✓
2. System learns their voice overnight ✓
3. New email arrives ✓
4. Draft generated in their style ✓
5. User approves and sends ✓

**Technical Success**:
- Processes 100+ emails without breaking
- 80%+ draft approval rate (user accepts without major edits)
- <5 second response time for dashboard loads
- 99%+ uptime during overnight processing

## Next Immediate Actions

1. **Set up shared infrastructure** (this week):
   - Create GitHub repo: `nightshift-mvp`
   - Set up development environments
   - Create shared Notion workspace for task tracking
   - Set up staging environment on Vercel/Railway

2. **Week 1 kickoff** (assign today):
   - Person 1: Start Gmail API integration
   - Person 2: Research voice analysis approaches  
   - Person 3: Design system architecture
   - Person 4: Create initial dashboard mockups

3. **Daily standups**: 15-minute check-ins to unblock dependencies

This is a realistic, shippable MVP that will prove the core value proposition: an AI that continues your work while you sleep. The Gmail-first approach gives you a clear user journey and a product people will immediately understand and want to pay for.

Ready to assign these roles and start building?