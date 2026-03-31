# Person 1 — Backend (Auth, Gmail, Data Layer)

## What You Own

### API Routes
- `src/app/api/auth/webhook/route.ts` — Clerk webhook for user creation
- `src/app/api/gmail/connect/route.ts` — Gmail OAuth initiation
- `src/app/api/gmail/callback/route.ts` — Gmail OAuth callback
- `src/app/api/gmail/emails/route.ts` — Fetch/store emails
- `src/app/api/chat-history/ingest/route.ts` — Receive scraped chat history from OpenClaw

### Lib Files
- `src/lib/db.ts` — Prisma client singleton (done)
- `src/lib/gmail.ts` — Gmail API helpers

### Infrastructure
- `prisma/schema.prisma` — Database schema (done — don't modify without team discussion)
- `src/middleware.ts` — Clerk route protection (done)

---

## Build Priority (in order)

### 1. Clerk Webhook (Day 1)
**File:** `src/app/api/auth/webhook/route.ts`
- Verify webhook signature using svix
- Handle `user.created` event — create user in DB
- Handle `user.deleted` event — soft delete user
- Test with Clerk dashboard webhook tester

**Claude Code prompt:**
```
Implement the Clerk webhook handler in src/app/api/auth/webhook/route.ts. 
Verify the svix signature, handle user.created and user.deleted events, 
and create/delete users in the Prisma database. Use the existing db import 
from @/lib/db and the User model from prisma/schema.prisma.
```

### 2. Gmail OAuth Flow (Day 1-2)
**Files:** `src/app/api/gmail/connect/route.ts`, `src/app/api/gmail/callback/route.ts`
- Redirect to Google OAuth consent screen
- Exchange auth code for tokens in callback
- Encrypt tokens before storing (use crypto.subtle or a library)
- Set `gmailConnected = true` on user record
- Redirect back to settings page with success/error

**Claude Code prompt:**
```
Implement the Gmail OAuth flow. In connect/route.ts, redirect the authenticated 
user to Google's OAuth consent screen using the gmail.ts helper. In callback/route.ts, 
exchange the auth code for tokens, encrypt them, store in the User model via Prisma, 
and redirect to /dashboard/settings. Handle errors gracefully.
```

### 3. Email Fetching (Day 2-3)
**File:** `src/app/api/gmail/emails/route.ts`, `src/lib/gmail.ts`
- Implement `fetchSentEmails()` with full MIME parsing
- Handle pagination for users with many emails
- Strip HTML from email bodies
- Store emails in the Email model
- POST endpoint triggers a fresh pull, GET returns stored emails

**Claude Code prompt:**
```
Implement email fetching in src/lib/gmail.ts. The fetchSentEmails function should:
1. Use the Gmail API to list sent messages with pagination
2. Fetch full message details for each
3. Parse MIME headers (From, To, Subject)
4. Extract plain text body (strip HTML if needed)
5. Return typed Email objects

Then wire up the POST handler in api/gmail/emails/route.ts to fetch the user's 
Gmail tokens from DB, call fetchSentEmails, and upsert new emails into the Email model.
```

### 4. Chat History Ingestion (Day 3)
**File:** `src/app/api/chat-history/ingest/route.ts`
- Verify OpenClaw webhook secret from headers
- Validate payload structure (userId, source, messages)
- Batch insert chat messages into ChatMessage model
- Return count of ingested messages

**Claude Code prompt:**
```
Implement the chat history ingestion endpoint. Verify the x-openclaw-secret header 
against OPENCLAW_WEBHOOK_SECRET env var. Validate the request body contains userId, 
source, and messages array. Batch insert messages into the ChatMessage model using 
Prisma createMany. Handle errors and return the count of ingested messages.
```

---

## Mock Data Available

All your endpoints already return mock data so the frontend team can build against them immediately. Replace mock data with real implementations as you complete each piece.

## What "Done" Looks Like

- [ ] Users are created in DB when they sign up via Clerk
- [ ] Gmail OAuth flow works end-to-end (connect → consent → callback → tokens stored)
- [ ] Emails can be pulled from Gmail and stored in DB
- [ ] Chat history can be received from OpenClaw and stored in DB
- [ ] All tokens are encrypted before storage
- [ ] Error handling is robust (no unhandled promise rejections)

## Dependencies on Others
- **Person 2** needs your emails and chat messages stored in DB before they can embed them
- **Person 3 (Royce)** will call your `/api/chat-history/ingest` endpoint from OpenClaw
- **Person 4** needs Gmail connected for the settings page to show real status

## Environment Variables You Need
```
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback
DATABASE_URL=postgresql://...
```
