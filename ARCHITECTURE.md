# NightShift AI / Alter - Architecture Overview

## What is Alter?

Alter is an AI "digital twin" that learns your work patterns, communication style, and preferences, then autonomously continues your work while you sleep. It's like having a replica of yourself that can:

- Draft emails in your voice
- Continue coding projects
- Process tasks from your handoff queue
- Prepare a morning brief of what was accomplished

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Dashboard  │  │   Handoff   │  │   Drafts    │  │      Settings       │ │
│  │  (Brief +   │  │  (Queue +   │  │  (Review +  │  │  (Connections +     │ │
│  │  Activity)  │  │  Submit)    │  │  Approve)   │  │   Preferences)      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEXT.JS API LAYER                                  │
│  /api/brief      /api/handoff     /api/drafts      /api/actions             │
│  /api/projects   /api/chat-history /api/gmail/*    /api/daemon/*            │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌─────────────────────────┐ ┌─────────────┐ ┌─────────────────────────────────┐
│   ORCHESTRATION LAYER   │ │   AI LAYER  │ │        DATA LAYER               │
│   (Node.js Scripts)     │ │             │ │                                 │
│  ┌───────────────────┐  │ │ ┌─────────┐ │ │  ┌────────────┐  ┌───────────┐  │
│  │ overnight-loop    │  │ │ │Akash ML │ │ │  │  Prisma    │  │   Vectra  │  │
│  │ continue-work     │──┼─┼▶│   or    │ │ │  │  (SQLite/  │  │  (Vector  │  │
│  │ draft-email       │  │ │ │Anthropic│ │ │  │  Postgres) │  │   Store)  │  │
│  │ nightshift-daemon │  │ │ └─────────┘ │ │  └────────────┘  └───────────┘  │
│  └───────────────────┘  │ └─────────────┘ └─────────────────────────────────┘
└─────────────────────────┘
```

## Directory Structure

```
nightshift-ai/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── dashboard/          # Main dashboard UI
│   │   │   ├── page.tsx        # Dashboard home (morning brief)
│   │   │   ├── activity/       # Activity feed
│   │   │   ├── drafts/         # Draft review
│   │   │   ├── handoff/        # Handoff queue
│   │   │   └── settings/       # User settings
│   │   ├── api/                # API routes
│   │   │   ├── actions/        # Action logging
│   │   │   ├── brief/          # Morning brief generation
│   │   │   ├── chat-history/   # Chat history management
│   │   │   ├── daemon/         # Daemon control
│   │   │   ├── drafts/         # Draft management
│   │   │   ├── gmail/          # Gmail OAuth + sync
│   │   │   ├── handoff/        # Handoff queue
│   │   │   └── projects/       # Project detection
│   │   └── (auth)/             # Auth pages (sign-in, sign-up)
│   ├── lib/                    # Shared utilities
│   │   ├── clerk-user.ts       # User resolution from Clerk
│   │   ├── db.ts               # Prisma client
│   │   ├── openclaw-client.ts  # AI client (Akash ML → Anthropic fallback)
│   │   ├── voice-profile-builder.ts  # Voice profile extraction
│   │   └── morning-brief-haiku.ts    # Brief narrative generation
│   ├── components/             # React components
│   └── types/                  # TypeScript types
├── orchestration/              # Background processing scripts
│   ├── lib/
│   │   └── ai-client.mjs       # **Main AI client** (Akash ML → Anthropic)
│   ├── overnight-loop.mjs      # Main overnight processing
│   ├── continue-work.mjs       # Work continuation logic
│   ├── draft-email.mjs         # Email draft generation
│   ├── nightshift-daemon.mjs   # Daemon process
│   └── user-resolver.mjs       # User ID resolution
├── prisma/
│   └── schema.prisma           # Database schema
├── docs/                       # Documentation
├── data/                       # Runtime data
│   ├── briefs/                 # Generated briefs
│   ├── continuations/          # Work continuation outputs
│   └── logs/                   # Daemon logs
└── scripts/                    # Utility scripts
```

## AI Client Architecture

The system uses **Akash ML API** as the primary AI provider with Anthropic as fallback:

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI REQUEST                                │
│  (system prompt + user prompt + max_tokens + temperature)       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                   ┌────────────────┐
                   │ Is Akash ML    │
                   │ configured?    │
                   └────────┬───────┘
                            │
              ┌─────────────┴─────────────┐
              │ YES                       │ NO
              ▼                           ▼
     ┌─────────────────┐         ┌─────────────────┐
     │ Call Akash ML   │         │ Use Anthropic   │
     │ api.akashml.com │         │ Directly        │
     └────────┬────────┘         └─────────────────┘
              │
              │ SUCCESS?
              │
     ┌────────┴────────┐
     │ YES             │ NO
     ▼                 ▼
┌──────────┐   ┌─────────────────┐
│ Return   │   │ Log warning,    │
│ response │   │ fallback to     │
└──────────┘   │ Anthropic       │
               └─────────────────┘
```

### Akash ML Models

| Model | Use Case | Cost (per M tokens) |
|-------|----------|---------------------|
| `meta-llama/Llama-3.3-70B-Instruct` | **Default** - Fast, general purpose | $0.13 in / $0.40 out |
| `deepseek-ai/DeepSeek-V3.2` | Complex reasoning | $0.28 in / $0.42 out |
| `Qwen/Qwen2.5-72B-Instruct` | Alternative | $0.13 in / $0.40 out |

**Cost comparison**: Akash ML is ~10-50x cheaper than Anthropic ($3-15/M tokens)

### AI Client Files

| Location | File | Purpose |
|----------|------|---------|
| Orchestration | `orchestration/lib/ai-client.mjs` | Background scripts (overnight loop, daemon) |
| Next.js API | `src/lib/openclaw-client.ts` | API routes (to be updated) |

## Data Flow: Overnight Loop

```
1. User submits handoff (or daemon auto-selects projects)
   └─▶ /api/handoff POST

2. Daemon triggers overnight loop at bedtime
   └─▶ orchestration/overnight-loop.mjs

3. For each project:
   ├─▶ Fetch project context from vector DB
   ├─▶ Call AI (Akash ML primary, Anthropic fallback)
   ├─▶ Save output to /data/continuations/
   └─▶ Log action to database

4. Morning brief generated at wake time
   ├─▶ Aggregate all overnight actions
   ├─▶ Call AI to generate natural narrative
   └─▶ Display on dashboard + optional email
```

## Key Database Models (Prisma)

```prisma
model User {
  id              String    @id @default(cuid())
  clerkId         String    @unique
  email           String
  wakeTime        String?   // e.g., "07:00"
  voiceProfile    VoiceProfile?
  projects        Project[]
  actions         Action[]
  drafts          Draft[]
  chatMessages    ChatMessage[]
}

model Project {
  id              String    @id @default(cuid())
  title           String
  classification  String    // academic, code, document, etc.
  priority        Int?
  status          String    // active, completed, archived
}

model Action {
  id              String    @id @default(cuid())
  type            String    // email_sent, doc_edited, task_completed
  title           String
  status          String    // completed, flagged
  confidence      Float?
}

model Draft {
  id              String    @id @default(cuid())
  type            String    // email, document
  content         String
  status          String    // pending, approved, sent
}

model VoiceProfile {
  id              String    @id @default(cuid())
  systemPrompt    String    // Generated prompt for AI to match voice
  avgSentenceLen  Float
  formalityScore  Float
  toneKeywords    String    // JSON array
}
```

## Environment Variables

Critical variables for operation:

| Variable | Required | Purpose |
|----------|----------|---------|
| `CLERK_SECRET_KEY` | Yes | Authentication |
| `DATABASE_URL` | Yes | Database connection |
| `AKASH_ML_API_KEY` | Yes* | Primary AI (cheap inference) |
| `ANTHROPIC_API_KEY` | No* | Fallback AI (higher quality) |

*At least one AI provider must be configured.

See `.env.example` for full list with descriptions.

## Running the System

### Development
```bash
npm run dev                 # Start Next.js dev server
```

### Daemon (Autonomous Mode)
```bash
# Production
node orchestration/nightshift-daemon.mjs

# Test mode (compressed schedule)
node orchestration/nightshift-daemon.mjs --test
```

### Key Endpoints
- `GET /api/brief` - Morning brief
- `GET/POST /api/handoff` - Handoff queue
- `GET /api/actions` - Activity feed
- `GET /api/drafts` - Draft review
- `GET /api/daemon/status` - Daemon status

## Troubleshooting

### "Handoff completes instantly with nothing done"
- Check `orchestration/overnight-loop.mjs` API response parsing
- Verify projects exist in database

### "Empty Activity page"
- Actions are created by orchestration scripts
- Check daemon logs in `/data/logs/`

### "AI not working"
- Verify `AKASH_ML_API_KEY` in `.env`
- Check logs for "[ai-client] Akash ML failed" messages
- System will fallback to Anthropic if Akash ML fails

### "Voice profile not matching"
- Ensure user has enough chat history (10+ messages)
- Run voice profile rebuild from Settings
