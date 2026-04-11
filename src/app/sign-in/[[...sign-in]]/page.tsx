/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Clerk sign-in page
 * DEPENDENCIES: @clerk/nextjs
 * STATUS: Ready to use
 */

import { Suspense } from 'react';
import { SignIn } from '@clerk/nextjs';
import { ClerkAuthFallback } from '@/components/auth/ClerkAuthFallback';

export default function SignInPage() {
  return (
    <Suspense fallback={<ClerkAuthFallback />}>
      <div className="flex min-h-screen items-center justify-center bg-nightshift-bg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-nightshift-text-primary mb-4">Sign In to NightShift</h1>
          <p className="text-nightshift-text-secondary mb-8">Your AI work engine awaits</p>
          <SignIn
            appearance={{
              elements: {
                rootBox: 'mx-auto',
                card: 'bg-nightshift-bg-card border border-nightshift-border',
              },
            }}
          />
        </div>
      </div>
    </Suspense>
  );
}
