'use client';

import dynamic from 'next/dynamic';
import { ClerkAuthFallback } from '@/components/auth/ClerkAuthFallback';

/**
 * Client-only: `next/dynamic` + `ssr: false` loads Clerk after hydration without relying on
 * useEffect (which could leave the page stuck on the spinner if hydration was delayed).
 * Redirect URLs: NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL (see .env).
 */
const SignIn = dynamic(
  () => import('@clerk/nextjs').then((mod) => mod.SignIn),
  {
    ssr: false,
    loading: () => <ClerkAuthFallback />,
  }
);

export function SignInPanel() {
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
