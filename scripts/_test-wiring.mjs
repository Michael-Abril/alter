import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const db = new PrismaClient();
const user = await db.user.findFirst({ select: { id: true, clerkId: true } });
if (!user) {
  console.log('No user in DB');
  process.exit(1);
}
// Use 127.0.0.1 on Windows — `localhost` can resolve to ::1 and hang with Node fetch.
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

async function get(path) {
  const r = await fetch(`${base}${path}`);
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: r.status, json };
}

console.log('User:', user.id, 'clerkId:', user.clerkId);

const a = await get(`/api/internal/projects?userId=${encodeURIComponent(user.id)}`);
const b = await get(`/api/internal/projects?userId=${encodeURIComponent(user.clerkId)}`);
console.log('GET internal/projects (internal id):', a.status, 'count:', a.json?.data?.count ?? a.json?.data?.projects?.length);
console.log('GET internal/projects (clerk id):', b.status, 'count:', b.json?.data?.count ?? b.json?.data?.projects?.length);

const headers = { 'Content-Type': 'application/json' };
if (process.env.OPENCLAW_WEBHOOK_SECRET) {
  headers['x-openclaw-secret'] = process.env.OPENCLAW_WEBHOOK_SECRET;
}

const post = await fetch(`${base}/api/actions`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    userId: user.clerkId,
    type: 'test_wiring',
    title: 'Wiring test action',
    app: 'nightshift',
    status: 'completed',
    description: 'Automated test from scripts/_test-wiring.mjs',
    metadata: JSON.stringify({ test: true, at: new Date().toISOString() }),
  }),
});
const postText = await post.text();
console.log('POST /api/actions:', post.status, postText.slice(0, 200));

const count = await db.action.count({ where: { userId: user.id, type: 'test_wiring' } });
console.log('test_wiring actions for user:', count);

await db.$disconnect();
