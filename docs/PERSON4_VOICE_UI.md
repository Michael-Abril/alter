# Person 4 — Voice/UI (Persona, Confidence, Claude API, Frontend)

## What You Own

### Lib Files
- `src/lib/claude.ts` — Claude API wrapper (generate, score, persona)
- `src/lib/confidence.ts` — Confidence scoring logic
- `src/lib/persona.ts` — Voice profile builder + system prompt generator

### API Routes
- `src/app/api/drafts/generate/route.ts` — Generate drafts in user's voice
- `src/app/api/drafts/[id]/route.ts` — View/approve/reject a draft
- `src/app/api/drafts/route.ts` — List pending drafts

### Pages
- `src/app/layout.tsx` — Root layout (done)
- `src/app/page.tsx` — Landing page (done)
- `src/app/dashboard/page.tsx` — Morning Brief view
- `src/app/dashboard/handoff/page.tsx` — Tonight's Handoff
- `src/app/dashboard/activity/page.tsx` — Activity log
- `src/app/dashboard/settings/page.tsx` — Settings
- `src/app/onboarding/page.tsx` — Post-signup onboarding

### Components
- `src/components/layout/Sidebar.tsx` — Dashboard sidebar nav
- `src/components/layout/Header.tsx` — Top bar with status
- `src/components/brief/BriefSummary.tsx` — Morning brief summary card
- `src/components/brief/CompletedActions.tsx` — Overnight actions list
- `src/components/brief/FlaggedItems.tsx` — Items needing review
- `src/components/handoff/UnfinishedWork.tsx` — Unfinished task list
- `src/components/handoff/HandoffButton.tsx` — Activate NightShift button
- `src/components/drafts/DraftReview.tsx` — Draft approve/edit/reject
- `src/components/shared/ConfidenceBadge.tsx` — Confidence display
- `src/components/shared/AppIcon.tsx` — App icons
- `src/components/shared/StatusIndicator.tsx` — Active/sleep status

---

## Build Priority (in order)

### 1. Voice Profile Builder (Day 1)
**Files:** `src/lib/persona.ts`, `src/lib/claude.ts`
- Implement `analyzeWritingStyle()` — send samples to Claude, parse response
- Implement `buildSystemPrompt()` — generate comprehensive system prompt from profile
- Implement `computeBasicStats()` — local statistics before Claude analysis
- Test with sample emails

**Claude Code prompt:**
```
Implement the voice profile pipeline:

1. In src/lib/persona.ts, enhance buildSystemPrompt() to create a detailed system 
   prompt that captures writing tone, formality, sentence structure, vocabulary, 
   emoji usage, and sign-off style. Include few-shot examples from sampleOutputs.

2. In src/lib/claude.ts, implement analyzeWritingStyle() to send writing samples 
   to Claude and parse the JSON response into a structured VoiceProfile. The prompt 
   should ask Claude to analyze: avgSentenceLen, formalityScore (0-1), emojiFrequency, 
   toneKeywords array, and generate a system prompt.

3. In src/lib/persona.ts, implement computeBasicStats() to calculate local metrics 
   before sending to Claude: average sentence length, word length, emoji frequency.
```

### 2. Draft Generation Pipeline (Day 1-2)
**File:** `src/app/api/drafts/generate/route.ts`, `src/lib/claude.ts`
- Fetch user's VoiceProfile from DB
- Query Pinecone for relevant context (via `/api/embeddings/query`)
- Build context-aware prompt using persona helpers
- Call Claude to generate draft
- Score confidence
- Store draft in DB

**Claude Code prompt:**
```
Implement the draft generation pipeline in src/app/api/drafts/generate/route.ts:
1. Fetch the user's VoiceProfile from DB
2. Query the embeddings/query endpoint for relevant context
3. Use persona.buildContextPrompt() to create the full prompt
4. Call claude.generateDraft() with the prompt
5. Call claude.scoreConfidence() to assess the draft
6. Store the draft in the Draft model via Prisma
7. Return the draft with confidence score

Handle edge cases: missing voice profile (use defaults), no context found, 
Claude API errors.
```

### 3. Confidence Scoring (Day 2)
**Files:** `src/lib/confidence.ts`, `src/lib/claude.ts`
- Implement multi-factor scoring in `assessConfidence()`
- Implement Claude-based scoring in `scoreConfidence()`
- Wire confidence into draft generation

**Claude Code prompt:**
```
Enhance the confidence scoring system:

1. In src/lib/claude.ts, refine scoreConfidence() to use a structured prompt that 
   evaluates: voice match quality, context relevance, action risk level, and 
   task complexity. Parse the JSON response with validation.

2. In src/lib/confidence.ts, enhance assessConfidence() to combine the Claude score 
   with local factors: action risk multiplier, context relevance, voice match score, 
   and user's autonomy level. Return a ConfidenceAssessment with recommendation.
```

### 4. Dashboard UI Polish (Day 2-3)
**Files:** All components and dashboard pages
- Wire up real API calls (replace mock data with fetch calls)
- Add loading states and error handling
- Add animations (fade in for brief items, slide for handoff)
- Make responsive for mobile

**Claude Code prompt:**
```
Wire up the dashboard pages to use real API data:

1. In src/app/dashboard/page.tsx, fetch from /api/brief on mount and display real data
2. In src/app/dashboard/handoff/page.tsx, fetch from /api/handoff and POST selections
3. In src/app/dashboard/activity/page.tsx, fetch from /api/actions with pagination
4. In src/app/dashboard/settings/page.tsx, fetch/save real user settings

Add loading skeletons, error states, and smooth transitions. Use the existing 
Tailwind classes (card, btn-primary, etc.) and NightShift color palette.
```

### 5. Draft Review UI (Day 3-4)
**Files:** `src/components/drafts/DraftReview.tsx`, `src/app/api/drafts/[id]/route.ts`
- Implement draft approval flow (approve → send via appropriate app)
- Implement inline editing
- Implement rejection with feedback
- Add draft list view

**Claude Code prompt:**
```
Implement the draft review flow:
1. Create a drafts page at src/app/dashboard/drafts/page.tsx that lists pending drafts
2. Wire DraftReview component to PATCH /api/drafts/[id] for approve/reject
3. On approve, trigger the appropriate action (send email, publish doc, etc.)
4. Add inline editing that saves changes via PATCH
5. Add rejection with optional feedback text
```

### 6. Onboarding Flow (Day 4)
**File:** `src/app/onboarding/page.tsx`
- Wire Gmail connection to real OAuth flow
- Wire autonomy level selection to real API
- Add chat history import step (trigger OpenClaw)
- Add voice profile generation step (analyze imported data)

---

## Mock Data Available

All pages and API routes already have mock data so you can see the UI immediately. Run `npm run dev` and visit `/dashboard` to see everything.

## What "Done" Looks Like

- [ ] Voice profiles are generated from user's emails and chat history
- [ ] Drafts are generated in the user's voice with appropriate confidence scores
- [ ] Confidence scoring accurately reflects risk and quality
- [ ] Dashboard shows real morning brief data
- [ ] Handoff flow works end-to-end (select tasks → activate → morning brief)
- [ ] Draft review allows approve/edit/reject
- [ ] Onboarding flow connects Gmail and sets preferences
- [ ] UI is polished with loading states, animations, and error handling
- [ ] Dark theme looks great on all pages

## Dependencies on Others
- **Person 1** provides stored emails for voice profile building
- **Person 2** provides vector query results for context retrieval
- **Person 3 (Royce)** provides action data for morning brief and handoff tasks

## Environment Variables You Need
```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
DATABASE_URL=postgresql://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

## Design Notes

### Color Palette
- **Navy:** `#0F3460` — primary brand color
- **Accent:** `#E94560` — CTAs, active states, NightShift branding
- **Background:** `#0A0A12` — main background
- **Card Background:** `#1A1A3E` — card surfaces
- **Success:** `#4ADE80` — completed actions, high confidence
- **Warning:** `#FBBF24` — flagged items, medium confidence
- **Error:** `#F87171` — failed actions, low confidence

### Component Classes
- `.card` — standard card component
- `.btn-primary` — accent-colored action button
- `.btn-secondary` — navy-colored secondary button
- `.btn-ghost` — transparent hover button
- `.input` — standard input field

All defined in `src/app/globals.css`.
