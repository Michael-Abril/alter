/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Dashboard top bar — session status and account
 * DEPENDENCIES: @clerk/nextjs
 */

'use client';

import { UserButton } from '@clerk/nextjs';
import AlterHeaderStatus from '@/components/layout/AlterHeaderStatus';

export default function Header() {
  return (
    <header className="flex items-center justify-between border-b border-alter-border bg-alter-bg/90 px-5 py-3 backdrop-blur-md md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <AlterHeaderStatus />
      </div>
      <div className="flex items-center gap-4 pl-2">
        <time
          className="hidden text-sm text-alter-text-secondary sm:block"
          dateTime={new Date().toISOString()}
        >
          {new Date().toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </time>
        <UserButton
          appearance={{
            elements: {
              avatarBox: 'h-9 w-9 ring-2 ring-alter-border shadow-md',
            },
          }}
        />
      </div>
    </header>
  );
}
