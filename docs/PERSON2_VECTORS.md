# Person 2 — Vectors (Embeddings, Pinecone, Project Detection)

## What You Own

### API Routes
- `src/app/api/embeddings/process/route.ts` — Trigger embedding pipeline
- `src/app/api/embeddings/query/route.ts` — Query vector DB for similar context
- `src/app/api/projects/route.ts` — Detect and return active projects

### Lib Files
- `src/lib/pinecone.ts` — Pinecone client and helpers
- `src/lib/embeddings.ts` — OpenAI embedding generation and text chunking

---

## Build Priority (in order)

### 1. Embedding Generation (Day 1)
**File:** `src/lib/embeddings.ts`
- Test `generateEmbedding()` with a simple string
- Test `generateEmbeddings()` batch mode
- Implement proper batching (OpenAI max 2048 inputs per request)
- Add retry logic for rate limits (429 errors)
- Refine `chunkText()` to respect sentence boundaries with overlap

**Claude Code prompt:**
```
Refine the embedding functions in src/lib/embeddings.ts:
1. Add batching to generateEmbeddings() — chunk into groups of 2048
2. Add retry logic with exponential backoff for OpenAI rate limits
3. Improve chunkText() to use sentence boundary detection with configurable overlap
4. Add proper error handling and logging
5. Test with sample text to verify dimensions match EMBEDDING_DIMENSIONS constant
```

### 2. Pinecone Integration (Day 1-2)
**File:** `src/lib/pinecone.ts`
- Test connection to Pinecone index
- Implement batch upsert (chunk into batches of 100)
- Implement query with metadata filtering
- Implement namespace stats for progress tracking
- Add error handling for Pinecone API errors

**Claude Code prompt:**
```
Implement the Pinecone helper functions in src/lib/pinecone.ts:
1. upsertVectors: batch into groups of 100, use user's namespace
2. queryVectors: support metadata filtering (source, type)
3. getNamespaceStats: use describe_index_stats to get vector count
4. deleteUserVectors: delete all vectors in a user's namespace
Add proper TypeScript types and error handling throughout.
```

### 3. Embedding Pipeline (Day 2-3)
**File:** `src/app/api/embeddings/process/route.ts`
- Fetch unembedded emails from DB (`embedded = false`)
- Fetch unembedded chat messages from DB
- Use `prepareEmailForEmbedding()` and `prepareChatForEmbedding()` for chunking
- Generate embeddings in batches
- Upsert to Pinecone with metadata
- Mark records as `embedded = true` in DB

**Claude Code prompt:**
```
Implement the embedding processing pipeline in src/app/api/embeddings/process/route.ts:
1. Fetch the user from DB using clerkId
2. Query unembedded emails and chat messages
3. Prepare them for embedding using helpers from @/lib/embeddings
4. Generate embeddings in batches
5. Upsert to Pinecone using @/lib/pinecone helpers
6. Update records in DB to set embedded = true
7. Return processing stats
```

### 4. Vector Query Endpoint (Day 3)
**File:** `src/app/api/embeddings/query/route.ts`
- Generate embedding for query text
- Query Pinecone with filters
- Return ranked results with metadata

**Claude Code prompt:**
```
Implement the vector query endpoint in src/app/api/embeddings/query/route.ts:
1. Parse query, topK, and filter from request body
2. Generate embedding for query text using generateEmbedding()
3. Query Pinecone using queryVectors() with user's namespace
4. Apply any metadata filters (source, type)
5. Return ranked results with scores and content
```

### 5. Project Detection (Day 4)
**File:** `src/app/api/projects/route.ts`
- Analyze user's emails and chat history for project patterns
- Use vector similarity to cluster related activities
- Detect stalled projects (no activity in X days)
- Calculate progress estimates

**Claude Code prompt:**
```
Implement project detection in src/app/api/projects/route.ts:
1. Fetch recent emails and chat messages for the user
2. Use embeddings to cluster related content into projects
3. Check existing projects in DB and update status
4. Detect new projects from recent activity
5. Mark projects as stalled if no activity in 7+ days
6. Return projects with progress estimates
```

---

## Mock Data Available

All endpoints already return mock data. Replace with real implementations as you go.

## What "Done" Looks Like

- [ ] Emails and chat messages can be embedded and stored in Pinecone
- [ ] Vector queries return relevant context ranked by similarity
- [ ] The embedding pipeline handles large batches without errors
- [ ] Projects are detected and tracked with progress estimates
- [ ] Stalled projects are flagged automatically

## Dependencies on Others
- **Person 1** must store emails and chat messages in DB before you can embed them
- **Person 4** will call your `/api/embeddings/query` endpoint during draft generation
- **Person 3 (Royce)** uses project detection for handoff suggestions

## Environment Variables You Need
```
OPENAI_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX=nightshift
DATABASE_URL=postgresql://...
```

## Pinecone Setup
1. Create a Pinecone account at https://www.pinecone.io
2. Create an index called `nightshift` with dimension `1536` (matches text-embedding-3-small)
3. Use `cosine` similarity metric
4. Each user gets their own namespace (userId)
