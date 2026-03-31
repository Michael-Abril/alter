/**
 * OpenClaw — Claude.ai Chat History Scraper
 * 
 * Uses Playwright to open claude.ai, read recent conversations,
 * extract message content, and POST it to the NightShift ingest API.
 * 
 * Uses your existing browser session — no credentials stored in code.
 * 
 * Usage:
 *   node scrape-claude.mjs [--max=10] [--api=http://localhost:3000/api/chat-history/ingest] [--user=user_test_123] [--dry-run]
 */

import { chromium } from 'playwright';

// ─── Config ──────────────────────────────────────────────────────────
const args = parseArgs(process.argv.slice(2));
const MAX_CONVERSATIONS = parseInt(args.max || '5', 10);
const API_URL = args.api || 'http://localhost:3000/api/chat-history/ingest';
const USER_ID = args.user || 'user_test_123';
const DRY_RUN = args['dry-run'] !== undefined;
const HEADLESS = args.headless !== undefined;

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

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  log('Starting Claude.ai scraper');
  log(`Config: max=${MAX_CONVERSATIONS}, api=${API_URL}, user=${USER_ID}, dry-run=${DRY_RUN}`);

  // Launch browser with persistent context to reuse existing login session
  const userDataDir = getUserDataDir();
  log(`Using browser profile: ${userDataDir}`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: HEADLESS,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    // Navigate to Claude.ai
    log('Navigating to claude.ai...');
    await page.goto('https://claude.ai', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Check if we're logged in
    const currentUrl = page.url();
    log(`Current URL: ${currentUrl}`);

    if (currentUrl.includes('/login') || currentUrl.includes('/sign')) {
      log('❌ Not logged in. Please log into claude.ai manually in this browser window.');
      log('   The browser will stay open for 60 seconds. Log in, then re-run the script.');
      await page.waitForTimeout(60000);
      await context.close();
      process.exit(1);
    }

    log('✅ Logged in — session active');

    // Wait for the conversation list to load
    await page.waitForTimeout(2000);

    // Get conversation links from the sidebar
    const conversations = await getConversationList(page);
    const toScrape = conversations.slice(0, MAX_CONVERSATIONS);
    log(`Found ${conversations.length} conversations, scraping ${toScrape.length}`);

    if (toScrape.length === 0) {
      warn('No conversations found. The page layout may have changed.');
      await context.close();
      process.exit(1);
    }

    // Scrape each conversation
    const allMessages = [];
    for (let i = 0; i < toScrape.length; i++) {
      const conv = toScrape[i];
      log(`[${i + 1}/${toScrape.length}] Scraping: "${conv.title}"`);

      try {
        const messages = await scrapeConversation(page, conv);
        allMessages.push(...messages);
        log(`  → Extracted ${messages.length} messages`);
      } catch (err) {
        warn(`  → Failed to scrape "${conv.title}": ${err.message}`);
      }

      // Small delay between conversations
      if (i < toScrape.length - 1) {
        await page.waitForTimeout(1500);
      }
    }

    log(`Total messages extracted: ${allMessages.length}`);

    if (allMessages.length === 0) {
      warn('No messages extracted. Nothing to send.');
      await context.close();
      return;
    }

    // Send to ingest API
    if (DRY_RUN) {
      log('DRY RUN — would send this payload:');
      console.log(JSON.stringify({
        userId: USER_ID,
        source: 'claude',
        messages: allMessages,
      }, null, 2));
    } else {
      await sendToApi(allMessages);
    }

    log('Done ✅');
  } catch (err) {
    console.error('[openclaw:claude] Fatal error:', err);
  } finally {
    await context.close();
  }
}

// ─── Get conversation list from sidebar ──────────────────────────────
async function getConversationList(page) {
  // Claude.ai sidebar contains conversation links
  // Try multiple selectors since the UI may change
  const selectors = [
    'nav a[href*="/chat/"]',
    'a[href*="/chat/"]',
    '[data-testid*="conversation"] a',
    '[data-testid*="chat-list"] a',
    'aside a[href*="/chat/"]',
  ];

  for (const selector of selectors) {
    const links = await page.$$(selector);
    if (links.length > 0) {
      log(`Found conversations using selector: ${selector}`);
      const conversations = [];
      for (const link of links) {
        const href = await link.getAttribute('href');
        const title = await link.innerText().catch(() => 'Untitled');
        if (href && href.includes('/chat/')) {
          conversations.push({
            title: title.trim().split('\n')[0].slice(0, 100),
            url: href.startsWith('http') ? href : `https://claude.ai${href}`,
            id: href.split('/chat/')[1]?.split('?')[0] || 'unknown',
          });
        }
      }
      // Dedupe by id
      const seen = new Set();
      return conversations.filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
    }
  }

  // Fallback: try to find any links that look like conversations
  const allLinks = await page.$$('a');
  const conversations = [];
  for (const link of allLinks) {
    const href = await link.getAttribute('href').catch(() => null);
    if (href && href.includes('/chat/')) {
      const title = await link.innerText().catch(() => 'Untitled');
      conversations.push({
        title: title.trim().split('\n')[0].slice(0, 100),
        url: href.startsWith('http') ? href : `https://claude.ai${href}`,
        id: href.split('/chat/')[1]?.split('?')[0] || 'unknown',
      });
    }
  }

  const seen = new Set();
  return conversations.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

// ─── Scrape a single conversation ────────────────────────────────────
async function scrapeConversation(page, conv) {
  await page.goto(conv.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2500);

  // Scroll down to load all messages (Claude lazy-loads)
  await autoScroll(page);

  // Extract messages — try multiple selector strategies
  const messages = await extractMessages(page, conv);
  return messages;
}

async function extractMessages(page, conv) {
  const messages = [];
  const now = new Date();

  // Strategy 1: Look for message containers with role indicators
  const messageBlocks = await page.$$('[data-testid*="message"], [class*="Message"], [class*="message-content"], .font-claude-message, .font-user-message, [data-is-streaming]');

  if (messageBlocks.length > 0) {
    log(`  Using message block selectors (${messageBlocks.length} blocks)`);
    for (let i = 0; i < messageBlocks.length; i++) {
      const block = messageBlocks[i];
      const text = await block.innerText().catch(() => '');
      if (!text.trim()) continue;

      // Try to determine role from classes or attributes
      const classList = await block.getAttribute('class').catch(() => '');
      const testId = await block.getAttribute('data-testid').catch(() => '');
      const isHuman = classList?.includes('human') || classList?.includes('user') || testId?.includes('human') || testId?.includes('user');
      const role = isHuman ? 'user' : (i % 2 === 0 ? 'user' : 'assistant');

      messages.push({
        role,
        content: text.trim(),
        sessionId: conv.title,
        timestamp: new Date(now.getTime() - (messageBlocks.length - i) * 60000).toISOString(),
      });
    }
    if (messages.length > 0) return messages;
  }

  // Strategy 2: Look for the chat turn pattern (alternating human/assistant)
  const turnSelectors = [
    '.min-h-\\[20px\\]',
    '[class*="ConversationTurn"]',
    '[class*="prose"]',
    '[class*="whitespace-pre"]',
    'article',
  ];

  for (const selector of turnSelectors) {
    const turns = await page.$$(selector);
    if (turns.length >= 2) {
      log(`  Using turn selector: ${selector} (${turns.length} turns)`);
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
      messages.length = 0; // Reset if not enough
    }
  }

  // Strategy 3: Grab everything from the main content area
  const mainContent = await page.$('main') || await page.$('[role="main"]') || await page.$('.flex-1');
  if (mainContent) {
    const fullText = await mainContent.innerText().catch(() => '');
    if (fullText.trim().length > 50) {
      log('  Using full content fallback');
      messages.push({
        role: 'user',
        content: '[Full conversation text — manual parsing needed]',
        sessionId: conv.title,
        timestamp: now.toISOString(),
      });
      messages.push({
        role: 'assistant',
        content: fullText.trim().slice(0, 10000),
        sessionId: conv.title,
        timestamp: now.toISOString(),
      });
    }
  }

  return messages;
}

// ─── Auto-scroll to load all messages ────────────────────────────────
async function autoScroll(page) {
  await page.evaluate(async () => {
    const main = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
    const scrollEl = main.querySelector('[class*="overflow"]') || main;
    let lastHeight = scrollEl.scrollHeight;
    for (let i = 0; i < 10; i++) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
      await new Promise(r => setTimeout(r, 800));
      if (scrollEl.scrollHeight === lastHeight) break;
      lastHeight = scrollEl.scrollHeight;
    }
  });
}

// ─── Send to NightShift ingest API ───────────────────────────────────
async function sendToApi(messages) {
  const payload = {
    userId: USER_ID,
    source: 'claude',
    messages,
  };

  log(`Sending ${messages.length} messages to ${API_URL}...`);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (res.ok) {
      log(`✅ API response: ${JSON.stringify(data)}`);
    } else {
      warn(`API returned ${res.status}: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    warn(`Failed to reach API at ${API_URL}: ${err.message}`);
    log('Saving payload to fallback file...');
    const fs = await import('fs');
    const fallbackPath = `./claude-messages-${Date.now()}.json`;
    fs.writeFileSync(fallbackPath, JSON.stringify(payload, null, 2));
    log(`Saved to ${fallbackPath}`);
  }
}

// ─── Get browser user data directory ─────────────────────────────────
function getUserDataDir() {
  const home = process.env.HOME || process.env.USERPROFILE;

  if (args['profile-dir']) return args['profile-dir'];

  // Use a dedicated Playwright profile to avoid conflicts with your main Chrome
  const playwrightDir = `${home}/.nightshift-browser`;

  return playwrightDir;
}

// ─── Run ─────────────────────────────────────────────────────────────
main().catch(err => {
  console.error('[openclaw:claude] Unhandled error:', err);
  process.exit(1);
});
