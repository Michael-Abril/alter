/**
 * Dashboard sidebar — Alter product navigation (icons only, no emoji).
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Forward, LayoutDashboard, FileEdit, ScrollText, Settings } from 'lucide-react';
import { AlterWordmark } from '@/components/brand/AlterLogo';

const navItems = [
  { href: '/dashboard', label: 'Morning brief', icon: LayoutDashboard },
  { href: '/dashboard/drafts', label: 'Draft review', icon: FileEdit },
  { href: '/dashboard/handoff', label: 'Handoff', icon: Forward },
  { href: '/dashboard/activity', label: 'Activity', icon: ScrollText },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
] as const;

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[17rem] flex-col border-r border-alter-border bg-gradient-to-b from-alter-bg to-alter-surface shadow-[inset_-1px_0_0_rgba(212,167,68,0.08)]">
      <div className="border-b border-alter-border px-4 py-5">
        <AlterWordmark tone="app" />
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4" aria-label="Primary">
        {(DEMO_MODE
          ? navItems.filter((item) => item.href === '/dashboard' || item.href === '/dashboard/handoff')
          : navItems
        ).map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-r-xl border-l-[3px] py-2.5 pl-3 pr-3 text-sm transition-all duration-200 ${
                isActive
                  ? 'border-l-alter-primary bg-alter-surface-elevated font-medium text-alter-text shadow-[inset_0_1px_0_0_rgba(212,167,68,0.06)]'
                  : 'border-l-transparent text-alter-muted/75 hover:bg-alter-surface/50 hover:text-alter-text-secondary'
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 stroke-[1.5] transition-colors duration-200 ${
                  isActive ? 'text-alter-gold-light' : 'text-alter-muted group-hover:text-alter-text-secondary'
                }`}
                aria-hidden
              />
              <span className="leading-snug">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-alter-border px-4 py-4">
        <div className="flex items-center gap-2 text-xs text-alter-muted">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.45)]"
            aria-hidden
          />
          <span>Session active</span>
        </div>
      </div>
    </aside>
  );
}
