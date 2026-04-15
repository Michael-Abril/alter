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
│  │ overnight-loop    │  │ │ │OpenClaw │ │ │  │  Prisma    │  │   Vectra  │  │
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
│   │   ├── openclaw-client.ts  # OpenClaw API client (with Anthropic fallback)
│   │   ├── voice-profile-builder.ts  # Voice profile extraction
│   │   └── morning-brief-haiku.ts    # Brief narrative generation
│   ├── components/             # React components
│   └── types/                  # TypeScript types
├── orchestration/              # Background processing scripts
│   ├── lib/
│   │   └── ai-client.mjs       # Shared AI client (OpenClaw → Anthropic)
│   ├── overnight-loop.mjs      # Main overnight processing
│   ├── continue-work.mjs       # Work continuation logic
│   ├── draft-email.mjs         # Email draft generation
│   ├── nightshift-daemon.mjs   # Daemon process
│   └── user-resolver.mjs       # User ID resolution
├── prisma/
│   └── schema.prisma           # Database schema
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md         # This file
│   ├── DAEMON.md               # Daemon documentation
│   ├── PERSON1_BACKEND.md      # Backend owner guide
│   ├── PERSON2_VECTORS.md      # Vector/embedding guide
│   ├── PERSON3_OPENCLAW.md     # OpenClaw integration guide
│   └── PERSON4_VOICE_UI.md     # Voice/UI guide
├── data/                       # Runtime data
│   ├── briefs/                 # Generated briefs
│   ├── continuations/          # Work continuation outputs
│   └── logs/                   # Daemon logs
└── scripts/                    # Utility scripts
```

## AI Client Architecture

The system uses a dual AI client pattern for reliability:

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI REQUEST                                │
│  (system prompt + user prompt + max_tokens)                     │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                   ┌────────────────┐
                   │ Is OpenClaw    │
                   │ configured?    │
                   └────────┬───────┘
                            │
              ┌─────────────┴─────────────┐
              │ YES                       │ NO
              ▼                           ▼
     ┌─────────────────┐         ┌─────────────────┐
     │ Try OpenClaw    │         │ Use Anthropic   │
     │ API Call        │         │ Directly        │
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

### Two AI Clients

| Location | File | Purpose |
|----------|------|---------|
| Next.js API | `src/lib/openclaw-client.ts` | API routes use this |
| Orchestration | `orchestration/lib/ai-client.mjs` | Background scripts use this |

Both implement the same OpenClaw → Anthropic fallback pattern.

## Data Flow: Overnight Loop

```
1. User submits handoff (or daemon auto-selects projects)
   └─▶ /api/handoff POST

2. Daemon triggers overnight loop at bedtime
   └─▶ orchestration/overnight-loop.mjs

3. For each project:
   ├─▶ Fetch project context from vector DB
   ├─▶ Call AI (OpenClaw or Anthropic) to continue work
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
| `ANTHROPIC_API_KEY` | Yes* | AI calls |
| `OPENCLAW_API_URL` | No* | OpenClaw API endpoint |
| `OPENCLAW_GATEWAY_PASSWORD` | No* | OpenClaw auth |

*Either Anthropic or OpenClaw must be configured.

See `.env.example` for full list with descriptions.

## OpenClaw Integration Status

**Current Status**: In Progress

OpenClaw is an external AI orchestration service. The integration:
- ✅ Shared AI client created (`orchestration/lib/ai-client.mjs`)
- ✅ Fallback to Anthropic when OpenClaw unavailable
- ⏳ Full OpenClaw workflow integration (Royce)

**For Royce**: See `docs/PERSON3_OPENCLAW.md` for detailed integration guide.

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
- `GET /api/internal/dev/consistency` - Unified priority + metadata consistency checks (dev)

### Consistency Guardrails

NightShift includes a dev consistency checker used in QA and beta hardening:
- Focus list cap and handoff list cap enforcement
- Focus/Handoff overlap detection
- Suggested automation block count sanity
- Native destination metadata schema checks on Action/Draft JSON (`externalUrl`, `provider`, `kind`)

CLI:
```bash
npm run consistency:check
```

## Troubleshooting

### "Handoff completes instantly with nothing done"
- Check `orchestration/overnight-loop.mjs` API response parsing
- Verify projects exist in database

### "Empty Activity page"
- Actions are created by orchestration scripts
- Check daemon logs in `/data/logs/`

### "OpenClaw not working"
- Verify `OPENCLAW_API_URL` and `OPENCLAW_GATEWAY_PASSWORD` in `.env`
- System will fallback to Anthropic if OpenClaw fails
- Check logs for "[ai-client] OpenClaw failed" messages

### "Voice profile not matching"
- Ensure user has enough chat history (10+ messages)
- Run voice profile rebuild from Settings
