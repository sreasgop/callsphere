import { useState, type ReactNode } from 'react';
import {
  Check,
  Clock,
  Copy,
  Grip,
  Hash,
  MessageSquare,
  Settings,
  UserRound,
  Users,
} from 'lucide-react';
import type { UserProfile } from '../../lib/api';
import type { ConnectionState } from '../../lib/socket';
import { formatUidDisplay } from '../../lib/format';
import { soundEngine } from '../../lib/soundEngine';
import { Badge } from '../ui/Badge';

export type AppTab = 'dialer' | 'recents' | 'chat' | 'contacts' | 'groups' | 'settings';

interface AppShellProps {
  user: UserProfile;
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  connectionState: ConnectionState;
  unreadChatCount?: number;
  children: ReactNode;
}

const NAV_ITEMS: Array<{ id: AppTab; label: string; icon: typeof Hash }> = [
  { id: 'dialer', label: 'Keypad', icon: Hash },
  { id: 'recents', label: 'Recents', icon: Clock },
  { id: 'chat', label: 'Messages', icon: MessageSquare },
  { id: 'contacts', label: 'Contacts', icon: UserRound },
  { id: 'groups', label: 'Groups', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function AppShell({
  user,
  activeTab,
  onSelectTab,
  connectionState,
  unreadChatCount = 0,
  children,
}: AppShellProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyUid = () => {
    soundEngine.playClick();
    void navigator.clipboard?.writeText(user.uid);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const statusTone =
    connectionState === 'online'
      ? 'online'
      : connectionState === 'connecting'
        ? 'warn'
        : 'danger';

  const statusLabel =
    connectionState === 'online'
      ? 'Online'
      : connectionState === 'connecting'
        ? 'Connecting'
        : 'Offline';

  return (
    <div className="h-dvh w-full overflow-hidden bg-canvas text-text-primary flex flex-col md:flex-row">
      {/* Desktop Left Icon Rail */}
      <aside className="hidden md:flex w-16 shrink-0 flex-col items-center py-4 gap-2 bg-surface border-r border-border-subtle">
        <div
          className="size-10 rounded-md bg-elevated border border-border-default flex items-center justify-center text-text-primary mb-3"
          title="CallSphere"
        >
          <Grip className="size-4" strokeWidth={1.75} />
        </div>

        <nav className="flex-1 flex flex-col items-center gap-1.5 w-full px-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                aria-label={item.label}
                onClick={() => {
                  soundEngine.playClick();
                  onSelectTab(item.id);
                }}
                className={`relative size-11 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                  active
                    ? 'bg-accent-muted text-accent border border-accent-border'
                    : 'text-text-secondary hover:bg-hover hover:text-text-primary border border-transparent'
                }`}
              >
                <Icon className="size-5" strokeWidth={1.5} />
                {item.id === 'chat' && unreadChatCount > 0 ? (
                  <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent" />
                ) : null}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Desktop Identity Header */}
        <header className="hidden md:flex h-14 shrink-0 px-6 border-b border-border-subtle bg-surface/70 backdrop-blur-md items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-8 rounded-full bg-elevated border border-border-default flex items-center justify-center text-xs font-semibold text-text-primary shrink-0">
              {user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex flex-col">
              <div className="text-sm font-medium text-text-primary truncate leading-tight">
                {user.full_name}
              </div>
              <button
                type="button"
                onClick={handleCopyUid}
                title="Copy 10-digit UID"
                className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <span>{copied ? 'Copied' : formatUidDisplay(user.uid)}</span>
                {copied ? (
                  <Check className="size-3 text-online" strokeWidth={1.75} />
                ) : (
                  <Copy className="size-3 text-text-muted" strokeWidth={1.5} />
                )}
              </button>
            </div>
          </div>

          <Badge tone={statusTone}>
            <span
              className={`size-1.5 rounded-full ${
                connectionState === 'online'
                  ? 'bg-online'
                  : connectionState === 'connecting'
                    ? 'bg-warn'
                    : 'bg-danger'
              }`}
            />
            <span>{statusLabel}</span>
          </Badge>
        </header>

        {/* Mobile Compact Network Status Bar */}
        <header className="md:hidden h-10 shrink-0 px-4 border-b border-border-subtle bg-surface/80 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
            <Grip className="size-3.5 text-accent" strokeWidth={1.75} />
            <span>CallSphere</span>
          </div>
          <Badge tone={statusTone}>
            <span
              className={`size-1.5 rounded-full ${
                connectionState === 'online'
                  ? 'bg-online'
                  : connectionState === 'connecting'
                    ? 'bg-warn'
                    : 'bg-danger'
              }`}
            />
            <span>{statusLabel}</span>
          </Badge>
        </header>

        {/* Scrollable View Body */}
        <main className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 md:py-6 pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 pb-[env(safe-area-inset-bottom)] bg-surface/95 backdrop-blur-md border-t border-border-subtle grid grid-cols-6">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onSelectTab(item.id);
              }}
              className={`relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
                active ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {active ? (
                <span className="absolute top-0 w-6 h-0.5 rounded-full bg-accent" />
              ) : null}
              <span className="relative">
                <Icon className="size-5" strokeWidth={1.6} />
                {item.id === 'chat' && unreadChatCount > 0 ? (
                  <span className="absolute -top-0.5 -right-1 size-1.5 rounded-full bg-accent" />
                ) : null}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
