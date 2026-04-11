/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Clerk sign-in page
 * DEPENDENCIES: @clerk/nextjs
 * STATUS: Ready to use
 */

import { SignInPanel } from '@/components/auth/SignInPanel';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-nightshift-bg px-4">
      <div className="w-full max-w-md text-center">
        <p className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-nightshift-highlight">
          Alter
        </p>
        <h1 className="mb-2 font-display text-2xl font-bold text-nightshift-text-primary">Sign in</h1>
        <p className="mb-8 text-nightshift-text-secondary">
          Portable AI identity — local-first, model-agnostic.
        </p>
        <SignInPanel />
      </div>
    </div>
  );
}
