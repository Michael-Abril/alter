/**
 * Single-line morning brief for the dashboard (demo-friendly, data-driven).
 */

export function firstNameFromUser(name: string | null | undefined, email: string): string {
  const n = name?.trim();
  if (n) {
    const first = n.split(/\s+/)[0];
    if (first) return first;
  }
  const local = email.split('@')[0];
  if (!local) return 'there';
  return local.charAt(0).toUpperCase() + local.slice(1);
}

/** Human phrase for due date relative to "now" (start of local day rough). */
export function dueRelativePhrase(iso: string): string {
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return 'soon';

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startDue = new Date(due);
  startDue.setHours(0, 0, 0, 0);

  const diffDays = Math.round((startDue.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 7) return `in ${diffDays} days`;
  return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function buildMorningBriefLead(opts: {
  firstName: string;
  projectsContinued: number;
  emailDraftsOvernight: number;
  topCanvas: { title: string; dueDate: string | null } | null;
  hasDocOrAcademicInProgress: boolean;
}): string {
  const { firstName, projectsContinued, emailDraftsOvernight, topCanvas, hasDocOrAcademicInProgress } = opts;
  const sentences: string[] = [];

  sentences.push(`Good morning, ${firstName}.`);

  if (projectsContinued === 0 && emailDraftsOvernight === 0) {
    sentences.push(`NightShift has not recorded new project continuations or email drafts in the last day.`);
  } else {
    const p =
      projectsContinued === 0
        ? ''
        : projectsContinued === 1
          ? 'continued 1 project'
          : `continued ${projectsContinued} projects`;
    const e =
      emailDraftsOvernight === 0
        ? ''
        : emailDraftsOvernight === 1
          ? 'drafted 1 email reply'
          : `drafted ${emailDraftsOvernight} email replies`;

    if (p && e) sentences.push(`NightShift ${p} and ${e} while you slept.`);
    else if (p) sentences.push(`NightShift ${p} while you slept.`);
    else sentences.push(`NightShift ${e} while you slept.`);
  }

  if (topCanvas?.title) {
    const dueBit = topCanvas.dueDate
      ? ` is due ${dueRelativePhrase(topCanvas.dueDate)}`
      : ' is coming up';
    const tail = hasDocOrAcademicInProgress
      ? ' — study materials and continuations are in your NightShift output folder (see Settings for path).'
      : ' — open Canvas to review details.';
    sentences.push(`Your ${topCanvas.title}${dueBit}${tail}`);
  }

  return sentences.join(' ');
}
