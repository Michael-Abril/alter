# NightShift Onboarding Flow

## Overview
Complete 6-step onboarding experience - dead simple, no terminal commands required.

## Steps

### Step 1: Welcome
- **Screen**: "NightShift learns how you work and continues your work while you sleep."
- **Action**: Single "Get Started" button
- **File**: `src/app/onboarding/page.tsx`

### Step 2: Connect Gmail
- **Screen**: "Connect Gmail" with OAuth button
- **Flow**: 
  1. Click "Connect Gmail"
  2. Redirects to Google OAuth popup
  3. User authorizes
  4. Returns with green checkmark
- **API**: `GET /api/gmail/connect` (existing)
- **Status Check**: `GET /api/gmail/status` (new)
- **Skip**: Available

### Step 3: Connect Canvas (Optional)
- **Screen**: Canvas token input with instructions
- **Instructions**: 
  - Open Canvas → Account → Settings
  - Scroll to "Approved Integrations"
  - Click "+ New Access Token"
  - Copy and paste token
- **Features**:
  - Domain dropdown (Babson, Harvard, MIT, Stanford, Other)
  - Custom domain input for "Other"
  - Real-time validation via Canvas API
  - Green checkmark on success
  - Red error message on failure
- **API**: `POST /api/canvas/validate` (new)
- **Skip**: Available

### Step 4: Import AI Chat History
- **Options**:
  - **Option A**: "Connect to Claude" button
    - Triggers Claude scraper
    - Shows progress bar during import
  - **Option B**: "Upload ChatGPT Export"
    - File upload for ChatGPT JSON export
    - Processes conversations automatically
  - **Option C**: Skip for now
- **APIs**: 
  - `POST /api/onboarding/import-claude` (new)
  - `POST /api/onboarding/import-chatgpt` (new)
- **Skip**: Available

### Step 5: Processing
- **Screen**: Animated loading with real progress
- **Stages**:
  1. "Analyzing your conversations..." → Shows message count
  2. "Detecting your projects..." → Shows project count
  3. "Almost done..." → Preparing dashboard
- **Progress Bar**: 0% → 33% → 66% → 100%
- **APIs**:
  - `POST /api/onboarding/embed` (new) - Runs embedding pipeline
  - `POST /api/onboarding/detect-projects` (new) - Runs project detection
- **Real Pipeline**: Actually runs scripts in background

### Step 6: The Reveal (Holy Shit Moment)
- **Screen**: "Here's what we found you're working on"
- **Display**: 
  - Shows detected projects with:
    - Project name
    - Description
    - Progress bar
    - Status badge
  - Up to 5 projects shown
- **Action**: "Looks right, let's go" → Redirects to dashboard
- **Fallback**: If no projects, shows friendly message

## API Endpoints Created

### `GET /api/gmail/status`
- Checks if user has Gmail connected
- Returns: `{ connected: boolean }`

### `POST /api/canvas/validate`
- Validates Canvas API token
- Makes test call to Canvas API
- Saves credentials to `/data/canvas-config.json`
- Returns: `{ valid: boolean, userName: string, domain: string }`

### `POST /api/onboarding/import-claude`
- Triggers Claude scraper (`orchestration/scrape-claude.mjs`)
- Runs in background
- Returns: `{ status: 'processing' }`

### `POST /api/onboarding/import-chatgpt`
- Accepts ChatGPT JSON export file
- Parses conversations from export format
- Imports messages to database
- Returns: `{ messagesImported: number }`

### `POST /api/onboarding/embed`
- Runs embedding pipeline (`scripts/embed-chat-history.ts`)
- Embeds all un-embedded messages
- Returns: `{ messagesEmbedded: number }`

### `POST /api/onboarding/detect-projects`
- Runs project detection (`scripts/detect-projects.ts`)
- Detects projects from conversations
- Returns: `{ projectsDetected: number }`

## UI Components Used
- `lucide-react` icons: `CheckCircle2`, `Loader2`, `Upload`, `AlertCircle`
- NightShift dark theme with accent colors
- Animated progress bars
- Loading spinners
- Success/error states with color-coded backgrounds

## User Experience
1. **No terminal commands** - Everything through UI
2. **No API key hunting** - Except Canvas (which genuinely requires it)
3. **Clear instructions** - Step-by-step with screenshots context
4. **Real-time validation** - Immediate feedback on Canvas token
5. **Progress visibility** - See exactly what's happening
6. **Skip options** - Every step is optional except welcome
7. **Premium feel** - Smooth animations, clear states, professional design

## Technical Implementation
- **Client-side**: React hooks for state management
- **Server-side**: API routes trigger real orchestration scripts
- **Background processing**: Scripts run via `exec` for long-running tasks
- **Real data**: Fetches actual projects from database for reveal
- **Error handling**: Graceful fallbacks and error messages

## Files Modified/Created
- `src/app/onboarding/page.tsx` - Complete rebuild
- `src/app/api/gmail/status/route.ts` - New
- `src/app/api/canvas/validate/route.ts` - New
- `src/app/api/onboarding/import-claude/route.ts` - New
- `src/app/api/onboarding/import-chatgpt/route.ts` - New
- `src/app/api/onboarding/embed/route.ts` - New
- `src/app/api/onboarding/detect-projects/route.ts` - New

## Dependencies Added
- `lucide-react` - Icon library

## Next Steps
1. Test the complete flow with a new user
2. Add screenshot placeholders for Canvas instructions
3. Improve error messages with specific troubleshooting
4. Add analytics tracking for onboarding completion rate
5. Consider adding a progress save feature (resume onboarding later)
