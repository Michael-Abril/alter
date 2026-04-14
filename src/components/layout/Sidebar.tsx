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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[17rem] flex-col border-r border-nightshift-border bg-gradient-to-b from-nightshift-bg to-nightshift-bg-light shadow-[inset_-1px_0_0_rgba(124,58,237,0.06)]">
      <div className="border-b border-nightshift-border px-4 py-5">
        <AlterWordmark tone="app" />
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4" aria-label="Primary">
        {navItems.map((item) => {
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
                  ? 'border-l-teal-400 bg-[#1A1A2E] font-medium text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'
                  : 'border-l-transparent text-nightshift-text-muted/75 hover:bg-nightshift-bg-card/50 hover:text-nightshift-text-secondary'
              }`}
            >
              <Icon
                className={`h-[18px] w-[18px] shrink-0 stroke-[1.5] transition-colors duration-200 ${
                  isActive ? 'text-teal-300' : 'text-nightshift-text-muted group-hover:text-nightshift-text-secondary'
                }`}
                aria-hidden
              />
              <span className="leading-snug">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-nightshift-border px-4 py-4">
        <div className="flex items-center gap-2 text-xs text-nightshift-text-muted">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full bg-nightshift-success shadow-[0_0_8px_rgba(16,185,129,0.45)]"
            aria-hidden
          />
          <span>Session active</span>
        </div>
      </div>
    </aside>
  );
}
