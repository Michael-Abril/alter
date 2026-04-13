/**
 * Headers for POST /api/actions — must include x-openclaw-secret when OPENCLAW_WEBHOOK_SECRET is set.
 */
export function actionsPostHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const secret = process.env.OPENCLAW_WEBHOOK_SECRET;
  if (secret) {
    headers['x-openclaw-secret'] = secret;
  }
  return headers;
}
