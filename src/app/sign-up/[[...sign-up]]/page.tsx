/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Clerk sign-up page
 * DEPENDENCIES: @clerk/nextjs
 * STATUS: Ready to use
 */

import { Suspense } from 'react';
import { SignUp } from '@clerk/nextjs';
import { ClerkAuthFallback } from '@/components/auth/ClerkAuthFallback';

export default function SignUpPage() {
  return (
    <Suspense fallback={<ClerkAuthFallback />}>
      <div className="flex min-h-screen items-center justify-center bg-nightshift-bg">
        <SignUp
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'bg-nightshift-bg-card border border-nightshift-border',
            },
          }}
        />
      </div>
    </Suspense>
  );
}
