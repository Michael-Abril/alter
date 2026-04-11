/**
 * Alter mark — layered panels + signal (identity / intelligence). Blue → purple gradient.
 */
'use client';

import { useId } from 'react';

export function AlterLogo({ className = 'h-9 w-9' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const g1 = `alter-g1-${uid}`;
  const g2 = `alter-g2-${uid}`;

  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={g1} x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563eb" />
          <stop offset="0.55" stopColor="#7c3aed" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id={g2} x1="14" y1="10" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563eb" stopOpacity="0.35" />
          <stop offset="1" stopColor="#7c3aed" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" className="fill-[#0b1220]" />
      {/* Layer stack — memory / identity */}
      <rect
        x="7"
        y="9"
        width="26"
        height="18"
        rx="3"
        stroke={`url(#${g1})`}
        strokeWidth="1.5"
        fill={`url(#${g2})`}
        opacity="0.9"
      />
      <rect x="9" y="20" width="22" height="14" rx="2.5" stroke={`url(#${g1})`} strokeWidth="1.35" fill={`url(#${g2})`} fillOpacity="0.2" opacity="0.9" />
      <rect x="11" y="27" width="18" height="9" rx="2" stroke={`url(#${g1})`} strokeWidth="1.2" fill="none" opacity="0.75" />
      {/* Live signal */}
      <circle cx="31" cy="9" r="2.25" fill="#06b6d4" className="shadow-[0_0_8px_rgba(6,182,212,0.65)]" />
    </svg>
  );
}

type WordmarkTone = 'app' | 'marketing';

export function AlterWordmark({
  className = '',
  tone = 'app',
  compact = false,
}: {
  className?: string;
  tone?: WordmarkTone;
  compact?: boolean;
}) {
  const titleClass =
    tone === 'marketing'
      ? 'font-display text-lg font-semibold tracking-tight text-alter-text'
      : 'font-display text-lg font-semibold tracking-tight text-nightshift-text-primary';
  const subClass =
    tone === 'marketing'
      ? 'mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-alter-text-secondary'
      : 'mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-nightshift-text-muted';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <AlterLogo className={compact ? 'h-8 w-8 shrink-0' : 'h-9 w-9 shrink-0'} />
      <div className="min-w-0 leading-tight">
        <span className={titleClass}>Alter</span>
        {!compact && <p className={subClass}>Digital twin</p>}
      </div>
    </div>
  );
}
