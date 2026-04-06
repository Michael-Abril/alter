# NightShift Work Continuation Agent

This is the **core of NightShift** — the autonomous agent that actually continues your unfinished work while you sleep.

## What It Does

The continuation agent:
1. Takes a detected project (from your chat history analysis)
2. Queries the vector DB to retrieve all relevant context
3. Calls Claude API with that context and asks it to continue the work
4. Saves the output to `/data/continuations/{project-name}-{timestamp}.md`
5. Logs the action to the database via `/api/actions`

## Setup

### 1. Install Dependencies

```bash
cd orchestration
npm install
```

### 2. Environment Variables

Make sure your `.env` file (in the root directory) has:

```env
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 3. Start the Next.js Dev Server

The continuation agent needs the NightShift backend running to fetch projects and log actions.

In a **separate terminal**, from the root directory:

```bash
npm run dev
```

This starts the Next.js server at `http://localhost:3000`.

## Usage

### Test Run (Dry Run Mode)

Preview what the agent will generate without saving files:

```bash
cd orchestration
node test-continue.mjs --dry-run
```

This will:
- Fetch your real detected projects
- Select the one with the lowest progress %
- Generate continuation output
- Print a preview (no files saved, no actions logged)

### Full Run

Generate real work output and save it:

```bash
cd orchestration
node test-continue.mjs
```

This will:
- Fetch your real detected projects
- Select the one with the lowest progress %
- Generate continuation output
- Save to `/data/continuations/{project-name}-{timestamp}.md`
- Log the action to the database

### Target a Specific Project

```bash
node test-continue.mjs --project-id=PROJECT_ID
```

## Output

Continuation files are saved to:

```
/data/continuations/
  ├── nightshift-ai-integration-2026-04-06T16-23-45.md
  ├── peru-trip-planning-2026-04-06T16-30-12.md
  └── ...
```

Each file includes:
- Project metadata (name, progress, next step)
- Generated continuation content from Claude
- Timestamp

## How It Works

### 1. Project Selection

The test script fetches all projects from `/api/projects` and selects the one with the **lowest progress percentage** (most in need of work).

### 2. Context Retrieval

The agent queries `/api/embeddings/query` to get relevant chat history. If the vector DB is unavailable (requires Clerk auth), it falls back to using the `sampleMessages` stored in the project's context.

### 3. Prompt Building

The agent builds a comprehensive prompt for Claude:
- System prompt: "You are NightShift AI, continue this work..."
- User prompt: Project details + retrieved context + next steps
- Guidelines: Be thorough, production-ready, actionable

### 4. Claude API Call

Calls Claude Sonnet 4 with up to 8192 max tokens to generate substantial work output.

### 5. Output Saving

Saves the generated content to a markdown file with metadata header.

### 6. Action Logging

Logs to `/api/actions` with:
- Type: `work_continued`
- Title: "Continued work on {project name}"
- Metadata: project ID, output path, tokens used

## Troubleshooting

### "Failed to fetch projects"

Make sure the Next.js dev server is running:

```bash
npm run dev
```

### "No projects found"

Run the project detector first:

```bash
npx tsx scripts/detect-projects.ts
```

### "ANTHROPIC_API_KEY is not set"

Add your Anthropic API key to `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
```

### "Vector query unavailable"

This is expected — the `/api/embeddings/query` endpoint requires Clerk authentication, which orchestration scripts don't have. The agent automatically falls back to using the project's stored context instead.

## Next Steps

Once you've verified the continuation agent works:

1. **Schedule it**: Set up a cron job or scheduled task to run at night
2. **Multi-project mode**: Modify to run on all in-progress projects
3. **Email integration**: Connect to the MCP email pipeline to send drafts
4. **Confidence scoring**: Add logic to decide which outputs to auto-send vs. flag for review

## Architecture

```
test-continue.mjs
  ↓
  Fetches projects from /api/projects
  ↓
continue-work.mjs
  ↓
  Queries /api/embeddings/query (with fallback)
  ↓
  Calls Claude API
  ↓
  Saves to /data/continuations/
  ↓
  Logs to /api/actions
```

This is the foundation of NightShift's autonomous work engine. 🌙
