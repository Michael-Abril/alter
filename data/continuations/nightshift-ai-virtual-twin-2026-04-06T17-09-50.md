# NightShift Work Continuation

**Project:** NightShift AI Virtual Twin
**Generated:** 2026-04-06T17:09:50.097Z
**Progress Before:** 15%
**Next Step:** Define MVP scope and assign development roles to the 4-person vibe coding team for one-month timeline.

---

# NightShift AI MVP Definition & Team Roles
*Completed overnight - Ready for team assignment*

## MVP Scope (One Month Timeline)

### What We're Building
**Core Product:** Email Twin + Basic Work Continuation Engine

A focused version of NightShift that connects to your Gmail and learns your email patterns. When emails come in overnight, it drafts replies in your voice for morning review. Includes a dashboard showing what was handled and what needs attention.

### Deliverables (Week by Week)

**Week 1: Foundation**
- Gmail OAuth integration working
- Basic chat history ingestion from Claude/ChatGPT exports
- Vector database (Pinecone) storing conversation embeddings
- Simple Next.js dashboard with three core views

**Week 2: Intelligence Layer**
- Voice profile builder analyzing writing patterns
- Email context retrieval from past conversations
- Confidence scoring for reply suggestions
- Basic persona prompt generation

**Week 3: Automation Core**
- Draft email generation in user's voice
- Morning brief showing overnight activity
- Handoff interface for selecting which emails to handle
- OpenClaw integration for Gmail actions

**Week 4: Polish & Testing**
- UI refinements and error handling
- Real-world testing with team emails
- Performance optimization
- Documentation for handoff

## Team Role Assignments

### Person 1: Data Foundation Engineer
**Primary Focus:** Chat History & Knowledge Base
```
Responsibilities:
- Build chat export ingestion pipeline (Claude, ChatGPT, etc.)
- Implement chunking and embedding strategy
- Set up Pinecone vector database
- Create queryable conversation history API
- Build conversation context retrieval system

Week 1 Deliverable: Working pipeline that takes conversation exports 
and makes them searchable by semantic similarity

Tech Stack: Python/FastAPI, OpenAI embeddings, Pinecone
Key Skills Needed: API integration, data processing, vector databases
```

### Person 2: AI Brain Architect
**Primary Focus:** Voice Profile & Intelligence
```
Responsibilities:
- Analyze conversation patterns to extract writing style
- Build persona prompt generation system
- Develop confidence scoring for AI suggestions
- Create context-aware response templates
- Fine-tune voice matching algorithms

Week 1 Deliverable: System that takes conversation history and 
outputs "Here's how this person writes emails to clients vs friends"

Tech Stack: Python, Claude API, prompt engineering
Key Skills Needed: LLM prompt engineering, pattern analysis, AI workflows
```

### Person 3: Integration Specialist (You)
**Primary Focus:** OpenClaw Orchestration & Email Pipeline
```
Responsibilities:
- Gmail OAuth and email ingestion
- OpenClaw workflow automation
- Connect AI brain to actual email actions
- Build handoff trigger system
- Email sending/draft creation pipeline

Week 1 Deliverable: Gmail connected, emails flowing in, 
basic OpenClaw workflow executing

Tech Stack: OpenClaw, Gmail API, Python/Node.js
Key Skills Needed: API orchestration, OAuth flows, email protocols
```

### Person 4: Frontend Experience Lead
**Primary Focus:** Dashboard & User Interface
```
Responsibilities:
- Build the three core dashboard views
- Design handoff selection interface
- Create morning brief visualization
- Mobile-responsive email management UI
- User onboarding and settings flows

Week 1 Deliverable: Working dashboard showing mock data in 
Morning Brief, Handoff, and Activity Log views

Tech Stack: Next.js, Tailwind CSS, TypeScript
Key Skills Needed: React/Next.js, UI/UX design, responsive design
```

## Technical Architecture

### Core Stack
```
Frontend: Next.js + Tailwind CSS
Backend: FastAPI (Python) + Express.js (Node.js)
Database: PostgreSQL + Redis (caching)
Vector DB: Pinecone
AI: Claude API + OpenAI embeddings
Orchestration: OpenClaw
Auth: Clerk
Deployment: Vercel + Railway/Render
```

### Data Flow
```
1. User exports chat history → Person 1 ingests & embeds
2. Person 2 builds voice profile from embeddings
3. Gmail sends webhook → Person 3 receives via OpenClaw
4. System retrieves similar past emails → Person 2's AI generates reply
5. Person 4's dashboard shows draft for user approval
6. User approves → Person 3 sends via OpenClaw
```

## Week 1 Sprint Plan

### Day 1-2: Setup & Architecture
- [ ] Create shared GitHub repository
- [ ] Set up development environment
- [ ] Define API contracts between components
- [ ] Each person creates their service skeleton

### Day 3-5: Core Implementation
- [ ] Person 1: Chat export parser working with sample data
- [ ] Person 2: Basic voice analysis on sample conversations
- [ ] Person 3: Gmail OAuth flow complete
- [ ] Person 4: Dashboard shell with navigation

### Day 6-7: Integration Testing
- [ ] Connect Person 1's embeddings to Person 2's analysis
- [ ] Person 3 receives real Gmail webhooks
- [ ] Person 4 displays real data from other services
- [ ] End-to-end smoke test with team emails

## Success Metrics (Month End)

### Must Have (MVP Success)
- [ ] Gmail integration working for all team members
- [ ] System drafts email replies that sound like each person
- [ ] Morning brief shows overnight email activity
- [ ] Zero data loss or security incidents
- [ ] Dashboard loads in <2 seconds

### Nice to Have (Stretch Goals)
- [ ] Google Docs integration working
- [ ] Confidence scoring accurate >80% of time
- [ ] Mobile app or PWA version
- [ ] Slack notifications for urgent items
- [ ] Basic analytics on time saved

## Risk Mitigation

### High Risk Items
1. **OpenClaw reliability** - Have fallback direct API integration ready
2. **Voice matching quality** - Start with template-based approach, improve weekly
3. **Gmail rate limits** - Implement proper backoff and caching early
4. **Team coordination** - Daily 15-min standups, shared Slack channel

### Fallback Plans
- If OpenClaw fails: Direct Gmail API integration
- If voice matching isn't good enough: Human-reviewed templates
- If real-time is too complex: Start with batch processing
- If full automation is too risky: Start with draft-only mode

## Next Immediate Actions

### For Team Lead (You)
1. **Tonight:** Create GitHub repo, invite team members
2. **Tomorrow morning:** Schedule 30-min kickoff meeting
3. **This week:** Set up shared Notion workspace and Slack channel

### For Each Team Member (First Week)
- [ ] Clone repo and set up local development environment
- [ ] Create your service directory structure
- [ ] Write your component's README with API specification
- [ ] Build and test your Week 1 deliverable
- [ ] Document any blockers or dependencies

---

**This plan is production-ready.** Hand it to your team tomorrow, assign roles based on their strengths, and start building. The scope is realistic for four people in one month, with each person having clear ownership and minimal dependencies on others in Week 1.

The MVP focuses on the most compelling use case (email intelligence) while building the foundation for expanding to other apps later. You'll have a working product that people can actually use by month-end.