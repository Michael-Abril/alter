/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Clerk sign-up page
 * DEPENDENCIES: @clerk/nextjs
 * STATUS: Ready to use
 */

import { SignUpPanel } from '@/components/auth/SignUpPanel';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-nightshift-bg px-4">
      <div className="w-full max-w-md text-center">
        <p className="mb-2 font-display text-sm font-semibold uppercase tracking-[0.2em] text-nightshift-highlight">
          Alter
        </p>
        <h1 className="mb-2 font-display text-2xl font-bold text-nightshift-text-primary">Create account</h1>
        <p className="mb-8 text-nightshift-text-secondary">Start building your on-device identity profile.</p>
        <SignUpPanel />
      </div>
    </div>
  );
}
