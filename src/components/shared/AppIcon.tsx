/**
 * OWNER: Person 4 (Voice/UI)
 * PURPOSE: Icons for Gmail, Docs, Notion, GitHub, etc.
 * DEPENDENCIES: None
 * STATUS: Ready to use — add more app icons as needed
 */

const APP_ICONS: Record<string, { emoji: string; bg: string }> = {
  gmail: { emoji: '📧', bg: 'bg-red-500/10' },
  gdocs: { emoji: '📄', bg: 'bg-blue-500/10' },
  github: { emoji: '💻', bg: 'bg-gray-500/10' },
  notion: { emoji: '📝', bg: 'bg-white/10' },
  slack: { emoji: '💬', bg: 'bg-purple-500/10' },
  claude: { emoji: '🤖', bg: 'bg-orange-500/10' },
  chatgpt: { emoji: '🧠', bg: 'bg-green-500/10' },
};

interface AppIconProps {
  app: string;
  size?: 'sm' | 'md';
}

export default function AppIcon({ app, size = 'md' }: AppIconProps) {
  const icon = APP_ICONS[app] || { emoji: '📎', bg: 'bg-nightshift-bg-light' };
  const sizeClasses = size === 'sm' ? 'h-6 w-6 text-sm' : 'h-8 w-8 text-lg';

  return (
    <div
      className={`flex items-center justify-center rounded-lg ${icon.bg} ${sizeClasses} flex-shrink-0`}
      title={app}
    >
      {icon.emoji}
    </div>
  );
}
