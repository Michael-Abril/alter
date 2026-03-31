/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Top bar with user info and NightShift status indicator
 * DEPENDENCIES: @clerk/nextjs
 * STATUS: Scaffold — needs real user data
 */

'use client';

import { UserButton } from '@clerk/nextjs';
import StatusIndicator from '@/components/shared/StatusIndicator';

export default function Header() {
  return (
    <header className="flex items-center justify-between border-b border-nightshift-border bg-nightshift-bg-light px-6 py-3">
      <div className="flex items-center gap-4">
        <StatusIndicator />
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-nightshift-text-secondary">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </span>
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: 'h-8 w-8',
            },
          }}
        />
      </div>
    </header>
  );
}
