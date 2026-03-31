# OpenClaw — Chat History Scrapers

Browser automation scripts that scrape your chat history from Claude.ai and ChatGPT, then send it to NightShift's ingest API.

## Setup

```bash
cd orchestration
npm install
npx playwright install chromium
```

## Usage

```bash
# Scrape Claude.ai (last 5 conversations)
node scrape.mjs --service=claude

# Scrape ChatGPT
node scrape.mjs --service=chatgpt

# Scrape both
node scrape.mjs --service=all

# Scrape last 10 conversations from Claude
node scrape.mjs --service=claude --max=10

# Dry run — print payload without sending to API
node scrape.mjs --service=claude --dry-run

# Run individual scrapers directly
node scrape-claude.mjs
node scrape-chatgpt.mjs
```

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--service` | `all` | `claude`, `chatgpt`, or `all` |
| `--max` | `5` | Max conversations to scrape |
| `--api` | `http://localhost:3000/api/chat-history/ingest` | Ingest API endpoint |
| `--user` | `user_test_123` | User ID to tag messages with |
| `--dry-run` | off | Print payload instead of sending |
| `--headless` | off | Run browser without visible window |
| `--profile-dir` | `~/.nightshift-browser` | Custom browser profile path |

## How It Works

1. Launches Chromium with a persistent profile (`~/.nightshift-browser`)
2. Navigates to claude.ai or chatgpt.com
3. If not logged in, keeps the browser open for you to log in manually
4. Reads conversation links from the sidebar
5. Opens each conversation and extracts message text
6. POSTs extracted messages to the NightShift ingest API

## First Run

On first run, the browser will open and you won't be logged in. Just:
1. Log into Claude.ai / ChatGPT in the browser window that opens
2. Close the script (Ctrl+C)
3. Re-run — your session will be saved in the browser profile

## API Payload Format

```json
{
  "userId": "user_test_123",
  "source": "claude",
  "messages": [
    {
      "role": "user",
      "content": "the text of my message",
      "sessionId": "conversation-title",
      "timestamp": "2026-03-30T22:00:00Z"
    },
    {
      "role": "assistant",
      "content": "Claude's response text",
      "sessionId": "conversation-title",
      "timestamp": "2026-03-30T22:01:00Z"
    }
  ]
}
```

## Notes

- Uses your existing browser session — no credentials stored in code
- Starts small (5 conversations by default) — increase with `--max`
- If a conversation fails to load, it's skipped automatically
- Fallback: if the API is unreachable, messages are saved to a local JSON file
- The browser profile is stored at `~/.nightshift-browser` (not your main Chrome profile)
