/**
 * OWNER: Person 1 (Backend)
 * PURPOSE: Clerk sign-up page
 * DEPENDENCIES: @clerk/nextjs
 * STATUS: Ready to use
 */

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-nightshift-bg-card border border-nightshift-border',
          },
        }}
      />
    </div>
  );
}
