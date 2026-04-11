/**
 * Client-side: API routes return { code: 'USER_NOT_FOUND' } when no Prisma user row exists.
 */

export function isUserNotFoundResponse(res: Response, json: unknown): boolean {
  if (res.status !== 404 || typeof json !== 'object' || json === null) return false;
  return (json as { code?: string }).code === 'USER_NOT_FOUND';
}
