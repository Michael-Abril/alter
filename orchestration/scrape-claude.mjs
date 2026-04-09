/**
 * OpenClaw — Claude.ai Chat History Scraper
 * 
 * Uses Playwright to open claude.ai, read recent conversations,
 * extract message content, and POST it to the NightShift ingest API.
 * 
 * Uses your existing browser session — no credentials stored in code.
 * 
 * Usage:
 *   node scrape-claude.mjs [--max=10] [--user=user_test_123] [--dry-run]
 *   node scrape-claude.mjs --continuous  # Re-scrape every 30 minutes
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { resolveInternalUserId } from './user-resolver.mjs';

// ─── Config ──────────────────────────────────────────────────────────
const args = parseArgs(process.argv.slice(2));
const MAX_CONVERSATIONS = parseInt(args.max || '20', 10);
const API_URL = args.api || 'http://localhost:3000/api/chat-history/ingest';
const USER_ID = args.user || 'user_3Bge5cdx4LkgxWgYXeYlU6Tm42a';
const DRY_RUN = args['dry-run'] !== undefined;
const HEADLESS = args.headless !== undefined;
const CONTINUOUS = args.continuous !== undefined;
const SCRAPE_INTERVAL = 30 * 60 * 1000;
const SINCE_DAYS = Math.max(1, parseInt(args['since-days'] || '3', 10));
const RESET_PROFILE = args['reset-profile'] !== undefined;

const SESSION_TRACKER_PATH = path.join(process.cwd(), 'data', 'scraped-sessions.json');
const SCREENSHOT_DIR = path.join(process.cwd(), 'data', 'debug-screenshots');

function parseArgs(argv) {
  const result = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      result[key] = val ?? '';
    }
  }
  return result;
}

function log(msg) {
  console.log(`[openclaw:claude] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

function warn(msg) {
  console.warn(`[openclaw:claude] ⚠ ${msg}`);
}

function isClaudeLoginUrl(url) {
  return url.includes('/login') || url.includes('/sign');
}

async function isCloudflareChallenge(page) {
  try {
    return await page.evaluate(() => {
      const text = document.body?.innerText?.toLowerCase() || '';
      return (
        text.includes('verify you are human') ||
        text.includes('performing security verification') ||
        text.includes('just a moment') ||
        text.includes('checking your browser') ||
        !!document.querySelector('iframe[src*="challenges.cloudflare.com"]') ||
        !!document.querySelector('#challenge-running') ||
        !!document.querySelector('.cf-turnstile')
      );
    });
  } catch { return false; }
}

async function waitForCloudflareToPass(page, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await isCloudflareChallenge(page))) return true;
    log('Cloudflare challenge detected — waiting for user to complete verification...');
    await page.waitForTimeout(3000);
  }
  return false;
}

async function waitForClaudeLogin(page) {
  log('Waiting for Claude login to complete...');
  log('   This window will stay open until you finish logging in.');
  while (true) {
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    if (!isClaudeLoginUrl(currentUrl)) {
      log('Claude login detected. Continuing scrape...');
      break;
    }
  }
}

async function saveDebugScreenshot(page, name) {
  try {
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const filepath = path.join(SCREENSHOT_DIR, `claude-${name}-${Date.now()}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    log(`Debug screenshot saved: ${filepath}`);
  } catch { /* non-fatal */ }
}

// ─── Session Tracking ────────────────────────────────────────────────
function loadScrapedSessions() {
  if (!fs.existsSync(SESSION_TRACKER_PATH)) return { claude: {}, chatgpt: {} };
  try {
    return JSON.parse(fs.readFileSync(SESSION_TRACKER_PATH, 'utf-8'));
  } catch {
    return { claude: {}, chatgpt: {} };
  }
}

function saveScrapedSessions(data) {
  const dir = path.dirname(SESSION_TRACKER_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SESSION_TRACKER_PATH, JSON.stringify(data, null, 2));
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const resolvedUserId = await resolveInternalUserId(USER_ID);
  log('Starting Claude.ai scraper');
  log(`Config: max=${MAX_CONVERSATIONS}, api=${API_URL}, user=${resolvedUserId}, dry-run=${DRY_RUN}, continuous=${CONTINUOUS}, since-days=${SINCE_DAYS}`);

  const trackedSessions = loadScrapedSessions();
  log(`Loaded session tracker: ${Object.keys(trackedSessions.claude || {}).length} sessions tracked`);

  const userDataDir = getUserDataDir();
  log(`Using browser profile: ${userDataDir}`);
  if (RESET_PROFILE && fs.existsSync(userDataDir)) {
    log('Resetting Claude browser profile...');
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: HEADLESS,
    viewport: { width: 1280, height: 900 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--no-sandbox',
    ],
    bypassCSP: true,
    ignoreHTTPSErrors: true,
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    log('Navigating to claude.ai...');
    await page.goto('https://claude.ai', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Handle Cloudflare challenge
    if (await isCloudflareChallenge(page)) {
      if (HEADLESS) {
        log('CLOUDFLARE_BLOCKED: Headless browser blocked by Cloudflare challenge');
        await saveDebugScreenshot(page, 'cloudflare-blocked');
        await context.close();
        process.exit(3);
      }
      log('Cloudflare challenge detected — please click "Verify you are human" in the browser window');
      const passed = await waitForCloudflareToPass(page, 120000);
      if (!passed) {
        warn('Cloudflare challenge timed out');
        await saveDebugScreenshot(page, 'cloudflare-timeout');
        await context.close();
        process.exit(3);
      }
      await page.waitForTimeout(2000);
    }

    const currentUrl = page.url();
    log(`Current URL: ${currentUrl}`);

    if (isClaudeLoginUrl(currentUrl)) {
      if (HEADLESS) {
        log('AUTH_REQUIRED: Not logged in to claude.ai');
        await saveDebugScreenshot(page, 'auth-required');
        await context.close();
        process.exit(2);
      }
      await waitForClaudeLogin(page);
      await page.goto('https://claude.ai', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);

      // May hit another Cloudflare challenge after login
      if (await isCloudflareChallenge(page)) {
        log('Post-login Cloudflare challenge — please verify again');
        await waitForCloudflareToPass(page, 60000);
        await page.waitForTimeout(2000);
      }
    }

    log('Logged in — session active');

    // Wait for sidebar to populate with smart polling instead of fixed timeout
    let conversations = [];
    const maxWaitMs = HEADLESS ? 15000 : 60000;
    const startWait = Date.now();
    while (Date.now() - startWait < maxWaitMs) {
      conversations = await getConversationList(page);
      if (conversations.length > 0) break;
      log(`Waiting for conversation list... (${Math.round((Date.now() - startWait) / 1000)}s)`);
      await page.waitForTimeout(2000);
    }

    log(`Found ${conversations.length} conversations`);

    if (conversations.length === 0) {
      warn('No conversations found. The page layout may have changed.');
      await saveDebugScreenshot(page, 'no-conversations');
      await context.close();
      process.exit(1);
    }

    // Filter conversations to scrape
    const toScrape = [];
    for (const conv of conversations) {
      if (toScrape.length >= MAX_CONVERSATIONS) break;
      const incrementalMode = !CONTINUOUS && !args['since-days'];
      if (incrementalMode && trackedSessions.claude[conv.id]) continue;
      toScrape.push(conv);
    }

    log(`Scraping ${toScrape.length} conversations (${conversations.length - toScrape.length} already scraped)`);

    if (toScrape.length === 0) {
      log('All conversations already scraped. Nothing new to process.');
      await context.close();
      return;
    }

    const allMessages = [];
    const scrapedSessionData = {};
    
    for (let i = 0; i < toScrape.length; i++) {
      const conv = toScrape[i];
      log(`[${i + 1}/${toScrape.length}] Scraping: "${conv.title}"`);

      try {
        const messages = await scrapeConversation(page, conv);
        allMessages.push(...messages);
        log(`  -> Extracted ${messages.length} messages`);
        
        scrapedSessionData[conv.id] = {
          title: conv.title,
          messageCount: messages.length,
          lastScraped: new Date().toISOString(),
        };
      } catch (err) {
        warn(`  -> Failed to scrape "${conv.title}": ${err.message}`);
        await saveDebugScreenshot(page, `fail-${conv.id.slice(0, 8)}`);
      }

      if (i < toScrape.length - 1) await page.waitForTimeout(500);
    }

    const cutoffTs = Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000;
    const recentMessages = allMessages.filter((msg) => {
      const ts = new Date(msg.timestamp).getTime();
      return Number.isFinite(ts) && ts >= cutoffTs;
    });

    log(`Total messages extracted: ${allMessages.length}`);
    log(`Messages within last ${SINCE_DAYS} day(s): ${recentMessages.length}`);

    if (recentMessages.length === 0) {
      warn('No messages extracted. Nothing to send.');
      await context.close();
      return;
    }

    if (DRY_RUN) {
      log('DRY RUN — would send this payload:');
      console.log(JSON.stringify({
        userId: resolvedUserId,
        source: 'claude',
        messages: recentMessages,
      }, null, 2));
    } else {
      await sendToApi(recentMessages, resolvedUserId);
      
      trackedSessions.claude = { ...trackedSessions.claude, ...scrapedSessionData };
      saveScrapedSessions(trackedSessions);
      log(`Updated session tracker: ${Object.keys(trackedSessions.claude).length} total sessions`);
      
      log('Running embedding pipeline on new messages...');
      await runEmbeddingPipeline();
    }

    log('Done');
  } catch (err) {
    console.error('[openclaw:claude] Fatal error:', err);
    await saveDebugScreenshot(page, 'fatal').catch(() => {});
  } finally {
    await context.close();
  }
  
  if (CONTINUOUS) {
    log(`Waiting ${SCRAPE_INTERVAL / 60000} minutes before next scrape...`);
    await new Promise(resolve => setTimeout(resolve, SCRAPE_INTERVAL));
    log('Starting next scrape cycle...');
    await main();
  }
}

// ─── Get conversation list from sidebar ──────────────────────────────
async function getConversationList(page) {
  // Claude.ai sidebar uses /chat/ links — try multiple selector strategies
  const selectorGroups = [
    // High-confidence: nav links with /chat/ href
    'nav a[href*="/chat/"]',
    'aside a[href*="/chat/"]',
    // Medium-confidence: any link with /chat/
    'a[href*="/chat/"]',
    // Lower-confidence: data-testid patterns
    '[data-testid*="conversation"] a',
    '[data-testid*="chat-list"] a',
    '[data-testid*="history"] a',
  ];

  for (const selector of selectorGroups) {
    try {
      const links = await page.$$(selector);
      if (links.length === 0) continue;

      const conversations = [];
      for (const link of links) {
        const href = await link.getAttribute('href').catch(() => null);
        if (!href || !href.includes('/chat/')) continue;
        const title = await link.innerText().catch(() => 'Untitled');
        const id = href.split('/chat/')[1]?.split('?')[0] || 'unknown';
        if (id === 'unknown') continue;
        conversations.push({
          title: title.trim().split('\n')[0].slice(0, 100),
          url: href.startsWith('http') ? href : `https://claude.ai${href}`,
          id,
        });
      }

      const seen = new Set();
      const deduped = conversations.filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });

      if (deduped.length > 0) {
        log(`Found ${deduped.length} conversations using selector: ${selector}`);
        return deduped;
      }
    } catch { /* selector failed, try next */ }
  }

  // Last resort: scan ALL links on the page for /chat/ patterns
  try {
    const allConvs = await page.$$eval('a', links =>
      links
        .filter(l => l.href && l.href.includes('/chat/'))
        .map(l => ({
          title: (l.innerText || 'Untitled').trim().split('\n')[0].slice(0, 100),
          url: l.href,
          id: l.href.split('/chat/')[1]?.split('?')[0] || 'unknown',
        }))
        .filter(c => c.id !== 'unknown')
    );
    const seen = new Set();
    return allConvs.filter(c => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  } catch {
    return [];
  }
}

// ─── Scrape a single conversation ────────────────────────────────────
async function scrapeConversation(page, conv) {
  await page.goto(conv.url, { waitUntil: 'domcontentloaded', timeout: 20000 });

  // Wait for messages to render — poll instead of fixed sleep
  try {
    await page.waitForSelector(
      '[data-testid="user-message"], .font-claude-message, [data-test-render-count]',
      { timeout: 6000 }
    );
  } catch { /* proceed with what we have */ }

  await autoScroll(page);
  return await extractMessages(page, conv);
}

async function extractMessages(page, conv) {
  const now = new Date();

  // Strategy 1 (highest confidence): Claude-specific user-message + font-claude-message selectors
  const s1Messages = await page.evaluate(() => {
    const results = [];
    const userMsgs = document.querySelectorAll('[data-testid="user-message"]');
    const claudeMsgs = document.querySelectorAll('.font-claude-message');

    // Build ordered list using document position via data-test-render-count containers
    const allTurns = [];

    userMsgs.forEach(el => {
      const container = el.closest('[data-test-render-count]');
      const pos = container
        ? Array.from(document.querySelectorAll('[data-test-render-count]')).indexOf(container)
        : -1;
      const paragraphs = Array.from(el.querySelectorAll('p'))
        .map(p => p.textContent?.trim())
        .filter(Boolean)
        .join('\n\n');
      const text = paragraphs || el.innerText?.trim() || '';
      if (text) allTurns.push({ role: 'user', content: text, pos });
    });

    claudeMsgs.forEach(el => {
      const container = el.closest('[data-test-render-count]');
      const pos = container
        ? Array.from(document.querySelectorAll('[data-test-render-count]')).indexOf(container)
        : -1;
      // Collect paragraphs, code blocks, and lists properly
      const parts = [];
      el.querySelectorAll('p, pre, ol, ul').forEach(child => {
        if (child.tagName === 'PRE') {
          const code = child.querySelector('code');
          const lang = code?.className?.match(/language-(\w+)/)?.[1] || '';
          parts.push('```' + lang + '\n' + (code || child).textContent.trim() + '\n```');
        } else {
          const t = child.textContent?.trim();
          if (t) parts.push(t);
        }
      });
      const text = parts.join('\n\n') || el.innerText?.trim() || '';
      if (text) allTurns.push({ role: 'assistant', content: text, pos });
    });

    allTurns.sort((a, b) => a.pos - b.pos);
    return allTurns.map(t => ({ role: t.role, content: t.content }));
  });

  if (s1Messages.length >= 2) {
    log(`  Using Claude-specific selectors (${s1Messages.length} messages)`);
    return s1Messages.map((m, i) => ({
      ...m,
      sessionId: conv.title,
      timestamp: new Date(now.getTime() - (s1Messages.length - i) * 60000).toISOString(),
    }));
  }

  // Strategy 2: Look for data-message-author-role (generic, used by some UI variants)
  const s2Messages = await page.evaluate(() => {
    const blocks = document.querySelectorAll('[data-message-author-role]');
    return Array.from(blocks).map(block => ({
      role: block.getAttribute('data-message-author-role') || 'unknown',
      content: block.innerText?.trim() || '',
    })).filter(m => (m.role === 'user' || m.role === 'assistant') && m.content);
  });

  if (s2Messages.length >= 2) {
    log(`  Using data-message-author-role (${s2Messages.length} messages)`);
    return s2Messages.map((m, i) => ({
      ...m,
      sessionId: conv.title,
      timestamp: new Date(now.getTime() - (s2Messages.length - i) * 60000).toISOString(),
    }));
  }

  // Strategy 3: Turn containers with [data-test-render-count], alternating roles
  const s3Messages = await page.evaluate(() => {
    const turns = document.querySelectorAll('[data-test-render-count]');
    return Array.from(turns).map((el, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: el.innerText?.trim() || '',
    })).filter(m => m.content && m.content.length > 3);
  });

  if (s3Messages.length >= 2) {
    log(`  Using data-test-render-count turns (${s3Messages.length} messages)`);
    return s3Messages.map((m, i) => ({
      ...m,
      sessionId: conv.title,
      timestamp: new Date(now.getTime() - (s3Messages.length - i) * 60000).toISOString(),
    }));
  }

  // Strategy 4: Alternating turn containers (article, .group, etc.)
  const turnSelectors = ['article', '[class*="ConversationTurn"]', '.group'];
  for (const selector of turnSelectors) {
    const turns = await page.$$(selector);
    if (turns.length >= 2) {
      log(`  Using fallback turn selector: ${selector} (${turns.length} turns)`);
      const messages = [];
      for (let i = 0; i < turns.length; i++) {
        const text = await turns[i].innerText().catch(() => '');
        if (!text.trim() || text.trim().length < 3) continue;
        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: text.trim(),
          sessionId: conv.title,
          timestamp: new Date(now.getTime() - (turns.length - i) * 60000).toISOString(),
        });
      }
      if (messages.length >= 2) return messages;
    }
  }

  // Strategy 5: Full page fallback
  const mainContent = await page.$('main') || await page.$('[role="main"]') || await page.$('.flex-1');
  if (mainContent) {
    const fullText = await mainContent.innerText().catch(() => '');
    if (fullText.trim().length > 50) {
      log('  Using full content fallback (could not identify individual messages)');
      await saveDebugScreenshot(page, `fallback-${conv.id.slice(0, 8)}`);
      return [{
        role: 'assistant',
        content: fullText.trim().slice(0, 10000),
        sessionId: conv.title,
        timestamp: now.toISOString(),
      }];
    }
  }

  warn(`  No messages extracted for "${conv.title}"`);
  await saveDebugScreenshot(page, `empty-${conv.id.slice(0, 8)}`);
  return [];
}

// ─── Auto-scroll to load all messages ────────────────────────────────
async function autoScroll(page) {
  await page.evaluate(async () => {
    // Claude uses various scroll containers — find the right one
    const candidates = [
      document.querySelector('[class*="overflow-y-auto"]'),
      document.querySelector('[class*="overflow-auto"]'),
      document.querySelector('main [class*="overflow"]'),
      document.querySelector('main'),
      document.querySelector('[role="main"]'),
    ].filter(Boolean);

    const scrollEl = candidates[0] || document.documentElement;
    let lastHeight = scrollEl.scrollHeight;
    for (let i = 0; i < 15; i++) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
      await new Promise(r => setTimeout(r, 600));
      if (scrollEl.scrollHeight === lastHeight) break;
      lastHeight = scrollEl.scrollHeight;
    }
  });
}

// ─── Send to NightShift ingest API ───────────────────────────────────
async function sendToApi(messages, resolvedUserId) {
  log(`Sending ${messages.length} messages to ${API_URL}...`);

  const BATCH_SIZE = 50;
  let totalIngested = 0;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const payload = {
      userId: resolvedUserId,
      source: 'claude',
      messages: batch,
    };

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        totalIngested += batch.length;
        log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ingested ${batch.length} messages (${totalIngested}/${messages.length})`);
      } else {
        warn(`Batch ${Math.floor(i / BATCH_SIZE) + 1} returned ${res.status}: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      warn(`Failed to reach API at ${API_URL}: ${err.message}`);
      log('Saving remaining payload to fallback file...');
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      const fallbackPath = path.join(dataDir, `claude-messages-${Date.now()}.json`);
      fs.writeFileSync(
        fallbackPath,
        JSON.stringify({ userId: resolvedUserId, source: 'claude', messages }, null, 2)
      );
      log(`Saved to ${fallbackPath}`);
      return;
    }
  }

  log(`All ${totalIngested} messages sent successfully`);
}

// ─── Run embedding pipeline ──────────────────────────────────────────
async function runEmbeddingPipeline() {
  return new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'embed-chat-history.ts');
    if (!fs.existsSync(scriptPath)) {
      log('Embedding script not found, skipping.');
      return resolve();
    }
    const child = spawn('npx', ['tsx', scriptPath], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) log('Embedding pipeline completed');
      else warn(`Embedding pipeline exited with code ${code}`);
      resolve();
    });

    child.on('error', (err) => {
      warn(`Failed to run embedding pipeline: ${err.message}`);
      resolve();
    });
  });
}

// ─── Get browser user data directory ─────────────────────────────────
function getUserDataDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (args['profile-dir']) return args['profile-dir'];
  return `${home}/.nightshift-browser-claude`;
}

// ─── Run ─────────────────────────────────────────────────────────────
main().catch(err => {
  console.error('[openclaw:claude] Unhandled error:', err);
  process.exit(1);
});
