# NightShift AI

> **Work While You Sleep** — NightShift learns how you work, then continues your work while you sleep.

NightShift AI connects to your Gmail and chat history, builds a voice profile of how you write, detects unfinished work, and autonomously completes tasks overnight — all in your voice and style.

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL database (local or hosted)
- Pinecone account (free tier works)
- Clerk account (free tier works)
- API keys: Anthropic (Claude), OpenAI

### 1. Clone and Install

```bash
git clone <repo-url>
cd nightshift-ai
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Fill in all values in `.env`. See `.env.example` for the full list.

**Required for local dev:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` — from [Clerk Dashboard](https://dashboard.clerk.com)
- `DATABASE_URL` — PostgreSQL connection string
- `ANTHROPIC_API_KEY` — from [Anthropic Console](https://console.anthropic.com)
- `OPENAI_API_KEY` — from [OpenAI Platform](https://platform.openai.com)
- `PINECONE_API_KEY` — from [Pinecone Console](https://app.pinecone.io)

### 3. Database Setup

```bash
npx prisma generate
npx prisma db push
```

### 4. Run Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Auth | Clerk |
| Database | PostgreSQL + Prisma ORM |
| Vector DB | Pinecone |
| LLM | Claude API (Anthropic) |
| Embeddings | OpenAI text-embedding-3-small |
| Orchestration | OpenClaw (external) |
| Styling | Tailwind CSS |
| Deployment | Vercel (frontend) + Railway (backend/DB) |

---

## Project Structure

```
nightshift-ai/
├── prisma/schema.prisma          # Database schema
├── src/
│   ├── app/                      # Next.js App Router pages + API routes
│   │   ├── api/                  # All API endpoints
│   │   ├── dashboard/            # Dashboard pages (brief, handoff, activity, settings)
│   │   ├── onboarding/           # Post-signup onboarding flow
│   │   ├── sign-in/              # Clerk sign-in
│   │   └── sign-up/              # Clerk sign-up
│   ├── components/               # React components
│   │   ├── layout/               # Sidebar, Header
│   │   ├── brief/                # Morning brief components
│   │   ├── handoff/              # Handoff components
│   │   ├── drafts/               # Draft review components
│   │   └── shared/               # Shared UI components
│   ├── lib/                      # Core business logic
│   │   ├── db.ts                 # Prisma client
│   │   ├── pinecone.ts           # Vector DB client
│   │   ├── claude.ts             # Claude API wrapper
│   │   ├── embeddings.ts         # Embedding generation
│   │   ├── gmail.ts              # Gmail API helpers
│   │   ├── confidence.ts         # Confidence scoring
│   │   ├── persona.ts            # Voice profile builder
│   │   └── utils.ts              # Shared utilities
│   └── types/index.ts            # TypeScript type definitions
└── docs/                         # Per-person build instructions
    ├── PERSON1_BACKEND.md
    ├── PERSON2_VECTORS.md
    ├── PERSON3_OPENCLAW.md
    └── PERSON4_VOICE_UI.md
```

---

## Team Assignments

| Person | Role | Key Files |
|--------|------|-----------|
| Person 1 | Backend | `/api/auth/`, `/api/gmail/`, `/api/chat-history/ingest`, `lib/db.ts`, `lib/gmail.ts` |
| Person 2 | Vectors | `/api/embeddings/`, `/api/projects/`, `lib/pinecone.ts`, `lib/embeddings.ts` |
| Person 3 (Royce) | OpenClaw | `/api/chat-history/` (GET), `/api/actions/`, `/api/brief/`, `/api/handoff/` |
| Person 4 | Voice/UI | `/components/`, `/dashboard/`, `/onboarding/`, `lib/persona.ts`, `lib/claude.ts`, `lib/confidence.ts` |

See `docs/` for detailed instructions for each person.

---

## API Endpoints

All endpoints return `{ success: boolean, data?: T, error?: string }`.

| Method | Path | Owner | Description |
|--------|------|-------|-------------|
| POST | `/api/auth/webhook` | P1 | Clerk user creation webhook |
| GET | `/api/gmail/connect` | P1 | Initiate Gmail OAuth |
| GET | `/api/gmail/callback` | P1 | Gmail OAuth callback |
| GET/POST | `/api/gmail/emails` | P1 | Fetch/pull emails |
| POST | `/api/chat-history/ingest` | P1/P3 | Receive scraped chat history |
| GET | `/api/chat-history` | P3 | Return stored chat history |
| POST | `/api/embeddings/process` | P2 | Trigger embedding pipeline |
| POST | `/api/embeddings/query` | P2 | Query vector DB |
| GET | `/api/projects` | P2 | Detected active projects |
| POST | `/api/drafts/generate` | P4 | Generate a draft |
| GET | `/api/drafts` | P4 | List pending drafts |
| GET/PATCH | `/api/drafts/[id]` | P4 | View/approve/reject draft |
| GET | `/api/brief` | P3 | Morning brief |
| GET/POST | `/api/handoff` | P3 | Unfinished tasks / submit handoff |
| POST | `/api/actions` | P3 | Report completed actions |

---

## Development Notes

- All API routes return **mock data** by default so frontend can be built in parallel
- Mock data is realistic and matches the TypeScript types in `src/types/index.ts`
- Replace mock data with real implementations as each feature is completed
- All lint errors about missing modules resolve after `npm install`
- Database schema changes require `npx prisma db push` and `npx prisma generate`

---

## Deployment

### Frontend (Vercel)
1. Connect repo to Vercel
2. Set all env vars in Vercel dashboard
3. Deploy — Vercel auto-detects Next.js

### Backend/DB (Railway)
1. Create PostgreSQL instance on Railway
2. Copy connection string to `DATABASE_URL`
3. Run `npx prisma db push` against production DB

---

Built by vibe coders who needed more hours in the day.