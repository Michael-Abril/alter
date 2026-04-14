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
| **Akash ML** | Primary AI inference API (cheap: $0.13-0.40/M tokens) |

## Tech Stack

- **Framework**: Next.js 16.2.1 (App Router)
- **Auth**: Clerk
- **Database**: SQLite (dev) / PostgreSQL (prod) via Prisma
- **AI Primary**: Akash ML API (Llama 3.3 70B, DeepSeek V3.2)
- **AI Fallback**: Claude (Anthropic) for complex tasks
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
| `orchestration/lib/ai-client.mjs` | **Main AI client** - Akash ML primary, Anthropic fallback |
| `src/lib/openclaw-client.ts` | Frontend AI client (same pattern) |
| `orchestration/overnight-loop.mjs` | Main overnight processing loop |
| `orchestration/nightshift-daemon.mjs` | Autonomous daemon process |
| `src/lib/voice-profile-builder.ts` | Extracts user's writing style |
| `prisma/schema.prisma` | Database schema |

## AI Client Architecture

```
Request → Akash ML API (primary) → Success? Return
              ↓ (failure)
          Anthropic API (fallback) → Return
```

**Akash ML Models** (via `api.akashml.com`):
- `meta-llama/Llama-3.3-70B-Instruct` - Default, fast & cheap
- `deepseek-ai/DeepSeek-V3.2` - Great for reasoning
- `Qwen/Qwen2.5-72B-Instruct` - Alternative

**Cost**: ~$0.13-0.42 per million tokens (vs $3-15 for Claude)

## Environment Variables

Required:
- `CLERK_SECRET_KEY` - Authentication
- `AKASH_ML_API_KEY` - Primary AI (cheap inference)

Optional but recommended:
- `ANTHROPIC_API_KEY` - Fallback AI (higher quality)
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
