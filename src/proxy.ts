import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

/**
 * Skip the entire `/_next/*` tree (includes `/_next/webpack-hmr` for HMR).
 * If Clerk runs on WebSocket upgrade requests, the handshake fails with
 * `net::ERR_INVALID_HTTP_RESPONSE` and the dev client never hydrates — sign-in spins forever.
 *
 * Next.js 16 uses `proxy.ts` (not `middleware.ts`). Still matches `/api/*`, `/sign-in`, etc.
 */
export const config = {
  matcher: [
    // Exclude `/_next/*` so `/_next/webpack-hmr` is not wrapped by Clerk (fixes broken WS in dev).
    '/((?!_next/|_next$|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
