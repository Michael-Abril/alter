# NightShift AI / Alter

> **Work While You Sleep** — Alter is your AI digital twin that learns how you work, then continues your work while you sleep.

Alter connects to your Gmail and chat history (Claude, ChatGPT), builds a voice profile of how you write, detects unfinished work, and autonomously completes tasks overnight — all in your voice and style.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [Architecture Overview](ARCHITECTURE.md) | System design, data flow, troubleshooting |
| [AI Context](CLAUDE.md) | Quick reference for AI assistants |
| [Daemon Guide](docs/DAEMON.md) | Autonomous daemon setup |
| [OpenClaw Integration](docs/PERSON3_OPENCLAW.md) | OpenClaw API integration (Royce) |
| [Gmail Setup](docs/GMAIL_SETUP.md) | Gmail OAuth configuration |

---

## Quick Start

### Prerequisites
- Node.js 18+
- Clerk account (free tier works) — [dashboard.clerk.com](https://dashboard.clerk.com)
- Anthropic API key — [console.anthropic.com](https://console.anthropic.com)

**Optional:**
- PostgreSQL (SQLite works locally)
- OpenAI API key (for ChatGPT history import)
- OpenClaw credentials (ask Royce)

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

Fill in all values in `.env`. See `.env.example` for the full list with descriptions.

**Required for local dev:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY` — from Clerk Dashboard
- `ANTHROPIC_API_KEY` — from Anthropic Console

**Optional:**
- `DATABASE_URL` — defaults to SQLite (`file:./dev.db`)
- `OPENAI_API_KEY` — for ChatGPT history import
- `OPENCLAW_API_URL` + `OPENCLAW_GATEWAY_PASSWORD` — for OpenClaw integration

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
| Framework | Next.js 16.2.1 (App Router) |
| Auth | Clerk |
| Database | SQLite (dev) / PostgreSQL (prod) + Prisma ORM |
| Vector DB | Vectra (local file-based) |
| LLM | Claude API (Anthropic) or OpenClaw |
| Embeddings | Anthropic / OpenAI |
| Orchestration | Node.js daemon + OpenClaw (optional) |
| Styling | Tailwind CSS |
| Deployment | Vercel (frontend) + Railway (backend/DB) |

---

## Project Structure

```
nightshift-ai/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── api/                  # API routes
│   │   ├── dashboard/            # Main dashboard (brief, handoff, drafts, settings)
│   │   └── (auth)/               # Auth pages (sign-in, sign-up)
│   ├── components/               # React components
│   ├── lib/                      # Core utilities
│   │   ├── db.ts                 # Prisma client
│   │   ├── openclaw-client.ts    # OpenClaw API (with Anthropic fallback)
│   │   └── voice-profile-builder.ts  # Voice profile extraction
│   └── types/                    # TypeScript types
├── orchestration/                # Background processing
│   ├── lib/ai-client.mjs         # Shared AI client
│   ├── overnight-loop.mjs        # Main overnight processing
│   ├── continue-work.mjs         # Work continuation
│   ├── draft-email.mjs           # Email drafting
│   └── nightshift-daemon.mjs     # Autonomous daemon
├── prisma/schema.prisma          # Database schema
├── docs/                         # Detailed documentation
│   ├── DAEMON.md                 # Daemon guide
│   └── PERSON*.md                # Team-specific guides
└── data/                         # Runtime data (briefs, logs)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

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