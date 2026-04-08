/**
 * OpenClaw — ChatGPT Chat History Scraper
 * 
 * Uses Playwright to open chatgpt.com, read recent conversations,
 * extract message content, and POST it to the NightShift ingest API.
 * 
 * Uses your existing browser session — no credentials stored in code.
 * 
 * Usage:
 *   node scrape-chatgpt.mjs [--max=10] [--user=user_test_123] [--dry-run]
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { resolveInternalUserId } from './user-resolver.mjs';

// ─── Config ──────────────────────────────────────────────────────────
const args = parseArgs(process.argv.slice(2));
const MAX_CONVERSATIONS = parseInt(args.max || '5', 10);
const API_URL = args.api || 'http://localhost:3000/api/chat-history/ingest';
const USER_ID = args.user || 'user_3Bge5cdx4LkgxWgYXeYlU6Tm42a';
const DRY_RUN = args['dry-run'] !== undefined;
const HEADLESS = args.headless !== undefined;
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
  console.log(`[openclaw:chatgpt] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

function warn(msg) {
  console.warn(`[openclaw:chatgpt] ⚠ ${msg}`);
}

function isChatGPTAuthUrl(url) {
  try {
    const u = new URL(url);
    return (
      u.pathname.includes('/auth/login') ||
      u.hostname.includes('auth0.openai.com') ||
      u.hostname.includes('login.microsoftonline') ||
      u.hostname.includes('accounts.google.com')
    );
  } catch {
    return url.includes('/auth/login');
  }
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

async function isLikelyAuthStep(page) {
  try {
    return await page.evaluate(() => {
      const url = window.location.href.toLowerCase();
      if (url.includes('/auth/') || url.includes('auth0') || url.includes('signin')) return true;
      if (document.querySelector('input[type="password"], input[type="email"]')) return true;
      const text = document.body?.innerText?.toLowerCase() || '';
      return (
        text.includes('continue with google') ||
        text.includes('enter your password') ||
        text.includes('welcome back') ||
        text.includes('sign in')
      );
    });
  } catch {
    return false;
  }
}

async function waitForChatGPTLogin(page) {
  log('Waiting for ChatGPT login to complete...');
  log('   This window will stay open until you finish logging in.');
  while (true) {
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    const stillAuth = isChatGPTAuthUrl(currentUrl) || (await isLikelyAuthStep(page));
    if (!stillAuth) {
      log('ChatGPT auth flow completed. Continuing scrape...');
      break;
    }
  }
}

async function saveDebugScreenshot(page, name) {
  try {
    if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const filepath = path.join(SCREENSHOT_DIR, `chatgpt-${name}-${Date.now()}.png`);
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
  log('Starting ChatGPT scraper');
  log(`Config: max=${MAX_CONVERSATIONS}, api=${API_URL}, user=${resolvedUserId}, dry-run=${DRY_RUN}, since-days=${SINCE_DAYS}`);

  const trackedSessions = loadScrapedSessions();
  log(`Loaded session tracker: ${Object.keys(trackedSessions.chatgpt || {}).length} sessions tracked`);

  const userDataDir = getUserDataDir();
  log(`Using browser profile: ${userDataDir}`);
  if (RESET_PROFILE && fs.existsSync(userDataDir)) {
    log('Resetting ChatGPT browser profile...');
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: HEADLESS,
    viewport: { width: 1280, height: 900 },
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
    ],
    bypassCSP: true,
    ignoreHTTPSErrors: true,
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    log('Navigating to chatgpt.com...');
    await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

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

    if (isChatGPTAuthUrl(currentUrl) || (await isLikelyAuthStep(page))) {
      if (HEADLESS) {
        warn('AUTH_REQUIRED: Not logged in to ChatGPT.');
        await saveDebugScreenshot(page, 'auth-required');
        await context.close();
        process.exit(2);
      }
      await waitForChatGPTLogin(page);
      await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);

      if (await isCloudflareChallenge(page)) {
        log('Post-login Cloudflare challenge — please verify again');
        await waitForCloudflareToPass(page, 60000);
        await page.waitForTimeout(2000);
      }
    }

    log('Logged in — session active');

    // Wait for sidebar to populate with smart polling
    let conversations = [];
    const maxWaitMs = HEADLESS ? 15000 : 60000;
    const startWait = Date.now();
    while (Date.now() - startWait < maxWaitMs) {
      conversations = await getConversationList(page);
      if (conversations.length > 0) break;
      if (await isLikelyAuthStep(page)) {
        log('Still in ChatGPT auth flow...');
      }
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

    // Filter: skip already-scraped conversations, cap to MAX
    const toScrape = [];
    const incrementalMode = !args['since-days'];
    for (const conv of conversations) {
      if (toScrape.length >= MAX_CONVERSATIONS) break;
      if (incrementalMode && trackedSessions.chatgpt?.[conv.id]) continue;
      toScrape.push(conv);
    }

    log(`Scraping ${toScrape.length} conversations (${conversations.length - toScrape.length} skipped)`);

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

      if (i < toScrape.length - 1) await page.waitForTimeout(1500);
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
        source: 'chatgpt',
        messages: recentMessages,
      }, null, 2));
    } else {
      await sendToApi(recentMessages, resolvedUserId);

      trackedSessions.chatgpt = { ...trackedSessions.chatgpt, ...scrapedSessionData };
      saveScrapedSessions(trackedSessions);
      log(`Updated session tracker: ${Object.keys(trackedSessions.chatgpt).length} total sessions`);
    }

    log('Done');
  } catch (err) {
    console.error('[openclaw:chatgpt] Fatal error:', err);
    await saveDebugScreenshot(page, 'fatal').catch(() => {});
  } finally {
    await context.close();
  }
}

// ─── Get conversation list from sidebar ──────────────────────────────
async function getConversationList(page) {
  // ChatGPT sidebar uses /c/ links
  const selectorGroups = [
    'nav a[href*="/c/"]',
    'a[href^="/c/"]',
    'a[href*="/c/"]',
    'nav ol li a',
    'nav li a[href*="/c/"]',
    'aside a[href*="/c/"]',
  ];

  for (const selector of selectorGroups) {
    try {
      const links = await page.$$(selector);
      if (links.length === 0) continue;

      const conversations = [];
      for (const link of links) {
        const href = await link.getAttribute('href').catch(() => null);
        if (!href || !href.includes('/c/')) continue;
        const title = await link.innerText().catch(() => 'Untitled');
        const id = href.split('/c/')[1]?.split('?')[0] || 'unknown';
        if (id === 'unknown') continue;
        conversations.push({
          title: title.trim().split('\n')[0].slice(0, 100),
          url: href.startsWith('http') ? href : `https://chatgpt.com${href}`,
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

  // Last resort: scan ALL links
  try {
    const allConvs = await page.$$eval('a', links =>
      links
        .filter(l => l.href && l.href.includes('/c/'))
        .map(l => ({
          title: (l.innerText || 'Untitled').trim().split('\n')[0].slice(0, 100),
          url: l.href,
          id: l.href.split('/c/')[1]?.split('?')[0] || 'unknown',
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

  // Wait for message elements to appear
  const msgWaitStart = Date.now();
  let hasMessages = false;
  while (Date.now() - msgWaitStart < 8000) {
    hasMessages = await page.evaluate(() => {
      return !!(
        document.querySelector('[data-message-author-role]') ||
        document.querySelector('[data-testid^="conversation-turn"]') ||
        document.querySelector('article')
      );
    });
    if (hasMessages) break;
    await page.waitForTimeout(500);
  }

  await autoScroll(page);
  return await extractMessages(page, conv);
}

async function extractMessages(page, conv) {
  const now = new Date();

  // Strategy 1 (highest confidence): data-message-author-role with proper content extraction
  const s1Messages = await page.evaluate(() => {
    const blocks = document.querySelectorAll('[data-message-author-role]');
    return Array.from(blocks).map(block => {
      const role = block.getAttribute('data-message-author-role');
      if (role !== 'user' && role !== 'assistant') return null;

      // Extract content from the right child element rather than the whole block
      const contentEl =
        block.querySelector('[data-message-content]') ||
        block.querySelector('.markdown') ||
        block.querySelector('.prose') ||
        block.querySelector('.whitespace-pre-wrap') ||
        block;

      // Handle code blocks properly
      const clone = contentEl.cloneNode(true);
      clone.querySelectorAll('button').forEach(b => b.remove());
      clone.querySelectorAll('pre').forEach(pre => {
        const code = pre.querySelector('code');
        const lang = code?.className?.match(/language-(\w+)/)?.[1] || '';
        const text = (code || pre).textContent.trim();
        pre.replaceWith('```' + lang + '\n' + text + '\n```');
      });

      const text = clone.innerText?.trim() || '';
      return text ? { role, content: text } : null;
    }).filter(Boolean);
  });

  if (s1Messages.length >= 2) {
    log(`  Using data-message-author-role (${s1Messages.length} messages)`);
    return s1Messages.map((m, i) => ({
      ...m,
      sessionId: conv.title,
      timestamp: new Date(now.getTime() - (s1Messages.length - i) * 60000).toISOString(),
    }));
  }

  // Strategy 2: conversation-turn test IDs
  const s2Messages = await page.evaluate(() => {
    const turns = document.querySelectorAll('[data-testid^="conversation-turn"]');
    return Array.from(turns).map((el, i) => {
      const roleEl = el.querySelector('[data-message-author-role]');
      const role = roleEl?.getAttribute('data-message-author-role') || (i % 2 === 0 ? 'user' : 'assistant');
      const content = el.innerText?.trim() || '';
      return (role === 'user' || role === 'assistant') && content.length > 3
        ? { role, content }
        : null;
    }).filter(Boolean);
  });

  if (s2Messages.length >= 2) {
    log(`  Using conversation-turn testids (${s2Messages.length} messages)`);
    return s2Messages.map((m, i) => ({
      ...m,
      sessionId: conv.title,
      timestamp: new Date(now.getTime() - (s2Messages.length - i) * 60000).toISOString(),
    }));
  }

  // Strategy 3: article elements
  const articles = await page.$$('article');
  if (articles.length >= 2) {
    log(`  Using article elements (${articles.length} articles)`);
    const messages = [];
    for (let i = 0; i < articles.length; i++) {
      const text = await articles[i].innerText().catch(() => '');
      if (!text.trim() || text.trim().length < 3) continue;
      messages.push({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: text.trim(),
        sessionId: conv.title,
        timestamp: new Date(now.getTime() - (articles.length - i) * 60000).toISOString(),
      });
    }
    if (messages.length >= 2) return messages;
  }

  // Strategy 4: Full page fallback
  const mainContent = await page.$('main') || await page.$('[role="main"]');
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

// ─── Auto-scroll ─────────────────────────────────────────────────────
async function autoScroll(page) {
  await page.evaluate(async () => {
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

// ─── Send to NightShift ingest API (batched) ─────────────────────────
async function sendToApi(messages, resolvedUserId) {
  log(`Sending ${messages.length} messages to ${API_URL}...`);

  const BATCH_SIZE = 50;
  let totalIngested = 0;

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    const payload = {
      userId: resolvedUserId,
      source: 'chatgpt',
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
      const fallbackPath = path.join(dataDir, `chatgpt-messages-${Date.now()}.json`);
      fs.writeFileSync(fallbackPath, JSON.stringify({
        userId: resolvedUserId,
        source: 'chatgpt',
        messages,
      }, null, 2));
      log(`Saved to ${fallbackPath}`);
      return;
    }
  }

  log(`All ${totalIngested} messages sent successfully`);
}

// ─── Get browser user data directory ─────────────────────────────────
function getUserDataDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (args['profile-dir']) return args['profile-dir'];
  return `${home}/.nightshift-browser-chatgpt`;
}

// ─── Run ─────────────────────────────────────────────────────────────
main().catch(err => {
  console.error('[openclaw:chatgpt] Unhandled error:', err);
  process.exit(1);
});
