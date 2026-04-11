/**
 * OWNER: Person 3 (Orchestration)
 * PURPOSE: Decide whether a detected "project" is worth NightShift continuation vs noise.
 * Used by detect-projects, dashboard APIs, and orchestration (via tsx import).
 */

/** Stored on Project.context.classification */
export type ProjectClassification =
  | 'code_build'
  | 'document_build'
  | 'academic_deliverable'
  | 'academic_study'
  | 'quick_task'
  | 'casual'
  | 'other'
  | 'not_actionable';

export type CanvasAssignmentRef = {
  /** Assignment name from Canvas */
  name: string;
  /** e.g. ACC 2002, ECN2000 */
  courseCode: string;
};

export type ClassifyProjectInput = {
  name: string;
  description: string;
  messageCount: number;
  /** Distinct calendar days user+assistant exchanged messages (optional) */
  distinctDays?: number;
  /** Full transcript or concatenated messages for signal detection */
  transcript: string;
  keyTopics: string[];
  /** Raw LLM / heuristic suggestion before refinement */
  llmClassification?: string;
};

export type ClassifyProjectOptions = {
  canvasAssignments: CanvasAssignmentRef[];
};

/** File / code / deliverable signals in assistant or user text */
const DELIVERABLE_PATTERNS: RegExp[] = [
  /\.(tsx?|jsx?|py|go|rs|java|cs|cpp|c|h)\b/i,
  /\b(pull request|pr #|commit|branch|github|repository|repo)\b/i,
  /\b(def |function |class |import |export |npm |pnpm |yarn )\b/i,
  /\b(created?|edited|updated)\s+\d+\s+files?\b/i,
  /\b(word doc|\.docx|google doc|slides?|powerpoint|\.pptx)\b/i,
  /\b(draft (the|a|your)|write the (paper|essay|report)|final (paper|report|document))\b/i,
  /\b(problem set|pset|homework\s*#|assignment\s*#|due\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
  /\b(submit|submission|rubric|grade)\b/i,
];

const LIFESTYLE_OR_INFO_QUERY_RE =
  /\b(how many steps|steps per day|daily steps|macros?|calories|workout|gym routine|sleep schedule|meditation)\b/i;

const TRIP_OR_PERSONAL_RE =
  /\b(peru|itinerary|flight(s)?|hotel|airbnb|packing list|trip planning|vacation|honeymoon)\b/i;

const RESEARCH_ONLY_RE =
  /\b(gdp (of|for|ranking)|country research|research (on|about) (the )?|explain (to me )?how|what is the|list of countries)\b/i;

function normalizeBlob(parts: string[]): string {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCourseCodesFromText(text: string): string[] {
  const out = new Set<string>();
  const t = text.toUpperCase();
  const re = /\b([A-Z]{2,4})\s*[-_]?\s*(\d{3,4}[A-Z]?)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    out.add(`${m[1]}${m[2]}`);
    out.add(`${m[1]} ${m[2]}`);
  }
  return [...out];
}

/**
 * True if project title/topics/transcript align with a Canvas assignment name or course code.
 */
export function matchesCanvasAssignment(
  input: ClassifyProjectInput,
  canvas: CanvasAssignmentRef[]
): boolean {
  if (!canvas.length) return false;
  const blob = normalizeBlob([
    input.name,
    input.description,
    ...input.keyTopics,
    input.transcript.slice(0, 8000),
  ]);

  for (const a of canvas) {
    const an = a.name.trim().toLowerCase();
    if (an.length >= 4 && blob.includes(an)) return true;
    const cc = a.courseCode.replace(/\s+/g, '').toUpperCase();
    if (cc.length >= 5 && blob.includes(cc.toLowerCase())) return true;
    const parts = a.courseCode.split(/[\s/_-]+/).filter((p) => p.length > 1);
    if (parts.length >= 2) {
      const fuzzy = normalizeBlob(parts);
      if (fuzzy.length >= 4 && blob.includes(fuzzy.replace(/\s/g, ''))) return true;
    }
  }

  for (const code of extractCourseCodesFromText(blob)) {
    for (const a of canvas) {
      const ref = a.courseCode.replace(/\s+/g, '').toUpperCase();
      if (ref && code.replace(/\s+/g, '').includes(ref.replace(/\s+/g, ''))) return true;
    }
  }
  return false;
}

function hasDeliverableSignals(transcript: string): boolean {
  const t = transcript.slice(0, 12000);
  return DELIVERABLE_PATTERNS.some((re) => re.test(t));
}

function hasIterativeBuildSignals(transcript: string): boolean {
  const t = transcript.toLowerCase();
  if (/\b(edited|created|updated|deleted|renamed)\s+\d+\s+files?\b/.test(t)) return true;
  if (/\bviewed a file\b/.test(t) && /\b(ran a command|edited|created)\b/.test(t)) return true;
  if (/```[\s\S]{120,}```/.test(transcript)) return true;
  if ((transcript.match(/\biteration\b/gi) || []).length >= 2) return true;
  return false;
}

function spansMultipleSessions(distinctDays: number | undefined, messageCount: number): boolean {
  if (distinctDays != null && distinctDays >= 2) return true;
  if (messageCount >= 12) return true;
  return false;
}

/**
 * Map LLM / legacy labels into our taxonomy; `not_actionable` is applied by rules, not by LLM alone.
 */
function normalizeLlmClassification(raw: string | undefined): ProjectClassification | null {
  if (!raw) return null;
  const r = raw.toLowerCase().trim();
  const allowed: ProjectClassification[] = [
    'code_build',
    'document_build',
    'academic_deliverable',
    'academic_study',
    'quick_task',
    'casual',
    'other',
    'not_actionable',
  ];
  if (allowed.includes(r as ProjectClassification)) return r as ProjectClassification;
  return null;
}

export type ClassificationResult = {
  classification: ProjectClassification;
  /** Why not_actionable was chosen (for logs / activity) */
  notActionableReason?: string;
};

/**
 * Full rules:
 * - If Canvas match → never `not_actionable` (actionable as academic_deliverable unless clearly code/doc build).
 * - If messageCount < 5 and no Canvas match → `not_actionable`.
 * - If ALL of: no clear deliverable, no Canvas match, not multi-session, no iterative code/doc → `not_actionable`.
 * - Otherwise use LLM class when compatible, else heuristic continuation classes.
 */
export function classifyConversation(
  input: ClassifyProjectInput,
  options: ClassifyProjectOptions
): ClassificationResult {
  const canvasHit = matchesCanvasAssignment(input, options.canvasAssignments);
  const transcript = input.transcript || '';
  const deliverable = hasDeliverableSignals(transcript);
  const iterative = hasIterativeBuildSignals(transcript);
  const multiSession = spansMultipleSessions(input.distinctDays, input.messageCount);
  const blob = normalizeBlob([input.name, input.description, ...input.keyTopics, transcript.slice(0, 4000)]);

  if (canvasHit) {
    const llm = normalizeLlmClassification(input.llmClassification);
    if (llm === 'code_build' || llm === 'document_build' || llm === 'academic_deliverable') {
      return { classification: llm };
    }
    if (deliverable && /\b(code|github|api|app|deploy|bug|fix)\b/i.test(blob)) {
      return { classification: 'code_build' };
    }
    if (deliverable && /\b(paper|essay|report|slides|presentation|docx)\b/i.test(blob)) {
      return { classification: 'document_build' };
    }
    return { classification: 'academic_deliverable' };
  }

  if (input.messageCount < 5) {
    return {
      classification: 'not_actionable',
      notActionableReason: 'Fewer than 5 messages and no matching Canvas assignment.',
    };
  }

  const strongNoise =
    LIFESTYLE_OR_INFO_QUERY_RE.test(blob) ||
    TRIP_OR_PERSONAL_RE.test(blob) ||
    (RESEARCH_ONLY_RE.test(blob) && !deliverable);

  if (strongNoise && !deliverable && !iterative) {
    return {
      classification: 'not_actionable',
      notActionableReason: 'Lifestyle, trip planning, or information-only thread with no deliverable.',
    };
  }

  if (!deliverable && !multiSession && !iterative) {
    return {
      classification: 'not_actionable',
      notActionableReason:
        'No clear deliverable, not multi-session, and no iterative code or document work detected.',
    };
  }

  const llm = normalizeLlmClassification(input.llmClassification);
  if (llm && llm !== 'not_actionable') {
    return { classification: llm };
  }

  // Heuristic fallback (aligns with overnight-loop style)
  if (/\b(trip|adventure|travel|peru|empanada|merchandise|sorority|adpi)\b/i.test(blob)) {
    return { classification: 'casual' };
  }
  if (/\b(study guide|exam|quiz|midterm|practice|review|prep)\b/i.test(blob)) {
    return { classification: 'academic_study' };
  }
  if (/\b(homework|problem set|assignment|case study|deliverable|session \d+)\b/i.test(blob)) {
    return { classification: 'academic_deliverable' };
  }
  if (/\b(nightshift|github|integration|api|backend|frontend|deploy)\b/i.test(blob)) {
    return { classification: 'code_build' };
  }
  if (/\b(pitch deck|proposal|business plan|presentation|analysis)\b/i.test(blob)) {
    return { classification: 'document_build' };
  }
  return { classification: 'document_build' };
}

/** Classify a DB-backed project using context fields only (no transcript). Weaker signals. */
export function classifyStoredProject(
  row: {
    name: string;
    description: string | null;
    progress: number;
    context: Record<string, unknown> | null;
  },
  options: ClassifyProjectOptions
): ClassificationResult {
  const ctx = row.context || {};
  const messageCount =
    typeof ctx.messageCount === 'number' ? ctx.messageCount : typeof ctx.messageCount === 'string' ? parseInt(String(ctx.messageCount), 10) || 0 : 0;
  const keyTopics = Array.isArray(ctx.keyTopics) ? (ctx.keyTopics as string[]).filter((x) => typeof x === 'string') : [];
  const samples = Array.isArray(ctx.sampleMessages)
    ? (ctx.sampleMessages as string[]).filter((x) => typeof x === 'string')
    : [];
  const transcript = [
    row.name,
    row.description || '',
    ...samples,
    ...(typeof ctx.nextStep === 'string' ? [ctx.nextStep] : []),
  ].join('\n');

  const input: ClassifyProjectInput = {
    name: row.name,
    description: row.description || '',
    messageCount: messageCount || 1,
    transcript,
    keyTopics,
    llmClassification: typeof ctx.classification === 'string' ? ctx.classification : undefined,
  };

  return classifyConversation(input, options);
}

export function isContinuableClassification(c: ProjectClassification): boolean {
  return c === 'code_build' || c === 'document_build' || c === 'academic_deliverable';
}

export const NOT_ACTIONABLE_ACTIVITY_TITLE = 'Detected conversation — no action needed.';
