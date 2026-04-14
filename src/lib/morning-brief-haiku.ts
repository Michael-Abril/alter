/**
 * Natural-language morning brief from raw tasks — Akash ML API.
 * Falls back to simple narrative if no API key or on error.
 */

import { callOpenClaw } from '@/lib/openclaw-client';

export type RawTaskBrief = {
  title: string;
  dueDate: string | null;
  source: string;
};

function fallbackNarrative(tasks: RawTaskBrief[]): string {
  if (tasks.length === 0) return 'Nothing urgent on the list right now — check Handoff when you want Alter to keep moving.';
  const top = tasks.slice(0, 3);
  const parts = top.map((t) => t.title.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return `Start with ${parts.join(', then ')} — tackle the closest deadline first.`;
}

export async function generateMorningBriefNarrative(tasks: RawTaskBrief[]): Promise<string> {
  const key = process.env.AKASH_ML_API_KEY;
  if (!key || tasks.length === 0) {
    return tasks.length === 0
      ? 'Nothing urgent on the list right now — check Handoff when you want Alter to keep moving.'
      : fallbackNarrative(tasks);
  }

  const lines = tasks.slice(0, 8).map((t) => {
    const due = t.dueDate
      ? new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'no date';
    return `- (${t.source}) ${t.title} — due: ${due}`;
  });

  try {
    const res = await callOpenClaw({
      system: 'You are Alter, a concise human assistant. Return plain prose only, 2-4 sentences.',
      user: `The user opens their morning brief.

Here are upcoming items (raw system labels — do NOT repeat course codes, section IDs, or database-style strings verbatim). Rewrite as 2–4 short sentences of natural advice: what matters, what's due soon, and what to do first. Sound warm and direct, not robotic.

${lines.join('\n')}

Rules:
- No bullet points in the output. Plain prose.
- Do not start with "Welcome" or repeat a greeting — the UI already says hello.
- Mention at most 2–3 items by plain-English names (shorten long Canvas titles naturally).
- Do not include "§" or technical hashes.`,
      maxTokens: 280,
    });

    if (res.content && res.content.trim()) {
      return res.content.trim();
    }
  } catch (e) {
    console.error('[morning-brief-haiku]', e);
  }
  return fallbackNarrative(tasks);
}
