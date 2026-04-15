/**
 * Canvas assignment prep — matches handoff "Canvas assignments to support" lines to
 * live Canvas assignments, generates outline/prep via AI, saves Draft rows for Draft review.
 */

import { callAI } from './lib/ai-client.mjs';
import { actionsPostHeaders } from './lib/openclaw-headers.mjs';

const SONNET_PRICE_IN_PER_MTOK = Number(process.env.ANTHROPIC_SONNET_PRICE_IN_PER_MTOK ?? 3);
const SONNET_PRICE_OUT_PER_MTOK = Number(process.env.ANTHROPIC_SONNET_PRICE_OUT_PER_MTOK ?? 15);

function usdForSonnetUsage(usage) {
  const inT = usage?.input_tokens ?? 0;
  const outT = usage?.output_tokens ?? 0;
  return (inT / 1e6) * SONNET_PRICE_IN_PER_MTOK + (outT / 1e6) * SONNET_PRICE_OUT_PER_MTOK;
}

function estimateUsageFromTokens(tokensUsed) {
  return {
    input_tokens: Math.floor(tokensUsed * 0.3),
    output_tokens: Math.floor(tokensUsed * 0.7),
  };
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parsed line from handoff instructions.
 * Prefer stable `canvas-assignment-<id> | title` (from UI) so we match the exact Canvas row.
 */
export function parseCanvasAssignmentsFromInstructions(instructions) {
  if (!instructions || typeof instructions !== 'string') return [];
  const idx = instructions.indexOf('Canvas assignments to support');
  if (idx === -1) return [];
  const after = instructions.slice(idx);
  const lines = after.split('\n');
  const out = [];
  for (const line of lines) {
    const idLine = line.match(/^\s*[-*]\s*canvas-assignment-(\d+)\s*\|\s*(.+)$/i);
    if (idLine) {
      out.push({
        assignmentId: Number(idLine[1]),
        title: idLine[2].trim(),
      });
      continue;
    }
    const plain = line.match(/^\s*[-*]\s+(.+)/);
    if (plain) {
      const raw = plain[1].trim();
      if (/^canvas-assignment-\d+\s*\|/i.test(raw)) continue;
      out.push({ title: raw });
    }
  }
  return out.slice(0, 5);
}

/** @deprecated use parseCanvasAssignmentsFromInstructions */
export function parseCanvasTitlesFromInstructions(instructions) {
  return parseCanvasAssignmentsFromInstructions(instructions).map((x) => x.title || '').filter(Boolean);
}

function findBestAssignmentMatch(assignments, requested) {
  const r = requested.toLowerCase().trim();
  if (!r) return null;
  const norm = (s) => String(s || '').toLowerCase().trim();

  let best = assignments.find((a) => norm(a.name) === r);
  if (best) return best;

  best = assignments.find(
    (a) => norm(a.name).includes(r) || (r.length >= 6 && r.includes(norm(a.name).slice(0, Math.min(24, norm(a.name).length))))
  );
  if (best) return best;

  const tokens = r.split(/\s+/).filter((w) => w.length > 3);
  let bestScore = 0;
  let bestA = null;
  for (const a of assignments) {
    const n = norm(a.name);
    let s = 0;
    for (const t of tokens) {
      if (n.includes(t)) s += 2;
    }
    if (s > bestScore) {
      bestScore = s;
      bestA = a;
    }
  }
  return bestScore >= 2 ? bestA : null;
}

/**
 * @param {string} resolvedUserId - internal user id
 * @param {string} instructions - handoff instructions (may include Canvas block)
 * @param {object} options
 * @param {string} options.apiUrl
 * @param {() => boolean} [options.spentUsdCap] - stop if budget exhausted
 */
export async function runCanvasAssignmentPrep(resolvedUserId, instructions, options = {}) {
  const apiUrl = options.apiUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  const items = parseCanvasAssignmentsFromInstructions(instructions);
  if (items.length === 0) {
    return { results: [], spentUsd: 0, tokensUsed: 0 };
  }

  let canvasModule;
  try {
    canvasModule = await import('../src/lib/canvas.ts');
  } catch (e) {
    console.warn(`   ⚠️  Canvas prep: could not load canvas module: ${e.message}`);
    return { results: [], spentUsd: 0, tokensUsed: 0 };
  }

  const { loadCanvasConfig, getUpcomingAssignments, getCourses } = canvasModule;
  const config = loadCanvasConfig(resolvedUserId);
  if (!config) {
    console.log('   ℹ️  Canvas prep: no Canvas token/domain saved (Settings / onboarding)');
    return { results: [], spentUsd: 0, tokensUsed: 0 };
  }

  let assignments;
  let courses;
  try {
    [assignments, courses] = await Promise.all([
      getUpcomingAssignments(config, 60),
      getCourses(config),
    ]);
  } catch (e) {
    console.warn(`   ⚠️  Canvas prep: API error: ${e.message}`);
    return { results: [], spentUsd: 0, tokensUsed: 0 };
  }

  const courseLabel = (courseId) => {
    const c = courses.find((x) => x.id === courseId);
    return c?.course_code || c?.name || `Course ${courseId}`;
  };

  let spentUsd = 0;
  let totalTokens = 0;
  const results = [];
  const maxN = Math.min(2, items.length);

  for (let i = 0; i < maxN; i++) {
    if (options.spentUsdCap && options.spentUsdCap()) {
      console.log('   💸 Canvas prep: budget exhausted — stopping');
      break;
    }

    const item = items[i];
    let assignment =
      item.assignmentId != null
        ? assignments.find((a) => a.id === item.assignmentId)
        : null;
    if (!assignment && item.title) {
      assignment = findBestAssignmentMatch(assignments, item.title);
    }
    const label = item.title || (item.assignmentId != null ? `id ${item.assignmentId}` : 'unknown');
    if (!assignment) {
      console.log(
        `   ⚠️  Canvas prep: no assignment for "${label}"` +
          (item.assignmentId != null
            ? ` (id ${item.assignmentId} not in upcoming list — check due date / course visibility)`
            : '')
      );
      results.push({ title: label, ok: false, error: 'no_match' });
      continue;
    }

    const cname = courseLabel(assignment.course_id);
    const desc = stripHtml(assignment.description || '').slice(0, 2000);

    const system = [
      'You are Alter, helping a student prepare Canvas coursework.',
      'Produce outlines, structure, and concrete next steps.',
      'The student submits their own work in Canvas — do not write a final submission to paste verbatim.',
    ].join('\n');

    const user = [
      '# Canvas assignment',
      `Course: ${cname}`,
      `Assignment: ${assignment.name}`,
      `Due: ${assignment.due_at || 'TBD'}`,
      assignment.html_url ? `Assignment URL: ${assignment.html_url}` : '',
      '',
      '## Prompt / description (from Canvas)',
      desc ||
        '(No description in Canvas — infer reasonable prep from the assignment title and course; still give outline and next steps.)',
      '',
      '## Task',
      'Write a structured prep document: outline, key sections, checklist, and 3–6 concrete next steps for tonight.',
    ]
      .filter(Boolean)
      .join('\n');

    const aiResult = await callAI({ system, user, maxTokens: 3072 });
    const content = aiResult.content || '';
    const tokensUsed = aiResult.tokensUsed || 0;
    const usage = estimateUsageFromTokens(tokensUsed);
    spentUsd += usdForSonnetUsage(usage);
    totalTokens += tokensUsed;

    const draftTitle = `Canvas prep: ${assignment.name}`;

    const draftRes = await fetch(`${apiUrl}/api/drafts`, {
      method: 'POST',
      headers: actionsPostHeaders(),
      body: JSON.stringify({
        userId: resolvedUserId,
        type: 'doc',
        title: draftTitle,
        content,
        targetApp: 'gdocs',
        confidenceScore: 0.85,
        status: 'pending',
        context: JSON.stringify({
          provider: 'canvas',
          kind: 'canvas_prep',
          course: cname,
          assignmentName: assignment.name,
          assignmentId: assignment.id,
          dueAt: assignment.due_at,
          htmlUrl: assignment.html_url || null,
        }),
      }),
    });

    if (!draftRes.ok) {
      const errText = await draftRes.text().catch(() => '');
      console.warn(`   ⚠️  Canvas prep: draft save failed ${draftRes.status} ${errText.slice(0, 200)}`);
      results.push({ title: assignment.name, ok: false, error: 'draft_save_failed' });
      continue;
    }

    const draftJson = await draftRes.json();
    const draftId = draftJson.data?.id || draftJson.data?.draftId;

    try {
      await fetch(`${apiUrl}/api/actions`, {
        method: 'POST',
        headers: actionsPostHeaders(),
        body: JSON.stringify({
          userId: resolvedUserId,
          type: 'canvas_prep',
          title: `Canvas prep: ${assignment.name}`,
          description: `${cname} — outline and next steps (see Draft review)`,
          app: 'canvas',
          confidence: 0.85,
          status: 'completed',
          metadata: JSON.stringify({
            draftId,
            provider: 'canvas',
            kind: 'canvas_prep',
            externalUrl: assignment.html_url || null,
            assignmentId: assignment.id,
          }),
        }),
      });
    } catch (e) {
      console.warn(`   ⚠️  Canvas prep: action log failed: ${e.message}`);
    }

    results.push({ title: assignment.name, ok: true, draftId });
    console.log(`   ✅ Canvas prep draft saved: "${assignment.name}" (${draftId})`);
  }

  return { results, spentUsd, tokensUsed: totalTokens };
}
