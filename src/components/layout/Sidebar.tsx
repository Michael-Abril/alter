/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Dashboard sidebar navigation
 * DEPENDENCIES: next/link, next/navigation
 * STATUS: Scaffold — needs active route highlighting polish
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Morning Brief', icon: '☀️' },
  { href: '/dashboard/handoff', label: "Tonight's Handoff", icon: '🌙' },
  { href: '/dashboard/activity', label: 'Activity Log', icon: '📋' },
  { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-nightshift-border bg-nightshift-bg-light">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-nightshift-border">
        <span className="text-xl font-bold">
          <span className="text-nightshift-text-primary">Night</span>
          <span className="text-nightshift-accent">Shift</span>
        </span>
        <span className="text-xs text-nightshift-text-muted ml-1">AI</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-nightshift-accent/10 text-nightshift-accent font-medium'
                  : 'text-nightshift-text-secondary hover:text-nightshift-text-primary hover:bg-nightshift-bg-card'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-nightshift-border px-4 py-4">
        <div className="flex items-center gap-2 text-xs text-nightshift-text-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-nightshift-success animate-pulse" />
          <span>NightShift Active</span>
        </div>
      </div>
    </aside>
  );
}
