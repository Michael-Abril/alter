# NightShift AI / Alter - AI Assistant Context

## What is this project?

**Alter** is an AI "digital twin" that learns your work patterns, communication style, and preferences, then autonomously continues your work while you sleep.

## Key Concepts

| Term | Meaning |
|------|---------|
| **Alter** | The user's AI digital twin / personality replica |
| **Voice Profile** | Extracted writing style, tone, formality from chat history |
| **Handoff** | Queue of tasks for Alter to complete overnight |
| **Morning Brief** | Summary of what Alter accomplished while user slept |
| **OpenClaw** | External AI orchestration service (optional, with Anthropic fallback) |

## Tech Stack

- **Framework**: Next.js 16.2.1 (App Router)
- **Auth**: Clerk
- **Database**: SQLite (dev) / PostgreSQL (prod) via Prisma
- **AI**: Claude (Anthropic) or OpenClaw
- **Vector Store**: Vectra (local file-based)

## Directory Structure

```
src/app/           → Next.js pages and API routes
src/lib/           → Core utilities (db, AI clients, voice profile)
src/components/    → React components
orchestration/     → Background processing scripts (Node.js)
prisma/            → Database schema
docs/              → Detailed documentation
data/              → Runtime data (briefs, logs, continuations)
```

## Important Files

| File | Purpose |
|------|---------|
| `src/lib/openclaw-client.ts` | OpenClaw API client with Anthropic fallback |
| `orchestration/lib/ai-client.mjs` | Shared AI client for background scripts |
| `orchestration/overnight-loop.mjs` | Main overnight processing loop |
| `orchestration/nightshift-daemon.mjs` | Autonomous daemon process |
| `src/lib/voice-profile-builder.ts` | Extracts user's writing style |
| `prisma/schema.prisma` | Database schema |

## AI Client Architecture

Two AI clients exist with the same fallback pattern:

1. **Next.js API** uses `src/lib/openclaw-client.ts`
2. **Orchestration scripts** use `orchestration/lib/ai-client.mjs`

Both try OpenClaw first, fall back to Anthropic if unavailable.

## Environment Variables

Required:
- `CLERK_SECRET_KEY` - Authentication
- `ANTHROPIC_API_KEY` - AI calls (or configure OpenClaw)

Optional:
- `OPENCLAW_API_URL` + `OPENCLAW_GATEWAY_PASSWORD` - OpenClaw integration
- `GMAIL_CLIENT_ID` + `GMAIL_CLIENT_SECRET` - Gmail sync

See `.env.example` for full list.

## Common Tasks

### Start dev server
```bash
npm run dev
```

### Start autonomous daemon
```bash
node orchestration/nightshift-daemon.mjs        # Production
node orchestration/nightshift-daemon.mjs --test # Test mode
```

### Database operations
```bash
npx prisma generate  # Regenerate client
npx prisma db push   # Apply schema changes
npx prisma studio    # Visual database browser
```

## Current Status

- **OpenClaw integration**: In progress (Royce) - see `docs/PERSON3_OPENCLAW.md`
- **Handoff/Activity/Drafts**: Fixed architectural issues, using shared AI client
- **Voice Profile**: Working - extracts style from Claude/ChatGPT history

## Documentation

- `ARCHITECTURE.md` - System design and data flow
- `docs/DAEMON.md` - Autonomous daemon setup
- `docs/PERSON*.md` - Team-specific guides
