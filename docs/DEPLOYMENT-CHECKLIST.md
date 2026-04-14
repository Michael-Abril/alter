# Alter - Deployment Checklist for Vercel + Supabase

## Current Status

| Component | Local | Cloud Ready? | Action Needed |
|-----------|-------|--------------|---------------|
| Database | SQLite/Local | YES (Supabase) | Connect Supabase |
| Auth | Clerk | YES | Already configured |
| AI/LLM | Akash ML | YES | API key needed |
| Vector Search | Local vectra | NO | Migrate to Pinecone OR Supabase pgvector |
| File Storage | Local filesystem | NO | Migrate to Supabase Storage |
| Background Jobs | Local spawn() | NO | Use Vercel Cron + queue |

---

## 1. DATABASE (Supabase) - REQUIRED

### Environment Variables
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
```

### Setup Steps
1. Get connection string from Supabase Dashboard > Settings > Database
2. Run migrations:
```bash
npx prisma migrate deploy
```

3. Verify tables exist:
```bash
npx prisma db push
```

---

## 2. VECTOR SEARCH - CRITICAL FOR ALTER'S PERSONALITY

**Current:** Uses local `vectra` library storing in `data/vectors/`
**Problem:** Vercel filesystem is ephemeral - vectors lost on each deployment

### Option A: Pinecone (Recommended - code already exists)

1. Create account at https://pinecone.io
2. Create index with:
   - Dimensions: `1536`
   - Metric: `cosine`
   - Name: `alter-vectors`

3. Environment variables:
```env
PINECONE_API_KEY=your-api-key
PINECONE_INDEX=alter-vectors
PINECONE_ENVIRONMENT=us-east-1  # or your region
```

4. Update `src/lib/pinecone.ts` to use real Pinecone instead of local vectra

### Option B: Supabase pgvector

1. Enable pgvector extension in Supabase:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

2. Create vectors table:
```sql
CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops);
```

3. Update `src/lib/pinecone.ts` to query Supabase instead

---

## 3. FILE STORAGE - REQUIRED FOR GENERATED OUTPUT

**Current:** Saves to `data/output/`, `data/briefs/`, `data/continuations/`
**Problem:** Files lost on Vercel

### Supabase Storage Setup

1. Create buckets in Supabase Dashboard > Storage:
   - `alter-outputs` (public or private)
   - `alter-briefs` (private)

2. Environment variables:
```env
SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

3. Files to update:
   - `orchestration/continue-work.mjs` - change `saveContinuationFile()` to upload to Supabase
   - `src/app/api/download/route.ts` - fetch from Supabase instead of local
   - `src/app/api/drafts/[id]/route.ts` - update file paths

---

## 4. BACKGROUND JOBS - REQUIRED FOR OVERNIGHT WORK

**Current:** `spawn('node', [...])` in `src/app/api/handoff/route.ts`
**Problem:** Vercel functions timeout after 10-60 seconds

### Option A: Vercel Cron + Queue (Recommended)

1. Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/overnight-work",
      "schedule": "0 2 * * *"
    }
  ]
}
```

2. Create `/api/cron/overnight-work/route.ts`:
   - Process one project at a time
   - Use database queue for pending work
   - Each invocation handles one task

### Option B: Use External Service

- **Trigger.dev** - serverless background jobs
- **Inngest** - event-driven functions
- **QStash** - Upstash queue service

---

## 5. ALL ENVIRONMENT VARIABLES

Create these in Vercel Dashboard > Settings > Environment Variables:

```env
# Database (Supabase)
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# AI (Akash ML)
AKASH_ML_API_KEY=your-akash-api-key
AKASH_ML_ENDPOINT=https://chatapi.akash.network/api/v1

# Vector Search (Pinecone)
PINECONE_API_KEY=your-pinecone-key
PINECONE_INDEX=alter-vectors
PINECONE_ENVIRONMENT=us-east-1

# File Storage (Supabase)
SUPABASE_URL=https://[PROJECT].supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# OpenAI (for embeddings - optional, has local fallback)
OPENAI_API_KEY=sk-...

# App Config
NEXT_PUBLIC_API_URL=https://your-app.vercel.app
NIGHTSHIFT_OUTPUT_DIR=/tmp  # Vercel writable directory
```

---

## 6. CODE CHANGES NEEDED

### Priority 1: Vector Storage Migration
- [ ] Update `src/lib/pinecone.ts` to use actual Pinecone API
- [ ] Update `src/lib/embeddings.ts` if needed
- [ ] Test vector upsert and query

### Priority 2: File Storage Migration
- [ ] Create `src/lib/supabase-storage.ts` helper
- [ ] Update `orchestration/continue-work.mjs` to use cloud storage
- [ ] Update download routes to fetch from cloud

### Priority 3: Background Jobs
- [ ] Create `/api/cron/overnight-work/route.ts`
- [ ] Add job queue table to database
- [ ] Update handoff to queue jobs instead of spawn

---

## 7. TESTING CHECKLIST

Before going live, verify:

- [ ] User can sign up/sign in (Clerk)
- [ ] User can sync Claude/ChatGPT history (API works)
- [ ] Messages are stored in Supabase (check DB)
- [ ] Messages are embedded (check Pinecone/pgvector)
- [ ] Handoff page shows projects
- [ ] Overnight work completes (check cron logs)
- [ ] Drafts appear after overnight work
- [ ] Draft approval creates action
- [ ] Activity page shows completed actions
- [ ] Files can be downloaded

---

## 8. QUICK START FOR FRIEND

```bash
# 1. Clone and install
git clone [repo]
cd nightshift-ai
npm install

# 2. Set up environment
cp .env.example .env
# Fill in all values from section 5

# 3. Push database schema
npx prisma db push

# 4. Test locally
npm run dev

# 5. Deploy to Vercel
vercel --prod
```

---

## Files That Need Updates

| File | Change Needed |
|------|---------------|
| `src/lib/pinecone.ts` | Use real Pinecone API |
| `src/lib/chat-history-ingest.ts` | Ensure cloud vectors work |
| `orchestration/continue-work.mjs` | Cloud file storage |
| `src/app/api/handoff/route.ts` | Queue jobs instead of spawn |
| `src/app/api/download/route.ts` | Fetch from cloud storage |
| `prisma/schema.prisma` | Verify PostgreSQL compatibility |

---

## Contact

If stuck, check:
1. Vercel function logs for errors
2. Supabase logs for DB issues
3. Pinecone dashboard for vector issues
