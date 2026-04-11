'use client';

import { useEffect, useState } from 'react';
import { SignUp } from '@clerk/nextjs';
import { ClerkAuthFallback } from '@/components/auth/ClerkAuthFallback';

/**
 * Client-only mount — same rationale as SignInPanel (avoid Suspense + OAuth hang).
 * Redirect after sign-up: NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL (see .env).
 */
export function SignUpPanel() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <ClerkAuthFallback />;
  }

  return (
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      appearance={{
        elements: {
          rootBox: 'mx-auto',
          card: 'bg-nightshift-bg-card border border-nightshift-border',
        },
      }}
    />
  );
}
