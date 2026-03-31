/**
 * OpenClaw — ChatGPT Chat History Scraper
 * 
 * Uses Playwright to open chat.openai.com, read recent conversations,
 * extract message content, and POST it to the NightShift ingest API.
 * 
 * Uses your existing browser session — no credentials stored in code.
 * 
 * Usage:
 *   node scrape-chatgpt.mjs [--max=10] [--api=http://localhost:3000/api/chat-history/ingest] [--user=user_test_123] [--dry-run]
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
  console.log(`[openclaw:chatgpt] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

function warn(msg) {
  console.warn(`[openclaw:chatgpt] ⚠ ${msg}`);
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  log('Starting ChatGPT scraper');
  log(`Config: max=${MAX_CONVERSATIONS}, api=${API_URL}, user=${USER_ID}, dry-run=${DRY_RUN}`);

  const userDataDir = getUserDataDir();
  log(`Using browser profile: ${userDataDir}`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: HEADLESS,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] || await context.newPage();

  try {
    log('Navigating to chatgpt.com...');
    await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    log(`Current URL: ${currentUrl}`);

    if (currentUrl.includes('/auth/login') || currentUrl.includes('login')) {
      warn('Not logged in. Please log in to ChatGPT in your browser first.');
      await context.close();
      return;
    }

    // Wait for user to manually log in if needed
    log('⏸️  Waiting 30 seconds for you to log in if needed...');
    log('   (Browser window should be visible - please log in to ChatGPT)');
    await page.waitForTimeout(30000);

    log('✅ Proceeding with scrape...');
    log('✅ Logged in — session active');
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

    if (DRY_RUN) {
      log('DRY RUN — would send this payload:');
      console.log(JSON.stringify({
        userId: USER_ID,
        source: 'chatgpt',
        messages: allMessages,
      }, null, 2));
    } else {
      await sendToApi(allMessages);
    }

    log('Done ✅');
  } catch (err) {
    console.error('[openclaw:chatgpt] Fatal error:', err);
  } finally {
    await context.close();
  }
}

// ─── Get conversation list from sidebar ──────────────────────────────
async function getConversationList(page) {
  // ChatGPT UI has changed frequently - try multiple selectors
  const selectors = [
    'nav a[href*="/c/"]',
    'a[href*="/c/"]',
    'nav ol li a',
    'nav li a',
    '[data-testid="conversation-turn"]',
    'div[role="listitem"] a',
    'aside a[href*="/c/"]',
    'div[class*="conversation"] a',
    'li a[href*="/c/"]',
    'a[href^="/c/"]',
  ];

  // Wait a bit for dynamic content
  log('Waiting for dynamic content...');
  await page.waitForTimeout(5000);
  
  // Debug: log page structure
  const pageContent = await page.content();
  log(`Page has ${pageContent.length} characters of HTML`);
  
  // Check if there are any conversation links at all
  const totalLinks = await page.$$('a');
  log(`Found ${totalLinks.length} total links on page`);
  
  if (totalLinks.length === 0) {
    log('No links found - trying to navigate directly to conversation list');
    // Try navigating to the conversation list directly
    // Try alternative ChatGPT URLs
    const urls = [
      'https://chat.openai.com/',
      'https://chatgpt.com/c/',
      'https://chat.openai.com/c/',
    ];
    
    for (const url of urls) {
      log(`Trying URL: ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      
      const testLinks = await page.$$('a');
      if (testLinks.length > 0) {
        log(`✅ Found ${testLinks.length} links at ${url}`);
        break;
      }
    }
    
    const retryLinks = await page.$$('a');
    log(`After retry: Found ${retryLinks.length} total links`);
  }
  
  const conversationLinks = await page.$$eval('a', links => 
    links.filter(link => link.href && link.href.includes('/c/')).map(link => ({
      href: link.href,
      text: link.innerText?.slice(0, 50) || 'No text'
    }))
  );
  log(`Found ${conversationLinks.length} conversation links:`, conversationLinks.slice(0, 3));

  for (const selector of selectors) {
    const links = await page.$$(selector);
    log(`Trying selector "${selector}": found ${links.length} elements`);
    
    if (links.length > 0) {
      log(`✅ Found conversations using selector: ${selector}`);
      const conversations = [];
      for (const link of links) {
        const href = await link.getAttribute('href');
        const title = await link.innerText().catch(() => 'Untitled');
        if (href && href.includes('/c/')) {
          conversations.push({
            title: title.trim().split('\n')[0].slice(0, 100),
            url: href.startsWith('http') ? href : `https://chatgpt.com${href}`,
            id: href.split('/c/')[1]?.split('?')[0] || 'unknown',
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
  }

  // Fallback
  const allLinks = await page.$$('a');
  const conversations = [];
  for (const link of allLinks) {
    const href = await link.getAttribute('href').catch(() => null);
    if (href && href.includes('/c/')) {
      const title = await link.innerText().catch(() => 'Untitled');
      conversations.push({
        title: title.trim().split('\n')[0].slice(0, 100),
        url: href.startsWith('http') ? href : `https://chatgpt.com${href}`,
        id: href.split('/c/')[1]?.split('?')[0] || 'unknown',
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
  await page.waitForTimeout(3000);

  await autoScroll(page);

  const messages = await extractMessages(page, conv);
  return messages;
}

async function extractMessages(page, conv) {
  const messages = [];
  const now = new Date();

  // Strategy 1: ChatGPT uses data-message-author-role attributes
  const authorBlocks = await page.$$('[data-message-author-role]');
  if (authorBlocks.length > 0) {
    log(`  Using data-message-author-role (${authorBlocks.length} blocks)`);
    for (let i = 0; i < authorBlocks.length; i++) {
      const block = authorBlocks[i];
      const role = await block.getAttribute('data-message-author-role');
      if (role !== 'user' && role !== 'assistant') continue;

      const text = await block.innerText().catch(() => '');
      if (!text.trim()) continue;

      messages.push({
        role,
        content: text.trim(),
        sessionId: conv.title,
        timestamp: new Date(now.getTime() - (authorBlocks.length - i) * 60000).toISOString(),
      });
    }
    if (messages.length > 0) return messages;
  }

  // Strategy 2: Look for alternating message groups
  const groupSelectors = [
    '[data-testid*="conversation-turn"]',
    'article',
    '[class*="ConversationItem"]',
    '.group',
  ];

  for (const selector of groupSelectors) {
    const groups = await page.$$(selector);
    if (groups.length >= 2) {
      log(`  Using group selector: ${selector} (${groups.length} groups)`);
      for (let i = 0; i < groups.length; i++) {
        const text = await groups[i].innerText().catch(() => '');
        if (!text.trim() || text.trim().length < 3) continue;

        messages.push({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: text.trim(),
          sessionId: conv.title,
          timestamp: new Date(now.getTime() - (groups.length - i) * 60000).toISOString(),
        });
      }
      if (messages.length >= 2) return messages;
      messages.length = 0;
    }
  }

  // Strategy 3: Full page fallback
  const mainContent = await page.$('main') || await page.$('[role="main"]');
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

// ─── Auto-scroll ─────────────────────────────────────────────────────
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
    source: 'chatgpt',
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
    const fallbackPath = `./chatgpt-messages-${Date.now()}.json`;
    fs.writeFileSync(fallbackPath, JSON.stringify(payload, null, 2));
    log(`Saved to ${fallbackPath}`);
  }
}

// ─── Get browser user data directory ─────────────────────────────────
function getUserDataDir() {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (args['profile-dir']) return args['profile-dir'];
  return `${home}/.nightshift-browser`;
}

// ─── Run ─────────────────────────────────────────────────────────────
main().catch(err => {
  console.error('[openclaw:chatgpt] Unhandled error:', err);
  process.exit(1);
});
