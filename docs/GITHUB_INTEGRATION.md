# GitHub Integration for NightShift AI

## Overview

NightShift can automatically push code continuations to GitHub as pull requests instead of saving them locally. When the continuation agent generates code for a `code_build` project, it:

1. Creates a feature branch: `nightshift/{project-name}-{date}`
2. Commits the generated code to `src/nightshift/{filename}.{ext}`
3. Opens a pull request with full context and metadata
4. **Never pushes directly to main** - you always review and merge

## Setup

### Option 1: Personal Access Token (Quick Setup)

**File:** `data/github-config.json`

```json
{
  "YOUR_USER_ID": {
    "token": "github_pat_...",
    "defaultOwner": "your-github-username",
    "defaultRepo": "your-repo-name",
    "defaultBranch": "main"
  }
}
```

**Get a token:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: "NightShift AI"
4. Scope: `repo` (Full control of private repositories)
5. Generate and copy the token

### Option 2: GitHub OAuth (Better UX)

**File:** `data/github-oauth-config.json`

```json
{
  "clientId": "your_client_id",
  "clientSecret": "your_client_secret",
  "redirectUri": "http://localhost:3000/api/github/callback"
}
```

**Create OAuth App:**
1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - Application name: NightShift AI
   - Homepage URL: http://localhost:3000
   - Authorization callback URL: http://localhost:3000/api/github/callback
4. Copy Client ID and Client Secret

**User Flow:**
- User clicks "Connect GitHub" in onboarding
- Redirected to GitHub authorization page
- Clicks "Authorize" → Done
- Selects default repo from dropdown

## API Endpoints

### `GET /api/github/connect`
Initiates GitHub OAuth flow. Redirects user to GitHub authorization page.

### `GET /api/github/callback`
OAuth callback. Exchanges authorization code for access token and saves it.

### `GET /api/github/status`
Returns GitHub connection status and default repo.

**Response:**
```json
{
  "success": true,
  "data": {
    "connected": true,
    "defaultOwner": "roycemy",
    "defaultRepo": "nightshift-ai",
    "defaultBranch": "main"
  }
}
```

### `GET /api/github/repos`
Lists user's repositories for selection.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 123456,
      "name": "nightshift-ai",
      "fullName": "roycemy/nightshift-ai",
      "owner": "roycemy",
      "private": false,
      "defaultBranch": "main",
      "updatedAt": "2026-04-07T10:00:00Z"
    }
  ]
}
```

### `POST /api/github/set-repo`
Sets the default repository for code pushes.

**Request:**
```json
{
  "owner": "roycemy",
  "repo": "nightshift-ai",
  "defaultBranch": "main"
}
```

### `POST /api/github/save-token`
Fallback endpoint for manual token entry (when OAuth not configured).

**Request:**
```json
{
  "token": "github_pat_..."
}
```

## How It Works

### Continuation Agent Flow

When `continue-work.mjs` runs on a project:

1. **Check classification**: Is it `code_build`?
2. **Check GitHub connection**: Does user have token + default repo?
3. **If both true**: Push to GitHub instead of local save

**Code Path:**
```javascript
const classification = project.context?.classification || 'other';
const githubConfig = loadGitHubConfig(project.userId);
const useGitHub = classification === 'code_build' && 
                  githubConfig && 
                  githubConfig.token && 
                  githubConfig.defaultRepo;

if (useGitHub) {
  // Push to GitHub PR
  const result = await pushToGitHub({
    userId: project.userId,
    projectName: project.name,
    filePath: `src/nightshift/${safeName}.tsx`,
    content: generatedCode,
    commitMessage: "feat: Continue work on {project}",
    prTitle: "NightShift: Continued work on {project}",
    prBody: generatePRBody(...),
    dryRun: false
  });
} else {
  // Fallback to local file
  await saveContinuation(project, content);
}
```

### GitHub Push Module

**File:** `orchestration/github-push.mjs`

**Main function:** `pushToGitHub(options)`

**Process:**
1. Load GitHub config for user
2. Generate branch name: `nightshift/{project-name}-{date}`
3. Check if branch exists (allows multiple commits to same PR)
4. Create branch from base (if new)
5. Commit file to branch
6. Create pull request (if new branch)

**Dry-run mode:**
```bash
node orchestration/test-github-push.mjs --dry-run
```

Shows what would happen without actually pushing.

## Pull Request Format

**Branch:** `nightshift/project-name-2026-04-07`

**Title:** `NightShift: Continued work on {project name}`

**Body:**
```markdown
## 🌙 NightShift AI: Continued Work

**Project:** {project name}
**Description:** {project description}
**Next Step:** {next step from context}

---

### What was generated

NightShift analyzed your conversation history and project context to 
continue this work while you were away. This code was generated 
autonomously based on:

- Previous conversation context
- Project requirements and patterns
- Best practices for the detected tech stack

### Review checklist

- [ ] Code follows project conventions
- [ ] No sensitive data or credentials included
- [ ] Tests are included (if applicable)
- [ ] Documentation is updated (if applicable)

### Generated by

🤖 NightShift AI Continuation Agent  
📊 Tokens used: {token_count}  
⏰ Generated: {timestamp}

---

*This PR was created automatically by NightShift. Review carefully before merging.*
```

## File Extensions

The system auto-detects file extensions based on content:

- **React/TypeScript**: `.tsx` (if contains `import React` or `export default`)
- **JavaScript**: `.js` (if contains `function`, `const`, `let`)
- **Python**: `.py` (if contains `def` or `import`)
- **Fallback**: `.js`

## Project Classifications

Only `code_build` projects use GitHub push:

- ✅ **code_build** → GitHub PR
- ❌ **document_build** → Local file (`/data/continuations/`)
- ❌ **academic_deliverable** → Local file (`/data/continuations/`)
- ❌ **other** → Local file (`/data/continuations/`)

## Security

- **Never commits to main**: Always creates feature branch
- **User review required**: PR must be manually merged
- **Token storage**: Stored locally in `/data/github-config.json` (gitignored)
- **OAuth flow**: Secure authorization via GitHub's OAuth
- **Scope**: Only requests `repo` scope (no admin access)

## Testing

### Dry-Run Test
```bash
node orchestration/test-github-push.mjs --dry-run
```

Shows the complete plan without making changes:
- Branch name
- File path
- Commit message
- PR title and body
- Code preview

### Test Specific Project
```bash
node orchestration/test-github-push.mjs --project-id=PROJECT_ID --dry-run
```

### Live Test (Actually Creates PR)
```bash
node orchestration/test-github-push.mjs
```

**Warning:** This will create a real branch and PR in your repository!

## Troubleshooting

### "GitHub not connected for this user"
- Check `data/github-config.json` has correct user ID
- Verify token is present and valid
- Test token: `curl -H "Authorization: Bearer YOUR_TOKEN" https://api.github.com/user`

### "No default repository configured"
- Set `defaultRepo` in `data/github-config.json`
- Or use `/api/github/set-repo` endpoint

### "GitHub push failed"
- Check token has `repo` scope
- Verify repository exists and you have write access
- Check branch doesn't already exist with conflicts
- Falls back to local save automatically

### OAuth redirect not working
- Verify `redirectUri` matches GitHub OAuth app settings exactly
- Must be: `http://localhost:3000/api/github/callback`
- Check `clientId` and `clientSecret` are correct

## Example Output

**Dry-run test result:**
```
🧪 Testing GitHub Push Integration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mode: DRY RUN

📋 Selected Project:
   Name: NightShift AI Work Twin
   Classification: code_build
   Progress: 15%
   User ID: cmnghm3d80000qs284nklvz9m

✅ GitHub Connected:
   Repository: roycemy/nightshift-ai
   Default Branch: main

🚀 Testing GitHub Push...

📋 DRY RUN PLAN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Repository: roycemy/nightshift-ai
Base Branch: main
New Branch: nightshift/nightshift-ai-work-twin-2026-04-07

File Path: src/nightshift/nightshift-ai-work-twin.tsx

Commit Message:
feat: Continue work on NightShift AI Work Twin

Generated by NightShift AI continuation agent.
Progress: 15%
Next step: Define the exact MVP scope...

✅ Dry run complete - no actual changes made
```

## Future Enhancements

- [ ] Support multiple repositories per user
- [ ] Custom branch naming patterns
- [ ] Auto-merge for trusted projects
- [ ] PR templates per project
- [ ] Commit signing
- [ ] GitHub Actions integration
- [ ] PR status checks before merge
