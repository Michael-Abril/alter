import type { DisplayKind } from '@/lib/project-deliverable';
import { Code, FileText, GraduationCap, Mail } from 'lucide-react';

export function ProjectKindBadge({ kind }: { kind: DisplayKind }) {
  if (kind === 'academic') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/35 bg-blue-500/15 px-2 py-0.5">
        <GraduationCap className="h-3.5 w-3.5 text-blue-300" strokeWidth={1.75} aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-200/90">Academic</span>
      </span>
    );
  }
  if (kind === 'code') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5">
        <Code className="h-3.5 w-3.5 text-emerald-300" strokeWidth={1.75} aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">Code</span>
      </span>
    );
  }
  if (kind === 'document') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-violet-500/35 bg-violet-500/15 px-2 py-0.5">
        <FileText className="h-3.5 w-3.5 text-violet-300" strokeWidth={1.75} aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-200/90">Document</span>
      </span>
    );
  }
  if (kind === 'email') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-nightshift-border bg-nightshift-bg-light/50 px-2 py-0.5">
        <Mail className="h-3.5 w-3.5 text-nightshift-highlight" strokeWidth={1.75} aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-nightshift-text-secondary">Email</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-nightshift-border/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-nightshift-text-muted">
      Task
    </span>
  );
}
