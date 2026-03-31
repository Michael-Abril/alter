# Person 3 — Royce (OpenClaw Orchestration, Brief, Handoff, Actions)

## What You Own

### API Routes
- `src/app/api/chat-history/route.ts` — GET: return stored chat history
- `src/app/api/actions/route.ts` — POST: OpenClaw reports completed actions
- `src/app/api/brief/route.ts` — GET: generate/return morning brief
- `src/app/api/handoff/route.ts` — GET: unfinished tasks, POST: submit handoff

### External (OpenClaw Workflows — built separately)
- Chat history scraping workflow (Claude/ChatGPT)
- Overnight task execution workflow
- Action reporting workflow

---

## Build Priority (in order)

### 1. Actions Endpoint (Day 1)
**File:** `src/app/api/actions/route.ts`
- Verify OpenClaw webhook secret
- Store actions in DB using Prisma
- Handle all action types: email_sent, doc_edited, task_completed, flagged
- Return action ID for tracking

**Claude Code prompt:**
```
Implement the actions endpoint in src/app/api/actions/route.ts:
1. Verify x-openclaw-secret header against OPENCLAW_WEBHOOK_SECRET
2. Parse and validate the request body (userId, type, title, app required)
3. Create an Action record in the database using Prisma
4. Handle metadata as JSON string
5. Return the created action with its ID
Add proper error handling and TypeScript types from @/types.
```

### 2. Handoff Endpoint (Day 1-2)
**File:** `src/app/api/handoff/route.ts`
- GET: Detect unfinished work across user's connected apps
- POST: Accept task selections and trigger OpenClaw workflow
- Store handoff session for tracking

**Claude Code prompt:**
```
Implement the handoff endpoint in src/app/api/handoff/route.ts:

GET handler:
1. Fetch the user's active projects from DB
2. Check for draft emails, open PRs, incomplete docs
3. Score estimated confidence for each task
4. Return sorted by priority/confidence

POST handler:
1. Validate selected task IDs
2. Store handoff session (consider adding a HandoffSession model or using metadata)
3. Return confirmation with estimated completion time

Use the existing HandoffTask and HandoffSubmission types from @/types.
```

### 3. Morning Brief (Day 2-3)
**File:** `src/app/api/brief/route.ts`
- Aggregate all actions since the user's last wake time
- Separate completed vs flagged actions
- Generate a natural-language summary using Claude API
- Suggest focus items based on flagged items and project deadlines

**Claude Code prompt:**
```
Implement the morning brief endpoint in src/app/api/brief/route.ts:
1. Fetch the user and their wakeTime from DB
2. Query actions since previous night (e.g., since 10pm yesterday)
3. Separate into completedActions and flaggedItems
4. Use Claude API (@/lib/claude) to generate a natural-language summary
5. Generate suggestedFocus items based on flagged items and project status
6. Return the full MorningBrief type from @/types
```

### 4. Chat History GET (Day 3)
**File:** `src/app/api/chat-history/route.ts`
- Return stored chat history for the user
- Support pagination and filtering by source
- Order by timestamp descending

**Claude Code prompt:**
```
Implement the chat history GET endpoint in src/app/api/chat-history/route.ts:
1. Get authenticated user via Clerk
2. Fetch chat messages from DB with pagination (page, limit query params)
3. Support filtering by source (claude, chatgpt, other) via query param
4. Order by timestamp descending
5. Return with total count for pagination
```

### 5. OpenClaw Workflows (Separate Repo)
Build these workflows in OpenClaw that call NightShift API:

**Chat History Scraping:**
1. Open user's Claude/ChatGPT in browser
2. Scrape conversation history
3. POST to `/api/chat-history/ingest` with scraped messages

**Overnight Task Execution:**
1. Receive handoff task list
2. For each task, execute the appropriate action:
   - Email tasks → call `/api/drafts/generate`, then send via Gmail
   - Doc tasks → edit docs via Google Docs API
   - Code tasks → review PRs, suggest changes
3. Report each completed action to `/api/actions`

**Action Reporting:**
- After each action, POST to `/api/actions` with results
- Include confidence score and metadata

---

## Mock Data Available

All endpoints return realistic mock data. Frontend is already building against these mocks.

## What "Done" Looks Like

- [ ] OpenClaw can report actions via `/api/actions` (verified with webhook secret)
- [ ] Morning brief aggregates real overnight actions with a Claude-generated summary
- [ ] Handoff GET detects real unfinished work
- [ ] Handoff POST triggers OpenClaw workflow
- [ ] Chat history GET returns paginated, filtered results
- [ ] OpenClaw chat scraping workflow works end-to-end
- [ ] OpenClaw overnight execution workflow completes at least email tasks

## Dependencies on Others
- **Person 1** provides the chat history ingest endpoint and Gmail sending capability
- **Person 2** provides project detection data for handoff suggestions
- **Person 4** provides Claude draft generation for the overnight workflow

## Environment Variables You Need
```
OPENCLAW_API_KEY=
OPENCLAW_WEBHOOK_SECRET=
ANTHROPIC_API_KEY=
DATABASE_URL=postgresql://...
```

## OpenClaw Integration Notes

### Webhook Authentication
All OpenClaw → NightShift calls must include:
```
Headers:
  x-openclaw-secret: <OPENCLAW_WEBHOOK_SECRET>
  Content-Type: application/json
```

### Chat History Ingest Payload
```json
{
  "userId": "user_cuid",
  "source": "claude",
  "messages": [
    {
      "role": "user",
      "content": "message text",
      "timestamp": "2024-01-15T10:30:00Z",
      "sessionId": "optional_session_id"
    }
  ]
}
```

### Action Report Payload
```json
{
  "userId": "user_cuid",
  "type": "email_sent",
  "title": "Follow-up email to Sarah",
  "description": "Sent re: Q2 timeline",
  "app": "gmail",
  "confidence": 0.92,
  "status": "completed",
  "metadata": { "emailId": "msg_abc123", "threadId": "thread_1" }
}
```
