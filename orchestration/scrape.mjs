/**
 * OpenClaw — Unified Chat History Scraper
 * 
 * Scrape chat history from Claude.ai and/or ChatGPT and send to NightShift ingest API.
 * 
 * Usage:
 *   node scrape.mjs --service=claude          # Scrape Claude only
 *   node scrape.mjs --service=chatgpt         # Scrape ChatGPT only
 *   node scrape.mjs --service=all             # Scrape both (default)
 *   node scrape.mjs --service=claude --max=10 --dry-run
 * 
 * Options:
 *   --service=claude|chatgpt|all   Which service to scrape (default: all)
 *   --max=N                        Max conversations to scrape (default: 5)
 *   --api=URL                      Ingest API endpoint (default: http://localhost:3000/api/chat-history/ingest)
 *   --user=ID                      User ID to tag messages with (default: user_test_123)
 *   --dry-run                      Print payload instead of sending to API
 *   --headless                     Run browser in headless mode (default: visible)
 *   --profile-dir=PATH             Custom browser profile directory
 */

import { execFile } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const parsed = {};
for (const arg of args) {
  if (arg.startsWith('--')) {
    const [key, val] = arg.slice(2).split('=');
    parsed[key] = val ?? '';
  }
}

const service = parsed.service || 'all';
const passthrough = args.filter(a => !a.startsWith('--service'));

function log(msg) {
  console.log(`[openclaw] ${msg}`);
}

function runScript(script) {
  return new Promise((resolve, reject) => {
    const scriptPath = join(__dirname, script);
    log(`Running ${script}...`);
    log('─'.repeat(60));

    const child = execFile('node', [scriptPath, ...passthrough], {
      cwd: __dirname,
      stdio: 'inherit',
    });

    // Pipe output
    child.stdout?.on('data', d => process.stdout.write(d));
    child.stderr?.on('data', d => process.stderr.write(d));

    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${script} exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function main() {
  console.log('');
  log('╔══════════════════════════════════════════════════╗');
  log('║  OpenClaw — NightShift Chat History Scraper      ║');
  log('╚══════════════════════════════════════════════════╝');
  console.log('');
  log(`Service: ${service}`);
  log(`Args: ${passthrough.join(' ') || '(defaults)'}`);
  console.log('');

  const tasks = [];

  if (service === 'claude' || service === 'all') {
    tasks.push({ name: 'Claude.ai', script: 'scrape-claude.mjs' });
  }

  if (service === 'chatgpt' || service === 'all') {
    tasks.push({ name: 'ChatGPT', script: 'scrape-chatgpt.mjs' });
  }

  if (tasks.length === 0) {
    log(`Unknown service: "${service}". Use --service=claude, --service=chatgpt, or --service=all`);
    process.exit(1);
  }

  let failures = 0;

  for (const task of tasks) {
    log(`\n▶ Starting ${task.name} scraper`);
    try {
      await runScript(task.script);
      log(`✅ ${task.name} scraper completed`);
    } catch (err) {
      log(`❌ ${task.name} scraper failed: ${err.message}`);
      failures++;
    }
    console.log('');
  }

  log('─'.repeat(60));
  if (failures === 0) {
    log('All scrapers completed successfully ✅');
  } else {
    log(`Completed with ${failures} failure(s)`);
  }

  process.exit(failures > 0 ? 1 : 0);
}

main();
