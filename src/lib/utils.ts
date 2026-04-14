/**
 * OWNER: Shared across all team members
 * PURPOSE: Shared utility functions used across the application
 * STATUS: Ready to use — add utilities as needed
 */

// ─── Date Utilities ──────────────────────────────────────────────────────────

/**
 * Format a date for display in the UI
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date with time
 */
export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get relative time string (e.g., "2 hours ago", "yesterday")
 */
export function timeAgo(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

// ─── String Utilities ────────────────────────────────────────────────────────

/**
 * Truncate a string to a max length with ellipsis
 */
export function truncate(str: string, maxLength: number = 100): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Slugify a string for URLs
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── JSON Utilities ──────────────────────────────────────────────────────────

/**
 * Safely parse JSON with a fallback
 */
export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// ─── API Utilities ───────────────────────────────────────────────────────────

/**
 * Create a standard API success response
 */
export function apiSuccess<T>(data: T, message?: string) {
  return Response.json({ success: true, data, message });
}

/**
 * Create a standard API error response
 * @param extras optional `code` for clients (e.g. USER_NOT_FOUND → redirect to onboarding)
 */
export function apiError(
  error: string,
  status: number = 400,
  extras?: { code?: string }
) {
  return Response.json(
    {
      success: false,
      error,
      ...(extras?.code ? { code: extras.code } : {}),
    },
    { status }
  );
}

// ─── Confidence Utilities ────────────────────────────────────────────────────

/**
 * Get the CSS color class for a confidence score
 */
export function confidenceColor(score: number): string {
  if (score >= 0.85) return 'text-nightshift-success';
  if (score >= 0.65) return 'text-nightshift-warning';
  if (score >= 0.4) return 'text-nightshift-accent';
  return 'text-nightshift-error';
}

/**
 * Get a badge variant for a status
 */
export function statusVariant(
  status: string
): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'completed':
    case 'approved':
    case 'sent':
      return 'success';
    case 'pending':
    case 'in_progress':
      return 'warning';
    case 'failed':
    case 'rejected':
      return 'error';
    default:
      return 'default';
  }
}

// ─── App Icons ───────────────────────────────────────────────────────────────

/**
 * Map of app names to their display info
 */
export const APP_INFO: Record<string, { label: string; color: string }> = {
  gmail: { label: 'Gmail', color: '#EA4335' },
  gdocs: { label: 'Google Docs', color: '#4285F4' },
  github: { label: 'GitHub', color: '#FFFFFF' },
  notion: { label: 'Notion', color: '#FFFFFF' },
  slack: { label: 'Slack', color: '#4A154B' },
};
