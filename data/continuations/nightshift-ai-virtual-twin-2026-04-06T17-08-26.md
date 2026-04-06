# NightShift Work Continuation

**Project:** NightShift AI Virtual Twin
**Generated:** 2026-04-06T17:08:26.431Z
**Progress Before:** 15%
**Next Step:** Define MVP scope and assign development roles to the 4-person vibe coding team for one-month timeline.

---

# NightShift AI MVP Definition & Team Assignment

Based on your conversation history, I've analyzed where you left off and prepared the complete MVP scope and development roles for your 4-person team. Here's your ready-to-implement plan:

## MVP Scope (Final)

**Core Product:** Email continuation engine that learns your writing style and handles incoming emails while you sleep.

### What Ships in Month 1:
1. **Gmail Integration**: OAuth connection, email ingestion, draft composition
2. **Voice Learning**: Analysis of your email history to capture tone, style, decision patterns
3. **Smart Drafting**: AI-powered replies that sound like you based on email context
4. **Review Dashboard**: Morning brief showing drafts created, approval/edit interface
5. **Safety Rails**: Confidence scoring, auto-send only for high-confidence replies

### What Doesn't Ship (Phase 2):
- Multi-app integration (Docs, Notion, Slack, Stripe)
- Screen watching/app state detection  
- Complex workflow automation
- OpenClaw orchestration beyond email

## Development Team Roles & Assignments

### Person 1: Data Pipeline Engineer
**Owner:** [Assign to your strongest backend person]
**Timeline:** Weeks 1-2 (critical path)

**Responsibilities:**
- Build chat history ingestion pipeline (Claude/ChatGPT exports)
- Set up vector database (Pinecone) with embeddings
- Create email history import from Gmail API
- Build chunking and embedding logic for context retrieval

**Deliverables:**
- Functional vector DB with user's conversation/email history
- API endpoints for similarity search and context retrieval
- Data pipeline that processes new emails automatically

**Technical Stack:**
- FastAPI/Express backend
- OpenAI embeddings API
- Pinecone vector database
- Gmail API integration

---

### Person 2: AI Voice Profile Builder  
**Owner:** [Assign to person comfortable with prompt engineering]
**Timeline:** Weeks 1-3 (can start with mock data)

**Responsibilities:**
- Analyze email patterns to extract writing style
- Build persona prompt templates for different contexts (clients, team, vendors)
- Create confidence scoring system for draft quality
- Develop the "voice cloning" logic using retrieved context

**Deliverables:**
- Persona model that generates emails in user's voice
- Context-aware prompting system
- Confidence scoring algorithm (0-100%)
- A/B testing framework for voice accuracy

**Technical Stack:**
- Claude/GPT API integration
- Prompt engineering and testing
- Email analysis algorithms
- JSON-based persona storage

---

### Person 3: Email Integration & Workflow
**Owner:** [Assign to person good with APIs and OAuth]
**Timeline:** Weeks 2-4 (depends on Person 1's pipeline)

**Responsibilities:**
- Gmail OAuth setup and permissions
- Real-time email monitoring and triggers
- Draft generation pipeline connecting Person 1 + Person 2's work
- Send/schedule functionality with safety checks

**Deliverables:**
- Complete Gmail integration (read/write/send)
- Automated email monitoring system
- Draft creation workflow end-to-end
- Email sending with confidence thresholds

**Technical Stack:**
- Gmail API (full access)
- OAuth 2.0 flow
- Webhook/polling for new emails
- Queue system for processing

---

### Person 4: Frontend Dashboard (You)
**Owner:** You (best fit for your visual thinking + shipping speed)
**Timeline:** Weeks 2-4 (can mock with fake data initially)

**Responsibilities:**
- Build the three-tab dashboard you already designed
- Create email review and approval interface
- Design onboarding flow for Gmail connection
- Build morning brief with activity summaries

**Deliverables:**
- Complete React/Next.js dashboard
- Mobile-responsive email review interface  
- Onboarding wizard for new users
- Real-time notifications for drafts needing review

**Technical Stack:**
- Next.js + Tailwind CSS
- Real-time updates (WebSocket/polling)
- Responsive design for mobile review
- Integration with backend APIs

## Technical Architecture

```
User's Gmail ←→ Person 3 (Email API) ←→ Person 1 (Vector DB) ←→ Person 2 (AI Voice) ←→ Person 4 (Dashboard)
```

**Data Flow:**
1. New email arrives → Person 3 detects it
2. Person 3 queries Person 1's vector DB for similar past emails/context  
3. Person 2's voice model generates draft using retrieved context
4. Person 4's dashboard shows draft for review
5. User approves/edits → Person 3 sends email

## Week-by-Week Milestones

### Week 1: Foundation
- **Person 1**: Vector DB setup, basic embedding pipeline
- **Person 2**: Email style analysis, initial persona prompts
- **Person 3**: Gmail OAuth and basic read functionality  
- **Person 4**: Dashboard wireframes and component structure

### Week 2: Integration
- **Person 1**: Full chat history ingested, similarity search working
- **Person 2**: Voice model generating coherent drafts with mock data
- **Person 3**: End-to-end email workflow (detect → retrieve → generate)
- **Person 4**: Dashboard connected to backend, showing real drafts

### Week 3: Polish  
- **Person 1**: Performance optimization, error handling
- **Person 2**: Confidence scoring, voice quality improvements
- **Person 3**: Safety rails, send controls, edge case handling
- **Person 4**: Mobile optimization, notification system

### Week 4: Launch Prep
- **Everyone**: Integration testing, bug fixes, demo preparation
- **Person 4**: Onboarding flow, documentation, marketing site

## Success Criteria

**Must Have (Launch Blockers):**
- User can connect Gmail and import email history
- System generates drafts that sound like the user
- User can review and send drafts from dashboard
- Confidence scoring prevents bad emails from being sent

**Nice to Have:**
- Auto-send for high-confidence replies (>85%)
- Mobile notifications for urgent drafts
- Multiple email account support
- Export/backup functionality

## Repository Setup

Create this structure immediately:
```
nightshift-ai/
├── backend/          (Person 1 + 3)
├── ai-models/        (Person 2) 
├── frontend/         (Person 4)
├── docs/             (shared)
└── README.md
```

## Next Actions for Tomorrow

1. **Create GitHub repo** and invite all team members
2. **Schedule kickoff meeting** - 30 minutes max
3. **Set up Slack/Discord** for daily updates  
4. **Person assignments** - confirm who takes which role
5. **Week 1 sprint planning** - specific tasks for each person

This is your ready-to-execute plan. The scope is realistic for vibe coders, the roles play to different strengths, and you'll have a working product people will pay for in 30 days.

Ready to assign roles and kick off development?