'use client';

import { useEffect, useState } from 'react';
import { SignIn } from '@clerk/nextjs';
import { ClerkAuthFallback } from '@/components/auth/ClerkAuthFallback';

/**
 * Clerk must mount only on the client. Using <Suspense> around <SignIn> was leaving
 * some users stuck on the loading fallback (Google OAuth never appeared to finish).
 * Redirect URLs come from NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL (see .env).
 */
export function SignInPanel() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <ClerkAuthFallback />;
  }

  return (
    <SignIn
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      appearance={{
        elements: {
          rootBox: 'mx-auto',
          card: 'bg-nightshift-bg-card border border-nightshift-border',
        },
      }}
    />
  );
}
