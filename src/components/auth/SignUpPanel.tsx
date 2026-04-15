'use client';

import dynamic from 'next/dynamic';
import { ClerkAuthFallback } from '@/components/auth/ClerkAuthFallback';

const SignUp = dynamic(
  () => import('@clerk/nextjs').then((mod) => mod.SignUp),
  {
    ssr: false,
    loading: () => <ClerkAuthFallback />,
  }
);

export function SignUpPanel() {
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
