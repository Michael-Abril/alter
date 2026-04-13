# 📧 Gmail Integration Setup Guide

## Current Status: ⚠️ **CREDENTIALS REQUIRED**

Gmail OAuth credentials are **NOT** configured. The onboarding flow will show a clear warning and allow users to skip this step.

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Google Cloud Project
1. Go to: **https://console.cloud.google.com/**
2. Click **"Select a project"** → **"New Project"**
3. Name it: **"NightShift AI"**
4. Click **"Create"**

### Step 2: Enable Gmail API
1. Go to: **https://console.cloud.google.com/apis/library/gmail.googleapis.com**
2. Make sure your **NightShift AI** project is selected
3. Click **"Enable"**

### Step 3: Configure OAuth Consent Screen
1. Go to: **https://console.cloud.google.com/apis/credentials/consent**
2. Select **"External"** user type → Click **"Create"**
3. Fill in:
   - **App name:** NightShift AI
   - **User support email:** Your email
   - **Developer contact:** Your email
4. Click **"Save and Continue"**
5. On **Scopes** page, click **"Add or Remove Scopes"**
6. Add these scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.modify`
7. Click **"Update"** → **"Save and Continue"**
8. On **Test users** page, add your email address
9. Click **"Save and Continue"** → **"Back to Dashboard"**

### Step 4: Create OAuth Credentials
1. Go to: **https://console.cloud.google.com/apis/credentials**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Application type: **"Web application"**
4. Name: **"NightShift Gmail Integration"**
5. **Authorized redirect URIs:** Add:
   ```
   http://localhost:3000/api/gmail/callback
   ```
   For production, also add:
   ```
   https://yourdomain.com/api/gmail/callback
   ```
6. Click **"Create"**
7. **Copy the Client ID and Client Secret**

### Step 5: Add Credentials to .env
Open `.env` file and update:
```env
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback
```

### Step 6: Restart Dev Server
```bash
# Stop the current dev server (Ctrl+C)
npm run dev
```

---

## 🧪 Testing the Gmail Flow

### 1. Test Connection Status
```bash
npm run gmail:test
```

This will show:
- ✅ User found
- ✅ Gmail connection status
- 📧 Email counts (sent/received/embedded)
- ✍️ Draft counts

### 2. Connect Gmail (via Browser)
1. Visit: `http://localhost:3000/api/gmail/connect`
2. Sign in with Google
3. Authorize the requested permissions
4. You'll be redirected back to `/onboarding?step=2&gmail=connected`

### 3. Sync Emails
```bash
npm run gmail:sync
```

This will:
- Pull last 100 sent emails
- Pull last 50 received emails
- Store them in the `Email` table
- Skip duplicates

Expected output:
```
📧 Starting Gmail sync...
✓ Found user: user@example.com
📤 Fetching sent emails...
   Found 100 sent emails
📥 Fetching received emails...
   Found 50 received emails
   Processed 10/150...
   Processed 20/150...
   ...
✅ Gmail sync complete!
   Imported: 150 new emails
   Skipped: 0 existing emails
```

### 4. Embed Emails
```bash
npm run embed:emails
```

This will:
- Generate embeddings for all un-embedded emails
- Store vectors in `data/vectors/{userId}/`
- Mark emails as `embedded: true`
- Use OpenAI if `OPENAI_API_KEY` is set, otherwise local TF-IDF

Expected output:
```
🔮 Starting email embedding...
✓ Found user: user@example.com
  Using: Local TF-IDF embeddings
📧 Found 150 un-embedded emails
   Embedded 50/150...
   Embedded 100/150...
   Embedded 150/150...
✅ Email embedding complete!
   Total embedded: 150 emails
```

### 5. Test Email Draft Generation
```bash
# Coming soon: npm run draft:test
```

---

## 📊 What You'll See

After completing the setup:

### In Database:
- **Email table:** 150+ emails with metadata
- **User table:** `gmailConnected: true`, `gmailToken` set
- **Vectors:** Embeddings stored in `data/vectors/{userId}/`

### In Onboarding:
- ✅ Green checkmark: "Gmail Connected"
- Can proceed to next step

### In Dashboard:
- Email stats visible
- Draft generation enabled
- Email-based writing style analysis

---

## 🔧 Troubleshooting

### "Unauthorized" Error
- Make sure you've added your email as a test user in OAuth consent screen
- Check that scopes are correctly configured

### "Invalid Credentials" Error
- Verify `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` in `.env`
- Restart dev server after updating `.env`

### "No Emails Found"
- Check Gmail API is enabled
- Verify OAuth token has correct scopes
- Try re-connecting via `/api/gmail/connect`

### Embedding Fails
- Check `data/vectors/` directory exists and is writable
- If using OpenAI, verify `OPENAI_API_KEY` is set
- Local TF-IDF will work without any API key

---

## 🎯 Next Steps After Setup

1. **Test the full flow:**
   ```bash
   npm run gmail:test
   npm run gmail:sync
   npm run embed:emails
   ```

2. **Verify in database:**
   ```bash
   npm run db:studio
   ```
   Check:
   - User has `gmailConnected: true`
   - Email table has records
   - Emails have `embedded: true`

3. **Test draft generation:**
   - Go to `/dashboard/drafts`
   - Check for auto-generated email drafts
   - Approve/reject drafts

4. **Monitor logs:**
   - Check terminal for sync status
   - Look for errors in browser console
   - Review `data/logs/` for orchestration logs

---

## 🚨 Important Notes

- **Test Users:** In development, only emails added as "test users" can connect
- **Production:** You'll need to submit for Google verification for public use
- **Rate Limits:** Gmail API has quotas - sync carefully
- **Privacy:** Email content is stored locally in SQLite
- **Embeddings:** Vectors are stored locally in `data/vectors/`

---

## 📝 Mock Mode (Current State)

Until credentials are configured, the onboarding shows:

```
⚠️ Gmail OAuth Not Configured
Gmail setup requires Google Cloud credentials. 
You can skip this step and connect later from Settings.

[Try to Connect Gmail]  [Skip for Now]
```

This allows beta testers to:
- Complete onboarding without Gmail
- Test other features
- Come back to Gmail setup later

---

## ✅ Success Checklist

- [ ] Google Cloud project created
- [ ] Gmail API enabled
- [ ] OAuth consent screen configured
- [ ] OAuth credentials created
- [ ] Credentials added to `.env`
- [ ] Dev server restarted
- [ ] Gmail connected via browser
- [ ] Emails synced (`npm run gmail:sync`)
- [ ] Emails embedded (`npm run embed:emails`)
- [ ] Verified in database (`npm run db:studio`)
- [ ] Tested draft generation

---

**Need help?** Check the troubleshooting section or review the Gmail API docs:
https://developers.google.com/gmail/api/guides
