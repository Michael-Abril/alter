/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Top bar with user info and NightShift daemon status
 * DEPENDENCIES: @clerk/nextjs
 * STATUS: LIVE
 */

'use client';

import { UserButton } from '@clerk/nextjs';
import DaemonStatus from '@/components/layout/DaemonStatus';

export default function Header() {
  return (
    <header className="flex items-center justify-between border-b border-nightshift-border bg-nightshift-bg-light px-6 py-3">
      <div className="flex items-center gap-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-nightshift-text-muted">
          NightShift status
        </span>
        <DaemonStatus />
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
