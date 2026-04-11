/**
 * User-facing first name — never show DB ids, test prefixes, or raw email local-parts that look like ids.
 */

function looksLikeTechnicalId(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  if (/^user[_-]?test/i.test(t)) return true;
  if (/^user_[a-z0-9_-]+$/i.test(t)) return true;
  if (/^[a-z]+_\d+$/i.test(t)) return true;
  if (/^\d+$/.test(t)) return true;
  if (t.length > 48) return true;
  return false;
}

function humanizeEmailLocal(local: string): string | null {
  if (!local || looksLikeTechnicalId(local)) return null;
  const segment = local.split(/[.@_-]/)[0];
  if (!segment || looksLikeTechnicalId(segment)) return null;
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

/**
 * Prefer Prisma `User.name`, then Clerk first name, then a humanized email local part.
 */
export function displayFirstName(opts: {
  dbName: string | null | undefined;
  email: string;
  clerkFirstName?: string | null;
}): string {
  const { dbName, email, clerkFirstName } = opts;
  if (dbName?.trim()) {
    const first = dbName.trim().split(/\s+/)[0];
    if (first && !looksLikeTechnicalId(first)) return first;
  }
  if (clerkFirstName?.trim() && !looksLikeTechnicalId(clerkFirstName)) {
    return clerkFirstName.trim();
  }
  const local = email.split('@')[0] ?? '';
  const fromEmail = humanizeEmailLocal(local);
  if (fromEmail) return fromEmail;
  return 'there';
}
