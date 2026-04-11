/**
 * App source icons — Lucide only (no emoji), consistent with Alter shell.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  Brain,
  FileText,
  GitBranch,
  Mail,
  MessageSquare,
  Paperclip,
  StickyNote,
} from 'lucide-react';

const APP_ICONS: Record<string, { Icon: LucideIcon; bg: string; iconClass: string }> = {
  gmail: { Icon: Mail, bg: 'bg-red-500/10', iconClass: 'text-red-300' },
  gdocs: { Icon: FileText, bg: 'bg-blue-500/10', iconClass: 'text-blue-300' },
  github: { Icon: GitBranch, bg: 'bg-zinc-500/10', iconClass: 'text-zinc-300' },
  notion: { Icon: StickyNote, bg: 'bg-white/5', iconClass: 'text-zinc-200' },
  slack: { Icon: MessageSquare, bg: 'bg-purple-500/10', iconClass: 'text-purple-300' },
  claude: { Icon: Bot, bg: 'bg-orange-500/10', iconClass: 'text-orange-300' },
  chatgpt: { Icon: Brain, bg: 'bg-emerald-500/10', iconClass: 'text-emerald-300' },
};

interface AppIconProps {
  app: string;
  size?: 'sm' | 'md';
}

export default function AppIcon({ app, size = 'md' }: AppIconProps) {
  const meta = APP_ICONS[app] || {
    Icon: Paperclip,
    bg: 'bg-nightshift-bg-light',
    iconClass: 'text-nightshift-text-secondary',
  };
  const { Icon } = meta;
  const sizeClasses = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-lg ${meta.bg} ${sizeClasses}`}
      title={app}
    >
      <Icon className={`${iconSize} ${meta.iconClass}`} strokeWidth={1.75} aria-hidden />
    </div>
  );
}
